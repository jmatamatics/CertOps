# CertOps Studio — State, Memory & Architecture

> CertOps Studio is fundamentally a **state management system** — every page, every interaction, and every agent behavior maps to a distinct memory type within the CoALA cognitive architecture.

---

## The CoALA Framework

**CoALA (Cognitive Architectures for Language Agents)** defines how language-model agents should organize memory and decision-making. It specifies:

- **Three long-term memory stores**: Semantic, Procedural, Episodic
- **One short-term store**: Working Memory
- **An action cycle**: Retrieval → Reasoning → Action → Learning

CertOps implements all of these as **separate, explicit systems** rather than cramming everything into LLM context.

---

## Memory Types in CertOps

### 1. Semantic Memory — "What the system knows"

| | |
|---|---|
| **Definition** | Factual knowledge about the world — domain documents, web search results |
| **Store** | Qdrant Cloud (`certops_docs` collection) + Tavily Search |
| **Persistence** | Permanent |
| **Pages** | **Build** (`/create`) |

The `retrieve_docs` node performs RAG: retrieves 20 chunks from Qdrant, reranks to the top 5 via Cohere Rerank, and augments with real-time Tavily web search. This retrieved knowledge is the foundation every downstream artifact is generated from.

Content enters semantic memory through **ingestion** (`backend/ingest.py`) — URLs are scraped, PDFs and DOCX files are parsed and chunked, then embedded into the vector store.

Semantic memory is **read-only during generation**. The system retrieves relevant knowledge but never modifies the vector store during a pipeline run.

---

### 2. Procedural Memory — "How the agent should behave"

| | |
|---|---|
| **Definition** | User-specific, program-specific rules that control agent behavior |
| **Store** | Qdrant Cloud (`certops_procedural_memory` collection) |
| **Persistence** | Permanent, scoped to `(user_namespace, program_id)` |
| **Pages** | **Configure** (`/configure`), **Test** (`/assess`) |

Procedural memory stores:

- **`evaluator_system_prompt`** — how the LLM-as-judge scores learner responses
- **`probe_evaluator_prompt`** — how follow-up probes are evaluated
- **`result_analyst_prompt`** — how the final summary is written
- **`question_format_template`** — how questions are presented to learners
- **`welcome_message` / `farewell_message`** — session bookend messages
- **`pass_thresholds`** — overall minimum, domain minimum, weak domain floor
- **`scoring_scale`** — score ranges mapping to expert / competent / novice

The namespace is a SHA-256 hash of the user's email. Under SSO, each person gets their own behavioral settings without retraining or redeploying the agent.

When an exam starts, procedural memory is loaded for that `(user, program)` pair and injected into `ExamState.procedural_memory`. Every exam node reads from it via the `_pm(state)` helper.

---

### 3. Episodic Memory — "What happened before"

| | |
|---|---|
| **Definition** | Checkpointed records of past interactions and graph states |
| **Store** | PostgreSQL (`checkpoints`, `checkpoint_blobs`, `checkpoint_writes` tables) / fallback: `MemorySaver` |
| **Persistence** | Session and beyond |
| **Pages** | **Build** (`/create`), **Test** (`/assess`) |

LangGraph's checkpoint system snapshots the **full graph state** after every node execution. This enables:

- **Time-travel editing** — In Express Mode, when a user edits an artifact (e.g., changes the competency framework), `update_state` overwrites the checkpoint at that specific node, then `invoke(None)` replays only the downstream nodes. Edit the framework → progression, assessments, rubrics, item bank, and blueprint all regenerate. Edit the rubrics → only item bank and blueprint regenerate.

- **Pause/resume exams** — The exam graph uses `interrupt()` to pause at each question and `Command(resume=...)` to continue. The full conversation state (proficiency scores, difficulty cursors, items administered) is checkpointed at every step.

The `thread_id` is the key — every pipeline run and every exam session gets a unique thread, and the checkpointer stores the full state tree.

---

### 4. Working Memory — "What the agent is thinking right now"

| | |
|---|---|
| **Definition** | The live state flowing through the graph during a single execution |
| **Store** | In-memory (`TypedDict`) |
| **Persistence** | Ephemeral — exists only during a run |
| **Pages** | **Build** (`/create`), **Test** (`/assess`) |

**Build Pipeline** — `CertOpsState`:
```
track, documents, document_sources, tavily_context,
competency_framework, learning_progression, assessments,
rubrics, item_bank, blueprint
```

**Exam Graph** — `ExamState`:
```
program_id, learner_id, program_name,
item_bank, rubrics, framework, assessments,
items_remaining, domain_rubrics, domain_difficulty_cursor,
current_item, current_domain, current_evaluation, probed,
messages, items_administered, domain_proficiency,
procedural_memory, exam_complete, passed, result_summary
```

Working memory is **bounded** — each node only sees what it needs from the state dict. This is a core CoALA principle: agents shouldn't try to hold everything in context.

---

### 5. Persistent Storage — "What the outcomes were"

| | |
|---|---|
| **Definition** | Durable records that outlive any single session |
| **Store** | PostgreSQL (`programs`, `learner_profiles` tables) / fallback: JSON files |
| **Persistence** | Permanent |
| **Pages** | **Deploy** (`/saved`), **Results** (`/results`) |

- **Programs** — The full artifact set (framework, progression, assessments, rubrics, item bank, blueprint) saved as a reusable certification program.
- **Learner Profiles** — Exam outcomes: `learner_id`, `program_id`, `thread_id`, `passed`, `overall_score`, `domain_breakdown`, `summary`, `created_at`.

This layer records **outcomes, not processes**. A program can be saved once and used to launch exams indefinitely. Results accumulate over time and feed into the analytics dashboard.

---

## CoALA Action Cycle in CertOps

### Build Pipeline (`graph.py`)

```
┌─────────────┐     ┌───────────┐     ┌──────────┐     ┌──────────┐
│  Retrieval   │────▶│ Reasoning │────▶│  Action   │────▶│ Learning │
│              │     │           │     │           │     │           │
│ retrieve_docs│     │ LLM nodes │     │ Produce   │     │ User edit │
│ (Qdrant+     │     │ generate  │     │ artifacts │     │ triggers  │
│  Tavily)     │     │ structured│     │ & store   │     │ replay of │
│              │     │ outputs   │     │           │     │ downstream│
└─────────────┘     └───────────┘     └──────────┘     └──────────┘
```

1. **Retrieval** — `retrieve_docs` pulls from semantic memory (Qdrant + Tavily) into working memory
2. **Reasoning** — Each node (competency framework → learning progression → assessments → rubrics → item bank → blueprint) uses structured LLM outputs
3. **Action** — Artifacts are produced and checkpointed
4. **Learning** — `update_state` modifies episodic memory and replays downstream — the agent updates its own state based on human feedback

### Exam Graph (`exam_graph.py`)

```
┌─────────────┐     ┌───────────┐     ┌──────────┐     ┌──────────┐
│  Retrieval   │────▶│ Reasoning │────▶│  Action   │────▶│ Learning │
│              │     │           │     │           │     │           │
│ load_program │     │ evaluate  │     │ present   │     │ difficulty│
│ (item bank + │     │ response  │     │ item via  │     │ cursor    │
│  procedural  │     │ (LLM-as-  │     │ interrupt │     │ adjusts   │
│  memory)     │     │  judge)   │     │ (external)│     │ up/down   │
└─────────────┘     └───────────┘     └──────────┘     └──────────┘
```

1. **Retrieval** — `load_program` pulls item bank, rubrics, and procedural memory into working memory
2. **Reasoning** — `evaluate_response` uses LLM-as-judge with procedural memory; `select_item` reasons over `domain_proficiency` to adaptively pick the next question
3. **Action** — `present_item` uses `interrupt()` to interact with the learner; `record_domain_score` updates proficiency state
4. **Learning** — `domain_difficulty_cursor` adjusts difficulty based on performance — the agent learns within the session about the learner's ability

---

## Summary: Memory → Pages → Stores

| Memory Type | CoALA Category | Scope | Store | CertOps Pages |
|---|---|---|---|---|
| **Semantic** | Semantic | Global knowledge | Qdrant `certops_docs` | Build |
| **Procedural** | Procedural | Per user + program | Qdrant `certops_procedural_memory` | Configure, Test |
| **Checkpoints** | Episodic | Per thread | PostgreSQL / MemorySaver | Build, Test |
| **Graph State** | Working | Single run | In-memory TypedDict | Build, Test |
| **Programs & Results** | — (Persistent) | Per program / learner | PostgreSQL / JSON files | Deploy, Results |

---

## Why This Matters

CertOps Studio demonstrates that building an AI-native application is not about calling an LLM — it's about **designing how state flows, persists, and transforms** across every layer of the system.

- Semantic memory makes the agent **knowledgeable**
- Procedural memory makes the agent **customizable**
- Episodic memory makes the agent **editable and resumable**
- Working memory makes the agent **focused**
- Persistent storage makes the agent **accountable**

Every page in the CertOps pipeline corresponds to a different memory type being the primary actor. The LangGraph checkpointer is the mechanism that ties them all together, making the entire system a coherent cognitive architecture — not just a chatbot wrapper.

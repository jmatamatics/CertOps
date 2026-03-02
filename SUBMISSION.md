# CertOps - Certification Challenge Submission

**[Live Demo](https://certops.vercel.app)** | **[GitHub Repo](https://github.com/jmatamatics/CertOps)** | **[Loom Video](TODO_LOOM_LINK)**

---

## Task 1: Problem + Audience

### 1.1 Problem Statement

Enterprise AI adoption efforts struggle to create up-to-date, role-specific, competency-based learning paths because official documentation is fragmented, rapidly evolving, and difficult to operationalize into structured certification programs.

### 1.2 Why This Is a Problem

As a Senior AI Enablement Manager, I am responsible for driving Microsoft 365 Copilot adoption across the organization. However, Microsoft's official learning materials and technical documentation are distributed across multiple sources, including documentation hubs, training paths, blog posts, and release notes. This fragmentation makes it difficult to determine which content is current, authoritative, and aligned with our governance standards.

At the same time, we need differentiated AI fluency tracks for everyday users, AI champions, and technical builders. Existing certifications and learning paths are either too generic or quickly become outdated as the product evolves. This leads to inconsistent adoption, unclear competency benchmarks, and significant manual effort to maintain enablement programs. We need a structured, AI-native system that transforms curated documentation into dynamic learning paths and competency-based assessments tailored to our organization.

### 1.3 Evaluation Criteria

CertOps is a pipeline, not a chatbot. The user selects a certification track (AI Champion or M365 Copilot User), clicks Generate, and the system produces six structured artifacts in a single run. Evaluation focuses on whether each artifact is grounded in the retrieved documentation, structurally complete, and useful to an enablement team.

| # | Pipeline Input (Track Selection) | Artifact Produced | Quality Criteria |
|---|----------------------------------|-------------------|-----------------|
| 1 | AI Champion | Competency Framework | 4+ domains covering agent creation, conversational design, connectors, and security/governance with behavioral indicators at each proficiency level |
| 2 | AI Champion | Learning Progression | Ordered objectives with prerequisites, suggested activities, and estimated hours that map back to framework domains |
| 3 | AI Champion | Assessment Tasks | Scenario-based performance tasks (not recall questions) grounded in retrieved Copilot Studio documentation |
| 4 | AI Champion | Scoring Rubrics | Weighted criteria with multi-level descriptors that align to the proficiency levels in the framework |
| 5 | AI Champion | Item Bank | Reusable items with model answers and scoring notes covering all framework domains |
| 6 | AI Champion | Certification Blueprint | Executive summary tying all artifacts together with assessment strategy and estimated duration |
| 7 | M365 Copilot User | Competency Framework | 4+ domains covering productivity apps, communication tools, data analysis, and prompting |
| 8 | M365 Copilot User | Assessment Tasks | Scenario-based tasks grounded in retrieved M365 Copilot documentation, not generic productivity advice |

The key evaluation question across all artifacts: **Is the generated content grounded in the retrieved documentation, or is it generic LLM output that could have been produced without RAG?**

Additionally, the retriever itself is evaluated using RAGAS on a synthetic test set (`data/synthetic_testset.csv`) generated from the Microsoft Learn corpus. Example retrieval queries:

- *"Is Copilot in Teams available for Mac users, and what are the requirements to access it?"*
- *"How does Microsoft 365 Copilot Chat integrate with OneDrive to enhance user productivity?"*
- *"What is Copilot in Excel used for?"*

These measure whether the retriever surfaces the correct documentation chunks (context precision, context recall) and whether the LLM's answers stay faithful to them (faithfulness).

---

## Task 2: Proposed Solution

### 2.1 Solution Description

CertOps is an agentic RAG application built with LangGraph. The user selects a certification track through a Next.js dashboard, and the system runs a multi-step pipeline: retrieve relevant documentation from Qdrant (Cohere-reranked), augment with Tavily web search for the latest platform updates, then generate six certification artifacts in sequence - competency framework, learning progression, assessments, rubrics, item bank, and certification blueprint.

Every LLM call uses OpenAI GPT-4o with structured output (Pydantic models) to ensure artifacts are valid and exportable. The final output is a comprehensive, styled HTML certification report that a non-technical user can download and hand to stakeholders. The look and feel is a polished dashboard: select a track, watch the pipeline progress with animated step indicators, then view and export the results.

### 2.2 Infrastructure Diagram and Tooling Choices

The full architecture diagram is in the [README](README.md#architecture). Each tooling choice and its justification:

| # | Component | Choice | Why |
|---|-----------|--------|-----|
| 1 | **LLM** | OpenAI GPT-4o | Best-in-class structured output via `with_structured_output()` - critical for generating valid Pydantic models |
| 2 | **Agent Orchestration** | LangGraph | Stateful graph maps directly to a multi-step pipeline where each node depends on the previous |
| 3 | **Tool** | Tavily Search | Purpose-built for AI apps; fetches latest platform updates not yet in the local corpus |
| 4 | **Embedding Model** | OpenAI text-embedding-3-small | High quality at low cost; 1536-dim vectors |
| 5 | **Vector Database** | Qdrant Cloud | Production-grade managed vector DB with metadata filtering on domain and audience |
| 6 | **Monitoring** | LangSmith | Full tracing of every LLM call, retrieval, and tool use |
| 7 | **Evaluation** | RAGAS | Measures faithfulness, context precision, and context recall - the metrics that matter for grounded generation |
| 8 | **User Interface** | Next.js + Tailwind + shadcn/ui + Motion | Polished dashboard with animated pipeline progress |
| 9 | **Deployment** | Vercel (frontend) + Render (backend) | Vercel handles CDN/edge; Render runs the FastAPI + LangGraph workflow |
| 10 | **Retriever** | Cohere Rerank v3.5 | Winner from RAGAS evaluation - retrieve top 20, rerank to top 5 |

### 2.3 RAG and Agent Components

**RAG components:**
- **Corpus**: 45 curated Microsoft Learn training module pages, chunked with `RecursiveCharacterTextSplitter` (chunk_size=1000, overlap=200), embedded with `text-embedding-3-small`, and stored in Qdrant Cloud with `metadata.domain` and `metadata.audience` payload indexes.
- **Retriever**: Qdrant similarity search (k=20) followed by Cohere `rerank-v3.5` (top_n=5). The reranker acts as a cross-encoder that scores each query-document pair together, promoting genuinely relevant chunks.
- **Generation**: GPT-4o with Pydantic structured output generates each artifact from the retrieved context.

**Agent components:**
- **Tavily Search tool**: Called during the `retrieve_docs` node to fetch the latest platform updates that may not yet be in the local corpus. The search query is track-specific - "Microsoft Copilot Studio latest updates" for AI Champion, "Microsoft 365 Copilot latest updates" for the User track.
- **Conditional routing**: The `check_documents` node acts as a quality gate - if fewer than 3 documents are retrieved, it loops back to retry before proceeding to generation.

---

## Task 3: Data Source and Chunking Strategy

### 3.1 Chunking Strategy

We use `RecursiveCharacterTextSplitter` with the following configuration:

| Parameter | Value |
|-----------|-------|
| `chunk_size` | 1000 |
| `chunk_overlap` | 200 |
| `separators` | `["\n## ", "\n### ", "\n\n", "\n", ". ", " ", ""]` |

**Why this strategy:**

1. **Markdown-aware splitting**: Microsoft Learn content is structured with clear `##` and `###` headings. The custom separator hierarchy ensures the splitter respects these boundaries first, keeping conceptually complete sections together.
2. **Right-sized chunks**: 1000 characters (~200-250 tokens) captures a complete concept while keeping retrieval precise. Larger chunks would dilute relevance; smaller chunks would fragment instructions.
3. **Overlap prevents context loss**: 200-character overlap ensures that context at chunk boundaries isn't lost, which is important for multi-step instructions that span paragraphs.

See: [`notebooks/01_data_pipeline.ipynb`](notebooks/01_data_pipeline.ipynb)

### 3.2 Data Source and External API

**Data source**: 45 curated pages from Microsoft Learn training modules, split across two certification tracks:

| Track | Pages | Metadata Domains |
|-------|-------|-----------------|
| AI Champion | 25 | architecture, connectors, security, governance |
| M365 Copilot User | 20 | productivity, communication, data-analysis, prompting, overview, adoption |

Each page is scraped, chunked (386 total chunks), and upserted to Qdrant with `domain` and `audience` metadata for filtered retrieval.

**External API**: [Tavily Search](https://tavily.com/) provides a freshness layer. During each pipeline run, the `retrieve_docs` node calls Tavily with a track-specific query to fetch the latest platform updates. This augments the static corpus with real-time information that may have been published after the corpus was assembled.

**How they interact**: Qdrant provides the core context (top 5 reranked chunks from the curated corpus), and Tavily provides supplemental context (up to 3 web search results truncated to 2000 characters). Both are concatenated into the context window that GPT-4o uses for generation. This means the LLM sees grounded documentation from the corpus *and* the latest updates from the web, producing certification artifacts that are both comprehensive and current.

---

## Task 4: End-to-End Prototype

### 4.1 Local Endpoint

The prototype runs locally with:

```bash
# Backend
uv run uvicorn backend.main:app --reload --port 8000

# Frontend
cd frontend && npm run dev
```

The LangGraph pipeline is fully operational: select a track at `localhost:3000`, click Generate, and the system runs all 7 nodes (retrieve_docs → generate_competency_framework → generate_learning_progression → generate_assessments → generate_rubrics → generate_item_bank → generate_blueprint), returning a complete certification package.

### 4.3 Public Deployment (Optional - Completed)

| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Vercel | [certops.vercel.app](https://certops.vercel.app) |
| Backend | Render | [certops.onrender.com](https://certops.onrender.com) |
| Vector DB | Qdrant Cloud | Collection `certops_docs` |

The frontend auto-deploys from the `main` branch via Vercel. The backend auto-deploys via Render using the project's `Dockerfile`.

---

## Task 5: Evaluation Baseline

### 5.1 RAGAS Baseline Results

We generated a synthetic test set using RAGAS Synthetic Data Generation (SDG) from the chunked corpus, then evaluated the baseline retriever (Qdrant similarity search, k=5, no reranking).

| Metric | Baseline Score |
|--------|---------------|
| Faithfulness | 0.6177 |
| Context Precision | 0.4093 |
| Context Recall | 0.5931 |

See: [`notebooks/02_retrieval_evaluation.ipynb`](notebooks/02_retrieval_evaluation.ipynb), Section 2b

### 5.2 Conclusions

- **Faithfulness (0.62)** indicates moderate grounding - the LLM answer is partially supported by the retrieved context, but there is room for hallucination.
- **Context Precision (0.41)** is the weakest metric. The retriever returns relevant chunks but struggles to rank them highest, meaning the most useful context isn't always at the top of the context window.
- **Context Recall (0.59)** shows the retriever captures roughly half the required evidence. For a certification system where accuracy matters, this needs improvement.

These scores motivated testing advanced retriever strategies: reranking and domain-filtered retrieval.

---

## Task 6: Advanced Retriever

### 6.1 Technique Choice

We chose **Cohere Rerank v3.5** as a cross-encoder reranker. Unlike the baseline retriever that scores documents independently using embedding similarity, the reranker scores each query-document pair together. This means it can understand nuanced relevance that bi-encoder embeddings miss - critical for our use case where certification questions often require specific procedural knowledge from the documentation.

### 6.2 Implementation

The reranked retriever pipeline: Qdrant retrieves top 20 candidates via dense vector search → Cohere `rerank-v3.5` re-scores all 20 with the query and selects the top 5 → those 5 chunks are passed to the LLM.

We also tested two additional strategies for comparison:
- **Filtered (Single Domain)**: An LLM classifier predicts a single domain, then Qdrant filters by that domain before retrieval (k=5).
- **Filtered (Multi Domain)**: An LLM classifier predicts multiple relevant domains, then Qdrant filters by all of them before retrieval (k=5).

Implementation: [`notebooks/02_retrieval_evaluation.ipynb`](notebooks/02_retrieval_evaluation.ipynb), Sections 3-4

### 6.3 RAGAS Comparison Table

| Metric | Baseline | Reranked (Cohere) | Filtered (Single Domain) | Filtered (Multi Domain) |
|--------|----------|-------------------|--------------------------|-------------------------|
| Faithfulness | 0.62 | **0.79** | 0.67 | 0.73 |
| Context Precision | 0.41 | **0.50** | 0.26 | 0.48 |
| Context Recall | 0.59 | 0.58 | 0.26 | **0.63** |

**Winner: Reranked retriever (Cohere `rerank-v3.5`, k=20 → top 5)**

The Cohere reranker outperformed every other strategy on the two metrics that matter most for a certification system - **faithfulness** and **context precision** - while keeping context recall essentially flat.

- **Reranked (Cohere):** Faithfulness jumped from 0.62 to 0.79 (+0.17), and context precision rose from 0.41 to 0.50 (+0.09). The cross-encoder sees query and document together, which promotes genuinely relevant chunks and grounds the LLM more faithfully.
- **Filtered (Single Domain):** All metrics dropped sharply. The synthetic test set includes multi-hop questions (25% MultiHopSpecific + 25% MultiHopAbstract) that span multiple domains. A single-domain filter excludes the cross-domain chunks those questions require.
- **Filtered (Multi Domain):** Achieved the highest context recall (0.63) by correctly identifying and pulling from multiple relevant domains. However, faithfulness and precision lagged behind the reranker.

We selected the Cohere reranked retriever for the production pipeline. It delivers the highest faithfulness (0.79) and context precision (0.50) - the two most critical metrics for a certification system where accuracy and grounding must be reliable.

---

## Task 7: Next Steps

### 7.1 Keeping Dense Vector Retrieval for Demo Day?

Yes - with the Cohere reranker on top. The retrieval pipeline for Demo Day will remain **dense vector retrieval (Qdrant) + Cohere cross-encoder reranking**, and here's why:

1. **The RAGAS numbers justify it.** The reranked retriever achieved 0.79 faithfulness and 0.50 context precision - the highest across all four strategies tested. For a certification system, faithfulness is non-negotiable: generated assessments and rubrics must be grounded in actual documentation, not hallucinated.

2. **Dense retrieval gives us the right initial candidate pool.** Qdrant's embedding-based search with k=20 casts a wide enough net to surface relevant chunks even when the query doesn't share exact terminology with the documentation. The reranker then promotes the truly relevant ones.

3. **The alternative (domain-filtered retrieval) is too brittle.** Single-domain filtering collapsed on multi-hop questions. Multi-domain filtering had the best recall but lower faithfulness - it retrieves more context but the LLM gets noisier input. The reranker strikes the best balance.

4. **The architecture already supports it in production.** Both `backend/graph.py` and `notebooks/03_certification_engine.ipynb` use the same `CohereRerank(model="rerank-v3.5", top_n=5)` configuration. The pipeline is deployed and running at [certops.vercel.app](https://certops.vercel.app).

For future iterations beyond Demo Day, the **adaptive assessment engine** described in the README's Future Work section would add a second LangGraph that delivers assessments to learners in real time, selecting items from the generated item bank based on the learner's proficiency level and evaluating free-text responses using LLM-as-judge against the rubrics.

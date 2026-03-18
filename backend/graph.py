import os
import json
from typing import TypedDict, Optional
from pathlib import Path

from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_qdrant import QdrantVectorStore
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_classic.retrievers.contextual_compression import ContextualCompressionRetriever
from langchain_cohere import CohereRerank
from langchain_tavily import TavilySearch
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

try:
    from langgraph.checkpoint.postgres import PostgresSaver
except ImportError:
    PostgresSaver = None

from backend.schemas import (
    CompetencyFramework, LearningProgression, AssessmentList,
    RubricList, ItemBank, CertificationBlueprint,
)

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
COLLECTION_NAME = "certops_docs"


class CertOpsState(TypedDict):
    track: str
    documents: list[str]
    document_sources: list[str]
    tavily_context: str
    program_id: Optional[str]
    competency_framework: Optional[dict]
    learning_progression: Optional[dict]
    assessments: Optional[list[dict]]
    rubrics: Optional[list[dict]]
    item_bank: Optional[list[dict]]
    blueprint: Optional[dict]


embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vector_store = QdrantVectorStore.from_existing_collection(
    embedding=embeddings,
    collection_name=COLLECTION_NAME,
    url=QDRANT_URL,
    api_key=QDRANT_API_KEY,
)

llm = ChatOpenAI(model="gpt-4o", temperature=0)

PIPELINE_STEPS = [
    "retrieve_docs",
    "generate_competency_framework",
    "generate_learning_progression",
    "generate_assessments",
    "generate_rubrics",
    "generate_item_bank",
    "generate_blueprint",
]

TRACK_SEARCH_QUERIES = {
    "AI Champion": "Microsoft Copilot Studio latest updates 2026",
    "M365 Copilot User": "Microsoft 365 Copilot latest updates 2026",
}

TRACK_DOMAIN_HINTS = {
    "AI Champion": (
        "Include at least 4 domains covering agent creation & configuration, "
        "conversational design, connectors/integrations, and security/governance."
    ),
    "M365 Copilot User": (
        "Include at least 4 domains covering productivity (Word, Excel, PowerPoint), "
        "communication (Teams, Outlook), data analysis, and prompting best practices."
    ),
}


def retrieve_docs(state: CertOpsState) -> dict:
    program_id = state.get("program_id")

    if program_id:
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        from backend.ingest import get_program_vector_store

        custom_vs = get_program_vector_store()
        qdrant_filter = Filter(must=[
            FieldCondition(key="metadata.program_id", match=MatchValue(value=program_id))
        ])
        retriever = custom_vs.as_retriever(
            search_kwargs={"k": 20, "filter": qdrant_filter}
        )
        compressor = CohereRerank(model="rerank-v3.5", top_n=5)
        reranked_retriever = ContextualCompressionRetriever(
            base_compressor=compressor,
            base_retriever=retriever,
        )

        description = state.get("tavily_context", "")
        query = f"{state['track']} {description}".strip() or f"{state['track']} certification competencies and skills"
        docs = reranked_retriever.invoke(query)
        doc_texts = [doc.page_content for doc in docs]
        doc_sources = [doc.metadata.get("source", "") for doc in docs]

        tavily_context = description
        return {"documents": doc_texts, "document_sources": doc_sources, "tavily_context": tavily_context}

    if state.get("documents") and len(state["documents"]) >= 3:
        return {}

    query = f"{state['track']} certification competencies and skills"
    wide_retriever = vector_store.as_retriever(search_kwargs={"k": 20})
    compressor = CohereRerank(model="rerank-v3.5", top_n=5)
    reranked_retriever = ContextualCompressionRetriever(
        base_compressor=compressor,
        base_retriever=wide_retriever,
    )
    docs = reranked_retriever.invoke(query)
    doc_texts = [doc.page_content for doc in docs]
    doc_sources = [doc.metadata.get("source", "") for doc in docs]

    tavily = TavilySearch(max_results=3)
    try:
        search_query = TRACK_SEARCH_QUERIES.get(state["track"], f"{state['track']} latest updates 2026")
        tavily_results = tavily.invoke(search_query)
        tavily_context = str(tavily_results)[:2000]
    except Exception:
        tavily_context = ""

    return {"documents": doc_texts, "document_sources": doc_sources, "tavily_context": tavily_context}


def check_documents(state: CertOpsState) -> str:
    if len(state.get("documents", [])) < 3:
        return "retry_retrieve"
    return "generate"


def generate_competency_framework(state: CertOpsState) -> dict:
    structured_llm = llm.with_structured_output(CompetencyFramework)
    context = "\n\n".join(state["documents"])
    domain_hint = TRACK_DOMAIN_HINTS.get(state["track"], "Include at least 4 relevant domains.")
    response = structured_llm.invoke([
        SystemMessage(content=(
            "You are an expert certification architect specializing in enterprise AI platforms. "
            "Using the provided documentation context, generate a comprehensive competency framework "
            f"for the specified track.\n\n"
            f"{domain_hint}\n\n"
            "CRITICAL: For each skill, you MUST provide detailed proficiency levels. "
            "Each proficiency level (novice, competent, expert) needs:\n"
            "- A 2-3 sentence descriptor explaining what performance looks like at that level\n"
            "- At least 2 specific, observable behavioral indicators (actions someone can demonstrate)\n\n"
            "Make descriptors concrete and distinguishable — a reader should clearly understand "
            "the difference between novice and expert for each skill.\n\n"
            f"Context:\n{context}\n\nLatest updates:\n{state.get('tavily_context', '')}"
        )),
        HumanMessage(content=f"Generate a competency framework for: {state['track']}"),
    ])
    return {"competency_framework": response.model_dump()}


def generate_learning_progression(state: CertOpsState) -> dict:
    structured_llm = llm.with_structured_output(LearningProgression)
    fw_str = json.dumps(state["competency_framework"], indent=2)
    response = structured_llm.invoke([
        SystemMessage(content=(
            "You are a senior instructional designer specializing in technical certification programs. "
            "Create an ordered learning progression from this competency framework.\n\n"
            "For EACH learning objective, you MUST provide:\n"
            "- A clear description of what the learner will be able to do\n"
            "- 2-3 specific hands-on activities (labs, exercises, projects) — not just 'read documentation'\n"
            "- Estimated hours to achieve the objective (be realistic: 1-8 hours per objective)\n"
            "- A concrete success criterion: how an evaluator knows the learner achieved this\n\n"
            "Activities should be practical and platform-specific (e.g., 'Build a customer FAQ agent "
            "in Copilot Studio' not 'Learn about agents').\n"
            "Earlier objectives should be prerequisites for later ones."
        )),
        HumanMessage(content=f"Create a learning progression for:\n{fw_str}"),
    ])
    return {"learning_progression": response.model_dump()}


def generate_assessments(state: CertOpsState) -> dict:
    structured_llm = llm.with_structured_output(AssessmentList)
    fw_str = json.dumps(state["competency_framework"], indent=2)
    context = "\n\n".join(state["documents"][:5])
    response = structured_llm.invoke([
        SystemMessage(content=(
            "You are a senior assessment designer for enterprise technology certification programs. "
            "Generate performance-based assessment tasks that evaluate real competence, not just recall.\n\n"
            "For EACH task, you MUST include:\n"
            "- A realistic workplace scenario (2-3 sentences of context)\n"
            "- Detailed step-by-step instructions\n"
            "- Specific expected outputs the candidate must produce\n"
            "- An evaluator guide that describes:\n"
            "  * What to look for in a passing submission\n"
            "  * Common mistakes and pitfalls candidates make\n"
            "  * The boundary between a pass and a fail\n"
            "  * Specific technical elements that must be present\n\n"
            f"Framework:\n{fw_str}\n\nContext:\n{context}"
        )),
        HumanMessage(content="Generate one assessment task per domain."),
    ])
    return {"assessments": [t.model_dump() for t in response.tasks]}


def generate_rubrics(state: CertOpsState) -> dict:
    structured_llm = llm.with_structured_output(RubricList)
    assessments_str = json.dumps(state["assessments"], indent=2)
    response = structured_llm.invoke([
        SystemMessage(content=(
            "You are an expert in rubric design for certification assessment. "
            "Create scoring rubrics with novice/competent/expert descriptors for "
            "consistent inter-rater reliability.\n\n"
            "For EACH criterion, you MUST provide:\n"
            "- A weight (1-5) reflecting relative importance for certification decisions\n"
            "- Novice descriptor: 2-3 sentences describing inadequate performance and what's missing\n"
            "- Competent descriptor: 2-3 sentences describing acceptable performance meeting standards\n"
            "- Expert descriptor: 2-3 sentences describing exceptional performance exceeding standards\n\n"
            "Descriptors should be specific enough that two independent evaluators would assign "
            "the same level to the same submission."
        )),
        HumanMessage(content=f"Create rubrics for:\n{assessments_str}"),
    ])
    return {"rubrics": [r.model_dump() for r in response.rubrics]}


_DIFFICULTY_TIER_PROMPTS = {
    "easy": (
        "All items in this batch MUST have difficulty='easy'.\n"
        "Easy items test RECALL and RECOGNITION — facts, definitions, identifying features.\n"
        "Example stem style: 'Which of the following is...?', 'What is the primary purpose of...?'\n"
        "Distractors should be clearly wrong to someone who studied the material."
    ),
    "medium": (
        "All items in this batch MUST have difficulty='medium'.\n"
        "Medium items test APPLICATION and ANALYSIS — applying knowledge to scenarios.\n"
        "Example stem style: 'Given this scenario, which approach would...?', "
        "'A team needs to accomplish X. What is the best strategy?'\n"
        "Distractors should be plausible to someone with surface-level knowledge."
    ),
    "hard": (
        "All items in this batch MUST have difficulty='hard'.\n"
        "Hard items test EVALUATION and SYNTHESIS — trade-offs, edge cases, multi-step reasoning.\n"
        "Example stem style: 'Given these conflicting requirements, which configuration best balances...?', "
        "'What is the most significant limitation of approach X when applied to Y?'\n"
        "Distractors should be tempting even to experienced practitioners."
    ),
}


def generate_item_bank(state: CertOpsState) -> dict:
    structured_llm = llm.with_structured_output(ItemBank)
    fw_str = json.dumps(state["competency_framework"], indent=2)

    domains = [d["name"] for d in state["competency_framework"].get("domains", [])]
    num_domains = len(domains)

    docs = state["documents"][:5]
    sources = (state.get("document_sources") or [])[:5]
    context_parts = []
    for i, doc in enumerate(docs):
        url = sources[i] if i < len(sources) else ""
        header = f"[Source: {url}]\n" if url else ""
        context_parts.append(f"{header}{doc}")
    context = "\n\n---\n\n".join(context_parts)

    source_list = "\n".join(f"- {s}" for s in sources if s)

    all_items: list[dict] = []

    for tier, tier_prompt in _DIFFICULTY_TIER_PROMPTS.items():
        mcq_per_domain = 4
        oe_per_domain = 1
        total_mcq = mcq_per_domain * num_domains
        total_oe = oe_per_domain * num_domains
        total = total_mcq + total_oe

        response = structured_llm.invoke([
            SystemMessage(content=(
                "You are an expert item writer for enterprise technology certifications.\n\n"
                f"{tier_prompt}\n\n"
                f"Generate items for ALL {num_domains} domains: {', '.join(domains)}.\n"
                f"For each domain, generate {mcq_per_domain} multiple choice + {oe_per_domain} open-ended.\n\n"
                "**Multiple choice items** (question_type='multiple_choice'): each must have "
                "exactly 4 choices formatted as 'A) ...', 'B) ...', 'C) ...', 'D) ...' and a "
                "correct_choice letter (e.g. 'B'). Include plausible distractors.\n"
                "**Open-ended items** (question_type='open_ended'): performance or "
                "scenario tasks requiring a written response. Set choices and correct_choice to null.\n\n"
                "For ALL items, you MUST include:\n"
                "- A detailed stem (the question or task prompt) — at least 2-3 sentences\n"
                "- Scoring notes for evaluators\n"
                "- A complete MODEL ANSWER that demonstrates an expert-level response\n"
                "- A source_url: pick the most relevant URL from the source list below. "
                "Every question must have a source_url.\n\n"
                f"## Available Source URLs\n{source_list}\n\n"
                f"## Framework\n{fw_str}\n\n## Context Documents\n{context}"
            )),
            HumanMessage(content=f"Generate {total} items ({total_mcq} MCQ + {total_oe} open-ended) at difficulty='{tier}' spanning all {num_domains} domains."),
        ])
        all_items.extend(item.model_dump() for item in response.items)

    return {"item_bank": all_items}


def generate_blueprint(state: CertOpsState) -> dict:
    structured_llm = llm.with_structured_output(CertificationBlueprint)
    summary = {
        "track": state["track"],
        "framework": state["competency_framework"],
        "num_objectives": len(state["learning_progression"]["objectives"]),
        "num_assessments": len(state["assessments"]),
        "num_rubrics": len(state["rubrics"]),
        "num_items": len(state["item_bank"]),
    }
    response = structured_llm.invoke([
        SystemMessage(content=(
            "You are a certification program director writing an executive summary of a "
            "certification program. Synthesize all the artifacts that have been generated "
            "into a cohesive Certification Blueprint.\n\n"
            "The blueprint should read like a document you'd present to a VP of Learning & "
            "Development to get buy-in for launching this certification program. "
            "The program_overview should be 2-3 substantive paragraphs. "
            "The assessment_strategy should explain the philosophy (performance-based, not "
            "multiple choice) and how it maps to real-world competence."
        )),
        HumanMessage(content=f"Create a certification blueprint from:\n{json.dumps(summary, indent=2)}"),
    ])
    return {"blueprint": response.model_dump()}


ARTIFACT_TO_NODE = {
    "competency_framework": "generate_competency_framework",
    "learning_progression": "generate_learning_progression",
    "assessments": "generate_assessments",
    "rubrics": "generate_rubrics",
    "item_bank": "generate_item_bank",
    "blueprint": "generate_blueprint",
}

DATABASE_URL = os.getenv("DATABASE_URL")
checkpointer = MemorySaver()
db_conn = None

if DATABASE_URL and PostgresSaver is not None:
    try:
        import psycopg
        db_conn = psycopg.Connection.connect(
            DATABASE_URL, autocommit=True, prepare_threshold=0,
        )
        checkpointer = PostgresSaver(db_conn)
        with db_conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS checkpoints (
                    thread_id TEXT NOT NULL,
                    checkpoint_ns TEXT NOT NULL DEFAULT '',
                    checkpoint_id TEXT NOT NULL,
                    parent_checkpoint_id TEXT,
                    type TEXT,
                    checkpoint JSONB NOT NULL,
                    metadata_ JSONB NOT NULL DEFAULT '{}',
                    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
                );
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS checkpoint_blobs (
                    thread_id TEXT NOT NULL,
                    checkpoint_ns TEXT NOT NULL DEFAULT '',
                    channel TEXT NOT NULL,
                    version TEXT NOT NULL,
                    type TEXT NOT NULL,
                    blob BYTEA,
                    PRIMARY KEY (thread_id, checkpoint_ns, channel, version)
                );
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS checkpoint_writes (
                    thread_id TEXT NOT NULL,
                    checkpoint_ns TEXT NOT NULL DEFAULT '',
                    checkpoint_id TEXT NOT NULL,
                    task_id TEXT NOT NULL,
                    idx INTEGER NOT NULL,
                    channel TEXT NOT NULL,
                    type TEXT,
                    blob BYTEA NOT NULL,
                    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
                );
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS programs (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    track_key TEXT NOT NULL,
                    artifacts JSONB NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                );
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS learner_profiles (
                    learner_id TEXT NOT NULL,
                    program_id TEXT NOT NULL,
                    thread_id TEXT NOT NULL,
                    passed BOOLEAN,
                    overall_score REAL,
                    domain_breakdown JSONB,
                    summary TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    PRIMARY KEY (learner_id, program_id, created_at)
                );
            """)
        print("Checkpointer: PostgresSaver (persistent)")
    except Exception as e:
        print(f"PostgreSQL connection failed, using MemorySaver: {e}")
        checkpointer = MemorySaver()
else:
    print("Checkpointer: MemorySaver (volatile)")


def build_graph():
    builder = StateGraph(CertOpsState)

    builder.add_node("retrieve_docs", retrieve_docs)
    builder.add_node("generate_competency_framework", generate_competency_framework)
    builder.add_node("generate_learning_progression", generate_learning_progression)
    builder.add_node("generate_assessments", generate_assessments)
    builder.add_node("generate_rubrics", generate_rubrics)
    builder.add_node("generate_item_bank", generate_item_bank)
    builder.add_node("generate_blueprint", generate_blueprint)

    builder.add_edge(START, "retrieve_docs")
    builder.add_conditional_edges(
        "retrieve_docs",
        check_documents,
        {"retry_retrieve": "retrieve_docs", "generate": "generate_competency_framework"},
    )
    builder.add_edge("generate_competency_framework", "generate_learning_progression")
    builder.add_edge("generate_learning_progression", "generate_assessments")
    builder.add_edge("generate_assessments", "generate_rubrics")
    builder.add_edge("generate_rubrics", "generate_item_bank")
    builder.add_edge("generate_item_bank", "generate_blueprint")
    builder.add_edge("generate_blueprint", END)

    return builder.compile(checkpointer=checkpointer)


graph = build_graph()

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
    tavily_context: str
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
    query = f"{state['track']} certification competencies and skills"
    wide_retriever = vector_store.as_retriever(search_kwargs={"k": 20})
    compressor = CohereRerank(model="rerank-v3.5", top_n=5)
    reranked_retriever = ContextualCompressionRetriever(
        base_compressor=compressor,
        base_retriever=wide_retriever,
    )
    docs = reranked_retriever.invoke(query)
    doc_texts = [doc.page_content for doc in docs]

    tavily = TavilySearch(max_results=3)
    try:
        tavily_results = tavily.invoke("Microsoft Copilot Studio latest updates 2026")
        tavily_context = str(tavily_results)[:2000]
    except Exception:
        tavily_context = ""

    return {"documents": doc_texts, "tavily_context": tavily_context}


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


def generate_item_bank(state: CertOpsState) -> dict:
    structured_llm = llm.with_structured_output(ItemBank)
    fw_str = json.dumps(state["competency_framework"], indent=2)
    context = "\n\n".join(state["documents"][:5])
    response = structured_llm.invoke([
        SystemMessage(content=(
            "You are an expert item writer for enterprise technology certifications. "
            "Generate performance/scenario/analysis items (NOT multiple choice).\n\n"
            "For EACH item, you MUST include:\n"
            "- A detailed stem (the question or task prompt) — at least 2-3 sentences\n"
            "- Scoring notes for evaluators\n"
            "- A complete MODEL ANSWER (3-5 paragraphs) that demonstrates what an expert-level "
            "response looks like. This model answer should be detailed enough that an evaluator "
            "can use it as a reference when scoring candidate responses.\n\n"
            f"Framework:\n{fw_str}\n\nContext:\n{context}"
        )),
        HumanMessage(content="Generate 10 item bank entries spanning all domains."),
    ])
    return {"item_bank": [item.model_dump() for item in response.items]}


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

    return builder.compile()


graph = build_graph()

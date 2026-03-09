"""Adaptive Exam LangGraph — conversational assessment with per-domain proficiency tracking."""

from __future__ import annotations

import json
import random

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, START, END
from langgraph.types import interrupt

from backend.exam_schemas import (
    ExamState,
    EvaluationResult,
    ExamResultSummary,
    DIFFICULTY_MAP,
)
from backend.graph import checkpointer

llm = ChatOpenAI(model="gpt-4o", temperature=0)


# ── Helper ──

def _extract_domain(competency_ref: str) -> str:
    return competency_ref.split(":")[0].strip()


def _build_domain_rubrics(rubrics: list[dict], assessments: list[dict]) -> dict:
    """Map domain names to their rubric criteria."""
    assessment_domain = {}
    for a in assessments:
        domain = _extract_domain(a.get("competency_ref", ""))
        assessment_domain[a["title"]] = domain

    domain_rubrics: dict[str, list[dict]] = {}
    for r in rubrics:
        domain = assessment_domain.get(r["assessment_ref"])
        if domain and domain not in domain_rubrics:
            domain_rubrics[domain] = r["criteria"]
    return domain_rubrics


def _format_rubric_criteria(criteria: list[dict]) -> str:
    lines = []
    for c in criteria:
        lines.append(
            f"- **{c['criterion']}** (weight {c['weight']})\n"
            f"  Novice: {c['novice']}\n"
            f"  Competent: {c['competent']}\n"
            f"  Expert: {c['expert']}"
        )
    return "\n".join(lines)


# ── Nodes ──

def load_program(state: ExamState) -> dict:
    """Prepare items with difficulty estimates, domain-rubric mapping, initial proficiency."""
    items_with_difficulty = []
    for i, item in enumerate(state["item_bank"]):
        enriched = {**item, "index": i, "difficulty": DIFFICULTY_MAP.get(item.get("task_type", ""), 2)}
        items_with_difficulty.append(enriched)

    random.shuffle(items_with_difficulty)

    domain_rubrics = _build_domain_rubrics(state["rubrics"], state["assessments"])

    domains = [d["name"] for d in state["framework"].get("domains", [])]
    domain_proficiency = {d: {"score": 0.0, "items_count": 0, "level": "untested"} for d in domains}

    return {
        "items_remaining": items_with_difficulty,
        "domain_rubrics": domain_rubrics,
        "domain_proficiency": domain_proficiency,
        "current_item": None,
        "current_domain": "",
        "current_evaluation": None,
        "probed": False,
        "exam_complete": False,
        "passed": None,
        "result_summary": None,
    }


def select_item(state: ExamState) -> dict:
    """Adaptively pick the next item: prioritise untested/weak domains."""
    remaining = list(state["items_remaining"])
    proficiency = state["domain_proficiency"]

    untested = [d for d, p in proficiency.items() if p["items_count"] == 0]
    weak = [d for d, p in proficiency.items() if p["items_count"] > 0 and p["score"] < 2.0]
    priority_domains = untested or weak

    chosen = None
    if priority_domains:
        for item in remaining:
            if _extract_domain(item["competency_ref"]) in priority_domains:
                chosen = item
                break

    if chosen is None and remaining:
        chosen = remaining[0]

    if chosen is None:
        return {"exam_complete": True, "current_item": None}

    remaining.remove(chosen)
    domain = _extract_domain(chosen["competency_ref"])

    return {
        "current_item": chosen,
        "current_domain": domain,
        "items_remaining": remaining,
        "current_evaluation": None,
        "probed": False,
    }


def present_item(state: ExamState) -> dict:
    """Present the item to the learner and wait for a response."""
    item = state["current_item"]
    if item is None:
        return {"exam_complete": True}

    n_done = len(state.get("items_administered", []))
    n_total = n_done + len(state["items_remaining"]) + 1
    question = (
        f"**Question {n_done + 1} of {n_total}** — _{state['current_domain']}_\n\n"
        f"{item['stem']}"
    )

    learner_response = interrupt({
        "type": "question",
        "content": question,
        "domain": state["current_domain"],
        "progress": {
            "items_completed": n_done,
            "total_items": n_total,
            "domain_proficiency": state["domain_proficiency"],
        },
    })

    return {
        "messages": [
            {"role": "agent", "content": question},
            {"role": "learner", "content": learner_response},
        ],
    }


def evaluate_response(state: ExamState) -> dict:
    """LLM-as-judge evaluation of the learner's response."""
    item = state["current_item"]
    domain = state["current_domain"]
    domain_rubrics = state.get("domain_rubrics", {})
    criteria = domain_rubrics.get(domain, [])

    learner_response = ""
    for msg in reversed(state.get("messages", [])):
        if msg["role"] == "learner":
            learner_response = msg["content"]
            break

    rubric_text = _format_rubric_criteria(criteria) if criteria else "Use general assessment criteria for quality, depth, and accuracy."

    structured_llm = llm.with_structured_output(EvaluationResult)
    result = structured_llm.invoke([
        SystemMessage(content=(
            "You are an expert certification exam evaluator. Score the learner's response "
            "against the rubric criteria.\n\n"
            f"## Item\n{item['stem']}\n\n"
            f"## Model Answer\n{item['model_answer']}\n\n"
            f"## Scoring Notes\n{item['scoring_notes']}\n\n"
            f"## Rubric Criteria\n{rubric_text}\n\n"
            "Score each criterion 1 (novice), 2 (competent), or 3 (expert).\n"
            "Set confidence to 'clear' if the level is obvious, or 'borderline' if "
            "a targeted follow-up question would help disambiguate. If borderline, "
            "provide a specific probe_question."
        )),
        HumanMessage(content=f"Learner's response:\n{learner_response}"),
    ])

    return {"current_evaluation": result.model_dump()}


def probe_or_score(state: ExamState) -> dict:
    """Ask a follow-up probe and re-evaluate with the additional context."""
    evaluation = state["current_evaluation"]
    probe_question = evaluation.get("probe_question", "Can you elaborate on your answer?")

    follow_up = interrupt({
        "type": "probe",
        "content": probe_question,
        "feedback": evaluation.get("feedback", ""),
    })

    item = state["current_item"]
    domain = state["current_domain"]
    domain_rubrics = state.get("domain_rubrics", {})
    criteria = domain_rubrics.get(domain, [])

    original_response = ""
    for msg in state.get("messages", []):
        if msg["role"] == "learner":
            original_response = msg["content"]
            break

    rubric_text = _format_rubric_criteria(criteria) if criteria else "Use general assessment criteria."

    structured_llm = llm.with_structured_output(EvaluationResult)
    result = structured_llm.invoke([
        SystemMessage(content=(
            "You are an expert certification exam evaluator. The learner gave an initial "
            "response and then answered a follow-up probe. Re-evaluate holistically.\n\n"
            f"## Item\n{item['stem']}\n\n"
            f"## Model Answer\n{item['model_answer']}\n\n"
            f"## Scoring Notes\n{item['scoring_notes']}\n\n"
            f"## Rubric Criteria\n{rubric_text}\n\n"
            f"## Original Response\n{original_response}\n\n"
            f"## Follow-up Probe\n{probe_question}\n\n"
            "Score each criterion 1-3. Set confidence to 'clear' this time."
        )),
        HumanMessage(content=f"Follow-up response:\n{follow_up}"),
    ])

    return {
        "messages": [
            {"role": "agent", "content": probe_question},
            {"role": "learner", "content": follow_up},
        ],
        "current_evaluation": result.model_dump(),
        "probed": True,
    }


def update_proficiency(state: ExamState) -> dict:
    """Update domain proficiency with the current item's evaluation."""
    evaluation = state["current_evaluation"]
    domain = state["current_domain"]
    item = state["current_item"]
    score = evaluation["weighted_score"]

    proficiency = dict(state["domain_proficiency"])
    current = proficiency.get(domain, {"score": 0.0, "items_count": 0, "level": "untested"})
    new_count = current["items_count"] + 1
    new_score = ((current["score"] * current["items_count"]) + score) / new_count

    level = "novice" if new_score < 1.7 else ("competent" if new_score < 2.5 else "expert")
    proficiency[domain] = {"score": round(new_score, 2), "items_count": new_count, "level": level}

    feedback_msg = evaluation.get("feedback", "")
    administered_entry = {
        "item": item,
        "domain": domain,
        "score": score,
        "feedback": feedback_msg,
        "probed": state.get("probed", False),
    }

    return {
        "domain_proficiency": proficiency,
        "items_administered": [administered_entry],
        "messages": [{"role": "agent", "content": f"**Feedback:** {feedback_msg}"}],
    }


def determine_result(state: ExamState) -> dict:
    """Calculate pass/fail and generate a narrative summary."""
    proficiency = state["domain_proficiency"]
    tested = {d: p for d, p in proficiency.items() if p["items_count"] > 0}

    if not tested:
        return {
            "exam_complete": True,
            "passed": False,
            "result_summary": {"passed": False, "overall_score": 0, "summary": "No items administered.", "recommendation": "Please retake the exam.", "domain_breakdown": {}},
        }

    overall = sum(p["score"] for p in tested.values()) / len(tested)
    all_competent = all(p["score"] >= 2.0 for p in tested.values())
    none_failing = all(p["score"] >= 1.5 for p in tested.values())
    passed = all_competent or (overall >= 2.0 and none_failing)

    domain_breakdown = {d: {**p} for d, p in proficiency.items()}

    structured_llm = llm.with_structured_output(ExamResultSummary)
    result = structured_llm.invoke([
        SystemMessage(content=(
            "You are a certification exam results analyst. Generate a clear, "
            "encouraging but honest summary of the learner's performance.\n\n"
            f"## Domain Scores\n{json.dumps(domain_breakdown, indent=2)}\n\n"
            f"## Overall Score: {overall:.2f} / 3.00\n"
            f"## Passed: {passed}\n"
            f"## Pass Threshold: 2.0 (competent) in all domains, or 2.0 overall with no domain below 1.5"
        )),
        HumanMessage(content="Generate the exam result summary."),
    ])

    result_dict = result.model_dump()
    result_dict["overall_score"] = round(overall, 2)
    result_dict["passed"] = passed
    result_dict["domain_breakdown"] = domain_breakdown

    return {
        "exam_complete": True,
        "passed": passed,
        "result_summary": result_dict,
        "messages": [{"role": "agent", "content": f"## Exam Complete\n\n{result.summary}\n\n**Recommendation:** {result.recommendation}"}],
    }


# ── Conditional routing ──

def after_evaluate(state: ExamState) -> str:
    evaluation = state.get("current_evaluation", {})
    if evaluation.get("confidence") == "borderline" and not state.get("probed", False):
        return "probe_or_score"
    return "update_proficiency"


def after_update(state: ExamState) -> str:
    if not state["items_remaining"]:
        return "determine_result"
    proficiency = state["domain_proficiency"]
    domains = list(proficiency.keys())
    all_tested = all(proficiency[d]["items_count"] > 0 for d in domains)
    if all_tested and len(state.get("items_administered", [])) >= len(domains):
        uncertain = [
            d for d in domains
            if proficiency[d]["items_count"] < 2
            and any(_extract_domain(it["competency_ref"]) == d for it in state["items_remaining"])
        ]
        if not uncertain:
            return "determine_result"
    return "select_item"


# ── Build graph ──

def build_exam_graph():
    builder = StateGraph(ExamState)

    builder.add_node("load_program", load_program)
    builder.add_node("select_item", select_item)
    builder.add_node("present_item", present_item)
    builder.add_node("evaluate_response", evaluate_response)
    builder.add_node("probe_or_score", probe_or_score)
    builder.add_node("update_proficiency", update_proficiency)
    builder.add_node("determine_result", determine_result)

    builder.add_edge(START, "load_program")
    builder.add_edge("load_program", "select_item")
    builder.add_edge("select_item", "present_item")
    builder.add_edge("present_item", "evaluate_response")
    builder.add_conditional_edges("evaluate_response", after_evaluate, {
        "probe_or_score": "probe_or_score",
        "update_proficiency": "update_proficiency",
    })
    builder.add_edge("probe_or_score", "update_proficiency")
    builder.add_conditional_edges("update_proficiency", after_update, {
        "select_item": "select_item",
        "determine_result": "determine_result",
    })
    builder.add_edge("determine_result", END)

    return builder.compile(checkpointer=checkpointer)


exam_graph = build_exam_graph()

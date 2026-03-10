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
from backend.procedural_memory import get_default_memories

llm = ChatOpenAI(model="gpt-4o", temperature=0)


# ── Helper ──

def _pm(state: ExamState) -> dict:
    return state.get("procedural_memory") or get_default_memories()


def _extract_domain(competency_ref: str) -> str:
    return competency_ref.split(":")[0].strip()


def _build_domain_rubrics(rubrics: list[dict], assessments: list[dict]) -> dict:
    """Map domain names to their rubric criteria via assessments, with fuzzy fallback."""
    assessment_domain: dict[str, str] = {}
    for a in assessments:
        domain = _extract_domain(a.get("competency_ref", ""))
        assessment_domain[a["title"]] = domain

    domain_rubrics: dict[str, list[dict]] = {}
    for r in rubrics:
        domain = assessment_domain.get(r["assessment_ref"])
        if domain:
            domain_rubrics.setdefault(domain, []).extend(r["criteria"])
            continue
        ref_lower = r["assessment_ref"].lower()
        for d_name in {_extract_domain(a.get("competency_ref", "")) for a in assessments}:
            if d_name.lower() in ref_lower or ref_lower in d_name.lower():
                domain_rubrics.setdefault(d_name, []).extend(r["criteria"])
                break

    if rubrics and not domain_rubrics:
        all_criteria = [c for r in rubrics for c in r["criteria"]]
        for a in assessments:
            d = _extract_domain(a.get("competency_ref", ""))
            if d:
                domain_rubrics[d] = all_criteria

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

    pm = _pm(state)
    n_done = len(state.get("items_administered", []))
    n_total = n_done + len(state["items_remaining"]) + 1

    template = pm.get("question_format_template", "**Question {number} of {total}** — _{domain}_\n\n{stem}")
    question = template.format(
        number=n_done + 1,
        total=n_total,
        domain=state["current_domain"],
        stem=item["stem"],
    )

    is_mc = item.get("question_type") == "multiple_choice"
    choices = item.get("choices") or []

    learner_response = interrupt({
        "type": "multiple_choice" if is_mc else "question",
        "content": question,
        "domain": state["current_domain"],
        "choices": choices if is_mc else None,
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
    """LLM-as-judge evaluation of the learner's response (or deterministic for MC)."""
    item = state["current_item"]
    domain = state["current_domain"]

    learner_response = ""
    for msg in reversed(state.get("messages", [])):
        if msg["role"] == "learner":
            learner_response = msg["content"]
            break

    if item.get("question_type") == "multiple_choice" and item.get("correct_choice"):
        answer = learner_response.strip().upper()[:1]
        correct = item["correct_choice"].strip().upper()[:1]
        is_correct = answer == correct

        correct_text = ""
        for c in (item.get("choices") or []):
            if c.strip().upper().startswith(correct):
                correct_text = c
                break

        return {"current_evaluation": {
            "criterion_scores": [{"criterion": "correctness", "score": 3 if is_correct else 1, "justification": "Correct" if is_correct else f"Incorrect — the correct answer is {correct_text}"}],
            "weighted_score": 3.0 if is_correct else 1.0,
            "confidence": "clear",
            "feedback": f"Correct!" if is_correct else f"Incorrect. The correct answer is {correct_text}.",
            "probe_question": None,
        }}

    domain_rubrics = state.get("domain_rubrics", {})
    criteria = domain_rubrics.get(domain, [])
    rubric_text = _format_rubric_criteria(criteria) if criteria else "Use general assessment criteria for quality, depth, and accuracy."

    pm = _pm(state)
    base_prompt = pm.get("evaluator_system_prompt", get_default_memories()["evaluator_system_prompt"])

    structured_llm = llm.with_structured_output(EvaluationResult)
    result = structured_llm.invoke([
        SystemMessage(content=(
            f"{base_prompt}\n\n"
            f"## Item\n{item['stem']}\n\n"
            f"## Model Answer (reference — not the only correct approach)\n{item['model_answer']}\n\n"
            f"## Scoring Notes\n{item['scoring_notes']}\n\n"
            f"## Rubric Criteria\n{rubric_text}"
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

    pm = _pm(state)
    probe_prompt = pm.get("probe_evaluator_prompt", get_default_memories()["probe_evaluator_prompt"])

    structured_llm = llm.with_structured_output(EvaluationResult)
    result = structured_llm.invoke([
        SystemMessage(content=(
            f"{probe_prompt}\n\n"
            f"## Item\n{item['stem']}\n\n"
            f"## Model Answer (reference — not the only correct approach)\n{item['model_answer']}\n\n"
            f"## Scoring Notes\n{item['scoring_notes']}\n\n"
            f"## Rubric Criteria\n{rubric_text}\n\n"
            f"## Original Response\n{original_response}\n\n"
            f"## Follow-up Probe\n{probe_question}"
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

    pm = _pm(state)
    scale = pm.get("scoring_scale", get_default_memories()["scoring_scale"])
    expert_min = scale.get("expert", {}).get("min_score", 2.5)
    competent_min = scale.get("competent", {}).get("min_score", 1.7)
    level = "novice" if new_score < competent_min else ("competent" if new_score < expert_min else "expert")
    proficiency[domain] = {"score": round(new_score, 2), "items_count": new_count, "level": level}

    feedback_msg = evaluation.get("feedback", "")
    administered_entry = {
        "item": item,
        "domain": domain,
        "score": score,
        "feedback": feedback_msg,
        "source_url": item.get("source_url"),
        "probed": state.get("probed", False),
    }

    return {
        "domain_proficiency": proficiency,
        "items_administered": [administered_entry],
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

    pm = _pm(state)
    thresholds = pm.get("pass_thresholds", get_default_memories()["pass_thresholds"])
    overall_min = thresholds.get("overall_min", 2.0)
    domain_min = thresholds.get("domain_min", 2.0)
    weak_floor = thresholds.get("weak_domain_floor", 1.5)

    overall = sum(p["score"] for p in tested.values()) / len(tested)
    all_competent = all(p["score"] >= domain_min for p in tested.values())
    none_failing = all(p["score"] >= weak_floor for p in tested.values())
    passed = all_competent or (overall >= overall_min and none_failing)

    domain_breakdown = {d: {**p} for d, p in proficiency.items()}

    result_prompt = pm.get("result_analyst_prompt", get_default_memories()["result_analyst_prompt"])

    structured_llm = llm.with_structured_output(ExamResultSummary)
    result = structured_llm.invoke([
        SystemMessage(content=(
            f"{result_prompt}\n\n"
            f"## Domain Scores\n{json.dumps(domain_breakdown, indent=2)}\n\n"
            f"## Overall Score: {overall:.2f} / 3.00\n"
            f"## Passed: {passed}\n"
            f"## Pass Threshold: {overall_min} (competent) in all domains, or {overall_min} overall with no domain below {weak_floor}"
        )),
        HumanMessage(content="Generate the exam result summary."),
    ])

    result_dict = result.model_dump()
    result_dict["overall_score"] = round(overall, 2)
    result_dict["passed"] = passed
    result_dict["domain_breakdown"] = domain_breakdown

    question_review = []
    for entry in state.get("items_administered", []):
        item = entry.get("item", {})
        question_review.append({
            "stem": item.get("stem", ""),
            "question_type": item.get("question_type", "open_ended"),
            "correct_choice": item.get("correct_choice"),
            "domain": entry.get("domain", ""),
            "score": entry.get("score", 0),
            "feedback": entry.get("feedback", ""),
            "source_url": entry.get("source_url"),
            "model_answer": item.get("model_answer", ""),
        })
    result_dict["question_review"] = question_review

    farewell = pm.get("farewell_message", "")
    summary_text = f"## Exam Complete\n\n{result.summary}\n\n**Recommendation:** {result.recommendation}"
    if farewell:
        summary_text += f"\n\n{farewell}"

    return {
        "exam_complete": True,
        "passed": passed,
        "result_summary": result_dict,
        "messages": [{"role": "agent", "content": summary_text}],
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

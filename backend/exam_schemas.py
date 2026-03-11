"""Pydantic models and state definition for the Adaptive Exam LangGraph."""

from __future__ import annotations

import operator
from typing import Annotated, Optional, TypedDict

from pydantic import BaseModel, Field


# ── Structured LLM outputs ──

class CriterionScore(BaseModel):
    criterion: str = Field(description="Name of the criterion being evaluated")
    score: int = Field(ge=1, le=3, description="1 = novice, 2 = competent, 3 = expert")
    justification: str = Field(description="One-sentence explanation for this score")


class EvaluationResult(BaseModel):
    criterion_scores: list[CriterionScore] = Field(description="Score per rubric criterion")
    weighted_score: float = Field(description="Weighted average score 1.0-3.0")
    confidence: str = Field(description="'clear' if definitive, 'borderline' if follow-up would help")
    feedback: str = Field(description="2-3 sentence constructive feedback for the learner")
    probe_question: str | None = Field(
        default=None,
        description="Targeted follow-up question when confidence is borderline",
    )


class ExamResultSummary(BaseModel):
    passed: bool = Field(description="Whether the learner passed")
    overall_score: float = Field(description="Weighted average across all domains (1.0-3.0)")
    summary: str = Field(
        description="3-5 sentence narrative of strengths and areas for improvement"
    )
    recommendation: str = Field(description="Concrete next steps for the learner")


# ── Graph state ──

DIFFICULTY_LEVELS = ("easy", "medium", "hard")

DIFFICULTY_UP = {"easy": "medium", "medium": "hard", "hard": "hard"}
DIFFICULTY_DOWN = {"hard": "medium", "medium": "easy", "easy": "easy"}


class ExamState(TypedDict):
    program_id: str
    learner_id: str
    program_name: str

    item_bank: list[dict]
    rubrics: list[dict]
    framework: dict
    assessments: list[dict]

    items_remaining: list[dict]
    domain_rubrics: dict
    domain_difficulty_cursor: dict

    current_item: Optional[dict]
    current_domain: str
    current_evaluation: Optional[dict]
    probed: bool

    messages: Annotated[list[dict], operator.add]
    items_administered: Annotated[list[dict], operator.add]
    domain_proficiency: dict

    procedural_memory: Optional[dict]

    exam_complete: bool
    passed: Optional[bool]
    result_summary: Optional[dict]

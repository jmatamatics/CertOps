from pydantic import BaseModel, Field


class ProficiencyLevel(BaseModel):
    level: str = Field(description="novice, competent, or expert")
    descriptor: str = Field(
        description="2-3 sentence description of what performance looks like at this level"
    )
    behavioral_indicators: list[str] = Field(
        description="Observable actions that demonstrate this proficiency level",
        min_length=2,
    )


class Skill(BaseModel):
    name: str = Field(description="Name of the skill")
    description: str = Field(description="What this skill covers")
    proficiency_levels: list[ProficiencyLevel] = Field(
        description="Proficiency descriptors for novice, competent, and expert",
        min_length=3,
        max_length=3,
    )


class Domain(BaseModel):
    name: str = Field(description="Domain name")
    description: str = Field(description="What this domain covers")
    skills: list[Skill] = Field(description="Skills within this domain", min_length=2)


class CompetencyFramework(BaseModel):
    track: str = Field(description="Certification track name")
    description: str = Field(description="Overview of what this certification validates")
    domains: list[Domain] = Field(description="Competency domains", min_length=3)


class LearningObjective(BaseModel):
    order: int = Field(description="Sequence order (1-based)")
    title: str = Field(description="Learning objective title")
    description: str = Field(description="What the learner will be able to do")
    domain: str = Field(description="Which competency domain this maps to")
    prerequisites: list[str] = Field(default_factory=list)
    suggested_activities: list[str] = Field(
        description="2-3 hands-on activities for achieving this objective",
        min_length=1,
    )
    estimated_hours: float = Field(description="Estimated hours to achieve this objective")
    success_criteria: str = Field(
        description="How an evaluator determines the learner has achieved this objective"
    )


class LearningProgression(BaseModel):
    track: str = Field(description="Certification track name")
    objectives: list[LearningObjective] = Field(description="Ordered learning objectives")


class AssessmentTask(BaseModel):
    title: str = Field(description="Assessment task title")
    scenario: str = Field(description="Real-world scenario")
    instructions: str = Field(description="Detailed step-by-step instructions")
    expected_outputs: list[str] = Field(description="What the candidate should produce")
    competency_ref: str = Field(description="Which skill/domain this assesses")
    time_estimate_minutes: int = Field(description="Estimated time to complete")
    evaluator_guide: str = Field(
        description=(
            "Detailed guidance for the evaluator: what to look for, "
            "common pitfalls, and pass/fail boundaries"
        )
    )


class AssessmentList(BaseModel):
    tasks: list[AssessmentTask] = Field(description="List of assessment tasks")


class RubricCriterion(BaseModel):
    criterion: str = Field(description="What is being evaluated")
    weight: int = Field(description="Relative importance 1-5 for scoring")
    novice: str = Field(description="Novice-level descriptor (2-3 sentences)")
    competent: str = Field(description="Competent-level descriptor (2-3 sentences)")
    expert: str = Field(description="Expert-level descriptor (2-3 sentences)")


class Rubric(BaseModel):
    assessment_ref: str = Field(description="Title of the assessment task")
    criteria: list[RubricCriterion] = Field(description="Evaluation criteria", min_length=3)


class RubricList(BaseModel):
    rubrics: list[Rubric] = Field(description="List of rubrics")


class ItemBankEntry(BaseModel):
    stem: str = Field(description="The question or task prompt")
    task_type: str = Field(description="performance, scenario, or analysis")
    competency_ref: str = Field(description="Skill/domain this item assesses")
    expected_response_summary: str = Field(description="Brief summary of correct response")
    scoring_notes: str = Field(description="Notes for evaluators")
    model_answer: str = Field(
        description=(
            "Complete model answer (3-5 paragraphs) demonstrating "
            "an expert-level response to this item"
        )
    )


class ItemBank(BaseModel):
    items: list[ItemBankEntry] = Field(description="Item bank entries")


class CertificationBlueprint(BaseModel):
    program_title: str = Field(description="Full certification program title")
    target_audience: str = Field(description="Who this certification is for")
    prerequisites: str = Field(description="What candidates should know before starting")
    program_overview: str = Field(description="2-3 paragraph program overview")
    domain_summary: list[str] = Field(description="One sentence summary per domain")
    assessment_strategy: str = Field(
        description="How candidates are assessed — format, approach, and philosophy"
    )
    estimated_duration_hours: float = Field(
        description="Total estimated hours to complete the certification"
    )
    renewal_cadence: str = Field(
        description="Recommended recertification interval and rationale"
    )

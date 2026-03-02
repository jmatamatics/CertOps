export interface ProficiencyLevel {
  level: string;
  descriptor: string;
  behavioral_indicators: string[];
}

export interface Skill {
  name: string;
  description: string;
  proficiency_levels: ProficiencyLevel[];
}

export interface Domain {
  name: string;
  description: string;
  skills: Skill[];
}

export interface CompetencyFramework {
  track: string;
  description: string;
  domains: Domain[];
}

export interface LearningObjective {
  order: number;
  title: string;
  description: string;
  domain: string;
  prerequisites: string[];
  suggested_activities: string[];
  estimated_hours: number;
  success_criteria: string;
}

export interface LearningProgression {
  track: string;
  objectives: LearningObjective[];
}

export interface AssessmentTask {
  title: string;
  scenario: string;
  instructions: string;
  expected_outputs: string[];
  competency_ref: string;
  time_estimate_minutes: number;
  evaluator_guide: string;
}

export interface RubricCriterion {
  criterion: string;
  weight: number;
  novice: string;
  competent: string;
  expert: string;
}

export interface Rubric {
  assessment_ref: string;
  criteria: RubricCriterion[];
}

export interface ItemBankEntry {
  stem: string;
  task_type: string;
  competency_ref: string;
  expected_response_summary: string;
  scoring_notes: string;
  model_answer: string;
}

export interface CertificationBlueprint {
  program_title: string;
  target_audience: string;
  prerequisites: string;
  program_overview: string;
  domain_summary: string[];
  assessment_strategy: string;
  estimated_duration_hours: number;
  renewal_cadence: string;
}

export interface CertOpsOutput {
  competency_framework: CompetencyFramework;
  learning_progression: LearningProgression;
  assessments: AssessmentTask[];
  rubrics: Rubric[];
  item_bank: ItemBankEntry[];
  blueprint: CertificationBlueprint;
}

export type TrackKey = "ai_champion" | "user";

export interface TrackInfo {
  key: TrackKey;
  name: string;
  description: string;
}

export const TRACKS: TrackInfo[] = [
  {
    key: "ai_champion",
    name: "AI Champion",
    description:
      "For professionals building AI agents with Copilot Studio — covering agent creation, conversational design, integrations, and governance.",
  },
  {
    key: "user",
    name: "M365 Copilot User",
    description:
      "For everyday users leveraging Copilot across Word, Excel, PowerPoint, Teams, and Outlook — covering productivity, communication, and prompting.",
  },
];

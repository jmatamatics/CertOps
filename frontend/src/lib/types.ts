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
  question_type: "multiple_choice" | "open_ended";
  choices?: string[] | null;
  correct_choice?: string | null;
  competency_ref: string;
  expected_response_summary: string;
  scoring_notes: string;
  model_answer: string;
  source_url?: string | null;
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
  thread_id?: string;
  competency_framework: CompetencyFramework;
  learning_progression: LearningProgression;
  assessments: AssessmentTask[];
  rubrics: Rubric[];
  item_bank: ItemBankEntry[];
  blueprint: CertificationBlueprint;
}

export type ArtifactKey =
  | "competency_framework"
  | "learning_progression"
  | "assessments"
  | "rubrics"
  | "item_bank"
  | "blueprint";

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

export interface SavedProgramSummary {
  id: string;
  name: string;
  track_key: string;
  created_at: string;
  domain_count: number;
  skill_count: number;
}

export interface SavedProgram {
  id: string;
  name: string;
  track_key: string;
  artifacts: CertOpsOutput;
  created_at: string;
  updated_at: string;
}

// ── Adaptive Exam ──

export interface DomainProficiency {
  score: number;
  items_count: number;
  level: string;
}

export interface ExamProgress {
  items_completed: number;
  total_items: number;
  domain_proficiency: Record<string, DomainProficiency>;
}

export interface ExamMessage {
  role: "agent" | "learner";
  content: string;
}

export interface QuestionReview {
  stem: string;
  question_type: "multiple_choice" | "open_ended";
  correct_choice?: string | null;
  domain: string;
  difficulty?: "easy" | "medium" | "hard";
  score: number;
  feedback: string;
  source_url?: string | null;
  model_answer: string;
}

export interface ExamResult {
  passed: boolean;
  overall_score: number;
  domain_breakdown: Record<string, DomainProficiency>;
  summary: string;
  recommendation: string;
  question_review?: QuestionReview[];
}

export interface ExamSnapshot {
  thread_id: string;
  status: "awaiting_response" | "complete" | "processing";
  interrupt: { type: string; content: string; [key: string]: unknown } | null;
  messages: ExamMessage[];
  progress: ExamProgress;
  result: ExamResult | null;
}

// ── Procedural Memory / Agent Config ──

export interface PassThresholds {
  overall_min: number;
  domain_min: number;
  weak_domain_floor: number;
}

export interface ScoringTier {
  min_score: number;
  label: string;
}

export interface ScoringScale {
  expert: ScoringTier;
  competent: ScoringTier;
  novice: ScoringTier;
}

export interface AgentConfig {
  evaluator_system_prompt: string;
  probe_evaluator_prompt: string;
  result_analyst_prompt: string;
  question_format_template: string;
  welcome_message: string;
  farewell_message: string;
  pass_thresholds: PassThresholds;
  scoring_scale: ScoringScale;
}

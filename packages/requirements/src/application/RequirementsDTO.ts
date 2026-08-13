// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: DTOs
// EPIC-009 — the typed public contract for the requirements.* API.
// Internal engine details (ports, store internals) are never exposed.
// ──────────────────────────────────────────────────────────────────

import type {
  AmbiguityReport,
  AIStrategy,
  BuildPlan,
  ChangeImpact,
  ChangeImpactRecord,
  CostPlan,
  DesignSpecification,
  ExperienceStrategy,
  HandoffGoal,
  PlanReview,
  ProductArchitecture,
  ProductBrief,
  ProductIntent,
  QuestionPlan,
  RAGStrategy,
  RequirementConflict,
  RequirementGraph,
  RequirementPhase,
  RequirementSet,
  RequirementSession,
  RequirementVersion,
  SafeDefault,
  SecurityPlan,
  ToolStrategy,
  TraceabilityIndex,
  UserJourney,
} from '../types/requirement-types.js';

export interface RequirementsStartDTO {
  sessionId: string;
  phase: RequirementPhase;
  idea: string;
  /** Bundles of BLOCKING + IMPORTANT questions to ask (grouped). */
  questionBundles: QuestionPlan['bundles'];
  blockingCount: number;
  importantCount: number;
  defaultsCount: number;
  completenessReady: boolean;
  criticalUnknowns: string[];
}

export interface RequirementsSessionDTO {
  sessionId: string;
  owner: string;
  idea: string;
  phase: RequirementPhase;
  intent?: ProductIntent;
  requirements?: RequirementSet;
  graph?: RequirementGraph;
  ambiguity?: AmbiguityReport;
  questionPlan?: QuestionPlan;
  defaults?: SafeDefault[];
  completeness?: RequirementSession['completeness'];
  conflicts?: RequirementConflict[];
  brief?: ProductBrief;
  journeys?: UserJourney[];
  experience?: ExperienceStrategy;
  design?: DesignSpecification;
  architecture?: ProductArchitecture;
  aiStrategy?: AIStrategy;
  ragStrategy?: RAGStrategy;
  toolStrategy?: ToolStrategy;
  security?: SecurityPlan;
  cost?: CostPlan;
  buildPlan?: BuildPlan;
  review?: PlanReview;
  traceability?: TraceabilityIndex;
  changeImpacts: ChangeImpactRecord[];
  versions: RequirementVersion[];
  handoffGoal?: string;
  enrichment: RequirementSession['enrichment'];
  createdAt: string;
  updatedAt: string;
}

export interface RequirementsSessionSummaryDTO {
  sessionId: string;
  idea: string;
  phase: RequirementPhase;
  archetype?: ProductIntent['archetype'];
  confirmedRequirements: number;
  criticalUnknowns: number;
  completenessReady: boolean;
  updatedAt: string;
}

export interface RequirementsApproveDTO {
  sessionId: string;
  phase: RequirementPhase;
  approvedAt?: string;
  handoffGoal?: string;
}

export type RequirementsHandoffDTO = HandoffGoal;

export type { ChangeImpact, HandoffGoal, RequirementVersion };

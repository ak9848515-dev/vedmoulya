// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Proactive Intelligence · types
// SPRINT-029 — structured recommendations that COMPOSE the existing Brain
// pipeline (discoverIntelligence / listOpportunities / listTasks /
// dailyPriorities / outcome memory) and the existing capability marketplace
// (AutomationBoundaryEngine, ApprovalEngine, SENSITIVE_ACTIONS).
//
// This package is a COMPOSITION layer — NOT an engine. It owns no discovery
// authority, no provider selection, no approval, no execution, no memory and
// no learning: every authority lives in the frozen estate and is reached
// through narrow ports. Everything produced here is evidence-only (an
// estimate is never fabricated — UNKNOWN stays UNKNOWN).
// ─────────────────────────────────────────────────────────────────────────────

/** The ten recommendation categories the proactive layer can produce. */
export type RecommendationCategory =
  | 'OPPORTUNITY'
  | 'RISK'
  | 'TASK'
  | 'AUTOMATION'
  | 'REVENUE_OPPORTUNITY'
  | 'COST_SAVING'
  | 'TIME_SAVING'
  | 'LEARNING_OPPORTUNITY'
  | 'BUSINESS_OPPORTUNITY'
  | 'SYSTEM_IMPROVEMENT';

export type RecommendationStatus = 'NEW' | 'REVIEWED' | 'DISMISSED' | 'ACCEPTED';

export type Urgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';

/** Evidence status mirrors the platform rule: an estimate is only present when
 *  evidence supports it (the Brain's EvidenceStatus discipline). */
export type EvidenceStatus = 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN';

export interface EvidenceValue {
  label: string;
  status: EvidenceStatus;
}

/**
 * One structured proactive recommendation. Every field follows the platform's
 * honesty contract: `evidence` is required and never fabricated, `confidence`
 * is 0..1 (UNKNOWN stays 0), value/cost/effort are present only when evidence
 * exists, and `authorizationRequired` is true whenever the recommended action
 * touches a sensitive boundary (the existing approval authority decides).
 */
export interface ProactiveRecommendation {
  id: string;
  ownerId: string;
  category: RecommendationCategory;
  title: string;
  description: string;
  /** Evidence the recommendation is based on (never fabricated). */
  evidence: string[];
  /** 0..1 — higher = more confident. Never a promise. */
  confidence: number;
  /** Value estimate ONLY when evidence exists. */
  expectedValue?: EvidenceValue;
  urgency: Urgency;
  estimatedEffort?: EvidenceValue;
  estimatedCost?: EvidenceValue;
  /** Capabilities this needs — only when identifiable from existing catalogs. */
  requiredCapabilities?: string[];
  /** The recommended workflow (steps) — the action the user would approve. */
  recommendedWorkflow?: string[];
  /** True when acting requires the existing approval authority. */
  authorizationRequired: boolean;
  riskLevel: RiskLevel;
  /** When this recommendation stops being relevant (if known). */
  expiry?: string;
  status: RecommendationStatus;
  /** Where the underlying signal came from (traceability). */
  source:
    | 'brain-opportunity'
    | 'brain-task'
    | 'outcome-memory'
    | 'automation-discovery'
    | 'business-assessment'
    | 'system';
  /** When the recommendation was created. */
  createdAt: string;
}

/**
 * Action classes for automation (PHASE 5 — Authorization):
 *   A — Safe (summarization, classification, analysis, drafting): may run
 *       without per-run approval, still owner-scoped and rate-limited.
 *   B — User-authorized automation (approved recurring reports, approved
 *       workflows, approved data transformations): runs only when the user
 *       explicitly authorized that workflow.
 *   C — Approval required (external publishing, external messages, financial
 *       spending, account creation, business launch, config changes): the
 *       existing approval authority decides each time.
 *   D — Never automate (prohibited or unsafe actions): always refused.
 */
export type ActionClass = 'A' | 'B' | 'C' | 'D';

/** A discovered repetitive workflow (PHASE 2). */
export interface AutomationWorkflow {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  /** What starts the workflow. */
  trigger: string;
  /** What it consumes. */
  input: string;
  /** Capabilities required (from the existing capability catalog). */
  capabilities: string[];
  /** The transformation it performs. */
  transformation: string;
  /** The approval class — B or C only (A is not automation; D is refused). */
  actionClass: Exclude<ActionClass, 'A' | 'D'>;
  /** The action that would run. */
  action: string;
  /** How the result is verified (existing verification authority). */
  verification: string;
  /** What it produces. */
  output: string;
  /** Whether / how the result feeds memory (interaction artifacts only). */
  memory: string;
  /** Evidence this workflow recurs (task history / outcome memory). */
  evidence: string[];
  /** Occurrences observed. */
  occurrences: number;
  status: 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'ACTIVE';
  createdAt: string;
}

/** A business opportunity assessment (PHASE 7) — research + score only. */
export interface BusinessOpportunityAssessment {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  /** The business category (YouTube, consulting, SaaS, …). */
  category: string;
  /** Evidence-backed score 0..1 (never fabricated). */
  score: number;
  businessCase: string[];
  /** Cost/revenue ONLY when evidence exists. */
  estimatedCost?: EvidenceValue;
  estimatedRevenue?: EvidenceValue;
  riskLevel: RiskLevel;
  /** A minimal viable plan — execution requires user approval. */
  mvpPlan: string[];
  /** NEVER executed by this layer. */
  authorizationRequired: true;
  status: 'RESEARCHED' | 'APPROVED' | 'REJECTED';
  evidence: string[];
  createdAt: string;
}

/** The daily briefing (PHASE 6) — no spam: empty when nothing meaningful. */
export interface DailyBriefing {
  ownerId: string;
  date: string;
  priorities: string[];
  automationOpportunity?: string;
  revenueOpportunity?: string;
  risk?: string;
  aiWorldUpdate?: string;
  recommendedAction?: string;
  /** True when the briefing actually contains content (no-spam guard). */
  hasContent: boolean;
}

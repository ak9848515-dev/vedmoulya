// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/live-intelligence-bridge — Bridge Types
// EPIC-017 — the LIVE INTELLIGENCE BRIDGE
//
// Runs the full loop:
//   USER TASK → BRAIN UNDERSTAND → CAPABILITY DISCOVERY →
//   PROVIDER/MODEL INTELLIGENCE → ECOSYSTEM INTELLIGENCE →
//   SECURITY/LICENSE/AVAILABILITY → TASK-SPECIFIC QUALITY →
//   COMPARE CURRENT VS BETTER → RECOMMENDATION → USER APPROVAL →
//   CONFIGURATION/HAND-OFF → VALIDATION → ROUTING → EPIC-014
//   EXECUTION → VERIFY → EVALUATE → MEMORY/PREFERENCE FEEDBACK
//
// The bridge NEVER rebuilds engines — it orchestrates the existing
// Brain (EPIC-016), Intelligence (EPIC-015), Marketplace (EPIC-013),
// Execution (EPIC-014) and AI World (EPIC-012C) through narrow ports.
// Every decision carries provenance; UNKNOWN is first-class; nothing
// is fabricated; nothing is auto-activated.
// ──────────────────────────────────────────────────────────────────

// ── Loop state machine ────────────────────────────────────────────
export type BridgeStage =
  | 'UNDERSTAND'
  | 'DISCOVER'
  | 'COMPARE'
  | 'RECOMMEND'
  | 'APPROVAL'
  | 'CONFIGURE'
  | 'HANDOFF'
  | 'PLAN'
  | 'EXECUTE'
  | 'VERIFY'
  | 'EVALUATE'
  | 'FEEDBACK'
  | 'NOTIFY'
  | 'COMPLETED'
  | 'FAILED'
  | 'BLOCKED';

export const BRIDGE_STAGES: readonly BridgeStage[] = [
  'UNDERSTAND',
  'DISCOVER',
  'COMPARE',
  'RECOMMEND',
  'APPROVAL',
  'CONFIGURE',
  'HANDOFF',
  'PLAN',
  'EXECUTE',
  'VERIFY',
  'EVALUATE',
  'FEEDBACK',
  'NOTIFY',
  'COMPLETED',
  'FAILED',
  'BLOCKED',
] as const;

export type BridgeStageStatus =
  'pending' | 'running' | 'completed' | 'blocked' | 'failed' | 'skipped';

export type BridgeLoopStatus =
  | 'NEW'
  | 'UNDERSTANDING'
  | 'DISCOVERING'
  | 'COMPARING'
  | 'RECOMMENDING'
  | 'AWAITING_APPROVAL'
  | 'CONFIGURING'
  | 'HANDING_OFF'
  | 'PLANNING'
  | 'EXECUTING'
  | 'VERIFYING'
  | 'EVALUATING'
  | 'FEEDBACK'
  | 'NOTIFYING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'BLOCKED'
  | 'FAILED';

// ── Acquisition classification (Phase 4) ──────────────────────────
export type AcquisitionClass =
  | 'FREE_API'
  | 'FREE_WITH_QUOTA'
  | 'LOCAL_MODEL'
  | 'OPEN_SOURCE'
  | 'GITHUB_PROJECT'
  | 'PAID'
  | 'EXTERNAL_APPLICATION'
  | 'MANUAL'
  | 'UNKNOWN';

export const ACQUISITION_CLASSES: readonly AcquisitionClass[] = [
  'FREE_API',
  'FREE_WITH_QUOTA',
  'LOCAL_MODEL',
  'OPEN_SOURCE',
  'GITHUB_PROJECT',
  'PAID',
  'EXTERNAL_APPLICATION',
  'MANUAL',
  'UNKNOWN',
] as const;

// ── The structured candidate view model (brief § Phase 1) ─────────
export interface BridgeCandidate {
  /** Candidate identity (provider/model/discovery/local/manual). */
  candidate: string;
  capability: string;
  provider?: string;
  model?: string;
  integrationType: string;
  /** Evidence-backed quality signal (0..100 where evidenced). */
  quality?: number;
  qualityEvidence: string[];
  taskFit: string;
  securityStatus: string;
  availability: 'AVAILABLE' | 'CONFIGURE' | 'UNAVAILABLE' | 'UNKNOWN';
  costClass: AcquisitionClass;
  freeTierStatus: 'FREE' | 'FREE_WITH_QUOTA' | 'PAID' | 'UNKNOWN';
  localAvailability: 'yes' | 'no' | 'UNKNOWN';
  confidence: 'VERIFIED' | 'MEASURED' | 'PROVIDER_DECLARED' | 'INFERRED' | 'UNKNOWN';
  recommendation: 'CONSIDER' | 'RECOMMEND' | 'IGNORE';
  /** True when activating this candidate needs user consent. */
  approvalRequired: boolean;
  /** Provenance: where the facts came from. */
  source:
    | 'configured'
    | 'provider-intelligence'
    | 'ai-world'
    | 'local-model'
    | 'github'
    | 'external'
    | 'manual'
    | 'UNKNOWN';
}

// ── Compare current vs better (Phase 2) ───────────────────────────
export interface BridgeComparison {
  capability: string;
  current?: { name: string; quality?: number; provider?: string; model?: string };
  alternative?: BridgeCandidate;
  /** Structured reasons — never hidden chain-of-thought. */
  why: string[];
  betterOptionAvailable: boolean;
  requiresApproval: boolean;
  materialImprovement: boolean;
}

// ── Recommendation (Phase 4/6) ────────────────────────────────────
export type BridgeRecommendationKind =
  | 'BETTER_CAPABILITY_FOUND'
  | 'USEFUL_OPEN_SOURCE_FOUND'
  | 'FREE_LOCAL_MODEL_AVAILABLE'
  | 'HIGHER_QUALITY_OPTION';

export interface BridgeRecommendation {
  id: string;
  kind: BridgeRecommendationKind;
  title: string;
  capability: string;
  current?: { name: string; quality?: number };
  recommended: { name: string; quality?: number; costUsd?: number; why: string[] };
  acquisition: AcquisitionClass;
  security: string;
  requires: string[];
  /** Evidence-backed cost when known (UNKNOWN stays UNKNOWN). */
  cost?: { amountUsd?: number; cadence?: 'one_time' | 'monthly' | 'per_use' | 'UNKNOWN' };
  freeAlternative?: string;
  localAlternative?: string;
  approvalRequired: boolean;
  state: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'SUPPRESSED';
  createdAt: string;
}

// ── Approval (Phase 6) ────────────────────────────────────────────
export type BridgeApprovalAction =
  | 'purchase'
  | 'subscription'
  | 'deployment'
  | 'publishing'
  | 'sending'
  | 'sharing'
  | 'deletion'
  | 'write_access'
  | 'private_repo_access'
  | 'external_app_action'
  | 'configuration_consent';

export interface BridgeApproval {
  id: string;
  loopId: string;
  action: BridgeApprovalAction;
  reason: string;
  state: 'REQUIRED' | 'GRANTED' | 'REJECTED';
  decidedAt?: string;
}

// ── Execution hand-off (Phase 8) ──────────────────────────────────
export type BridgeHandoffKind = 'CONFIGURE' | 'MANUAL' | 'EXTERNAL' | 'EXECUTE' | 'UNAVAILABLE';

export interface BridgeExecutionHandoff {
  executionId?: string;
  planId: string;
  kind: BridgeHandoffKind;
  stepTitle: string;
  detail: string;
  deepLink?: string;
}

// ── Outcome evaluation (Phase 9) ──────────────────────────────────
export interface BridgeOutcomeEvaluation {
  taskCompleted: boolean;
  quality: 'EXCELLENT' | 'GOOD' | 'ADEQUATE' | 'POOR' | 'UNKNOWN';
  accuracy: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  validation: 'PASSED' | 'FAILED' | 'NOT_RUN' | 'UNKNOWN';
  failures: string[];
  providerPerformance: Array<{
    provider: string;
    role: string;
    succeeded: boolean;
    latencyMs: number;
    costUsd: number;
  }>;
  latencyMs: number;
  costUsd: number;
  reliability: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  userApproval: 'GRANTED' | 'REJECTED' | 'NOT_REQUIRED';
  chosenCapabilityPerformedBetter: boolean | 'UNKNOWN';
  evaluatedAt: string;
}

// ── Preference / performance feedback (Phase 10) ──────────────────
export interface BridgePerformanceFact {
  id: string;
  loopId: string;
  capability: string;
  providerId: string;
  modelId?: string;
  /** Task-specific quality class — NEVER a global ranking. */
  taskQuality: 'EXCELLENT' | 'GOOD' | 'ADEQUATE' | 'POOR' | 'UNKNOWN';
  privacyBenefit: 'yes' | 'no' | 'UNKNOWN';
  costBenefit: 'yes' | 'no' | 'UNKNOWN';
  /** Derived from evidence — reversible, time-aware. */
  derived: boolean;
  recordedAt: string;
  evidence: string[];
}

// ── AI World notification (Phase 11) ──────────────────────────────
export type BridgeNotificationKind =
  | 'NEW_MODEL'
  | 'BETTER_MODEL'
  | 'FREE_QUOTA_AVAILABLE'
  | 'FREE_QUOTA_CHANGED'
  | 'PROVIDER_DEGRADED'
  | 'NEW_GITHUB_PROJECT'
  | 'GITHUB_PROJECT_ABANDONED'
  | 'SECURITY_CHANGE'
  | 'NEW_LOCAL_MODEL'
  | 'BETTER_CAPABILITY'
  | 'PRICE_CHANGE'
  | 'MODEL_DEPRECATED';

export interface BridgeNotificationEvent {
  id: string;
  loopId: string;
  kind: BridgeNotificationKind;
  title: string;
  body: string;
  /** 0..100 material-relevance score (gate decides whether it surfaces). */
  relevance: number;
  createdAt: string;
}

// ── The loop run record (owner-scoped) ────────────────────────────
export interface BridgeLoopRun {
  loopId: string;
  userId: string;
  objective: string;
  status: BridgeLoopStatus;
  stage: BridgeStage;
  stageStatuses: Record<BridgeStage, BridgeStageStatus>;
  intent?: {
    domain: string;
    qualityTarget: string;
    privacyRequirement: string;
    authorizedActions: string[];
  };
  capabilities: string[];
  candidates: BridgeCandidate[];
  comparisons: BridgeComparison[];
  recommendations: BridgeRecommendation[];
  approvals: BridgeApproval[];
  executionHandoff?: BridgeExecutionHandoff;
  outcome?: BridgeOutcomeEvaluation;
  performance: BridgePerformanceFact[];
  notifications: BridgeNotificationEvent[];
  failureReason?: string;
  traceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface BridgeLoopConfig {
  /** Hard cap on candidates kept per capability (bounded view). */
  maxCandidatesPerCapability: number;
  /** Hard cap on stored loops per owner (FIFO eviction). */
  maxLoopsPerOwner: number;
}

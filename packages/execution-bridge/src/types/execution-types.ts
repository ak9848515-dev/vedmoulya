// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Bridge: Domain Types
// EPIC-014 — Capability Execution Engine (PLAN → EXECUTE → VERIFY)
//
// The bridge turns an EPIC-013 FactoryCapabilityPlan into a bounded,
// owner-scoped execution run. It reuses (never rebuilds) the plan's
// candidate selection, the LoopEngine budget model and the runtime's
// validation — this file defines ONLY the execution artifacts that do
// not exist yet: the run, step runs, checkpoints, hand-offs, output
// verification and the preference-feedback ledger event.
// ──────────────────────────────────────────────────────────────────

// ── Per-step disposition (Phase 1 — Plan → Run bridge) ─────────────
// Decided ONLY from the plan's evidence + classification. Never
// inferred from the mere existence of a tool/repository.
export type StepDisposition =
  | 'EXECUTABLE' // READY + automatable → may enter execution
  | 'CONFIGURE' // provider known but not configured → hand-off + deep-link
  | 'WAITING_FOR_APPROVAL' // irreversible action → approval gate before execute
  | 'MANUAL_REQUIRED' // external application / manual step → hand-off
  | 'UNAVAILABLE'; // no candidate / no execution path → skipped honestly

export const STEP_DISPOSITIONS: readonly StepDisposition[] = [
  'EXECUTABLE',
  'CONFIGURE',
  'WAITING_FOR_APPROVAL',
  'MANUAL_REQUIRED',
  'UNAVAILABLE',
] as const;

// ── Run states (bounded, explicit — no duplication of the EI-005
//    session states; this is the execution-run vocabulary) ──────────
export type ExecutionState =
  | 'PLANNED'
  | 'READY'
  | 'RUNNING'
  | 'WAITING_FOR_APPROVAL'
  | 'WAITING_FOR_INPUT'
  | 'CONFIGURE_REQUIRED'
  | 'MANUAL_REQUIRED'
  | 'RETRYING'
  | 'PARTIAL'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'BLOCKED';

export const EXECUTION_STATES: readonly ExecutionState[] = [
  'PLANNED',
  'READY',
  'RUNNING',
  'WAITING_FOR_APPROVAL',
  'WAITING_FOR_INPUT',
  'CONFIGURE_REQUIRED',
  'MANUAL_REQUIRED',
  'RETRYING',
  'PARTIAL',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'BLOCKED',
] as const;

// ── Per-step run states ─────────────────────────────────────────────
export type StepRunState =
  | 'pending'
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'skipped'
  | 'waiting_approval'
  | 'waiting_input'
  | 'configure_required'
  | 'manual_required';

export const STEP_RUN_STATES: readonly StepRunState[] = [
  'pending',
  'ready',
  'running',
  'completed',
  'failed',
  'blocked',
  'skipped',
  'waiting_approval',
  'waiting_input',
  'configure_required',
  'manual_required',
] as const;

// ── Checkpoint (persisted after every completed step) ──────────────
export interface ExecutionCheckpoint {
  checkpointId: string;
  executionId: string;
  /** Step ids completed up to this point (resume continues after them). */
  completedStepIds: string[];
  createdAt: string;
}

// ── Artifact (outputs are first-class) ──────────────────────────────
export interface ExecutionArtifact {
  artifactId: string;
  executionId: string;
  stepId: string;
  type: string; // 'text' | 'document' | 'code' | 'report' …
  name: string;
  /** For text-capability steps this is the produced content. */
  content: string;
  validated: boolean;
  validation?: { passed: boolean; checks: string[] };
  createdAt: string;
}

// ── Hand-off (Phase 3 — honest WHAT/WHY/ACTION/AFTER) ───────────────
export type HandoffKind = 'CONFIGURE' | 'MANUAL' | 'EXTERNAL' | 'UNAVAILABLE';

export interface ExecutionHandoff {
  stepId: string;
  kind: HandoffKind;
  /** What is blocked (never claims automated execution). */
  what: string;
  why: string;
  /** What the user needs to do. */
  action: string;
  /** What happens afterward. */
  after: string;
  /** Deep-link into EXISTING configuration (never a new screen). */
  deepLink?: string;
  completed: boolean;
  completedAt?: string;
}

// ── Verification (Phase 2 — success = EXECUTION + OUTPUT + VALIDATION) ─
export interface VerificationCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface StepVerification {
  stepId: string;
  pre: { passed: boolean; checks: VerificationCheck[] };
  post?: { passed: boolean; checks: VerificationCheck[] };
}

// ── Step run ────────────────────────────────────────────────────────
export interface StepRun {
  stepId: string;
  title: string;
  capability: string; // EPIC-013 CapabilityId
  disposition: StepDisposition;
  state: StepRunState;
  provider?: string;
  model?: string;
  output?: string;
  verification?: StepVerification;
  artifacts: ExecutionArtifact[];
  attempts: number;
  retried: boolean;
  costUsd: number;
  tokensUsed: number;
  latencyMs: number;
  failureReason?: string;
  startedAt?: string;
  endedAt?: string;
  updatedAt: string;
}

// ── Preference feedback event (Phase 5 — provenance preserved) ──────
export type PreferenceEventSource =
  | 'explicit_user_selection' // user chose a provider/model
  | 'explicit_user_approval' // user approved an irreversible/paid step
  | 'explicit_user_rejection' // user rejected an approval
  // SPRINT-025 — additive: the user corrected the system explicitly
  // ("don't use this approach again" / "that result was wrong"). Same
  // explicit authority as the other explicit sources — never inferred.
  | 'explicit_user_correction'
  | 'inferred_observation'; // observed behavior — NEVER auto-promoted

export interface ExecutionPreferenceEvent {
  eventId: string;
  executionId: string;
  stepId?: string;
  source: PreferenceEventSource;
  /** The fact, e.g. "User preferred GPT-5 for coding." */
  fact: string;
  provider?: string;
  model?: string;
  capability?: string;
  reason?: string;
  /** 0..1 — how certain the ledger is of this fact. */
  confidence: number;
  timestamp: string;
}

// ── Budget state (fail-closed, never silently exceeded) ─────────────
export interface ExecutionBudget {
  maxIterations: number;
  maxTokens: number;
  maxCostUsd: number;
  maxLatencyMs: number;
  spentTokens: number;
  spentCostUsd: number;
  spentLatencyMs: number;
  iterations: number;
  exceeded: boolean;
  failureReason?: string;
}

// ── Run intelligence (Phase 4 — derived view, no new planning engine) ─
export interface RunIntelligence {
  currentStepId?: string;
  completedSteps: string[];
  failedSteps: string[];
  blockedSteps: string[];
  waitingSteps: string[];
  remainingSteps: string[];
  /** Where the automation boundary sits. */
  executionBoundary:
    | 'all_automated'
    | 'approval_required'
    | 'manual_required'
    | 'configure_required'
    | 'unavailable_steps'
    | 'blocked';
  /** Provider/model actually used per step. */
  providerModelUsed: Array<{ stepId: string; provider: string; model: string }>;
  qualityResults: Array<{ stepId: string; passed: boolean; checks: string[] }>;
  totalCostUsd: number;
  totalLatencyMs: number;
  failureReasons: string[];
  /** Human-readable next action ("Approve 'Publish'", "Complete video assembly…"). */
  nextAction?: string;
}

// ── The execution run ───────────────────────────────────────────────
export interface ExecutionRun {
  executionId: string;
  planId: string;
  ownerId: string;
  traceId: string;
  goal: string;
  status: ExecutionState;
  steps: StepRun[];
  checkpoints: ExecutionCheckpoint[];
  handoffs: ExecutionHandoff[];
  budget: ExecutionBudget;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
}

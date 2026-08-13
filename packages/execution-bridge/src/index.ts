// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/execution-bridge
// EPIC-014 — Capability Execution Engine (PLAN → EXECUTE → VERIFY)
//
// Turns an EPIC-013 FactoryCapabilityPlan into a bounded, owner-scoped
// execution run: resolve dispositions (only EXECUTABLE runs), verify
// every step (EXECUTION + OUTPUT + VALIDATION), gate irreversible
// actions behind approval, hand off manual/configure/unavailable steps
// honestly, persist checkpoints, and record provenance-preserving
// preference facts. Reuses the frozen LoopBudget for hard limits and
// the frozen runtime port for provider execution — no new engines.
// ──────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────
export type {
  StepDisposition,
  ExecutionState,
  StepRunState,
  ExecutionCheckpoint,
  ExecutionArtifact,
  ExecutionHandoff,
  HandoffKind,
  VerificationCheck,
  StepVerification,
  StepRun,
  PreferenceEventSource,
  ExecutionPreferenceEvent,
  ExecutionBudget,
  RunIntelligence,
  ExecutionRun,
} from './types/execution-types.js';
export { STEP_DISPOSITIONS, EXECUTION_STATES, STEP_RUN_STATES } from './types/execution-types.js';

// ── SPRINT-024 — Real artifact verification types ─────────────────
export type {
  ArtifactCheckType,
  CalculationKind,
  CalculationExpectation,
  ArtifactExpectation,
  ArtifactCheckStatus,
  ArtifactCheckResult,
  ArtifactVerificationResult,
} from './types/artifact-types.js';

// ── Contracts ─────────────────────────────────────────────────────
export type {
  ClockPort,
  StepExecutionInput,
  StepExecutionResult,
  StepExecutionPort,
  PreferenceLedgerPort,
  ExecutionRunStore,
  ExecutionBudgetConfig,
} from './contracts/execution-ports.js';
export type {
  ArtifactReadResult,
  ArtifactExistence,
  ArtifactReaderPort,
} from './contracts/artifact-ports.js';

// ── Domain ────────────────────────────────────────────────────────
export { mapCapability, isMapped } from './domain/CapabilityMapper.js';
export type { RuntimeCapability } from './domain/CapabilityMapper.js';
export { PlanRunResolver } from './domain/PlanRunResolver.js';
export type { StepResolution } from './domain/PlanRunResolver.js';
export { StepVerifier } from './domain/StepVerifier.js';
export type { PreVerifyInput } from './domain/StepVerifier.js';
export { ArtifactVerifier } from './domain/ArtifactVerifier.js';
export { ApprovalRuntime } from './domain/ApprovalRuntime.js';
export type { ApprovalDecisionRecord } from './domain/ApprovalRuntime.js';
export { RunIntelligenceView } from './domain/RunIntelligence.js';
export { PreferenceLedger } from './domain/PreferenceLedger.js';
export type { PreferenceFactInput } from './domain/PreferenceLedger.js';
export { RunBudgetGuard } from './domain/RunBudgetGuard.js';

// ── Application ───────────────────────────────────────────────────
export { ExecutionRunService } from './application/ExecutionRunService.js';
export type {
  PlanSource,
  ExecutionRunServiceOptions,
  ServiceResult,
} from './application/ExecutionRunService.js';

// ── Infrastructure ────────────────────────────────────────────────
export { InMemoryExecutionRunStore } from './infrastructure/InMemoryExecutionRunStore.js';
export type { InMemoryExecutionRunStoreOptions } from './infrastructure/InMemoryExecutionRunStore.js';
export { InMemoryPreferenceLedger } from './infrastructure/InMemoryPreferenceLedger.js';
export { NodeArtifactReader } from './infrastructure/NodeArtifactReader.js';

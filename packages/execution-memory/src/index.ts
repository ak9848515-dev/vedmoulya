// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/execution-memory
// Execution Memory + Learning Intelligence
//
//   EXECUTION → VERIFIED OUTCOME → LEARNING SIGNAL → MEMORY CANDIDATE →
//   VALIDATION → PERSISTENCE → RETRIEVAL → FUTURE PLAN / DECISION
//
// Memory is ADVISORY. Current runtime truth is authoritative. Nothing
// here grants authority, bypasses ToolRuntime/AIOrchestrationService/
// governance/verification/budgets, or modifies executable system
// behavior. Persistence reuses the EXISTING enterprise memory platform
// (@vedmoulya/memory-intelligence) through a narrow store adapter —
// no second database, no duplicate persistence architecture.
// ──────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────
export type {
  LearningSignalKind,
  ExecutionRecord,
  ExecutionSource,
  MemoryCategory,
  MemoryScope,
  ExecutionMemoryConfidenceLevel,
  ExecutionMemoryConfidence,
  LearningSignal,
  MemoryCandidate,
  MemoryEntry,
  MemoryQuery,
  MemoryEvidence,
  MemoryEvidenceBlock,
  RejectedCandidate,
  IngestResult,
  RuntimeTruth,
  ConflictResolution,
} from './types/execution-memory-types.js';
export {
  LEARNING_SIGNALS,
  MEMORY_CATEGORIES,
  MEMORY_SCOPES,
} from './types/execution-memory-types.js';

// ── Ports ────────────────────────────────────────────────────────
export type {
  ExecutionMemoryStore,
  MemoryStoreSearch,
  ExecutionMemoryObserver,
} from './contracts/execution-memory-ports.js';

// ── Domain ───────────────────────────────────────────────────────
export {
  extractExecutionRecords,
  MAX_GOAL_TEXT_LENGTH,
  MAX_ERROR_LENGTH,
} from './domain/execution-record.js';
export {
  extractLearningSignals,
  isLearningSignalKind,
  DEFAULT_TOOL_TIMEOUT_MS,
} from './domain/learning-signals.js';
export type { LearningSignalOptions } from './domain/learning-signals.js';
export { buildMemoryCandidates, planSignature } from './domain/memory-candidates.js';
export {
  validateMemoryCandidate,
  validateCandidates,
  MAX_SUBJECT_LENGTH,
  MAX_PREDICATE_LENGTH,
  isKnownCapability,
} from './domain/memory-validation.js';
export type { CandidateValidationContext, ValidatedCandidate } from './domain/memory-validation.js';
export {
  computeConfidence,
  decayRecency,
  expiryFor,
  fingerprintFor,
  mergeCandidate,
  applyPassiveDecay,
  DAY_MS,
  DEFAULT_HALF_LIFE_DAYS,
} from './domain/memory-confidence.js';
export type { ConfidenceInput, MergeResult } from './domain/memory-confidence.js';
export { resolveMemoryConflicts } from './domain/memory-conflicts.js';
export {
  rankEvidence,
  toEvidence,
  buildEvidenceBlock,
  MAX_RETRIEVED,
  MAX_EVIDENCE_BLOCK_CHARS,
  MAX_EVIDENCE_LINES,
  MIN_RETRIEVAL_SCORE,
} from './domain/memory-retrieval.js';

// ── Application ──────────────────────────────────────────────────
export { ExecutionMemoryService } from './application/ExecutionMemoryService.js';
export type {
  ExecutionMemoryServiceOptions,
  UserPreferenceInput,
} from './application/ExecutionMemoryService.js';

// ── Infrastructure ───────────────────────────────────────────────
export { InMemoryExecutionMemoryStore } from './infrastructure/InMemoryExecutionMemoryStore.js';
export {
  MemoryIntelligenceStoreAdapter,
  toMemoryItem,
  fromMemoryItem,
} from './infrastructure/MemoryIntelligenceStoreAdapter.js';
export {
  PlanningMemoryAdapter,
  AdaptiveMemoryAdapter,
  RoutingMemoryAdapter,
} from './infrastructure/integration-adapters.js';

// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Memory + Learning Intelligence: Domain Types
//
//   EXECUTION → VERIFIED OUTCOME → LEARNING SIGNAL → MEMORY CANDIDATE →
//   VALIDATED MEMORY → PERSISTENCE → RETRIEVAL → FUTURE PLAN/DECISION
//
// Memory is ADVISORY. Current runtime truth is authoritative. This
// package never lets memory override capability availability, tool
// availability, permissions, governance, budgets, health/evidence,
// verification, routing or security boundaries.
//
// Concepts are deliberately distinct (never collapsed):
//   - an ExecutionRecord is HISTORICAL EVIDENCE (sanitized),
//   - a LearningSignal is a deterministic interpretation of VERIFIED
//     evidence,
//   - a MemoryCandidate is a proposed reusable fact,
//   - a MemoryEntry is the VALIDATED, PERSISTED, aggregated fact with
//     provenance, confidence, scope and decay metadata.
//
// The package REUSES (never redefines): the frozen AgentExecutionRun /
// AgentExecutionTraceRecord / GoalOutcome / VerificationVerdict types,
// the frozen sanitizeTraceText sanitizer, the frozen CapabilityType
// taxonomy, and the existing enterprise memory persistence
// (@vedmoulya/memory-intelligence) through a narrow store adapter.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type {
  AgentActionKind,
  AgentExecutionRun,
  AgentExecutionTraceRecord,
  GoalOutcome,
  RecoveryStrategyType,
  VerificationVerdict,
} from '@vedmoulya/agent-execution';

// ── Learning signals (closed set — deterministic extraction) ──────

export const LEARNING_SIGNALS = [
  'GOAL_ACHIEVED',
  'GOAL_BLOCKED',
  'GOAL_FAILED',
  'SUCCESSFUL_PLAN',
  'FAILED_PLAN',
  'PARTIAL_PLAN',
  'TOOL_SUCCESS',
  'TOOL_FAILURE',
  'TOOL_TIMEOUT',
  'TOOL_PERMISSION_DENIED',
  'VERIFICATION_SUCCESS',
  'VERIFICATION_FAILURE',
  'RECOVERY_SUCCESS',
  'RECOVERY_FAILURE',
  'MODEL_SUCCESS',
  'MODEL_FAILURE',
  'MODEL_FALLBACK_SUCCESS',
  'REPLAN_SUCCESS',
  'REPLAN_FAILURE',
  'LOOP_DETECTED',
] as const;

export type LearningSignalKind = (typeof LEARNING_SIGNALS)[number];

// ── Execution record (sanitized historical evidence) ──────────────

export interface ExecutionRecord {
  executionId: string;
  runId: string;
  userId?: string;
  goalId: string;
  planId: string;
  /** Present on action-level records; absent on the run-level record. */
  stepId?: string;
  actionId?: string;
  capability?: CapabilityType;
  requiredCapabilities?: CapabilityType[];
  tool?: string;
  provider?: string;
  model?: string;
  actionKind?: AgentActionKind;
  /** Action-level outcome (succeeded/failed/denied/blocked). */
  actionStatus?: 'succeeded' | 'failed' | 'denied' | 'blocked';
  /** VERIFIED ONLY when frozen verification evidence said so. */
  verificationVerdict?: VerificationVerdict;
  recoveryStrategy?: RecoveryStrategyType;
  fallbackUsed: boolean;
  attempts: number;
  revisions: number;
  replanCount: number;
  tokensUsed: number;
  costUsd: number;
  latencyMs: number;
  /** Run-level final outcome (the ONLY source of GOAL_* signals). */
  finalOutcome?: GoalOutcome;
  /** How many of this record's evidence items were VERIFIED (run-level). */
  verifiedEvidenceCount: number;
  /** Sanitized, bounded termination/error detail (never secrets). */
  error?: string;
  /** Sanitized, bounded goal text. */
  goalText: string;
  observedAt: string;
}

/** Input the caller supplies from the frozen foundations. */
export interface ExecutionSource {
  run: AgentExecutionRun;
  /** Sanitized trace from the frozen foundation (getTrace). */
  traces?: AgentExecutionTraceRecord[];
  /** Bounded replan count if the calling layer tracks it (default 0). */
  replanCount?: number;
}

// ── Memory categories (closed set — no model-defined categories) ──

export const MEMORY_CATEGORIES = [
  'EXECUTION_PATTERN',
  'TOOL_RELIABILITY',
  'PLAN_PATTERN',
  'RECOVERY_PATTERN',
  'VERIFICATION_PATTERN',
  'ROUTING_SIGNAL',
  'USER_PREFERENCE',
  'TASK_PATTERN',
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

// ── Memory scopes (explicit; never silently widened) ──────────────

export const MEMORY_SCOPES = [
  'USER',
  'GOAL_TYPE',
  'CAPABILITY',
  'TOOL',
  'PROVIDER',
  'MODEL',
  'PLAN_PATTERN',
  'GLOBAL',
] as const;

export type MemoryScope = (typeof MEMORY_SCOPES)[number];

// ── Confidence (evidence-based — the model NEVER chooses it) ──────

export type ExecutionMemoryConfidenceLevel = 'INSUFFICIENT' | 'LOW' | 'MEDIUM' | 'HIGH';

export interface ExecutionMemoryConfidence {
  score: number;
  level: ExecutionMemoryConfidenceLevel;
  /** Deterministic factors explaining the score. */
  factors: string[];
}

// ── Learning signal (one deterministic interpretation) ────────────

export interface LearningSignal {
  signalId: string;
  kind: LearningSignalKind;
  executionIds: string[];
  /** Bounded, sanitized evidence summary. */
  detail: string;
  observedAt: string;
}

// ── Memory candidate (proposed, NOT yet persisted) ────────────────

export interface MemoryCandidate {
  candidateId: string;
  category: MemoryCategory;
  scope: MemoryScope;
  subject: string;
  predicate: string;
  value: number;
  sampleCount: number;
  successCount: number;
  failureCount: number;
  verifiedCount: number;
  capability?: CapabilityType;
  userId?: string;
  executionIds: string[];
  /** Provenance: which signal(s) produced this candidate. */
  signalKinds: LearningSignalKind[];
  createdAt: string;
}

// ── Memory entry (validated + persisted + aggregated) ─────────────

export interface MemoryEntry {
  entryId: string;
  /** Aggregation key: category|scope|subject|predicate|capability|userId. */
  fingerprint: string;
  category: MemoryCategory;
  scope: MemoryScope;
  subject: string;
  predicate: string;
  /** Aggregated rate in [0, 1] (successRate for reliability entries). */
  value: number;
  capability?: CapabilityType;
  /** Present ONLY when scope === 'USER'. */
  userId?: string;
  sampleCount: number;
  successCount: number;
  failureCount: number;
  verifiedCount: number;
  /** Structured evidence — never natural-language unsupported facts. */
  evidence: {
    executionIds: string[];
    evidenceCount: number;
  };
  confidence: ExecutionMemoryConfidence;
  /** Recency in [0, 1] — decays with age unless reinforced. */
  recency: number;
  provenance: {
    executionIds: string[];
    sourceType: 'execution' | 'user' | 'aggregation';
    lastExecutionId?: string;
  };
  /** Optional TTL (days). Historical evidence is never silently deleted. */
  retentionDays?: number;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

// ── Retrieval ─────────────────────────────────────────────────────

export interface MemoryQuery {
  userId?: string;
  goalType?: string;
  capabilities?: CapabilityType[];
  tools?: string[];
  provider?: string;
  model?: string;
  planPattern?: string;
  categories?: MemoryCategory[];
  /** Bounded retrieval (default MAX_RETRIEVED = 8). */
  limit?: number;
}

/** Compact, bounded, ranked retrieval shape (never the raw entry). */
export interface MemoryEvidence {
  entryId: string;
  category: MemoryCategory;
  scope: MemoryScope;
  subject: string;
  predicate: string;
  value: number;
  capability?: CapabilityType;
  confidenceScore: number;
  confidenceLevel: ExecutionMemoryConfidenceLevel;
  recency: number;
  sampleCount: number;
  successCount: number;
  failureCount: number;
  verifiedCount: number;
  /** Deterministic ranking score (scope × relevance × confidence × recency × strength). */
  score: number;
  /** Advisory only — never authority. */
  advisory: true;
}

/** Bounded text block for model context (never unlimited memory). */
export interface MemoryEvidenceBlock {
  evidence: MemoryEvidence[];
  /** Sanitized, length-capped block (default MAX_EVIDENCE_BLOCK_CHARS). */
  text: string;
  charCount: number;
}

// ── Ingest observability ──────────────────────────────────────────

export interface RejectedCandidate {
  candidateId: string;
  category: MemoryCategory;
  reasons: string[];
}

export interface IngestResult {
  runId: string;
  records: number;
  signals: LearningSignal[];
  accepted: MemoryEntry[];
  rejected: RejectedCandidate[];
}

// ── Runtime truth (memory must NEVER override it) ─────────────────

export interface RuntimeTruth {
  /** Tools currently available (from the authoritative registry). */
  availableTools?: string[];
  /** Providers currently degraded (from current health). */
  degradedProviders?: string[];
  /** Explicit current request overrides (e.g. { outputFormat: 'docx' }). */
  explicitOverrides?: Record<string, string>;
  /** Capabilities currently available. */
  availableCapabilities?: CapabilityType[];
}

export interface ConflictResolution {
  entryId: string;
  reason: string;
}

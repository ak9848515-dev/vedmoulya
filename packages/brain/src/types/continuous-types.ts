// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/brain — Continuous Intelligence types
// EPIC-020 — Continuous Intelligence & Adaptive Orchestration
//
// The Brain becomes a continuously improving operating intelligence:
//   UNDERSTAND → DISCOVER → COMPARE → SELECT → ASK APPROVAL →
//   CONFIGURE → EXECUTE → VERIFY → EVALUATE → LEARN → MONITOR →
//   RE-OPTIMIZE.
//
// Honesty rules (mission §3/§4/§10/§12):
//   - Provider limits are KNOWN / UNKNOWN / ESTIMATED — NEVER fabricated.
//   - Adaptive scores are evidence-backed and recency-weighted; recent
//     evidence matters, inference is never promoted silently.
//   - Opportunities carry uncertainty and never promise income.
//   - Memory stores decisions, provenance and concise reasons only —
//     never hidden chain-of-thought.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityId } from '@vedmoulya/capability-marketplace';

// ── Evidence status vocabulary (mission §3) ────────────────────────
export type EvidenceStatus = 'KNOWN' | 'UNKNOWN' | 'ESTIMATED';

export interface UsageDatum<T> {
  value: T;
  status: EvidenceStatus;
}

/** A provider's usage/limits evidence — supplied by adapters, never invented. */
export interface ProviderUsageFact {
  providerId: string;
  modelId?: string;
  capability?: CapabilityId;
  /** Context window in tokens. */
  contextWindow?: UsageDatum<number>;
  inputTokenUsage?: UsageDatum<number>;
  outputTokenUsage?: UsageDatum<number>;
  /** Remaining quota when the provider exposes it (0 = exhausted). */
  remainingQuota?: UsageDatum<number>;
  rateLimit?: UsageDatum<{ limit: number; period: 'minute' | 'hour' | 'day' }>;
  /** Estimated cost per request (USD) — ESTIMATED is allowed only with evidence. */
  estimatedCostUsd?: UsageDatum<number>;
  freeTierStatus?: UsageDatum<'free' | 'free_with_quota' | 'paid' | 'local' | 'unknown'>;
  dailyUsage?: UsageDatum<number>;
  monthlyUsage?: UsageDatum<number>;
  /** Availability 0..1. */
  availability?: UsageDatum<number>;
  latencyMs?: UsageDatum<number>;
  /** Failure rate 0..1. */
  failureRate?: UsageDatum<number>;
  capturedAt: string;
}

export interface UsageEvidenceSummary {
  providerId: string;
  knownFields: string[];
  unknownFields: string[];
  estimatedFields: string[];
  /** Derived only when remainingQuota is KNOWN and <= 0. */
  quotaExhausted: boolean;
  /** KNOWN/ESTIMATED cost when evidence exists. */
  costEstimateUsd?: number;
}

// ── Failure classification (mission §5) ────────────────────────────
export type FailureClass =
  | 'QUOTA_EXHAUSTED'
  | 'PROVIDER_UNAVAILABLE'
  | 'MODEL_DEGRADED'
  | 'SUBSCRIPTION_UNAVAILABLE'
  | 'UNKNOWN_FAILURE';

export interface FailoverEvent {
  capability: CapabilityId;
  failedProviderId: string;
  failureClass: FailureClass;
  fallbackProviderId: string;
  reason: string;
  /** 1-based attempt count within this capability. */
  attempts: number;
  timestamp: string;
}

// ── Adaptive provider performance evidence (mission §4) ────────────
export interface ProviderPerformanceScore {
  providerId: string;
  capability: CapabilityId;
  /** Recency-weighted quality 0..1 (recent evidence matters). */
  qualityScore: number;
  sampleCount: number;
  /** EXPLICIT user feedback outranks INFERRED observation, never silently. */
  source: 'EXPLICIT' | 'INFERRED';
  updatedAt: string;
}

// ── Opportunity intelligence (mission §12) ─────────────────────────
export type OpportunityCategory =
  'earning' | 'freelance' | 'automation' | 'career' | 'business' | 'productivity' | 'cost_saving';

export interface Opportunity {
  id: string;
  userId: string;
  category: OpportunityCategory;
  title: string;
  description: string;
  evidence: string[];
  /** 0..1 — higher = less certain. Never a promise. */
  uncertainty: number;
  /** Value estimate ONLY when evidence exists (mission §12). */
  estimatedValue?: { label: string; status: EvidenceStatus };
  source: 'ai-world-discovery' | 'scheduler-run' | 'task-outcome';
  createdAt: string;
  status: 'NEW' | 'RECOMMENDED' | 'ACCEPTED' | 'DISMISSED';
  // ── EPIC-020 (Outcome & Revenue layer) — money intelligence §3 ──
  /** Capabilities this opportunity needs — only when identifiable. */
  requiredCapabilities?: string[];
  /** Providers/tools required — only when evidenced. */
  requiredProviders?: string[];
  /** Estimated effort — only when evidence exists. */
  estimatedEffort?: { label: string; status: EvidenceStatus };
  /** Cost — only when evidence exists. */
  cost?: { label: string; status: EvidenceStatus };
  risk?: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  /** Approval requirement before acting on this opportunity. */
  approvalRequirement?: string;
  /** The exact recommended next action. */
  recommendedNextAction?: string;
}

// ── Continuous AI World intelligence events (mission §8) ───────────
export type IntelligenceEventKind =
  | 'NEW_MODEL'
  | 'NEW_FREE_API'
  | 'NEW_FREE_TIER'
  | 'NEW_GITHUB_REPOSITORY'
  | 'NEW_OPEN_SOURCE_TOOL'
  | 'PROVIDER_CHANGE'
  | 'MODEL_DEPRECATION'
  | 'PRICING_CHANGE'
  | 'SECURITY_CONCERN'
  | 'ECOSYSTEM_DEVELOPMENT';

/** Security-first GitHub/AI-World classification (mission §9 — never "safe" merely because nothing was found). */
export type SecurityClassification =
  | 'TRUSTED'
  | 'TRUSTED_WITH_REVIEW'
  | 'SECURITY_REVIEW_REQUIRED'
  | 'SUSPICIOUS'
  | 'BLOCKED'
  | 'UNKNOWN';

export interface IntelligenceEvent {
  id: string;
  userId: string;
  kind: IntelligenceEventKind;
  title: string;
  description: string;
  /** Relevance 0..1 (evidence-backed). */
  relevance: number;
  security: SecurityClassification;
  evidence: string[];
  /** Sensitive actions that would require explicit user approval before adoption. */
  adoptionRequired: string[];
  source: string;
  createdAt: string;
  status: 'NEW' | 'REVIEWED' | 'RECOMMENDED' | 'DISMISSED';
  /** EPIC-020 (Outcome & Revenue layer) — capability tags when evidenced. */
  capabilities?: string[];
}

// ── Brain memory / learning feedback (mission §10) ─────────────────

// ── SPRINT-025 · Learning signal vocabulary (evidence-driven) ──────
// What kind of claim a stored learning signal makes. FACT = a verified
// observation (execution + verification evidence). INFERENCE = a pattern
// drawn from one or more observations, never a permanent belief.
// UNKNOWN = insufficient/contradictory evidence — recorded so the feed
// can honestly show "cannot learn from this yet".
export type LearningSignalKind = 'FACT' | 'INFERENCE' | 'UNKNOWN';

/** One structured learning signal captured from a REAL verified outcome. */
export interface LearningSignal {
  /** The claim, in plain language. */
  fact: string;
  kind: LearningSignalKind;
  /** Who stated it: EXPLICIT user feedback vs INFERRED by the system. */
  source: 'EXPLICIT' | 'INFERRED';
  /** 0..1 evidence-weighted confidence (never fabricated). */
  confidence: number;
  /** Why the signal is believed — traceable evidence references. */
  evidence: string[];
  /** Task/outcome provenance. */
  provenance: string;
  capturedAt: string;
}

/**
 * SPRINT-025 · User correction (the ONLY new write surface).
 * Corrections are EXPLICIT user input with strong authority — they
 * outrank weak system inference (EXPLICIT > INFERRED in the frozen
 * ledger). They never carry sensitive data (text facts only).
 */
export interface LearningCorrection {
  id: string;
  userId: string;
  /** What the user corrected, verbatim (bounded length). */
  statement: string;
  /** Who it corrects: a strategy/approach, a provider, a result, or a preference. */
  target: 'approach' | 'provider' | 'result' | 'preference';
  /** Optional scope — provider id when the correction targets a provider. */
  providerId?: string;
  /** Optional scope — capability id when the correction targets one. */
  capability?: CapabilityId;
  /** The task whose outcome the user is correcting (optional). */
  taskId?: string;
  confidence: number;
  capturedAt: string;
}

// ── SPRINT-025 · enriched outcome memory ───────────────────────────
// The frozen BrainOutcomeMemory contract is EXTENDED (not replaced) so
// verified outcomes become structured learning evidence: the honest
// verification state, the SPRINT-024 verdict, derived signals, and any
// user corrections attached to the task. Every new field is optional —
// existing writers/readers keep working unchanged.
export interface BrainOutcomeMemory {
  userId: string;
  taskId: string;
  /** Capability set summary (task type). */
  taskType: string;
  providers: Array<{
    providerId: string;
    capability: CapabilityId;
    role: string;
    succeeded: boolean;
  }>;
  /** Concise decision reasons only — decisions + provenance, no chain-of-thought. */
  selectedReason: string[];
  outcome: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  costUsd?: number;
  tokens?: number;
  latencyMs?: number;
  userAccepted: boolean;
  capturedAt: string;
  /** EPIC-020 (Outcome & Revenue layer) — 3-value satisfaction §10. */
  satisfaction?: 'YES' | 'PARTIALLY' | 'NO' | 'UNKNOWN';
  // ── SPRINT-025 — structured learning evidence (all optional) ──
  /** The honest SPRINT-024 verdict the outcome memory was derived from. */
  verdict?: import('./outcome-types.js').OutcomeVerdict;
  /** Whether the SPRINT-024 independent verification passed. */
  verificationPassed?: boolean;
  /** Whether verification produced a definitive FAIL (artifact contradicted). */
  verificationFailed?: boolean;
  /** Derived learning signals (FACT/INFERENCE/UNKNOWN separation). */
  signals?: LearningSignal[];
  /** User corrections attached to this task/outcome (explicit authority). */
  corrections?: LearningCorrection[];
}

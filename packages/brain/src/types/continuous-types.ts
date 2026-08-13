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
}

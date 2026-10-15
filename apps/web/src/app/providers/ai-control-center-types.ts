// ─────────────────────────────────────────────────────────────────────────────
// SPRINT — AI Control Center (client hook + typed contract)
// The web app never imports from services/api — these types mirror the gateway
// AiControlCenterService view model exactly, and the hook is the ONLY way the
// providers screen obtains usage numbers.
//
// Data honesty (non-negotiable, mirrors the backend contract):
//   • cloud and LOCAL usage are separate concepts and separate totals
//   • `quota.quotaKnown === false` ⇒ the UI must say "Unknown", never a number
//   • `quota.registryEstimatePercent` is a REGISTRY SEED ESTIMATE — it is only
//     ever labelled as such and never turned into account usage or a balance
//   • `remaining.remainingTokens === undefined` ⇒ "Unknown", never `limit - used`
//   • `healthSource === 'SEED'` ⇒ the health record is catalog data, never a
//     live check of this deployment
//   • `budget.source` distinguishes "your budget" from a VedMoulya allowance
// ─────────────────────────────────────────────────────────────────────────────

export type AiBudgetSource = 'NONE' | 'USER_CONFIGURED' | 'PLATFORM_ALLOWANCE';

/** Honest runtime state — configured ≠ ready ≠ executable. */
export type AiProviderRuntimeState =
  | 'NOT_CONFIGURED'
  | 'CONFIGURED'
  | 'AUTH_REQUIRED'
  | 'READY'
  | 'EXECUTING'
  | 'DEGRADED'
  | 'QUOTA_EXHAUSTED'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'FAILED'
  | 'DISABLED';

export interface AiProviderReadinessDTO {
  providerId: string;
  configured: boolean;
  credentialPresent: boolean;
  ready: boolean;
  /** True only when a generation would actually succeed right now. */
  executable: boolean;
  /** null ⇒ quota is UNKNOWN (never "none left"). */
  quotaAvailable: boolean | null;
  state: AiProviderRuntimeState;
  reason?: string;
}

export type AiQuotaSource =
  'PROVIDER_API' | 'PROVIDER_ACCOUNT' | 'KNOWN_PLAN' | 'USER_INPUT' | 'UNKNOWN';

export interface AiUsageTotalsDTO {
  executions: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  /** True when at least one execution had no provider-reported pricing. */
  costUnknown: boolean;
  cachedExecutions: number;
}

/**
 * Provenance of a displayed cost figure. VedMoulya never receives a
 * provider-reported per-request price, so every cost the ledger records is an
 * ESTIMATE (provider-reported token counts × the registry's per-1K pricing).
 * This label stops an estimate from reading as a provider-reported charge.
 */
export type AiCostSource = 'ESTIMATED_FROM_REGISTRY_PRICING' | 'UNKNOWN';

export interface AiProviderQuotaDTO {
  provider: string;
  quotaKnown: boolean;
  usedPercent?: number;
  /** Present ONLY when the provider itself reported a real remaining count. */
  remainingTokens?: number;
  source: AiQuotaSource;
  /**
   * The REGISTRY's own seed estimate, when one exists. It is an ESTIMATE, not
   * account usage: render it only with that label, never as "% used" or as a
   * remaining balance.
   */
  registryEstimatePercent?: number;
  note?: string;
}

export interface AiProviderBoardRowDTO {
  providerId: string;
  name: string;
  family: string;
  local: boolean;
  enabled: boolean;
  monthTokens: number;
  monthExecutions: number;
  quota: AiProviderQuotaDTO;
  monthCostUsd: number;
  monthCostKnown: boolean;
  /** Provenance of `monthCostUsd` — always estimated unless unknown. */
  monthCostSource: AiCostSource;
  readiness: AiProviderReadinessDTO;
  /**
   * Provenance of the registry health record behind `readiness` (absent ⇒
   * 'SEED'). A catalog record was never measured for this deployment, so the
   * seeded 'healthy' must not read as a live check.
   */
  healthSource: 'SEED' | 'MEASURED';
}

export interface AiConfiguredSummaryDTO {
  activeCloudAis: number;
  localAis: number;
  monthCloudTokens: number;
  monthCloudCostUsd: number;
  monthCloudCostKnown: boolean;
  todayCloudTokens: number;
  todayCloudCostUsd: number;
  todayCloudCostKnown: boolean;
  todayCloudExecutions: number;
  monthCloudExecutions: number;
  localMonthTokens: number;
  localTodayTokens: number;
}

export interface AiBudgetViewDTO {
  amountTokens?: number;
  period: 'MONTH';
  source: AiBudgetSource;
  configuredAt?: string;
}

export interface AiRemainingCapacityDTO {
  usedTokens: number;
  limitTokens?: number;
  remainingTokens?: number;
  basis: 'USER_BUDGET' | 'PLATFORM_ALLOWANCE' | 'PROVIDER_QUOTA' | 'UNKNOWN';
}

export interface AiControlCenterDTO {
  timezone: string;
  todayStart: number;
  monthStart: number;
  summary: AiConfiguredSummaryDTO;
  budget: AiBudgetViewDTO;
  remaining: AiRemainingCapacityDTO;
  providers: AiProviderBoardRowDTO[];
  byModel: Array<{
    provider: string;
    family: string;
    model: string;
    executions: number;
    totalTokens: number;
    costUsd: number;
    costUnknown: boolean;
    local: boolean;
  }>;
  bySource: Array<{ source: string; executions: number; totalTokens: number; costUsd: number }>;
  recent: Array<{
    eventId: string;
    provider: string;
    model: string;
    source: string;
    totalTokens: number;
    costUsd: number;
    costUnknown: boolean;
    timestamp: number;
    local: boolean;
    status: string;
  }>;
  totalEvents: number;
}

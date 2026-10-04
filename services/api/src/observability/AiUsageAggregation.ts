// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI Usage aggregation (calendar-day + calendar-month, user tz)
// LOCAL events are observable (localTotals/localByProvider) and NEVER in
// cloud totals/balances/quotas/budgets. Unknowns stay UNKNOWN (no fake math).
// ─────────────────────────────────────────────────────────────────────────────

import type { AiUsageEvent, AiUsageSource } from './AiUsageLedgerTypes.js';

export interface ProviderUsageBreakdown {
  provider: string;
  providerFamily: string;
  executions: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  costUnknown: boolean;
  local: boolean;
}

export interface ModelUsageBreakdown extends ProviderUsageBreakdown {
  model: string;
}

export interface SourceUsageBreakdown {
  source: AiUsageSource;
  executions: number;
  totalTokens: number;
  costUsd: number;
}

export interface UsageTotals {
  executions: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  costUnknown: boolean;
  cachedExecutions: number;
}

export interface AiUsageBoard {
  timezone: string;
  todayStart: number;
  monthStart: number;
  cloud: UsageTotals;
  local: UsageTotals;
  todayCloud: UsageTotals;
  todayLocal: UsageTotals;
  monthCloud: UsageTotals;
  monthLocal: UsageTotals;
  byProvider: ProviderUsageBreakdown[];
  byModel: ModelUsageBreakdown[];
  bySource: SourceUsageBreakdown[];
  todayByProvider: ProviderUsageBreakdown[];
  monthByProvider: ProviderUsageBreakdown[];
  recent: AiUsageEvent[];
  totalEvents: number;
}

export function emptyTotals(): UsageTotals {
  return {
    executions: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    costUnknown: false,
    cachedExecutions: 0,
  };
}

export function resolveTimeZone(tz: string | undefined): string {
  if (!tz) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date(0));
    return tz;
  } catch {
    return 'UTC';
  }
}

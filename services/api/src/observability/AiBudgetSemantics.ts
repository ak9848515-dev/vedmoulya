// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI Budget / Quota semantics (never fabricate)
// Three SEPARATE concepts that must never be conflated:
//   USER BUDGET        — the user's OWN configured limit (source: USER_CONFIGURED)
//   VEDMOULYA ALLOWANCE— a platform default (source: PLATFORM_ALLOWANCE)
//   PROVIDER QUOTA     — what the provider itself reports (source: PROVIDER_…
//                        or UNKNOWN). An UNKNOWN quota NEVER yields a number.
// `remainingTokens` is only ever populated when a REAL limit exists and the
// denominator is authoritative. Otherwise it stays undefined and the UI says
// "Unknown"/"Provider quota unavailable" — never `1_000_000 - usage`.
// ─────────────────────────────────────────────────────────────────────────────

export type BudgetSource = 'NONE' | 'USER_CONFIGURED' | 'PLATFORM_ALLOWANCE';
export type QuotaSource =
  'PROVIDER_API' | 'PROVIDER_ACCOUNT' | 'KNOWN_PLAN' | 'USER_INPUT' | 'UNKNOWN';

/** What the user configured, distinguished from a platform default. */
export interface UserBudgetView {
  /** Monthly token limit the USER set. Undefined when never configured. */
  amountTokens?: number;
  period: 'MONTH';
  source: BudgetSource;
  /** ISO timestamp of when the user configured it (absent for allowance). */
  configuredAt?: string;
}

/** Provider-reported quota. `remaining` is ONLY set when authoritative. */
export interface ProviderQuotaView {
  provider: string;
  /** True only when the provider itself reported a real bounded quota. */
  quotaKnown: boolean;
  /** 0–100, only meaningful when quotaKnown. */
  usedPercent?: number;
  /** Authoritative remaining tokens — undefined unless the provider reported them. */
  remainingTokens?: number;
  source: QuotaSource;
  note?: string;
}

/** Honest remaining capacity: computed ONLY from a real, sourced limit. */
export interface RemainingCapacity {
  usedTokens: number;
  limitTokens?: number;
  /** Present ONLY when limitTokens is authoritative. */
  remainingTokens?: number;
  basis: 'USER_BUDGET' | 'PLATFORM_ALLOWANCE' | 'PROVIDER_QUOTA' | 'UNKNOWN';
}

/**
 * Resolve the budget view for a user, distinguishing a USER-CONFIGURED budget
 * from a platform allowance and from "not configured at all".
 *
 * `monthlyTokenBudget` on a preferences record is only a USER budget when the
 * record was actually written with an explicit source. Legacy records that
 * merely carry the historical default (1,000,000) must NOT be presented as a
 * user budget — they are reported as PLATFORM_ALLOWANCE (or NONE) instead.
 */
export function resolveUserBudgetView(prefs: {
  monthlyTokenBudget?: number;
  budgetConfiguredAt?: string;
  monthlyTokenBudgetSource?: 'USER' | 'PLATFORM';
}): UserBudgetView {
  const amount = prefs.monthlyTokenBudget;
  if (amount === undefined || !Number.isFinite(amount) || amount <= 0) {
    return { period: 'MONTH', source: 'NONE' };
  }
  const source: BudgetSource =
    prefs.monthlyTokenBudgetSource === 'PLATFORM' || prefs.budgetConfiguredAt === undefined
      ? 'PLATFORM_ALLOWANCE'
      : 'USER_CONFIGURED';
  return {
    amountTokens: Math.floor(amount),
    period: 'MONTH',
    source,
    ...(prefs.budgetConfiguredAt !== undefined ? { configuredAt: prefs.budgetConfiguredAt } : {}),
  };
}

/**
 * Remaining capacity for a budgeted cloud figure. Returns `remainingTokens`
 * ONLY when a real limit exists — otherwise the caller must render "Unknown".
 */
export function resolveRemainingCapacity(
  usedTokens: number,
  budget: UserBudgetView,
): RemainingCapacity {
  const used = Math.max(0, usedTokens);
  if (budget.source === 'NONE' || budget.amountTokens === undefined) {
    return { usedTokens: used, basis: 'UNKNOWN' };
  }
  return {
    usedTokens: used,
    limitTokens: budget.amountTokens,
    remainingTokens: Math.max(0, budget.amountTokens - used),
    basis: budget.source === 'USER_CONFIGURED' ? 'USER_BUDGET' : 'PLATFORM_ALLOWANCE',
  };
}

/**
 * Build a provider quota view from the registry health quota percentage. The
 * percentage alone never yields a remaining-token NUMBER (no universal pool).
 */
export function resolveProviderQuotaView(
  provider: string,
  quotaUsedPercent: number,
  local: boolean,
): ProviderQuotaView {
  if (local) {
    return {
      provider,
      quotaKnown: true,
      usedPercent: 0,
      remainingTokens: 0,
      source: 'KNOWN_PLAN',
      note: 'Local AI — unmetered by VedMoulya cloud quota.',
    };
  }
  if (!Number.isFinite(quotaUsedPercent) || quotaUsedPercent <= 0) {
    return {
      provider,
      quotaKnown: false,
      source: 'UNKNOWN',
      note: 'Provider quota unavailable.',
    };
  }
  const used = Math.min(100, Math.max(0, quotaUsedPercent));
  return {
    provider,
    quotaKnown: true,
    usedPercent: used,
    source: 'PROVIDER_ACCOUNT',
  };
}

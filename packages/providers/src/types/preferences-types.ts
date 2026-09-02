// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider Preferences Types
// EPIC-012A — AI Provider Intelligence (Phases 5 / 13 / 14 / 26)
//
// Owner-scoped, per-user AI provider preferences layered OVER the
// global provider registry (EI-002). The registry stays the single
// platform catalog; these preferences express ONLY what THIS user
// wants:
//   - which providers are enabled for automatic routing (Phases 5),
//   - a preferred provider/model (Phase 13 — never silently replaced,
//     only explained),
//   - a budget policy + daily/monthly/per-request budgets (Phase 14 —
//     default ASK BEFORE PAID, never silently incur paid usage).
//
// Security: every record is keyed by userId and owner-scoped; the
// gateway's session middleware guarantees userId === session user
// (IDOR refused at the boundary). No credentials ever live here.
// ──────────────────────────────────────────────────────────────────

export type BudgetPolicy = 'never_paid' | 'ask_before_paid' | 'allow_within_budget';

export const DEFAULT_BUDGET_POLICY: BudgetPolicy = 'ask_before_paid';

/**
 * The initial Primary Brain for every completed VedMoulya account:
 * Google Gemini (the `google` provider in the platform catalog).
 * User/domain state — NOT the runtime AI_DEFAULT_PROVIDER.
 */
export const DEFAULT_PRIMARY_BRAIN_PROVIDER_ID = 'google';

/** Default monthly token budget used for the aggregate usage indicator. */
export const DEFAULT_MONTHLY_TOKEN_BUDGET = 1_000_000;

export interface ProviderBudgets {
  /** Per-request spend cap in USD. */
  perRequestUsd?: number;
  /** Daily spend cap in USD. */
  dailyUsd?: number;
  /** Monthly spend cap in USD. */
  monthlyUsd?: number;
  /** Monthly TOKEN budget (the "1M" in the usage indicator). */
  monthlyTokenBudget?: number;
}

/**
 * A user's AI provider preferences. `disabledProviderIds` is the
 * minimal record: providers are ENABLED by default (registry default),
 * so a newly-added catalog provider is automatically enabled and the
 * user's stored record stays small. The UI switch state for a provider
 * is `!disabledProviderIds.includes(providerId)`.
 */
export interface ProviderPreferences {
  userId: string;
  /** Providers THIS user has explicitly disabled for automatic routing. */
  disabledProviderIds: string[];
  /** Optional preferred provider (routing explains, never silently swaps). */
  preferredProviderId?: string;
  /** Optional preferred model (must belong to a known provider). */
  preferredModelId?: string;
  budgetPolicy: BudgetPolicy;
  budgets: ProviderBudgets;
  updatedAt: string;
}

/** Patch accepted by the preferences update procedure (all optional). */
export interface ProviderPreferencesPatch {
  disabledProviderIds?: string[];
  preferredProviderId?: string | null;
  preferredModelId?: string | null;
  budgetPolicy?: BudgetPolicy;
  budgets?: ProviderBudgets;
}

export function defaultProviderPreferences(userId: string): ProviderPreferences {
  return {
    userId,
    disabledProviderIds: [],
    // PRIMARY BRAIN DEFAULT (context-aware onboarding): every VedMoulya
    // account starts with Google Gemini as its Primary Brain — assigned
    // automatically by the domain layer, never through a setup screen. This
    // is USER state (persisted with the record on first write); it must never
    // be confused with the runtime/platform AI_DEFAULT_PROVIDER.
    preferredProviderId: DEFAULT_PRIMARY_BRAIN_PROVIDER_ID,
    budgetPolicy: DEFAULT_BUDGET_POLICY,
    budgets: { monthlyTokenBudget: DEFAULT_MONTHLY_TOKEN_BUDGET },
    updatedAt: new Date().toISOString(),
  };
}

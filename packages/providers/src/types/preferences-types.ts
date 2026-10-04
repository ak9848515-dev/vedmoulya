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

/**
 * The historical platform default monthly token figure. It was previously
 * written into every new account's preferences, which made a fabricated
 * "1M token balance" look like a real USER budget.
 *
 * MIGRATION (A-4): this value is now treated as a PLATFORM_ALLOWANCE — never as
 * a user budget — until the user explicitly configures one. Accounts that never
 * chose a budget therefore report "Not configured", which is the truth.
 */
export const DEFAULT_MONTHLY_TOKEN_BUDGET = 1_000_000;

/**
 * Where a monthly token budget came from.
 *   USER    — the account holder explicitly configured it (real budget)
 *   PLATFORM— a VedMoulya allowance/default (never presented as user budget)
 */
export type MonthlyTokenBudgetSource = 'USER' | 'PLATFORM';

export interface ProviderBudgets {
  /** Per-request spend cap in USD. */
  perRequestUsd?: number;
  /** Daily spend cap in USD. */
  dailyUsd?: number;
  /** Monthly spend cap in USD. */
  monthlyUsd?: number;
  /**
   * Monthly TOKEN limit. NOT a "balance": it is a limit the user (or the
   * platform) declared. The provenance is tracked in `monthlyTokenBudgetSource`
   * so the UI can say "your budget" vs "VedMoulya allowance" vs "not configured".
   */
  monthlyTokenBudget?: number;
  /** Provenance of `monthlyTokenBudget` — USER or PLATFORM. */
  monthlyTokenBudgetSource?: MonthlyTokenBudgetSource;
  /** ISO timestamp the USER last configured a token budget (absent = never). */
  monthlyTokenBudgetConfiguredAt?: string;
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
    // A-4 MIGRATION: the seeded 1M figure is a PLATFORM_ALLOWANCE, never a user
    // budget. It carries no `monthlyTokenBudgetConfiguredAt`, so every consumer
    // reports it as "VedMoulya allowance / not your budget" until the user sets
    // one explicitly (which stamps source=USER + configuredAt).
    budgets: {
      monthlyTokenBudget: DEFAULT_MONTHLY_TOKEN_BUDGET,
      monthlyTokenBudgetSource: 'PLATFORM',
    },
    updatedAt: new Date().toISOString(),
  };
}

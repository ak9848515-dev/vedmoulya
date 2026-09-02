// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider Preferences Service
// EPIC-012A — AI Provider Intelligence (Phases 5 / 13 / 14 / 26)
//
// Owner-scoped application service for per-user AI provider
// preferences. Reads and writes ONLY the caller's record (userId is a
// required input; the gateway additionally guarantees userId ===
// session user). Defaults apply when the user never customized
// anything — including the automatic GOOGLE GEMINI PRIMARY BRAIN
// (DEFAULT_PRIMARY_BRAIN_PROVIDER_ID) every completed account starts
// with. The user's stored record stays minimal (a disabled-set).
//
// DOMAIN INVARIANT (server-enforced, never frontend-only):
//   1. enabledProviders.length >= 1 for every account — the last
//      enabled provider can never be disabled.
//   2. The (effective) Primary Brain must always reference an ENABLED
//      provider — disabling it requires selecting another enabled
//      provider as Primary Brain first.
// The universe of providers is the SINGLE platform catalog (EI-002),
// supplied by the gateway via listCatalogProviderIds — no second
// provider architecture.
// ──────────────────────────────────────────────────────────────────

import type { ProviderPreferencesStore } from '../domain/preferences/ProviderPreferencesStore.js';
import type {
  BudgetPolicy,
  ProviderBudgets,
  ProviderPreferences,
  ProviderPreferencesPatch,
} from '../types/preferences-types.js';
import {
  DEFAULT_PRIMARY_BRAIN_PROVIDER_ID,
  defaultProviderPreferences,
} from '../types/preferences-types.js';

export interface ProviderPreferencesResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const BUDGET_POLICIES: readonly BudgetPolicy[] = [
  'never_paid',
  'ask_before_paid',
  'allow_within_budget',
];

/** Mandatory-provider invariant copy (Part 8 of the VedMoulya domain rules). */
export const MANDATORY_PROVIDER_ERROR = 'VedMoulya requires at least one active AI provider.';
export const PRIMARY_BRAIN_DISABLED_ERROR =
  'Primary Brain must be an enabled provider. Enable it or choose another provider first.';
export const PRIMARY_BRAIN_DISABLE_BLOCKED_ERROR =
  'VedMoulya requires at least one active AI provider. Set another enabled provider as your Primary Brain before disabling this one.';

/**
 * Truthful UI state for one provider's enable switch (mirrors
 * enforceInvariants exactly — the server and the screen can never
 * disagree). Returns the blocking reason when DISABLING `providerId`
 * must be refused, or undefined when the switch is free:
 *   - enabling is always allowed,
 *   - the last enabled provider can never be disabled (Part 8),
 *   - the current Primary Brain can be disabled only after another
 *     enabled provider is selected as Primary Brain first.
 */
export function describeProviderSwitch(
  prefs: ProviderPreferences,
  allProviderIds: string[],
  providerId: string,
): string | undefined {
  if (prefs.disabledProviderIds.includes(providerId)) return undefined;
  const disabled = new Set(prefs.disabledProviderIds);
  const enabled = allProviderIds.filter((id) => !disabled.has(id));
  if (enabled.length <= 1) return MANDATORY_PROVIDER_ERROR;
  const brain = prefs.preferredProviderId ?? DEFAULT_PRIMARY_BRAIN_PROVIDER_ID;
  if (providerId === brain) return PRIMARY_BRAIN_DISABLE_BLOCKED_ERROR;
  return undefined;
}

export class ProviderPreferencesService {
  constructor(
    private readonly store: ProviderPreferencesStore,
    private readonly listCatalogProviderIds?: () => string[] | Promise<string[]>,
  ) {}

  /** Load the user's preferences; defaults when never customized. */
  async getPreferences(userId: string): Promise<ProviderPreferencesResult<ProviderPreferences>> {
    if (!userId) {
      return { success: false, error: 'userId is required' };
    }
    const stored = await this.store.get(userId);
    return { success: true, data: stored ?? defaultProviderPreferences(userId) };
  }

  /**
   * The user's EFFECTIVE Primary Brain: the stored preference, or Google
   * Gemini by default. Domain state — never the runtime AI_DEFAULT_PROVIDER.
   */
  async getPrimaryBrainProviderId(userId: string): Promise<string | undefined> {
    const prefs = await this.store.get(userId);
    return prefs?.preferredProviderId ?? DEFAULT_PRIMARY_BRAIN_PROVIDER_ID;
  }

  /** Apply an owner-scoped patch and persist. */
  async updatePreferences(
    userId: string,
    patch: ProviderPreferencesPatch,
  ): Promise<ProviderPreferencesResult<ProviderPreferences>> {
    if (!userId) {
      return { success: false, error: 'userId is required' };
    }
    const validation = validatePatch(patch);
    if (!validation.ok) {
      return { success: false, error: validation.error };
    }

    const current = (await this.store.get(userId)) ?? defaultProviderPreferences(userId);
    const next: ProviderPreferences = {
      userId,
      disabledProviderIds: patch.disabledProviderIds
        ? [...new Set(patch.disabledProviderIds.map((p) => p.trim()).filter(Boolean))]
        : current.disabledProviderIds,
      preferredProviderId:
        patch.preferredProviderId !== undefined
          ? (patch.preferredProviderId ?? undefined)
          : current.preferredProviderId,
      preferredModelId:
        patch.preferredModelId !== undefined
          ? (patch.preferredModelId ?? undefined)
          : current.preferredModelId,
      budgetPolicy: patch.budgetPolicy ?? current.budgetPolicy,
      budgets: { ...current.budgets, ...(patch.budgets ?? {}) },
      updatedAt: new Date().toISOString(),
    };

    // SERVER-SIDE DOMAIN INVARIANTS (Part 8) — never frontend-only.
    const enforced = await this.enforceInvariants(next);
    if (!enforced.ok) {
      return { success: false, error: enforced.error };
    }

    await this.store.save(next);
    return { success: true, data: next };
  }

  /**
   * Enable or disable one provider for THIS user (Phase 5 — the switch
   * on the AI Providers screen). Disabled providers remain configured in
   * the registry but are excluded from automatic routing.
   *
   * MANDATORY-PROVIDER INVARIANT: the last enabled provider cannot be
   * disabled, and the effective Primary Brain cannot be disabled until
   * another enabled provider is selected as Primary Brain.
   */
  async setProviderEnabled(
    userId: string,
    providerId: string,
    enabled: boolean,
  ): Promise<ProviderPreferencesResult<ProviderPreferences>> {
    if (!userId || !providerId.trim()) {
      return { success: false, error: 'userId and providerId are required' };
    }
    const current = (await this.store.get(userId)) ?? defaultProviderPreferences(userId);
    const disabled = new Set(current.disabledProviderIds);
    if (enabled) disabled.delete(providerId);
    else disabled.add(providerId);

    const next: ProviderPreferences = {
      ...current,
      disabledProviderIds: [...disabled],
      updatedAt: new Date().toISOString(),
    };

    const effectiveBrain = current.preferredProviderId ?? DEFAULT_PRIMARY_BRAIN_PROVIDER_ID;
    const enforced = await this.enforceInvariants(next, {
      disablingProviderId: enabled ? undefined : providerId,
      effectiveBrainProviderId: effectiveBrain,
    });
    if (!enforced.ok) {
      return { success: false, error: enforced.error };
    }

    await this.store.save(next);
    return { success: true, data: next };
  }

  /** Is this provider enabled for the user? (default: true). */
  async isProviderEnabled(userId: string, providerId: string): Promise<boolean> {
    const prefs = await this.store.get(userId);
    if (!prefs) return true;
    return !prefs.disabledProviderIds.includes(providerId);
  }

  /** Resolve the user's enabled subset of `allProviderIds`. */
  async getEnabledProviderIds(userId: string, allProviderIds: string[]): Promise<string[]> {
    const prefs = await this.store.get(userId);
    if (!prefs || prefs.disabledProviderIds.length === 0) return [...allProviderIds];
    const disabled = new Set(prefs.disabledProviderIds);
    return allProviderIds.filter((id) => !disabled.has(id));
  }

  /** The provider ids the user explicitly disabled (for the config view). */
  async getDisabledProviderIds(userId: string): Promise<string[]> {
    const prefs = await this.store.get(userId);
    return prefs?.disabledProviderIds ?? [];
  }

  /**
   * Enforce the account-level provider invariants against the single
   * platform catalog. Without a catalog source (legacy/dev contexts) the
   * catalog-derived checks cannot be evaluated and are skipped — the
   * gateway always supplies the catalog. A catalog READ failure also
   * skips the check rather than breaking unrelated preference writes;
   * the registry remains the source of truth for routing.
   */
  private async enforceInvariants(
    next: ProviderPreferences,
    context: { disablingProviderId?: string; effectiveBrainProviderId?: string } = {},
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const catalog = await this.resolveCatalogIds();
    if (!catalog) return { ok: true };

    const disabled = new Set(next.disabledProviderIds);
    const enabled = catalog.filter((id) => !disabled.has(id));

    // 1. Never zero enabled providers.
    if (enabled.length === 0) {
      return { ok: false, error: MANDATORY_PROVIDER_ERROR };
    }

    // 2. The effective Primary Brain must be an ENABLED provider. The
    //    effective brain is the stored preference, or Google Gemini by
    //    default. Disabling the current brain outright is blocked with
    //    actionable guidance (select another brain first).
    const brain =
      context.effectiveBrainProviderId ??
      next.preferredProviderId ??
      DEFAULT_PRIMARY_BRAIN_PROVIDER_ID;
    if (context.disablingProviderId && context.disablingProviderId === brain) {
      return { ok: false, error: PRIMARY_BRAIN_DISABLE_BLOCKED_ERROR };
    }
    if (disabled.has(brain)) {
      return { ok: false, error: PRIMARY_BRAIN_DISABLED_ERROR };
    }
    return { ok: true };
  }

  private async resolveCatalogIds(): Promise<string[] | null> {
    if (!this.listCatalogProviderIds) return null;
    try {
      const ids = await this.listCatalogProviderIds();
      return Array.isArray(ids) && ids.length > 0 ? ids : null;
    } catch {
      return null;
    }
  }
}

function validatePatch(
  patch: ProviderPreferencesPatch,
): { ok: true } | { ok: false; error: string } {
  if (patch.budgetPolicy !== undefined && !BUDGET_POLICIES.includes(patch.budgetPolicy)) {
    return { ok: false, error: `Unknown budget policy: ${patch.budgetPolicy}` };
  }
  if (patch.budgets !== undefined) {
    const budgets = patch.budgets;
    for (const [key, value] of Object.entries(budgets)) {
      if (value === undefined) continue;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        return { ok: false, error: `Budget ${key} must be a non-negative number` };
      }
    }
  }
  if (
    patch.preferredProviderId === null &&
    patch.preferredModelId !== undefined &&
    patch.preferredModelId !== null
  ) {
    return { ok: false, error: 'A preferred model requires a preferred provider' };
  }
  return { ok: true };
}

export type { ProviderBudgets };

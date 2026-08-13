// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider Preferences Service
// EPIC-012A — AI Provider Intelligence (Phases 5 / 13 / 14 / 26)
//
// Owner-scoped application service for per-user AI provider
// preferences. Reads and writes ONLY the caller's record (userId is a
// required input; the gateway additionally guarantees userId ===
// session user). Defaults (all providers enabled, budget policy ASK
// BEFORE PAID) apply when the user never customized anything — the
// user's stored record stays minimal (a disabled-set).
// ──────────────────────────────────────────────────────────────────

import type { ProviderPreferencesStore } from '../domain/preferences/ProviderPreferencesStore.js';
import type {
  BudgetPolicy,
  ProviderBudgets,
  ProviderPreferences,
  ProviderPreferencesPatch,
} from '../types/preferences-types.js';
import { defaultProviderPreferences } from '../types/preferences-types.js';

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

export class ProviderPreferencesService {
  constructor(private readonly store: ProviderPreferencesStore) {}

  /** Load the user's preferences; defaults when never customized. */
  async getPreferences(userId: string): Promise<ProviderPreferencesResult<ProviderPreferences>> {
    if (!userId) {
      return { success: false, error: 'userId is required' };
    }
    const stored = await this.store.get(userId);
    return { success: true, data: stored ?? defaultProviderPreferences(userId) };
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

    await this.store.save(next);
    return { success: true, data: next };
  }

  /**
   * Enable or disable one provider for THIS user (Phase 5 — the switch
   * on the AI Providers screen). Disabled providers remain configured in
   * the registry but are excluded from automatic routing.
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

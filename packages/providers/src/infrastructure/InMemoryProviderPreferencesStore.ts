// ──────────────────────────────────────────────────────────────────
// VedMoulya — In-Memory Provider Preferences Store
// EPIC-012A — AI Provider Intelligence (Phases 5 / 13 / 14)
//
// Map-backed owner-scoped store for tests, dev, and single-process
// deployments. Mirrors the InMemoryProviderRepository pattern.
// ──────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/require-await -- In-memory store
   implements the Promise-returning port with a synchronous Map body. */

import type { ProviderPreferencesStore } from '../domain/preferences/ProviderPreferencesStore.js';
import type { ProviderPreferences } from '../types/preferences-types.js';

export class InMemoryProviderPreferencesStore implements ProviderPreferencesStore {
  private readonly store = new Map<string, ProviderPreferences>();

  async get(userId: string): Promise<ProviderPreferences | null> {
    const record = this.store.get(userId);
    return record ? { ...record, budgets: { ...record.budgets } } : null;
  }

  async save(preferences: ProviderPreferences): Promise<void> {
    this.store.set(preferences.userId, {
      ...preferences,
      disabledProviderIds: [...preferences.disabledProviderIds],
      budgets: { ...preferences.budgets },
    });
  }
}

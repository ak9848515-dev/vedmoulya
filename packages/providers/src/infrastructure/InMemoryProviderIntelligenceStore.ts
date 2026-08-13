// ──────────────────────────────────────────────────────────────────
// VedMoulya — In-Memory Provider Intelligence Store
// EPIC-012B — AI Provider Intelligence & Model Discovery
//
// Map-backed bounded cache for tests, dev, and single-process
// deployments. Bounded FIFO (default 500 entries) evicts the oldest
// record first so cached intelligence can never grow unbounded.
// Mirrors the InMemoryProviderRepository pattern.
// ──────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/require-await -- In-memory store
   implements the Promise-returning port with a synchronous Map body. */

import type {
  ProviderIntelligenceRecord,
  ProviderIntelligenceStore,
} from '../domain/intelligence/ProviderIntelligenceStore.js';

export class InMemoryProviderIntelligenceStore implements ProviderIntelligenceStore {
  private readonly store = new Map<string, ProviderIntelligenceRecord>();
  private readonly maxEntries: number;

  constructor(maxEntries = 500) {
    this.maxEntries = Math.max(1, maxEntries);
  }

  async get(providerId: string): Promise<ProviderIntelligenceRecord | null> {
    const record = this.store.get(providerId);
    return record ? structuredClone(record) : null;
  }

  async save(record: ProviderIntelligenceRecord): Promise<void> {
    this.store.set(record.providerId, structuredClone(record));
    // Bounded FIFO: evict the oldest entries beyond the cap.
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  async delete(providerId: string): Promise<void> {
    this.store.delete(providerId);
  }

  async list(): Promise<ProviderIntelligenceRecord[]> {
    return [...this.store.values()].map((r) => structuredClone(r));
  }
}

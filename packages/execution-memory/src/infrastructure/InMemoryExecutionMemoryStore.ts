// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Memory: In-Memory Store
//
// Hermetic test double + default store. Structured, durable persistence
// is delegated to the EXISTING enterprise memory platform via
// MemoryIntelligenceStoreAdapter (this package never introduces a second
// database or persistence architecture).
// ──────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/require-await -- In-memory store
   implements the Promise-returning port with synchronous Map-backed
   bodies (no I/O); async markers required for conformance. */

import type {
  ExecutionMemoryStore,
  MemoryStoreSearch,
} from '../contracts/execution-memory-ports.js';
import type { MemoryEntry } from '../types/execution-memory-types.js';

export class InMemoryExecutionMemoryStore implements ExecutionMemoryStore {
  private readonly entries = new Map<string, MemoryEntry>();

  async save(entry: MemoryEntry): Promise<void> {
    this.entries.set(entry.entryId, entry);
  }

  async get(entryId: string): Promise<MemoryEntry | undefined> {
    return this.entries.get(entryId);
  }

  async getByFingerprint(fingerprint: string): Promise<MemoryEntry | undefined> {
    for (const entry of this.entries.values()) {
      if (entry.fingerprint === fingerprint) return entry;
    }
    return undefined;
  }

  async list(search: MemoryStoreSearch = {}): Promise<MemoryEntry[]> {
    const results: MemoryEntry[] = [];
    for (const entry of this.entries.values()) {
      if (search.userId !== undefined && entry.userId !== search.userId) continue;
      if (search.category !== undefined && entry.category !== search.category) continue;
      if (search.scope !== undefined && entry.scope !== search.scope) continue;
      if (search.subject !== undefined && entry.subject !== search.subject) continue;
      if (search.capability !== undefined && entry.capability !== search.capability) continue;
      results.push(entry);
    }
    return results;
  }

  async delete(entryId: string): Promise<void> {
    this.entries.delete(entryId);
  }
}

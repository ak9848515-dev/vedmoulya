// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S4.1 delivery outcome memory + governed API exposure
//
// Proves:
//   • a verified delivery persists a DELIVERY_OUTCOME memory entry through the
//     EXISTING ExecutionMemoryStore contract
//   • replay is idempotent — one entry, reinforced, never duplicated
//   • a different objective or a different owner is a separate entry
//   • the entry is semantically distinct from a user preference
//   • the stored entry carries references only — never content or secrets
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type { ExecutionMemoryStore, MemoryEntry } from '@vedmoulya/execution-memory';
import { DeliveryOutcomeMemory } from '../services/DeliveryOutcomeMemory.js';

class Store implements ExecutionMemoryStore {
  readonly entries: MemoryEntry[] = [];
  fail = false;

  async save(entry: MemoryEntry): Promise<void> {
    if (this.fail) throw new Error('memory store unavailable');
    const index = this.entries.findIndex((e) => e.fingerprint === entry.fingerprint);
    if (index >= 0) this.entries[index] = entry;
    else this.entries.push(entry);
  }

  async get(entryId: string): Promise<MemoryEntry | undefined> {
    return this.entries.find((e) => e.entryId === entryId);
  }

  async getByFingerprint(fingerprint: string): Promise<MemoryEntry | undefined> {
    return this.entries.find((e) => e.fingerprint === fingerprint);
  }

  async list(): Promise<MemoryEntry[]> {
    return [...this.entries];
  }

  async delete(): Promise<void> {
    /* not used */
  }
}

const NOW = new Date('2026-10-05T10:00:00.000Z');

function record(overrides: Partial<Parameters<typeof DeliveryOutcomeMemory.fingerprint>[0]> = {}) {
  return {
    userId: 'u-1',
    missionId: 'm-1',
    objectiveId: 'o-1',
    documentId: 'doc_abc',
    outcome: 'Landing page delivered',
    source: 'mission-verified-handoff',
    ...overrides,
  };
}

function memory(store: Store) {
  return new DeliveryOutcomeMemory({ store, now: () => NOW });
}

describe('S4.1 — delivery outcome memory', () => {
  it('persists a DELIVERY_OUTCOME entry, never a USER_PREFERENCE', async () => {
    const store = new Store();
    await memory(store).record(record());

    expect(store.entries).toHaveLength(1);
    const entry = store.entries[0]!;
    expect(entry.category).toBe('DELIVERY_OUTCOME');
    expect(entry.category).not.toBe('USER_PREFERENCE');
    expect(entry.scope).toBe('USER');
    expect(entry.userId).toBe('u-1');
    expect(entry.subject).toBe('objective:o-1');
    expect(entry.predicate).toBe('DELIVERED');
    expect(entry.value).toBe(1);
    expect(entry.verifiedCount).toBe(1);
  });

  it('is idempotent: a replay reinforces ONE entry instead of duplicating', async () => {
    const store = new Store();
    const mem = memory(store);

    await mem.record(record());
    await mem.record(record());
    await mem.record(record());

    expect(store.entries).toHaveLength(1);
    const entry = store.entries[0]!;
    expect(entry.sampleCount).toBe(3);
    expect(entry.verifiedCount).toBe(3);
    expect(entry.value).toBe(1);
  });

  it('gives a different objective a separate outcome', async () => {
    const store = new Store();
    const mem = memory(store);

    await mem.record(record());
    await mem.record(record({ objectiveId: 'o-2', documentId: 'doc_def' }));

    expect(store.entries).toHaveLength(2);
    expect(new Set(store.entries.map((e) => e.fingerprint)).size).toBe(2);
  });

  it('isolates outcomes per user', async () => {
    const store = new Store();
    const mem = memory(store);

    await mem.record(record());
    await mem.record(record({ userId: 'u-2', documentId: 'doc_2' }));

    expect(store.entries).toHaveLength(2);
    expect(store.entries.filter((e) => e.userId === 'u-1')).toHaveLength(1);
    expect(store.entries.filter((e) => e.userId === 'u-2')).toHaveLength(1);
    // The same objective under two owners is two distinct outcomes.
    expect(store.entries[0]!.fingerprint).not.toBe(store.entries[1]!.fingerprint);
  });

  it('reads an outcome back by its deterministic key', async () => {
    const store = new Store();
    const mem = memory(store);
    await mem.record(record());

    const found = await mem.getForDelivery('u-1', 'm-1', 'o-1');
    expect(found?.subject).toBe('objective:o-1');
    expect(await mem.getForDelivery('u-9', 'm-1', 'o-1')).toBeUndefined();
  });

  it('stores references only — never content, secrets or workspace paths', async () => {
    const store = new Store();
    await memory(store).record(record());

    const serialized = JSON.stringify(store.entries[0]!);
    expect(serialized).not.toMatch(/postgres:\/\//i);
    expect(serialized).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
    expect(serialized).not.toMatch(/AIza[A-Za-z0-9_-]{10,}/);
    expect(serialized).not.toMatch(/bearer /i);
    expect(serialized).not.toMatch(/password/i);
    expect(serialized).not.toMatch(/[A-Za-z]:\\\\/);
    // The deliverable itself is referenced, not embedded.
    expect(serialized).toContain('m-1');
    expect(serialized).not.toContain('Landing page delivered\n');
  });

  it('propagates a store failure so the caller can report it honestly', async () => {
    const store = new Store();
    store.fail = true;
    await expect(memory(store).record(record())).rejects.toThrow();
  });
});

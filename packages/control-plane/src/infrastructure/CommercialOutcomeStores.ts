// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S6.0 · Commercial outcome stores
//
// In-memory (dev/test) + Postgres write-through backends for the owner-scoped
// commercial-outcome boundary. Both are IDEMPOTENT by (userId, outcomeId):
// `save` returns the EXISTING record when one is already present, so a repeated
// or concurrent request can never create a duplicate commercial record.
//
// Durability: production uses the shared `@vedmoulya/core`
// WriteThroughDocumentStore base — one JSONB table with PRIMARY KEY (owner, key),
// so concurrent processes converge on ONE row (an upsert can never insert a
// second row for the same (owner, key)). Owner isolation is enforced by query
// construction; documents are references/status/timestamps only — never secrets.
// ─────────────────────────────────────────────────────────────────────────────

import type postgres from 'postgres';
import { WriteThroughDocumentStore } from '@vedmoulya/core';
import type {
  CommercialOutcomeRecord,
  CommercialOutcomeStore,
} from '../types/commercial-outcome-types.js';

/** Deterministic (owner, key) for a commercial outcome. */
function keyOf(record: CommercialOutcomeRecord): string {
  return record.outcomeId;
}

/** Deterministic in-memory map key (owner + outcomeId). */
function mapKey(userId: string, outcomeId: string): string {
  return `${userId}\u0000${outcomeId}`;
}

/** Deterministic in-memory backend (dev/test convention). Owner-scoped. */
export class InMemoryCommercialOutcomeStore implements CommercialOutcomeStore {
  private readonly records = new Map<string, CommercialOutcomeRecord>();

  save(record: CommercialOutcomeRecord): CommercialOutcomeRecord {
    const key = mapKey(record.userId, record.outcomeId);
    const existing = this.records.get(key);
    if (existing) return existing;
    this.records.set(key, record);
    return record;
  }

  update(record: CommercialOutcomeRecord): CommercialOutcomeRecord {
    this.records.set(mapKey(record.userId, record.outcomeId), record);
    return record;
  }

  get(userId: string, outcomeId: string): CommercialOutcomeRecord | undefined {
    return this.records.get(mapKey(userId, outcomeId));
  }

  list(userId: string): CommercialOutcomeRecord[] {
    return [...this.records.values()]
      .filter((record) => record.userId === userId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
}

/** Durable owner-scoped backend (production/staging) via WriteThroughDocumentStore. */
export class PostgresCommercialOutcomeStore
  extends WriteThroughDocumentStore<CommercialOutcomeRecord>
  implements CommercialOutcomeStore
{
  constructor(sql: postgres.Sql, table = 'commercial_outcomes') {
    super(sql, table);
  }

  save(record: CommercialOutcomeRecord): CommercialOutcomeRecord {
    const existing = this.read(record.userId, keyOf(record));
    if (existing) return existing;
    return this.write(record.userId, keyOf(record), record);
  }

  update(record: CommercialOutcomeRecord): CommercialOutcomeRecord {
    // Upsert at the SAME (owner, key): PRIMARY KEY (owner, key) means a
    // concurrent update converges on one row — never a duplicate outcome.
    return this.write(record.userId, keyOf(record), record);
  }

  get(userId: string, outcomeId: string): CommercialOutcomeRecord | undefined {
    return this.read(userId, outcomeId);
  }

  list(userId: string): CommercialOutcomeRecord[] {
    return this.all(userId).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
}

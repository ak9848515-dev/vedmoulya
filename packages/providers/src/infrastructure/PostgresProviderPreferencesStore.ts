// ──────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Provider Preferences Store
// EPIC-012A — AI Provider Intelligence (Phases 5 / 13 / 14)
//
// Postgres-backed implementation of the ProviderPreferencesStore contract,
// following the same shape as PostgresProviderCredentialStore
// (ensureTable + parameterized queries).
//
// WHY THIS EXISTS: the in-memory store only survives the lifetime of one
// process, so a user's enable/preferred choice was lost on every restart —
// a provider could be "connected and enabled" and then silently revert to
// disabled. Preferences are OWNER state, so they belong in the same durable
// store the rest of the estate uses outside development/test.
//
// The whole record is one JSONB document: the preferences shape is owned by
// the domain layer, so a column-per-field schema would have to be migrated on
// every domain change. No secret material is ever written here (credentials
// live in provider_credentials, encrypted at rest).
// ──────────────────────────────────────────────────────────────────

import type postgres from 'postgres';
import type { ProviderPreferencesStore } from '../domain/preferences/ProviderPreferencesStore.js';
import {
  DEFAULT_BUDGET_POLICY,
  type BudgetPolicy,
  type ProviderPreferences,
} from '../types/preferences-types.js';

interface ProviderPreferencesRow {
  user_id: string;
  document: ProviderPreferences | string;
  updated_at: string | Date;
}

/**
 * Normalize a stored jsonb document into a plain object.
 *
 * A row written by an earlier build could hold a jsonb STRING (the value was
 * pre-stringified and cast to jsonb, which double-encodes it) instead of a jsonb
 * OBJECT. Reading such a row as an object yielded `undefined` collections and
 * threw "not iterable". Tolerating both shapes keeps a previously-written row
 * readable after the write path is corrected.
 */
/**
 * Normalize a stored jsonb document into a plain object.
 *
 * A row written by an earlier build could hold a jsonb STRING (the value was
 * pre-stringified and cast to jsonb, which double-encodes it) instead of a jsonb
 * OBJECT. Reading such a row as an object yielded `undefined` collections and
 * threw "not iterable". Tolerating both shapes keeps a previously-written row
 * readable after the write path is corrected.
 *
 * The return type is deliberately loose (every field optional and unvalidated):
 * the value comes from the database, so the caller must re-check each field
 * rather than trust the nominal ProviderPreferences shape.
 */
function normalizeStoredDocument(raw: ProviderPreferences | string): Record<string, unknown> {
  const value: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (typeof value !== 'object' || value === null) return {};
  return value as Record<string, unknown>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Narrow an untrusted value to the BudgetPolicy union, falling back at the call site. */
function isBudgetPolicy(value: unknown): value is BudgetPolicy {
  return value === 'never_paid' || value === 'ask_before_paid' || value === 'allow_within_budget';
}

/** Keep only string members; a legacy row may hold a non-array or mixed collection. */
function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

export class PostgresProviderPreferencesStore implements ProviderPreferencesStore {
  private readonly sql: postgres.Sql;

  constructor(sql: postgres.Sql) {
    this.sql = sql;
  }

  /** Safe on every start (IF NOT EXISTS). In production this should be a migration. */
  async ensureTable(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS provider_preferences (
        user_id TEXT PRIMARY KEY,
        document JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  }

  async get(userId: string): Promise<ProviderPreferences | null> {
    const rows = await this.sql<ProviderPreferencesRow[]>`
      SELECT user_id, document, updated_at
      FROM provider_preferences
      WHERE user_id = ${userId}
    `;
    const row = rows[0];
    if (!row) return null;
    // Defensive copy: a stored document is untrusted input to the domain layer,
    // so the mutable collections are re-created rather than aliased. A document
    // written by an older build may be a jsonb STRING (double-encoded) or may
    // omit optional fields, so it is normalized to a plain object first — a
    // missing collection must default, never throw "not iterable".
    const document = normalizeStoredDocument(row.document);
    // Every field is re-derived from the untrusted document, so a partial or
    // legacy row normalizes to valid preferences instead of throwing.
    const budgetPolicy: BudgetPolicy = isBudgetPolicy(document.budgetPolicy)
      ? document.budgetPolicy
      : DEFAULT_BUDGET_POLICY;
    return {
      ...document,
      userId: row.user_id,
      budgetPolicy,
      disabledProviderIds: toStringArray(document.disabledProviderIds),
      budgets: isPlainObject(document.budgets) ? { ...document.budgets } : {},
      updatedAt:
        typeof row.updated_at === 'string'
          ? row.updated_at
          : new Date(row.updated_at).toISOString(),
    };
  }

  async save(preferences: ProviderPreferences): Promise<void> {
    // The document is bound as a plain object and postgres.js serializes it to
    // jsonb natively, so the column receives a jsonb OBJECT (jsonb_typeof =
    // 'object'). The previous code did `JSON.stringify(...)::jsonb`, which stored
    // a jsonb STRING primitive — the object shape was then lost on read and every
    // collection read as `undefined` ("not iterable").
    //
    // The cast is the single boundary assertion: postgres.js's parameter type is
    // not satisfiable by the nominal ProviderPreferences interface, but the
    // runtime value is the same object and is JSON-serializable by construction.
    const document = { ...preferences } as unknown as postgres.JSONValue;
    await this.sql`
      INSERT INTO provider_preferences (user_id, document, updated_at)
      VALUES (${preferences.userId}, ${this.sql.json(document)}, ${preferences.updatedAt})
      ON CONFLICT (user_id) DO UPDATE
      SET
        document = EXCLUDED.document,
        updated_at = EXCLUDED.updated_at
    `;
  }
}

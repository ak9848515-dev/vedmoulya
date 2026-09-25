// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Postgres Provider Preferences Store
// EPIC-012A — owner-scoped provider preferences durability
//
// Verifies DDL, JSONB document <-> entity mapping and the null case WITHOUT a
// live database: `postgres` is mocked with a scripted template-tag function
// (same pattern as PostgresProviderRepository.test.ts), so the store's whole
// surface is exercised in CI and local runs.
//
// REGRESSION CONTEXT: provider preferences used to live ONLY in an in-memory
// map, so an enabled/preferred provider silently reverted to disabled on every
// restart. This store is what makes that state durable outside dev/test.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import type postgres from 'postgres';
import { PostgresProviderPreferencesStore } from '../PostgresProviderPreferencesStore.js';
import type { ProviderPreferences } from '../../types/preferences-types.js';

function makeFakeSql(results: Array<() => unknown>): postgres.Sql {
  let idx = 0;
  const next = (): Promise<unknown> => {
    const r = results[idx]();
    idx += 1;
    return Promise.resolve(r);
  };
  const fake = vi.fn(() => next()) as unknown as postgres.Sql & {
    json: (value: unknown) => unknown;
  };
  // postgres.js exposes sql.json() as its explicit jsonb serializer, and the
  // store uses it so the column receives a jsonb OBJECT rather than a jsonb
  // STRING. The double mirrors that surface instead of omitting it.
  fake.json = (value: unknown): unknown => value;
  return fake as unknown as postgres.Sql;
}

function prefs(overrides: Partial<ProviderPreferences> = {}): ProviderPreferences {
  return {
    userId: 'user-1',
    disabledProviderIds: ['anthropic'],
    preferredProviderId: 'ollama',
    preferredModelId: 'qwen2.5-coder:7b-instruct',
    budgetPolicy: 'ask_before_paid',
    budgets: { monthlyTokenBudget: 250000 },
    updatedAt: '2026-09-24T00:00:00.000Z',
    ...overrides,
  } as ProviderPreferences;
}

describe('PostgresProviderPreferencesStore', () => {
  it('creates its table idempotently', async () => {
    const sql = makeFakeSql([() => undefined]);
    await new PostgresProviderPreferencesStore(sql).ensureTable();
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it('returns null when the owner has no stored preferences', async () => {
    const sql = makeFakeSql([() => []]);
    const store = new PostgresProviderPreferencesStore(sql);
    await expect(store.get('user-1')).resolves.toBeNull();
  });

  it('maps a stored document back to a preferences record (owner from the row)', async () => {
    const document = prefs({ userId: 'stale-id-from-document' });
    const sql = makeFakeSql([
      () => [{ user_id: 'user-1', document, updated_at: '2026-09-24T12:00:00.000Z' }],
    ]);
    const store = new PostgresProviderPreferencesStore(sql);

    const loaded = await store.get('user-1');

    expect(loaded).not.toBeNull();
    // The row's owner wins over whatever the document claims.
    expect(loaded?.userId).toBe('user-1');
    expect(loaded?.preferredProviderId).toBe('ollama');
    expect(loaded?.preferredModelId).toBe('qwen2.5-coder:7b-instruct');
    expect(loaded?.disabledProviderIds).toEqual(['anthropic']);
    expect(loaded?.updatedAt).toBe('2026-09-24T12:00:00.000Z');
  });

  it('re-creates the mutable collections instead of aliasing the stored document', async () => {
    const document = prefs();
    const sql = makeFakeSql([() => [{ user_id: 'user-1', document, updated_at: new Date() }]]);
    const store = new PostgresProviderPreferencesStore(sql);

    const loaded = await store.get('user-1');
    expect(loaded?.disabledProviderIds).not.toBe(document.disabledProviderIds);
    expect(loaded?.budgets).not.toBe(document.budgets);

    loaded?.disabledProviderIds.push('openai');
    expect(document.disabledProviderIds).toEqual(['anthropic']);
  });

  it('saves a preferences record', async () => {
    const sql = makeFakeSql([() => undefined]);
    const store = new PostgresProviderPreferencesStore(sql);

    await expect(store.save(prefs())).resolves.toBeUndefined();
    expect(sql).toHaveBeenCalledTimes(1);
  });

  // REGRESSION: the write path used to bind `JSON.stringify(prefs)::jsonb`, which
  // stores a jsonb STRING primitive (`jsonb_typeof` = 'string'). Reading that back
  // spread the string's character indices, so `[...document.disabledProviderIds]`
  // threw "not iterable" and a provider connect failed with PERSISTENCE_FAILED.
  // The document must be handed to postgres as a jsonb OBJECT.
  it('binds the document through sql.json so the column receives a jsonb object', async () => {
    const captured: unknown[] = [];
    const sql = makeFakeSql([() => undefined]) as unknown as postgres.Sql & {
      json: (value: unknown) => unknown;
    };
    sql.json = (value: unknown): unknown => {
      captured.push(value);
      return value;
    };

    const saved = prefs();
    await new PostgresProviderPreferencesStore(sql).save(saved);

    expect(captured).toHaveLength(1);
    // An object — never a pre-stringified JSON string.
    expect(typeof captured[0]).toBe('object');
    expect(captured[0]).not.toBeInstanceOf(String);
    expect(captured[0]).toMatchObject({
      userId: 'user-1',
      preferredProviderId: 'ollama',
      disabledProviderIds: ['anthropic'],
    });
  });

  // REGRESSION: a stored document need not carry every optional field. An earlier
  // write path double-encoded the value into a jsonb STRING, and a document that
  // omits `disabledProviderIds`/`budgets` used to make get() throw
  // "document.disabledProviderIds is not iterable" — which surfaced as a failed
  // provider connect (PERSISTENCE_FAILED). Both shapes must normalize, never throw.
  it('normalizes a partial document that omits optional collections', async () => {
    const sql = makeFakeSql([
      () => [
        {
          user_id: 'user-1',
          document: { userId: 'user-1', updatedAt: '2026-09-24T00:00:00.000Z' },
          updated_at: '2026-09-24T12:00:00.000Z',
        },
      ],
    ]);
    const loaded = await new PostgresProviderPreferencesStore(sql).get('user-1');
    expect(loaded?.disabledProviderIds).toEqual([]);
    expect(loaded?.budgets).toEqual({});
  });

  it('normalizes a legacy double-encoded jsonb STRING document', async () => {
    const legacy = JSON.stringify(prefs());
    const sql = makeFakeSql([
      () => [{ user_id: 'user-1', document: legacy, updated_at: '2026-09-24T12:00:00.000Z' }],
    ]);
    const loaded = await new PostgresProviderPreferencesStore(sql).get('user-1');
    expect(loaded?.preferredProviderId).toBe('ollama');
    expect(loaded?.disabledProviderIds).toEqual(['anthropic']);
  });
});

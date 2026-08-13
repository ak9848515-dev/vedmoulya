// ──────────────────────────────────────────────────────────────────
// VedMoulya — PostgresDiscoveryStore (SPRINT-022) hermetic tests
// A FUNCTIONAL postgres.js stub (in-memory items + user-state tables,
// identifier/array fragments rendered like the real client) verifies
// the async DiscoveryStore port end to end without a database:
// idempotent addItems (no duplicates after restart), bounded retention,
// owner-scoped user state (IDOR-safe) and read/action merging.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import type { DiscoveryItem } from '../../types/discovery-types.js';
import { PostgresDiscoveryStore } from '../PostgresDiscoveryStore.js';

interface FakeHandle {
  sql: postgres.Sql;
  calls: string[];
}

/** Functional postgres.js-shaped stub simulating the two tables. */
function createFakeSql(): FakeHandle {
  const items = new Map<string, { item: DiscoveryItem; seq: number }>();
  const states = new Map<string, { read: boolean; action: string }>();
  const calls: string[] = [];
  let seq = 0;

  // Identifier fragment marker — sql('name') returns this SYNCHRONOUSLY,
  // exactly like the real client (fragments are wrappers, not values).
  const ident = (name: string): { __fragment: 'ident'; name: string } => ({
    __fragment: 'ident',
    name,
  });
  const isIdent = (value: unknown): value is { __fragment: 'ident'; name: string } =>
    typeof value === 'object' &&
    value !== null &&
    (value as { __fragment?: string }).__fragment === 'ident';

  const run = (first: unknown, ...values: unknown[]): unknown => {
    // Identifier fragment: sql('table_name') — sync wrapper.
    if (typeof first === 'string') return ident(first);
    // Array fragment: sql([...ids]) — sync wrapper rendered as placeholders
    // with the ids bound as parameters (exactly like the real client).
    // NOTE: TemplateStringsArray is ALSO an Array — exclude tagged templates
    // (they carry the `raw` property) so queries hit the render loop below.
    if (Array.isArray(first) && !('raw' in first)) return first;

    const strings = first as TemplateStringsArray;
    let text = strings[0];
    const params: unknown[] = [];
    for (let i = 0; i < values.length; i += 1) {
      const value = values[i];
      if (isIdent(value)) {
        text += value.name + strings[i + 1]; // identifier fragment spliced into SQL
      } else if (Array.isArray(value)) {
        const ids = value as string[];
        text += `(${ids.map(() => '?').join(', ')})${strings[i + 1] ?? ''}`;
        params.push(...ids);
      } else {
        // Any other value (strings included) is a BOUND parameter.
        text += `? ${strings[i + 1] ?? ''}`;
        params.push(value);
      }
    }
    calls.push(text);

    if (/CREATE TABLE/i.test(text)) return Promise.resolve({ count: 1 });

    if (/INSERT INTO ai_world_discovery_items/i.test(text)) {
      const [id, doc] = params as [string, unknown];
      const added = !items.has(id);
      if (added) {
        // The store binds via sql.json() — the fake returns the raw object
        // (see the jsonb double-encoding regression note: real postgres.js
        // serializes it once for OID 3802).
        const item =
          typeof doc === 'string' ? (JSON.parse(doc) as DiscoveryItem) : (doc as DiscoveryItem);
        items.set(id, { item, seq: ++seq });
      }
      return Promise.resolve({ count: added ? 1 : 0 });
    }

    if (/SELECT item_id, item::text AS item/i.test(text) && /WHERE item_id/i.test(text)) {
      const [id] = params as [string];
      const found = items.get(id);
      return Promise.resolve(
        found ? [{ item_id: found.item.id, item: JSON.stringify(found.item) }] : [],
      );
    }

    if (/SELECT item_id, item::text AS item/i.test(text)) {
      const rows = [...items.values()]
        .sort((a, b) => a.seq - b.seq)
        .map(({ item }) => ({ item_id: item.id, item: JSON.stringify(item) }));
      return Promise.resolve(rows);
    }

    // NOTE: the retention DELETE contains a nested `SELECT item_id FROM …`
    // substring — it must be matched BEFORE the SELECT handlers below.
    if (/DELETE FROM ai_world_discovery_items/i.test(text)) {
      const [offset] = params as [number];
      const sorted = [...items.values()].sort((a, b) => a.seq - b.seq);
      const excess = sorted.slice(0, Math.max(0, sorted.length - offset));
      for (const evicted of excess) items.delete(evicted.item.id);
      return Promise.resolve({ count: excess.length });
    }

    if (/SELECT item_id FROM ai_world_discovery_items/i.test(text)) {
      const ids = params as string[];
      return Promise.resolve(ids.filter((id) => items.has(id)).map((id) => ({ item_id: id })));
    }

    if (/SELECT user_id, item_id, state::text/i.test(text)) {
      const [userId, itemId] = params as [string, string];
      const state = states.get(`${userId}:${itemId}`);
      return Promise.resolve(
        state ? [{ user_id: userId, item_id: itemId, state: JSON.stringify(state) }] : [],
      );
    }

    if (/INSERT INTO ai_world_discovery_user_state/i.test(text)) {
      const [userId, itemId, doc] = params as [string, string, unknown];
      const state =
        typeof doc === 'string'
          ? (JSON.parse(doc) as { read: boolean; action: string })
          : (doc as { read: boolean; action: string });
      states.set(`${userId}:${itemId}`, state);
      return Promise.resolve({ count: 1 });
    }

    return Promise.resolve({ count: 1 });
  };

  // The store binds JSON documents via sql.json() — the fake returns the raw
  // value (the real driver wraps it in a Parameter for OID 3802). It REJECTS
  // strings to mirror the real driver's failure mode (postgres.js's json()
  // would stringify a pre-stringified value a second time — the exact
  // double-encoding regression this sprint fixed — so it must fail hermetic
  // tests, not silently normalize).
  const sql = Object.assign(run, {
    json: (value: unknown): unknown => {
      if (typeof value === 'string') {
        throw new Error('double-encoding regression: sql.json() received pre-stringified JSON');
      }
      return value;
    },
  }) as unknown as postgres.Sql;
  return { sql, calls };
}

function item(id: string, category = 'model'): DiscoveryItem {
  return {
    id,
    category,
    title: `Item ${id}`,
    description: 'desc',
    provider: 'provider-x',
    url: 'https://example.com',
    evidence: [{ claim: 'x', source: 'catalog', confidence: 'KNOWN' }],
    discoveredAt: '2026-01-01T00:00:00.000Z',
  } as DiscoveryItem;
}

describe('PostgresDiscoveryStore', () => {
  it('addItems is idempotent by stable item id — restart never duplicates', async () => {
    const fake = createFakeSql();
    const store = new PostgresDiscoveryStore(fake.sql);
    expect(await store.addItems([item('a'), item('b')])).toBe(2);
    expect(await store.addItems([item('a'), item('c')])).toBe(1); // 'a' deduped
    const items = await store.listItems();
    expect(items.map((i) => i.id).sort()).toEqual(['a', 'b', 'c']);
    expect(await store.getItem('a')).toMatchObject({ id: 'a' });
  });

  it('enforces bounded retention (FIFO by discovery order)', async () => {
    const fake = createFakeSql();
    const store = new PostgresDiscoveryStore(fake.sql, { maxStoredItems: 2 });
    await store.addItems([item('a'), item('b'), item('c')]);
    const items = await store.listItems();
    expect(items.map((i) => i.id)).toEqual(['b', 'c']); // oldest 'a' evicted
  });

  it('user state defaults to unread/none and is owner-isolated', async () => {
    const fake = createFakeSql();
    const store = new PostgresDiscoveryStore(fake.sql);
    expect(await store.getUserState('u1', 'a')).toEqual({ read: false, action: 'none' });
    await store.markRead('u1', 'a');
    expect(await store.getUserState('u1', 'a')).toEqual({ read: true, action: 'none' });
    // Another user's state is untouched and invisible.
    expect(await store.getUserState('u2', 'a')).toEqual({ read: false, action: 'none' });
  });

  it('markRead/setAction merge — never clobber the other field', async () => {
    const fake = createFakeSql();
    const store = new PostgresDiscoveryStore(fake.sql);
    await store.setAction('u1', 'a', 'watch');
    await store.markRead('u1', 'a');
    expect(await store.getUserState('u1', 'a')).toEqual({ read: true, action: 'watch' });
    await store.markRead('u1', 'a'); // idempotent
    expect(await store.getUserState('u1', 'a')).toEqual({ read: true, action: 'watch' });
  });

  it('every write is parameterized (values never interpolated into SQL)', async () => {
    const fake = createFakeSql();
    const store = new PostgresDiscoveryStore(fake.sql);
    await store.addItems([item("x'; DROP TABLE items;--")]);
    // The adversarial id travels as a bound value — it never appears in the
    // rendered SQL text of any query.
    expect(fake.calls.some((c) => c.includes('DROP TABLE'))).toBe(false);
  });
});

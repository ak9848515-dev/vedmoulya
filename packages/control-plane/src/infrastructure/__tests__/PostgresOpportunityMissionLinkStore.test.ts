// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Control Plane · PostgresOpportunityMissionLinkStore (SPRINT-031)
//
// Hermetic tests over a STATEFUL postgres.js fake. This store is the durable
// owner-scoped Opportunity↔Mission association: idempotent by (owner, key),
// with an atomic claim/complete handshake. The fake keeps a real (owner, key)
// → doc map and implements the three statements the store issues:
//
//   INSERT … ON CONFLICT (owner, key) DO NOTHING RETURNING doc
//   SELECT … FOR UPDATE
//   UPDATE … WHERE owner = … AND key = … AND doc->>'missionId' = … RETURNING doc
//
// so the tests exercise the store's own branching (insert-won vs conflict
// recovery; update-won vs fallback) rather than a scripted call order. The
// driver normally returns a JSONB-decoded object; the store also tolerates a
// JSON *string* legacy row, which is covered explicitly.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi } from 'vitest';
import type postgres from 'postgres';
import type {
  OpportunityMissionAssociation,
  OpportunityMissionLaunchIntent,
} from '../../types/control-types.js';
import { PostgresOpportunityMissionLinkStore } from '../PostgresControlStores.js';

interface FakeRow {
  owner: string;
  key: string;
  doc: OpportunityMissionLaunchIntent | string;
}

interface FakeSql {
  sql: postgres.Sql;
  rows: Map<string, FakeRow>;
  /** Seed/override a row exactly as it would be stored (object or legacy string). */
  seed(owner: string, key: string, doc: OpportunityMissionLaunchIntent | string): void;
  /** Make the next UPDATE affect no rows (simulates a lost race). */
  loseNextUpdate(): void;
  /** Make the next INSERT no-op even though no row is visible to SELECT. */
  conflictWithoutRow(): void;
  calls: { insert: number; select: number; update: number };
}

const rowKey = (owner: string, key: string): string => `${owner}\u0000${key}`;

function makeFakeSql(): FakeSql {
  const rows = new Map<string, FakeRow>();
  const calls = { insert: 0, select: 0, update: 0 };
  let loseUpdate = false;
  let fakeConflict = false;

  const route = (first: unknown, ...values: unknown[]): unknown => {
    // postgres.js overloads `sql`: as an identifier builder `sql(name)` it
    // returns a synchronous marker inlined into the next statement; as a tag
    // `sql`...`` it returns a Promise of rows. Distinguish on the first arg so
    // the marker never leaks into a statement's bound values.
    if (!Array.isArray(first)) return { __identifier: String(first) };
    const text = (first as string[]).join('?');
    const isMarker = (v: unknown): boolean =>
      typeof v === 'object' && v !== null && '__identifier' in v;
    // postgres.js inlines identifiers/values as separate template arguments, so
    // positional indexing is brittle (the store passes `sql(table)` first, then
    // owner, key, doc). Classify by SHAPE instead: the document is the only
    // object; the two strings that are not the table name are owner + key.
    const isString = (v: unknown): v is string => typeof v === 'string';
    const identifiers = values.filter(isMarker);
    // Bounded strings in order are: [table?, owner, key, (missionId?). The table
    // name is passed as an identifier marker, so the FIRST two plain strings are
    // owner and key regardless of trailing bound parameters (e.g. missionId).
    const bound = values.filter(isString);
    const owner = bound[0] ?? '';
    const key = bound[1] ?? '';
    void identifiers;
    // The document is the only plain object: exclude identifier markers.
    const doc = values.find(
      (v): v is object => typeof v === 'object' && v !== null && !isMarker(v),
    );
    const rk = rowKey(owner, key);

    if (/INSERT INTO/i.test(text)) {
      calls.insert += 1;
      if (fakeConflict) {
        fakeConflict = false;
        return Promise.resolve([]); // ON CONFLICT DO NOTHING (no row visible)
      }
      if (rows.has(rk)) return Promise.resolve([]); // ON CONFLICT DO NOTHING
      const inserted = doc as OpportunityMissionLaunchIntent;
      rows.set(rk, { owner, key, doc: inserted });
      return Promise.resolve([{ doc: inserted }]);
    }
    if (/FOR UPDATE/i.test(text)) {
      calls.select += 1;
      const row = rows.get(rk);
      return Promise.resolve(row ? [{ doc: row.doc }] : []);
    }
    if (/UPDATE/i.test(text)) {
      calls.update += 1;
      const row = rows.get(rk);
      if (!row || loseUpdate) {
        loseUpdate = false;
        return Promise.resolve([]);
      }
      // Honor the store's `AND doc->>'missionId' = ${link.missionId}` predicate:
      // the bound missionId is the string AFTER owner/key.
      const missionId = bound[2];
      const rowDoc = row.doc as OpportunityMissionAssociation | string;
      const rowMissionId =
        typeof rowDoc === 'string'
          ? (JSON.parse(rowDoc) as OpportunityMissionAssociation).missionId
          : rowDoc.missionId;
      if (missionId !== undefined && rowMissionId !== missionId) return Promise.resolve([]);
      const updated = { ...(doc as OpportunityMissionAssociation), status: 'LINKED' as const };
      rows.set(rk, { owner, key, doc: updated });
      return Promise.resolve([{ doc: updated }]);
    }
    return Promise.resolve([]);
  };

  const sql = vi.fn(route) as unknown as postgres.Sql;
  sql.unsafe = vi.fn(route) as never;
  sql.json = ((value: unknown): unknown => value) as never;
  return {
    sql,
    rows,
    calls,
    seed(owner, key, doc) {
      rows.set(rowKey(owner, key), { owner, key, doc });
    },
    loseNextUpdate() {
      loseUpdate = true;
    },
    conflictWithoutRow() {
      fakeConflict = true;
    },
  };
}

function link(
  overrides: Partial<OpportunityMissionAssociation> = {},
): OpportunityMissionAssociation {
  return {
    userId: 'u1',
    opportunityId: 'opp-1',
    missionId: 'm-1',
    createdAt: '2026-08-14T08:00:00.000Z',
    ...overrides,
  };
}

describe('PostgresOpportunityMissionLinkStore — save', () => {
  it('persists once and is idempotent: a second save returns the EXISTING link', () => {
    const fake = makeFakeSql();
    const store = new PostgresOpportunityMissionLinkStore(fake.sql);
    const first = store.save(link({ missionId: 'm-1' }));
    // The concrete save materializes the association with status LINKED.
    expect(first).toMatchObject({ status: 'LINKED', missionId: 'm-1' });
    // A different Mission ID on the same (user, opportunity) key must NOT
    // create a second association — first writer wins.
    const second = store.save(link({ missionId: 'm-2' }));
    expect(second.missionId).toBe('m-1');
    expect(store.list('u1')).toHaveLength(1);
  });
});

describe('PostgresOpportunityMissionLinkStore — claimLaunch', () => {
  it('returns the inserted PENDING intent when the INSERT wins', async () => {
    const fake = makeFakeSql();
    const s = new PostgresOpportunityMissionLinkStore(fake.sql);
    const claimed = await s.claimLaunch(link());
    expect(claimed.status).toBe('PENDING');
    expect(claimed.missionId).toBe('m-1');
    // The mirror is now authoritative for subsequent synchronous reads.
    expect(s.getLaunch('u1', 'opp-1')?.status).toBe('PENDING');
  });

  it('recovers the EXISTING intent on conflict (INSERT no-op → SELECT FOR UPDATE)', async () => {
    const fake = makeFakeSql();
    fake.seed('u1', 'opp-1', { ...link({ missionId: 'm-7' }), status: 'PENDING' });
    const s = new PostgresOpportunityMissionLinkStore(fake.sql);
    const claimed = await s.claimLaunch(link({ missionId: 'm-8' }));
    expect(claimed.missionId).toBe('m-7');
    expect(claimed.status).toBe('PENDING');
    expect(fake.calls.select).toBe(1);
  });

  it('normalizes a legacy LINKED-shaped row (JSON string, no status) on conflict', async () => {
    // A pre-status record persisted by an older writer: a JSON string with no
    // `status` field. The store must decode it and mark it LINKED.
    const fake = makeFakeSql();
    fake.seed('u1', 'opp-1', JSON.stringify(link({ missionId: 'm-legacy' })));
    const s = new PostgresOpportunityMissionLinkStore(fake.sql);
    const claimed = await s.claimLaunch(link({ missionId: 'm-new' }));
    expect(claimed.missionId).toBe('m-legacy');
    expect(claimed.status).toBe('LINKED');
  });

  it('fails closed when no intent can be read after the conflict', async () => {
    // The INSERT reports a conflict (ON CONFLICT DO NOTHING, no row returned)
    // yet the recovery SELECT yields nothing — the intent vanished, so the
    // store must refuse rather than invent a claim.
    const fake = makeFakeSql();
    fake.conflictWithoutRow();
    const s = new PostgresOpportunityMissionLinkStore(fake.sql);
    await expect(s.claimLaunch(link())).rejects.toThrow(
      'Launch intent could not be read after claim.',
    );
  });
});

describe('PostgresOpportunityMissionLinkStore — completeLaunch', () => {
  it('returns the updated row when the mission IDs match (UPDATE ... RETURNING)', async () => {
    const fake = makeFakeSql();
    fake.seed('u1', 'opp-1', { ...link(), status: 'PENDING' });
    const s = new PostgresOpportunityMissionLinkStore(fake.sql);
    const result = await s.completeLaunch(link());
    expect(result).toMatchObject({ status: 'LINKED', missionId: 'm-1' });
    expect(s.getByOpportunity('u1', 'opp-1')?.missionId).toBe('m-1');
  });

  it('returns the mirror record when the UPDATE matched nothing but state already agrees', async () => {
    const fake = makeFakeSql();
    fake.seed('u1', 'opp-1', { ...link(), status: 'PENDING' });
    const s = new PostgresOpportunityMissionLinkStore(fake.sql);
    await s.completeLaunch(link()); // UPDATE wins → mirror now LINKED
    fake.loseNextUpdate(); // a subsequent UPDATE affects no rows
    const result = await s.completeLaunch(link());
    expect(result).toMatchObject({ status: 'LINKED', missionId: 'm-1' });
  });

  it('fails closed when no matching intent exists (missing or Mission-ID mismatch)', async () => {
    const fake = makeFakeSql();
    // A PENDING intent exists at the key, but under a DIFFERENT mission id, so
    // the UPDATE matches nothing and the mirror has no agreeing record.
    fake.seed('u1', 'opp-1', { ...link({ missionId: 'm-2' }), status: 'PENDING' });
    const s = new PostgresOpportunityMissionLinkStore(fake.sql);
    await expect(s.completeLaunch(link({ missionId: 'm-1' }))).rejects.toThrow(
      'Launch intent is missing or Mission ID does not match.',
    );
  });
});

describe('PostgresOpportunityMissionLinkStore — reads', () => {
  it('getLaunch surfaces PENDING intents but getByOpportunity only LINKED ones', async () => {
    const fake = makeFakeSql();
    const s = new PostgresOpportunityMissionLinkStore(fake.sql);
    await s.claimLaunch(link());
    expect(s.getLaunch('u1', 'opp-1')?.status).toBe('PENDING');
    expect(s.getByOpportunity('u1', 'opp-1')).toBeUndefined();
    expect(s.getLaunch('u1', 'missing')).toBeUndefined();
  });

  it('getByMission and list are owner-scoped and only return LINKED associations', async () => {
    const fake = makeFakeSql();
    const s = new PostgresOpportunityMissionLinkStore(fake.sql);
    await s.claimLaunch(link({ opportunityId: 'opp-1', missionId: 'm-1' }));
    await s.claimLaunch(
      link({ opportunityId: 'opp-2', missionId: 'm-2', createdAt: '2026-08-14T09:00:00.000Z' }),
    );
    await s.completeLaunch(link({ opportunityId: 'opp-1', missionId: 'm-1' }));

    expect(s.getByMission('u1', 'm-1')?.opportunityId).toBe('opp-1');
    expect(s.getByMission('u1', 'm-2')).toBeUndefined(); // still PENDING
    expect(s.getByMission('u2', 'm-1')).toBeUndefined(); // IDOR
    expect(s.list('u1').map((l) => l.opportunityId)).toEqual(['opp-1']);
    expect(s.list('u2')).toEqual([]);
  });

  it('list orders LINKED associations newest-createdAt first', async () => {
    const fake = makeFakeSql();
    const s = new PostgresOpportunityMissionLinkStore(fake.sql);
    await s.claimLaunch(
      link({ opportunityId: 'opp-old', missionId: 'm-old', createdAt: '2026-08-14T07:00:00.000Z' }),
    );
    await s.claimLaunch(
      link({ opportunityId: 'opp-new', missionId: 'm-new', createdAt: '2026-08-14T10:00:00.000Z' }),
    );
    await s.completeLaunch(
      link({ opportunityId: 'opp-old', missionId: 'm-old', createdAt: '2026-08-14T07:00:00.000Z' }),
    );
    await s.completeLaunch(
      link({ opportunityId: 'opp-new', missionId: 'm-new', createdAt: '2026-08-14T10:00:00.000Z' }),
    );

    expect(s.list('u1').map((l) => l.opportunityId)).toEqual(['opp-new', 'opp-old']);
  });
});

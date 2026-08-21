// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Audit Log Store tests (SPRINT-027 R-2)
// Verifies the durable owner-scoped gateway audit trail:
//   • in-memory backend (dev/test) + Postgres write-through backend;
//   • owner scoping (a foreign user can never read another's entries);
//   • bounded retention; middleware wiring (setAuditStore → createRequestAudit
//     → getAuditLog) without changing the router-facing API.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import {
  InMemoryAuditLogStore,
  PostgresAuditLogStore,
  AUDIT_ENTRIES_PER_OWNER,
  type AuditEntry,
} from '../infrastructure/AuditLogStore.js';
import {
  logAuditEvent,
  getAuditLog,
  createRequestAudit,
  setAuditStore,
} from '../middleware/audit.js';

function createFakeSql(): postgres.Sql {
  const run = (first: unknown, ..._values: unknown[]): unknown => {
    const text = typeof first === 'string' ? first : (first as TemplateStringsArray).join('?');
    if (/^\s*SELECT/i.test(text)) return Promise.resolve([]);
    return Promise.resolve({ count: 1 });
  };
  return Object.assign(run, {
    json: (value: unknown): unknown => {
      if (typeof value === 'string') {
        throw new Error('double-encoding regression: sql.json() received pre-stringified JSON');
      }
      return value;
    },
  }) as unknown as postgres.Sql;
}

function entry(userId: string, path: string, at = '2026-08-16T09:00:00.000Z'): AuditEntry {
  return {
    id: `audit_${userId}_${path}`,
    timestamp: at,
    type: 'api.request',
    userId,
    path,
    duration: 5,
    success: true,
  };
}

describe('InMemoryAuditLogStore', () => {
  it('records and lists entries newest-first, owner-filtered', () => {
    const store = new InMemoryAuditLogStore();
    store.record(entry('alice', '/a', '2026-08-16T09:00:00.000Z'));
    store.record(entry('alice', '/b', '2026-08-16T09:00:01.000Z'));
    store.record(entry('bob', '/c', '2026-08-16T09:00:02.000Z'));
    expect(store.list('alice').map((e) => e.path)).toEqual(['/b', '/a']);
    expect(store.list()).toHaveLength(3);
    // Owner scoping: bob cannot see alice's entries.
    expect(store.list('bob').every((e) => e.userId === 'bob')).toBe(true);
  });

  it('bounds memory (never an unbounded sink)', () => {
    const store = new InMemoryAuditLogStore();
    for (let i = 0; i < 10_500; i += 1) {
      store.record(entry('alice', `/x${i}`));
    }
    expect(store.list().length).toBeLessThanOrEqual(10_000);
  });
});

describe('PostgresAuditLogStore (write-through, owner-scoped, bounded)', () => {
  it('records to the mirror and lists owner-filtered, newest-first', () => {
    const store = new PostgresAuditLogStore(createFakeSql(), 'gateway_audit_logs');
    store.record(entry('alice', '/a', '2026-08-16T09:00:00.000Z'));
    store.record(entry('alice', '/b', '2026-08-16T09:00:01.000Z'));
    store.record(entry('bob', '/c', '2026-08-16T09:00:02.000Z'));
    expect(store.list('alice').map((e) => e.path)).toEqual(['/b', '/a']);
    expect(store.list('bob')).toHaveLength(1);
  });

  it('evicts the oldest entries beyond the per-owner retention bound', () => {
    const store = new PostgresAuditLogStore(createFakeSql(), 'gateway_audit_logs');
    for (let i = 0; i < AUDIT_ENTRIES_PER_OWNER + 20; i += 1) {
      store.record(
        entry('alice', `/x${i}`, `2026-08-16T09:00:${String(i % 60).padStart(2, '0')}.000Z`),
      );
    }
    expect(store.list('alice').length).toBeLessThanOrEqual(AUDIT_ENTRIES_PER_OWNER);
  });
});

describe('middleware wiring (unchanged router-facing API)', () => {
  it('createRequestAudit → getAuditLog through an injected Postgres store', () => {
    setAuditStore(new PostgresAuditLogStore(createFakeSql()));
    createRequestAudit('auth.login', 'alice', '/login', 3, true);
    createRequestAudit('api.error', 'alice', '/x', 1, false, 'boom');
    const log = getAuditLog('alice');
    expect(log).toHaveLength(2);
    expect(log[0]?.success).toBe(false);
    expect(log[0]?.error).toBe('boom');
  });

  it('logAuditEvent keeps the same entry contract', () => {
    setAuditStore(new InMemoryAuditLogStore());
    logAuditEvent(entry('alice', '/p'));
    expect(getAuditLog('alice')).toHaveLength(1);
    // Owner scoping across the middleware API too.
    expect(getAuditLog('bob')).toHaveLength(0);
  });
});

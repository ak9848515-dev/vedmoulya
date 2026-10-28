// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — TEST: PostgresWorkspaceLeaseStore retry logic
//--------------------------------------------------------------------
// Tests the bounded retry logic for lease acquire and renew operations,
// ensuring transient PostgreSQL contention is handled correctly and that
// renewal stops when ownership is lost or the lease has expired.
//
// The store is exercised UNCHANGED over the FINAL-04 file-backed SQL driver
// (see file-backed-sql-driver.ts): the statements are the ones postgres.js
// really receives, and every commit is on disk before success is reported. A
// fresh store over the same file is therefore an independent "process" view of
// the lease — which is exactly what these assertions are about.
//--------------------------------------------------------------------

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, it, expect } from 'vitest';
import {
  PostgresWorkspaceLeaseStore,
  WORKSPACE_LEASE_OWNER,
} from '../persistence/PostgresWorkspaceLeaseStore.js';
import { createFileBackedSql } from './file-backed-sql-driver.js';

const START_MS = Date.parse('2026-10-27T09:00:00.000Z');
const TTL_MS = 60_000;
const TEMPORARY_DIRS: string[] = [];

afterAll(() => {
  for (const dir of TEMPORARY_DIRS) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // temporary evidence files are disposable
    }
  }
});

function temporaryDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vedmoulya-lease-retry-'));
  TEMPORARY_DIRS.push(dir);
  return path.join(dir, 'workspace-leases.json');
}

/**
 * A store over a SPECIFIC durable file. Calling this twice for one file yields
 * two independent views — the second only sees what the first COMMITTED.
 */
function storeOver(filePath: string): PostgresWorkspaceLeaseStore {
  return new PostgresWorkspaceLeaseStore(createFileBackedSql(filePath).sql);
}

function request(token: string, nowMs = START_MS, expiresAtMs = START_MS + TTL_MS) {
  return {
    missionId: 'test-mission',
    objectiveId: 'test-objective',
    token,
    nowMs,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

describe('PostgresWorkspaceLeaseStore · acquire with bounded retries', () => {
  it('acquires a free workspace and reports the acquisition durably', async () => {
    const file = temporaryDbPath();
    const store = storeOver(file);

    expect(await store.acquire('/test-workspace', request('lease_first'))).toBe(true);
    // A completely fresh view (new driver, fresh mirror) reads the committed claim.
    expect(await storeOver(file).held('/test-workspace', 'lease_first')).toBe(true);
  });

  it('returns false while a LIVE claim is held and never retries past it', async () => {
    const file = temporaryDbPath();
    const store = storeOver(file);
    expect(await store.acquire('/test-workspace', request('lease_first'))).toBe(true);

    // A second attempt inside the live window is refused — not retried into a win.
    expect(await store.acquire('/test-workspace', request('lease_second'))).toBe(false);
    // The workspace is still the first attempt's: the refused claim owns nothing.
    expect(await store.held('/test-workspace', 'lease_first')).toBe(true);
  });

  it('re-acquires the SAME token idempotently (a retried acquisition is not a loss)', async () => {
    const file = temporaryDbPath();
    const store = storeOver(file);
    expect(await store.acquire('/test-workspace', request('lease_first'))).toBe(true);

    // This is the retry case that used to be reported as a failed acquisition:
    // the guarded upsert matched the row but returned no row, and "no row" was
    // treated as "someone else holds it".
    expect(await store.acquire('/test-workspace', request('lease_first'))).toBe(true);
  });

  it('reclaims an EXPIRED claim owned by a dead candidate', async () => {
    const file = temporaryDbPath();
    const store = storeOver(file);
    expect(
      await store.acquire('/test-workspace', request('lease_dead', START_MS, START_MS + 1_000)),
    ).toBe(true);

    // Still inside the dead candidate's window: refused.
    expect(await store.acquire('/test-workspace', request('lease_next', START_MS + 500))).toBe(
      false,
    );
    // Past it: the expiry guard hands the workspace over.
    expect(await store.acquire('/test-workspace', request('lease_next', START_MS + 2_000))).toBe(
      true,
    );
    expect(await store.held('/test-workspace', 'lease_next')).toBe(true);
    // The dead candidate's claim is gone: the new owner can renew freely.
    expect(
      await store.renew('/test-workspace', {
        token: 'lease_next',
        nowMs: START_MS + 3_000,
        expiresAt: new Date(START_MS + 90_000).toISOString(),
      }),
    ).toBe(true);
  });
});

describe('PostgresWorkspaceLeaseStore · renew with bounded retries', () => {
  it('stops retrying when token no longer matches', async () => {
    const file = temporaryDbPath();
    const store = storeOver(file);
    expect(await store.acquire('/test-workspace', request('lease_first'))).toBe(true);

    // Same workspace, wrong token: no renewal, and no loop that could ever win.
    expect(
      await store.renew('/test-workspace', {
        token: 'lease_other',
        nowMs: START_MS + 1_000,
        expiresAt: new Date(START_MS + 61_000).toISOString(),
      }),
    ).toBe(false);
    // The holder's window is untouched by the failed attempt.
    expect(await storeOver(file).held('/test-workspace', 'lease_first')).toBe(true);
  });

  it('returns false after max retries when lease has expired', async () => {
    const file = temporaryDbPath();
    const store = storeOver(file);
    expect(
      await store.acquire('/test-workspace', request('lease_first', START_MS, START_MS + 1_000)),
    ).toBe(true);

    // Past the TTL the row still carries the token, but renewal is refused.
    expect(
      await store.renew('/test-workspace', {
        token: 'lease_first',
        nowMs: START_MS + 120_000, // past the TTL
        expiresAt: new Date(START_MS + 180_000).toISOString(),
      }),
    ).toBe(false);

    // Durable proof: the expiration was NOT extended by the refused renewal.
    const raw = createFileBackedSql(file).committed('mission_controller_missions');
    const row = raw.find((candidate) => candidate.owner === WORKSPACE_LEASE_OWNER);
    expect((row?.doc as { expiresAt?: string } | undefined)?.expiresAt).toBe(
      new Date(START_MS + 1_000).toISOString(),
    );
  });

  it('extends a live claim for the current owner only', async () => {
    const file = temporaryDbPath();
    const store = storeOver(file);
    expect(await store.acquire('/test-workspace', request('lease_first'))).toBe(true);

    expect(
      await store.renew('/test-workspace', {
        token: 'lease_first',
        nowMs: START_MS + 1_000,
        expiresAt: new Date(START_MS + 120_000).toISOString(),
      }),
    ).toBe(true);

    const durable = createFileBackedSql(file)
      .committed('mission_controller_missions')
      .find((candidate) => candidate.owner === WORKSPACE_LEASE_OWNER);
    expect((durable?.doc as { expiresAt?: string } | undefined)?.expiresAt).toBe(
      new Date(START_MS + 120_000).toISOString(),
    );
  });
});

describe('PostgresWorkspaceLeaseStore · held check', () => {
  it('returns false when lease is not held', async () => {
    const store = storeOver(temporaryDbPath());

    const result = await store.held('test-workspace', 'nonexistent-token');
    expect(result).toBe(false);
  });

  it('returns true when lease is held', async () => {
    const store = storeOver(temporaryDbPath());

    // First acquire a lease, then check it's held
    await store.acquire('test-workspace', request('lease_test'));

    // The EXACT key that was acquired — a different path is a different workspace.
    const result = await store.held('test-workspace', 'lease_test');
    expect(result).toBe(true);
  });

  it('is scoped per workspace — a claim on one never reads as held on another', async () => {
    const store = storeOver(temporaryDbPath());
    expect(await store.acquire(`/ws-${randomUUID()}`, request('lease_test'))).toBe(true);

    expect(await store.held(`/ws-${randomUUID()}`, 'lease_test')).toBe(false);
  });

  it('a token-checked release never frees a replacement lease', async () => {
    const file = temporaryDbPath();
    const store = storeOver(file);
    expect(
      await store.acquire('/test-workspace', request('lease_stale', START_MS, START_MS + 1_000)),
    ).toBe(true);
    // The stale claim expires and a replacement takes the workspace.
    expect(await store.acquire('/test-workspace', request('lease_live', START_MS + 2_000))).toBe(
      true,
    );

    await store.release('/test-workspace', 'lease_stale');

    expect(await store.held('/test-workspace', 'lease_live')).toBe(true);
    await store.release('/test-workspace', 'lease_live');
    expect(await storeOver(file).held('/test-workspace', 'lease_live')).toBe(false);
  });
});

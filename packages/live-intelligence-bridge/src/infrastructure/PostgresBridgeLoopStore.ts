// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/live-intelligence-bridge
// PostgresBridgeLoopStore — SPRINT-022 — Persistent Intelligence
//
// Production persistence for the EPIC-017 bridge loop store, keeping the
// SAME synchronous BridgeLoopStore port. Write-through Postgres via the
// shared @vedmoulya/core WriteThroughDocumentStore base.
//   • loops are keyed (userId, loopId) — IDOR-safe by construction;
//   • re-saving a loop idempotently upserts (no duplicate records after
//     restart — SPRINT-022 §7/§8);
//   • bounded FIFO per owner (50, matching the in-memory store);
//   • deterministic chronological list().
// ──────────────────────────────────────────────────────────────────

import type postgres from 'postgres';
import { WriteThroughDocumentStore } from '@vedmoulya/core';
import type { BridgeLoopRun } from '../types/bridge-types.js';
import type { BridgeLoopStore } from '../contracts/bridge-ports.js';

/** Bounded FIFO per owner (matches InMemoryBridgeLoopStore). */
export const BRIDGE_LOOPS_PER_OWNER = 50;

export class PostgresBridgeLoopStore
  extends WriteThroughDocumentStore<BridgeLoopRun>
  implements BridgeLoopStore
{
  constructor(sql: postgres.Sql, table = 'bridge_loop_runs') {
    super(sql, table);
  }

  save(loop: BridgeLoopRun): void {
    this.write(loop.userId, loop.loopId, loop);
    this.prune(
      loop.userId,
      BRIDGE_LOOPS_PER_OWNER,
      (r) => r.createdAt,
      (r) => r.loopId,
    );
  }

  get(userId: string, loopId: string): BridgeLoopRun | undefined {
    // Owner-scoped key — a foreign loop is indistinguishable from absent.
    return this.read(userId, loopId);
  }

  list(userId: string): BridgeLoopRun[] {
    return this.all(userId).sort(
      (a, b) =>
        Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.loopId.localeCompare(b.loopId),
    );
  }
}

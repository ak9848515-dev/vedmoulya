// ──────────────────────────────────────────────────────────────────
// VedMoulya — In-Memory Enterprise OS Repository
// Hermetic test double for the OSRepository contract (Map-backed).
// Used by package tests, the gateway router tests and the web
// dashboard against injected in-memory services.
//
// OS-001 — Enterprise Operating System Integration
// ──────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/require-await -- In-memory repository
   implements the Promise-returning domain interface with a synchronous
   Map-backed body (no I/O); the `async` markers are required for interface
   conformance. */

import type { OSHealthSnapshot } from '../types/os-types.js';
import type { OSRepository } from '../domain/repository/OSRepository.js';

export class InMemoryOSRepository implements OSRepository {
  private readonly snapshots = new Map<string, OSHealthSnapshot>();

  async saveSnapshot(snapshot: OSHealthSnapshot): Promise<void> {
    this.snapshots.set(snapshot.snapshotId, snapshot);
  }

  async listSnapshots(limit?: number): Promise<OSHealthSnapshot[]> {
    const all = [...this.snapshots.values()].sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
    return limit !== undefined ? all.slice(0, limit) : all;
  }

  async countSnapshots(): Promise<number> {
    return this.snapshots.size;
  }

  async ensureTable(): Promise<void> {
    // No-op — Map-backed double has no table to create.
  }
}

// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator: In-Memory Worker Registry
// EI-005 — Enterprise Execution Orchestrator
// Registers workers (research/writing/review/…) and claims the
// least-loaded available worker for a capability. No AI execution.
// ──────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/require-await -- In-memory repositories
   implement the Promise-returning domain interfaces with synchronous
   Map-backed bodies (no I/O); async markers required for conformance. */

import type { CapabilityType } from '@vedmoulya/ai';
import type { ExecutionWorker } from '../types/orchestrator-types.js';
import type { WorkerRegistry } from '../domain/repository/WorkerRegistry.js';
import { createWorkerId, type WorkerId } from '../domain/value-objects/Identifiers.js';

export class InMemoryWorkerRegistry implements WorkerRegistry {
  private readonly store = new Map<string, ExecutionWorker>();

  async register(worker: ExecutionWorker): Promise<void> {
    this.store.set(worker.workerId, structuredClone(worker));
  }

  async findById(id: WorkerId): Promise<ExecutionWorker | undefined> {
    const worker = this.store.get(id);
    return worker ? structuredClone(worker) : undefined;
  }

  async listAll(): Promise<ExecutionWorker[]> {
    return [...this.store.values()].map((w) => structuredClone(w));
  }

  async listByKind(kind: string): Promise<ExecutionWorker[]> {
    return [...this.store.values()].filter((w) => w.kind === kind).map((w) => structuredClone(w));
  }

  async claim(capability: CapabilityType): Promise<ExecutionWorker | undefined> {
    const candidates = [...this.store.values()]
      .filter(
        (w) =>
          w.status === 'idle' &&
          w.activeTasks < w.concurrency &&
          w.capabilities.includes(capability),
      )
      .sort((a, b) => a.activeTasks - b.activeTasks || b.health - a.health);
    const worker = candidates[0];
    if (!worker) return undefined;
    worker.activeTasks += 1;
    worker.status = worker.activeTasks >= worker.concurrency ? 'busy' : 'idle';
    this.store.set(worker.workerId, worker);
    return structuredClone(worker);
  }

  async release(workerId: WorkerId): Promise<void> {
    const worker = this.store.get(workerId);
    if (!worker) return;
    worker.activeTasks = Math.max(0, worker.activeTasks - 1);
    worker.status = 'idle';
    this.store.set(workerId, worker);
  }

  async update(worker: ExecutionWorker): Promise<void> {
    this.store.set(worker.workerId, structuredClone(worker));
  }

  static createId(id: string): WorkerId {
    return createWorkerId(id);
  }
}

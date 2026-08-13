// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator: In-Memory Queue Repository
// EI-005 — Enterprise Execution Orchestrator
// ──────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/require-await -- In-memory repositories
   implement the Promise-returning domain interfaces with synchronous
   Map-backed bodies (no I/O); async markers required for conformance. */

import type { ExecutionQueue, ExecutionQueueEntry } from '../types/orchestrator-types.js';
import type { ExecutionQueueRepository } from '../domain/repository/ExecutionQueueRepository.js';
import { createSessionId, type SessionId } from '../domain/value-objects/Identifiers.js';

export class InMemoryExecutionQueueRepository implements ExecutionQueueRepository {
  private readonly store = new Map<string, ExecutionQueue>();

  async save(queue: ExecutionQueue): Promise<void> {
    this.store.set(queue.queueId, structuredClone(queue));
  }

  async findBySession(sessionId: SessionId): Promise<ExecutionQueue | undefined> {
    const queue = [...this.store.values()].find((q) => q.queueId === `queue_${sessionId}`);
    return queue ? structuredClone(queue) : undefined;
  }

  async enqueue(queueId: string, entry: ExecutionQueueEntry): Promise<void> {
    const queue = this.store.get(queueId);
    if (!queue) return;
    queue.entries.push(entry);
    this.store.set(queueId, queue);
  }

  async dequeue(queueId: string, entryId: string): Promise<void> {
    const queue = this.store.get(queueId);
    if (!queue) return;
    queue.entries = queue.entries.filter((e) => e.entryId !== entryId);
    this.store.set(queueId, queue);
  }

  async listAll(): Promise<ExecutionQueue[]> {
    return [...this.store.values()].map((q) => structuredClone(q));
  }

  static createId(sessionId: string): string {
    return `queue_${createSessionId(sessionId)}`;
  }
}

// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator: In-Memory History Repository
// EI-005 — Enterprise Execution Orchestrator
// ──────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/require-await -- In-memory repositories
   implement the Promise-returning domain interfaces with synchronous
   Map-backed bodies (no I/O); async markers required for conformance. */

import type { ExecutionHistoryRecord } from '../domain/repository/ExecutionHistoryRepository.js';
import type { ExecutionHistoryRepository } from '../domain/repository/ExecutionHistoryRepository.js';
import { createSessionId, type SessionId } from '../domain/value-objects/Identifiers.js';

export class InMemoryExecutionHistoryRepository implements ExecutionHistoryRepository {
  private readonly store = new Map<string, ExecutionHistoryRecord>();

  async save(record: ExecutionHistoryRecord): Promise<void> {
    this.store.set(record.sessionId, structuredClone(record));
  }

  async findBySession(sessionId: SessionId): Promise<ExecutionHistoryRecord | undefined> {
    const record = this.store.get(sessionId);
    return record ? structuredClone(record) : undefined;
  }

  async listAll(): Promise<ExecutionHistoryRecord[]> {
    return [...this.store.values()].map((r) => structuredClone(r));
  }

  static createId(sessionId: string): SessionId {
    return createSessionId(sessionId);
  }
}

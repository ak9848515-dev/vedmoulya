// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator: In-Memory Session Repository
// EI-005 — Enterprise Execution Orchestrator
// ──────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/require-await -- In-memory repositories
   implement the Promise-returning domain interfaces with synchronous
   Map-backed bodies (no I/O); async markers required for conformance. */

import type { ExecutionSession } from '../types/orchestrator-types.js';
import type { ExecutionSessionRepository } from '../domain/repository/ExecutionSessionRepository.js';
import { createSessionId, type SessionId } from '../domain/value-objects/Identifiers.js';

export class InMemoryExecutionSessionRepository implements ExecutionSessionRepository {
  private readonly store = new Map<string, ExecutionSession>();

  async save(session: ExecutionSession): Promise<void> {
    this.store.set(session.sessionId, structuredClone(session));
  }

  async findById(id: SessionId): Promise<ExecutionSession | undefined> {
    const session = this.store.get(id);
    return session ? structuredClone(session) : undefined;
  }

  async listAll(): Promise<ExecutionSession[]> {
    return [...this.store.values()].map((s) => structuredClone(s));
  }

  async listByStatus(status: string): Promise<ExecutionSession[]> {
    return [...this.store.values()]
      .filter((s) => s.status === status)
      .map((s) => structuredClone(s));
  }

  async listByStrategy(strategyId: string): Promise<ExecutionSession[]> {
    return [...this.store.values()]
      .filter((s) => s.strategyId === strategyId)
      .map((s) => structuredClone(s));
  }

  async delete(id: SessionId): Promise<boolean> {
    return this.store.delete(id);
  }

  async exists(id: SessionId): Promise<boolean> {
    return this.store.has(id);
  }

  static createId(id: string): SessionId {
    return createSessionId(id);
  }
}

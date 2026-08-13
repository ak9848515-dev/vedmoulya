// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator: Queue Repository Contract
// EI-005 — Enterprise Execution Orchestrator
// ──────────────────────────────────────────────────────────────────

import type { ExecutionQueue, ExecutionQueueEntry } from '../../types/orchestrator-types.js';
import type { SessionId } from '../value-objects/Identifiers.js';

export interface ExecutionQueueRepository {
  save(queue: ExecutionQueue): Promise<void>;
  findBySession(sessionId: SessionId): Promise<ExecutionQueue | undefined>;
  enqueue(queueId: string, entry: ExecutionQueueEntry): Promise<void>;
  dequeue(queueId: string, entryId: string): Promise<void>;
  listAll(): Promise<ExecutionQueue[]>;
}

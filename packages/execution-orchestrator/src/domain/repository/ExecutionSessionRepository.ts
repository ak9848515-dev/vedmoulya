// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator: Session Repository Contract
// EI-005 — Enterprise Execution Orchestrator
// ──────────────────────────────────────────────────────────────────

import type { ExecutionSession } from '../../types/orchestrator-types.js';
import type { SessionId } from '../value-objects/Identifiers.js';

export interface ExecutionSessionRepository {
  save(session: ExecutionSession): Promise<void>;
  findById(id: SessionId): Promise<ExecutionSession | undefined>;
  listAll(): Promise<ExecutionSession[]>;
  listByStatus(status: string): Promise<ExecutionSession[]>;
  listByStrategy(strategyId: string): Promise<ExecutionSession[]>;
  delete(id: SessionId): Promise<boolean>;
  exists(id: SessionId): Promise<boolean>;
}

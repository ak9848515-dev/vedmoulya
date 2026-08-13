// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Orchestrator: History Contracts Repository
// EI-005 — Enterprise Execution Orchestrator
// History contracts record what ran: events, results, recovery actions,
// and per-run aggregates (feeds Quality/Learning later — never executes).
// ──────────────────────────────────────────────────────────────────

import type {
  ExecutionEvent,
  ExecutionResult,
  RecoveryAction,
} from '../../types/orchestrator-types.js';
import type { SessionId } from '../value-objects/Identifiers.js';

export interface ExecutionHistoryRecord {
  sessionId: string;
  events: ExecutionEvent[];
  results: Record<string, ExecutionResult>;
  recoveryActions: RecoveryAction[];
  /** Aggregate outcome summary. */
  summary: {
    completed: number;
    failed: number;
    skipped: number;
    totalCostUsd: number;
    totalTokens: number;
    totalLatencyMs: number;
  };
  updatedAt: string;
}

export interface ExecutionHistoryRepository {
  save(record: ExecutionHistoryRecord): Promise<void>;
  findBySession(sessionId: SessionId): Promise<ExecutionHistoryRecord | undefined>;
  listAll(): Promise<ExecutionHistoryRecord[]>;
}

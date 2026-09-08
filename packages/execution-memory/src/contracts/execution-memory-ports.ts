// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Memory: Ports
//
// The learning layer stores NO data itself: it persists through the
// narrow ExecutionMemoryStore port. The production adapter
// (MemoryIntelligenceStoreAdapter) delegates to the EXISTING enterprise
// memory persistence (@vedmoulya/memory-intelligence MemoryRepository) —
// no second database, no duplicate persistence architecture. The
// InMemoryExecutionMemoryStore is the hermetic test double.
//
// Retrieval is advisory: MemoryEvidence can never bypass runtime
// validation, permissions, ToolRuntime, AIOrchestrationService,
// governance, verification or budgets (enforced by the consuming frozen
// systems — this package never grants authority).
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type { MemoryCategory, MemoryEntry, MemoryScope } from '../types/execution-memory-types.js';

export interface MemoryStoreSearch {
  userId?: string;
  category?: MemoryCategory;
  scope?: MemoryScope;
  subject?: string;
  capability?: CapabilityType;
}

export interface ExecutionMemoryStore {
  save(entry: MemoryEntry): Promise<void>;
  get(entryId: string): Promise<MemoryEntry | undefined>;
  getByFingerprint(fingerprint: string): Promise<MemoryEntry | undefined>;
  list(search?: MemoryStoreSearch): Promise<MemoryEntry[]>;
  delete(entryId: string): Promise<void>;
}

export interface ExecutionMemoryObserver {
  /** Recorded when a candidate is accepted or rejected (observability). */
  onCandidate?(
    candidate: import('../types/execution-memory-types.js').MemoryCandidate,
    accepted: boolean,
    reasons: string[],
  ): void;
  /** Recorded on every retrieval. */
  onRetrieval?(
    query: import('../types/execution-memory-types.js').MemoryQuery,
    count: number,
  ): void;
}

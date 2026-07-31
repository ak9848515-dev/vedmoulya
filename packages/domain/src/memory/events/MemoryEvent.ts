// ──────────────────────────────────────────────────────────────────
// VedMoulya — Memory Domain Events
// All domain events emitted by the Memory Engine bounded context
// ──────────────────────────────────────────────────────────────────

import type { MemoryId } from '../value-objects/MemoryId.js';

export type MemoryEventType =
  | 'memory.created'
  | 'memory.updated'
  | 'memory.recalled'
  | 'memory.strengthened'
  | 'memory.weakened'
  | 'memory.merged'
  | 'memory.split'
  | 'memory.archived'
  | 'memory.restored'
  | 'memory.forgotten'
  | 'memory.knowledge_linked'
  | 'memory.knowledge_unlinked'
  | 'memory.decayed'
  | 'memory.consolidated'
  | 'memory.timeline_retrieved'
  | 'memory.search_executed'
  | 'memory.reflection_generated'
  | 'memory.retention_applied';

export interface MemoryEvent {
  type: MemoryEventType;
  memoryId?: MemoryId;
  timestamp: Date;
  data: Record<string, unknown>;
}

// ── Event Factory Helpers ─────────────────────────────────────────────────

export function createMemoryEvent(
  type: MemoryEventType,
  memoryId: MemoryId,
  data: Record<string, unknown> = {},
): MemoryEvent {
  return { type, memoryId, timestamp: new Date(), data };
}

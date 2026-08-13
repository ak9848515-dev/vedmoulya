// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Intelligence: Ids
// EI-010 — Enterprise Memory Intelligence Platform
// Branded identifiers for memory items, relationships, citations,
// consumers, and audit entries. Memory ids are stable slugs;
// relationship/citation/consumer/audit ids are unique and timestamped.
// ──────────────────────────────────────────────────────────────────

export type MemoryId = string & { readonly __memoryId: unique symbol };

export type MemoryRelationshipId = string & { readonly __memoryRelationshipId: unique symbol };

/** Create a branded MemoryId from a raw string. */
export function createMemoryId(id: string): MemoryId {
  return id as MemoryId;
}

/** Generate a unique memory item id: mem_<slug>_<timestamp>. */
export function generateMemoryId(slug: string): MemoryId {
  const safe = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return `mem_${safe || 'item'}_${Date.now().toString(36)}` as MemoryId;
}

/** Generate a unique relationship edge id. */
export function generateMemoryRelationshipId(): MemoryRelationshipId {
  return `mrel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}` as MemoryRelationshipId;
}

/** Generate a unique citation id. */
export function generateMemoryCitationId(): string {
  return `mcit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Generate a unique consumer id. */
export function generateMemoryConsumerId(): string {
  return `mcon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Generate a unique audit entry id. */
export function generateMemoryAuditId(): string {
  return `maud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

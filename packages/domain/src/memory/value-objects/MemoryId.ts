// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: MemoryId
// Branded identifier for memory entities
// ──────────────────────────────────────────────────────────────────

export type MemoryId = string & { readonly __brand: 'MemoryId' };

export function createMemoryId(value: string): MemoryId {
  return value as MemoryId;
}

export function generateMemoryId(): MemoryId {
  return `mem_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}` as MemoryId;
}

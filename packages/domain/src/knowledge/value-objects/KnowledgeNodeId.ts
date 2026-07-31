// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: KnowledgeNodeId
// Branded type for type-safe knowledge node identification
// ──────────────────────────────────────────────────────────────────

import type { BrandedId } from '@vedmoulya/core';

/** Type-safe Knowledge Node identifier — branded string */
export type KnowledgeNodeId = BrandedId<'KnowledgeNodeId'>;

/** Create a KnowledgeNodeId from a raw string */
export function createKnowledgeNodeId(value: string): KnowledgeNodeId {
  return value as KnowledgeNodeId;
}

/** Generate a new KnowledgeNodeId */
export function generateKnowledgeNodeId(): KnowledgeNodeId {
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  return `kn_${id}` as KnowledgeNodeId;
}

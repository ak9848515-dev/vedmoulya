// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: KnowledgeEdgeId
// Branded type for type-safe knowledge edge identification
// ──────────────────────────────────────────────────────────────────

import type { BrandedId } from '@vedmoulya/core';

/** Type-safe Knowledge Edge identifier — branded string */
export type KnowledgeEdgeId = BrandedId<'KnowledgeEdgeId'>;

/** Create a KnowledgeEdgeId from a raw string */
export function createKnowledgeEdgeId(value: string): KnowledgeEdgeId {
  return value as KnowledgeEdgeId;
}

/** Generate a new KnowledgeEdgeId */
export function generateKnowledgeEdgeId(): KnowledgeEdgeId {
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  return `ke_${id}` as KnowledgeEdgeId;
}

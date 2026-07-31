// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: GraphId
// Branded type for type-safe knowledge graph identification
// ──────────────────────────────────────────────────────────────────

import type { BrandedId } from '@vedmoulya/core';

/** Type-safe Graph identifier — branded string */
export type GraphId = BrandedId<'GraphId'>;

/** Create a GraphId from a raw string */
export function createGraphId(value: string): GraphId {
  return value as GraphId;
}

/** Generate a new GraphId */
export function generateGraphId(): GraphId {
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  return `kg_${id}` as GraphId;
}

// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Knowledge Intelligence: Ids
// EI-009 — Enterprise Knowledge Intelligence Platform
// Branded identifiers for knowledge items, relationships, versions,
// citations, consumers, dependencies, and audit entries. Item ids are
// stable slugs; relationship/version ids are unique and timestamped.
// ──────────────────────────────────────────────────────────────────

/** Linear edge trim — O(n) scan replacing quadratic regex (CWE-1333 ReDoS mitigation). */
function trimEdgeChars(value: string, chars: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && chars.includes(value.charAt(start))) start += 1;
  while (end > start && chars.includes(value.charAt(end - 1))) end -= 1;
  return value.slice(start, end);
}

export type KnowledgeId = string & { readonly __knowledgeId: unique symbol };

export type RelationshipId = string & { readonly __relationshipId: unique symbol };

export type VersionId = string & { readonly __versionId: unique symbol };

/** Create a branded KnowledgeId from a raw string. */
export function createKnowledgeId(id: string): KnowledgeId {
  return id as KnowledgeId;
}

/** Generate a unique knowledge item id: kn_<slug>_<timestamp>. */
export function generateKnowledgeId(slug: string): KnowledgeId {
  // Linear edge trim — the `/^_+|_+$/g` idiom is quadratic on adversarial
  // underscore runs (js/polynomial-redos, CWE-1333).
  const safe = trimEdgeChars(
    slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_'),
    '_',
  ).slice(0, 48);
  return `kn_${safe || 'item'}_${Date.now().toString(36)}` as KnowledgeId;
}

/** Generate a unique relationship edge id. */
export function generateRelationshipId(): RelationshipId {
  return `rel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}` as RelationshipId;
}

/** Generate a unique version snapshot id. */
export function generateVersionId(): VersionId {
  return `ver_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}` as VersionId;
}

/** Generate a unique citation id. */
export function generateCitationId(): string {
  return `cit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Generate a unique consumer id. */
export function generateConsumerId(): string {
  return `con_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Generate a unique dependency id. */
export function generateDependencyId(): string {
  return `dep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Generate a unique audit entry id. */
export function generateAuditId(): string {
  return `kaud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

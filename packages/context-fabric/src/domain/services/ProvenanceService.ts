// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Provenance
// APP-001 — Post-V1 Application Platform Layer
// Every context item must answer: where did this come from, when was
// it created/updated, which source produced it, why was it selected,
// what confidence did it receive, and what permissions allowed access.
// This service attaches provenance to entities and explains it in
// human-readable form for the Provenance panel and APP-004 Trace.
// ──────────────────────────────────────────────────────────────────

import type {
  ContextEntity,
  ContextProvenance,
  ContextSource,
  PermissionEvaluation,
} from '../../types/fabric-types.js';

export interface ProvenanceRequest {
  source: ContextSource;
  sourceId: string;
  producedBy: string;
  reason?: string;
  confidence: number;
  now?: string;
}

export function buildProvenance(request: ProvenanceRequest): ContextProvenance {
  const now = request.now ?? new Date().toISOString();
  return {
    source: request.source,
    sourceId: request.sourceId,
    createdAt: now,
    updatedAt: now,
    producedBy: request.producedBy,
    reason: request.reason,
    confidence: request.confidence,
  };
}

/** Human-readable provenance statement for one entity. */
export function provenanceStatement(entity: ContextEntity): string {
  const p = entity.provenance;
  const reason = p.reason ? ` because ${p.reason}` : '';
  return `${p.source} (${p.sourceId}) produced by ${p.producedBy} at ${p.createdAt}${reason}`;
}

/** "Why was this selected" — provenance + permission + score combined. */
export interface SelectionRationale {
  entityId: string;
  statement: string;
  facts: string[];
}

export function buildSelectionRationale(
  entity: ContextEntity,
  permission: PermissionEvaluation,
  reasons: string[],
): SelectionRationale {
  return {
    entityId: entity.entityId,
    statement: `Selected because: ${reasons.join('; ')}.`,
    facts: [
      provenanceStatement(entity),
      permission.allowed ? `Access granted — ${permission.reasons.join('; ')}.` : 'Access denied.',
    ],
  };
}

// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Permissions
// APP-001 — Post-V1 Application Platform Layer
// Permission-aware context is MANDATORY: no context item may reach an
// agent simply because it is technically searchable. This service
// evaluates an access request (identity + tenant + organization +
// role) against an entity's permission model and produces
// PermissionEvaluation with human-readable reasons. The fabric never
// retrieves what it cannot prove the requester may access.
// ──────────────────────────────────────────────────────────────────

import type {
  ContextEntity,
  ContextPermission,
  PermissionEvaluation,
} from '../../types/fabric-types.js';

export interface AccessRequest {
  userId: string;
  organizationId?: string;
  roles: string[];
}

/** Scope a permission check — pure, no I/O. */
export function evaluatePermission(
  entity: ContextEntity,
  request: AccessRequest,
): PermissionEvaluation {
  const permission = entity.permissions;
  const reasons: string[] = [];

  // Owner always has access.
  if (permission.owner === request.userId) {
    reasons.push('you are the owner of this context');
    return { entityId: entity.entityId, allowed: true, reasons };
  }

  // Explicit allow-list.
  if (permission.allowedUsers.includes(request.userId)) {
    reasons.push('you are explicitly permitted to access this context');
    return { entityId: entity.entityId, allowed: true, reasons };
  }

  // Role-based access.
  const roleGranted = permission.allowedRoles.some((role) => request.roles.includes(role));
  if (roleGranted) {
    reasons.push(`your role (${request.roles.join(', ')}) grants access`);
    return { entityId: entity.entityId, allowed: true, reasons };
  }

  // Organization-scoped access (tenant boundary).
  if (permission.scope === 'organization') {
    if (request.organizationId && permission.organizationId === request.organizationId) {
      reasons.push(`you belong to the organization ${permission.organizationId}`);
      return { entityId: entity.entityId, allowed: true, reasons };
    }
    reasons.push(
      permission.organizationId
        ? `this context belongs to organization ${permission.organizationId} and you are not a member`
        : 'this context is organization-scoped and no organization is associated with your session',
    );
    return { entityId: entity.entityId, allowed: false, reasons };
  }

  // Public scope.
  if (permission.scope === 'public') {
    reasons.push('this context is public');
    return { entityId: entity.entityId, allowed: true, reasons };
  }

  reasons.push('this context is private and you are not the owner');
  return { entityId: entity.entityId, allowed: false, reasons };
}

/** Permission-aware candidate filter — the fabric's retrieval gate. */
export function filterEligibleEntities(
  entities: ContextEntity[],
  request: AccessRequest,
): Array<{ entity: ContextEntity; evaluation: PermissionEvaluation }> {
  return entities
    .map((entity) => ({ entity, evaluation: evaluatePermission(entity, request) }))
    .filter((entry) => entry.evaluation.allowed);
}

/** Describe a permission model compactly (for the UI). */
export function permissionLabel(permission: ContextPermission): string {
  const scope =
    permission.scope === 'organization'
      ? `organization:${permission.organizationId ?? '?'}`
      : permission.scope;
  return `owner:${permission.owner} · scope:${scope} · users:${permission.allowedUsers.length} · roles:${permission.allowedRoles.length || 'none'}`;
}

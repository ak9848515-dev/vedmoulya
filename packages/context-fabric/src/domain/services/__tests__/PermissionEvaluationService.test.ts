// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context & Personal Intelligence Fabric: Permission tests
// APP-001 — Post-V1 Application Platform Layer
// Security-critical: a user must never receive context they are not
// authorized to access. These tests cover cross-user access,
// cross-tenant access, role grants, org scoping and public/private
// boundaries. This is the ≥90% target area.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  evaluatePermission,
  filterEligibleEntities,
  permissionLabel,
} from '../PermissionEvaluationService.js';
import type { ContextEntity, ContextPermission } from '../../../types/fabric-types.js';

function entityWithPermission(permission: ContextPermission): ContextEntity {
  const now = new Date().toISOString();
  return {
    entityId: 'entity_1',
    graph: 'personal',
    type: 'document',
    label: 'private note',
    ownerId: permission.owner,
    tags: [],
    confidence: 0.9,
    lifecycle: 'active',
    source: 'import',
    provenance: {
      source: 'import',
      sourceId: 'doc:1',
      createdAt: now,
      updatedAt: now,
      producedBy: 'test',
      confidence: 0.9,
    },
    permissions: permission,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
}

describe('PermissionEvaluationService (security-critical)', () => {
  it('allows the owner', () => {
    const entity = entityWithPermission({
      owner: 'user_a',
      scope: 'private',
      allowedUsers: [],
      allowedRoles: [],
      capability: [],
      grantedAt: new Date().toISOString(),
    });
    const result = evaluatePermission(entity, { userId: 'user_a', roles: [] });
    expect(result.allowed).toBe(true);
    expect(result.reasons[0]).toContain('owner');
  });

  it('denies a non-owner on a private entity (cross-user access)', () => {
    const entity = entityWithPermission({
      owner: 'user_a',
      scope: 'private',
      allowedUsers: [],
      allowedRoles: [],
      capability: [],
      grantedAt: new Date().toISOString(),
    });
    const result = evaluatePermission(entity, { userId: 'user_b', roles: [] });
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(' ')).toContain('private');
  });

  it('allows an explicitly listed user', () => {
    const entity = entityWithPermission({
      owner: 'user_a',
      scope: 'private',
      allowedUsers: ['user_b'],
      allowedRoles: [],
      capability: [],
      grantedAt: new Date().toISOString(),
    });
    const result = evaluatePermission(entity, { userId: 'user_b', roles: [] });
    expect(result.allowed).toBe(true);
  });

  it('allows via a matching role', () => {
    const entity = entityWithPermission({
      owner: 'user_a',
      scope: 'private',
      allowedUsers: [],
      allowedRoles: ['admin'],
      capability: [],
      grantedAt: new Date().toISOString(),
    });
    const result = evaluatePermission(entity, { userId: 'user_c', roles: ['admin'] });
    expect(result.allowed).toBe(true);
  });

  it('allows organization members within the same tenant', () => {
    const entity = entityWithPermission({
      owner: 'user_a',
      scope: 'organization',
      allowedUsers: [],
      allowedRoles: [],
      capability: [],
      organizationId: 'org_x',
      grantedAt: new Date().toISOString(),
    });
    const result = evaluatePermission(entity, {
      userId: 'user_d',
      organizationId: 'org_x',
      roles: [],
    });
    expect(result.allowed).toBe(true);
    expect(result.reasons.join(' ')).toContain('organization');
  });

  it('denies cross-tenant access (cross-tenant boundary)', () => {
    const entity = entityWithPermission({
      owner: 'user_a',
      scope: 'organization',
      allowedUsers: [],
      allowedRoles: [],
      capability: [],
      organizationId: 'org_x',
      grantedAt: new Date().toISOString(),
    });
    const result = evaluatePermission(entity, {
      userId: 'user_d',
      organizationId: 'org_y',
      roles: [],
    });
    expect(result.allowed).toBe(false);
    expect(result.reasons.join(' ')).toContain('not a member');
  });

  it('denies org-scoped access when no organization is in the session', () => {
    const entity = entityWithPermission({
      owner: 'user_a',
      scope: 'organization',
      allowedUsers: [],
      allowedRoles: [],
      capability: [],
      organizationId: 'org_x',
      grantedAt: new Date().toISOString(),
    });
    const result = evaluatePermission(entity, { userId: 'user_d', roles: [] });
    expect(result.allowed).toBe(false);
  });

  it('allows public entities', () => {
    const entity = entityWithPermission({
      owner: 'user_a',
      scope: 'public',
      allowedUsers: [],
      allowedRoles: [],
      capability: [],
      grantedAt: new Date().toISOString(),
    });
    const result = evaluatePermission(entity, { userId: 'anyone', roles: [] });
    expect(result.allowed).toBe(true);
  });

  it('filters eligible entities, dropping unauthorized candidates', () => {
    const privateDoc = entityWithPermission({
      owner: 'user_a',
      scope: 'private',
      allowedUsers: [],
      allowedRoles: [],
      capability: [],
      grantedAt: new Date().toISOString(),
    });
    const publicDoc = entityWithPermission({
      owner: 'user_a',
      scope: 'public',
      allowedUsers: [],
      allowedRoles: [],
      capability: [],
      grantedAt: new Date().toISOString(),
    });
    publicDoc.entityId = 'entity_2';
    const eligible = filterEligibleEntities([privateDoc, publicDoc], {
      userId: 'user_b',
      roles: [],
    });
    expect(eligible).toHaveLength(1);
    expect(eligible[0].entity.entityId).toBe('entity_2');
    expect(eligible[0].evaluation.allowed).toBe(true);
  });

  it('describes a permission model compactly', () => {
    const label = permissionLabel({
      owner: 'user_a',
      scope: 'organization',
      allowedUsers: ['u1'],
      allowedRoles: ['admin'],
      capability: [],
      organizationId: 'org_x',
      grantedAt: new Date().toISOString(),
    });
    expect(label).toContain('owner:user_a');
    expect(label).toContain('organization:org_x');
  });
});

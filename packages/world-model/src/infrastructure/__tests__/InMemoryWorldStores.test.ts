// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — InMemoryWorldStores (SPRINT-032) tests
// Deterministic owner-scoped store contracts: FIFO bounds on every store
// family, countByType, stable-key lookups and remove semantics.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { InMemoryWorldStores } from '../InMemoryWorldStores.js';
import {
  WORLD_BUSINESS_UNIT_LIMIT_PER_OWNER,
  WORLD_ROLE_LIMIT_PER_OWNER,
  WORLD_WORKFLOW_LIMIT_PER_OWNER,
} from '../InMemoryWorldStores.js';
import { WORLD_ENTITY_LIMIT_PER_OWNER } from '../../domain/WorldGraph.js';
import type {
  BlueprintApprovalRequest,
  BusinessUnit,
  BusinessWorkflow,
  OutcomeEvidence,
  RevenueStream,
  RoleSpec,
  WorldEntity,
} from '../../types/world-types.js';
import {
  WORLD_BLUEPRINT_APPROVAL_LIMIT_PER_OWNER,
  WORLD_OUTCOME_EVIDENCE_LIMIT_PER_OWNER,
  WORLD_REVENUE_STREAM_LIMIT_PER_OWNER,
} from '../InMemoryWorldStores.js';

const ts = '2026-08-14T10:00:00.000Z';

function entity(ownerId: string, i: number): WorldEntity {
  return {
    id: `e-${i}`,
    ownerId,
    type: 'task',
    label: `task-${i}`,
    stableKey: `${ownerId}:task:${i}`,
    evidence: ['brain-task'],
    provenance: { source: 'brain-task', status: 'VERIFIED', observedAt: ts },
    createdAt: ts,
    updatedAt: ts,
  };
}

function unit(ownerId: string, i: number): BusinessUnit {
  return {
    id: `bu-${i}`,
    ownerId,
    stableKey: `${ownerId}:business-unit:unit-${i}`,
    name: `unit-${i}`,
    purpose: 'p',
    offerings: [],
    workflowIds: [],
    opportunityIds: [],
    costs: [],
    revenue: [],
    kpis: [],
    automationLevel: 0,
    aiCapabilities: [],
    humanResponsibilities: [],
    approvalRequirements: [],
    status: 'ACTIVE',
    createdAt: ts,
    updatedAt: ts,
  };
}

function role(ownerId: string, i: number): RoleSpec {
  return {
    id: `r-${i}`,
    ownerId,
    stableKey: `${ownerId}:role:role-${i}`,
    name: `role-${i}`,
    responsibilities: ['x'],
    capabilities: ['RESEARCH'],
    providerStrategies: ['LOW_COST'],
    privacyRequirement: 'STANDARD',
    authorityClass: 'B',
    status: 'ACTIVE',
    createdAt: ts,
    updatedAt: ts,
  };
}

function stream(ownerId: string, i: number): RevenueStream {
  return {
    id: `rs-${i}`,
    ownerId,
    stableKey: `${ownerId}:revenue:stream-${i}`,
    name: `stream-${i}`,
    kind: 'SERVICE',
    status: 'ACTIVE',
    createdAt: ts,
    updatedAt: ts,
  };
}

function workflow(ownerId: string, i: number): BusinessWorkflow {
  return {
    id: `wf-${i}`,
    ownerId,
    stableKey: `${ownerId}:workflow:wf-${i}`,
    name: `wf-${i}`,
    description: 'x',
    trigger: 't',
    inputs: [],
    steps: [{ id: 's1', label: 'a', dependsOn: [] }],
    outputs: [],
    status: 'DEFINED',
    createdAt: ts,
    updatedAt: ts,
  };
}

describe('InMemoryWorldStores — bounds', () => {
  it('entities are FIFO-bounded per owner (oldest evicted first)', () => {
    const stores = new InMemoryWorldStores();
    for (let i = 0; i < WORLD_ENTITY_LIMIT_PER_OWNER + 10; i += 1) {
      stores.entities.save(entity('u1', i));
    }
    expect(stores.entities.count('u1')).toBe(WORLD_ENTITY_LIMIT_PER_OWNER);
    // The OLDEST entities were evicted — newest survive.
    expect(stores.entities.get('u1', 'e-0')).toBeUndefined();
    expect(stores.entities.get('u1', `e-${WORLD_ENTITY_LIMIT_PER_OWNER + 9}`)).toBeDefined();
  });

  it('business units / roles / workflows are FIFO-bounded per owner', () => {
    const stores = new InMemoryWorldStores();
    for (let i = 0; i < WORLD_BUSINESS_UNIT_LIMIT_PER_OWNER + 5; i += 1) {
      stores.businessUnits.save(unit('u1', i));
    }
    expect(stores.businessUnits.list('u1').length).toBe(WORLD_BUSINESS_UNIT_LIMIT_PER_OWNER);

    for (let i = 0; i < WORLD_ROLE_LIMIT_PER_OWNER + 5; i += 1) {
      stores.roles.save(role('u1', i));
    }
    expect(stores.roles.list('u1').length).toBe(WORLD_ROLE_LIMIT_PER_OWNER);

    for (let i = 0; i < WORLD_WORKFLOW_LIMIT_PER_OWNER + 5; i += 1) {
      stores.workflows.save(workflow('u1', i));
    }
    expect(stores.workflows.list('u1').length).toBe(WORLD_WORKFLOW_LIMIT_PER_OWNER);
  });

  it('relations are FIFO-bounded per owner too', () => {
    const stores = new InMemoryWorldStores();
    for (let i = 0; i < 510; i += 1) {
      stores.relations.save({
        id: `wr-${i}`,
        ownerId: 'u1',
        type: 'has_goal',
        fromType: 'user',
        fromId: 'u',
        toType: 'goal',
        toId: `g-${i}`,
        createdAt: ts,
      });
    }
    expect(stores.relations.count('u1')).toBe(500);
    expect(stores.relations.list('u1').every((r) => r.id.startsWith('wr-'))).toBe(true);
  });

  it('revenue streams are FIFO-bounded per owner (SPRINT-033 Part F)', () => {
    const stores = new InMemoryWorldStores();
    for (let i = 0; i < WORLD_REVENUE_STREAM_LIMIT_PER_OWNER + 5; i += 1) {
      stores.revenueStreams.save(stream('u1', i));
    }
    expect(stores.revenueStreams.list('u1').length).toBe(WORLD_REVENUE_STREAM_LIMIT_PER_OWNER);
    expect(stores.revenueStreams.list('u2')).toEqual([]); // owner isolation
  });
});

describe('InMemoryWorldStores — lookups + removal', () => {
  it('countByType groups only the owner entities', () => {
    const stores = new InMemoryWorldStores();
    stores.entities.save(entity('u1', 1));
    stores.entities.save(entity('u1', 2));
    stores.entities.save(entity('u2', 3));
    const counts = stores.entities.countByType('u1');
    expect(counts).toEqual([{ type: 'task', count: 2 }]);
  });

  it('remove deletes and stable-key getByKey is owner-scoped', () => {
    const stores = new InMemoryWorldStores();
    stores.entities.save(entity('u1', 1));
    stores.entities.save(entity('u2', 1));
    expect(stores.entities.getByKey('u1', 'u1:task:1')?.id).toBe('e-1');
    expect(stores.entities.getByKey('u1', 'u2:task:1')).toBeUndefined();
    stores.entities.remove('u1', 'e-1');
    expect(stores.entities.get('u1', 'e-1')).toBeUndefined();
    expect(stores.entities.get('u2', 'e-1')).toBeDefined(); // other owner untouched
  });

  it('relation dedup + remove work per owner', () => {
    const stores = new InMemoryWorldStores();
    const relation = {
      id: 'wr-1',
      ownerId: 'u1',
      type: 'has_goal' as const,
      fromType: 'user' as const,
      fromId: 'u',
      toType: 'goal' as const,
      toId: 'g',
      createdAt: ts,
    };
    stores.relations.save(relation);
    const dup = stores.relations.getByKey('u1', 'u1:has_goal:u:g');
    expect(dup?.id).toBe('wr-1');
    stores.relations.remove('u1', 'wr-1');
    expect(stores.relations.count('u1')).toBe(0);
  });

  it('revenue streams support get, getByKey, list and remove per owner', () => {
    const stores = new InMemoryWorldStores();
    stores.revenueStreams.save(stream('u1', 1));
    stores.revenueStreams.save(stream('u2', 1));
    expect(stores.revenueStreams.get('u1', 'rs-1')?.name).toBe('stream-1');
    expect(stores.revenueStreams.getByKey('u1', 'u1:revenue:stream-1')?.id).toBe('rs-1');
    expect(stores.revenueStreams.getByKey('u1', 'u2:revenue:stream-1')).toBeUndefined();
    expect(stores.revenueStreams.list('u1')).toHaveLength(1);
    stores.revenueStreams.remove('u1', 'rs-1');
    expect(stores.revenueStreams.get('u1', 'rs-1')).toBeUndefined();
    expect(stores.revenueStreams.get('u2', 'rs-1')).toBeDefined(); // other owner untouched
  });

  it('units/roles/workflows support get, getByKey and remove per owner', () => {
    const stores = new InMemoryWorldStores();
    stores.businessUnits.save(unit('u1', 1));
    expect(stores.businessUnits.get('u1', 'bu-1')?.name).toBe('unit-1');
    expect(stores.businessUnits.getByKey('u1', 'u1:business-unit:unit-1')?.id).toBe('bu-1');
    expect(stores.businessUnits.getByKey('u2', 'u1:business-unit:unit-1')).toBeUndefined();
    stores.businessUnits.remove('u1', 'bu-1');
    expect(stores.businessUnits.get('u1', 'bu-1')).toBeUndefined();

    stores.roles.save(role('u1', 1));
    expect(stores.roles.get('u1', 'r-1')?.name).toBe('role-1');
    expect(stores.roles.getByKey('u1', 'u1:role:role-1')?.id).toBe('r-1');

    stores.workflows.save(workflow('u1', 1));
    expect(stores.workflows.get('u1', 'wf-1')?.name).toBe('wf-1');
    expect(stores.workflows.getByKey('u1', 'u1:workflow:wf-1')?.id).toBe('wf-1');
    expect(stores.workflows.getByKey('u2', 'u1:workflow:wf-1')).toBeUndefined();
  });

  // ── SPRINT-034 — outcome evidence + blueprint approval families ────────

  function evidence(ownerId: string, i: number): OutcomeEvidence {
    return {
      id: `oe-${i}`,
      ownerId,
      stableKey: `${ownerId}:REVENUE:opp-${i}`,
      kind: 'REVENUE',
      opportunityId: `opp-${i}`,
      category: 'saas',
      actual: { value: 500, status: 'VERIFIED', evidence: ['invoice'] },
      verificationStatus: 'VERIFIED',
      evidence: ['invoice'],
      recordedAt: ts,
    };
  }

  function approval(ownerId: string, i: number): BlueprintApprovalRequest {
    return {
      id: `bpa-${i}`,
      ownerId,
      stableKey: `${ownerId}:bp-${i}:s1`,
      blueprintId: `bp-${i}`,
      stepId: 's1',
      action: 'publish',
      reason: 'class C',
      riskLevel: 'HIGH',
      reversibility: 'IRREVERSIBLE',
      authorityRequired: 'C',
      status: 'WAITING_FOR_APPROVAL',
      executed: false,
      createdAt: ts,
      updatedAt: ts,
    };
  }

  it('outcome evidence is FIFO-bounded + owner-isolated + stable-key upsert', () => {
    const stores = new InMemoryWorldStores();
    for (let i = 0; i < WORLD_OUTCOME_EVIDENCE_LIMIT_PER_OWNER + 5; i += 1) {
      stores.outcomeEvidence.save(evidence('u1', i));
    }
    expect(stores.outcomeEvidence.list('u1').length).toBe(WORLD_OUTCOME_EVIDENCE_LIMIT_PER_OWNER);
    expect(stores.outcomeEvidence.list('u2')).toEqual([]);
    // Stable-key idempotency: same (kind, opportunity) upserts, never duplicates.
    stores.outcomeEvidence.save(evidence('u1', 1));
    expect(stores.outcomeEvidence.list('u1').length).toBe(WORLD_OUTCOME_EVIDENCE_LIMIT_PER_OWNER);
    expect(stores.outcomeEvidence.getByKey('u1', 'u1:REVENUE:opp-1')?.id).toBe('oe-1');
    // listByKind filters owner-scoped.
    stores.outcomeEvidence.save({
      ...evidence('u1', 999),
      id: 'oe-999',
      kind: 'COST',
      stableKey: 'u1:COST:opp-999',
    });
    expect(stores.outcomeEvidence.listByKind('u1', 'COST').length).toBe(1);
    stores.outcomeEvidence.remove('u1', 'oe-999');
    expect(stores.outcomeEvidence.get('u1', 'oe-999')).toBeUndefined();
  });

  it('blueprint approvals are FIFO-bounded + owner-isolated + stable-key upsert', () => {
    const stores = new InMemoryWorldStores();
    for (let i = 0; i < WORLD_BLUEPRINT_APPROVAL_LIMIT_PER_OWNER + 5; i += 1) {
      stores.blueprintApprovals.save(approval('u1', i));
    }
    expect(stores.blueprintApprovals.list('u1').length).toBe(
      WORLD_BLUEPRINT_APPROVAL_LIMIT_PER_OWNER,
    );
    expect(stores.blueprintApprovals.list('u2')).toEqual([]);
    stores.blueprintApprovals.save(approval('u1', 1));
    expect(stores.blueprintApprovals.getByKey('u1', 'u1:bp-1:s1')?.id).toBe('bpa-1');
    expect(stores.blueprintApprovals.getByKey('u2', 'u1:bp-1:s1')).toBeUndefined();
    stores.blueprintApprovals.remove('u1', 'bpa-1');
    expect(stores.blueprintApprovals.get('u1', 'bpa-1')).toBeUndefined();
  });
});

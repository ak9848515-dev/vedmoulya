// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — PostgresWorldStores (SPRINT-032) hermetic tests
// Verifies the synchronous world-model store contracts over a recording
// postgres.js stub: owner isolation (IDOR), keyed document semantics,
// idempotent upserts, list ordering and bounded retention.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import type {
  BlueprintApprovalRequest,
  BusinessProblem,
  CustomerDiscoveryRecord,
  FounderObservation,
  OutcomeEvidence,
  RevenueStream,
  WorldEntity,
  WorldRelation,
} from '../types/world-types.js';
import {
  PostgresBlueprintApprovalStore,
  PostgresBusinessUnitStore,
  PostgresObservationStore,
  PostgresOutcomeEvidenceStore,
  PostgresProblemStore,
  PostgresProspectStore,
  PostgresRevenueStreamStore,
  PostgresRoleStore,
  PostgresWorkflowStore,
  PostgresWorldEntityStore,
  PostgresWorldRelationStore,
} from '../PostgresWorldStores.js';
import {
  WORLD_OBSERVATION_LIMIT_PER_OWNER,
  WORLD_PROBLEM_LIMIT_PER_OWNER,
  WORLD_PROSPECT_LIMIT_PER_OWNER,
} from '../InMemoryWorldStores.js';
import {
  WORLD_ENTITY_LIMIT_PER_OWNER,
  WORLD_RELATION_LIMIT_PER_OWNER,
} from '../../domain/WorldGraph.js';
import {
  WORLD_BUSINESS_UNIT_LIMIT_PER_OWNER,
  WORLD_REVENUE_STREAM_LIMIT_PER_OWNER,
  WORLD_ROLE_LIMIT_PER_OWNER,
  WORLD_WORKFLOW_LIMIT_PER_OWNER,
} from '../InMemoryWorldStores.js';

function createFakeSql(): postgres.Sql {
  const run = (first: unknown, ..._values: unknown[]): unknown => {
    const text = typeof first === 'string' ? first : (first as TemplateStringsArray).join('?');
    if (/^\s*SELECT/i.test(text)) return Promise.resolve([]);
    return Promise.resolve({ count: 1 });
  };
  return Object.assign(run, {
    json: (value: unknown): unknown => {
      if (typeof value === 'string') {
        throw new Error('double-encoding regression: sql.json() received pre-stringified JSON');
      }
      return value;
    },
  }) as unknown as postgres.Sql;
}

function entity(ownerId: string, id: string, updatedAt = '2026-08-14T10:00:00.000Z'): WorldEntity {
  return {
    id,
    ownerId,
    type: 'opportunity',
    label: `opportunity-${id}`,
    stableKey: `${ownerId}:opportunity:${id}`,
    externalId: id,
    evidence: ['brain-opportunity'],
    provenance: { source: 'brain-opportunity', status: 'VERIFIED', observedAt: updatedAt },
    createdAt: updatedAt,
    updatedAt,
  };
}

function revenueStream(ownerId: string, id: string): RevenueStream {
  return {
    id,
    ownerId,
    stableKey: `${ownerId}:revenue:stream-${id}`,
    name: `stream-${id}`,
    kind: 'SERVICE',
    status: 'ACTIVE',
    createdAt: '2026-08-14T10:00:00.000Z',
    updatedAt: '2026-08-14T10:00:00.000Z',
  };
}

function relation(
  ownerId: string,
  id: string,
  createdAt = '2026-08-14T10:00:00.000Z',
): WorldRelation {
  return {
    id,
    ownerId,
    type: 'has_goal',
    fromType: 'user',
    fromId: 'user-1',
    toType: 'goal',
    toId: 'goal-1',
    createdAt,
  };
}

describe('PostgresWorldEntityStore', () => {
  it('saves, reads and lists owner-scoped entities', async () => {
    const store = new PostgresWorldEntityStore(createFakeSql());
    store.save(entity('u1', 'e1'));
    store.save(entity('u1', 'e2'));
    store.save(entity('u2', 'e1'));
    expect(store.list('u1')).toHaveLength(2);
    expect(store.list('u2')).toHaveLength(1);
    expect(store.get('u1', 'e1')).toMatchObject({ id: 'e1' });
    expect(store.get('u1', 'missing')).toBeUndefined();
    await store.flush();
  });

  it('stable-key lookup is owner-scoped (IDOR)', async () => {
    const store = new PostgresWorldEntityStore(createFakeSql());
    store.save(entity('u1', 'e1'));
    store.save(entity('u2', 'e1'));
    expect(store.getByKey('u1', 'u1:opportunity:e1')?.id).toBe('e1');
    expect(store.getByKey('u1', 'u2:opportunity:e1')).toBeUndefined();
    await store.flush();
  });

  it('idempotent re-save never duplicates', async () => {
    const store = new PostgresWorldEntityStore(createFakeSql());
    store.save(entity('u1', 'e1'));
    store.save(entity('u1', 'e1'));
    expect(store.list('u1')).toHaveLength(1);
    await store.flush();
  });

  it('retention is bounded (FIFO per owner)', async () => {
    const store = new PostgresWorldEntityStore(createFakeSql());
    for (let i = 0; i < WORLD_ENTITY_LIMIT_PER_OWNER + 10; i += 1) {
      store.save(
        entity('u1', `e-${i}`, `2026-08-14T${String(10 + (i % 10)).padStart(2, '0')}:00:00.000Z`),
      );
    }
    expect(store.count('u1')).toBeLessThanOrEqual(WORLD_ENTITY_LIMIT_PER_OWNER);
    await store.flush();
  });

  it('remove deletes from the mirror (port remove → base remove)', async () => {
    const store = new PostgresWorldEntityStore(createFakeSql());
    store.save(entity('u1', 'e1'));
    store.remove('u1', 'e1');
    expect(store.get('u1', 'e1')).toBeUndefined();
    expect(store.list('u1')).toHaveLength(0);
    await store.flush();
  });

  it('listByType and countByType group only the owner entities', async () => {
    const store = new PostgresWorldEntityStore(createFakeSql());
    store.save(entity('u1', 'e1'));
    store.save({ ...entity('u1', 'e2'), type: 'task' });
    store.save(entity('u2', 'e1'));
    expect(store.listByType('u1', 'opportunity')).toHaveLength(1);
    expect(store.listByType('u1', 'task')).toHaveLength(1);
    expect(store.countByType('u1')).toEqual([
      { type: 'opportunity', count: 1 },
      { type: 'task', count: 1 },
    ]);
    expect(store.listByType('u2', 'opportunity')).toHaveLength(1);
    await store.flush();
  });

  it('list is sorted newest-first by updatedAt', async () => {
    const store = new PostgresWorldEntityStore(createFakeSql());
    store.save(entity('u1', 'e1', '2026-08-14T09:00:00.000Z'));
    store.save(entity('u1', 'e2', '2026-08-14T11:00:00.000Z'));
    const list = store.list('u1');
    expect(list[0]?.id).toBe('e2');
    expect(list[1]?.id).toBe('e1');
    await store.flush();
  });
});

describe('PostgresWorldRelationStore', () => {
  it('saves, lists and dedups owner-scoped relations', async () => {
    const store = new PostgresWorldRelationStore(createFakeSql());
    store.save(relation('u1', 'r1'));
    store.save(relation('u1', 'r1'));
    store.save(relation('u2', 'r1'));
    expect(store.list('u1')).toHaveLength(1);
    expect(store.count('u2')).toBe(1);
    await store.flush();
  });

  it('getByKey is owner-scoped + list is newest-first + remove', async () => {
    const store = new PostgresWorldRelationStore(createFakeSql());
    store.save({ ...relation('u1', 'r1', '2026-08-14T09:00:00.000Z'), toId: 'goal-1' });
    store.save({ ...relation('u1', 'r2', '2026-08-14T11:00:00.000Z'), toId: 'goal-2' });
    store.save({ ...relation('u2', 'r1', '2026-08-14T09:00:00.000Z'), toId: 'goal-1' });
    expect(store.getByKey('u1', 'u1:has_goal:user-1:goal-2')?.id).toBe('r2');
    expect(store.getByKey('u1', 'u2:has_goal:user-1:goal-1')).toBeUndefined();
    expect(store.list('u1')[0]?.id).toBe('r2'); // newest first
    store.remove('u1', 'r2');
    expect(store.count('u1')).toBe(1);
    expect(store.count('u2')).toBe(1);
    await store.flush();
  });
});

describe('PostgresBusinessUnitStore / PostgresRoleStore / PostgresWorkflowStore', () => {
  it('round-trip owner-scoped configurable records', async () => {
    const units = new PostgresBusinessUnitStore(createFakeSql());
    const roles = new PostgresRoleStore(createFakeSql());
    const workflows = new PostgresWorkflowStore(createFakeSql());

    units.save({
      id: 'bu1',
      ownerId: 'u1',
      stableKey: 'u1:business-unit:ai-solutions',
      name: 'AI solutions',
      purpose: 'Deliver AI automation.',
      offerings: [],
      workflowIds: [],
      opportunityIds: [],
      costs: [],
      revenue: [],
      kpis: [],
      automationLevel: 2,
      aiCapabilities: [],
      humanResponsibilities: [],
      approvalRequirements: [],
      status: 'ACTIVE',
      createdAt: '2026-08-14T10:00:00.000Z',
      updatedAt: '2026-08-14T10:00:00.000Z',
    });
    expect(units.get('u1', 'bu1')?.name).toBe('AI solutions');
    expect(units.get('u2', 'bu1')).toBeUndefined();

    roles.save({
      id: 'role1',
      ownerId: 'u1',
      stableKey: 'u1:role:researcher',
      name: 'CONTENT_RESEARCHER',
      responsibilities: ['Research'],
      capabilities: ['RESEARCH'],
      providerStrategies: ['LOW_COST'],
      privacyRequirement: 'STANDARD',
      authorityClass: 'A',
      status: 'ACTIVE',
      createdAt: '2026-08-14T10:00:00.000Z',
      updatedAt: '2026-08-14T10:00:00.000Z',
    });
    expect(roles.getByKey('u1', 'u1:role:researcher')?.name).toBe('CONTENT_RESEARCHER');

    workflows.save({
      id: 'wf1',
      ownerId: 'u1',
      stableKey: 'u1:workflow:delivery',
      name: 'Delivery',
      description: 'x',
      trigger: 'CLIENT_REQUEST',
      inputs: [],
      steps: [{ id: 's1', label: 'analyze', dependsOn: [] }],
      outputs: [],
      status: 'DEFINED',
      createdAt: '2026-08-14T10:00:00.000Z',
      updatedAt: '2026-08-14T10:00:00.000Z',
    });
    expect(workflows.list('u1')).toHaveLength(1);
    expect(workflows.list('u2')).toHaveLength(0);
    await Promise.all([units.flush(), roles.flush(), workflows.flush()]);
  });

  it('remove / getByKey / countByType semantics for the unit/role/workflow stores', async () => {
    const units = new PostgresBusinessUnitStore(createFakeSql());
    const roles = new PostgresRoleStore(createFakeSql());
    const workflows = new PostgresWorkflowStore(createFakeSql());

    units.save({
      id: 'bu1',
      ownerId: 'u1',
      stableKey: 'u1:business-unit:ai-solutions',
      name: 'AI solutions',
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
      createdAt: '2026-08-14T10:00:00.000Z',
      updatedAt: '2026-08-14T10:00:00.000Z',
    });
    expect(units.getByKey('u1', 'u1:business-unit:ai-solutions')?.name).toBe('AI solutions');
    expect(units.list('u1')).toHaveLength(1);
    units.remove('u1', 'bu1');
    expect(units.get('u1', 'bu1')).toBeUndefined();

    roles.save({
      id: 'r1',
      ownerId: 'u1',
      stableKey: 'u1:role:researcher',
      name: 'CONTENT_RESEARCHER',
      responsibilities: ['Research'],
      capabilities: ['RESEARCH'],
      providerStrategies: ['LOW_COST'],
      privacyRequirement: 'STANDARD',
      authorityClass: 'A',
      status: 'ACTIVE',
      createdAt: '2026-08-14T10:00:00.000Z',
      updatedAt: '2026-08-14T10:00:00.000Z',
    });
    expect(roles.get('u1', 'r1')?.name).toBe('CONTENT_RESEARCHER');
    expect(roles.get('u2', 'r1')).toBeUndefined();
    expect(roles.getByKey('u1', 'u1:role:researcher')?.id).toBe('r1');
    expect(roles.list('u1')).toHaveLength(1);
    expect(roles.list('u2')).toHaveLength(0);

    workflows.save({
      id: 'wf1',
      ownerId: 'u1',
      stableKey: 'u1:workflow:delivery',
      name: 'Delivery',
      description: 'x',
      trigger: 't',
      inputs: [],
      steps: [{ id: 's1', label: 'analyze', dependsOn: [] }],
      outputs: [],
      status: 'DEFINED',
      createdAt: '2026-08-14T10:00:00.000Z',
      updatedAt: '2026-08-14T10:00:00.000Z',
    });
    expect(workflows.get('u1', 'wf1')?.name).toBe('Delivery');
    expect(workflows.getByKey('u1', 'u1:workflow:delivery')?.id).toBe('wf1');
    expect(workflows.list('u1')).toHaveLength(1);
    await Promise.all([units.flush(), roles.flush(), workflows.flush()]);
  });

  it('save triggers prune on every store family (bounded per owner)', async () => {
    const entities = new PostgresWorldEntityStore(createFakeSql());
    const relations = new PostgresWorldRelationStore(createFakeSql());
    const units = new PostgresBusinessUnitStore(createFakeSql());
    const roles = new PostgresRoleStore(createFakeSql());
    const workflows = new PostgresWorkflowStore(createFakeSql());
    const streams = new PostgresRevenueStreamStore(createFakeSql());

    for (let i = 0; i < WORLD_ENTITY_LIMIT_PER_OWNER + 50; i += 1) {
      entities.save(entity('u1', `e-${i}`));
    }
    expect(entities.count('u1')).toBeLessThanOrEqual(WORLD_ENTITY_LIMIT_PER_OWNER);

    for (let i = 0; i < WORLD_RELATION_LIMIT_PER_OWNER + 20; i += 1) {
      relations.save(relation('u1', `r-${i}`));
    }
    expect(relations.count('u1')).toBeLessThanOrEqual(WORLD_RELATION_LIMIT_PER_OWNER);

    for (let i = 0; i < WORLD_BUSINESS_UNIT_LIMIT_PER_OWNER + 5; i += 1) {
      units.save({
        id: `bu-${i}`,
        ownerId: 'u1',
        stableKey: `u1:business-unit:bu-${i}`,
        name: `bu-${i}`,
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
        createdAt: '2026-08-14T10:00:00.000Z',
        updatedAt: '2026-08-14T10:00:00.000Z',
      });
    }
    expect(units.list('u1').length).toBeLessThanOrEqual(WORLD_BUSINESS_UNIT_LIMIT_PER_OWNER);

    for (let i = 0; i < WORLD_ROLE_LIMIT_PER_OWNER + 5; i += 1) {
      roles.save({
        id: `r-${i}`,
        ownerId: 'u1',
        stableKey: `u1:role:role-${i}`,
        name: `role-${i}`,
        responsibilities: ['x'],
        capabilities: ['RESEARCH'],
        providerStrategies: ['LOW_COST'],
        privacyRequirement: 'STANDARD',
        authorityClass: 'A',
        status: 'ACTIVE',
        createdAt: '2026-08-14T10:00:00.000Z',
        updatedAt: '2026-08-14T10:00:00.000Z',
      });
    }
    expect(roles.list('u1').length).toBeLessThanOrEqual(WORLD_ROLE_LIMIT_PER_OWNER);

    for (let i = 0; i < WORLD_WORKFLOW_LIMIT_PER_OWNER + 5; i += 1) {
      workflows.save({
        id: `wf-${i}`,
        ownerId: 'u1',
        stableKey: `u1:workflow:wf-${i}`,
        name: `wf-${i}`,
        description: 'x',
        trigger: 't',
        inputs: [],
        steps: [{ id: 's1', label: 'a', dependsOn: [] }],
        outputs: [],
        status: 'DEFINED',
        createdAt: '2026-08-14T10:00:00.000Z',
        updatedAt: '2026-08-14T10:00:00.000Z',
      });
    }
    expect(workflows.list('u1').length).toBeLessThanOrEqual(WORLD_WORKFLOW_LIMIT_PER_OWNER);

    for (let i = 0; i < WORLD_REVENUE_STREAM_LIMIT_PER_OWNER + 5; i += 1) {
      streams.save(revenueStream('u1', `rs-${i}`));
    }
    expect(streams.list('u1').length).toBeLessThanOrEqual(WORLD_REVENUE_STREAM_LIMIT_PER_OWNER);
    await Promise.all([
      entities.flush(),
      relations.flush(),
      units.flush(),
      roles.flush(),
      workflows.flush(),
      streams.flush(),
    ]);
  });
});

describe('PostgresRevenueStreamStore (SPRINT-033 Part F)', () => {
  it('round-trips owner-scoped evidence-carrying streams', async () => {
    const store = new PostgresRevenueStreamStore(createFakeSql());
    const stream = revenueStream('u1', 'rs-1');
    store.save(stream);
    store.save(revenueStream('u2', 'rs-1'));
    expect(store.get('u1', 'rs-1')?.name).toBe('stream-rs-1');
    expect(store.get('u1', 'rs-2')).toBeUndefined();
    expect(store.getByKey('u1', 'u1:revenue:stream-rs-1')?.id).toBe('rs-1');
    expect(store.getByKey('u1', 'u2:revenue:stream-rs-1')).toBeUndefined();
    expect(store.list('u1')).toHaveLength(1);
    expect(store.list('u2')).toHaveLength(1);
    store.remove('u1', 'rs-1');
    expect(store.get('u1', 'rs-1')).toBeUndefined();
    expect(store.get('u2', 'rs-1')).toBeDefined();
    await store.flush();
  });
});

describe('PostgresOutcomeEvidenceStore / PostgresBlueprintApprovalStore (SPRINT-034)', () => {
  function outcomeEvidence(ownerId: string, id: string): OutcomeEvidence {
    return {
      id,
      ownerId,
      stableKey: `${ownerId}:REVENUE:opp-${id}`,
      kind: 'REVENUE',
      opportunityId: `opp-${id}`,
      category: 'saas',
      actual: { value: 500, status: 'VERIFIED', evidence: ['invoice'] },
      verificationStatus: 'VERIFIED',
      evidence: ['invoice'],
      recordedAt: '2026-08-15T10:00:00.000Z',
    };
  }

  function blueprintApproval(ownerId: string, id: string): BlueprintApprovalRequest {
    return {
      id,
      ownerId,
      stableKey: `${ownerId}:bp-${id}:s1`,
      blueprintId: `bp-${id}`,
      stepId: 's1',
      action: 'publish',
      reason: 'class C',
      riskLevel: 'HIGH',
      reversibility: 'IRREVERSIBLE',
      authorityRequired: 'C',
      status: 'WAITING_FOR_APPROVAL',
      executed: false,
      createdAt: '2026-08-15T10:00:00.000Z',
      updatedAt: '2026-08-15T10:00:00.000Z',
    };
  }

  it('round-trips owner-scoped outcome evidence with stable-key idempotency', async () => {
    const store = new PostgresOutcomeEvidenceStore(createFakeSql());
    store.save(outcomeEvidence('u1', 'e1'));
    store.save(outcomeEvidence('u1', 'e1')); // idempotent upsert
    store.save(outcomeEvidence('u2', 'e1'));
    expect(store.list('u1')).toHaveLength(1);
    expect(store.list('u2')).toHaveLength(1);
    expect(store.get('u1', 'e1')?.kind).toBe('REVENUE');
    expect(store.getByKey('u1', 'u1:REVENUE:opp-e1')?.id).toBe('e1');
    expect(store.getByKey('u1', 'u2:REVENUE:opp-e1')).toBeUndefined();
    expect(store.listByKind('u1', 'REVENUE')).toHaveLength(1);
    expect(store.listByKind('u1', 'COST')).toHaveLength(0);
    store.remove('u1', 'e1');
    expect(store.get('u1', 'e1')).toBeUndefined();
    expect(store.get('u2', 'e1')).toBeDefined(); // other owner untouched
    await store.flush();
  });

  it('round-trips owner-scoped blueprint approval requests', async () => {
    const store = new PostgresBlueprintApprovalStore(createFakeSql());
    store.save(blueprintApproval('u1', 'a1'));
    store.save(blueprintApproval('u1', 'a1')); // idempotent upsert
    store.save(blueprintApproval('u2', 'a1'));
    expect(store.list('u1')).toHaveLength(1);
    expect(store.list('u2')).toHaveLength(1);
    expect(store.get('u1', 'a1')?.authorityRequired).toBe('C');
    expect(store.getByKey('u1', 'u1:bp-a1:s1')?.id).toBe('a1');
    expect(store.getByKey('u1', 'u2:bp-a1:s1')).toBeUndefined();
    store.remove('u1', 'a1');
    expect(store.get('u1', 'a1')).toBeUndefined();
    expect(store.get('u2', 'a1')).toBeDefined();
    await store.flush();
  });
});

describe('PostgresProblemStore (SPRINT-038)', () => {
  function problem(ownerId: string, id: string): BusinessProblem {
    return {
      id,
      ownerId,
      stableKey: `${ownerId}:bookkeeping`,
      problemStatement: 'SME bookkeeping takes hours weekly',
      evidence: [
        {
          id: `ev-${id}`,
          ownerId,
          source: 'customer_interview',
          observedAt: '2026-08-15T09:00:00Z',
          text: 'Owner spends 4 hours/week.',
          confidence: 'VERIFIED',
          evidenceOnly: true,
        },
      ],
      willingnessToPayEvidence: [],
      confidence: 'VERIFIED',
      status: 'OBSERVED',
      revenueState: 'NO_EVIDENCE',
      createdAt: '2026-08-15T10:00:00.000Z',
      updatedAt: '2026-08-15T10:00:00.000Z',
    };
  }

  it('round-trips owner-scoped problems with stable-key idempotency', async () => {
    const store = new PostgresProblemStore(createFakeSql());
    store.save(problem('u1', 'p1'));
    store.save(problem('u1', 'p1')); // idempotent upsert
    store.save(problem('u2', 'p1'));
    expect(store.list('u1')).toHaveLength(1);
    expect(store.list('u2')).toHaveLength(1);
    expect(store.get('u1', 'p1')?.revenueState).toBe('NO_EVIDENCE');
    expect(store.getByKey('u1', 'u1:bookkeeping')?.id).toBe('p1');
    expect(store.getByKey('u1', 'u2:bookkeeping')).toBeUndefined(); // IDOR
    store.remove('u1', 'p1');
    expect(store.get('u1', 'p1')).toBeUndefined();
    expect(store.get('u2', 'p1')).toBeDefined();
    await store.flush();
  });

  it('evicts oldest problems beyond the bounded per-owner limit', async () => {
    const store = new PostgresProblemStore(createFakeSql());
    for (let i = 0; i < WORLD_PROBLEM_LIMIT_PER_OWNER + 5; i += 1) {
      store.save(problem('u1', `p${String(i).padStart(3, '0')}`));
    }
    expect(store.list('u1').length).toBeLessThanOrEqual(WORLD_PROBLEM_LIMIT_PER_OWNER);
    await store.flush();
  });
});

describe('PostgresObservationStore / PostgresProspectStore (SPRINT-039)', () => {
  function observation(ownerId: string, id: string): FounderObservation {
    return {
      id,
      ownerId,
      problemId: 'p1',
      timestamp: '2026-08-15T09:30:00Z',
      sourceType: 'customer_conversation',
      sourceReference: 'clinic-owner-01',
      observedStatement: 'Four clinic owners said follow-up eats staff time.',
      evidenceState: 'REPORTED_BY_CUSTOMER',
      evidenceStrength: 'WEAK',
      provenance: {
        source: 'founder-interview',
        reference: 'call-1',
        observedAt: '2026-08-15T09:30:00Z',
      },
      verificationStatus: 'UNVERIFIED',
      createdAt: '2026-08-15T10:00:00.000Z',
      updatedAt: '2026-08-15T10:00:00.000Z',
    };
  }

  function prospect(ownerId: string, id: string): CustomerDiscoveryRecord {
    return {
      id,
      ownerId,
      problemId: 'p1',
      prospectReference: 'clinic-owner-01',
      customerSegment: 'clinics',
      problemDiscussed: 'follow-up',
      discoveryStatus: 'PROBLEM_CONFIRMED',
      evidence: [],
      provenance: { source: 'call', observedAt: '2026-08-15T09:30:00Z' },
      createdAt: '2026-08-15T10:00:00.000Z',
      updatedAt: '2026-08-15T10:00:00.000Z',
    };
  }

  it('round-trips owner-scoped observations with problem scoping', async () => {
    const store = new PostgresObservationStore(createFakeSql());
    store.save(observation('u1', 'o1'));
    store.save(observation('u1', 'o1')); // idempotent upsert
    store.save(observation('u2', 'o1'));
    expect(store.list('u1')).toHaveLength(1);
    expect(store.list('u2')).toHaveLength(1);
    expect(store.listByProblem('u1', 'p1')).toHaveLength(1);
    expect(store.listByProblem('u1', 'other')).toHaveLength(0);
    // Owner isolation: u2 sees ONLY its own record for the problem — never u1's.
    const u2rows = store.listByProblem('u2', 'p1');
    expect(u2rows).toHaveLength(1);
    expect(u2rows[0]?.ownerId).toBe('u2');
    expect(store.get('u2', 'o1')?.ownerId).toBe('u2');
    await store.flush();
  });

  it('round-trips owner-scoped prospect records with problem scoping', async () => {
    const store = new PostgresProspectStore(createFakeSql());
    store.save(prospect('u1', 'pr1'));
    store.save(prospect('u1', 'pr1')); // idempotent upsert
    store.save(prospect('u2', 'pr1'));
    expect(store.list('u1')).toHaveLength(1);
    expect(store.listByProblem('u1', 'p1')).toHaveLength(1);
    // Owner isolation: u2 sees ONLY its own prospect for the problem.
    const u2rows = store.listByProblem('u2', 'p1');
    expect(u2rows).toHaveLength(1);
    expect(u2rows[0]?.ownerId).toBe('u2');
    await store.flush();
  });

  it('bounds observations and prospects per owner', async () => {
    const obsStore = new PostgresObservationStore(createFakeSql());
    for (let i = 0; i < WORLD_OBSERVATION_LIMIT_PER_OWNER + 5; i += 1) {
      obsStore.save(observation('u1', `o${String(i).padStart(3, '0')}`));
    }
    expect(obsStore.list('u1').length).toBeLessThanOrEqual(WORLD_OBSERVATION_LIMIT_PER_OWNER);
    const proStore = new PostgresProspectStore(createFakeSql());
    for (let i = 0; i < WORLD_PROSPECT_LIMIT_PER_OWNER + 5; i += 1) {
      proStore.save(prospect('u1', `pr${String(i).padStart(3, '0')}`));
    }
    expect(proStore.list('u1').length).toBeLessThanOrEqual(WORLD_PROSPECT_LIMIT_PER_OWNER);
    await obsStore.flush();
    await proStore.flush();
  });
});

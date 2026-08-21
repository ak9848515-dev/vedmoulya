// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — World Model · InMemoryWorldStores
// SPRINT-032 — deterministic in-memory backend (dev/test convention). All
// stores are owner-scoped with bounded FIFO retention; documents are typed
// entities/relations/units/roles/workflows — never secrets.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  BlueprintApprovalRequest,
  BusinessProblem,
  BusinessUnit,
  BusinessWorkflow,
  CustomerDiscoveryRecord,
  FounderObservation,
  OrchestrationPlan,
  OutcomeEvidence,
  RevenueStream,
  RoleSpec,
  WorldEntity,
  WorldEntityType,
  WorldRelation,
} from '../types/world-types.js';
import type { WorldStores } from '../contracts/world-ports.js';
import {
  WORLD_ENTITY_LIMIT_PER_OWNER,
  WORLD_RELATION_LIMIT_PER_OWNER,
} from '../domain/WorldGraph.js';

export const WORLD_BUSINESS_UNIT_LIMIT_PER_OWNER = 20;
export const WORLD_ROLE_LIMIT_PER_OWNER = 50;
export const WORLD_WORKFLOW_LIMIT_PER_OWNER = 50;
export const WORLD_REVENUE_STREAM_LIMIT_PER_OWNER = 25;
export const WORLD_OUTCOME_EVIDENCE_LIMIT_PER_OWNER = 100;
export const WORLD_BLUEPRINT_APPROVAL_LIMIT_PER_OWNER = 100;
export const WORLD_ORCHESTRATION_PLAN_LIMIT_PER_OWNER = 50;
export const WORLD_PROBLEM_LIMIT_PER_OWNER = 50;
export const WORLD_OBSERVATION_LIMIT_PER_OWNER = 100;
export const WORLD_PROSPECT_LIMIT_PER_OWNER = 200;

export class InMemoryWorldStores implements WorldStores {
  readonly entities: WorldStores['entities'];
  readonly relations: WorldStores['relations'];
  readonly businessUnits: WorldStores['businessUnits'];
  readonly roles: WorldStores['roles'];
  readonly workflows: WorldStores['workflows'];
  readonly revenueStreams: WorldStores['revenueStreams'];
  readonly outcomeEvidence: WorldStores['outcomeEvidence'];
  readonly blueprintApprovals: WorldStores['blueprintApprovals'];
  readonly orchestrationPlans: WorldStores['orchestrationPlans'];
  readonly problems: WorldStores['problems'];
  readonly observations: WorldStores['observations'];
  readonly prospects: WorldStores['prospects'];

  constructor() {
    const entityMap = new Map<string, WorldEntity>();
    const relationMap = new Map<string, WorldRelation>();
    const unitMap = new Map<string, BusinessUnit>();
    const roleMap = new Map<string, RoleSpec>();
    const workflowMap = new Map<string, BusinessWorkflow>();
    const revenueMap = new Map<string, RevenueStream>();
    const evidenceMap = new Map<string, OutcomeEvidence>();
    const approvalMap = new Map<string, BlueprintApprovalRequest>();
    const orchestrationMap = new Map<string, OrchestrationPlan>();
    const problemMap = new Map<string, BusinessProblem>();

    this.entities = {
      save: (e): void => {
        entityMap.set(`${e.ownerId}:${e.id}`, e);
        // Bounded FIFO per owner (oldest evicted first).
        const owned = [...entityMap.values()].filter((x) => x.ownerId === e.ownerId);
        if (owned.length > WORLD_ENTITY_LIMIT_PER_OWNER) {
          const sorted = owned.sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
          for (const evicted of sorted.slice(0, owned.length - WORLD_ENTITY_LIMIT_PER_OWNER)) {
            entityMap.delete(`${evicted.ownerId}:${evicted.id}`);
          }
        }
      },
      get: (ownerId, id): WorldEntity | undefined => entityMap.get(`${ownerId}:${id}`),
      getByKey: (ownerId, stableKey): WorldEntity | undefined =>
        [...entityMap.values()].find((x) => x.ownerId === ownerId && x.stableKey === stableKey),
      list: (ownerId): WorldEntity[] =>
        [...entityMap.values()].filter((x) => x.ownerId === ownerId),
      listByType: (ownerId, type): WorldEntity[] =>
        [...entityMap.values()].filter((x) => x.ownerId === ownerId && x.type === type),
      count: (ownerId): number =>
        [...entityMap.values()].filter((x) => x.ownerId === ownerId).length,
      countByType: (ownerId): { type: WorldEntityType; count: number }[] => {
        const counts = new Map<WorldEntityType, number>();
        for (const entity of entityMap.values()) {
          if (entity.ownerId !== ownerId) continue;
          counts.set(entity.type, (counts.get(entity.type) ?? 0) + 1);
        }
        return [...counts.entries()].map(([type, count]) => ({ type, count }));
      },
      remove: (ownerId, id): void => {
        entityMap.delete(`${ownerId}:${id}`);
      },
    };

    this.relations = {
      save: (r): void => {
        relationMap.set(`${r.ownerId}:${r.id}`, r);
        const owned = [...relationMap.values()].filter((x) => x.ownerId === r.ownerId);
        if (owned.length > WORLD_RELATION_LIMIT_PER_OWNER) {
          const sorted = owned.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
          for (const evicted of sorted.slice(0, owned.length - WORLD_RELATION_LIMIT_PER_OWNER)) {
            relationMap.delete(`${evicted.ownerId}:${evicted.id}`);
          }
        }
      },
      getByKey: (ownerId, stableKey): WorldRelation | undefined =>
        [...relationMap.values()].find(
          (x) =>
            x.ownerId === ownerId && `${x.ownerId}:${x.type}:${x.fromId}:${x.toId}` === stableKey,
        ),
      list: (ownerId): WorldRelation[] =>
        [...relationMap.values()].filter((x) => x.ownerId === ownerId),
      count: (ownerId): number =>
        [...relationMap.values()].filter((x) => x.ownerId === ownerId).length,
      remove: (ownerId, id): void => {
        relationMap.delete(`${ownerId}:${id}`);
      },
    };

    this.businessUnits = {
      save: (u): void => {
        unitMap.set(`${u.ownerId}:${u.id}`, u);
        const owned = [...unitMap.values()].filter((x) => x.ownerId === u.ownerId);
        if (owned.length > WORLD_BUSINESS_UNIT_LIMIT_PER_OWNER) {
          const sorted = owned.sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
          for (const evicted of sorted.slice(
            0,
            owned.length - WORLD_BUSINESS_UNIT_LIMIT_PER_OWNER,
          )) {
            unitMap.delete(`${evicted.ownerId}:${evicted.id}`);
          }
        }
      },
      get: (ownerId, id): BusinessUnit | undefined => unitMap.get(`${ownerId}:${id}`),
      getByKey: (ownerId, stableKey): BusinessUnit | undefined =>
        [...unitMap.values()].find((x) => x.ownerId === ownerId && x.stableKey === stableKey),
      list: (ownerId): BusinessUnit[] => [...unitMap.values()].filter((x) => x.ownerId === ownerId),
      remove: (ownerId, id): void => {
        unitMap.delete(`${ownerId}:${id}`);
      },
    };

    this.roles = {
      save: (r): void => {
        roleMap.set(`${r.ownerId}:${r.id}`, r);
        const owned = [...roleMap.values()].filter((x) => x.ownerId === r.ownerId);
        if (owned.length > WORLD_ROLE_LIMIT_PER_OWNER) {
          const sorted = owned.sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
          for (const evicted of sorted.slice(0, owned.length - WORLD_ROLE_LIMIT_PER_OWNER)) {
            roleMap.delete(`${evicted.ownerId}:${evicted.id}`);
          }
        }
      },
      get: (ownerId, id): RoleSpec | undefined => roleMap.get(`${ownerId}:${id}`),
      getByKey: (ownerId, stableKey): RoleSpec | undefined =>
        [...roleMap.values()].find((x) => x.ownerId === ownerId && x.stableKey === stableKey),
      list: (ownerId): RoleSpec[] => [...roleMap.values()].filter((x) => x.ownerId === ownerId),
    };

    this.workflows = {
      save: (w): void => {
        workflowMap.set(`${w.ownerId}:${w.id}`, w);
        const owned = [...workflowMap.values()].filter((x) => x.ownerId === w.ownerId);
        if (owned.length > WORLD_WORKFLOW_LIMIT_PER_OWNER) {
          const sorted = owned.sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
          for (const evicted of sorted.slice(0, owned.length - WORLD_WORKFLOW_LIMIT_PER_OWNER)) {
            workflowMap.delete(`${evicted.ownerId}:${evicted.id}`);
          }
        }
      },
      get: (ownerId, id): BusinessWorkflow | undefined => workflowMap.get(`${ownerId}:${id}`),
      getByKey: (ownerId, stableKey): BusinessWorkflow | undefined =>
        [...workflowMap.values()].find((x) => x.ownerId === ownerId && x.stableKey === stableKey),
      list: (ownerId): BusinessWorkflow[] =>
        [...workflowMap.values()].filter((x) => x.ownerId === ownerId),
    };

    this.revenueStreams = {
      save: (s): void => {
        revenueMap.set(`${s.ownerId}:${s.id}`, s);
        const owned = [...revenueMap.values()].filter((x) => x.ownerId === s.ownerId);
        if (owned.length > WORLD_REVENUE_STREAM_LIMIT_PER_OWNER) {
          const sorted = owned.sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
          for (const evicted of sorted.slice(
            0,
            owned.length - WORLD_REVENUE_STREAM_LIMIT_PER_OWNER,
          )) {
            revenueMap.delete(`${evicted.ownerId}:${evicted.id}`);
          }
        }
      },
      get: (ownerId, id): RevenueStream | undefined => revenueMap.get(`${ownerId}:${id}`),
      getByKey: (ownerId, stableKey): RevenueStream | undefined =>
        [...revenueMap.values()].find((x) => x.ownerId === ownerId && x.stableKey === stableKey),
      list: (ownerId): RevenueStream[] =>
        [...revenueMap.values()].filter((x) => x.ownerId === ownerId),
      remove: (ownerId, id): void => {
        revenueMap.delete(`${ownerId}:${id}`);
      },
    };

    this.outcomeEvidence = {
      save: (e): void => {
        // Stable-key idempotency: same (kind, target) upserts, never duplicates.
        const existing = [...evidenceMap.values()].find(
          (x) => x.ownerId === e.ownerId && x.stableKey === e.stableKey,
        );
        if (existing) evidenceMap.delete(`${existing.ownerId}:${existing.id}`);
        evidenceMap.set(`${e.ownerId}:${e.id}`, e);
        const owned = [...evidenceMap.values()].filter((x) => x.ownerId === e.ownerId);
        if (owned.length > WORLD_OUTCOME_EVIDENCE_LIMIT_PER_OWNER) {
          const sorted = owned.sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));
          for (const evicted of sorted.slice(
            0,
            owned.length - WORLD_OUTCOME_EVIDENCE_LIMIT_PER_OWNER,
          )) {
            evidenceMap.delete(`${evicted.ownerId}:${evicted.id}`);
          }
        }
      },
      get: (ownerId, id): OutcomeEvidence | undefined => evidenceMap.get(`${ownerId}:${id}`),
      getByKey: (ownerId, stableKey): OutcomeEvidence | undefined =>
        [...evidenceMap.values()].find((x) => x.ownerId === ownerId && x.stableKey === stableKey),
      list: (ownerId): OutcomeEvidence[] =>
        [...evidenceMap.values()]
          .filter((x) => x.ownerId === ownerId)
          .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt)),
      listByKind: (ownerId, kind): OutcomeEvidence[] =>
        [...evidenceMap.values()].filter((x) => x.ownerId === ownerId && x.kind === kind),
      remove: (ownerId, id): void => {
        evidenceMap.delete(`${ownerId}:${id}`);
      },
    };

    this.blueprintApprovals = {
      save: (r): void => {
        // Stable-key idempotency: one request per (blueprint, step).
        const existing = [...approvalMap.values()].find(
          (x) => x.ownerId === r.ownerId && x.stableKey === r.stableKey,
        );
        if (existing) approvalMap.delete(`${existing.ownerId}:${existing.id}`);
        approvalMap.set(`${r.ownerId}:${r.id}`, r);
        const owned = [...approvalMap.values()].filter((x) => x.ownerId === r.ownerId);
        if (owned.length > WORLD_BLUEPRINT_APPROVAL_LIMIT_PER_OWNER) {
          const sorted = owned.sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
          for (const evicted of sorted.slice(
            0,
            owned.length - WORLD_BLUEPRINT_APPROVAL_LIMIT_PER_OWNER,
          )) {
            approvalMap.delete(`${evicted.ownerId}:${evicted.id}`);
          }
        }
      },
      get: (ownerId, id): BlueprintApprovalRequest | undefined =>
        approvalMap.get(`${ownerId}:${id}`),
      getByKey: (ownerId, stableKey): BlueprintApprovalRequest | undefined =>
        [...approvalMap.values()].find((x) => x.ownerId === ownerId && x.stableKey === stableKey),
      list: (ownerId): BlueprintApprovalRequest[] =>
        [...approvalMap.values()]
          .filter((x) => x.ownerId === ownerId)
          .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
      remove: (ownerId, id): void => {
        approvalMap.delete(`${ownerId}:${id}`);
      },
    };

    this.orchestrationPlans = {
      save: (p): void => {
        // Stable-key idempotency: one plan per (goal, strategy) — upsert.
        const existing = [...orchestrationMap.values()].find(
          (x) => x.ownerId === p.ownerId && x.stableKey === p.stableKey,
        );
        if (existing) orchestrationMap.delete(`${existing.ownerId}:${existing.id}`);
        orchestrationMap.set(`${p.ownerId}:${p.id}`, p);
        const owned = [...orchestrationMap.values()].filter((x) => x.ownerId === p.ownerId);
        if (owned.length > WORLD_ORCHESTRATION_PLAN_LIMIT_PER_OWNER) {
          const sorted = owned.sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
          for (const evicted of sorted.slice(
            0,
            owned.length - WORLD_ORCHESTRATION_PLAN_LIMIT_PER_OWNER,
          )) {
            orchestrationMap.delete(`${evicted.ownerId}:${evicted.id}`);
          }
        }
      },
      get: (ownerId, id): OrchestrationPlan | undefined => orchestrationMap.get(`${ownerId}:${id}`),
      getByKey: (ownerId, stableKey): OrchestrationPlan | undefined =>
        [...orchestrationMap.values()].find(
          (x) => x.ownerId === ownerId && x.stableKey === stableKey,
        ),
      list: (ownerId): OrchestrationPlan[] =>
        [...orchestrationMap.values()]
          .filter((x) => x.ownerId === ownerId)
          .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
      remove: (ownerId, id): void => {
        orchestrationMap.delete(`${ownerId}:${id}`);
      },
    };

    this.problems = {
      save: (p): void => {
        // Stable-key idempotency: one problem per (owner, statement) — upsert.
        const existing = [...problemMap.values()].find(
          (x) => x.ownerId === p.ownerId && x.stableKey === p.stableKey,
        );
        if (existing) problemMap.delete(`${existing.ownerId}:${existing.id}`);
        problemMap.set(`${p.ownerId}:${p.id}`, p);
        const owned = [...problemMap.values()].filter((x) => x.ownerId === p.ownerId);
        if (owned.length > WORLD_PROBLEM_LIMIT_PER_OWNER) {
          const sorted = owned.sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
          for (const evicted of sorted.slice(0, owned.length - WORLD_PROBLEM_LIMIT_PER_OWNER)) {
            problemMap.delete(`${evicted.ownerId}:${evicted.id}`);
          }
        }
      },
      get: (ownerId, id): BusinessProblem | undefined => problemMap.get(`${ownerId}:${id}`),
      getByKey: (ownerId, stableKey): BusinessProblem | undefined =>
        [...problemMap.values()].find((x) => x.ownerId === ownerId && x.stableKey === stableKey),
      list: (ownerId): BusinessProblem[] =>
        [...problemMap.values()]
          .filter((x) => x.ownerId === ownerId)
          .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
      remove: (ownerId, id): void => {
        problemMap.delete(`${ownerId}:${id}`);
      },
    };

    const observationMap = new Map<string, FounderObservation>();
    this.observations = {
      save: (o): void => {
        observationMap.set(`${o.ownerId}:${o.id}`, o);
        const owned = [...observationMap.values()].filter((x) => x.ownerId === o.ownerId);
        if (owned.length > WORLD_OBSERVATION_LIMIT_PER_OWNER) {
          const sorted = owned.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
          for (const evicted of sorted.slice(0, owned.length - WORLD_OBSERVATION_LIMIT_PER_OWNER)) {
            observationMap.delete(`${evicted.ownerId}:${evicted.id}`);
          }
        }
      },
      get: (ownerId, id): FounderObservation | undefined => observationMap.get(`${ownerId}:${id}`),
      list: (ownerId): FounderObservation[] =>
        [...observationMap.values()]
          .filter((x) => x.ownerId === ownerId)
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
      listByProblem: (ownerId, problemId): FounderObservation[] =>
        [...observationMap.values()]
          .filter((x) => x.ownerId === ownerId && x.problemId === problemId)
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
      remove: (ownerId, id): void => {
        observationMap.delete(`${ownerId}:${id}`);
      },
    };

    const prospectMap = new Map<string, CustomerDiscoveryRecord>();
    this.prospects = {
      save: (r): void => {
        prospectMap.set(`${r.ownerId}:${r.id}`, r);
        const owned = [...prospectMap.values()].filter((x) => x.ownerId === r.ownerId);
        if (owned.length > WORLD_PROSPECT_LIMIT_PER_OWNER) {
          const sorted = owned.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
          for (const evicted of sorted.slice(0, owned.length - WORLD_PROSPECT_LIMIT_PER_OWNER)) {
            prospectMap.delete(`${evicted.ownerId}:${evicted.id}`);
          }
        }
      },
      get: (ownerId, id): CustomerDiscoveryRecord | undefined =>
        prospectMap.get(`${ownerId}:${id}`),
      list: (ownerId): CustomerDiscoveryRecord[] =>
        [...prospectMap.values()]
          .filter((x) => x.ownerId === ownerId)
          .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
      listByProblem: (ownerId, problemId): CustomerDiscoveryRecord[] =>
        [...prospectMap.values()]
          .filter((x) => x.ownerId === ownerId && x.problemId === problemId)
          .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
      remove: (ownerId, id): void => {
        prospectMap.delete(`${ownerId}:${id}`);
      },
    };
  }
}

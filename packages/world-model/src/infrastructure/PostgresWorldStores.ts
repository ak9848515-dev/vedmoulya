// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — World Model · PostgresWorldStores
// SPRINT-032 — durable owner-scoped stores over the shared @vedmoulya/core
// WriteThroughDocumentStore base (sync mirror + async idempotent write-through
// + boot hydrate + shutdown flush). Owner isolation by query construction
// (PRIMARY KEY (owner, key)) + bounded FIFO retention. Documents are typed
// entities/relations/units/roles/workflows — never secrets.
//
// NOTE: the base class exposes a protected `remove(owner, key)` (mirror +
// scheduled DB delete). The store PORT method is also named `remove` — the
// public override forwards to the base via `super.remove(...)` so the port
// semantics are exactly the base's (no recursion, no shadowing).
// ─────────────────────────────────────────────────────────────────────────────

import type postgres from 'postgres';
import { WriteThroughDocumentStore } from '@vedmoulya/core';
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
import {
  WORLD_ENTITY_LIMIT_PER_OWNER,
  WORLD_RELATION_LIMIT_PER_OWNER,
} from '../domain/WorldGraph.js';
import {
  WORLD_BLUEPRINT_APPROVAL_LIMIT_PER_OWNER,
  WORLD_BUSINESS_UNIT_LIMIT_PER_OWNER,
  WORLD_OBSERVATION_LIMIT_PER_OWNER,
  WORLD_ORCHESTRATION_PLAN_LIMIT_PER_OWNER,
  WORLD_OUTCOME_EVIDENCE_LIMIT_PER_OWNER,
  WORLD_PROBLEM_LIMIT_PER_OWNER,
  WORLD_PROSPECT_LIMIT_PER_OWNER,
  WORLD_REVENUE_STREAM_LIMIT_PER_OWNER,
  WORLD_ROLE_LIMIT_PER_OWNER,
  WORLD_WORKFLOW_LIMIT_PER_OWNER,
} from './InMemoryWorldStores.js';

/** Owner-scoped world entities — keyed (owner, entity id). */
export class PostgresWorldEntityStore extends WriteThroughDocumentStore<WorldEntity> {
  constructor(sql: postgres.Sql, table = 'world_entities') {
    super(sql, table);
  }
  save(entity: WorldEntity): void {
    this.write(entity.ownerId, entity.id, entity);
    this.prune(
      entity.ownerId,
      WORLD_ENTITY_LIMIT_PER_OWNER,
      (e) => e.updatedAt,
      (e) => e.id,
    );
  }
  get(ownerId: string, id: string): WorldEntity | undefined {
    return this.read(ownerId, id);
  }
  getByKey(ownerId: string, stableKey: string): WorldEntity | undefined {
    return this.all(ownerId).find((e) => e.stableKey === stableKey);
  }
  list(ownerId: string): WorldEntity[] {
    return this.all(ownerId).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }
  listByType(ownerId: string, type: string): WorldEntity[] {
    return this.all(ownerId).filter((e) => e.type === type);
  }
  count(ownerId: string): number {
    return this.all(ownerId).length;
  }
  countByType(ownerId: string): { type: WorldEntityType; count: number }[] {
    const counts = new Map<WorldEntityType, number>();
    for (const entity of this.all(ownerId)) {
      counts.set(entity.type, (counts.get(entity.type) ?? 0) + 1);
    }
    return [...counts.entries()].map(([type, count]) => ({ type, count }));
  }
  /** Port remove — forwards to the base (mirror + scheduled DB delete). */
  override remove(ownerId: string, id: string): void {
    super.remove(ownerId, id);
  }
}

/** Owner-scoped world relations — keyed (owner, relation id). */
export class PostgresWorldRelationStore extends WriteThroughDocumentStore<WorldRelation> {
  constructor(sql: postgres.Sql, table = 'world_relations') {
    super(sql, table);
  }
  save(relation: WorldRelation): void {
    this.write(relation.ownerId, relation.id, relation);
    this.prune(
      relation.ownerId,
      WORLD_RELATION_LIMIT_PER_OWNER,
      (r) => r.createdAt,
      (r) => r.id,
    );
  }
  getByKey(ownerId: string, stableKey: string): WorldRelation | undefined {
    return this.all(ownerId).find(
      (r) => `${r.ownerId}:${r.type}:${r.fromId}:${r.toId}` === stableKey,
    );
  }
  list(ownerId: string): WorldRelation[] {
    return this.all(ownerId).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
  count(ownerId: string): number {
    return this.all(ownerId).length;
  }
  override remove(ownerId: string, id: string): void {
    super.remove(ownerId, id);
  }
}

/** Owner-scoped business units — keyed (owner, unit id). */
export class PostgresBusinessUnitStore extends WriteThroughDocumentStore<BusinessUnit> {
  constructor(sql: postgres.Sql, table = 'world_business_units') {
    super(sql, table);
  }
  save(unit: BusinessUnit): void {
    this.write(unit.ownerId, unit.id, unit);
    this.prune(
      unit.ownerId,
      WORLD_BUSINESS_UNIT_LIMIT_PER_OWNER,
      (u) => u.updatedAt,
      (u) => u.id,
    );
  }
  get(ownerId: string, id: string): BusinessUnit | undefined {
    return this.read(ownerId, id);
  }
  getByKey(ownerId: string, stableKey: string): BusinessUnit | undefined {
    return this.all(ownerId).find((u) => u.stableKey === stableKey);
  }
  list(ownerId: string): BusinessUnit[] {
    return this.all(ownerId).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }
  override remove(ownerId: string, id: string): void {
    super.remove(ownerId, id);
  }
}

/** Owner-scoped AI workforce roles — keyed (owner, role id). */
export class PostgresRoleStore extends WriteThroughDocumentStore<RoleSpec> {
  constructor(sql: postgres.Sql, table = 'world_roles') {
    super(sql, table);
  }
  save(role: RoleSpec): void {
    this.write(role.ownerId, role.id, role);
    this.prune(
      role.ownerId,
      WORLD_ROLE_LIMIT_PER_OWNER,
      (r) => r.updatedAt,
      (r) => r.id,
    );
  }
  get(ownerId: string, id: string): RoleSpec | undefined {
    return this.read(ownerId, id);
  }
  getByKey(ownerId: string, stableKey: string): RoleSpec | undefined {
    return this.all(ownerId).find((r) => r.stableKey === stableKey);
  }
  list(ownerId: string): RoleSpec[] {
    return this.all(ownerId).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }
}

/** Owner-scoped business workflows — keyed (owner, workflow id). */
export class PostgresWorkflowStore extends WriteThroughDocumentStore<BusinessWorkflow> {
  constructor(sql: postgres.Sql, table = 'world_workflows') {
    super(sql, table);
  }
  save(workflow: BusinessWorkflow): void {
    this.write(workflow.ownerId, workflow.id, workflow);
    this.prune(
      workflow.ownerId,
      WORLD_WORKFLOW_LIMIT_PER_OWNER,
      (w) => w.updatedAt,
      (w) => w.id,
    );
  }
  get(ownerId: string, id: string): BusinessWorkflow | undefined {
    return this.read(ownerId, id);
  }
  getByKey(ownerId: string, stableKey: string): BusinessWorkflow | undefined {
    return this.all(ownerId).find((w) => w.stableKey === stableKey);
  }
  list(ownerId: string): BusinessWorkflow[] {
    return this.all(ownerId).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }
}

/** Owner-scoped revenue streams — keyed (owner, stream id). SPRINT-033
 *  (Part F) — evidence-carrying revenue/cost/effort, never secrets. */
export class PostgresRevenueStreamStore extends WriteThroughDocumentStore<RevenueStream> {
  constructor(sql: postgres.Sql, table = 'world_revenue_streams') {
    super(sql, table);
  }
  save(stream: RevenueStream): void {
    this.write(stream.ownerId, stream.id, stream);
    this.prune(
      stream.ownerId,
      WORLD_REVENUE_STREAM_LIMIT_PER_OWNER,
      (s) => s.updatedAt,
      (s) => s.id,
    );
  }
  get(ownerId: string, id: string): RevenueStream | undefined {
    return this.read(ownerId, id);
  }
  getByKey(ownerId: string, stableKey: string): RevenueStream | undefined {
    return this.all(ownerId).find((s) => s.stableKey === stableKey);
  }
  list(ownerId: string): RevenueStream[] {
    return this.all(ownerId).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }
  override remove(ownerId: string, id: string): void {
    super.remove(ownerId, id);
  }
}

/** Owner-scoped outcome evidence — keyed (owner, evidence id). SPRINT-034
 *  — the ONLY verified outcome data that may influence future scoring. */
export class PostgresOutcomeEvidenceStore extends WriteThroughDocumentStore<OutcomeEvidence> {
  constructor(sql: postgres.Sql, table = 'world_outcome_evidence') {
    super(sql, table);
  }
  save(evidence: OutcomeEvidence): void {
    // Stable-key idempotency — upsert, never duplicate.
    const existing = this.getByKey(evidence.ownerId, evidence.stableKey);
    if (existing) this.remove(evidence.ownerId, existing.id);
    this.write(evidence.ownerId, evidence.id, evidence);
    this.prune(
      evidence.ownerId,
      WORLD_OUTCOME_EVIDENCE_LIMIT_PER_OWNER,
      (e) => e.recordedAt,
      (e) => e.id,
    );
  }
  get(ownerId: string, id: string): OutcomeEvidence | undefined {
    return this.read(ownerId, id);
  }
  getByKey(ownerId: string, stableKey: string): OutcomeEvidence | undefined {
    return this.all(ownerId).find((e) => e.stableKey === stableKey);
  }
  list(ownerId: string): OutcomeEvidence[] {
    return this.all(ownerId).sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
  }
  listByKind(ownerId: string, kind: string): OutcomeEvidence[] {
    return this.all(ownerId).filter((e) => e.kind === kind);
  }
  override remove(ownerId: string, id: string): void {
    super.remove(ownerId, id);
  }
}

/** Owner-scoped blueprint approval requests — keyed (owner, request id).
 *  SPRINT-034 — decisions recorded ONLY through the existing authority. */
export class PostgresBlueprintApprovalStore extends WriteThroughDocumentStore<BlueprintApprovalRequest> {
  constructor(sql: postgres.Sql, table = 'world_blueprint_approvals') {
    super(sql, table);
  }
  save(request: BlueprintApprovalRequest): void {
    const existing = this.getByKey(request.ownerId, request.stableKey);
    if (existing) this.remove(request.ownerId, existing.id);
    this.write(request.ownerId, request.id, request);
    this.prune(
      request.ownerId,
      WORLD_BLUEPRINT_APPROVAL_LIMIT_PER_OWNER,
      (r) => r.updatedAt,
      (r) => r.id,
    );
  }
  get(ownerId: string, id: string): BlueprintApprovalRequest | undefined {
    return this.read(ownerId, id);
  }
  getByKey(ownerId: string, stableKey: string): BlueprintApprovalRequest | undefined {
    return this.all(ownerId).find((r) => r.stableKey === stableKey);
  }
  list(ownerId: string): BlueprintApprovalRequest[] {
    return this.all(ownerId).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }
  override remove(ownerId: string, id: string): void {
    super.remove(ownerId, id);
  }
}

/** Owner-scoped multi-provider orchestration plans — keyed (owner, plan id).
 *  SPRINT-036 — REPRESENTATIONS only (`executed:false` structural); stable-key
 *  idempotency (goal + strategy upserts, never duplicates). */
export class PostgresOrchestrationPlanStore extends WriteThroughDocumentStore<OrchestrationPlan> {
  constructor(sql: postgres.Sql, table = 'world_orchestration_plans') {
    super(sql, table);
  }
  save(plan: OrchestrationPlan): void {
    const existing = this.getByKey(plan.ownerId, plan.stableKey);
    if (existing) this.remove(plan.ownerId, existing.id);
    this.write(plan.ownerId, plan.id, plan);
    this.prune(
      plan.ownerId,
      WORLD_ORCHESTRATION_PLAN_LIMIT_PER_OWNER,
      (p) => p.updatedAt,
      (p) => p.id,
    );
  }
  get(ownerId: string, id: string): OrchestrationPlan | undefined {
    return this.read(ownerId, id);
  }
  getByKey(ownerId: string, stableKey: string): OrchestrationPlan | undefined {
    return this.all(ownerId).find((p) => p.stableKey === stableKey);
  }
  list(ownerId: string): OrchestrationPlan[] {
    return this.all(ownerId).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }
  override remove(ownerId: string, id: string): void {
    super.remove(ownerId, id);
  }
}

/** Owner-scoped practical business problems — keyed (owner, problem id).
 *  SPRINT-038 — evidence/provenance-REQUIRED, stable-key idempotency
 *  (owner + problem statement upserts, never duplicates); revenue evidence
 *  lives ON the problem (verified payments are evidence records, never
 *  claims). Never secrets. */
export class PostgresProblemStore extends WriteThroughDocumentStore<BusinessProblem> {
  constructor(sql: postgres.Sql, table = 'world_problems') {
    super(sql, table);
  }
  save(problem: BusinessProblem): void {
    const existing = this.getByKey(problem.ownerId, problem.stableKey);
    if (existing) this.remove(problem.ownerId, existing.id);
    this.write(problem.ownerId, problem.id, problem);
    this.prune(
      problem.ownerId,
      WORLD_PROBLEM_LIMIT_PER_OWNER,
      (p) => p.updatedAt,
      (p) => p.id,
    );
  }
  get(ownerId: string, id: string): BusinessProblem | undefined {
    return this.read(ownerId, id);
  }
  getByKey(ownerId: string, stableKey: string): BusinessProblem | undefined {
    return this.all(ownerId).find((p) => p.stableKey === stableKey);
  }
  list(ownerId: string): BusinessProblem[] {
    return this.all(ownerId).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }
  override remove(ownerId: string, id: string): void {
    super.remove(ownerId, id);
  }
}

/** Founder observations (SPRINT-039 Part B) — owner-scoped, bounded FIFO,
 *  provenance-MANDATORY. Never secrets. */
export class PostgresObservationStore extends WriteThroughDocumentStore<FounderObservation> {
  constructor(sql: postgres.Sql, table = 'world_observations') {
    super(sql, table);
  }
  save(observation: FounderObservation): void {
    this.write(observation.ownerId, observation.id, observation);
    this.prune(
      observation.ownerId,
      WORLD_OBSERVATION_LIMIT_PER_OWNER,
      (o) => o.createdAt,
      (o) => o.id,
    );
  }
  get(ownerId: string, id: string): FounderObservation | undefined {
    return this.read(ownerId, id);
  }
  list(ownerId: string): FounderObservation[] {
    return this.all(ownerId).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
  listByProblem(ownerId: string, problemId: string): FounderObservation[] {
    return this.all(ownerId)
      .filter((o) => o.problemId === problemId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
  override remove(ownerId: string, id: string): void {
    super.remove(ownerId, id);
  }
}

/** Customer-discovery ledger (SPRINT-039 Part C) — owner-scoped, bounded FIFO,
 *  NOT a CRM. Discovery ≠ validation. Never secrets. */
export class PostgresProspectStore extends WriteThroughDocumentStore<CustomerDiscoveryRecord> {
  constructor(sql: postgres.Sql, table = 'world_prospects') {
    super(sql, table);
  }
  save(record: CustomerDiscoveryRecord): void {
    this.write(record.ownerId, record.id, record);
    this.prune(
      record.ownerId,
      WORLD_PROSPECT_LIMIT_PER_OWNER,
      (r) => r.updatedAt,
      (r) => r.id,
    );
  }
  get(ownerId: string, id: string): CustomerDiscoveryRecord | undefined {
    return this.read(ownerId, id);
  }
  list(ownerId: string): CustomerDiscoveryRecord[] {
    return this.all(ownerId).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }
  listByProblem(ownerId: string, problemId: string): CustomerDiscoveryRecord[] {
    return this.all(ownerId)
      .filter((r) => r.problemId === problemId)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }
  override remove(ownerId: string, id: string): void {
    super.remove(ownerId, id);
  }
}

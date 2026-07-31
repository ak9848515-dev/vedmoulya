// ──────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Execution Repository
// Concrete implementation of ExecutionRepository using Drizzle ORM
// BLD-009 — Execution Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import { eq, and, count, sql, inArray, lte, gte } from 'drizzle-orm';
import type {
  ExecutionPlan,
  ExecutionSearchParams,
  PaginationParams,
  PaginatedResult,
  PlanningLevel,
  ExecutionRepository,
} from '@vedmoulya/domain';
import {
  ExecutionFactory,
  ExecutionStatus,
  ExecutionPriority,
  ExecutionTimeline,
  ExecutionContext,
  ExecutionMission,
  ExecutionTask,
} from '@vedmoulya/domain';
import { executionPlans } from '../../schema/execution.js';
import type { ExecutionPlanRow } from '../../schema/execution.js';
import { getDatabase } from './DatabaseConnection.js';
import { BaseRepository } from '@vedmoulya/core';

export class PostgresExecutionRepository extends BaseRepository implements ExecutionRepository {
  constructor() {
    super('execution');
  }

  async findById(id: string): Promise<ExecutionPlan | null> {
    const db = getDatabase();
    const rows = await db.select().from(executionPlans).where(eq(executionPlans.id, id)).limit(1);
    const row = rows[0];
    return row ? this.rowToPlan(row) : null;
  }

  async findByPlanningLevel(
    level: PlanningLevel,
    params: PaginationParams,
  ): Promise<PaginatedResult<ExecutionPlan>> {
    const db = getDatabase();
    const offset = (params.page - 1) * params.limit;
    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(executionPlans)
        .where(eq(executionPlans.planningLevel, level))
        .limit(params.limit)
        .offset(offset)
        .orderBy(executionPlans.createdAt),
      db
        .select({ count: count() })
        .from(executionPlans)
        .where(eq(executionPlans.planningLevel, level)),
    ]);
    return {
      data: rows.map((r) => this.rowToPlan(r)),
      total: totalResult[0]?.count ?? 0,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil((totalResult[0]?.count ?? 0) / params.limit),
    };
  }

  async findByStatus(
    status: string,
    params: PaginationParams,
  ): Promise<PaginatedResult<ExecutionPlan>> {
    const db = getDatabase();
    const offset = (params.page - 1) * params.limit;
    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(executionPlans)
        .where(eq(executionPlans.status, status))
        .limit(params.limit)
        .offset(offset)
        .orderBy(executionPlans.createdAt),
      db.select({ count: count() }).from(executionPlans).where(eq(executionPlans.status, status)),
    ]);
    return {
      data: rows.map((r) => this.rowToPlan(r)),
      total: totalResult[0]?.count ?? 0,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil((totalResult[0]?.count ?? 0) / params.limit),
    };
  }

  async save(plan: ExecutionPlan): Promise<void> {
    const db = getDatabase();
    await db.insert(executionPlans).values(this.planToRow(plan));
    this.logger.info('Execution plan saved', { planId: plan.id });
  }

  async update(plan: ExecutionPlan): Promise<void> {
    const db = getDatabase();
    await db.update(executionPlans).set(this.planToRow(plan)).where(eq(executionPlans.id, plan.id));
    this.logger.info('Execution plan updated', { planId: plan.id });
  }

  async delete(id: string): Promise<void> {
    const db = getDatabase();
    await db.delete(executionPlans).where(eq(executionPlans.id, id));
  }

  async exists(id: string): Promise<boolean> {
    const db = getDatabase();
    const r = await db
      .select({ count: count() })
      .from(executionPlans)
      .where(eq(executionPlans.id, id));
    return (r[0]?.count ?? 0) > 0;
  }

  async search(
    params: ExecutionSearchParams,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ExecutionPlan>> {
    const db = getDatabase();
    const offset = (pagination.page - 1) * pagination.limit;
    const conditions: ReturnType<typeof sql>[] = [];
    if (params.query) {
      const p = `%${params.query}%`;
      conditions.push(
        sql`(${executionPlans.title} ILIKE ${p} OR ${executionPlans.description} ILIKE ${p})`,
      );
    }
    if (params.planningLevels?.length) {
      const vals = params.planningLevels.map((l) => `'${l}'`).join(', ');
      conditions.push(sql`${executionPlans.planningLevel} IN (${sql.raw(vals)})`);
    }
    if (params.statuses?.length) {
      const vals = params.statuses.map((s) => `'${s}'`).join(', ');
      conditions.push(sql`${executionPlans.status} IN (${sql.raw(vals)})`);
    }
    if (params.priorityMin !== undefined)
      conditions.push(gte(executionPlans.priorityScore, params.priorityMin));
    if (params.priorityMax !== undefined)
      conditions.push(lte(executionPlans.priorityScore, params.priorityMax));
    if (params.tags?.length) conditions.push(sql`${executionPlans.tags} && ${params.tags}`);
    if (params.goalId)
      conditions.push(
        sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${executionPlans.goalReferences}) AS gr WHERE gr->>'goalId' = ${params.goalId})`,
      );
    if (params.decisionId)
      conditions.push(
        sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${executionPlans.decisionReferences}) AS dr WHERE dr->>'decisionId' = ${params.decisionId})`,
      );
    const whereClause =
      conditions.length > 0
        ? conditions.length === 1
          ? conditions[0]
          : and(conditions[0], ...conditions.slice(1))
        : undefined;
    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(executionPlans)
        .where(whereClause)
        .limit(pagination.limit)
        .offset(offset)
        .orderBy(executionPlans.createdAt),
      db.select({ count: count() }).from(executionPlans).where(whereClause),
    ]);
    return {
      data: rows.map((r) => this.rowToPlan(r)),
      total: totalResult[0]?.count ?? 0,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil((totalResult[0]?.count ?? 0) / pagination.limit),
    };
  }

  async findByGoalId(goalId: string): Promise<ExecutionPlan[]> {
    const db = getDatabase();
    const rows = await db
      .select()
      .from(executionPlans)
      .where(
        sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${executionPlans.goalReferences}) AS gr WHERE gr->>'goalId' = ${goalId})`,
      )
      .orderBy(executionPlans.createdAt);
    return rows.map((r) => this.rowToPlan(r));
  }

  async findByDecisionId(decisionId: string): Promise<ExecutionPlan[]> {
    const db = getDatabase();
    const rows = await db
      .select()
      .from(executionPlans)
      .where(
        sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${executionPlans.decisionReferences}) AS dr WHERE dr->>'decisionId' = ${decisionId})`,
      )
      .orderBy(executionPlans.createdAt);
    return rows.map((r) => this.rowToPlan(r));
  }

  async findActivePlans(params: PaginationParams): Promise<PaginatedResult<ExecutionPlan>> {
    const db = getDatabase();
    const offset = (params.page - 1) * params.limit;
    const activeStatuses = ['ready', 'in_progress'];
    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(executionPlans)
        .where(inArray(executionPlans.status, activeStatuses))
        .limit(params.limit)
        .offset(offset)
        .orderBy(executionPlans.priorityScore),
      db
        .select({ count: count() })
        .from(executionPlans)
        .where(inArray(executionPlans.status, activeStatuses)),
    ]);
    return {
      data: rows.map((r) => this.rowToPlan(r)),
      total: totalResult[0]?.count ?? 0,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil((totalResult[0]?.count ?? 0) / params.limit),
    };
  }

  async findRecentlyCompleted(limit: number): Promise<ExecutionPlan[]> {
    const db = getDatabase();
    const rows = await db
      .select()
      .from(executionPlans)
      .where(eq(executionPlans.status, 'completed'))
      .limit(limit)
      .orderBy(sql`${executionPlans.updatedAt} DESC`);
    return rows.map((r) => this.rowToPlan(r));
  }

  async count(): Promise<number> {
    const db = getDatabase();
    const r = await db.select({ count: count() }).from(executionPlans);
    return r[0]?.count ?? 0;
  }

  async countByPlanningLevel(): Promise<Record<PlanningLevel, number>> {
    const db = getDatabase();
    const rows = await db
      .select({ level: executionPlans.planningLevel, count: count() })
      .from(executionPlans)
      .groupBy(executionPlans.planningLevel);
    const result = {} as Record<PlanningLevel, number>;
    for (const r of rows) result[r.level as PlanningLevel] = r.count;
    return result;
  }

  async countByStatus(): Promise<Record<string, number>> {
    const db = getDatabase();
    const rows = await db
      .select({ status: executionPlans.status, count: count() })
      .from(executionPlans)
      .groupBy(executionPlans.status);
    const result = {} as Record<string, number>;
    for (const r of rows) result[r.status] = r.count;
    return result;
  }

  async countActive(): Promise<number> {
    const db = getDatabase();
    const r = await db
      .select({ count: count() })
      .from(executionPlans)
      .where(inArray(executionPlans.status, ['ready', 'in_progress']));
    return r[0]?.count ?? 0;
  }

  async countOverdue(): Promise<number> {
    const db = getDatabase();
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const r = await db
      .select({ count: count() })
      .from(executionPlans)
      .where(
        and(
          inArray(executionPlans.status, ['in_progress', 'ready']),
          lte(executionPlans.updatedAt, threeDaysAgo),
        ),
      );
    return r[0]?.count ?? 0;
  }

  // ── JSONB Reconstruction Helpers ───────────────────────────────────────
  // String() on JSONB data is safe — drizzle returns primitives from DB columns
  /* eslint-disable @typescript-eslint/no-base-to-string */

  private reconstructMissions(data: unknown): ExecutionMission[] | undefined {
    if (!Array.isArray(data) || data.length === 0) return undefined;
    return data.map(
      (m: Record<string, unknown>) =>
        new ExecutionMission({
          id: String(m.id ?? crypto.randomUUID()),
          label: String(m.label ?? ''),
          description: String(m.description ?? ''),
          status: ExecutionStatus.fromStatus(String(m.status ?? 'pending')),
          priority: ExecutionPriority.fromLevel(String(m.priorityLevel ?? 'medium')),
          planId: String(m.planId ?? ''),
          tags: Array.isArray(m.tags) ? m.tags.map(String) : undefined,
        }),
    );
  }

  private reconstructTasks(data: unknown): ExecutionTask[] | undefined {
    if (!Array.isArray(data) || data.length === 0) return undefined;
    return data.map(
      (t: Record<string, unknown>) =>
        new ExecutionTask({
          id: String(t.id ?? crypto.randomUUID()),
          label: String(t.label ?? ''),
          description: String(t.description ?? ''),
          status: ExecutionStatus.fromStatus(String(t.status ?? 'pending')),
          priority: ExecutionPriority.fromLevel(String(t.priorityLevel ?? 'medium')),
          estimatedDuration:
            typeof t.estimatedDuration === 'number' ? t.estimatedDuration : undefined,
          missionId: t.missionId ? String(t.missionId) : undefined,
          tags: Array.isArray(t.tags) ? t.tags.map(String) : undefined,
        }),
    );
  }

  private reconstructTimeline(data: unknown): ExecutionTimeline | undefined {
    if (!data || typeof data !== 'object') return undefined;
    const obj = data as Record<string, unknown>;
    const entries = Array.isArray(obj.entries) ? obj.entries : [];
    if (entries.length === 0) return undefined;
    let timeline = ExecutionTimeline.empty();
    for (const e of entries as Array<Record<string, unknown>>) {
      timeline = timeline.addEntry(
        String(e.eventType ?? 'unknown'),
        String(e.description ?? ''),
        String(e.entityId ?? ''),
        String(e.entityType ?? 'unknown'),
      );
    }
    return timeline;
  }

  private reconstructContext(data: unknown): ExecutionContext | undefined {
    if (!data || typeof data !== 'object') return undefined;
    const obj = data as Record<string, unknown>;
    return new ExecutionContext({
      energyLevel: typeof obj.energyLevel === 'number' ? obj.energyLevel : undefined,
      timeAvailable: typeof obj.timeAvailable === 'number' ? obj.timeAvailable : undefined,
      location: obj.location ? String(obj.location) : undefined,
      resources: Array.isArray(obj.resources) ? obj.resources.map(String) : undefined,
      interruptions: Array.isArray(obj.interruptions) ? obj.interruptions.map(String) : undefined,
      focusScore: typeof obj.focusScore === 'number' ? obj.focusScore : undefined,
    });
  }
  /* eslint-enable @typescript-eslint/no-base-to-string */

  private rowToPlan(row: ExecutionPlanRow): ExecutionPlan {
    return ExecutionFactory.reconstructPlan({
      id: row.id,
      title: row.title,
      description: row.description,
      planningLevel: row.planningLevel,
      status: row.status,
      statusReason: row.statusReason ?? undefined,
      priorityLevel: row.priorityLevel,
      priorityScore: row.priorityScore,
      completedCount: row.progressCompleted,
      totalCount: row.progressTotal,
      missions: this.reconstructMissions(row.missions),
      tasks: this.reconstructTasks(row.tasks),
      timeline: this.reconstructTimeline(row.timeline),
      context: this.reconstructContext(row.context),
      goalReferences: Array.isArray(row.goalReferences)
        ? (
            row.goalReferences as Array<{ goalId: string; label: string; description?: string }>
          ).map((g) => ({ goalId: g.goalId, label: g.label, description: g.description ?? '' }))
        : undefined,
      decisionReferences: Array.isArray(row.decisionReferences)
        ? (
            row.decisionReferences as Array<{
              decisionId: string;
              title: string;
              selectedOption?: string;
            }>
          ).map((d) => ({
            decisionId: d.decisionId,
            title: d.title,
            selectedOption: d.selectedOption ?? '',
          }))
        : undefined,
      knowledgeNodeIds: row.knowledgeNodeIds ?? [],
      memoryIds: row.memoryIds ?? [],
      tags: row.tags ?? [],
      metadata: (row.metadata ?? undefined) as Record<string, unknown> | undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      completedAt: row.completedAt ?? undefined,
    });
  }

  private planToRow(plan: ExecutionPlan): typeof executionPlans.$inferInsert {
    return {
      id: plan.id,
      title: plan.title,
      description: plan.description,
      planningLevel: plan.planningLevel,
      status: plan.status.toString(),
      statusReason: null,
      priorityLevel: plan.priority.level,
      priorityScore: plan.priority.score,
      progressCompleted: plan.progress.completed,
      progressTotal: plan.progress.total,
      goalReferences: plan.goalReferences.map((g) => ({
        goalId: g.goalId,
        label: g.label,
        description: g.description,
      })),
      decisionReferences: plan.decisionReferences.map((d) => ({
        decisionId: d.decisionId,
        title: d.title,
        selectedOption: d.selectedOption,
      })),
      knowledgeNodeIds: [...plan.knowledgeNodeIds],
      memoryIds: [...plan.memoryIds],
      missions: plan.missions.map((m) => ({
        id: m.id,
        label: m.label,
        description: m.description,
        status: m.status.value,
        priorityLevel: m.priority.level,
        planId: m.planId,
        tags: [...m.tags],
      })),
      tasks: plan.tasks.map((t) => ({
        id: t.id,
        label: t.label,
        description: t.description,
        status: t.status.value,
        priorityLevel: t.priority.level,
        estimatedDuration: t.estimatedDuration,
        missionId: t.missionId,
        tags: [...t.tags],
      })),
      timeline: {
        entries: plan.timeline.entries.map((e) => ({
          eventType: e.eventType,
          timestamp: e.timestamp,
          description: e.description,
          entityId: e.entityId,
          entityType: e.entityType,
        })),
      },
      context: {
        energyLevel: plan.context.energyLevel,
        timeAvailable: plan.context.timeAvailable,
        location: plan.context.location,
        resources: [...plan.context.resources],
        interruptions: [...plan.context.interruptions],
        focusScore: plan.context.focusScore,
      },
      entityStatus: 'active',
      tags: [...plan.tags],
      metadata: plan.metadata,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      completedAt: plan.completedAt ?? null,
    };
  }
}

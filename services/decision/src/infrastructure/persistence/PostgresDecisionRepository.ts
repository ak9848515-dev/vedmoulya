// ──────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Decision Repository
// Concrete implementation of DecisionRepository using Drizzle ORM
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { eq, and, count, sql, inArray, lte, gte } from 'drizzle-orm';
import { BaseRepository, type PaginationParams, type PaginatedResult } from '@vedmoulya/core';
import type {
  Decision,
  DecisionId,
  DecisionCategory,
  DecisionStatusValue,
  DecisionRepository,
  DecisionSearchParams,
} from '@vedmoulya/domain';
import { DecisionFactory } from '@vedmoulya/domain';
import { decisions } from '../../schema/decision.js';
import type { DecisionRow } from '../../schema/decision.js';
import { getDatabase } from './DatabaseConnection.js';

export class PostgresDecisionRepository extends BaseRepository implements DecisionRepository {
  constructor() {
    super('decision');
  }

  // ── CRUD Operations ──────────────────────────────────────────────────────

  async findById(id: DecisionId): Promise<Decision | null> {
    const db = getDatabase();
    const rows = await db.select().from(decisions).where(eq(decisions.id, id)).limit(1);
    const row = rows[0];
    return row ? this.rowToDecision(row) : null;
  }

  async findByCategory(
    category: DecisionCategory,
    params: PaginationParams,
  ): Promise<PaginatedResult<Decision>> {
    const db = getDatabase();
    const offset = (params.page - 1) * params.limit;

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(decisions)
        .where(eq(decisions.category, category))
        .limit(params.limit)
        .offset(offset)
        .orderBy(decisions.createdAt),
      db.select({ count: count() }).from(decisions).where(eq(decisions.category, category)),
    ]);

    const total = totalResult[0]?.count ?? 0;
    return {
      data: rows.map((row: DecisionRow) => this.rowToDecision(row)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async findByStatus(
    status: DecisionStatusValue,
    params: PaginationParams,
  ): Promise<PaginatedResult<Decision>> {
    const db = getDatabase();
    const offset = (params.page - 1) * params.limit;

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(decisions)
        .where(eq(decisions.status, status))
        .limit(params.limit)
        .offset(offset)
        .orderBy(decisions.createdAt),
      db.select({ count: count() }).from(decisions).where(eq(decisions.status, status)),
    ]);

    const total = totalResult[0]?.count ?? 0;
    return {
      data: rows.map((row: DecisionRow) => this.rowToDecision(row)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async save(decision: Decision): Promise<void> {
    const db = getDatabase();
    const row = this.decisionToRow(decision);
    await db.insert(decisions).values(row);
    this.logger.info('Decision saved', { decisionId: decision.id });
  }

  async update(decision: Decision): Promise<void> {
    const db = getDatabase();
    const row = this.decisionToRow(decision);
    await db.update(decisions).set(row).where(eq(decisions.id, decision.id));
    this.logger.info('Decision updated', { decisionId: decision.id });
  }

  async delete(id: DecisionId): Promise<void> {
    const db = getDatabase();
    await db.delete(decisions).where(eq(decisions.id, id));
    this.logger.info('Decision deleted', { decisionId: id });
  }

  async exists(id: DecisionId): Promise<boolean> {
    const db = getDatabase();
    const result = await db.select({ count: count() }).from(decisions).where(eq(decisions.id, id));
    return (result[0]?.count ?? 0) > 0;
  }

  // ── Search ───────────────────────────────────────────────────────────────

  async search(
    params: DecisionSearchParams,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Decision>> {
    const db = getDatabase();
    const offset = (pagination.page - 1) * pagination.limit;

    // Build SQL conditions
    const sqlConditions: ReturnType<typeof sql>[] = [];

    if (params.query) {
      const pattern = `%${params.query}%`;
      sqlConditions.push(
        sql`(${decisions.title} ILIKE ${pattern} OR ${decisions.description} ILIKE ${pattern})`,
      );
    }
    if (params.categories && params.categories.length > 0) {
      const cats = params.categories.map((c) => `'${c}'`).join(', ');
      sqlConditions.push(sql`${decisions.category} IN (${sql.raw(cats)})`);
    }
    if (params.statuses && params.statuses.length > 0) {
      const sts = params.statuses.map((s) => `'${s}'`).join(', ');
      sqlConditions.push(sql`${decisions.status} IN (${sql.raw(sts)})`);
    }
    if (params.tags && params.tags.length > 0) {
      const tagArr = params.tags;
      sqlConditions.push(sql`${decisions.tags} && ${tagArr}`);
    }
    if (params.priorityMin !== undefined) {
      sqlConditions.push(gte(decisions.priorityScore, params.priorityMin));
    }
    if (params.priorityMax !== undefined) {
      sqlConditions.push(lte(decisions.priorityScore, params.priorityMax));
    }
    if (params.knowledgeNodeId) {
      sqlConditions.push(sql`${params.knowledgeNodeId} = ANY(${decisions.knowledgeNodeIds})`);
    }
    if (params.memoryId) {
      sqlConditions.push(sql`${params.memoryId} = ANY(${decisions.memoryIds})`);
    }

    const whereClause =
      sqlConditions.length > 0
        ? sqlConditions.length === 1
          ? sqlConditions[0]
          : and(sqlConditions[0], ...sqlConditions.slice(1))
        : undefined;

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(decisions)
        .where(whereClause)
        .limit(pagination.limit)
        .offset(offset)
        .orderBy(decisions.createdAt),
      db.select({ count: count() }).from(decisions).where(whereClause),
    ]);

    const total = totalResult[0]?.count ?? 0;
    return {
      data: rows.map((row: DecisionRow) => this.rowToDecision(row)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async findByKnowledgeNodeId(knowledgeNodeId: string): Promise<Decision[]> {
    const db = getDatabase();
    const rows = await db
      .select()
      .from(decisions)
      .where(sql`${knowledgeNodeId} = ANY(${decisions.knowledgeNodeIds})`)
      .orderBy(decisions.createdAt);
    return rows.map((row: DecisionRow) => this.rowToDecision(row));
  }

  async findByMemoryId(memoryId: string): Promise<Decision[]> {
    const db = getDatabase();
    const rows = await db
      .select()
      .from(decisions)
      .where(sql`${memoryId} = ANY(${decisions.memoryIds})`)
      .orderBy(decisions.createdAt);
    return rows.map((row: DecisionRow) => this.rowToDecision(row));
  }

  async findPendingDecisions(params: PaginationParams): Promise<PaginatedResult<Decision>> {
    const db = getDatabase();
    const offset = (params.page - 1) * params.limit;

    const pendingStatuses = ['requested', 'analyzing'];
    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(decisions)
        .where(inArray(decisions.status, pendingStatuses))
        .limit(params.limit)
        .offset(offset)
        .orderBy(decisions.priorityScore),
      db
        .select({ count: count() })
        .from(decisions)
        .where(inArray(decisions.status, pendingStatuses)),
    ]);

    const total = totalResult[0]?.count ?? 0;
    return {
      data: rows.map((row: DecisionRow) => this.rowToDecision(row)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async findRecentlyCompleted(limit: number): Promise<Decision[]> {
    const db = getDatabase();
    const rows = await db
      .select()
      .from(decisions)
      .where(eq(decisions.status, 'completed'))
      .limit(limit)
      .orderBy(sql`${decisions.updatedAt} DESC`);
    return rows.map((row: DecisionRow) => this.rowToDecision(row));
  }

  // ── Statistics ───────────────────────────────────────────────────────────

  async count(): Promise<number> {
    const db = getDatabase();
    const rows: Array<{ count: number }> = await db.select({ count: count() }).from(decisions);
    return rows[0]?.count ?? 0;
  }

  async countByCategory(): Promise<Record<DecisionCategory, number>> {
    const db = getDatabase();
    const rows = await db
      .select({ category: decisions.category, count: count() })
      .from(decisions)
      .groupBy(decisions.category);

    const result = {} as Record<DecisionCategory, number>;
    for (const row of rows) {
      result[row.category as DecisionCategory] = row.count;
    }
    return result;
  }

  async countByStatus(): Promise<Record<DecisionStatusValue, number>> {
    const db = getDatabase();
    const rows = await db
      .select({ status: decisions.status, count: count() })
      .from(decisions)
      .groupBy(decisions.status);

    const result = {} as Record<DecisionStatusValue, number>;
    for (const row of rows) {
      result[row.status as DecisionStatusValue] = row.count;
    }
    return result;
  }

  async countLinked(): Promise<number> {
    const db = getDatabase();
    const linked: Array<{ count: number }> = await db
      .select({ count: count() })
      .from(decisions)
      .where(
        sql`${decisions.knowledgeNodeIds} IS NOT NULL AND array_length(${decisions.knowledgeNodeIds}, 1) > 0`,
      );
    return linked[0]?.count ?? 0;
  }

  // ── Mapping Helpers ─────────────────────────────────────────────────────

  private rowToDecision(row: DecisionRow): Decision {
    return DecisionFactory.reconstructDecision({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      status: row.status,
      statusReason: row.statusReason ?? undefined,
      priorityLevel: row.priorityLevel,
      priorityScore: row.priorityScore,
      confidenceLevel: row.confidenceLevel,
      confidenceScore: row.confidenceScore,
      versionMajor: row.versionMajor,
      versionMinor: row.versionMinor,
      versionPatch: row.versionPatch,
      initiator: row.initiator,
      selectedOptionId: row.selectedOptionId ?? undefined,
      knowledgeNodeIds: row.knowledgeNodeIds ?? [],
      memoryIds: row.memoryIds ?? [],
      tags: row.tags ?? [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      completedAt: row.completedAt ?? undefined,
    });
  }

  private decisionToRow(decision: Decision): typeof decisions.$inferInsert {
    return {
      id: decision.id,
      title: decision.title,
      description: decision.description,
      category: decision.category,
      status: decision.status.toString(),
      statusReason: null,
      priorityLevel: decision.priority.level,
      priorityScore: decision.priority.score,
      confidenceLevel: decision.confidence.level,
      confidenceScore: decision.confidence.score,
      versionMajor: decision.version.major,
      versionMinor: decision.version.minor,
      versionPatch: decision.version.patch,
      initiator: decision.initiator,
      requester: decision.request?.requester ?? null,
      requestReason: decision.request?.reason ?? null,
      requestContext: decision.request?.context ?? null,
      selectedOptionId: decision.selectedOptionId ?? null,
      reasoningMethod: decision.reasoning?.method ?? null,
      reasoningSummary: decision.reasoning?.summary ?? null,
      reasoningAssumptions: decision.reasoning?.assumptions ?? [],
      reasoningPros: decision.reasoning?.pros ?? [],
      reasoningCons: decision.reasoning?.cons ?? [],
      outcomeResult: decision.outcome?.result ?? null,
      outcomeDescription: decision.outcome?.description ?? null,
      outcomeActualImpact: decision.outcome?.actualImpact ?? null,
      outcomeLessons: decision.outcome?.lessons ?? [],
      knowledgeNodeIds: [...decision.knowledgeNodeIds],
      memoryIds: [...decision.memoryIds],
      options: decision.options.map((o) => ({
        id: o.id,
        label: o.label,
        description: o.description,
        pros: [...o.pros],
        cons: [...o.cons],
        estimatedEffort: o.estimatedEffort,
        estimatedCost: o.estimatedCost,
        score: o.score
          ? {
              overall: o.score.overall,
              criteria: [...o.score.criteria],
            }
          : null,
        risk: o.risk
          ? {
              level: o.risk.level,
              score: o.risk.score,
              description: o.risk.description,
              mitigation: o.risk.mitigation,
            }
          : null,
        opportunity: o.opportunity
          ? {
              level: o.opportunity.level,
              score: o.opportunity.score,
              description: o.opportunity.description,
              expectedValue: o.opportunity.expectedValue,
            }
          : null,
      })),
      evidence: decision.evidence.map((e) => ({
        id: e.id,
        type: e.type,
        source: e.source,
        content: e.content,
        relevanceScore: e.relevanceScore,
        timestamp: e.timestamp,
      })),

      constraints: decision.constraints.map((c) => ({
        type: c.type,
        category: c.category,
        description: c.description,
        isHard: c.isHard,
      })),
      entityStatus: 'active',
      tags: [...decision.tags],
      metadata: decision.metadata,
      createdAt: decision.createdAt,
      updatedAt: decision.updatedAt,
      completedAt: decision.completedAt ?? null,
    };
  }
}

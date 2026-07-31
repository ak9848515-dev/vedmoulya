// ──────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Memory Repository
// Concrete implementation of MemoryRepository using Drizzle ORM
// ARC-003/ARC-004 — Memory Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import { eq, and, count, sql } from 'drizzle-orm';
import { BaseRepository, type PaginationParams, type PaginatedResult } from '@vedmoulya/core';
import type {
  Memory,
  MemoryId,
  MemoryCategoryValue,
  MemoryStateValue,
  MemoryRepository,
  MemorySearchParams,
  TimelineEntry,
  TimelineOrder,
} from '@vedmoulya/domain';
import { MemoryFactory } from '@vedmoulya/domain';
import { memories } from '../../schema/memory.js';
import type { MemoryRow } from '../../schema/memory.js';
import { getDatabase } from './DatabaseConnection.js';

export class PostgresMemoryRepository extends BaseRepository implements MemoryRepository {
  constructor() {
    super('memory');
  }

  // ── CRUD Operations ──────────────────────────────────────────────────────

  async findById(id: MemoryId): Promise<Memory | null> {
    const db = getDatabase();
    const rows = await db.select().from(memories).where(eq(memories.id, id)).limit(1);
    const row = rows[0];
    return row ? this.rowToMemory(row) : null;
  }

  async findByCategory(
    category: MemoryCategoryValue,
    params: PaginationParams,
  ): Promise<PaginatedResult<Memory>> {
    const db = getDatabase();
    const offset = (params.page - 1) * params.limit;

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(memories)
        .where(eq(memories.category, category))
        .limit(params.limit)
        .offset(offset)
        .orderBy(memories.createdAt),
      db.select({ count: count() }).from(memories).where(eq(memories.category, category)),
    ]);

    const total = totalResult[0]?.count ?? 0;
    return {
      data: rows.map((row: MemoryRow) => this.rowToMemory(row)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async findByState(
    state: MemoryStateValue,
    params: PaginationParams,
  ): Promise<PaginatedResult<Memory>> {
    const db = getDatabase();
    const offset = (params.page - 1) * params.limit;

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(memories)
        .where(eq(memories.state, state))
        .limit(params.limit)
        .offset(offset)
        .orderBy(memories.createdAt),
      db.select({ count: count() }).from(memories).where(eq(memories.state, state)),
    ]);

    const total = totalResult[0]?.count ?? 0;
    return {
      data: rows.map((row: MemoryRow) => this.rowToMemory(row)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async save(memory: Memory): Promise<void> {
    const db = getDatabase();
    const row = this.memoryToRow(memory);
    await db.insert(memories).values(row);
    this.logger.info('Memory saved', { memoryId: memory.id });
  }

  async update(memory: Memory): Promise<void> {
    const db = getDatabase();
    const row = this.memoryToRow(memory);
    await db.update(memories).set(row).where(eq(memories.id, memory.id));
    this.logger.info('Memory updated', { memoryId: memory.id });
  }

  async delete(id: MemoryId): Promise<void> {
    const db = getDatabase();
    await db.delete(memories).where(eq(memories.id, id));
    this.logger.info('Memory deleted', { memoryId: id });
  }

  async exists(id: MemoryId): Promise<boolean> {
    const db = getDatabase();
    const result = await db.select({ count: count() }).from(memories).where(eq(memories.id, id));
    return (result[0]?.count ?? 0) > 0;
  }

  // ── Search ───────────────────────────────────────────────────────────────

  async search(
    params: MemorySearchParams,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Memory>> {
    const db = getDatabase();
    const offset = (pagination.page - 1) * pagination.limit;

    // Build SQL conditions
    const sqlConditions: ReturnType<typeof sql>[] = [];

    if (params.query) {
      const pattern = `%${params.query}%`;
      sqlConditions.push(
        sql`(${memories.label} ILIKE ${pattern} OR ${memories.content} ILIKE ${pattern})`,
      );
    }
    if (params.categories && params.categories.length > 0) {
      const cats = params.categories.map((c) => `'${c}'`).join(', ');
      sqlConditions.push(sql`${memories.category} IN (${sql.raw(cats)})`);
    }
    if (params.states && params.states.length > 0) {
      const sts = params.states.map((s) => `'${s}'`).join(', ');
      sqlConditions.push(sql`${memories.state} IN (${sql.raw(sts)})`);
    }
    if (params.tags && params.tags.length > 0) {
      const tagArr = params.tags;
      sqlConditions.push(sql`${memories.tags} && ${tagArr}`);
    }
    if (params.knowledgeNodeId) {
      sqlConditions.push(sql`${memories.knowledgeNodeId} = ${params.knowledgeNodeId}`);
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
        .from(memories)
        .where(whereClause)
        .limit(pagination.limit)
        .offset(offset)
        .orderBy(memories.importanceScore),
      db.select({ count: count() }).from(memories).where(whereClause),
    ]);

    const total = totalResult[0]?.count ?? 0;
    return {
      data: rows.map((row: MemoryRow) => this.rowToMemory(row)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async getTimeline(order: TimelineOrder, pagination: PaginationParams): Promise<TimelineEntry[]> {
    const db = getDatabase();
    const offset = (pagination.page - 1) * pagination.limit;

    const rows = await db
      .select()
      .from(memories)
      .limit(pagination.limit)
      .offset(offset)
      .orderBy(order === 'desc' ? sql`${memories.updatedAt} DESC` : sql`${memories.updatedAt} ASC`);

    return rows.map((row: MemoryRow) => ({
      memory: this.rowToMemory(row),
      date: row.updatedAt,
      type: 'updated' as const,
    }));
  }

  async findByKnowledgeNodeId(knowledgeNodeId: string): Promise<Memory[]> {
    const db = getDatabase();
    const rows = await db
      .select()
      .from(memories)
      .where(eq(memories.knowledgeNodeId, knowledgeNodeId))
      .orderBy(memories.createdAt);
    return rows.map((row: MemoryRow) => this.rowToMemory(row));
  }

  async findDecayingMemories(params: PaginationParams): Promise<PaginatedResult<Memory>> {
    const db = getDatabase();
    const offset = (params.page - 1) * params.limit;

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(memories)
        .where(
          and(
            sql`${memories.freshnessScore} < 0.3`,
            sql`${memories.state} != 'archived'`,
            sql`${memories.state} != 'forgotten'`,
          ),
        )
        .limit(params.limit)
        .offset(offset)
        .orderBy(memories.freshnessScore),
      db
        .select({ count: count() })
        .from(memories)
        .where(
          and(
            sql`${memories.freshnessScore} < 0.3`,
            sql`${memories.state} != 'archived'`,
            sql`${memories.state} != 'forgotten'`,
          ),
        ),
    ]);

    const total = totalResult[0]?.count ?? 0;
    return {
      data: rows.map((row: MemoryRow) => this.rowToMemory(row)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async findMemoriesNeedingReinforcement(
    params: PaginationParams,
  ): Promise<PaginatedResult<Memory>> {
    const db = getDatabase();
    const offset = (params.page - 1) * params.limit;

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(memories)
        .where(
          and(
            sql`${memories.strengthScore} < 0.5`,
            sql`${memories.importanceScore} >= 5`,
            sql`${memories.state} = 'active'`,
          ),
        )
        .limit(params.limit)
        .offset(offset)
        .orderBy(memories.strengthScore),
      db
        .select({ count: count() })
        .from(memories)
        .where(
          and(
            sql`${memories.strengthScore} < 0.5`,
            sql`${memories.importanceScore} >= 5`,
            sql`${memories.state} = 'active'`,
          ),
        ),
    ]);

    const total = totalResult[0]?.count ?? 0;
    return {
      data: rows.map((row: MemoryRow) => this.rowToMemory(row)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async findRelatedMemories(
    category: MemoryCategoryValue,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Memory>> {
    return this.findByCategory(category, pagination);
  }

  // ── Statistics ───────────────────────────────────────────────────────────

  async count(): Promise<number> {
    const db = getDatabase();
    const result = await db.select({ count: count() }).from(memories);
    return result[0]?.count ?? 0;
  }

  async countByCategory(): Promise<Record<MemoryCategoryValue, number>> {
    const db = getDatabase();
    const rows = await db
      .select({ category: memories.category, count: count() })
      .from(memories)
      .groupBy(memories.category);

    const result = {} as Record<MemoryCategoryValue, number>;
    for (const row of rows) {
      result[row.category as MemoryCategoryValue] = row.count;
    }
    return result;
  }

  async countByState(): Promise<Record<MemoryStateValue, number>> {
    const db = getDatabase();
    const rows = await db
      .select({ state: memories.state, count: count() })
      .from(memories)
      .groupBy(memories.state);

    const result = {} as Record<MemoryStateValue, number>;
    for (const row of rows) {
      result[row.state as MemoryStateValue] = row.count;
    }
    return result;
  }

  async countLinked(): Promise<number> {
    const db = getDatabase();
    const result = await db
      .select({ count: count() })
      .from(memories)
      .where(sql`${memories.knowledgeNodeId} IS NOT NULL`);
    return result[0]?.count ?? 0;
  }

  // ── Mapping Helpers ─────────────────────────────────────────────────────

  private rowToMemory(row: MemoryRow): Memory {
    return MemoryFactory.reconstructMemory({
      id: row.id,
      category: row.category,
      title: row.label,
      content: row.content,
      importanceScore: row.importanceScore,
      importanceLevel: row.importanceLevel,
      confidenceScore: row.confidenceScore,
      confidenceLevel: row.confidenceLevel,
      strength: row.strengthScore,
      state: row.state,
      stateReason: row.stateReason ?? undefined,
      sourceType: row.sourceType,
      sourceDetail: row.sourceDetail ?? undefined,
      versionMajor: row.versionMajor,
      versionMinor: row.versionMinor,
      versionPatch: row.versionPatch,
      retentionClass: row.retentionClass,
      knowledgeNodeId: row.knowledgeNodeId ?? undefined,
      tags: row.tags ?? [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastRecalledAt: row.lastRecalledAt ?? undefined,
    });
  }

  private memoryToRow(memory: Memory): typeof memories.$inferInsert {
    return {
      id: memory.id,
      category: memory.category.value,
      label: memory.title,
      content: memory.content,
      description: null,
      metadata: memory.metadata,
      tags: [...memory.tags],
      sourceType: memory.source.type,
      sourceDetail: memory.source.detail,
      sourceTimestamp: memory.source.timestamp,
      importanceLevel: memory.importance.level,
      importanceScore: memory.importance.score,
      confidenceLevel: memory.confidence.level,
      confidenceScore: memory.confidence.score,
      strengthScore: memory.strength.value,
      freshnessScore: 0.5,
      state: memory.state.state,
      stateReason: memory.state.reason ?? null,
      versionMajor: memory.version.major,
      versionMinor: memory.version.minor,
      versionPatch: memory.version.patch,
      knowledgeNodeId: memory.knowledgeNodeId ?? null,
      knowledgeEdgeId: null,
      retentionClass: memory.retentionPolicy.retentionClass,
      retentionTtlDays: memory.retentionPolicy.ttlDays,
      expiresAt: null,
      recallCount: 0,
      lastRecalledAt: memory.lastRecalledAt ?? null,
      entityStatus: memory.entityStatus,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
    };
  }
}

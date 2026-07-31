// ──────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Knowledge Repository
// Concrete implementation of KnowledgeRepository using Drizzle ORM
// ARC-003 — Knowledge Graph Bounded Context
// ──────────────────────────────────────────────────────────────────

import { eq, like, and, count, sql } from 'drizzle-orm';
import { BaseRepository, type PaginationParams, type PaginatedResult } from '@vedmoulya/core';
import type {
  KnowledgeRepository,
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeNodeId,
  KnowledgeEdgeId,
  GraphId,
  KnowledgeCategoryValue,
  RelationshipCategory,
  KnowledgeSourceType,
} from '@vedmoulya/domain';
import {
  KnowledgeEdge as KnowledgeEdgeEntity,
  KnowledgeFactory,
  RelationshipType,
  KnowledgeConfidence,
  KnowledgeStatus,
  KnowledgeSource,
  KnowledgeGraph,
} from '@vedmoulya/domain';
import { knowledgeNodes, knowledgeEdges, knowledgeGraphs } from '../../schema/knowledge.js';
import type {
  KnowledgeNodeRow,
  KnowledgeEdgeRow,
  KnowledgeGraphRow,
} from '../../schema/knowledge.js';
import { getDatabase } from './DatabaseConnection.js';

export class PostgresKnowledgeRepository extends BaseRepository implements KnowledgeRepository {
  constructor() {
    super('knowledge');
  }

  // ── Node Operations ──────────────────────────────────────────────────────

  async findNodeById(id: KnowledgeNodeId): Promise<KnowledgeNode | null> {
    const db = getDatabase();
    const rows = await db.select().from(knowledgeNodes).where(eq(knowledgeNodes.id, id)).limit(1);
    const row = rows[0];
    return row ? this.rowToNode(row) : null;
  }

  async findNodesByCategory(
    category: KnowledgeCategoryValue,
    params: PaginationParams,
  ): Promise<PaginatedResult<KnowledgeNode>> {
    const db = getDatabase();
    const offset = (params.page - 1) * params.limit;

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(knowledgeNodes)
        .where(eq(knowledgeNodes.category, category))
        .limit(params.limit)
        .offset(offset)
        .orderBy(knowledgeNodes.createdAt),
      db
        .select({ count: count() })
        .from(knowledgeNodes)
        .where(eq(knowledgeNodes.category, category)),
    ]);

    const total = totalResult[0]?.count ?? 0;
    return {
      data: rows.map((row: KnowledgeNodeRow) => this.rowToNode(row)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async findNodesByLabel(
    label: string,
    params: PaginationParams,
  ): Promise<PaginatedResult<KnowledgeNode>> {
    const db = getDatabase();
    const offset = (params.page - 1) * params.limit;

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(knowledgeNodes)
        .where(like(knowledgeNodes.label, `%${label}%`))
        .limit(params.limit)
        .offset(offset)
        .orderBy(knowledgeNodes.createdAt),
      db
        .select({ count: count() })
        .from(knowledgeNodes)
        .where(like(knowledgeNodes.label, `%${label}%`)),
    ]);

    const total = totalResult[0]?.count ?? 0;
    return {
      data: rows.map((row: KnowledgeNodeRow) => this.rowToNode(row)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async findNodesByGraph(
    graphId: GraphId,
    params: PaginationParams,
  ): Promise<PaginatedResult<KnowledgeNode>> {
    const db = getDatabase();
    const offset = (params.page - 1) * params.limit;

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(knowledgeNodes)
        .where(eq(knowledgeNodes.graphId, graphId))
        .limit(params.limit)
        .offset(offset)
        .orderBy(knowledgeNodes.createdAt),
      db.select({ count: count() }).from(knowledgeNodes).where(eq(knowledgeNodes.graphId, graphId)),
    ]);

    const total = totalResult[0]?.count ?? 0;
    return {
      data: rows.map((row: KnowledgeNodeRow) => this.rowToNode(row)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async saveNode(node: KnowledgeNode): Promise<void> {
    const db = getDatabase();
    const row = this.nodeToRow(node);
    await db.insert(knowledgeNodes).values(row);
    this.logger.info('Node saved', { nodeId: node.id });
  }

  async updateNode(node: KnowledgeNode): Promise<void> {
    const db = getDatabase();
    const row = this.nodeToRow(node);
    await db.update(knowledgeNodes).set(row).where(eq(knowledgeNodes.id, node.id));
    this.logger.info('Node updated', { nodeId: node.id });
  }

  async deleteNode(id: KnowledgeNodeId): Promise<void> {
    const db = getDatabase();
    await db.delete(knowledgeNodes).where(eq(knowledgeNodes.id, id));
    this.logger.info('Node deleted', { nodeId: id });
  }

  async nodeExists(id: KnowledgeNodeId): Promise<boolean> {
    const db = getDatabase();
    const result = await db
      .select({ count: count() })
      .from(knowledgeNodes)
      .where(eq(knowledgeNodes.id, id));
    return (result[0]?.count ?? 0) > 0;
  }

  // ── Edge Operations ──────────────────────────────────────────────────────

  async findEdgeById(id: KnowledgeEdgeId): Promise<KnowledgeEdge | null> {
    const db = getDatabase();
    const rows = await db.select().from(knowledgeEdges).where(eq(knowledgeEdges.id, id)).limit(1);
    const row = rows[0];
    return row ? this.rowToEdge(row) : null;
  }

  async findEdgesBetween(
    sourceId: KnowledgeNodeId,
    targetId: KnowledgeNodeId,
  ): Promise<KnowledgeEdge[]> {
    const db = getDatabase();
    const rows = await db
      .select()
      .from(knowledgeEdges)
      .where(and(eq(knowledgeEdges.sourceId, sourceId), eq(knowledgeEdges.targetId, targetId)));
    return rows.map((row: KnowledgeEdgeRow) => this.rowToEdge(row));
  }

  async findEdgesForNode(nodeId: KnowledgeNodeId): Promise<KnowledgeEdge[]> {
    const db = getDatabase();
    const rows = await db
      .select()
      .from(knowledgeEdges)
      .where(sql`${knowledgeEdges.sourceId} = ${nodeId} OR ${knowledgeEdges.targetId} = ${nodeId}`);
    return rows.map((row: KnowledgeEdgeRow) => this.rowToEdge(row));
  }

  async findEdgesByType(
    type: string,
    params: PaginationParams,
  ): Promise<PaginatedResult<KnowledgeEdge>> {
    const db = getDatabase();
    const offset = (params.page - 1) * params.limit;

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(knowledgeEdges)
        .where(eq(knowledgeEdges.type, type))
        .limit(params.limit)
        .offset(offset)
        .orderBy(knowledgeEdges.createdAt),
      db.select({ count: count() }).from(knowledgeEdges).where(eq(knowledgeEdges.type, type)),
    ]);

    const total = totalResult[0]?.count ?? 0;
    return {
      data: rows.map((row: KnowledgeEdgeRow) => this.rowToEdge(row)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async findEdgesByCategory(
    category: RelationshipCategory,
    params: PaginationParams,
  ): Promise<PaginatedResult<KnowledgeEdge>> {
    const db = getDatabase();
    const offset = (params.page - 1) * params.limit;

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(knowledgeEdges)
        .where(eq(knowledgeEdges.typeCategory, category))
        .limit(params.limit)
        .offset(offset)
        .orderBy(knowledgeEdges.createdAt),
      db
        .select({ count: count() })
        .from(knowledgeEdges)
        .where(eq(knowledgeEdges.typeCategory, category)),
    ]);

    const total = totalResult[0]?.count ?? 0;
    return {
      data: rows.map((row: KnowledgeEdgeRow) => this.rowToEdge(row)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async saveEdge(edge: KnowledgeEdge): Promise<void> {
    const db = getDatabase();
    const row = this.edgeToRow(edge);
    await db.insert(knowledgeEdges).values(row);
    this.logger.info('Edge saved', { edgeId: edge.id });
  }

  async updateEdge(edge: KnowledgeEdge): Promise<void> {
    const db = getDatabase();
    const row = this.edgeToRow(edge);
    await db.update(knowledgeEdges).set(row).where(eq(knowledgeEdges.id, edge.id));
    this.logger.info('Edge updated', { edgeId: edge.id });
  }

  async deleteEdge(id: KnowledgeEdgeId): Promise<void> {
    const db = getDatabase();
    await db.delete(knowledgeEdges).where(eq(knowledgeEdges.id, id));
    this.logger.info('Edge deleted', { edgeId: id });
  }

  async edgeExists(id: KnowledgeEdgeId): Promise<boolean> {
    const db = getDatabase();
    const result = await db
      .select({ count: count() })
      .from(knowledgeEdges)
      .where(eq(knowledgeEdges.id, id));
    return (result[0]?.count ?? 0) > 0;
  }

  // ── Graph Operations ─────────────────────────────────────────────────────

  async findGraphById(id: GraphId): Promise<KnowledgeGraph | null> {
    const db = getDatabase();
    const rows = await db.select().from(knowledgeGraphs).where(eq(knowledgeGraphs.id, id)).limit(1);
    const row = rows[0];
    if (!row) return null;

    const graph = new KnowledgeGraph({
      graphId: row.id as GraphId,
      label: row.label,
      description: row.description ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });

    // Load nodes and edges into the graph
    const [nodes, edges] = await Promise.all([
      db.select().from(knowledgeNodes).where(eq(knowledgeNodes.graphId, id)),
      db.select().from(knowledgeEdges).where(eq(knowledgeEdges.graphId, id)),
    ]);

    for (const n of nodes) {
      const node = this.rowToNode(n);
      try {
        graph.addNode(node);
      } catch {
        /* skip duplicate */
      }
    }
    for (const e of edges) {
      const edge = this.rowToEdge(e);
      try {
        graph.addEdge(edge);
      } catch {
        /* skip duplicate */
      }
    }

    return graph;
  }

  async findAllGraphs(params: PaginationParams): Promise<PaginatedResult<KnowledgeGraph>> {
    const db = getDatabase();
    const offset = (params.page - 1) * params.limit;

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(knowledgeGraphs)
        .limit(params.limit)
        .offset(offset)
        .orderBy(knowledgeGraphs.createdAt),
      db.select({ count: count() }).from(knowledgeGraphs),
    ]);
    const total = totalResult[0]?.count ?? 0;
    const graphs = rows.map(
      (row: KnowledgeGraphRow) =>
        new KnowledgeGraph({
          graphId: row.id as GraphId,
          label: row.label,
          description: row.description ?? undefined,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }),
    );

    return {
      data: graphs,
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async saveGraph(graph: KnowledgeGraph): Promise<void> {
    const db = getDatabase();
    await db.insert(knowledgeGraphs).values({
      id: graph.graphId,
      label: graph.label,
      description: graph.description,
      statusState: graph.status.state,
      entityStatus: 'active',
      createdAt: graph.createdAt,
      updatedAt: graph.updatedAt,
    });
    this.logger.info('Graph saved', { graphId: graph.graphId });
  }

  async updateGraph(graph: KnowledgeGraph): Promise<void> {
    const db = getDatabase();
    await db
      .update(knowledgeGraphs)
      .set({
        label: graph.label,
        description: graph.description,
        statusState: graph.status.state,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeGraphs.id, graph.graphId));
    this.logger.info('Graph updated', { graphId: graph.graphId });
  }

  async deleteGraph(id: GraphId): Promise<void> {
    const db = getDatabase();
    await Promise.all([
      db.delete(knowledgeNodes).where(eq(knowledgeNodes.graphId, id)),
      db.delete(knowledgeEdges).where(eq(knowledgeEdges.graphId, id)),
      db.delete(knowledgeGraphs).where(eq(knowledgeGraphs.id, id)),
    ]);
    this.logger.info('Graph deleted', { graphId: id });
  }

  // ── Search Operations ────────────────────────────────────────────────────

  async searchNodes(
    query: string,
    params: PaginationParams,
  ): Promise<PaginatedResult<KnowledgeNode>> {
    const db = getDatabase();
    const offset = (params.page - 1) * params.limit;
    const searchPattern = `%${query}%`;

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(knowledgeNodes)
        .where(
          sql`${knowledgeNodes.label} ILIKE ${searchPattern} OR ${knowledgeNodes.description} ILIKE ${searchPattern}`,
        )
        .limit(params.limit)
        .offset(offset)
        .orderBy(knowledgeNodes.label),
      db
        .select({ count: count() })
        .from(knowledgeNodes)
        .where(
          sql`${knowledgeNodes.label} ILIKE ${searchPattern} OR ${knowledgeNodes.description} ILIKE ${searchPattern}`,
        ),
    ]);

    const total = totalResult[0]?.count ?? 0;
    return {
      data: rows.map((row: KnowledgeNodeRow) => this.rowToNode(row)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async searchNodesByTags(
    tags: string[],
    params: PaginationParams,
  ): Promise<PaginatedResult<KnowledgeNode>> {
    const db = getDatabase();
    const offset = (params.page - 1) * params.limit;

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(knowledgeNodes)
        .where(sql`${knowledgeNodes.tags} && ${tags}`)
        .limit(params.limit)
        .offset(offset)
        .orderBy(knowledgeNodes.createdAt),
      db
        .select({ count: count() })
        .from(knowledgeNodes)
        .where(sql`${knowledgeNodes.tags} && ${tags}`),
    ]);

    const total = totalResult[0]?.count ?? 0;
    return {
      data: rows.map((row: KnowledgeNodeRow) => this.rowToNode(row)),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  // ── Graph Statistics ─────────────────────────────────────────────────────

  async countNodes(graphId: GraphId): Promise<number> {
    const db = getDatabase();
    const result = await db
      .select({ count: count() })
      .from(knowledgeNodes)
      .where(eq(knowledgeNodes.graphId, graphId));
    return result[0]?.count ?? 0;
  }

  async countEdges(graphId: GraphId): Promise<number> {
    const db = getDatabase();
    const result = await db
      .select({ count: count() })
      .from(knowledgeEdges)
      .where(eq(knowledgeEdges.graphId, graphId));
    return result[0]?.count ?? 0;
  }

  async countNodesByCategory(graphId: GraphId): Promise<Record<KnowledgeCategoryValue, number>> {
    const db = getDatabase();
    const rows = await db
      .select({ category: knowledgeNodes.category, count: count() })
      .from(knowledgeNodes)
      .where(eq(knowledgeNodes.graphId, graphId))
      .groupBy(knowledgeNodes.category);

    const result = {} as Record<KnowledgeCategoryValue, number>;
    for (const row of rows) {
      result[row.category as KnowledgeCategoryValue] = row.count;
    }
    return result;
  }

  async countGraphs(): Promise<number> {
    const db = getDatabase();
    const result = await db.select({ count: count() }).from(knowledgeGraphs);
    return result[0]?.count ?? 0;
  }

  // ── Mapping Helpers ─────────────────────────────────────────────────────

  private rowToNode(row: KnowledgeNodeRow): KnowledgeNode {
    return KnowledgeFactory.reconstructNode({
      id: row.id,
      graphId: row.graphId,
      category: row.category,
      label: row.label,
      description: row.description ?? undefined,
      metadata: row.metadata as Record<string, unknown> | undefined,
      status: row.statusState,
      statusReason: row.statusReason ?? undefined,
      confidence: row.confidenceLevel,
      confidenceScore: row.confidenceScore,
      sourceType: row.sourceType,
      sourceDetail: row.sourceDetail ?? undefined,
      accuracy: row.qualityAccuracy,
      completeness: row.qualityCompleteness,
      consistency: row.qualityConsistency,
      timeliness: row.qualityTimeliness,
      relevance: row.qualityRelevance,
      major: row.versionMajor,
      minor: row.versionMinor,
      patch: row.versionPatch,
      entityStatus: row.entityStatus as unknown as 'active' | 'inactive' | 'archived' | 'deleted',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      tags: row.tags ?? [],
    });
  }

  private nodeToRow(node: KnowledgeNode): typeof knowledgeNodes.$inferInsert {
    return {
      id: node.id,
      graphId: node.graphId,
      category: node.category.value,
      label: node.label,
      description: node.description || null,
      metadata: node.metadata,
      tags: [...node.tags],
      statusState: node.status.state,
      statusReason: node.status.reason ?? null,
      confidenceLevel: node.confidence.level,
      confidenceScore: node.confidence.score,
      sourceType: node.source.type,
      sourceDetail: node.source.detail,
      sourceTimestamp: node.source.timestamp,
      qualityAccuracy: node.quality.accuracy,
      qualityCompleteness: node.quality.completeness,
      qualityConsistency: node.quality.consistency,
      qualityTimeliness: node.quality.timeliness,
      qualityRelevance: node.quality.relevance,
      versionMajor: node.version.major,
      versionMinor: node.version.minor,
      versionPatch: node.version.patch,
      entityStatus: node.entityStatus,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    };
  }

  private rowToEdge(row: KnowledgeEdgeRow): KnowledgeEdge {
    const type = new RelationshipType(
      row.type,
      row.typeCategory as RelationshipCategory,
      row.label,
    );
    const confidence = KnowledgeConfidence.fromLevel(row.confidenceLevel);
    const status = KnowledgeStatus.fromState(row.statusState, row.statusReason ?? undefined);
    const source = new KnowledgeSource(
      row.sourceType as KnowledgeSourceType,
      row.sourceDetail ?? '',
    );

    return new KnowledgeEdgeEntity({
      id: row.id as KnowledgeEdgeId,
      graphId: row.graphId as GraphId,
      sourceId: row.sourceId as KnowledgeNodeId,
      targetId: row.targetId as KnowledgeNodeId,
      type,
      label: row.label,
      weight: row.weight,
      metadata: row.metadata as Record<string, unknown>,
      confidence,
      status,
      source,
      entityStatus: row.entityStatus as unknown as 'active' | 'inactive' | 'archived' | 'deleted',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private edgeToRow(edge: KnowledgeEdge): typeof knowledgeEdges.$inferInsert {
    return {
      id: edge.id,
      graphId: edge.graphId,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      type: edge.type.type,
      typeCategory: edge.type.category,
      label: edge.label,
      weight: edge.weight,
      metadata: edge.metadata,
      confidenceLevel: edge.confidence.level,
      confidenceScore: edge.confidence.score,
      statusState: edge.status.state,
      statusReason: edge.status.reason ?? null,
      sourceType: edge.source.type,
      sourceDetail: edge.source.detail,
      entityStatus: edge.entityStatus,
      createdAt: edge.createdAt,
      updatedAt: edge.updatedAt,
    };
  }
}

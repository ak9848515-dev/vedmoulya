// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Repository Interface
// Contract for Knowledge Graph persistence — infrastructure must implement
// ARC-003 — Knowledge Graph Bounded Context
// ──────────────────────────────────────────────────────────────────

import type { KnowledgeNode } from '../entities/KnowledgeNode.js';
import type { KnowledgeEdge } from '../entities/KnowledgeEdge.js';
import type { KnowledgeGraph } from '../aggregates/KnowledgeGraph.js';
import type { KnowledgeNodeId } from '../value-objects/KnowledgeNodeId.js';
import type { KnowledgeEdgeId } from '../value-objects/KnowledgeEdgeId.js';
import type { GraphId } from '../value-objects/GraphId.js';
import type { PaginationParams, PaginatedResult } from '@vedmoulya/core';
import type { KnowledgeCategoryValue } from '../value-objects/KnowledgeCategory.js';
import type { RelationshipCategory } from '../value-objects/RelationshipType.js';

export interface KnowledgeRepository {
  // ── Node Operations ──────────────────────────────────────────────────────

  /** Find a node by its unique identifier */
  findNodeById(id: KnowledgeNodeId): Promise<KnowledgeNode | null>;

  /** Find nodes by their category */
  findNodesByCategory(
    category: KnowledgeCategoryValue,
    params: PaginationParams,
  ): Promise<PaginatedResult<KnowledgeNode>>;

  /** Find nodes by label (partial match) */
  findNodesByLabel(
    label: string,
    params: PaginationParams,
  ): Promise<PaginatedResult<KnowledgeNode>>;

  /** Find nodes belonging to a graph */
  findNodesByGraph(
    graphId: GraphId,
    params: PaginationParams,
  ): Promise<PaginatedResult<KnowledgeNode>>;

  /** Save a new node */
  saveNode(node: KnowledgeNode): Promise<void>;

  /** Update an existing node */
  updateNode(node: KnowledgeNode): Promise<void>;

  /** Delete a node */
  deleteNode(id: KnowledgeNodeId): Promise<void>;

  /** Check if a node exists */
  nodeExists(id: KnowledgeNodeId): Promise<boolean>;

  // ── Edge Operations ──────────────────────────────────────────────────────

  /** Find an edge by its unique identifier */
  findEdgeById(id: KnowledgeEdgeId): Promise<KnowledgeEdge | null>;

  /** Find edges between two nodes */
  findEdgesBetween(sourceId: KnowledgeNodeId, targetId: KnowledgeNodeId): Promise<KnowledgeEdge[]>;

  /** Find all edges connected to a node */
  findEdgesForNode(nodeId: KnowledgeNodeId): Promise<KnowledgeEdge[]>;

  /** Find edges by type */
  findEdgesByType(type: string, params: PaginationParams): Promise<PaginatedResult<KnowledgeEdge>>;

  /** Find edges by relationship category */
  findEdgesByCategory(
    category: RelationshipCategory,
    params: PaginationParams,
  ): Promise<PaginatedResult<KnowledgeEdge>>;

  /** Save a new edge */
  saveEdge(edge: KnowledgeEdge): Promise<void>;

  /** Update an existing edge */
  updateEdge(edge: KnowledgeEdge): Promise<void>;

  /** Delete an edge */
  deleteEdge(id: KnowledgeEdgeId): Promise<void>;

  /** Check if an edge exists */
  edgeExists(id: KnowledgeEdgeId): Promise<boolean>;

  // ── Graph Operations ─────────────────────────────────────────────────────

  /** Find a graph by its ID */
  findGraphById(id: GraphId): Promise<KnowledgeGraph | null>;

  /** Find all graphs */
  findAllGraphs(params: PaginationParams): Promise<PaginatedResult<KnowledgeGraph>>;

  /** Save a new graph */
  saveGraph(graph: KnowledgeGraph): Promise<void>;

  /** Update an existing graph */
  updateGraph(graph: KnowledgeGraph): Promise<void>;

  /** Delete a graph (and all its nodes/edges) */
  deleteGraph(id: GraphId): Promise<void>;

  // ── Search Operations ────────────────────────────────────────────────────

  /** Full-text search across node labels and descriptions */
  searchNodes(query: string, params: PaginationParams): Promise<PaginatedResult<KnowledgeNode>>;

  /** Search nodes by tags */
  searchNodesByTags(
    tags: string[],
    params: PaginationParams,
  ): Promise<PaginatedResult<KnowledgeNode>>;

  // ── Graph Statistics ─────────────────────────────────────────────────────

  /** Count nodes in a graph */
  countNodes(graphId: GraphId): Promise<number>;

  /** Count edges in a graph */
  countEdges(graphId: GraphId): Promise<number>;

  /** Count nodes by category */
  countNodesByCategory(graphId: GraphId): Promise<Record<KnowledgeCategoryValue, number>>;

  /** Get the total number of graphs */
  countGraphs(): Promise<number>;
}

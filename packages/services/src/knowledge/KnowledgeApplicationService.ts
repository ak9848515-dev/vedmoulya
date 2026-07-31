// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Application Service
// Orchestrates knowledge graph use cases with domain and infrastructure
// ARC-003 — Knowledge Graph Bounded Context
// ──────────────────────────────────────────────────────────────────

import { BaseService, ValidationError, NotFoundError } from '@vedmoulya/core';
import type { PaginationParams } from '@vedmoulya/core';
import {
  KnowledgeGraph as KnowledgeGraphAgg,
  KnowledgeGraphService,
  KnowledgeFactory,
  KnowledgeNode,
  KnowledgeCategory,
  createKnowledgeNodeId,
  createKnowledgeEdgeId,
  createGraphId,
} from '@vedmoulya/domain';
import type { KnowledgeRepository, KnowledgeGraph } from '@vedmoulya/domain';
import { KnowledgeMapper } from './KnowledgeMapper.js';
import type {
  KnowledgeNodeDTO,
  KnowledgeEdgeDTO,
  KnowledgeGraphDTO,
  KnowledgeNodeListDTO,
  KnowledgeGraphListDTO,
  TraversalResultDTO,
  SearchResultDTO,
  ImpactResultDTO,
  GraphStatisticsDTO,
  CycleResultDTO,
  CreateNodeDTO,
  CreateEdgeDTO,
  CreateGraphDTO,
  UpdateNodeDTO,
  MergeNodesDTO,
  SplitNodeDTO,
} from './KnowledgeDTO.js';

export class KnowledgeApplicationService extends BaseService {
  private readonly repository: KnowledgeRepository;
  private readonly graphService: KnowledgeGraphService;
  private readonly factory: KnowledgeFactory;

  constructor(repository: KnowledgeRepository) {
    super('knowledge');
    this.repository = repository;
    this.graphService = new KnowledgeGraphService(repository);
    this.factory = new KnowledgeFactory(repository);
  }

  // ── Graph Management ─────────────────────────────────────────────────────

  /** Create a new knowledge graph */
  async createGraph(params: CreateGraphDTO): Promise<KnowledgeGraphDTO> {
    this.logger.info('Creating knowledge graph', { label: params.label });
    const graph = KnowledgeGraphAgg.create({
      label: params.label,
      description: params.description,
    });
    await this.repository.saveGraph(graph);
    return KnowledgeMapper.toGraphDTO(graph);
  }

  /** Get a graph by ID */
  async getGraph(graphId: string): Promise<KnowledgeGraphDTO> {
    const gid = createGraphId(graphId);
    const graph = await this.repository.findGraphById(gid);
    if (!graph) throw new NotFoundError('KnowledgeGraph', graphId);
    return KnowledgeMapper.toGraphDTO(graph);
  }

  /** List all graphs */
  async listGraphs(params: PaginationParams): Promise<KnowledgeGraphListDTO> {
    const result = await this.repository.findAllGraphs(params);
    return {
      graphs: result.data.map((g: KnowledgeGraph) => KnowledgeMapper.toGraphDTO(g)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  /** Delete a graph */
  async deleteGraph(graphId: string): Promise<void> {
    const gid = createGraphId(graphId);
    const graph = await this.repository.findGraphById(gid);
    if (!graph) throw new NotFoundError('KnowledgeGraph', graphId);
    await this.repository.deleteGraph(gid);
    this.logger.info('Knowledge graph deleted', { graphId });
  }

  // ── Node Management ─────────────────────────────────────────────────────

  /** Create a new knowledge node */
  async createNode(params: CreateNodeDTO): Promise<KnowledgeNodeDTO> {
    const graphId = createGraphId(params.graphId);

    const graph = await this.repository.findGraphById(graphId);
    if (!graph) throw new NotFoundError('KnowledgeGraph', params.graphId);

    const result = await this.factory.createNode({
      graphId,
      category: params.category,
      label: params.label,
      description: params.description,
      metadata: params.metadata,
      sourceType: params.sourceType as unknown as undefined,
      sourceDetail: params.sourceDetail,
      tags: params.tags,
    });

    if (!result.success || !result.data) {
      throw new ValidationError(result.error ?? 'Failed to create node');
    }

    await this.repository.saveNode(result.data);
    this.logger.info('Node created', { nodeId: result.data.id, category: params.category });
    return KnowledgeMapper.toNodeDTO(result.data);
  }

  /** Get a node by ID */
  async getNode(nodeId: string): Promise<KnowledgeNodeDTO> {
    const nid = createKnowledgeNodeId(nodeId);
    const node = await this.repository.findNodeById(nid);
    if (!node) throw new NotFoundError('KnowledgeNode', nodeId);
    return KnowledgeMapper.toNodeDTO(node);
  }

  /** Update an existing node */
  async updateNode(nodeId: string, params: UpdateNodeDTO): Promise<KnowledgeNodeDTO> {
    const nid = createKnowledgeNodeId(nodeId);
    const node = await this.repository.findNodeById(nid);
    if (!node) throw new NotFoundError('KnowledgeNode', nodeId);

    if (params.label !== undefined) {
      node.update(params.label, params.description);
    } else if (params.description !== undefined) {
      node.update(node.label, params.description);
    }
    if (params.metadata) node.updateMetadata(params.metadata);
    if (params.tags) {
      for (const tag of params.tags) node.addTag(tag);
    }
    if (params.category) {
      node.changeCategory(KnowledgeCategory.create(params.category));
    }

    await this.repository.updateNode(node);
    return KnowledgeMapper.toNodeDTO(node);
  }

  /** Delete a node */
  async deleteNode(nodeId: string): Promise<void> {
    const nid = createKnowledgeNodeId(nodeId);
    const node = await this.repository.findNodeById(nid);
    if (!node) throw new NotFoundError('KnowledgeNode', nodeId);

    await this.graphService.deleteNode(nid);
    this.logger.info('Node deleted', { nodeId });
  }

  /** List nodes by graph */
  async listNodesByGraph(graphId: string, params: PaginationParams): Promise<KnowledgeNodeListDTO> {
    const gid = createGraphId(graphId);
    const result = await this.repository.findNodesByGraph(gid, params);
    return {
      nodes: result.data.map((n) => KnowledgeMapper.toNodeDTO(n)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  /** Search nodes */
  async searchNodes(query: string, params: PaginationParams): Promise<KnowledgeNodeListDTO> {
    const result = await this.repository.searchNodes(query, params);
    return {
      nodes: result.data.map((n) => KnowledgeMapper.toNodeDTO(n)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  // ── Edge Management ─────────────────────────────────────────────────────

  /** Create a new edge between nodes */
  async createEdge(params: CreateEdgeDTO): Promise<KnowledgeEdgeDTO> {
    const graphId = createGraphId(params.graphId);
    const sourceId = createKnowledgeNodeId(params.sourceId);
    const targetId = createKnowledgeNodeId(params.targetId);

    const result = await this.factory.createEdge({
      graphId,
      sourceId,
      targetId,
      relationshipType: params.relationshipType,
      relationshipCategory: params.relationshipCategory,
      label: params.label,
      weight: params.weight,
      metadata: params.metadata,
      sourceType: params.sourceType as unknown as undefined,
      sourceDetail: params.sourceDetail,
    });

    if (!result.success || !result.data) {
      throw new ValidationError(result.error ?? 'Failed to create edge');
    }

    await this.repository.saveEdge(result.data);
    return KnowledgeMapper.toEdgeDTO(result.data);
  }

  /** Get edges for a node */
  async getNodeEdges(nodeId: string): Promise<KnowledgeEdgeDTO[]> {
    const nid = createKnowledgeNodeId(nodeId);
    const edges = await this.repository.findEdgesForNode(nid);
    return edges.map((e) => KnowledgeMapper.toEdgeDTO(e));
  }

  /** Delete an edge */
  async deleteEdge(edgeId: string): Promise<void> {
    const eid = createKnowledgeEdgeId(edgeId);
    const edge = await this.repository.findEdgeById(eid);
    if (!edge) throw new NotFoundError('KnowledgeEdge', edgeId);
    await this.repository.deleteEdge(eid);
  }

  // ── Traversal Operations ────────────────────────────────────────────────

  /** Traverse the graph from a start node */
  async traverse(startNodeId: string, maxDepth?: number): Promise<TraversalResultDTO> {
    const nid = createKnowledgeNodeId(startNodeId);
    const result = await this.graphService.traverse(nid, maxDepth);
    return {
      path: result.path.map((s) => KnowledgeMapper.toTraversalStepDTO(s)),
      depth: result.depth,
      totalCost: result.totalCost,
    };
  }

  /** Find shortest path between two nodes */
  async findShortestPath(
    startNodeId: string,
    endNodeId: string,
  ): Promise<TraversalResultDTO | null> {
    const sid = createKnowledgeNodeId(startNodeId);
    const eid = createKnowledgeNodeId(endNodeId);
    const result = await this.graphService.findShortestPath(sid, eid);
    if (!result) return null;
    return {
      path: result.path.map((s) => KnowledgeMapper.toTraversalStepDTO(s)),
      depth: result.depth,
      totalCost: result.totalCost,
    };
  }

  /** Find related knowledge for a node */
  async findRelatedKnowledge(nodeId: string): Promise<SearchResultDTO> {
    const nid = createKnowledgeNodeId(nodeId);
    const result = await this.graphService.findRelatedKnowledge(nid);
    return {
      nodes: result.nodes.map((n) => KnowledgeMapper.toNodeDTO(n)),
      total: result.total,
      relevance: result.relevance,
    };
  }

  // ── Advanced Operations ─────────────────────────────────────────────────

  /** Analyze impact of removing a node */
  async analyzeImpact(nodeId: string): Promise<ImpactResultDTO> {
    const nid = createKnowledgeNodeId(nodeId);
    const result = await this.graphService.analyzeImpact(nid);
    return {
      affectedNodes: result.affectedNodes.map((n) => KnowledgeMapper.toNodeDTO(n)),
      affectedEdges: result.affectedEdges.map((e) => KnowledgeMapper.toEdgeDTO(e)),
      impactLevel: result.impactLevel,
      description: result.description,
    };
  }

  /** Detect cycles in a graph */
  async detectCycles(graphId: string): Promise<CycleResultDTO> {
    const gid = createGraphId(graphId);
    const result = await this.graphService.detectCycles(gid);
    return {
      hasCycle: result.hasCycle,
      cycles: result.cycles.map((c: { nodes: string[]; edges: string[] }) => ({
        nodes: c.nodes,
        edges: c.edges,
      })),
    };
  }

  /** Get graph statistics */
  async getGraphStatistics(graphId: string): Promise<GraphStatisticsDTO> {
    const gid = createGraphId(graphId);
    return await this.graphService.getGraphStatistics(gid);
  }

  /** Merge two nodes */
  async mergeNodes(params: MergeNodesDTO): Promise<KnowledgeNodeDTO> {
    const sourceId = createKnowledgeNodeId(params.sourceId);
    const targetId = createKnowledgeNodeId(params.targetId);

    const targetNode = await this.repository.findNodeById(targetId);
    if (!targetNode) throw new NotFoundError('KnowledgeNode', params.targetId);

    targetNode.update(params.mergedLabel, params.mergedDescription);
    const result = await this.graphService.mergeNodes(sourceId, targetId, targetNode);
    if (!result.success || !result.data) {
      throw new ValidationError(result.error ?? 'Failed to merge nodes');
    }
    return KnowledgeMapper.toNodeDTO(result.data);
  }

  /** Split a node into two */
  async splitNode(
    params: SplitNodeDTO,
  ): Promise<{ first: KnowledgeNodeDTO; second: KnowledgeNodeDTO }> {
    const nid = createKnowledgeNodeId(params.nodeId);
    const graphIdNode = await this.repository.findNodeById(nid);
    if (!graphIdNode) throw new NotFoundError('KnowledgeNode', params.nodeId);

    const gid = graphIdNode.graphId;
    const refCategory = KnowledgeCategory.reference();

    const firstNode = KnowledgeNode.create({
      id: createKnowledgeNodeId(`${params.nodeId}_split1`),
      graphId: gid,
      category: refCategory,
      label: params.firstLabel,
      description: params.firstDescription,
    });

    const secondNode = KnowledgeNode.create({
      id: createKnowledgeNodeId(`${params.nodeId}_split2`),
      graphId: gid,
      category: refCategory,
      label: params.secondLabel,
      description: params.secondDescription,
    });

    await this.repository.saveNode(firstNode);
    await this.repository.saveNode(secondNode);
    await this.repository.deleteNode(nid);

    return {
      first: KnowledgeMapper.toNodeDTO(firstNode),
      second: KnowledgeMapper.toNodeDTO(secondNode),
    };
  }
}

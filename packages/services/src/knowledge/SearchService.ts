// ──────────────────────────────────────────────────────────────────
// VedMoulya — Search Service
// Application service for knowledge graph search operations
// ARC-003 — Knowledge Graph Bounded Context
// ──────────────────────────────────────────────────────────────────

import { BaseService } from '@vedmoulya/core';
import type { PaginationParams } from '@vedmoulya/core';
import type { KnowledgeRepository, KnowledgeNode, KnowledgeCategoryValue } from '@vedmoulya/domain';
import { KnowledgeGraphService, createKnowledgeNodeId } from '@vedmoulya/domain';
import { KnowledgeMapper } from './KnowledgeMapper.js';
import type { KnowledgeNodeDTO, SearchResultDTO } from './KnowledgeDTO.js';

export interface SearchFilters {
  categories?: string[];
  tags?: string[];
  status?: string;
  confidence?: string;
  graphId?: string;
}

export interface FullTextSearchParams {
  query: string;
  filters?: SearchFilters;
  pagination: PaginationParams;
}

/**
 * SearchService — application-level search operations.
 * Provides full-text search, filtered search, and related knowledge discovery.
 */
export class SearchService extends BaseService {
  private readonly repository: KnowledgeRepository;
  private readonly graphService: KnowledgeGraphService;

  constructor(repository: KnowledgeRepository) {
    super('knowledge-search');
    this.repository = repository;
    this.graphService = new KnowledgeGraphService(repository);
  }

  /** Full-text search across nodes */
  async search(params: FullTextSearchParams): Promise<{
    nodes: KnowledgeNodeDTO[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const result = await this.repository.searchNodes(params.query, params.pagination);
    let nodes = result.data;

    // Apply filters
    const filters = params.filters;
    if (filters?.categories && filters.categories.length > 0) {
      const categories = filters.categories;
      nodes = nodes.filter((n: KnowledgeNode) => categories.includes(n.category.value));
    }
    if (filters?.status) {
      const status = filters.status;
      nodes = nodes.filter((n: KnowledgeNode) => n.status.state === status);
    }
    if (filters?.graphId) {
      const graphId = filters.graphId;
      nodes = nodes.filter((n: KnowledgeNode) => n.graphId === graphId);
    }
    if (filters?.tags && filters.tags.length > 0) {
      const tags = filters.tags;
      nodes = nodes.filter((n: KnowledgeNode) => tags.some((tag: string) => n.tags.includes(tag)));
    }

    return {
      nodes: nodes.map((n) => KnowledgeMapper.toNodeDTO(n)),
      total: nodes.length,
      page: params.pagination.page,
      limit: params.pagination.limit,
      totalPages: Math.ceil(nodes.length / params.pagination.limit),
    };
  }

  /** Search nodes by category */
  async searchByCategory(
    category: string,
    params: PaginationParams,
  ): Promise<{
    nodes: KnowledgeNodeDTO[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const result = await this.repository.findNodesByCategory(
      category as KnowledgeCategoryValue,
      params,
    );
    return {
      nodes: result.data.map((n) => KnowledgeMapper.toNodeDTO(n)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  /** Search nodes by tags */
  async searchByTags(
    tags: string[],
    params: PaginationParams,
  ): Promise<{
    nodes: KnowledgeNodeDTO[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const result = await this.repository.searchNodesByTags(tags, params);
    return {
      nodes: result.data.map((n) => KnowledgeMapper.toNodeDTO(n)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  /** Find related knowledge for a node */
  async findRelated(nodeId: string): Promise<SearchResultDTO> {
    const nid = createKnowledgeNodeId(nodeId);
    const result = await this.graphService.findRelatedKnowledge(nid);
    return {
      nodes: result.nodes.map((n) => KnowledgeMapper.toNodeDTO(n)),
      total: result.total,
      relevance: result.relevance,
    };
  }

  /** Get autocomplete suggestions for a partial query */
  async autocomplete(
    query: string,
    limit: number = 10,
  ): Promise<Array<{ id: string; label: string; category: string }>> {
    const result = await this.repository.searchNodes(query, { page: 1, limit });
    return result.data.slice(0, limit).map((node: KnowledgeNode) => ({
      id: node.id,
      label: node.label,
      category: node.category.value,
    }));
  }
}

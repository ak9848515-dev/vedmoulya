// ──────────────────────────────────────────────────────────────────
// VedMoulya — Recommendation Preparation Service
// Prepares knowledge graph context for AI Orchestrator integration
// Implements Minimum Context Principle
// ARC-003 — Knowledge Graph Bounded Context
// BLD-005 — AI Orchestrator Integration
// ──────────────────────────────────────────────────────────────────

import { BaseService } from '@vedmoulya/core';
import type { KnowledgeRepository, KnowledgeNode } from '@vedmoulya/domain';
import { KnowledgeGraphService, createKnowledgeNodeId } from '@vedmoulya/domain';

export interface ContextAssemblyInput {
  nodeIds: string[];
  includeRelated?: boolean;
  maxDepth?: number;
  maxNodes?: number;
}

export interface ContextAssemblyResult {
  context: string;
  citations: CitationInfo[];
  nodeCount: number;
  edgeCount: number;
}

export interface CitationInfo {
  nodeId: string;
  label: string;
  category: string;
  confidence: string;
  source: string;
  timestamp: string;
}

export interface ExplainabilityInfo {
  reasoning: string;
  sourceNodes: Array<{ id: string; label: string; category: string }>;
  pathDescription: string;
}

/**
 * RecommendationPreparationService — prepares knowledge graph context
 * for the AI Orchestrator following the Minimum Context Principle.
 * Integrates ONLY through BLD-005 AI Orchestrator contracts.
 */
export class RecommendationPreparationService extends BaseService {
  private readonly repository: KnowledgeRepository;

  constructor(repository: KnowledgeRepository) {
    super('recommendation-preparation');
    this.repository = repository;
  }

  /** Assemble context for AI Orchestrator from knowledge graph nodes */
  async assembleContext(input: ContextAssemblyInput): Promise<ContextAssemblyResult> {
    const nodes: KnowledgeNode[] = [];
    const citations: CitationInfo[] = [];
    const visitedNodeIds = new Set<string>();

    // Collect specified nodes
    for (const nodeId of input.nodeIds) {
      if (visitedNodeIds.has(nodeId)) continue;
      const nid = createKnowledgeNodeId(nodeId);
      const node = await this.repository.findNodeById(nid);
      if (node) {
        nodes.push(node);
        visitedNodeIds.add(nodeId);
        citations.push({
          nodeId,
          label: node.label,
          category: node.category.value,
          confidence: node.confidence.level,
          source: node.source.type,
          timestamp: node.updatedAt.toISOString(),
        });
      }
    }

    // Collect related nodes if requested
    if (input.includeRelated && input.maxDepth && input.maxDepth > 0) {
      const maxToAdd = (input.maxNodes ?? 50) - nodes.length;
      let added = 0;

      for (const nodeId of input.nodeIds) {
        if (added >= maxToAdd) break;
        if (visitedNodeIds.has(nodeId)) continue;
        visitedNodeIds.add(nodeId);

        const nid = createKnowledgeNodeId(nodeId);
        const edges = await this.repository.findEdgesForNode(nid);

        for (const edge of edges) {
          if (added >= maxToAdd) break;
          const neighborId = edge.sourceId === nid ? edge.targetId : edge.sourceId;
          if (visitedNodeIds.has(neighborId)) continue;
          visitedNodeIds.add(neighborId);

          const neighborNode = await this.repository.findNodeById(neighborId);
          if (neighborNode) {
            nodes.push(neighborNode);
            citations.push({
              nodeId: neighborId,
              label: neighborNode.label,
              category: neighborNode.category.value,
              confidence: neighborNode.confidence.level,
              source: neighborNode.source.type,
              timestamp: neighborNode.updatedAt.toISOString(),
            });
            added++;
          }
        }
      }
    }

    // Build context string following Minimum Context Principle
    const contextParts: string[] = [];
    contextParts.push('## Knowledge Graph Context\n');

    for (const node of nodes) {
      contextParts.push(`- **${node.label}** (${node.category.value})`);
      if (node.description) {
        contextParts.push(`  Description: ${node.description}`);
      }
      contextParts.push(`  Confidence: ${node.confidence.level} | Source: ${node.source.type}`);
      if (node.tags.length > 0) {
        contextParts.push(`  Tags: ${node.tags.join(', ')}`);
      }
      contextParts.push('');
    }

    return {
      context: contextParts.join('\n').trim(),
      citations,
      nodeCount: nodes.length,
      edgeCount: 0,
    };
  }

  /** Prepare explainability information for AI Orchestrator */
  async prepareExplainability(nodeId: string): Promise<ExplainabilityInfo> {
    const nid = createKnowledgeNodeId(nodeId);
    const graphService = new KnowledgeGraphService(this.repository);
    const node = await this.repository.findNodeById(nid);

    if (!node) {
      return {
        reasoning: 'Node not found',
        sourceNodes: [],
        pathDescription: '',
      };
    }

    const relatedResult = await graphService.findRelatedKnowledge(nid);
    const sourceNodes = relatedResult.nodes.slice(0, 5).map((n: KnowledgeNode) => ({
      id: n.id,
      label: n.label,
      category: n.category.value,
    }));

    const relatedLabels = sourceNodes.map((n: { label: string }) => n.label).join(', ');

    return {
      reasoning: `This recommendation is based on the knowledge node "${node.label}" and its ${String(relatedResult.nodes.length)} related knowledge areas.`,
      sourceNodes,
      pathDescription: `Primary node: ${node.label} (${node.category.value}) → Related: ${relatedLabels}`,
    };
  }

  /** Prepare semantic search context for AI Orchestrator */
  async prepareSemanticContext(
    query: string,
    maxNodes: number = 20,
  ): Promise<ContextAssemblyResult> {
    const result = await this.repository.searchNodes(query, { page: 1, limit: maxNodes });

    const citations: CitationInfo[] = result.data.map((node: KnowledgeNode) => ({
      nodeId: node.id,
      label: node.label,
      category: node.category.value,
      confidence: node.confidence.level,
      source: node.source.type,
      timestamp: node.updatedAt.toISOString(),
    }));

    const contextParts = result.data.map(
      (node: KnowledgeNode) => `- ${node.label} (${node.category.value}): ${node.description}`,
    );

    return {
      context:
        contextParts.length > 0
          ? `## Relevant Knowledge\n${contextParts.join('\n')}`
          : 'No relevant knowledge found.',
      citations,
      nodeCount: result.data.length,
      edgeCount: 0,
    };
  }
}

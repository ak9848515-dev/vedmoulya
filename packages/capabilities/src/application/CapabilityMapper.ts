// ──────────────────────────────────────────────────────────────────
// VedMoulya — Capability Mapper
// Maps domain entities to application DTOs
// EI-001 — Enterprise Capability Registry & Marketplace
// ──────────────────────────────────────────────────────────────────

import type { Capability } from '../domain/entities/Capability.js';
import type { CompositionTreeNode } from '../domain/services/CapabilityCompositionService.js';
import type { CapabilityGraph } from '../domain/services/CapabilityGraphService.js';
import type {
  CapabilityCompositionDTO,
  CapabilityDTO,
  CapabilityGraphDTO,
  CapabilityMarketplaceDTO,
} from './CapabilityDTO.js';

export const CapabilityMapper = {
  toDTO(capability: Capability): CapabilityDTO {
    return {
      id: capability.id,
      name: capability.name,
      category: capability.category,
      description: capability.description,
      owner: capability.owner,
      inputs: [...capability.inputs],
      outputs: [...capability.outputs],
      dependencies: [...capability.dependencies],
      requiredAIFeatures: [...capability.requiredAIFeatures],
      estimatedCostUsd: capability.cost.estimatedCostUsd,
      costTier: capability.cost.tier,
      estimatedInputTokens: capability.tokens.estimatedInputTokens,
      estimatedOutputTokens: capability.tokens.estimatedOutputTokens,
      p50Ms: capability.latency.p50Ms,
      p95Ms: capability.latency.p95Ms,
      qualityTarget: capability.quality.target,
      qualityMinimum: capability.quality.minimum,
      confidence: capability.confidence,
      version: capability.version.toString(),
      status: capability.status.value,
      tags: [...capability.tags],
      businessModules: [...capability.businessModules],
      documentationUrl: capability.documentationUrl,
      isComposition: capability.isComposition,
      composition: capability.composition.map((child) => ({
        id: child.id,
        name: child.id,
        slot: child.slot,
        children: [],
        isComposition: false,
        leafCount: 1,
      })),
      createdAt: capability.createdAt.toISOString(),
      updatedAt: capability.updatedAt.toISOString(),
    };
  },

  toCompositionDTO(node: CompositionTreeNode): CapabilityCompositionDTO {
    return {
      id: node.id,
      name: node.name,
      slot: node.slot,
      isComposition: node.isComposition,
      leafCount: node.leafCount,
      children: node.children.map((child) => CapabilityMapper.toCompositionDTO(child)),
    };
  },

  toGraphDTO(graph: CapabilityGraph): CapabilityGraphDTO {
    return {
      nodes: graph.nodes.map((n) => ({
        id: n.id,
        name: n.name,
        dependencies: [...n.dependencies],
        depth: n.depth,
        critical: n.critical,
      })),
      roots: [...graph.roots],
      cycles: graph.cycles.map((c) => [...c]),
      dangling: [...graph.dangling],
    };
  },

  toMarketplaceDTO(
    capabilities: readonly Capability[],
    counts: {
      countByStatus: Record<string, number>;
      countByCategory: Record<string, number>;
      countByBusinessModule: Record<string, number>;
    },
  ): CapabilityMarketplaceDTO {
    return {
      capabilities: capabilities.map((c) => CapabilityMapper.toDTO(c)),
      total: capabilities.length,
      activeCount: capabilities.filter((c) => c.status.isActive()).length,
      compositionCount: capabilities.filter((c) => c.isComposition).length,
      countByStatus: counts.countByStatus,
      countByCategory: counts.countByCategory,
      countByBusinessModule: counts.countByBusinessModule,
    };
  },
};

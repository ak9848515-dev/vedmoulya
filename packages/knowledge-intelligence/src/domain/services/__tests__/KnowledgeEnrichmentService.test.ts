// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Enrichment tests
// EI-009 — Enterprise Knowledge Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { KnowledgeEnrichmentService } from '../KnowledgeEnrichmentService.js';
import type { KnowledgeEngines } from '../../../contracts/knowledge-engines.js';
import type { KnowledgeItem } from '../../../types/knowledge-types.js';
import { createCatalogKnowledgeItems } from '../../../catalog/knowledge-catalog.js';

const NOW = '2026-08-01T00:00:00.000Z';

function item(overrides: Partial<KnowledgeItem> = {}): KnowledgeItem {
  return { ...createCatalogKnowledgeItems()[0], consumers: [], relationships: [], ...overrides };
}

/** Engines where the registries resolve and every consumer port responds. */
function happyEngines(): KnowledgeEngines {
  return {
    capabilities: {
      getMarketplace: async () => ({
        success: true,
        data: {
          total: 1,
          activeCount: 1,
          capabilities: [
            {
              id: 'research',
              name: 'Research',
              status: 'active',
              confidence: 0.94,
              estimatedCostUsd: 0.004,
              category: 'research',
            },
          ],
        },
      }),
    },
    providers: {
      getMarketplace: async () => ({
        success: true,
        data: {
          total: 1,
          healthyCount: 1,
          providers: [
            {
              id: 'openai',
              name: 'OpenAI',
              health: { status: 'healthy', healthScore: 0.98 },
              lifecycleStatus: 'active',
              bestQuality: 0.94,
              inputPerMillionTokens: 2.5,
            },
          ],
        },
      }),
    },
    goals: {
      getSummary: async () => ({
        success: true,
        data: {
          totalGoals: 1,
          activeGoals: 1,
          completedGoals: 0,
          blockedGoals: 0,
          byCategory: {},
          byStatus: {},
          byPriority: {},
          avgConfidence: 0.8,
          avgGoalScore: 0.8,
          totalTasks: 2,
        },
      }),
    },
    learning: {
      getDashboard: async () => ({
        success: true,
        data: { totals: { events: 10, models: 2 } } as never,
      }),
    },
    brain: {
      getDashboard: async () => ({ success: true, data: { totals: { decisions: 14 } } as never }),
    },
    context: {
      getContextSummary: async () => ({
        success: true,
        data: { total: 30, totalTokens: 1000, countByPriority: { high: 5, critical: 1 } } as never,
      }),
    },
    strategies: {
      getSummary: async () => ({
        success: true,
        data: { total: 4, averageConfidence: 0.84, countByExecutionMode: { pipeline: 1 } } as never,
      }),
    },
    orchestrator: { getSummary: async () => ({ success: true, data: { total: 1 } as never }) },
  };
}

/** Engines where every port fails — enrichment must degrade gracefully. */
function brokenEngines(): KnowledgeEngines {
  const fail = async (): Promise<{ success: boolean; error: string }> => ({
    success: false,
    error: 'down',
  });
  return {
    capabilities: { getMarketplace: fail },
    providers: { getMarketplace: fail },
    goals: { getSummary: fail },
    learning: { getDashboard: fail },
    brain: { getDashboard: fail },
    context: { getContextSummary: fail },
    strategies: { getSummary: fail },
    orchestrator: { getSummary: fail },
  };
}

describe('KnowledgeEnrichmentService', () => {
  const service = new KnowledgeEnrichmentService();

  it('registers every responding engine as a consumer', async () => {
    const registry = createCatalogKnowledgeItems();
    const result = await service.enrich(item(), happyEngines(), registry);
    const labels = result.item.consumers.map((c) => c.consumerId);
    expect(labels).toContain('goals');
    expect(labels).toContain('learning-intelligence');
    expect(labels).toContain('enterprise-brain');
    expect(labels).toContain('context-intelligence');
    expect(labels).toContain('execution-strategy');
    expect(labels).toContain('execution-orchestrator');
    expect(result.errors.length).toBe(0);
  });

  it('cross-links items that document a live provider/capability entity', async () => {
    const registry = createCatalogKnowledgeItems();
    const openaiItem = registry.find((i) => i.knowledgeId === 'kn_openai_provider_profile');
    const blogItem = item({
      knowledgeId: 'kn_blog_copy_notes',
      title: 'Blog copy notes',
      description: 'Notes about using OpenAI for blog copy with the Research capability.',
      tags: ['blog'],
    });
    const result = await service.enrich(blogItem, happyEngines(), registry);
    expect(openaiItem).toBeDefined();
    expect(result.relationships.some((r) => r.targetId === openaiItem?.knowledgeId)).toBe(true);
    expect(result.relationships.some((r) => r.targetId === 'kn_capability_research')).toBe(true);
  });

  it('degrades gracefully when every engine is unavailable', async () => {
    const result = await service.enrich(item(), brokenEngines(), []);
    expect(result.errors.length).toBe(8);
    expect(result.item.consumers.length).toBe(0);
    expect(result.relationships.length).toBe(0);
  });

  it('never duplicates edges or consumers across runs', async () => {
    const registry = createCatalogKnowledgeItems();
    const first = await service.enrich(item(), happyEngines(), registry);
    const second = await service.enrich(first.item, happyEngines(), registry);
    const consumerIds = second.item.consumers.map((c) => c.consumerId);
    expect(new Set(consumerIds).size).toBe(consumerIds.length);
    const edgeTargets = second.item.relationships.map((r) => r.targetId);
    expect(new Set(edgeTargets).size).toBe(edgeTargets.length);
  });

  it('registerConsumer produces a deterministic consumer entry', () => {
    const consumer = service.registerConsumer('custom', 'user', 'Owner');
    expect(consumer.consumerType).toBe('user');
    expect(consumer.usageCount).toBe(1);
    expect(consumer.firstUsedAt).toBe(consumer.lastUsedAt);
  });

  it('tolerates engines that throw during consultation', async () => {
    const throwing = {
      ...brokenEngines(),
      capabilities: {
        getMarketplace: async (): Promise<never> => {
          throw new Error('boom');
        },
      },
    };
    const result = await service.enrich(item(), throwing, []);
    expect(result.errors.some((e) => e.includes('boom'))).toBe(true);
    expect(result.item.consumers.length).toBe(0);
  });
});

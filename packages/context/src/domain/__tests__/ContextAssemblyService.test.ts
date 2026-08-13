// ──────────────────────────────────────────────────────────────────
// VedMoulya — Context Tests: ContextAssemblyService
// EI-003 — Enterprise Context Intelligence Engine
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ContextAssemblyService } from '../services/ContextAssemblyService.js';
import type { ContextItem, CompressionStep } from '../../types/context-types.js';

function createMockItem(overrides: Partial<ContextItem> = {}): ContextItem {
  return {
    contextId: 'test_ctx_001',
    source: 'knowledge_base',
    category: 'knowledge',
    priority: 'medium',
    importance: 0.7,
    confidence: 0.85,
    freshness: 0.8,
    size: 500,
    estimatedTokens: 125,
    language: 'en',
    tags: ['test'],
    business: ['platform'],
    capability: ['reasoning'],
    version: '1.0.0',
    content: 'Test content for assembly.',
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceId: 'test_source_001',
    ...overrides,
  };
}

describe('ContextAssemblyService', () => {
  const service = new ContextAssemblyService();

  it('assembles a complete EnterpriseContextPackage', () => {
    const items = [
      createMockItem({ contextId: 'ctx_001', category: 'knowledge', content: 'Knowledge content' }),
      createMockItem({ contextId: 'ctx_002', category: 'memory', content: 'Memory content' }),
      createMockItem({ contextId: 'ctx_003', category: 'business', content: 'Business content' }),
      createMockItem({ contextId: 'ctx_004', category: 'client', content: 'Client content' }),
      createMockItem({ contextId: 'ctx_005', category: 'document', content: 'Document content' }),
    ];
    const steps: CompressionStep[] = [];
    const pkg = service.assemble(
      items,
      'Generate a report',
      {
        packageId: 'pkg_001',
        goal: 'Generate a weekly report',
        capability: 'content_generation',
      },
      steps,
    );

    expect(pkg.packageId).toBe('pkg_001');
    expect(pkg.goal).toBe('Generate a weekly report');
    expect(pkg.capability).toBe('content_generation');
    expect(pkg.memory).toHaveLength(1);
    expect(pkg.knowledge).toHaveLength(1);
    expect(pkg.business).toHaveLength(1);
    expect(pkg.client).toHaveLength(1);
    expect(pkg.documents).toHaveLength(1);
    expect(pkg.prompt).toBe('Generate a report');
    expect(pkg.metadata.totalItems).toBe(5);
    expect(pkg.metadata.estimatedTokens).toBeGreaterThan(0);
    expect(pkg.metadata.confidence).toBeGreaterThan(0);
    expect(pkg.metadata.sources).toContain('knowledge_base');
    expect(pkg.metadata.assembledAt).toBeTruthy();
  });

  it('handles empty items gracefully', () => {
    const steps: CompressionStep[] = [];
    const pkg = service.assemble(
      [],
      'Hello',
      {
        packageId: 'pkg_empty',
        goal: 'Test',
        capability: 'general_conversation',
      },
      steps,
    );

    expect(pkg.metadata.totalItems).toBe(0);
    expect(pkg.memory).toHaveLength(0);
    expect(pkg.knowledge).toHaveLength(0);
    expect(pkg.business).toHaveLength(0);
    expect(pkg.client).toHaveLength(0);
    expect(pkg.documents).toHaveLength(0);
    expect(pkg.metadata.confidence).toBe(0.5);
  });

  it('categorizes items correctly by source', () => {
    const items: ContextItem[] = [
      createMockItem({ contextId: 'm1', category: 'memory', source: 'enterprise_memory' }),
      createMockItem({ contextId: 'm2', category: 'conversation', source: 'conversation_memory' }),
      createMockItem({ contextId: 'm3', category: 'user_profile', source: 'conversation_memory' }),
      createMockItem({ contextId: 'k1', category: 'knowledge', source: 'knowledge_base' }),
      createMockItem({ contextId: 'k2', category: 'strategy', source: 'business_rules' }),
      createMockItem({ contextId: 'b1', category: 'business', source: 'business_rules' }),
      createMockItem({ contextId: 'b2', category: 'market', source: 'knowledge_base' }),
      createMockItem({ contextId: 'c1', category: 'client', source: 'client_data' }),
      createMockItem({ contextId: 'c2', category: 'project', source: 'project_data' }),
      createMockItem({ contextId: 'd1', category: 'document', source: 'documents' }),
      createMockItem({ contextId: 'cap1', category: 'capability', source: 'capability_metadata' }),
      createMockItem({ contextId: 'p1', category: 'prompt', source: 'prompt_templates' }),
    ];
    const steps: CompressionStep[] = [];
    const pkg = service.assemble(
      items,
      'Test',
      {
        packageId: 'pkg_cat',
        goal: 'Test categorization',
        capability: 'reasoning',
      },
      steps,
    );

    expect(pkg.memory).toHaveLength(3); // memory, conversation, user_profile
    expect(pkg.knowledge).toHaveLength(4); // knowledge, strategy, capability, prompt
    expect(pkg.business).toHaveLength(2); // business, market
    expect(pkg.client).toHaveLength(2); // client, project
    expect(pkg.documents).toHaveLength(1); // document
  });

  it('builds a structured prompt from the package', () => {
    const items = [
      createMockItem({ contextId: 'ctx_001', category: 'knowledge', content: 'Key knowledge.' }),
    ];
    const steps: CompressionStep[] = [];
    const pkg = service.assemble(
      items,
      'Execute',
      {
        packageId: 'pkg_prompt',
        goal: 'Execute the task',
        capability: 'reasoning',
      },
      steps,
    );

    const builtPrompt = service.buildPrompt(pkg);
    expect(builtPrompt).toContain('# Goal');
    expect(builtPrompt).toContain('Execute the task');
    expect(builtPrompt).toContain('# Capability');
    expect(builtPrompt).toContain('reasoning');
    expect(builtPrompt).toContain('# Knowledge Context');
    expect(builtPrompt).toContain('Key knowledge.');
    expect(builtPrompt).toContain('# Prompt');
    expect(builtPrompt).toContain('Execute');
  });

  it('builds prompt without empty sections', () => {
    const steps: CompressionStep[] = [];
    const pkg = service.assemble(
      [],
      'Just this',
      {
        packageId: 'pkg_minimal',
        goal: 'Minimal',
        capability: 'general_conversation',
      },
      steps,
    );

    const builtPrompt = service.buildPrompt(pkg);
    expect(builtPrompt).toContain('# Goal');
    expect(builtPrompt).toContain('# Capability');
    expect(builtPrompt).toContain('# Prompt');
    expect(builtPrompt).not.toContain('# Memory Context');
    expect(builtPrompt).not.toContain('# Knowledge Context');
  });

  it('estimates tokens reasonably', () => {
    expect(service.estimateTokens('Hello')).toBe(2);
    expect(service.estimateTokens('A'.repeat(100))).toBe(25);
    expect(service.estimateTokens('')).toBe(0);
  });

  it('includes compression steps in metadata', () => {
    const steps: CompressionStep[] = [
      {
        strategy: 'top_k',
        itemsBefore: 10,
        itemsAfter: 5,
        tokensBefore: 1000,
        tokensAfter: 500,
        description: 'Top K step',
      },
    ];
    const pkg = service.assemble(
      [],
      'Test',
      {
        packageId: 'pkg_steps',
        goal: 'Test',
        capability: 'reasoning',
      },
      steps,
    );

    expect(pkg.metadata.compressionSteps).toHaveLength(1);
    expect(pkg.metadata.compressionSteps[0]!.strategy).toBe('top_k');
    expect(pkg.metadata.compressionSteps[0]!.description).toBe('Top K step');
  });
});

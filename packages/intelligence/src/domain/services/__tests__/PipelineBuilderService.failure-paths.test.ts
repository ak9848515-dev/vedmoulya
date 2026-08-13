// ──────────────────────────────────────────────────────────────────
// VedMoulya — Intelligence Pipeline Tests: Builder Failure Paths
// EI-006 / INT-001
// Exercises the builder's degradation branches (coverage gate):
// strategy reuse, strategy-creation failure, graph build failure,
// session creation failure, and provider/context empty results.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { PipelineBuilderService } from '../PipelineBuilderService.js';
import { createTestEngines } from '../../../application/__tests__/test-engines.js';
import type { TestEngines } from '../../../application/__tests__/test-engines.js';

function builder(engines: TestEngines = createTestEngines()): PipelineBuilderService {
  return new PipelineBuilderService(engines);
}

describe('PipelineBuilderService failure paths', () => {
  it('reuses an existing strategy on a second build for the same goal', async () => {
    const engines = createTestEngines();
    const service = builder(engines);

    const first = await service.build({ goalId: 'goal_blog_seed' });
    const second = await service.build({ goalId: 'goal_blog_seed' });

    expect(first.artifacts.strategyId).toBeDefined();
    // Second build reuses the strategy persisted by the first.
    expect(second.artifacts.strategyId).toBe(first.artifacts.strategyId);
    const reuseStep = second.steps.find((s) => s.stage === 'strategy');
    expect(reuseStep?.detail).toContain('Reused existing');
  });

  it('records a failed strategy stage when strategy creation fails', async () => {
    const engines = createTestEngines();
    engines.strategies.createStrategy = async () => ({ success: false, error: 'boom' });
    const service = builder(engines);

    const pipeline = await service.build({ goalId: 'goal_blog_seed' });

    expect(pipeline.status).toBe('failed');
    const step = pipeline.steps.find((s) => s.stage === 'strategy');
    expect(step?.status).toBe('failed');
    expect(step?.detail).toContain('boom');
    // Graph + session are skipped without a valid strategy input.
    expect(pipeline.artifacts.graphId).toBeUndefined();
    expect(pipeline.artifacts.sessionId).toBeUndefined();
  });

  it('records a failed graph stage when graph construction fails', async () => {
    const engines = createTestEngines();
    engines.orchestrator.buildExecutionGraph = async () => ({
      success: false,
      error: 'graph boom',
    });
    const service = builder(engines);

    const pipeline = await service.build({ goalId: 'goal_blog_seed' });

    const step = pipeline.steps.find((s) => s.stage === 'execution-graph');
    expect(step?.status).toBe('failed');
    expect(step?.detail).toContain('graph boom');
    expect(pipeline.artifacts.graphId).toBeUndefined();
  });

  it('records a failed session stage when session creation fails', async () => {
    const engines = createTestEngines();
    engines.orchestrator.createExecutionSession = async () => ({
      success: false,
      error: 'session boom',
    });
    const service = builder(engines);

    const pipeline = await service.build({ goalId: 'goal_blog_seed' });

    const step = pipeline.steps.find((s) => s.stage === 'execution-session');
    expect(step?.status).toBe('failed');
    expect(step?.detail).toContain('session boom');
    expect(pipeline.artifacts.sessionId).toBeUndefined();
  });

  it('records a failed providers stage when no provider candidates resolve', async () => {
    const engines = createTestEngines();
    engines.providers.getProvidersForCapability = async () => ({
      success: true,
      data: [],
    });
    const service = builder(engines);

    const pipeline = await service.build({ goalId: 'goal_blog_seed' });

    const step = pipeline.steps.find((s) => s.stage === 'providers');
    expect(step?.status).toBe('failed');
    expect(pipeline.status).toBe('failed');
  });

  it('records a failed context stage when no context items assemble', async () => {
    const engines = createTestEngines();
    engines.context.searchContext = async () => ({ success: true, data: { items: [], total: 0 } });
    const service = builder(engines);

    const pipeline = await service.build({ goalId: 'goal_blog_seed' });

    const step = pipeline.steps.find((s) => s.stage === 'context');
    expect(step?.status).toBe('failed');
    expect(step?.detail).toContain('No context items');
    expect(pipeline.status).toBe('failed');
  });

  it('marks the pipeline failed when any stage is skipped', async () => {
    const engines = createTestEngines();
    engines.strategies.createStrategy = async () => ({ success: false, error: 'boom' });
    const service = builder(engines);

    const pipeline = await service.build({ goalId: 'goal_revenue_seed' });

    expect(pipeline.status).toBe('failed');
    expect(pipeline.validation.passed).toBe(false);
  });
});

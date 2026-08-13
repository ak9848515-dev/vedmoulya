// ──────────────────────────────────────────────────────────────────
// VedMoulya — Intelligence Pipeline Tests: PipelineBuilderService
// EI-006 / INT-001
// The builder composes the six real seeded engines — verifying genuine
// reuse: goals → capabilities → providers → context → strategy →
// graph → session, without any AI call or execution.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { PipelineBuilderService } from '../PipelineBuilderService.js';
import { createTestEngines } from '../../../application/__tests__/test-engines.js';

describe('PipelineBuilderService', () => {
  it('builds a full ready pipeline from a seed goal through all seven stages', async () => {
    const engines = createTestEngines();
    const builder = new PipelineBuilderService(engines);

    const pipeline = await builder.build({ goalId: 'goal_blog_seed' });

    expect(pipeline.status).toBe('ready');
    expect(pipeline.steps.map((s) => s.stage)).toEqual([
      'goal',
      'capabilities',
      'providers',
      'context',
      'strategy',
      'execution-graph',
      'execution-session',
    ]);
    for (const step of pipeline.steps) {
      expect(step.status).toBe('passed');
    }
    // Real artifacts produced by the owning engines.
    expect(pipeline.artifacts.capabilities.length).toBeGreaterThan(0);
    expect(pipeline.artifacts.providers.length).toBeGreaterThan(0);
    expect(pipeline.artifacts.contextItems).toBeGreaterThan(0);
    expect(pipeline.artifacts.strategyId).toBeDefined();
    expect(pipeline.artifacts.graphId).toBeDefined();
    expect(pipeline.artifacts.sessionId).toBeDefined();
  });

  it('persists strategy, graph, and session in the owning engines (reuse proof)', async () => {
    const engines = createTestEngines();
    const builder = new PipelineBuilderService(engines);

    const pipeline = await builder.build({ goalId: 'goal_learning_seed' });

    const strategy = await engines.strategies.getStrategy(pipeline.artifacts.strategyId as string);
    expect(strategy.success).toBe(true);
    expect(strategy.data?.goalId).toBe('goal_learning_seed');

    const graph = await engines.orchestrator.listGraphs();
    expect(graph.success).toBe(true);
    expect((graph.data ?? []).some((g) => g.graphId === pipeline.artifacts.graphId)).toBe(true);

    const sessions = await engines.orchestrator.listSessions();
    expect(sessions.success).toBe(true);
    expect((sessions.data ?? []).some((s) => s.sessionId === pipeline.artifacts.sessionId)).toBe(
      true,
    );
  });

  it('returns a failed goal stage when the goal does not exist', async () => {
    const engines = createTestEngines();
    const builder = new PipelineBuilderService(engines);

    const pipeline = await builder.build({ goalId: 'goal_does_not_exist' });

    expect(pipeline.status).toBe('failed');
    const goalStep = pipeline.steps.find((s) => s.stage === 'goal');
    expect(goalStep?.status).toBe('failed');
    expect(goalStep?.detail).toContain('Goal not found');
    // No downstream artifacts.
    expect(pipeline.artifacts.strategyId).toBeUndefined();
  });

  it('records per-stage counts that feed the explainer', async () => {
    const engines = createTestEngines();
    const builder = new PipelineBuilderService(engines);

    const pipeline = await builder.build({ goalId: 'goal_revenue_seed' });

    const capabilities = pipeline.steps.find((s) => s.stage === 'capabilities');
    const providers = pipeline.steps.find((s) => s.stage === 'providers');
    const context = pipeline.steps.find((s) => s.stage === 'context');

    expect(capabilities?.counts.required).toBeGreaterThan(0);
    // One required AI feature (e.g. 'reasoning') may resolve to MULTIPLE
    // registry capabilities (research/review/seo/content_generation), so
    // found >= required, and every feature resolved (missing === 0).
    expect(capabilities?.counts.found ?? 0).toBeGreaterThanOrEqual(
      capabilities?.counts.required ?? 0,
    );
    expect(capabilities?.counts.missing).toBe(0);
    expect(providers?.counts.providers).toBeGreaterThan(0);
    expect(context?.counts.contextItems).toBeGreaterThan(0);
  });
});

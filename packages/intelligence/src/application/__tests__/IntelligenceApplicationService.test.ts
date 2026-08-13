// ──────────────────────────────────────────────────────────────────
// VedMoulya — Intelligence Pipeline Tests: IntelligenceApplicationService
// EI-006 / INT-001
// Full application-layer integration over the six real engines:
// BuildPipeline / ValidatePipeline / ExplainPipeline / GetPipeline /
// ListPipelines / Dashboard.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { createTestEngines, createTestIntelligenceService } from './test-engines.js';
import { PIPELINE_CATALOG } from '../../catalog/pipeline-catalog.js';

describe('IntelligenceApplicationService', () => {
  it('builds and persists a validated pipeline (BuildPipeline)', async () => {
    const { service } = createTestIntelligenceService();

    const result = await service.buildPipeline({ goalId: 'goal_blog_seed' });

    expect(result.success).toBe(true);
    const dto = result.data;
    expect(dto?.status).toBe('ready');
    expect(dto?.validation.passed).toBe(true);
    expect(dto?.artifacts.strategyId).toBeDefined();
    expect(dto?.artifacts.graphId).toBeDefined();
    expect(dto?.artifacts.sessionId).toBeDefined();
  });

  it('validates a persisted pipeline (ValidatePipeline)', async () => {
    const { service } = createTestIntelligenceService();
    const built = await service.buildPipeline({ goalId: 'goal_learning_seed' });

    const validation = await service.validatePipeline(built.data?.pipelineId as string);
    expect(validation.success).toBe(true);
    expect(validation.data?.passed).toBe(true);
    expect(validation.data?.checks).toHaveLength(7);
  });

  it('explains a pipeline with the counts headline (ExplainPipeline)', async () => {
    const { service } = createTestIntelligenceService();
    const built = await service.buildPipeline({ goalId: 'goal_project_seed' });

    const explanation = await service.explainPipeline(built.data?.pipelineId as string);
    expect(explanation.success).toBe(true);
    expect(explanation.data?.ready).toBe(true);
    expect(explanation.data?.headline).toContain('ready for execution');
  });

  it('builds a validated, ready pipeline for EVERY seed catalog goal (B-01)', async () => {
    const { service } = createTestIntelligenceService();

    for (const entry of PIPELINE_CATALOG) {
      const result = await service.buildPipeline({ goalId: entry.goalId });
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('ready');
      expect(result.data?.validation.passed).toBe(true);
      expect(result.data?.artifacts.capabilities.length).toBeGreaterThan(0);
      expect(result.data?.artifacts.providers.length).toBeGreaterThan(0);
      expect(result.data?.artifacts.strategyId).toBeDefined();
      expect(result.data?.artifacts.graphId).toBeDefined();
      expect(result.data?.artifacts.sessionId).toBeDefined();
    }
  });

  it('gets and lists pipelines (GetPipeline / ListPipelines)', async () => {
    const { service } = createTestIntelligenceService();
    const built = await service.buildPipeline({ goalId: 'goal_revenue_seed' });

    const get = await service.getPipeline(built.data?.pipelineId as string);
    expect(get.success).toBe(true);
    expect(get.data?.goalId).toBe('goal_revenue_seed');

    const list = await service.listPipelines();
    expect(list.success).toBe(true);
    expect(list.data).toHaveLength(1);
  });

  it('returns typed errors for unknown pipelines', async () => {
    const { service } = createTestIntelligenceService();

    const get = await service.getPipeline('pipeline_missing');
    expect(get.success).toBe(false);
    expect(get.error).toContain('not found');

    const validate = await service.validatePipeline('pipeline_missing');
    expect(validate.success).toBe(false);

    const explain = await service.explainPipeline('pipeline_missing');
    expect(explain.success).toBe(false);
  });

  it('returns a failed build for an unknown goal', async () => {
    const { service } = createTestIntelligenceService();

    const result = await service.buildPipeline({ goalId: 'goal_missing' });
    expect(result.success).toBe(true); // build never throws
    expect(result.data?.status).toBe('failed');
    expect(result.data?.validation.passed).toBe(false);
  });

  it('assembles the dashboard with engine statuses and summaries', async () => {
    const { service } = createTestIntelligenceService();
    await service.buildPipeline({ goalId: 'goal_blog_seed' });

    const dashboard = await service.getDashboard();
    expect(dashboard.success).toBe(true);
    const dto = dashboard.data;
    expect(dto?.engineStatus).toHaveLength(6);
    expect(dto?.pipelineSummary.total).toBe(1);
    expect(dto?.pipelineSummary.ready).toBe(1);
    expect(dto?.goals.totalGoals).toBeGreaterThanOrEqual(5);
    expect(dto?.capabilities.total).toBeGreaterThan(0);
    expect(dto?.providers.total).toBeGreaterThan(0);
    expect(dto?.context.total).toBeGreaterThan(0);
    expect(dto?.strategies.total).toBeGreaterThan(0);
    expect(dto?.orchestrator.totalSessions).toBeGreaterThanOrEqual(1);
  });

  it('dashboard survives engines with unavailable summaries', async () => {
    const engines = createTestEngines();
    const { service } = createTestIntelligenceService(engines);
    // Simulate a degraded engine (goal summary fails) without crashing.
    const original = engines.goals.getSummary.bind(engines.goals);
    engines.goals.getSummary = async () => ({ success: false, error: 'degraded' });

    const dashboard = await service.getDashboard();
    expect(dashboard.success).toBe(true);
    expect(dashboard.data?.engineStatus[0]?.status).toBe('unknown');
    expect(dashboard.data?.goals.totalGoals).toBe(0);

    engines.goals.getSummary = original;
  });

  it('dashboard reports unknown status for EVERY degraded engine', async () => {
    const engines = createTestEngines();
    const { service } = createTestIntelligenceService(engines);
    // Degrade all six engines at once — every status helper must fall
    // back to its "unknown" branch without throwing (coverage gate).
    engines.goals.getSummary = async () => ({ success: false, error: 'down' });
    engines.capabilities.getMarketplace = async () => ({ success: false, error: 'down' });
    engines.providers.getMarketplace = async () => ({ success: false, error: 'down' });
    engines.context.getContextSummary = async () => ({ success: false, error: 'down' });
    engines.strategies.getSummary = async () => ({ success: false, error: 'down' });
    engines.orchestrator.getSummary = async () => ({ success: false, error: 'down' });

    const dashboard = await service.getDashboard();
    expect(dashboard.success).toBe(true);
    for (const status of dashboard.data?.engineStatus ?? []) {
      expect(status.status).toBe('unknown');
      expect(status.summary).toContain('unavailable');
    }
    expect(dashboard.data?.goals.totalGoals).toBe(0);
    expect(dashboard.data?.capabilities.total).toBe(0);
    expect(dashboard.data?.providers.total).toBe(0);
    expect(dashboard.data?.context.total).toBe(0);
    expect(dashboard.data?.strategies.total).toBe(0);
    expect(dashboard.data?.orchestrator.totalSessions).toBe(0);
  });
});

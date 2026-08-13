// ──────────────────────────────────────────────────────────────────
// VedMoulya — Intelligence Pipeline Tests: PipelineSummaryService
// EI-006 / INT-001
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { PipelineBuilderService } from '../PipelineBuilderService.js';
import { PipelineSummaryService } from '../PipelineSummaryService.js';
import { createTestEngines } from '../../../application/__tests__/test-engines.js';

describe('PipelineSummaryService', () => {
  it('summarizes a built pipeline compactly', async () => {
    const engines = createTestEngines();
    const builder = new PipelineBuilderService(engines);
    const summaryService = new PipelineSummaryService();

    const pipeline = await builder.build({ goalId: 'goal_blog_seed' });
    const summary = summaryService.summarize(pipeline);

    expect(summary.pipelineId).toBe(pipeline.pipelineId);
    expect(summary.capabilityCount).toBe(pipeline.artifacts.capabilities.length);
    expect(summary.providerCount).toBe(pipeline.artifacts.providers.length);
    expect(summary.contextItemCount).toBe(pipeline.artifacts.contextItems);
    expect(summary.hasStrategy).toBe(true);
    expect(summary.hasGraph).toBe(true);
    expect(summary.hasSession).toBe(true);
  });

  it('aggregates ready/failed totals across pipelines', async () => {
    const engines = createTestEngines();
    const builder = new PipelineBuilderService(engines);
    const summaryService = new PipelineSummaryService();

    const ready = await builder.build({ goalId: 'goal_blog_seed' });
    const failed = await builder.build({ goalId: 'goal_missing' });

    const aggregate = summaryService.aggregate([ready, failed]);
    expect(aggregate.total).toBe(2);
    expect(aggregate.ready).toBe(1);
    expect(aggregate.failed).toBe(1);
  });
});

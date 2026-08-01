// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Decision tRPC Router Tests
// Covers every procedure in createDecisionTrpcRouter via router.createCaller.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDecisionTrpcRouter } from '../DecisionRouter.js';
import type { DecisionApplicationService } from '@vedmoulya/services';

function makeService(): DecisionApplicationService {
  const fn = () => vi.fn().mockResolvedValue({ success: true, data: { id: 'dec_1' } });
  return {
    createDecision: fn(),
    getDecision: fn(),
    updateDecision: fn(),
    archiveDecision: fn(),
    cancelDecision: fn(),
    startAnalysis: fn(),
    startEvaluation: fn(),
    addOption: fn(),
    scoreOption: fn(),
    assessRisk: fn(),
    assessOpportunity: fn(),
    rankOptions: fn(),
    compareOptions: fn(),
    recommend: fn(),
    decide: fn(),
    completeDecision: fn(),
    listDecisions: fn(),
    searchDecisions: fn(),
    getStats: fn(),
  } as unknown as DecisionApplicationService;
}

describe('createDecisionTrpcRouter', () => {
  let service: DecisionApplicationService;
  let caller: Record<string, (...args: unknown[]) => Promise<unknown>>;

  beforeEach(() => {
    service = makeService();
    const router = createDecisionTrpcRouter(service) as unknown as {
      createCaller: (ctx: unknown) => Record<string, (...args: unknown[]) => Promise<unknown>>;
    };
    caller = router.createCaller({});
  });

  it('creates a decision', async () => {
    const result = await caller.createDecision({
      title: 'T',
      description: 'D',
      category: 'technical',
    });

    expect(result).toEqual({ success: true, data: { success: true, data: { id: 'dec_1' } } });
    expect(service.createDecision).toHaveBeenCalledWith({
      title: 'T',
      description: 'D',
      category: 'technical',
    });
  });

  it('gets a decision', async () => {
    await caller.getDecision('dec_1');
    expect(service.getDecision).toHaveBeenCalledWith('dec_1');
  });

  it('updates a decision', async () => {
    await caller.updateDecision({ id: 'dec_1', data: { title: 'Updated' } });
    expect(service.updateDecision).toHaveBeenCalledWith('dec_1', { title: 'Updated' });
  });

  it('archives a decision', async () => {
    await caller.archiveDecision({ id: 'dec_1', reason: 'retired' });
    expect(service.archiveDecision).toHaveBeenCalledWith('dec_1', 'retired');
  });

  it('cancels a decision', async () => {
    await caller.cancelDecision({ id: 'dec_1', reason: 'changed mind' });
    expect(service.cancelDecision).toHaveBeenCalledWith('dec_1', 'changed mind');
  });

  it('starts analysis', async () => {
    await caller.startAnalysis('dec_1');
    expect(service.startAnalysis).toHaveBeenCalledWith('dec_1');
  });

  it('starts evaluation', async () => {
    await caller.startEvaluation('dec_1');
    expect(service.startEvaluation).toHaveBeenCalledWith('dec_1');
  });

  it('adds an option', async () => {
    await caller.addOption({ id: 'dec_1', option: { label: 'Option A', description: 'desc' } });
    // addOptionSchema defaults pros/cons to []
    expect(service.addOption).toHaveBeenCalledWith('dec_1', {
      label: 'Option A',
      description: 'desc',
      pros: [],
      cons: [],
    });
  });

  it('scores an option', async () => {
    const data = { optionId: 'opt_a', criteria: [] };
    await caller.scoreOption({ id: 'dec_1', data });
    expect(service.scoreOption).toHaveBeenCalledWith('dec_1', data);
  });

  it('assesses risk', async () => {
    const data = { optionId: 'opt_a', riskScore: 0.5, description: 'risk' };
    await caller.assessRisk({ id: 'dec_1', data });
    expect(service.assessRisk).toHaveBeenCalledWith('dec_1', data);
  });

  it('assesses opportunity', async () => {
    const data = { optionId: 'opt_a', opportunityScore: 0.8, description: 'opp' };
    await caller.assessOpportunity({ id: 'dec_1', data });
    expect(service.assessOpportunity).toHaveBeenCalledWith('dec_1', data);
  });

  it('decides', async () => {
    const data = { optionId: 'opt_a', reasoningMethod: 'analytical', reasoningSummary: 's' };
    await caller.decide({ id: 'dec_1', data });
    expect(service.decide).toHaveBeenCalledWith('dec_1', data);
  });

  it('completes a decision', async () => {
    const data = { result: 'success', description: 'done' };
    await caller.completeDecision({ id: 'dec_1', data });
    expect(service.completeDecision).toHaveBeenCalledWith('dec_1', data);
  });

  it('ranks options', async () => {
    await caller.rankOptions('dec_1');
    expect(service.rankOptions).toHaveBeenCalledWith('dec_1');
  });

  it('gets a recommendation', async () => {
    await caller.getRecommendation('dec_1');
    expect(service.recommend).toHaveBeenCalledWith('dec_1');
  });

  it('compares options', async () => {
    await caller.compareOptions({ id: 'dec_1', optionA: 'opt_a', optionB: 'opt_b' });
    expect(service.compareOptions).toHaveBeenCalledWith('dec_1', 'opt_a', 'opt_b');
  });

  it('lists decisions', async () => {
    await caller.listDecisions({ page: 2, limit: 10 });
    expect(service.listDecisions).toHaveBeenCalledWith(2, 10);
  });

  it('gets statistics', async () => {
    await caller.getStats();
    expect(service.getStats).toHaveBeenCalled();
  });
});

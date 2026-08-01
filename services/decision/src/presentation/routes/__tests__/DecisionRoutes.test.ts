// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Decision Routes Tests
// Covers createDecisionRouter wiring (all endpoint registrations, middleware
// stack) and the decisionRouteConfig metadata.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDecisionRouter, decisionRouteConfig } from '../DecisionRoutes.js';
import type { DecisionApplicationService } from '@vedmoulya/services';

function makeService(): DecisionApplicationService {
  const fn = () => vi.fn().mockResolvedValue({ success: true, data: {} });
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

describe('DecisionRoutes', () => {
  let service: DecisionApplicationService;
  let router: ReturnType<typeof createDecisionRouter>;

  beforeEach(() => {
    service = makeService();
    router = createDecisionRouter(service);
  });

  it('exposes route configuration metadata', () => {
    expect(decisionRouteConfig.basePath).toBe('/api/v1/decision');
    expect(decisionRouteConfig.tags).toContain('Decision Intelligence Engine');
    expect(decisionRouteConfig.description).toContain('Decision Engine API');
  });

  it('routes health requests', async () => {
    const res = await router.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'healthy', service: 'decision' });
  });

  it('creates a decision via POST /decisions', async () => {
    (service.createDecision as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { id: 'dec_1' },
    });

    const res = await router.request('/decisions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'T', description: 'D', category: 'technical' }),
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, data: { id: 'dec_1' } });
  });

  it('rejects invalid create payloads with 400', async () => {
    const res = await router.request('/decisions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '' }),
    });

    expect(res.status).toBe(400);
  });

  it('routes GET /decisions to the list handler', async () => {
    (service.listDecisions as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { data: [], total: 0 },
    });

    const res = await router.request('/decisions');

    expect(res.status).toBe(200);
    expect(service.listDecisions).toHaveBeenCalled();
  });

  it('routes PATCH /decisions/:id to the update handler', async () => {
    (service.updateDecision as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { id: 'dec_1' },
    });

    const res = await router.request('/decisions/dec_1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    });

    expect(res.status).toBe(200);
    expect(service.updateDecision).toHaveBeenCalledWith('dec_1', { title: 'Updated' });
  });

  it('routes DELETE /decisions/:id to archive', async () => {
    (service.archiveDecision as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { id: 'dec_1' },
    });

    const res = await router.request('/decisions/dec_1', { method: 'DELETE' });

    expect(res.status).toBe(200);
    expect(service.archiveDecision).toHaveBeenCalledWith('dec_1', 'User requested deletion');
  });

  it('routes lifecycle, option, decide, complete, archive, cancel, compare, search and stats endpoints', async () => {
    const calls: Array<[string, string]> = [
      ['POST', '/decisions/dec_1/analyze'],
      ['POST', '/decisions/dec_1/evaluate'],
      ['GET', '/decisions/dec_1/rankings'],
      ['GET', '/decisions/dec_1/recommend'],
      ['GET', '/decisions/dec_1'],
      ['POST', '/decisions/dec_1/archive'],
      ['POST', '/decisions/dec_1/cancel'],
      ['GET', '/decisions/search'],
      ['GET', '/decisions/stats'],
      ['GET', '/decisions/dec_1/compare/opt_a/opt_b'],
    ];

    for (const [method, path] of calls) {
      const res = await router.request(path, { method });
      expect(res.status).toBe(200);
    }
  });

  it('routes static /search and /stats to their handlers, not the :id parameterized route', async () => {
    // Regression guard for the routing-order fix: static routes must be
    // registered BEFORE /decisions/:id, otherwise getDecision swallows them
    // (the execution routes test proved Hono matches the first registered
    // route for the same shape).
    await router.request('/decisions/search?q=launch');
    await router.request('/decisions/stats');

    expect(service.searchDecisions).toHaveBeenCalled();
    expect(service.getStats).toHaveBeenCalled();
    expect(service.getDecision).not.toHaveBeenCalled();
  });

  it('routes option sub-resources', async () => {
    const optionCalls: Array<[string, string, string]> = [
      ['POST', '/decisions/dec_1/options', '{"label":"Option A","description":"desc"}'],
      ['POST', '/decisions/dec_1/options/opt_a/score', '{"optionId":"opt_a","criteria":[]}'],
      [
        'POST',
        '/decisions/dec_1/options/opt_a/risk',
        '{"optionId":"opt_a","riskScore":0.5,"description":"risk"}',
      ],
      [
        'POST',
        '/decisions/dec_1/options/opt_a/opportunity',
        '{"optionId":"opt_a","opportunityScore":0.8,"description":"opp"}',
      ],
      [
        'POST',
        '/decisions/dec_1/decide',
        '{"optionId":"opt_a","reasoningMethod":"analytical","reasoningSummary":"s"}',
      ],
      ['POST', '/decisions/dec_1/complete', '{"result":"success","description":"done"}'],
    ];

    for (const [method, path, body] of optionCalls) {
      const res = await router.request(path, {
        method,
        headers: { 'content-type': 'application/json' },
        body,
      });
      expect(res.status).toBe(200);
    }
  });
});

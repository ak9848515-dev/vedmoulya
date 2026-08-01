// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Decision Controller Tests
// Covers every HTTP handler: success, validation-error (400), not-found (404),
// service-error, and thrown-error paths.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Context } from 'hono';
import { DecisionController } from '../DecisionController.js';
import type { DecisionApplicationService } from '@vedmoulya/services';

type MockCtx = {
  req: {
    json: ReturnType<typeof vi.fn>;
    param: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
  json: ReturnType<typeof vi.fn>;
};

function makeContext(body: unknown = {}, params: Record<string, string> = {}): MockCtx {
  const param = vi.fn((key: string) => params[key] ?? 'dec_1');
  return {
    req: {
      json: vi.fn().mockResolvedValue(body),
      param,
      query: vi.fn().mockReturnValue({}),
    },
    json: vi.fn(),
  };
}

function makeService(): DecisionApplicationService {
  const fn = () => vi.fn();
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

const success = { success: true, data: { id: 'dec_1' } };
// No `error` field: exercises the `result.error ?? 'fallback'` branches in
// every handler (message falls back to the hardcoded default).
const failure = { success: false };

/**
 * Assert the controller returned an error response with the expected error
 * code and status. Uses toMatchObject on the captured call args because
 * expect.objectContaining compares nested plain objects with full equality
 * (the received error object carries extra message/details keys).
 */
function expectError(c: MockCtx, code: string, status: number): void {
  expect(c.json).toHaveBeenCalledTimes(1);
  const [body, statusCode] = c.json.mock.calls[0] as [Record<string, unknown>, number];
  expect(statusCode).toBe(status);
  expect(body).toMatchObject({ success: false, error: { code } });
}

describe('DecisionController', () => {
  let service: DecisionApplicationService;
  let controller: DecisionController;

  beforeEach(() => {
    service = makeService();
    controller = new DecisionController(service);
  });

  describe('createDecision', () => {
    it('returns 201 on success', async () => {
      (service.createDecision as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext({ title: 'T', description: 'D', category: 'technical' });

      await controller.createDecision(c as unknown as Context);

      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'dec_1' } }, 201);
    });

    it('returns 400 on validation failure', async () => {
      const c = makeContext({ title: '' });

      await controller.createDecision(c as unknown as Context);

      expectError(c, 'VALIDATION_ERROR', 400);
    });

    it('returns 400 when the service fails', async () => {
      (service.createDecision as ReturnType<typeof vi.fn>).mockResolvedValue(failure);
      const c = makeContext({ title: 'T', description: 'D', category: 'technical' });

      await controller.createDecision(c as unknown as Context);

      expectError(c, 'CREATE_ERROR', 400);
    });

    it('maps thrown errors', async () => {
      (service.createDecision as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
      const c = makeContext({ title: 'T', description: 'D', category: 'technical' });

      await controller.createDecision(c as unknown as Context);

      expectError(c, 'INTERNAL_ERROR', 500);
    });
  });

  describe('getDecision', () => {
    it('returns 200 on success', async () => {
      (service.getDecision as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext();

      await controller.getDecision(c as unknown as Context);

      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'dec_1' } });
    });

    it('returns 404 when not found', async () => {
      (service.getDecision as ReturnType<typeof vi.fn>).mockResolvedValue(failure);
      const c = makeContext();

      await controller.getDecision(c as unknown as Context);

      expectError(c, 'NOT_FOUND', 404);
    });
  });

  describe('updateDecision', () => {
    it('returns 200 on success', async () => {
      (service.updateDecision as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext({ title: 'Updated' });

      await controller.updateDecision(c as unknown as Context);

      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'dec_1' } });
    });

    it('returns 400 on validation failure', async () => {
      const c = makeContext({ title: 42 });

      await controller.updateDecision(c as unknown as Context);

      expectError(c, 'VALIDATION_ERROR', 400);
    });

    it('returns 404 when not found', async () => {
      (service.updateDecision as ReturnType<typeof vi.fn>).mockResolvedValue(failure);
      const c = makeContext({ title: 'Updated' });

      await controller.updateDecision(c as unknown as Context);

      expectError(c, 'NOT_FOUND', 404);
    });
  });

  describe('deleteDecision', () => {
    it('archives and returns 200', async () => {
      (service.archiveDecision as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext();

      await controller.deleteDecision(c as unknown as Context);

      expect(service.archiveDecision).toHaveBeenCalledWith('dec_1', 'User requested deletion');
      expect(c.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Decision archived' },
      });
    });

    it('returns 404 when not found', async () => {
      (service.archiveDecision as ReturnType<typeof vi.fn>).mockResolvedValue(failure);
      const c = makeContext();

      await controller.deleteDecision(c as unknown as Context);

      expectError(c, 'NOT_FOUND', 404);
    });
  });

  describe('lifecycle handlers', () => {
    it('startAnalysis returns 200 on success', async () => {
      (service.startAnalysis as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext();

      await controller.startAnalysis(c as unknown as Context);

      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'dec_1' } });
    });

    it('startEvaluation returns 200 on success', async () => {
      (service.startEvaluation as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext();

      await controller.startEvaluation(c as unknown as Context);

      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'dec_1' } });
    });

    it('startAnalysis returns 404 when not found', async () => {
      (service.startAnalysis as ReturnType<typeof vi.fn>).mockResolvedValue(failure);
      const c = makeContext();

      await controller.startAnalysis(c as unknown as Context);

      expectError(c, 'NOT_FOUND', 404);
    });
  });

  describe('addOption', () => {
    it('returns 200 on success', async () => {
      (service.addOption as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext({ label: 'Option A', description: 'desc' });

      await controller.addOption(c as unknown as Context);

      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'dec_1' } });
    });

    it('returns 400 on validation failure', async () => {
      const c = makeContext({ label: '' });

      await controller.addOption(c as unknown as Context);

      expectError(c, 'VALIDATION_ERROR', 400);
    });

    it('returns 404 when not found', async () => {
      (service.addOption as ReturnType<typeof vi.fn>).mockResolvedValue(failure);
      const c = makeContext({ label: 'Option A', description: 'desc' });

      await controller.addOption(c as unknown as Context);

      expectError(c, 'NOT_FOUND', 404);
    });
  });

  describe('scoreOption', () => {
    it('returns 200 on success', async () => {
      (service.scoreOption as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext({ optionId: 'opt_a', criteria: [] });

      await controller.scoreOption(c as unknown as Context);

      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'dec_1' } });
    });

    it('returns 400 on validation failure', async () => {
      const c = makeContext({});

      await controller.scoreOption(c as unknown as Context);

      expectError(c, 'VALIDATION_ERROR', 400);
    });
  });

  describe('assessRisk', () => {
    it('returns 200 on success', async () => {
      (service.assessRisk as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext({ optionId: 'opt_a', riskScore: 0.5, description: 'risk' });

      await controller.assessRisk(c as unknown as Context);

      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'dec_1' } });
    });

    it('returns 400 on validation failure', async () => {
      const c = makeContext({ optionId: 'opt_a' });

      await controller.assessRisk(c as unknown as Context);

      expectError(c, 'VALIDATION_ERROR', 400);
    });
  });

  describe('assessOpportunity', () => {
    it('returns 200 on success', async () => {
      (service.assessOpportunity as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext({ optionId: 'opt_a', opportunityScore: 0.8, description: 'opp' });

      await controller.assessOpportunity(c as unknown as Context);

      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'dec_1' } });
    });

    it('returns 400 on validation failure', async () => {
      const c = makeContext({ optionId: 'opt_a' });

      await controller.assessOpportunity(c as unknown as Context);

      expectError(c, 'VALIDATION_ERROR', 400);
    });
  });

  describe('rankOptions', () => {
    it('returns 200 on success', async () => {
      (service.rankOptions as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext();

      await controller.rankOptions(c as unknown as Context);

      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'dec_1' } });
    });

    it('returns 404 when not found', async () => {
      (service.rankOptions as ReturnType<typeof vi.fn>).mockResolvedValue(failure);
      const c = makeContext();

      await controller.rankOptions(c as unknown as Context);

      expectError(c, 'NOT_FOUND', 404);
    });
  });

  describe('compareOptions', () => {
    it('returns 200 on success', async () => {
      (service.compareOptions as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext({}, { id: 'dec_1', optionA: 'opt_a', optionB: 'opt_b' });

      await controller.compareOptions(c as unknown as Context);

      expect(service.compareOptions).toHaveBeenCalledWith('dec_1', 'opt_a', 'opt_b');
      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'dec_1' } });
    });
  });

  describe('recommend', () => {
    it('returns 200 on success', async () => {
      (service.recommend as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext();

      await controller.recommend(c as unknown as Context);

      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'dec_1' } });
    });

    it('returns 404 when not found', async () => {
      (service.recommend as ReturnType<typeof vi.fn>).mockResolvedValue(failure);
      const c = makeContext();

      await controller.recommend(c as unknown as Context);

      expectError(c, 'NOT_FOUND', 404);
    });
  });

  describe('decide', () => {
    it('returns 200 on success', async () => {
      (service.decide as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext({
        optionId: 'opt_a',
        reasoningMethod: 'analytical',
        reasoningSummary: 's',
      });

      await controller.decide(c as unknown as Context);

      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'dec_1' } });
    });

    it('returns 400 on validation failure', async () => {
      const c = makeContext({ optionId: 'opt_a' });

      await controller.decide(c as unknown as Context);

      expectError(c, 'VALIDATION_ERROR', 400);
    });

    it('returns 400 on service failure', async () => {
      (service.decide as ReturnType<typeof vi.fn>).mockResolvedValue(failure);
      const c = makeContext({
        optionId: 'opt_a',
        reasoningMethod: 'analytical',
        reasoningSummary: 's',
      });

      await controller.decide(c as unknown as Context);

      expectError(c, 'DECIDE_ERROR', 400);
    });
  });

  describe('completeDecision', () => {
    it('returns 200 on success', async () => {
      (service.completeDecision as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext({ result: 'success', description: 'done' });

      await controller.completeDecision(c as unknown as Context);

      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'dec_1' } });
    });

    it('returns 400 on service failure', async () => {
      (service.completeDecision as ReturnType<typeof vi.fn>).mockResolvedValue(failure);
      const c = makeContext({ result: 'success', description: 'done' });

      await controller.completeDecision(c as unknown as Context);

      expectError(c, 'COMPLETE_ERROR', 400);
    });
  });

  describe('archiveDecision', () => {
    it('passes the body reason through', async () => {
      (service.archiveDecision as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext({ reason: 'retired' });

      await controller.archiveDecision(c as unknown as Context);

      expect(service.archiveDecision).toHaveBeenCalledWith('dec_1', 'retired');
    });

    it('tolerates a missing body', async () => {
      (service.archiveDecision as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext();
      (c.req.json as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('no body'));

      await controller.archiveDecision(c as unknown as Context);

      expect(service.archiveDecision).toHaveBeenCalledWith('dec_1', undefined);
    });
  });

  describe('cancelDecision', () => {
    it('defaults the reason when the body is missing', async () => {
      (service.cancelDecision as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext();
      (c.req.json as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('no body'));

      await controller.cancelDecision(c as unknown as Context);

      expect(service.cancelDecision).toHaveBeenCalledWith('dec_1', 'Cancelled by user');
      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'dec_1' } });
    });

    it('returns 404 when not found', async () => {
      (service.cancelDecision as ReturnType<typeof vi.fn>).mockResolvedValue(failure);
      const c = makeContext();

      await controller.cancelDecision(c as unknown as Context);

      expectError(c, 'NOT_FOUND', 404);
    });
  });

  describe('listDecisions', () => {
    it('returns 200 on success', async () => {
      (service.listDecisions as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext();
      (c.req.query as ReturnType<typeof vi.fn>).mockReturnValue({ page: '1', limit: '10' });

      await controller.listDecisions(c as unknown as Context);

      expect(service.listDecisions).toHaveBeenCalledWith(1, 10);
      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'dec_1' } });
    });

    it('returns 400 on validation failure', async () => {
      const c = makeContext();
      (c.req.query as ReturnType<typeof vi.fn>).mockReturnValue({ page: '-1' });

      await controller.listDecisions(c as unknown as Context);

      expectError(c, 'VALIDATION_ERROR', 400);
    });

    it('returns 500 on service failure', async () => {
      (service.listDecisions as ReturnType<typeof vi.fn>).mockResolvedValue(failure);
      const c = makeContext();

      await controller.listDecisions(c as unknown as Context);

      expectError(c, 'LIST_ERROR', 500);
    });
  });

  describe('searchDecisions', () => {
    it('returns 200 on success', async () => {
      (service.searchDecisions as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext();
      (c.req.query as ReturnType<typeof vi.fn>).mockReturnValue({
        q: 'framework',
        category: 'technical',
        status: 'decided',
      });

      await controller.searchDecisions(c as unknown as Context);

      expect(service.searchDecisions).toHaveBeenCalledWith({
        query: 'framework',
        categories: ['technical'],
        statuses: ['decided'],
        page: 1,
        limit: 20,
      });
      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'dec_1' } });
    });

    it('returns 500 on service failure', async () => {
      (service.searchDecisions as ReturnType<typeof vi.fn>).mockResolvedValue(failure);
      const c = makeContext();

      await controller.searchDecisions(c as unknown as Context);

      expectError(c, 'SEARCH_ERROR', 500);
    });
  });

  describe('getStatistics', () => {
    it('returns 200 on success', async () => {
      (service.getStats as ReturnType<typeof vi.fn>).mockResolvedValue(success);
      const c = makeContext();

      await controller.getStatistics(c as unknown as Context);

      expect(c.json).toHaveBeenCalledWith({ success: true, data: { id: 'dec_1' } });
    });

    it('returns 500 on service failure', async () => {
      (service.getStats as ReturnType<typeof vi.fn>).mockResolvedValue(failure);
      const c = makeContext();

      await controller.getStatistics(c as unknown as Context);

      expectError(c, 'STATS_ERROR', 500);
    });
  });

  describe('health', () => {
    it('returns a healthy status', () => {
      const c = makeContext();

      controller.health(c as unknown as Context);

      expect(c.json).toHaveBeenCalledWith({ status: 'healthy', service: 'decision' });
    });
  });

  describe('thrown service errors map to 500 for every handler', () => {
    // Each entry: [handler, service method, request body]. The catch branch in
    // every handler is only exercised when the service throws.
    const cases: Array<[string, string, Record<string, unknown>]> = [
      ['getDecision', 'getDecision', {}],
      ['updateDecision', 'updateDecision', { title: 'Updated' }],
      ['deleteDecision', 'archiveDecision', {}],
      ['startAnalysis', 'startAnalysis', {}],
      ['startEvaluation', 'startEvaluation', {}],
      ['addOption', 'addOption', { label: 'Option A', description: 'desc' }],
      ['scoreOption', 'scoreOption', { optionId: 'opt_a', criteria: [] }],
      ['assessRisk', 'assessRisk', { optionId: 'opt_a', riskScore: 0.5, description: 'risk' }],
      [
        'assessOpportunity',
        'assessOpportunity',
        { optionId: 'opt_a', opportunityScore: 0.8, description: 'opp' },
      ],
      ['rankOptions', 'rankOptions', {}],
      ['compareOptions', 'compareOptions', {}],
      ['recommend', 'recommend', {}],
      [
        'decide',
        'decide',
        { optionId: 'opt_a', reasoningMethod: 'analytical', reasoningSummary: 's' },
      ],
      ['completeDecision', 'completeDecision', { result: 'success', description: 'done' }],
      ['archiveDecision', 'archiveDecision', { reason: 'retired' }],
      ['cancelDecision', 'cancelDecision', { reason: 'why' }],
      ['listDecisions', 'listDecisions', {}],
      ['searchDecisions', 'searchDecisions', {}],
      ['getStatistics', 'getStats', {}],
    ];

    it.each(cases)('%s maps thrown errors to INTERNAL_ERROR 500', async (handler, method, body) => {
      (
        service[method as keyof DecisionApplicationService] as ReturnType<typeof vi.fn>
      ).mockRejectedValue(new Error('boom'));
      const c = makeContext(body);

      await (controller as unknown as Record<string, (ctx: Context) => Promise<Response>>)[handler](
        c as unknown as Context,
      );

      expectError(c, 'INTERNAL_ERROR', 500);
    });
  });
});

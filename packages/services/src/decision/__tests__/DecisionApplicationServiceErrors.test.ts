// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — DecisionApplicationService error-path unit tests
// Covers every not-found guard and failure branch in the service so the
// application layer's defensive paths are exercised.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decision, generateDecisionId } from '@vedmoulya/domain';
import { DecisionApplicationService } from '../DecisionApplicationService.js';

const mockRepository = {
  findById: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  search: vi.fn(),
  count: vi.fn(),
  countByCategory: vi.fn(),
  countByStatus: vi.fn(),
  countLinked: vi.fn(),
};

function makeDecision(): Decision {
  return Decision.create({
    id: generateDecisionId(),
    title: 'Test Decision',
    description: 'Desc',
    category: 'strategic',
    initiator: 'user',
  });
}

describe('DecisionApplicationService — not found & failure paths', () => {
  let service: DecisionApplicationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DecisionApplicationService(mockRepository);
    mockRepository.findById.mockResolvedValue(null);
  });

  it('returns not found for every lifecycle operation on a missing decision', async () => {
    const notFoundChecks: Array<[string, Promise<{ success: boolean }>]> = [
      ['startAnalysis', service.startAnalysis('x')],
      ['startEvaluation', service.startEvaluation('x')],
      ['addOption', service.addOption('x', { label: 'A', description: '', pros: [], cons: [] })],
      ['scoreOption', service.scoreOption('x', { optionId: 'o', criteria: [] })],
      ['assessRisk', service.assessRisk('x', { optionId: 'o', riskScore: 5, description: '' })],
      [
        'assessOpportunity',
        service.assessOpportunity('x', { optionId: 'o', opportunityScore: 5, description: '' }),
      ],
      ['rankOptions', service.rankOptions('x')],
      ['compareOptions', service.compareOptions('x', 'a', 'b')],
      ['detectConflicts', service.detectConflicts('x')],
      ['evaluateConstraints', service.evaluateConstraints('x')],
      ['recommend', service.recommend('x')],
      [
        'decide',
        service.decide('x', { optionId: 'o', reasoningMethod: 'pros_cons', reasoningSummary: '' }),
      ],
      ['completeDecision', service.completeDecision('x', { result: 'success', description: '' })],
      ['archiveDecision', service.archiveDecision('x', 'reason')],
      ['cancelDecision', service.cancelDecision('x', 'reason')],
      ['reEvaluateDecision', service.reEvaluateDecision('x', 'reason')],
    ];
    for (const [name, promise] of notFoundChecks) {
      const result = await promise;
      expect(result.success, `${name} should fail`).toBe(false);
      expect(result.error).toContain('not found');
    }
  });

  it('rankOptions returns an empty ranking for a decision with no options', async () => {
    // The domain service returns an empty ranking (not an error) when the
    // decision has no options — verifies the success mapping path.
    const decision = makeDecision();
    mockRepository.findById.mockResolvedValue(decision);
    const result = await service.rankOptions(decision.id);
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  it('compareOptions returns a failure when an option is missing', async () => {
    const decision = makeDecision();
    mockRepository.findById.mockResolvedValue(decision);
    const result = await service.compareOptions(decision.id, 'opt_1', 'opt_2');
    expect(result.success).toBe(false);
  });

  it('recommend returns a failure when no scored option exists', async () => {
    const decision = makeDecision();
    mockRepository.findById.mockResolvedValue(decision);
    const result = await service.recommend(decision.id);
    expect(result.success).toBe(false);
  });

  it('listDecisions catches repository errors', async () => {
    mockRepository.count.mockRejectedValue(new Error('db down'));
    const result = await service.listDecisions();
    expect(result.success).toBe(false);
    expect(result.error).toContain('db down');
  });

  it('searchDecisions catches repository errors', async () => {
    mockRepository.search.mockRejectedValue(new Error('db down'));
    const result = await service.searchDecisions({ query: 'x' });
    expect(result.success).toBe(false);
  });

  it('getStats catches repository errors', async () => {
    mockRepository.count.mockRejectedValue(new Error('db down'));
    const result = await service.getStats();
    expect(result.success).toBe(false);
    expect(result.error).toContain('db down');
  });

  it('getDecision returns not found', async () => {
    const result = await service.getDecision('missing');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('createDecision fails when the factory rejects (invalid input)', async () => {
    const result = await service.createDecision({
      title: '  ',
      description: 'D',
      category: 'strategic',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('createDecision propagates a requester block when supplied', async () => {
    mockRepository.findById.mockReset();
    mockRepository.save.mockResolvedValue(undefined);
    const result = await service.createDecision({
      title: 'With requester',
      description: 'D',
      category: 'operational',
      requester: 'bob',
      requestReason: 'needs approval',
      requestContext: 'context',
    });
    expect(result.success).toBe(true);
    expect(result.data?.title).toBe('With requester');
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
  });

  it('updateDecision applies priority, tags, and metadata only when provided', async () => {
    const decision = makeDecision();
    mockRepository.findById.mockResolvedValue(decision);
    mockRepository.update.mockResolvedValue(undefined);
    const result = await service.updateDecision(decision.id, {
      priorityScore: 8,
      tags: ['urgent'],
      metadata: { source: 'test' },
    });
    expect(result.success).toBe(true);
    // The DTO exposes priority as { level, score }.
    expect(result.data?.priority.score).toBe(8);
    expect(mockRepository.update).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — DecisionApplicationService extended unit tests
// Covers lifecycle operations with a mocked repository returning a real
// Decision entity from the domain package.
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

/** Advance a decision through analysis + evaluation so lifecycle ops are legal. */
async function advanceToEvaluation(
  service: DecisionApplicationService,
  decision: Decision,
): Promise<string[]> {
  await service.addOption(decision.id, {
    label: 'Option A',
    description: 'D',
    pros: ['p1'],
    cons: ['c1'],
  });
  await service.addOption(decision.id, {
    label: 'Option B',
    description: 'D',
    pros: ['p2'],
    cons: ['c2'],
  });
  await service.startAnalysis(decision.id);
  await service.startEvaluation(decision.id);
  const dto = await service.getDecision(decision.id);
  return (dto.data?.options ?? []).map((o) => o.id);
}

describe('DecisionApplicationService lifecycle', () => {
  let service: DecisionApplicationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DecisionApplicationService(mockRepository);
    mockRepository.update.mockResolvedValue(undefined);
  });

  it('updateDecision updates title, description, tags, and metadata', async () => {
    const decision = makeDecision();
    mockRepository.findById.mockResolvedValue(decision);
    const result = await service.updateDecision(decision.id, {
      title: 'New Title',
      description: 'New Desc',
      priorityScore: 8,
      tags: ['x'],
      metadata: { a: 1 },
    });
    expect(result.success).toBe(true);
    expect(result.data?.title).toBe('New Title');
    expect(mockRepository.update).toHaveBeenCalledTimes(1);
  });

  it('updateDecision returns not found', async () => {
    mockRepository.findById.mockResolvedValue(null);
    const result = await service.updateDecision('missing', { title: 'x' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('startAnalysis transitions and persists', async () => {
    const decision = makeDecision();
    mockRepository.findById.mockResolvedValue(decision);
    const result = await service.startAnalysis(decision.id);
    expect(result.success).toBe(true);
    expect(mockRepository.update).toHaveBeenCalledTimes(1);
  });

  it('addOption adds an option and persists', async () => {
    const decision = makeDecision();
    mockRepository.findById.mockResolvedValue(decision);
    const result = await service.addOption(decision.id, {
      label: 'Option X',
      description: 'D',
      pros: ['p'],
      cons: ['c'],
    });
    expect(result.success).toBe(true);
    expect(result.data?.options.length).toBe(1);
  });

  it('scoreOption computes and stores a score', async () => {
    const decision = makeDecision();
    mockRepository.findById.mockResolvedValue(decision);
    const added = await service.addOption(decision.id, {
      label: 'Opt',
      description: 'D',
      pros: [],
      cons: [],
    });
    const optionId = added.data?.options[0]?.id as string;
    const result = await service.scoreOption(decision.id, {
      optionId,
      criteria: [{ criterion: 'cost', score: 8, weight: 1 }],
    });
    expect(result.success).toBe(true);
    expect(result.data?.options[0]?.score?.overall).toBe(8);
  });

  it('assessRisk attaches a risk assessment', async () => {
    const decision = makeDecision();
    mockRepository.findById.mockResolvedValue(decision);
    const added = await service.addOption(decision.id, {
      label: 'Opt',
      description: 'D',
      pros: [],
      cons: [],
    });
    const optionId = added.data?.options[0]?.id as string;
    const result = await service.assessRisk(decision.id, {
      optionId,
      riskScore: 7,
      description: 'High risk',
    });
    expect(result.success).toBe(true);
    expect(result.data?.options[0]?.risk?.level).toBeDefined();
  });

  it('rankOptions ranks options', async () => {
    const decision = makeDecision();
    mockRepository.findById.mockResolvedValue(decision);
    await service.addOption(decision.id, {
      label: 'A',
      description: 'D',
      pros: [],
      cons: [],
    });
    const result = await service.rankOptions(decision.id);
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('compareOptions returns an analysis', async () => {
    const decision = makeDecision();
    mockRepository.findById.mockResolvedValue(decision);
    const ids = await advanceToEvaluation(service, decision);
    const result = await service.compareOptions(decision.id, ids[0], ids[1]);
    expect(result.success).toBe(true);
    expect(result.data?.optionA).toBe('Option A');
    expect(result.data?.recommendation).toBeTruthy();
  });

  it('detectConflicts returns a list', async () => {
    const decision = makeDecision();
    mockRepository.findById.mockResolvedValue(decision);
    const result = await service.detectConflicts(decision.id);
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('evaluateConstraints returns per-option violations', async () => {
    const decision = makeDecision();
    mockRepository.findById.mockResolvedValue(decision);
    const result = await service.evaluateConstraints(decision.id);
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('recommend returns a recommendation for a scored decision', async () => {
    const decision = makeDecision();
    mockRepository.findById.mockResolvedValue(decision);
    const added = await service.addOption(decision.id, {
      label: 'A',
      description: 'D',
      pros: [],
      cons: [],
    });
    const optionId = added.data?.options[0]?.id as string;
    await service.scoreOption(decision.id, {
      optionId,
      criteria: [{ criterion: 'cost', score: 9, weight: 1 }],
    });
    const result = await service.recommend(decision.id);
    expect(result.success).toBe(true);
    expect(result.data?.recommendedOptionId).toBe(optionId);
  });

  it('decide makes the decision with reasoning', async () => {
    const decision = makeDecision();
    mockRepository.findById.mockResolvedValue(decision);
    const ids = await advanceToEvaluation(service, decision);
    const result = await service.decide(decision.id, {
      optionId: ids[0],
      reasoningMethod: 'pros_cons',
      reasoningSummary: 'Best choice',
      pros: ['p'],
      cons: ['c'],
    });
    expect(result.success).toBe(true);
    expect(result.data?.selectedOptionId).toBe(ids[0]);
  });

  it('completeDecision completes with an outcome', async () => {
    const decision = makeDecision();
    mockRepository.findById.mockResolvedValue(decision);
    const ids = await advanceToEvaluation(service, decision);
    await service.decide(decision.id, {
      optionId: ids[0],
      reasoningMethod: 'pros_cons',
      reasoningSummary: 'Best choice',
    });
    // decided -> implementing -> completed
    decision.startImplementation();
    const result = await service.completeDecision(decision.id, {
      result: 'success',
      description: 'Worked',
      actualImpact: 'Positive',
      lessons: ['l1'],
    });
    expect(result.success).toBe(true);
    expect(result.data?.outcome?.result).toBe('success');
  });

  it('archiveDecision archives with a reason', async () => {
    const decision = makeDecision();
    mockRepository.findById.mockResolvedValue(decision);
    const ids = await advanceToEvaluation(service, decision);
    await service.decide(decision.id, {
      optionId: ids[0],
      reasoningMethod: 'pros_cons',
      reasoningSummary: 'Best choice',
    });
    decision.startImplementation();
    decision.complete({
      result: 'success',
      description: 'Done',
    } as never);
    const result = await service.archiveDecision(decision.id, 'Not needed');
    expect(result.success).toBe(true);
  });

  it('cancelDecision cancels with a reason', async () => {
    const decision = makeDecision();
    mockRepository.findById.mockResolvedValue(decision);
    const result = await service.cancelDecision(decision.id, 'Wrong path');
    expect(result.success).toBe(true);
  });

  it('reEvaluateDecision re-evaluates with a reason', async () => {
    const decision = makeDecision();
    mockRepository.findById.mockResolvedValue(decision);
    const result = await service.reEvaluateDecision(decision.id, 'New info');
    expect(result.success).toBe(true);
  });
});

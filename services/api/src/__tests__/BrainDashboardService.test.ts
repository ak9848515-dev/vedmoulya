// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Brain Operating Dashboard tests (EPIC-020 §13)
//
// The dashboard is a read-only composition of existing telemetry. These tests
// prove: the five dashboard questions are answered from REAL service reads
// (never fabricated), owner-scoped at the boundary, status derivation is
// honest (approval > working > idle), provider health/usage degrade to honest
// zeros on failure, and the scheduler section reports real cadence state.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi } from 'vitest';
import { BrainDashboardService } from '../services/BrainDashboardService.js';
import type { BrainDashboardInput } from '../services/BrainDashboardService.js';

const NOW = '2026-08-13T00:00:00.000Z';

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    objective: 'objective',
    status: 'RUNNING',
    stage: 'EXECUTE',
    updatedAt: NOW,
    approvalRequired: [],
    ...overrides,
  };
}

function outcomeMemory(overrides: Record<string, unknown> = {}) {
  return {
    taskId: 't1',
    taskType: 'coding',
    outcome: 'SUCCESS',
    userAccepted: true,
    capturedAt: NOW,
    verdict: 'VERIFIED',
    verificationPassed: true,
    signals: [{ fact: 'f', kind: 'FACT', source: 'EXPLICIT', confidence: 1, capturedAt: NOW }],
    ...overrides,
  };
}

function createInput(overrides: Partial<BrainDashboardInput> = {}): {
  input: BrainDashboardInput;
  brain: {
    listTasks: ReturnType<typeof vi.fn>;
    listOpportunities: ReturnType<typeof vi.fn>;
    listIntelligenceEvents: ReturnType<typeof vi.fn>;
    providerScores: ReturnType<typeof vi.fn>;
  };
  outcomeMemory: { list: ReturnType<typeof vi.fn> };
  providerExperience: { getOverview: ReturnType<typeof vi.fn> };
  aiWorldScheduler: { getStatus: ReturnType<typeof vi.fn> };
} {
  const brain = {
    listTasks: vi.fn(() => ({ data: [] })),
    listOpportunities: vi.fn(() => ({ data: [] })),
    listIntelligenceEvents: vi.fn(() => ({ data: [] })),
    providerScores: vi.fn(() => ({ data: [] })),
  };
  const outcomeMemory = { list: vi.fn(() => []) };
  const providerExperience = {
    getOverview: vi.fn(async () => ({ success: true, data: { providers: [], usage: {} } })),
  };
  const aiWorldScheduler = {
    getStatus: vi.fn(() => ({
      nextDiscoveryAt: NOW,
      meaningfulUpdates: 3,
      jobs: [{ enabled: true }, { enabled: true }, { enabled: false }],
    })),
  };
  const input = {
    brain: brain as never,
    outcomeMemory: outcomeMemory as never,
    providerExperience: providerExperience as never,
    aiWorldScheduler: aiWorldScheduler as never,
    ...overrides,
  };
  return { input, brain, outcomeMemory, providerExperience, aiWorldScheduler };
}

describe('BrainDashboardService', () => {
  it('reports IDLE when nothing is running and no approvals are pending', async () => {
    const { input } = createInput();
    const view = await new BrainDashboardService(input).get('u1');
    expect(view.brainStatus).toBe('IDLE');
    expect(view.activeTasks).toBe(0);
    expect(view.generatedAt).toBeDefined();
  });

  it('reports WORKING when tasks are actively executing/verifying', async () => {
    const { input, brain } = createInput();
    brain.listTasks.mockReturnValue({
      data: [
        task({ id: 'a', status: 'RUNNING' }),
        task({ id: 'b', status: 'VERIFYING' }),
        task({ id: 'c', status: 'DONE' }),
      ],
    });
    const view = await new BrainDashboardService(input).get('u1');
    expect(view.brainStatus).toBe('WORKING');
    expect(view.activeTasks).toBe(2);
    expect(view.recentTasks).toHaveLength(3);
    expect(view.recentTasks[0]?.id).toBe('c'); // reversed: newest last → first
  });

  it('reports AWAITING_APPROVAL when approvals are pending (highest priority)', async () => {
    const { input, brain } = createInput();
    brain.listTasks.mockReturnValue({
      data: [
        task({ id: 'a', status: 'RUNNING', approvalRequired: ['deploy'] }),
        task({ id: 'b', status: 'DONE', approvalRequired: [] }),
      ],
    });
    const view = await new BrainDashboardService(input).get('u1');
    expect(view.brainStatus).toBe('AWAITING_APPROVAL');
    expect(view.pendingApprovals).toEqual([
      { taskId: 'a', objective: 'objective', actions: ['deploy'] },
    ]);
  });

  it('limits pending approvals to 10', async () => {
    const { input, brain } = createInput();
    brain.listTasks.mockReturnValue({
      data: Array.from({ length: 12 }, (_, i) =>
        task({ id: `t${i}`, approvalRequired: [`action-${i}`] }),
      ),
    });
    const view = await new BrainDashboardService(input).get('u1');
    expect(view.pendingApprovals).toHaveLength(10);
  });

  it('surfaces NEW/RECOMMENDED opportunities and intelligence events only', async () => {
    const { input, brain } = createInput();
    brain.listOpportunities.mockReturnValue({
      data: [
        { id: 'o1', category: 'AUTOMATION', title: 'op', uncertainty: 0.3, status: 'NEW' },
        { id: 'o2', category: 'REVENUE', title: 'old', uncertainty: 0.2, status: 'DISMISSED' },
      ],
    });
    brain.listIntelligenceEvents.mockReturnValue({
      data: [
        {
          id: 'e1',
          kind: 'NEW_MODEL',
          title: 'ev',
          security: 'TRUSTED',
          relevance: 0.9,
          status: 'RECOMMENDED',
        },
        {
          id: 'e2',
          kind: 'NEW_MODEL',
          title: 'read',
          security: 'TRUSTED',
          relevance: 0.5,
          status: 'READ',
        },
      ],
    });
    const view = await new BrainDashboardService(input).get('u1');
    expect(view.opportunities).toHaveLength(1);
    expect(view.opportunities[0]?.id).toBe('o1');
    expect(view.intelligenceEvents).toHaveLength(1);
    expect(view.intelligenceEvents[0]?.id).toBe('e1');
  });

  it('maps provider health and usage from the experience service, slicing to 12', async () => {
    const { input, providerExperience } = createInput();
    providerExperience.getOverview.mockResolvedValue({
      success: true,
      data: {
        providers: Array.from({ length: 15 }, (_, i) => ({
          providerId: `p${i}`,
          name: `P${i}`,
          availability: 'AVAILABLE',
          health: { status: 'healthy', quotaUsedPercent: 10 },
        })),
        usage: { tokensUsed: 100, tokenBudget: 1000, costUsd: 0.5, aiCalls: 4, freePercent: 50 },
      },
    });
    const view = await new BrainDashboardService(input).get('u1');
    expect(view.providerHealth).toHaveLength(12);
    expect(view.usage).toMatchObject({ tokensUsed: 100, tokenBudget: 1000, freePercent: 50 });
  });

  it('degrades to honest zeros when the experience read fails', async () => {
    const { input, providerExperience } = createInput();
    providerExperience.getOverview.mockResolvedValue({ success: false, error: 'down' });
    const view = await new BrainDashboardService(input).get('u1');
    expect(view.providerHealth).toEqual([]);
    expect(view.usage).toEqual({
      tokensUsed: 0,
      tokenBudget: 0,
      costUsd: 0,
      aiCalls: 0,
      freePercent: 0,
    });
  });

  it('aggregates adaptive scores per capability and sorts quality-first', async () => {
    const { input, brain } = createInput();
    brain.providerScores.mockImplementation((capability: string) => ({
      data: [
        { providerId: 'low', capability, qualityScore: 0.4, sampleCount: 1 },
        { providerId: 'high', capability, qualityScore: 0.9, sampleCount: 5 },
      ],
    }));
    const view = await new BrainDashboardService(input).get('u1');
    expect(view.adaptiveScores[0]?.providerId).toBe('high');
    expect(view.adaptiveScores.length).toBeGreaterThanOrEqual(2);
    for (const capability of ['CODING', 'REASONING', 'RESEARCH', 'TEXT_GENERATION', 'RAG']) {
      expect(brain.providerScores).toHaveBeenCalledWith(capability);
    }
  });

  it('separates learning entries from user corrections and renders signals', async () => {
    const { input, outcomeMemory: memory } = createInput();
    memory.list.mockReturnValue([
      outcomeMemory({ taskId: 'learn-1', corrections: undefined }),
      outcomeMemory({
        taskId: 'corrected',
        corrections: [
          {
            id: 'c1',
            statement: 'I prefer X',
            target: 'provider-preference',
            providerId: 'p1',
            confidence: 0.99,
            capturedAt: NOW,
          },
        ],
      }),
    ]);
    const view = await new BrainDashboardService(input).get('u1');
    expect(view.learning.map((l) => l.taskId)).toEqual(['learn-1']); // corrected one excluded
    expect(view.learning[0]?.verdict).toBe('VERIFIED');
    expect(view.learning[0]?.verificationPassed).toBe(true);
    expect(view.learning[0]?.signals[0]?.kind).toBe('FACT');
    expect(view.corrections).toHaveLength(1);
    expect(view.corrections[0]?.statement).toBe('I prefer X');
    expect(view.corrections[0]?.providerId).toBe('p1');
  });

  it('renders the scheduler section when the scheduler is wired', async () => {
    const { input, aiWorldScheduler } = createInput();
    const view = await new BrainDashboardService(input).get('u1');
    expect(view.scheduler.nextDiscoveryAt).toBe(NOW);
    expect(view.scheduler.meaningfulUpdates).toBe(3);
    expect(view.scheduler.enabledJobs).toBe(2);
    expect(aiWorldScheduler.getStatus).toHaveBeenCalledWith('u1');
  });

  it('defaults the scheduler section when no scheduler is wired', async () => {
    const { input } = createInput({ aiWorldScheduler: undefined });
    const view = await new BrainDashboardService(input).get('u1');
    expect(view.scheduler).toEqual({ meaningfulUpdates: 0, enabledJobs: 0 });
  });
});

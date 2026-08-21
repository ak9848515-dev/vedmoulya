import { describe, it, expect, vi } from 'vitest';
import { ProactiveIntelligenceService } from '../application/ProactiveIntelligenceService.js';
import { InMemoryProactiveStore } from '../infrastructure/InMemoryProactiveStore.js';
import type { ProactiveBrainPort, ProactiveCapabilityPort } from '../contracts/proactive-ports.js';
import type { BrainOpportunityLike, BrainTaskLike } from '../contracts/proactive-shared.js';

function fakeBrain(overrides: Partial<ProactiveBrainPort> = {}): ProactiveBrainPort {
  return {
    dailyPriorities: vi.fn((_u, _l) => ({
      success: true,
      data: [{ id: 'p1', title: 'Ship the report', urgency: 'high', reason: 'due today' }],
    })),
    listOpportunities: vi.fn((_u) => ({
      success: true,
      data: [
        {
          id: 'o1',
          userId: 'u1',
          category: 'earning',
          title: 'Freelance video editing',
          description: 'Demand for short-form video editing.',
          evidence: ['Market signal: demand rising'],
          uncertainty: 0.3,
          status: 'NEW',
          createdAt: '2026-08-01T00:00:00.000Z',
        } satisfies BrainOpportunityLike,
        {
          id: 'o2',
          userId: 'u1',
          category: 'automation',
          title: 'Automate report prep',
          description: 'Weekly reporting repeats.',
          evidence: ['Task history shows repetition'],
          uncertainty: 0.5,
          status: 'NEW',
          createdAt: '2026-08-01T00:00:00.000Z',
        } satisfies BrainOpportunityLike,
      ],
    })),
    listTasks: vi.fn((_u) => ({
      success: true,
      data: [
        {
          id: 't1',
          userId: 'u1',
          objective: 'Prepare the monthly sales report',
          status: 'COMPLETED',
          stage: 'RESULT',
          createdAt: '2026-07-01T00:00:00.000Z',
        },
        {
          id: 't2',
          userId: 'u1',
          objective: 'Prepare the monthly sales report',
          status: 'COMPLETED',
          stage: 'RESULT',
          createdAt: '2026-08-01T00:00:00.000Z',
        },
      ] satisfies BrainTaskLike[],
    })),
    listIntelligenceEvents: vi.fn((_u) => ({ success: true, data: [] })),
    listOutcomeMemory: vi.fn((_u) => ({
      success: true,
      data: [{ id: 'm1', userId: 'u1', verdict: 'SUCCESS', createdAt: '2026-08-01T00:00:00.000Z' }],
    })),
    discoverIntelligence: vi.fn(async (_u) => ({ success: true, data: {} })),
    ...overrides,
  };
}

const fakeCapability: ProactiveCapabilityPort = {
  availableCapabilities: vi.fn((_u) => ({ success: true, data: ['TEXT_GENERATION', 'VIDEO'] })),
  assessAutomation: vi.fn((_c, irreversible) => ({
    automation: irreversible ? 'HUMAN_APPROVAL' : 'FULLY_AUTOMATED',
    reasons: ['advisory'],
  })),
};

function service(
  overrides: { brain?: ProactiveBrainPort; capability?: ProactiveCapabilityPort } = {},
) {
  return new ProactiveIntelligenceService({
    brain: overrides.brain ?? fakeBrain(),
    capability: overrides.capability ?? fakeCapability,
    store: new InMemoryProactiveStore(),
    now: () => '2026-08-13T00:00:00.000Z',
  });
}

describe('ProactiveIntelligenceService', () => {
  it('refresh with runDiscovery:false skips the discovery ride (SPRINT-030 cadence)', async () => {
    const brain = fakeBrain();
    const s = service({ brain });
    const discover = brain.discoverIntelligence as ReturnType<typeof vi.fn>;
    discover.mockClear();
    const result = await s.refresh('u1', { runDiscovery: false });
    expect(result.success).toBe(true);
    expect(discover).not.toHaveBeenCalled();
    // Default (and legacy signature) still rides discovery.
    await s.refresh('u1');
    expect(discover).toHaveBeenCalledTimes(1);
  });

  it('refreshes recommendations from the existing Brain pipeline (composition)', async () => {
    const s = service();
    const result = await s.refresh('u1');
    expect(result.success).toBe(true);
    const recs = result.data!;
    expect(recs.length).toBeGreaterThan(0);
    const categories = recs.map((r) => r.category);
    expect(categories).toContain('REVENUE_OPPORTUNITY');
    expect(categories).toContain('AUTOMATION');
    expect(categories).toContain('TASK');
  });

  it('is idempotent — a second refresh produces no duplicates', async () => {
    const s = service();
    await s.refresh('u1');
    const first = s.list('u1').data!.length;
    await s.refresh('u1');
    const second = s.list('u1').data!.length;
    expect(second).toBe(first);
  });

  it('keeps recommendations owner-scoped (isolation)', async () => {
    const s = service();
    await s.refresh('u1');
    const foreign = s.list('u2');
    expect(foreign.success).toBe(true);
    expect(foreign.data!).toEqual([]);
  });

  it('every recommendation carries evidence (never fabricated)', async () => {
    const s = service();
    await s.refresh('u1');
    for (const rec of s.list('u1').data!) {
      expect(rec.evidence.length).toBeGreaterThan(0);
      expect(rec.confidence).toBeGreaterThanOrEqual(0);
      expect(rec.confidence).toBeLessThanOrEqual(1);
      expect(rec.ownerId).toBe('u1');
    }
  });

  it('dismiss marks a recommendation DISMISSED and honors the choice', async () => {
    const s = service();
    await s.refresh('u1');
    const target = s.list('u1').data![0]!;
    const dismissed = s.dismiss('u1', target.id);
    expect(dismissed.success).toBe(true);
    expect(dismissed.data!.status).toBe('DISMISSED');
    // A re-refresh skips dismissed opportunities (they stay dismissed).
    await s.refresh('u1');
    expect(s.list('u1').data!.filter((r) => r.id === target.id)[0]?.status).toBe('DISMISSED');
  });

  it('accept is refused for authorization-required recommendations (no self-authorization)', async () => {
    const brain = fakeBrain({
      listOpportunities: vi.fn((_u) => ({
        success: true,
        data: [
          {
            id: 'o1',
            userId: 'u1',
            category: 'automation',
            title: 'Publish the weekly newsletter',
            description: 'Publishing action.',
            evidence: ['repeated'],
            uncertainty: 0.2,
            status: 'NEW',
            createdAt: '2026-08-01T00:00:00.000Z',
          } satisfies BrainOpportunityLike,
        ],
      })),
    });
    const s = service({ brain });
    await s.refresh('u1');
    const target = s.list('u1').data!.find((r) => r.category === 'AUTOMATION')!;
    const accepted = s.accept('u1', target.id);
    expect(accepted.success).toBe(false);
    expect(accepted.code).toBe('APPROVAL_REQUIRED');
  });

  it('accept works for non-sensitive recommendations', async () => {
    const s = service();
    await s.refresh('u1');
    const target = s.list('u1').data!.find((r) => r.category === 'TASK')!;
    const accepted = s.accept('u1', target.id);
    expect(accepted.success).toBe(true);
    expect(accepted.data!.status).toBe('ACCEPTED');
  });

  it('a foreign owner cannot dismiss another owner recommendation (IDOR structural)', async () => {
    const s = service();
    await s.refresh('u1');
    const target = s.list('u1').data![0]!;
    const result = s.dismiss('u2', target.id);
    expect(result.success).toBe(false);
    expect(result.code).toBe('NOT_FOUND');
  });

  it('returns an honest BRAIN_UNAVAILABLE when the Brain surface fails', async () => {
    const brain = fakeBrain({
      listTasks: vi.fn((_u) => ({ success: false, error: 'down', code: 'X' })),
    });
    const s = service({ brain });
    const result = await s.refresh('u1');
    expect(result.success).toBe(false);
    expect(result.code).toBe('BRAIN_UNAVAILABLE');
  });

  it('builds a no-spam briefing', async () => {
    const s = service();
    const briefing = s.briefing('u1');
    expect(briefing.success).toBe(true);
    expect(briefing.data!.hasContent).toBe(true);
    expect(briefing.data!.priorities).toContain('Ship the report');
  });

  it('assesses a business opportunity but never executes anything', async () => {
    const s = service();
    const assessment = s.assessBusiness('u1', {
      title: 'YouTube automation service',
      description: 'Produce content for clients.',
      requiredCapabilities: ['VIDEO', 'AVATAR'],
    });
    expect(assessment.success).toBe(true);
    expect(assessment.data!.authorizationRequired).toBe(true);
    expect(assessment.data!.status).toBe('RESEARCHED');
    // No execution side effect: discoverIntelligence was never called here.
    const brain = s['brain'];
    expect(brain.discoverIntelligence).not.toHaveBeenCalled();
  });

  it('maps all opportunity categories to recommendation categories', async () => {
    const brain = fakeBrain({
      listOpportunities: vi.fn((_u) => ({
        success: true,
        data: [
          {
            id: 'c1',
            userId: 'u1',
            category: 'cost_saving',
            title: 'Cut API spend',
            description: 'd',
            evidence: ['e'],
            uncertainty: 0.2,
            status: 'NEW',
            createdAt: '2026-08-01T00:00:00.000Z',
          },
          {
            id: 'c2',
            userId: 'u1',
            category: 'productivity',
            title: 'Speed up review',
            description: 'd',
            evidence: ['e'],
            uncertainty: 0.2,
            status: 'NEW',
            createdAt: '2026-08-01T00:00:00.000Z',
          },
          {
            id: 'c3',
            userId: 'u1',
            category: 'career',
            title: 'Learn a new skill',
            description: 'd',
            evidence: ['e'],
            uncertainty: 0.2,
            status: 'NEW',
            createdAt: '2026-08-01T00:00:00.000Z',
          },
          {
            id: 'c4',
            userId: 'u1',
            category: 'freelance',
            title: 'Freelance work',
            description: 'd',
            evidence: ['e'],
            uncertainty: 0.2,
            status: 'NEW',
            createdAt: '2026-08-01T00:00:00.000Z',
          },
          {
            id: 'c5',
            userId: 'u1',
            category: 'business',
            title: 'New business',
            description: 'd',
            evidence: ['e'],
            uncertainty: 0.2,
            status: 'NEW',
            createdAt: '2026-08-01T00:00:00.000Z',
          },
          {
            id: 'c6',
            userId: 'u1',
            category: 'mystery',
            title: 'Unknown category',
            description: 'd',
            evidence: ['e'],
            uncertainty: 0.2,
            status: 'NEW',
            createdAt: '2026-08-01T00:00:00.000Z',
          },
        ],
      })),
    });
    const s = service({ brain });
    await s.refresh('u1');
    const cats = s.list('u1').data!.map((r) => r.category);
    expect(cats).toContain('COST_SAVING');
    expect(cats).toContain('TIME_SAVING');
    expect(cats).toContain('LEARNING_OPPORTUNITY');
    expect(cats).toContain('REVENUE_OPPORTUNITY');
    expect(cats).toContain('BUSINESS_OPPORTUNITY');
    expect(cats).toContain('OPPORTUNITY');
  });

  it('carries the evidence-backed estimated value when present', async () => {
    const brain = fakeBrain({
      listOpportunities: vi.fn((_u) => ({
        success: true,
        data: [
          {
            id: 'v1',
            userId: 'u1',
            category: 'earning',
            title: 'Paid gig',
            description: 'd',
            evidence: ['e'],
            uncertainty: 0.1,
            estimatedValue: { label: '~$500/mo', status: 'ESTIMATED' },
            status: 'NEW',
            createdAt: '2026-08-01T00:00:00.000Z',
          },
        ],
      })),
    });
    const s = service({ brain });
    await s.refresh('u1');
    const rec = s.list('u1').data!.find((r) => r.title === 'Paid gig')!;
    expect(rec.expectedValue?.label).toBe('~$500/mo');
    expect(rec.expectedValue?.status).toBe('ESTIMATED');
  });

  it('marks a sensitive-title opportunity as authorization-required (title → class C)', async () => {
    const brain = fakeBrain({
      listOpportunities: vi.fn((_u) => ({
        success: true,
        data: [
          {
            id: 's1',
            userId: 'u1',
            category: 'business',
            title: 'Publish the company launch announcement',
            description: 'd',
            evidence: ['e'],
            uncertainty: 0.2,
            status: 'NEW',
            createdAt: '2026-08-01T00:00:00.000Z',
          },
        ],
      })),
    });
    const s = service({ brain });
    await s.refresh('u1');
    const rec = s.list('u1').data![0]!;
    expect(rec.authorizationRequired).toBe(true);
    expect(rec.riskLevel).toBe('HIGH');
  });

  it('produces an empty list (not an error) when there are no signals', async () => {
    const brain = fakeBrain({
      listOpportunities: vi.fn((_u) => ({ success: true, data: [] })),
      listTasks: vi.fn((_u) => ({ success: true, data: [] })),
      dailyPriorities: vi.fn((_u) => ({ success: true, data: [] })),
      listOutcomeMemory: vi.fn((_u) => ({ success: true, data: [] })),
    });
    const s = service({ brain });
    const result = await s.refresh('u1');
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
    // The briefing is no-spam too.
    const briefing = s.briefing('u1');
    expect(briefing.data!.hasContent).toBe(false);
  });

  it('dismiss and accept refuse a foreign owner (IDOR)', async () => {
    const s = service();
    await s.refresh('u1');
    const target = s.list('u1').data![0]!;
    expect(s.dismiss('u2', target.id).code).toBe('NOT_FOUND');
    expect(s.accept('u2', target.id).code).toBe('NOT_FOUND');
  });

  it('produces a LEARNING_OPPORTUNITY with a taskId-only outcome title', async () => {
    const brain = fakeBrain({
      listOutcomeMemory: vi.fn((_u) => ({
        success: true,
        data: [
          {
            id: 'm2',
            userId: 'u1',
            taskId: 't-7',
            verdict: 'SUCCESS',
            createdAt: '2026-08-01T00:00:00.000Z',
          },
        ],
      })),
    });
    const s = service({ brain });
    await s.refresh('u1');
    const learning = s.list('u1').data!.find((r) => r.category === 'LEARNING_OPPORTUNITY');
    expect(learning?.title).toMatch(/t-7/);
  });

  it('falls back to a past-task label when the outcome has no objective or taskId', async () => {
    const brain = fakeBrain({
      listOutcomeMemory: vi.fn((_u) => ({
        success: true,
        data: [
          { id: 'm3', userId: 'u1', verdict: 'SUCCESS', createdAt: '2026-08-01T00:00:00.000Z' },
        ],
      })),
    });
    const s = service({ brain });
    await s.refresh('u1');
    const learning = s.list('u1').data!.find((r) => r.category === 'LEARNING_OPPORTUNITY');
    expect(learning?.title).toMatch(/a past task/);
  });

  it('ignores non-SUCCESS outcomes (no learning recommendation from a failure)', async () => {
    const brain = fakeBrain({
      listOutcomeMemory: vi.fn((_u) => ({
        success: true,
        data: [
          { id: 'm4', userId: 'u1', verdict: 'FAILED', createdAt: '2026-08-01T00:00:00.000Z' },
        ],
      })),
    });
    const s = service({ brain });
    await s.refresh('u1');
    expect(s.list('u1').data!.some((r) => r.category === 'LEARNING_OPPORTUNITY')).toBe(false);
  });

  it('maps priority urgency labels deterministically', async () => {
    const brain = fakeBrain({
      dailyPriorities: vi.fn((_u, _l) => ({
        success: true,
        data: [
          { id: 'p1', title: 'A', urgency: 'medium', reason: 'r' },
          { id: 'p2', title: 'B', urgency: 'low', reason: 'r' },
          { id: 'p3', title: 'C', urgency: 'something-else', reason: 'r' },
        ],
      })),
    });
    const s = service({ brain });
    await s.refresh('u1');
    const byTitle = new Map(s.list('u1').data!.map((r) => [r.title, r]));
    expect(byTitle.get('A')?.urgency).toBe('MEDIUM');
    expect(byTitle.get('B')?.urgency).toBe('LOW');
    expect(byTitle.get('C')?.urgency).toBe('UNKNOWN');
  });

  it('carries a VERIFIED expected value when the Brain says VERIFIED', async () => {
    const brain = fakeBrain({
      listOpportunities: vi.fn((_u) => ({
        success: true,
        data: [
          {
            id: 'v2',
            userId: 'u1',
            category: 'earning',
            title: 'Verified gig',
            description: 'd',
            evidence: ['e'],
            uncertainty: 0.1,
            estimatedValue: { label: '~$300', status: 'VERIFIED' },
            status: 'NEW',
            createdAt: '2026-08-01T00:00:00.000Z',
          },
        ],
      })),
    });
    const s = service({ brain });
    await s.refresh('u1');
    const rec = s.list('u1').data!.find((r) => r.title === 'Verified gig')!;
    expect(rec.expectedValue?.status).toBe('VERIFIED');
  });

  it('bounds the store per owner', async () => {
    const s = service();
    // Many distinct opportunities → still bounded after refresh.
    const many = Array.from({ length: 150 }, (_, i) => ({
      id: `o${i}`,
      userId: 'u1',
      category: 'earning' as const,
      title: `Opportunity ${i}`,
      description: `d${i}`,
      evidence: [`e${i}`],
      uncertainty: 0.9,
      status: 'NEW' as const,
      createdAt: '2026-08-01T00:00:00.000Z',
    })) satisfies BrainOpportunityLike[];
    const brain = fakeBrain({
      listOpportunities: vi.fn((_u) => ({ success: true, data: many })),
    });
    const bounded = service({ brain });
    await bounded.refresh('u1');
    expect(bounded.list('u1').data!.length).toBeLessThanOrEqual(100);
  });
});

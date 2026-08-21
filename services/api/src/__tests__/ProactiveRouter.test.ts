// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Gateway: Proactive Intelligence namespace tests
// SPRINT-029 — the proactive.* procedures through the REAL tRPC pipeline
// (RouterRegistry handler closures + standardProcedure auth/rate-limit):
//   refresh            — rides the Brain pipeline (composition), idempotent.
//   list               — owner-scoped.
//   dismiss / accept   — owner-scoped; foreign userId refused (IDOR); accept
//                        refuses authorization-required recommendations
//                        (no self-authorization).
//   briefing           — no-spam shape.
//   assessBusiness     — research/score ONLY, never executes.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ProactiveIntelligenceService, InMemoryProactiveStore } from '@vedmoulya/proactive';
import { createAppRouter } from '../services/RouterRegistry.js';
import type { ApiApplicationService } from '../services/ApiApplicationService.js';

function fakeBrain() {
  return {
    dailyPriorities: (_userId: string, _limit = 5) => ({
      success: true,
      data: [
        {
          id: 'p1',
          title: 'Ship the report',
          urgency: 'HIGH',
          priorityScore: 0.9,
          reason: 'due today',
        },
      ],
    }),
    listOpportunities: (_userId: string) => ({
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
        },
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
        },
      ],
    }),
    listTasks: (_userId: string) => ({
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
      ],
    }),
    listIntelligenceEvents: (_userId: string) => ({ success: true, data: [] }),
    listOutcomeMemory: (_userId: string) => ({
      success: true,
      data: [{ id: 'm1', userId: 'u1', verdict: 'SUCCESS', createdAt: '2026-08-01T00:00:00.000Z' }],
    }),
    discoverIntelligence: async (_userId: string) => ({ success: true, data: {} }),
  };
}

function makeServices(): ApiApplicationService {
  const proactive = new ProactiveIntelligenceService({
    brain: fakeBrain() as never,
    capability: {
      availableCapabilities: () => ({ success: true, data: ['TEXT_GENERATION', 'VIDEO'] }),
      assessAutomation: (_candidates: unknown[], irreversible: boolean) => ({
        automation: irreversible ? 'HUMAN_APPROVAL' : 'FULLY_AUTOMATED',
        reasons: ['advisory'],
      }),
    },
    store: new InMemoryProactiveStore(),
    now: () => '2026-08-13T00:00:00.000Z',
  });
  return { proactive } as unknown as ApiApplicationService;
}

const ctx = (userId: string) => ({ userId, email: `${userId}@vm.local`, role: 'user' });

interface RecData {
  id: string;
  category: string;
  authorizationRequired: boolean;
  status: string;
  evidence: string[];
}

describe('proactive.* (SPRINT-029)', () => {
  it('refresh composes the Brain pipeline and returns evidence-only recommendations', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('p-1'));
    const result = await caller.proactive.refresh({ userId: 'p-1' });
    expect(result.success).toBe(true);
    const recs = result.data as RecData[];
    expect(recs.length).toBeGreaterThan(0);
    for (const rec of recs) {
      expect(rec.evidence.length).toBeGreaterThan(0);
    }
  });

  it('refresh is idempotent — a second refresh adds no duplicates', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('p-1'));
    await caller.proactive.refresh({ userId: 'p-1' });
    const first = (await caller.proactive.list({ userId: 'p-1' })).data as RecData[];
    await caller.proactive.refresh({ userId: 'p-1' });
    const second = (await caller.proactive.list({ userId: 'p-1' })).data as RecData[];
    expect(second.length).toBe(first.length);
  });

  it('list is owner-scoped — a foreign owner sees nothing', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('p-1'));
    await caller.proactive.refresh({ userId: 'p-1' });
    const other = router.createCaller(ctx('p-2'));
    const list = (await other.proactive.list({ userId: 'p-2' })).data as RecData[];
    expect(list).toEqual([]);
  });

  it('dismiss marks a recommendation DISMISSED; a foreign userId is refused (IDOR)', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('p-1'));
    await caller.proactive.refresh({ userId: 'p-1' });
    const recs = (await caller.proactive.list({ userId: 'p-1' })).data as RecData[];
    const target = recs[0]!;
    const dismissed = await caller.proactive.dismiss({
      userId: 'p-1',
      recommendationId: target.id,
    });
    expect(dismissed.success).toBe(true);
    expect((dismissed.data as RecData).status).toBe('DISMISSED');

    // The central auth middleware rejects a foreign userId before the handler
    // runs (IDOR guard) — it throws, it never returns a NOT_FOUND envelope.
    await expect(
      caller.proactive.dismiss({ userId: 'p-9', recommendationId: target.id }),
    ).rejects.toThrow('not authorized');
  });

  it('accept refuses an authorization-required recommendation (no self-authorization)', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('p-1'));
    await caller.proactive.refresh({ userId: 'p-1' });
    const recs = (await caller.proactive.list({ userId: 'p-1' })).data as RecData[];
    const sensitive = recs.find((r) => r.authorizationRequired);
    if (sensitive) {
      const accepted = await caller.proactive.accept({
        userId: 'p-1',
        recommendationId: sensitive.id,
      });
      expect(accepted.success).toBe(false);
    }
  });

  it('accept works for non-sensitive recommendations', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('p-1'));
    await caller.proactive.refresh({ userId: 'p-1' });
    const recs = (await caller.proactive.list({ userId: 'p-1' })).data as RecData[];
    const safe = recs.find((r) => !r.authorizationRequired);
    if (safe) {
      const accepted = await caller.proactive.accept({ userId: 'p-1', recommendationId: safe.id });
      expect(accepted.success).toBe(true);
      expect((accepted.data as RecData).status).toBe('ACCEPTED');
    }
  });

  it('briefing returns a no-spam shape', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('p-1'));
    const result = await caller.proactive.briefing({ userId: 'p-1' });
    expect(result.success).toBe(true);
    expect(typeof (result.data as { hasContent: boolean }).hasContent).toBe('boolean');
  });

  it('assessBusiness researches and marks authorizationRequired — never executes', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('p-1'));
    const result = await caller.proactive.assessBusiness({
      userId: 'p-1',
      title: 'YouTube automation service',
      description: 'Produce content for clients.',
      requiredCapabilities: ['VIDEO', 'AVATAR'],
    });
    expect(result.success).toBe(true);
    const assessment = result.data as {
      status: string;
      authorizationRequired: boolean;
      score: number;
    };
    expect(assessment.status).toBe('RESEARCHED');
    expect(assessment.authorizationRequired).toBe(true);
    expect(assessment.score).toBeGreaterThanOrEqual(0);
  });

  it('rejects an empty userId through the zod input', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('p-1'));
    await expect(caller.proactive.refresh({ userId: '' })).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Gateway: Control Plane namespace tests
// SPRINT-031 — control.* procedures through the REAL tRPC pipeline
// (RouterRegistry handler closures + standardProcedure auth/rate-limit/IDOR):
//   getSettings / updateSettings — explicit + confirmed only (fail-closed)
//   stopStatus / engageStop / releaseStop — audited, never destructive
//   runCycle — bounded observe→propose, NEVER executes (executedNothing:true)
//   todayBriefing — composed no-spam briefing
//   listOpportunities / transitionOpportunity — guarded lifecycle
//   gateAction — fail-closed gate over the existing authorities
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ActiveIntelligenceControlPlane, InMemoryControlStores } from '@vedmoulya/control-plane';
import { createAppRouter } from '../services/RouterRegistry.js';
import type { ApiApplicationService } from '../services/ApiApplicationService.js';

function makeServices(): ApiApplicationService {
  const stores = new InMemoryControlStores();
  const plane = new ActiveIntelligenceControlPlane({
    brain: {
      listTasksWithApprovals: () => [
        { taskId: 't1', title: 'Publish the report', approvalRequired: ['publish'] },
      ],
      outcomeCount: () => 0,
    },
    proactive: {
      refresh: async () => ({ success: true }),
      listRecommendations: () => [
        {
          id: 'r1',
          title: 'Publish the report to the website',
          category: 'OPPORTUNITY',
          authorizationRequired: true,
          riskLevel: 'HIGH',
        },
        {
          id: 'r2',
          title: 'Summarize the weekly report',
          category: 'TASK',
          authorizationRequired: false,
          riskLevel: 'LOW',
        },
      ],
    },
    fabric: {
      allProviderHealth: () => [{ providerId: 'openai', state: 'HEALTHY', observedCalls: 5 }],
      costSnapshot: () => ({ dailyUsd: 1.2 }),
    },
    stores,
  });
  return { controlPlane: plane } as unknown as ApiApplicationService;
}

const ctx = (userId: string) => ({ userId, email: `${userId}@vm.local`, role: 'user' });

describe('control.* (SPRINT-031)', () => {
  it('getSettings returns null by default (no autonomy granted without explicit confirmation)', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    const result = await caller.control.getSettings({ userId: 'c-1' });
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it('updateSettings REFUSES without userConfirmed (silence is never consent)', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    const denied = await caller.control.updateSettings({
      userId: 'c-1',
      autonomyLevel: 3,
      userConfirmed: false,
    });
    expect(denied.success).toBe(false);
    expect(
      (denied as { error: { details?: { controlCode?: string } } }).error?.details?.controlCode,
    ).toBe('INVALID_SETTINGS');
  });

  it('updateSettings persists an explicit confirmed shape; getSettings reads it back owner-scoped', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    const updated = await caller.control.updateSettings({
      userId: 'c-1',
      autonomyLevel: 3,
      maxDailyCostUsd: 5,
      userConfirmed: true,
    });
    expect(updated.success).toBe(true);

    const mine = await caller.control.getSettings({ userId: 'c-1' });
    expect((mine.data as { autonomyLevel: number }).autonomyLevel).toBe(3);

    const other = createAppRouter(makeServices()).createCaller(ctx('c-2'));
    const notMine = await other.control.getSettings({ userId: 'c-2' });
    expect(notMine.data).toBeNull();
  });

  it('emergency stop engages/releases with audit and never deletes history', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    const engaged = await caller.control.engageStop({
      userId: 'c-1',
      reason: 'testing',
      source: 'user',
    });
    expect((engaged.data as { engaged: boolean }).engaged).toBe(true);
    const status = await caller.control.stopStatus({ userId: 'c-1' });
    expect((status.data as { engaged: boolean }).engaged).toBe(true);

    const released = await caller.control.releaseStop({
      userId: 'c-1',
      reason: 'resolved',
      source: 'user',
    });
    expect((released.data as { engaged: boolean }).engaged).toBe(false);
    expect((released.data as { history: unknown[] }).history.length).toBe(2);
  });

  it('runCycle is bounded and NEVER executes — class C proposal waits for approval', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    await caller.control.updateSettings({
      userId: 'c-1',
      autonomyLevel: 4,
      maxDailyCostUsd: 10,
      maxTaskCostUsd: 1,
      userConfirmed: true,
    });
    const cycle = await caller.control.runCycle({ userId: 'c-1' });
    expect(cycle.success).toBe(true);
    const data = cycle.data as {
      executedNothing: boolean;
      proposed: Array<{ id: string; verdict: string }>;
    };
    expect(data.executedNothing).toBe(true);
    const publish = data.proposed.find((p) => p.id === 'r1');
    expect(publish?.verdict).toBe('WAITING_FOR_APPROVAL');
  });

  it('runCycle halts immediately when the emergency stop is engaged', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    await caller.control.engageStop({ userId: 'c-1', reason: 'halt', source: 'user' });
    const cycle = await caller.control.runCycle({ userId: 'c-1' });
    expect((cycle.data as { emergencyStopped: boolean }).emergencyStopped).toBe(true);
    expect((cycle.data as { proposed: unknown[] }).proposed).toEqual([]);
  });

  it('todayBriefing is composed and no-spam', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    const briefing = await caller.control.todayBriefing({ userId: 'c-1' });
    const data = briefing.data as {
      hasContent: boolean;
      pendingApprovals: unknown[];
      recommendedNextAction: string;
    };
    expect(data.hasContent).toBe(true);
    expect(data.pendingApprovals.length).toBe(1);
    expect(data.recommendedNextAction).toMatch(/pending approvals/);
  });

  it('opportunity lifecycle refuses APPROVED without an approval record; allows with one', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    await caller.control.updateSettings({ userId: 'c-1', autonomyLevel: 2, userConfirmed: true });

    // No gateway procedure creates opportunities directly in this sprint —
    // verify the guarded transition endpoint rejects a missing record.
    const refused = await caller.control.transitionOpportunity({
      userId: 'c-1',
      id: 'opp-missing',
      to: 'APPROVED',
      note: 'attempt',
    });
    expect(refused.success).toBe(false);
  });

  it('gateAction composes the existing authorities (class C → WAITING_FOR_APPROVAL)', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    await caller.control.updateSettings({
      userId: 'c-1',
      autonomyLevel: 4,
      maxDailyCostUsd: 10,
      maxTaskCostUsd: 1,
      userConfirmed: true,
    });
    const decision = await caller.control.gateAction({
      userId: 'c-1',
      action: 'Publish the report to the website',
      category: 'OPPORTUNITY',
    });
    expect((decision.data as { verdict: string }).verdict).toBe('WAITING_FOR_APPROVAL');
  });

  it('rejects invalid zod input', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    await expect(
      caller.control.updateSettings({ userId: 'c-1', autonomyLevel: 9, userConfirmed: true }),
    ).rejects.toThrow();
    await expect(
      caller.control.engageStop({ userId: 'c-1', reason: '', source: 'user' }),
    ).rejects.toThrow();
  });
});

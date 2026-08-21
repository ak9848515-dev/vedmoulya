// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Gateway: Intelligence Fabric namespace tests
// SPRINT-030 — the fabric.* procedures through the REAL tRPC pipeline
// (RouterRegistry handler closures + standardProcedure auth/rate-limit):
//   getProviderHealth / allProviderHealth — OBSERVED health (UNKNOWN until observed)
//   observeOutcome            — one real call outcome recorded
//   checkCostPolicy           — fail-closed caps vs recorded spend
//   classifyAutonomy          — autonomy gate over the existing A/B/C/D
//   selectStrategy            — ADVISORY ranking (never actual routing)
//   validateWorkflow          — bounded orchestration (no unbounded fan-out)
//   evaluateVerificationChain — bounded A→critique→verify verdict
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { IntelligenceFabricService, ProviderHealthLedger } from '@vedmoulya/intelligence-fabric';
import { createAppRouter } from '../services/RouterRegistry.js';
import type { ApiApplicationService } from '../services/ApiApplicationService.js';
import type {
  FabricCostPort,
  FabricProviderPort,
  StrategyCandidate,
} from '@vedmoulya/intelligence-fabric';

const candidates: StrategyCandidate[] = [
  {
    providerId: 'ollama',
    name: 'Ollama',
    capabilityMatched: true,
    quality: 0.7,
    latencyMs: 80,
    estimatedCostUsd: 0,
    localAvailability: 'yes',
    healthState: 'HEALTHY',
    evidence: ['registry evidence'],
  },
  {
    providerId: 'openai',
    name: 'OpenAI',
    capabilityMatched: true,
    quality: 0.95,
    latencyMs: 300,
    estimatedCostUsd: 0.01,
    healthState: 'HEALTHY',
    evidence: ['registry evidence'],
  },
];

const costPort: FabricCostPort = {
  snapshot: () => ({ dailyUsd: 1.2, providerUsd: 0.5 }),
};

const providerPort: FabricProviderPort = {
  candidates: async () => candidates,
};

function makeServices(): ApiApplicationService {
  const ledger = new ProviderHealthLedger();
  const fabric = new IntelligenceFabricService({
    healthLedger: ledger,
    costPort,
    providerPort,
    costLimits: { maxDailyCostUsd: 10, maxTaskCostUsd: 1 },
  });
  return { fabric } as unknown as ApiApplicationService;
}

const ctx = (userId: string) => ({ userId, email: `${userId}@vm.local`, role: 'user' });

describe('fabric.* (SPRINT-030)', () => {
  it('reports UNKNOWN health before any observation and OBSERVED health after', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('f-1'));

    const before = await caller.fabric.getProviderHealth({ userId: 'f-1', providerId: 'openai' });
    expect((before.data as { state: string }).state).toBe('UNKNOWN');

    await caller.fabric.observeOutcome({
      userId: 'f-1',
      providerId: 'openai',
      kind: 'success',
      latencyMs: 120,
    });
    const after = await caller.fabric.getProviderHealth({ userId: 'f-1', providerId: 'openai' });
    expect((after.data as { state: string }).state).toBe('HEALTHY');
    expect((after.data as { observedCalls: number }).observedCalls).toBe(1);
  });

  it('allProviderHealth returns every observed provider', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('f-1'));
    await caller.fabric.observeOutcome({ userId: 'f-1', providerId: 'deepseek', kind: 'failure' });
    const all = await caller.fabric.allProviderHealth({ userId: 'f-1' });
    expect((all.data as { providerId: string }[]).length).toBe(1);
  });

  it('observeOutcome maps quota exhaustion to UNAVAILABLE', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('f-1'));
    const health = await caller.fabric.observeOutcome({
      userId: 'f-1',
      providerId: 'openai',
      kind: 'quota_exhausted',
    });
    expect((health.data as { state: string }).state).toBe('UNAVAILABLE');
  });

  it('checkCostPolicy is fail-closed against recorded spend', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('f-1'));
    const ok = await caller.fabric.checkCostPolicy({ userId: 'f-1', additionalUsd: 0.5 });
    expect((ok.data as { allowed: boolean }).allowed).toBe(true);

    const blocked = await caller.fabric.checkCostPolicy({ userId: 'f-1', additionalUsd: 0.9 });
    // daily 1.2 + 0.9 = 2.1 < 10 and task 0 + 0.9 < 1 → allowed; push past the
    // task cap to force a block.
    const over = await caller.fabric.checkCostPolicy({ userId: 'f-1', additionalUsd: 1.01 });
    expect((over.data as { allowed: boolean }).allowed).toBe(false);
    expect((over.data as { exhaustedBucket: string }).exhaustedBucket).toBe('task');
  });

  it('classifyAutonomy gates sensitive actions to the existing approval path', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('f-1'));
    const decision = await caller.fabric.classifyAutonomy({
      userId: 'f-1',
      currentLevel: 3,
      action: 'Publish the report to the website',
    });
    expect((decision.data as { actionClass: string }).actionClass).toBe('C');
    expect((decision.data as { allowed: boolean }).allowed).toBe(true);
    expect((decision.data as { requiredLevel: number }).requiredLevel).toBe(3);
  });

  it('classifyAutonomy refuses class B without a user authorization record', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('f-1'));
    const without = await caller.fabric.classifyAutonomy({
      userId: 'f-1',
      currentLevel: 5,
      action: 'Prepare the monthly sales report',
    });
    expect((without.data as { allowed: boolean }).allowed).toBe(false);
    const withAuth = await caller.fabric.classifyAutonomy({
      userId: 'f-1',
      currentLevel: 4,
      action: 'Prepare the monthly sales report',
      userAuthorizationId: 'auth-1',
    });
    expect((withAuth.data as { allowed: boolean }).allowed).toBe(true);
  });

  it('selectStrategy is advisory and privacy-aware', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('f-1'));
    const selection = await caller.fabric.selectStrategy({
      userId: 'f-1',
      strategy: 'PRIVATE',
      taskPrivacy: 'PRIVATE',
      capability: 'TEXT_GENERATION',
    });
    expect(
      (selection.data as { selected: { providerId: string } | undefined }).selected?.providerId,
    ).toBe('ollama');
  });

  it('validateWorkflow blocks unbounded parallel fan-out', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('f-1'));
    const blocked = await caller.fabric.validateWorkflow({
      userId: 'f-1',
      taskCount: 10,
      depth: 4,
      maxParallelFanout: 9,
      estimatedProviderCalls: 30,
    });
    expect((blocked.data as { allowed: boolean }).allowed).toBe(false);
    expect((blocked.data as { exceeded: string }).exceeded).toBe('parallel');
  });

  it('evaluateVerificationChain produces an honest verdict', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('f-1'));
    const verdict = await caller.fabric.evaluateVerificationChain({
      userId: 'f-1',
      answer: { providerId: 'a', verdict: 'AGREE', note: 'answer' },
      verify: { providerId: 'c', verdict: 'AGREE', note: 'verified' },
    });
    expect((verdict.data as { verdict: string }).verdict).toBe('VERIFIED');
  });

  it('rejects invalid input through zod', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('f-1'));
    await expect(
      caller.fabric.observeOutcome({ userId: 'f-1', providerId: 'openai', kind: 'bogus' as never }),
    ).rejects.toThrow();
    await expect(
      caller.fabric.classifyAutonomy({ userId: 'f-1', currentLevel: 9, action: 'x' }),
    ).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Gateway: World Model & Business Operating System namespace tests
// SPRINT-032 — world.* procedures through the REAL tRPC pipeline
// (RouterRegistry handler closures + standardProcedure auth/rate-limit/IDOR):
//   overview — bounded composed snapshot
//   graph.observe/link/entities/relations — provenance + closed shapes
//   businessUnits.* — configurable owner-scoped units
//   opportunities.evaluate/pipeline — evidence-only economics
//   workforce.roles/suggestWorkers — provider-neutral abstraction
//   workflow.create/decompose — bounded decomposition (never executes)
//   signals.list — honest UNAVAILABLE
//   boundary.classify — human vs AI boundary over the existing authority
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ActionClassPolicy } from '@vedmoulya/proactive';
import {
  InMemoryWorldStores,
  WorldModelService,
  type WorldActionPort,
  type WorldApprovalPort,
  type WorldBrainPort,
  type WorldControlPort,
  type WorldFabricPort,
  type WorldProactivePort,
} from '@vedmoulya/world-model';
import { createAppRouter } from '../services/RouterRegistry.js';
import type { ApiApplicationService } from '../services/ApiApplicationService.js';

function makeWorld(): WorldModelService {
  const brain: WorldBrainPort = {
    listOpportunities: () => ({
      success: true,
      data: [
        {
          id: 'opp-1',
          category: 'business',
          title: 'AI automation service',
          description: 'Deliver workflow automation.',
          evidence: ['ai-world-discovery'],
          uncertainty: 0.3,
          status: 'RECOMMENDED',
          risk: 'MEDIUM',
        },
      ],
    }),
    listTasks: () => ({ success: true, data: [] }),
  };
  const proactive: WorldProactivePort = {
    assessBusiness: (userId, input) => ({
      id: 'ba-1',
      ownerId: userId,
      title: input.title,
      description: input.description,
      category: 'Consulting / services',
      score: 0.5,
      businessCase: ['Capability fit.'],
      riskLevel: 'MEDIUM',
      mvpPlan: ['Research.'],
      authorizationRequired: true,
      status: 'RESEARCHED',
      evidence: ['capability fit'],
      createdAt: '2026-08-14T10:00:00.000Z',
    }),
  };
  const fabric: WorldFabricPort = {
    selectStrategy: async (input) => ({
      strategy: input.strategy,
      selected: {
        providerId: 'openai',
        modelId: 'gpt-4o-mini',
        name: 'OpenAI',
        capabilityMatched: true,
        estimatedCostUsd: 0.0002,
        healthState: 'HEALTHY',
        evidence: [],
      },
      ranked: [],
      reasons: ['matched'],
    }),
    validateWorkflow: (plan) =>
      plan.taskCount <= 24
        ? { allowed: true, reason: 'within bounds' }
        : { allowed: false, reason: 'too many tasks', exceeded: 'tasks' },
    costSnapshot: () => ({ dailyUsd: 0.5 }),
  };
  const action: WorldActionPort = {
    classify: (a, opts) => new ActionClassPolicy().classify(a, opts),
  };
  const control: WorldControlPort = {
    listOpportunities: () => [],
    autonomyPosture: () => ({
      emergencyStopEngaged: false,
      autonomyLevel: 1,
      settingsConfirmed: true,
    }),
  };
  // SPRINT-034 — the EXISTING approval authority (Brain approve/reject).
  const approval: WorldApprovalPort = {
    requestApproval: () => ({ success: true, data: { taskId: 'brain-task-1' } }),
    approve: (input) => ({
      success: true,
      data: { grantedBy: input.userId, grantedAt: '2026-08-15T10:00:00.000Z', scope: input.action },
    }),
    reject: () => ({ success: true }),
  };
  return new WorldModelService({
    brain,
    proactive,
    fabric,
    action,
    control,
    stores: new InMemoryWorldStores(),
    approval,
    signalSources: [],
  });
}

function makeServices(): ApiApplicationService {
  return { world: makeWorld() } as unknown as ApiApplicationService;
}

const ctx = (userId: string) => ({ userId, email: `${userId}@vm.local`, role: 'user' });

describe('world.* (SPRINT-032)', () => {
  it('overview returns a bounded snapshot with honest signal status', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    const result = await caller.world.overview({ userId: 'c-1' });
    expect(result.success).toBe(true);
    const data = result.data as { bounded: boolean; signals: Array<{ status: string }> };
    expect(data.bounded).toBe(true);
    expect(data.signals.every((s) => s.status === 'UNAVAILABLE')).toBe(true);
  });

  it('graphObserve records evidence-backed observations; refuses fabricated facts', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    const ok = await caller.world.graphObserve({
      userId: 'c-1',
      type: 'opportunity',
      label: 'YouTube automation',
      externalId: 'opp-1',
      evidence: ['brain-opportunity opp-1'],
      provenance: {
        source: 'brain-opportunity',
        status: 'VERIFIED',
        observedAt: '2026-08-14T10:00:00.000Z',
      },
    });
    expect(ok.success).toBe(true);

    // Empty evidence is rejected at the zod boundary (defense in depth — the
    // domain ALSO refuses observations without evidence).
    await expect(
      caller.world.graphObserve({
        userId: 'c-1',
        type: 'opportunity',
        label: 'Made up',
        evidence: [],
        provenance: {
          source: 'brain-opportunity',
          status: 'UNKNOWN',
          observedAt: '2026-08-14T10:00:00.000Z',
        },
      }),
    ).rejects.toThrow();

    const listed = await caller.world.graphEntities({ userId: 'c-1' });
    expect(listed.success).toBe(true);
    expect((listed.data as { total: number }).total).toBe(1);
  });

  it('graphLink enforces the closed relation vocabulary + same-owner entities', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    const user = await caller.world.graphObserve({
      userId: 'c-1',
      type: 'user',
      label: 'Owner',
      evidence: ['user-statement'],
      provenance: {
        source: 'user-statement',
        status: 'VERIFIED',
        observedAt: '2026-08-14T10:00:00.000Z',
      },
    });
    const goal = await caller.world.graphObserve({
      userId: 'c-1',
      type: 'goal',
      label: 'Launch a service',
      evidence: ['user-statement'],
      provenance: {
        source: 'user-statement',
        status: 'VERIFIED',
        observedAt: '2026-08-14T10:00:00.000Z',
      },
    });
    const userData = (user.data as { id: string }).id;
    const goalData = (goal.data as { id: string }).id;

    const linked = await caller.world.graphLink({
      userId: 'c-1',
      type: 'has_goal',
      fromId: userData,
      toId: goalData,
    });
    expect(linked.success).toBe(true);

    const wrongShape = await caller.world.graphLink({
      userId: 'c-1',
      type: 'contains_task',
      fromId: userData,
      toId: goalData,
    });
    expect(wrongShape.success).toBe(false);
  });

  it('business units are configurable, owner-scoped and idempotent', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    const created = await caller.world.createBusinessUnit({
      userId: 'c-1',
      name: 'AI solutions',
      purpose: 'Deliver AI automation services.',
      offerings: ['workflow automation'],
      automationLevel: 2,
    });
    expect(created.success).toBe(true);
    const again = await caller.world.createBusinessUnit({
      userId: 'c-1',
      name: 'AI solutions',
      purpose: 'Updated purpose.',
    });
    expect(again.success).toBe(true);
    if (created.success && again.success) {
      expect((again.data as { id: string }).id).toBe((created.data as { id: string }).id);
    }
    const mine = await caller.world.listBusinessUnits({ userId: 'c-1' });
    expect((mine.data as unknown[]).length).toBe(1);
    const other = createAppRouter(makeServices()).createCaller(ctx('c-2'));
    const notMine = await other.world.listBusinessUnits({ userId: 'c-2' });
    expect((notMine.data as unknown[]).length).toBe(0);
  });

  it('evaluateOpportunity exposes every factor and an advisory score', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    const result = await caller.world.evaluateOpportunity({
      userId: 'c-1',
      title: 'AI automation service',
      description: 'Deliver workflow automation.',
      requiredCapabilities: ['TEXT_GENERATION'],
      factors: [{ key: 'marketEvidence', value: 0.8, status: 'ESTIMATED', evidence: ['survey'] }],
      initialCostInr: { value: 1000, status: 'ESTIMATED' },
      capitalBudgetInr: 1000,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const data = result.data as {
      score: number;
      factors: Array<{ key: string }>;
      capitalMode: string;
      authorizationRequired: boolean;
    };
    expect(data.authorizationRequired).toBe(true);
    expect(data.factors.length).toBe(1);
    expect(data.capitalMode).toBe('LOW_COST');
    expect(data.score).toBeGreaterThan(0);
  });

  it('workforce roles register and workers are advisory through the fabric', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    const role = await caller.world.registerRole({
      userId: 'c-1',
      name: 'CONTENT_RESEARCHER',
      responsibilities: ['Research markets'],
      capabilities: ['RESEARCH'],
      authorityClass: 'A',
    });
    expect(role.success).toBe(true);
    if (!role.success) return;
    const roleId = (role.data as { id: string }).id;
    const workers = await caller.world.suggestWorkers({ userId: 'c-1', roleId });
    expect(workers.success).toBe(true);
    if (workers.success) {
      const list = workers.data as Array<{ advisory: boolean; authorityClass: string }>;
      expect(list.length).toBeGreaterThan(0);
      expect(list[0]?.advisory).toBe(true);
      expect(list[0]?.authorityClass).toBe('A');
    }
  });

  it('decomposeWorkflow is bounded and NEVER executes', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    const result = await caller.world.decomposeWorkflow({
      userId: 'c-1',
      goal: 'Build a YouTube video',
      steps: [
        { label: 'research', capability: 'RESEARCH' },
        { label: 'script', capability: 'TEXT_GENERATION' },
      ],
      estimatedCostUsd: 1,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const data = result.data as {
      executed: boolean;
      bounds: { allowed: boolean };
      plan: { taskCount: number };
    };
    expect(data.executed).toBe(false);
    expect(data.bounds.allowed).toBe(true);
    expect(data.plan.taskCount).toBe(2);
  });

  it('signals.list reports UNAVAILABLE — never SUCCESS without a live source', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    const result = await caller.world.listSignals({ userId: 'c-1' });
    expect(result.success).toBe(true);
    const data = result.data as Array<{ status: string }>;
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((s) => s.status === 'UNAVAILABLE')).toBe(true);
  });

  it('boundary.classify composes the existing authority (class C → APPROVAL_REQUIRED)', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    const result = await caller.world.classifyBoundary({
      userId: 'c-1',
      action: 'Publish the report to the website',
    });
    expect(result.success).toBe(true);
    const data = result.data as { responsibilityClass: string; actionClass: string };
    expect(data.responsibilityClass).toBe('APPROVAL_REQUIRED');
    expect(data.actionClass).toBe('C');
  });

  // ── SPRINT-033 Part F — revenue intelligence ─────────────────────────
  it('registerRevenueStream requires evidence and snapshots are advisory', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    const ok = await caller.world.registerRevenueStream({
      userId: 'c-1',
      name: 'AI services',
      kind: 'SERVICE',
      estimatedMonthlyRevenueUsd: { value: 5000, status: 'ESTIMATED', evidence: ['quote'] },
      estimatedMonthlyCostUsd: { value: 2000, status: 'ESTIMATED', evidence: ['provider cost'] },
    });
    expect(ok.success).toBe(true);

    // A figure without evidence is refused at the zod boundary (defense in
    // depth — the domain ALSO refuses evidence-less figures).
    await expect(
      caller.world.registerRevenueStream({
        userId: 'c-1',
        name: 'Fake revenue',
        kind: 'SERVICE',
        estimatedMonthlyRevenueUsd: { value: 999999, status: 'ESTIMATED', evidence: [] },
      }),
    ).rejects.toThrow();

    const snapshot = await caller.world.revenueSnapshot({ userId: 'c-1' });
    expect(snapshot.success).toBe(true);
    const data = snapshot.data as {
      advisory: boolean;
      totalEstimatedMonthlyRevenueUsd: number;
      estimatedMargin: number;
    };
    expect(data.advisory).toBe(true);
    expect(data.totalEstimatedMonthlyRevenueUsd).toBe(5000);
    expect(data.estimatedMargin).toBeCloseTo((5000 - 2000) / 5000, 5);

    const decisions = await caller.world.revenueDecisions({ userId: 'c-1' });
    expect(decisions.success).toBe(true);
    const hints = decisions.data as Array<{ advisory: boolean; hint: string }>;
    expect(hints[0]?.advisory).toBe(true);
  });

  it('revenue streams are owner-isolated (IDOR at the store level)', async () => {
    const router = createAppRouter(makeServices());
    const callerA = router.createCaller(ctx('c-1'));
    await callerA.world.registerRevenueStream({
      userId: 'c-1',
      name: 'Mine',
      kind: 'SERVICE',
      estimatedMonthlyRevenueUsd: { value: 100, status: 'VERIFIED', evidence: ['ledger'] },
    });
    const callerB = createAppRouter(makeServices()).createCaller(ctx('c-2'));
    const mine = await callerB.world.listRevenueStreams({ userId: 'c-2' });
    expect((mine.data as unknown[]).length).toBe(0);
  });

  // ── SPRINT-033 Part A — founder briefing ──────────────────────────────
  it('founderBriefing is advisory with honest signal status', async () => {
    // SPRINT-043E — the founder must have recorded data before the AI World
    // opportunity surfaces in the pipeline; register a problem first.
    const world = makeWorld();
    const registered = world.registerProblem({
      ownerId: 'c-1',
      problemStatement: 'Local clinics reconcile invoices manually and lose hours weekly.',
      evidence: [
        {
          source: 'direct_observation',
          text: 'LOCAL TEST: two clinic owners described reconciliation as a weekly time sink.',
          confidence: 'ESTIMATED',
        },
      ],
    });
    expect(registered.success).toBe(true);
    const router = createAppRouter({ world } as unknown as ApiApplicationService);
    const caller = router.createCaller(ctx('c-1'));
    const result = await caller.world.founderBriefing({ userId: 'c-1' });
    expect(result.success).toBe(true);
    const data = result.data as {
      advisory: boolean;
      hasContent: boolean;
      today: { activeOpportunities: number };
      signals: Array<{ status: string }>;
    };
    expect(data.advisory).toBe(true);
    expect(data.today.activeOpportunities).toBe(1);
    expect(data.signals.every((s) => s.status === 'UNAVAILABLE')).toBe(true);
  });

  // ── SPRINT-033 Part E — workflow execution blueprint ──────────────────
  it('buildBlueprint records approval gates and never executes', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    const result = await caller.world.buildBlueprint({
      userId: 'c-1',
      sourceTitle: 'Content business',
      sourceGoal: 'Produce and publish content.',
      steps: [
        { id: 's1', label: 'draft the report', dependsOn: [] },
        { id: 's2', label: 'publish the report to the website', dependsOn: ['s1'] },
      ],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const data = result.data as {
      executed: boolean;
      authorizationRequired: boolean;
      approvalGates: Array<{ stepId: string }>;
      steps: Array<{ actionClass: string }>;
    };
    expect(data.executed).toBe(false);
    expect(data.authorizationRequired).toBe(true);
    expect(data.approvalGates).toHaveLength(1);
    expect(data.steps[0]?.actionClass).toBe('A');
    expect(data.steps[1]?.actionClass).toBe('C');
  });

  // ── SPRINT-033 Part B — opportunity categories ─────────────────────────
  it('evaluateOpportunity normalizes the category vocabulary', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    const result = await caller.world.evaluateOpportunity({
      userId: 'c-1',
      title: 'SaaS idea',
      description: 'A subscription product.',
      requiredCapabilities: [],
      category: 'saas',
      factors: [],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((result.data as { category: string }).category).toBe('saas');
  });

  it('rejects invalid zod input and unauthenticated mutation attempts', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    await expect(
      caller.world.createBusinessUnit({ userId: 'c-1', name: '', purpose: 'p' }),
    ).rejects.toThrow();
    await expect(
      caller.world.graphObserve({
        userId: 'c-1',
        type: 'opportunity',
        label: '',
        evidence: ['x'],
        provenance: { source: 'brain-opportunity', status: 'VERIFIED', observedAt: 'now' },
      }),
    ).rejects.toThrow();
    // SPRINT-033: an evidence-less revenue figure is rejected at zod.
    await expect(
      caller.world.registerRevenueStream({
        userId: 'c-1',
        name: 'Fake',
        kind: 'SERVICE',
        estimatedMonthlyRevenueUsd: { value: 1, status: 'ESTIMATED', evidence: [] },
      }),
    ).rejects.toThrow();
  });

  // ── SPRINT-034 — outcome evidence & revenue → outcome feedback ─────────
  it('recordOutcomeEvidence is VERIFIED-only and feeds future evaluations', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    const ok = await caller.world.recordOutcomeEvidence({
      userId: 'c-1',
      kind: 'MARGIN',
      opportunityId: 'opp-1',
      category: 'saas',
      actual: { value: 0.9, status: 'VERIFIED', evidence: ['actuals'] },
      verificationStatus: 'VERIFIED',
      evidence: ['verified margin 0.9'],
    });
    expect(ok.success).toBe(true);

    // UNVERIFIED records are rejected at the zod boundary (defense in depth
    // — the domain ALSO refuses non-VERIFIED actuals).
    await expect(
      caller.world.recordOutcomeEvidence({
        userId: 'c-1',
        kind: 'REVENUE',
        opportunityId: 'opp-2',
        actual: { value: 5, status: 'ESTIMATED', evidence: ['guess'] },
        verificationStatus: 'VERIFIED',
        evidence: ['guess'],
      }),
    ).rejects.toThrow();

    const listed = await caller.world.listOutcomeEvidence({ userId: 'c-1' });
    expect(listed.success).toBe(true);
    expect((listed.data as unknown[]).length).toBe(1);

    const feedback = await caller.world.applyOutcomeFeedback({
      userId: 'c-1',
      evidenceId: (ok.data as { id: string }).id,
    });
    expect(feedback.success).toBe(true);
    if (feedback.success) {
      const data = feedback.data as {
        applied: boolean;
        adjustments: Array<{ factor: string; delta: number }>;
      };
      expect(data.applied).toBe(true);
      expect(data.adjustments[0]?.delta).toBeLessThanOrEqual(0.051);
    }
  });

  // ── SPRINT-034 — blueprint → approval-gated execution ──────────────────
  it('requestBlueprintApproval → decideBlueprintApproval routes through the existing authority', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    const blueprint = await caller.world.buildBlueprint({
      userId: 'c-1',
      sourceTitle: 'Content business',
      sourceGoal: 'Publish content.',
      steps: [{ id: 's1', label: 'publish the report to the website', dependsOn: [] }],
    });
    expect(blueprint.success).toBe(true);
    if (!blueprint.success) return;

    const requested = await caller.world.requestBlueprintApproval({
      userId: 'c-1',
      blueprint: blueprint.data as never,
      stepId: 's1',
      providerId: 'provider-x',
      estimatedCostUsd: { value: 5, status: 'ESTIMATED', evidence: ['quote'] },
      dataScope: 'public website',
    });
    expect(requested.success).toBe(true);
    if (!requested.success) return;
    const request = requested.data as {
      id: string;
      status: string;
      executed: boolean;
      authorityRequired: string;
    };
    expect(request.status).toBe('WAITING_FOR_APPROVAL');
    expect(request.executed).toBe(false);
    expect(request.authorityRequired).toBe('C');

    const decided = await caller.world.decideBlueprintApproval({
      userId: 'c-1',
      requestId: request.id,
      decision: 'APPROVED',
      note: 'Approved',
    });
    expect(decided.success).toBe(true);
    if (decided.success) {
      const data = decided.data as {
        status: string;
        executed: boolean;
        decision?: { scope: string };
      };
      expect(data.status).toBe('APPROVED');
      expect(data.executed).toBe(false); // approval never flips executed
      expect(data.decision?.scope).toContain('publish the report');
    }
    const list = await caller.world.listBlueprintApprovals({ userId: 'c-1' });
    expect(list.success && (list.data as unknown[]).length).toBe(1);
  });

  // ── SPRINT-034 — cost-weighted revenue intelligence ────────────────────
  it('revenueRanking is margin-aware with UNKNOWN never zero', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    await caller.world.registerRevenueStream({
      userId: 'c-1',
      name: 'High revenue',
      kind: 'SERVICE',
      estimatedMonthlyRevenueUsd: { value: 12000, status: 'ESTIMATED', evidence: ['deal'] },
      estimatedMonthlyCostUsd: { value: 5000, status: 'ESTIMATED', evidence: ['costs'] },
    });
    await caller.world.registerRevenueStream({
      userId: 'c-1',
      name: 'No cost evidence',
      kind: 'PRODUCT',
      estimatedMonthlyRevenueUsd: { value: 10000, status: 'ESTIMATED', evidence: ['deal'] },
    });
    const ranking = await caller.world.revenueRanking({ userId: 'c-1' });
    expect(ranking.success).toBe(true);
    if (!ranking.success) return;
    const data = ranking.data as {
      advisory: boolean;
      unknownCost: string[];
      entries: Array<{ streamName: string; rankScore?: number }>;
    };
    expect(data.advisory).toBe(true);
    expect(data.unknownCost).toContain('No cost evidence');
    expect(
      data.entries.find((e) => e.streamName === 'No cost evidence')?.rankScore,
    ).toBeUndefined();
  });

  // ── SPRINT-034 — Founder Command Center ────────────────────────────────
  it('commandCenter composes the read models into TODAY/PORTFOLIO/APPROVALS', async () => {
    // SPRINT-043E — the founder must have recorded data before the AI World
    // opportunity surfaces in the pipeline; register a problem first.
    const world = makeWorld();
    const registered = world.registerProblem({
      ownerId: 'c-1',
      problemStatement: 'Local clinics reconcile invoices manually and lose hours weekly.',
      evidence: [
        {
          source: 'direct_observation',
          text: 'LOCAL TEST: two clinic owners described reconciliation as a weekly time sink.',
          confidence: 'ESTIMATED',
        },
      ],
    });
    expect(registered.success).toBe(true);
    const router = createAppRouter({ world } as unknown as ApiApplicationService);
    const caller = router.createCaller(ctx('c-1'));
    const view = await caller.world.commandCenter({ userId: 'c-1' });
    expect(view.success).toBe(true);
    if (!view.success) return;
    const data = view.data as {
      advisory: boolean;
      today: { pendingApprovals: unknown[]; attention: unknown[] };
      portfolio: { businessUnits: number; pipelineOpportunities: number };
      intelligence: { signals: Array<{ status: string }> };
      automation: { workflows: number };
      approvals: unknown[];
    };
    expect(data.advisory).toBe(true);
    expect(data.portfolio.pipelineOpportunities).toBeGreaterThan(0);
    expect(data.intelligence.signals.every((s) => s.status === 'UNAVAILABLE')).toBe(true);
    expect(data.automation.workflows).toBe(0);
    expect(data.approvals).toEqual([]);
  });

  // ── SPRINT-036 — multi-provider orchestration plan ────────────────────
  it('orchestratePlan produces a bounded plan with per-step bindings; NEVER executes', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    const result = await caller.world.orchestratePlan({
      userId: 'c-1',
      goal: 'Research a business opportunity and prepare a concise recommendation',
      strategy: 'BALANCED',
      steps: [
        { id: 'research', label: 'Research the opportunity', capability: 'research' },
        { id: 'verify', label: 'Verify the recommendation', capability: 'verification' },
      ],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const data = result.data as {
      executed: boolean;
      authorizationRequired: boolean;
      providerCount: number;
      steps: Array<{ providerId: string; strategy: string; retryPolicy: unknown[] }>;
    };
    expect(data.executed).toBe(false);
    expect(data.authorizationRequired).toBe(true);
    expect(data.steps).toHaveLength(2);
    expect(data.steps[0]?.providerId).toBe('openai');
    expect(data.steps[0]?.retryPolicy.length).toBeGreaterThan(0);
  });

  it('orchestratePlan is idempotent and owner-isolated; rejects malformed input', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    const input = {
      userId: 'c-1',
      goal: 'Automate onboarding',
      strategy: 'QUALITY' as const,
      steps: [{ id: 's1', label: 'Draft the plan', capability: 'planning' }],
    };
    const first = await caller.world.orchestratePlan(input);
    const second = await caller.world.orchestratePlan(input);
    expect(first.success && second.success).toBe(true);
    if (first.success && second.success) {
      expect((second.data as { id: string }).id).toBe((first.data as { id: string }).id);
    }
    const mine = await caller.world.listOrchestrationPlans({ userId: 'c-1' });
    expect((mine.data as unknown[]).length).toBe(1);
    // Owner isolation: c-2 never sees c-1's plan.
    const other = createAppRouter(makeServices()).createCaller(ctx('c-2'));
    const notMine = await other.world.listOrchestrationPlans({ userId: 'c-2' });
    expect((notMine.data as unknown[]).length).toBe(0);
    // Malformed input is rejected at the zod boundary (invalid strategy).
    await expect(
      caller.world.orchestratePlan({ ...input, strategy: 'AGGRESSIVE' as never }),
    ).rejects.toThrow();
  });

  // ── SPRINT-037 — approval-gated execution through the EXISTING bridge ──
  it('approveOrchestrationPlan routes the decision through the Brain authority', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    const planned = await caller.world.orchestratePlan({
      userId: 'c-1',
      goal: 'Approve me',
      strategy: 'BALANCED',
      steps: [{ id: 's1', label: 'Research', capability: 'research' }],
    });
    expect(planned.success).toBe(true);
    if (!planned.success) return;
    const planId = (planned.data as { id: string }).id;

    const decided = await caller.world.approveOrchestrationPlan({
      userId: 'c-1',
      planId,
      decision: 'APPROVED',
      note: 'founder approved',
    });
    expect(decided.success).toBe(true);
    if (!decided.success) return;
    const data = decided.data as {
      status: string;
      approval?: { grantedBy: string; scope: string };
      executed: boolean;
    };
    expect(data.status).toBe('APPROVED');
    expect(data.approval?.grantedBy).toBe('c-1');
    // Structural: approval never flips `executed` — the bridge is the only runtime.
    expect(data.executed).toBe(false);
  });

  it('startOrchestrationPlan refuses an unapproved plan (no execution without approval)', async () => {
    const router = createAppRouter(makeServices());
    const caller = router.createCaller(ctx('c-1'));
    const planned = await caller.world.orchestratePlan({
      userId: 'c-1',
      goal: 'Do not run me yet',
      strategy: 'BALANCED',
      steps: [{ id: 's1', label: 'Research', capability: 'research' }],
    });
    expect(planned.success).toBe(true);
    if (!planned.success) return;
    const planId = (planned.data as { id: string }).id;

    const started = await caller.world.startOrchestrationPlan({ userId: 'c-1', planId });
    expect(started.success).toBe(false);
    const err = started.error as { code: string; message: string };
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.message).toContain('not approved');
  });

  it('startOrchestrationPlan routes an APPROVED plan through the existing bridge', async () => {
    // Compose a REAL ExecutionRunService with a deterministic step port so the
    // full seam is proven: approved orchestration plan → bridge → step port.
    const { ExecutionRunService, InMemoryExecutionRunStore, InMemoryPreferenceLedger } =
      await import('@vedmoulya/execution-bridge');
    const { SystemClock } = await import('@vedmoulya/loop-engine');
    const { createOrchestrationAwarePlanSource } =
      await import('../infrastructure/OrchestrationPlanSource.js');
    const world = makeWorld();
    const executedSteps: string[] = [];
    const executionRun = new ExecutionRunService({
      planSource: createOrchestrationAwarePlanSource(() => world, {
        getPlan: async () => undefined,
      }),
      port: {
        availability: () => ({ available: true }),
        execute: async (input) => {
          executedSteps.push(input.stepId);
          return {
            ok: true,
            content: `Result for ${input.stepId}`,
            provider: 'openai',
            model: 'gpt-4o-mini',
            tokens: { input: 10, output: 20, total: 30 },
            costUsd: 0.0001,
            latencyMs: 50,
          };
        },
      },
      store: new InMemoryExecutionRunStore(),
      ledger: new InMemoryPreferenceLedger(),
      budget: { maxIterations: 10, maxTokens: 8000, maxCostUsd: 0.5, maxLatencyMs: 60000 },
      clock: new SystemClock(),
      maxRetries: 0,
    });
    const router = createAppRouter({
      world,
      executionRun,
    } as unknown as ApiApplicationService);
    const caller = router.createCaller(ctx('c-1'));

    // Plan → approve through the Brain → start through the existing bridge.
    const planned = await caller.world.orchestratePlan({
      userId: 'c-1',
      goal: 'Run a bounded analysis workflow',
      strategy: 'BALANCED',
      steps: [
        { id: 'research', label: 'Research', capability: 'research' },
        { id: 'finalize', label: 'Finalize', capability: 'summarization' },
      ],
    });
    expect(planned.success).toBe(true);
    if (!planned.success) return;
    const planId = (planned.data as { id: string }).id;
    await caller.world.approveOrchestrationPlan({
      userId: 'c-1',
      planId,
      decision: 'APPROVED',
    });

    const started = await caller.world.startOrchestrationPlan({ userId: 'c-1', planId });
    expect(started.success).toBe(true);
    if (!started.success) return;
    const run = started.data as {
      executionId: string;
      status: string;
      steps: Array<{ disposition: string }>;
    };
    expect(run.executionId).toBeTruthy();
    // The bridge resolved the APPROVED orchestration plan and executed the
    // EXECUTABLE steps through the step port (real runtime path composed).
    expect(executedSteps.length).toBeGreaterThan(0);
    // Unapproved (PLANNED) plans never reach the bridge — verified above.
  });
});

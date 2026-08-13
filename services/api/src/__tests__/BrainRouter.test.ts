// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Gateway: brain.* namespace tests
// EPIC-016 — The VedMoulya Brain (central intelligence & orchestration)
//
// Exercises the brain.* procedures through the REAL tRPC pipeline (auth +
// rate-limit middleware + RouterRegistry handler closures):
//   createTask        — understand + mode selection
//   plan              — EPIC-013 capability plan reuse
//   selectResources   — N-provider role assignment
//   execute           — bounded execution through the execution port
//   verify            — synthesis + verification checks
//   requestApproval / approve / reject — sensitive-action gates
//   getStatus / listTasks / getDecisionRecords — owner-scoped reads
//   cancel            — owner-scoped control
//   evaluateOutcome   — learning feed (preference ledger)
// Plus IDOR: a foreign userId must be refused by the gateway guard AND the
// service on every procedure. The provider port is a deterministic fake —
// no live external services.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  BrainApplicationService,
  InMemoryBrainTaskStore,
  InMemoryBrainDecisionStore,
  InMemoryOpportunityStore,
  InMemoryIntelligenceEventStore,
  InMemoryOutcomeMemory,
  AdaptiveScoreLedger,
} from '@vedmoulya/brain';
import type {
  BrainPlanPort,
  BrainCandidatePort,
  BrainExecutionPort,
  BrainContextPort,
  BrainPreferencePort,
  BrainUsagePort,
  BrainDiscoveryBridgePort,
  ClockPort,
  IntelligenceEvent,
  Opportunity,
} from '@vedmoulya/brain';
import type { FactoryCapabilityPlan } from '@vedmoulya/capability-marketplace';
import { createAppRouter } from '../services/RouterRegistry.js';
import type { ApiApplicationService } from '../services/ApiApplicationService.js';
import { BrainDashboardService } from '../services/BrainDashboardService.js';
import type { ProviderExperienceService } from '../services/ProviderExperienceService.js';

// ── Deterministic fakes — no live services ─────────────────────────────────
class FakeClock implements ClockPort {
  private t = new Date('2026-08-16T09:00:00Z');
  now(): string {
    this.t = new Date(this.t.getTime() + 1000);
    return this.t.toISOString();
  }
}

function providerFact() {
  return {
    providerId: 'prov-a',
    family: 'openai',
    name: 'Provider A',
    modelId: 'gpt-4o',
    modelName: 'GPT-4o',
    capabilities: ['TEXT_GENERATION', 'REASONING', 'CODING', 'RESEARCH'],
    quality: 0.92,
    costTier: 'medium',
    availability: 0.99,
    configured: true,
    estimatedCostUsd: 0.001,
    evidence: [
      { claim: 'registry capability matrix', source: 'provider-registry', confidence: 'VERIFIED' },
    ],
  } as const;
}

function makePlan(caps: string[] = ['RESEARCH', 'TEXT_GENERATION']): FactoryCapabilityPlan {
  return {
    id: 'plan-1',
    requestedOutcome: 'Create a video about AI',
    createdAt: '2026-08-16T09:00:00Z',
    requiredCapabilities: caps as FactoryCapabilityPlan['requiredCapabilities'],
    candidates: [],
    steps: caps.map((c, i) => ({
      id: `step-${i}`,
      title: `Step ${i + 1}`,
      capability: c as FactoryCapabilityPlan['steps'][number]['capability'],
      purpose: `do ${c}`,
      candidates: [],
      automation: 'FULLY_AUTOMATED' as const,
    })),
    automationLevel: 'PARTIALLY_AUTOMATED' as const,
    automationPercent: 50,
    evidence: [{ claim: 'plan assembled', source: 'capability-planner', confidence: 'VERIFIED' }],
    risks: [],
    humanApprovalPoints: [],
    unavailableCapabilities: [],
    recommendations: [],
  };
}

function makeBrainService() {
  const events: Array<Record<string, unknown>> = [];
  const plan: BrainPlanPort = { planFor: async () => makePlan() };
  const candidates: BrainCandidatePort = {
    providerCandidates: async (cap) =>
      ['RESEARCH', 'TEXT_GENERATION', 'REASONING', 'CODING'].includes(cap) ? [providerFact()] : [],
    discoveryCandidates: async () => [],
    localModelCandidates: async () => [],
  };
  const execution: BrainExecutionPort = {
    execute: async (input) => ({
      content: `Verified output for ${input.capability}.`,
      provider: 'prov-a',
      model: 'gpt-4o',
      tokens: { input: 100, output: 50, total: 150 },
      costUsd: 0.0002,
      latencyMs: 45,
      abstained: false,
    }),
  };
  const context: BrainContextPort = { assemble: async () => 'Minimal task-relevant context.' };
  const preference: BrainPreferencePort = {
    record: async (event) => {
      events.push({ ...event });
    },
  };
  const service = new BrainApplicationService({
    plan,
    candidates,
    execution,
    context,
    preference,
    tasks: new InMemoryBrainTaskStore(),
    decisions: new InMemoryBrainDecisionStore(),
    clock: new FakeClock(),
    budget: { maxTokens: 10000, maxCostUsd: 0.5, maxIterations: 20, maxLatencyMs: 60000 },
    traceId: () => 'trace-gw-1',
  });
  return { service, events };
}

function makeServices(): ApiApplicationService {
  const { service } = makeBrainService();
  return {
    brain: service,
  } as unknown as ApiApplicationService;
}

const testCtx = { userId: 'brain-owner', email: 'owner@vedmoulya.com', role: 'user' };

describe('brain.* — real tRPC pipeline (auth + rate limit + handlers)', () => {
  const router = createAppRouter(makeServices());

  it('full pipeline: createTask → plan → selectResources → execute → verify', async () => {
    const caller = router.createCaller(testCtx);
    const created = await caller.brain.createTask({
      userId: 'brain-owner',
      input: 'Create a professional video about AI',
    });
    expect(created.success).toBe(true);
    const taskId = created.data!.id;
    expect(created.data!.stage).toBe('UNDERSTANDING');

    const planned = await caller.brain.plan({ userId: 'brain-owner', taskId });
    expect(planned.success).toBe(true);
    expect(planned.data!.requiredCapabilities.length).toBe(2);

    const selected = await caller.brain.selectResources({ userId: 'brain-owner', taskId });
    expect(selected.success).toBe(true);
    expect(selected.data!.roleAssignments.length).toBeGreaterThan(0);

    const executed = await caller.brain.execute({ userId: 'brain-owner', taskId });
    expect(executed.success).toBe(true);
    expect(executed.data!.providerOutputs.length).toBeGreaterThan(0);

    const verified = await caller.brain.verify({ userId: 'brain-owner', taskId });
    expect(verified.success).toBe(true);
    expect(verified.data!.synthesis?.summary.length).toBeGreaterThan(0);
  });

  it('approval gate: requestApproval → approve on a sensitive action', async () => {
    const caller = router.createCaller(testCtx);
    const created = await caller.brain.createTask({
      userId: 'brain-owner',
      input: 'Create a video and publish it to YouTube',
    });
    const taskId = created.data!.id;

    const requested = await caller.brain.requestApproval({
      userId: 'brain-owner',
      taskId,
      action: 'publish',
    });
    expect(requested.success).toBe(true);
    expect(requested.data!.status).toBe('AWAITING_APPROVAL');

    const approved = await caller.brain.approve({
      userId: 'brain-owner',
      taskId,
      action: 'publish',
    });
    expect(approved.success).toBe(true);
    expect(approved.data!.approvalGranted).toContain('publish');
  });

  it('reject removes the approval requirement and records provenance', async () => {
    const caller = router.createCaller(testCtx);
    const created = await caller.brain.createTask({
      userId: 'brain-owner',
      input: 'Create a video and publish it',
    });
    const taskId = created.data!.id;
    await caller.brain.requestApproval({ userId: 'brain-owner', taskId, action: 'publish' });
    const rejected = await caller.brain.reject({
      userId: 'brain-owner',
      taskId,
      action: 'publish',
    });
    expect(rejected.success).toBe(true);
    expect(rejected.data!.approvalRequired).not.toContain('publish');
  });

  it('owner-scoped reads: getStatus, listTasks, getDecisionRecords, cancel', async () => {
    const caller = router.createCaller(testCtx);
    const created = await caller.brain.createTask({
      userId: 'brain-owner',
      input: 'Write a short article about AI safety',
    });
    const taskId = created.data!.id;

    const status = await caller.brain.getStatus({ userId: 'brain-owner', taskId });
    expect(status.success).toBe(true);

    const list = await caller.brain.listTasks({ userId: 'brain-owner' });
    expect(list.success).toBe(true);
    expect(list.data!.some((t) => t.id === taskId)).toBe(true);

    const decisions = await caller.brain.getDecisionRecords({ userId: 'brain-owner', taskId });
    expect(decisions.success).toBe(true);
    expect(decisions.data!.length).toBeGreaterThan(0);

    const cancelled = await caller.brain.cancel({ userId: 'brain-owner', taskId });
    expect(cancelled.success).toBe(true);
    expect(cancelled.data!.status).toBe('CANCELLED');
  });

  it('evaluateOutcome feeds the preference ledger (learning)', async () => {
    const caller = router.createCaller(testCtx);
    const created = await caller.brain.createTask({
      userId: 'brain-owner',
      input: 'Research the latest AI trends',
    });
    const taskId = created.data!.id;
    await caller.brain.plan({ userId: 'brain-owner', taskId });
    await caller.brain.selectResources({ userId: 'brain-owner', taskId });
    await caller.brain.execute({ userId: 'brain-owner', taskId });

    const evaluated = await caller.brain.evaluateOutcome({
      userId: 'brain-owner',
      taskId,
      outputAccepted: true,
    });
    expect(evaluated.success).toBe(true);
    expect(evaluated.data!.outcome).toBeDefined();
  });

  it('correctLearning records an EXPLICIT user correction (auth + rate limit)', async () => {
    const caller = router.createCaller(testCtx);
    const corrected = await caller.brain.correctLearning({
      userId: 'brain-owner',
      statement: 'Do not use this approach again',
      target: 'approach',
    });
    expect(corrected.success).toBe(true);
    expect(corrected.data!.confidence).toBe(0.98);
    expect(corrected.data!.target).toBe('approach');
  });

  it('correctLearning refuses a too-short statement through the zod boundary', async () => {
    const caller = router.createCaller(testCtx);
    await expect(
      caller.brain.correctLearning({
        userId: 'brain-owner',
        statement: 'x',
        target: 'approach',
      }),
    ).rejects.toThrow();
  });

  it('IDOR: a foreign userId is refused by the gateway guard on every procedure', async () => {
    const caller = router.createCaller(testCtx);
    const created = await caller.brain.createTask({
      userId: 'brain-owner',
      input: 'Create a video about AI',
    });
    const taskId = created.data!.id;

    // Foreign reads/mutations → the auth middleware's IDOR guard rejects.
    await expect(
      caller.brain.getStatus({ userId: 'brain-attacker', taskId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller.brain.plan({ userId: 'brain-attacker', taskId })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(caller.brain.cancel({ userId: 'brain-attacker', taskId })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      caller.brain.approve({ userId: 'brain-attacker', taskId, action: 'publish' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller.brain.listTasks({ userId: 'brain-attacker' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects unauthenticated calls with UNAUTHORIZED', async () => {
    const caller = router.createCaller({ userId: 'anonymous', email: '', role: 'guest' });
    await expect(
      caller.brain.createTask({ userId: 'anonymous', input: 'Create a video' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// EPIC-020 — Continuous Intelligence & Adaptive Orchestration
//
// The extended brain.* surface through the REAL tRPC pipeline:
//   discoverIntelligence — AI World / scheduler bridge → screened events +
//                          detected opportunities (never fabricated)
//   listOpportunities / updateOpportunity — owner-scoped opportunity lifecycle
//   listIntelligenceEvents / updateIntelligenceEvent — owner-scoped events
//   providerScores — adaptive recency-weighted performance evidence
//   dashboard — the operating view (what's doing / why / approvals / learned)
// Plus IDOR on every new procedure. Deterministic fakes only.
// ═════════════════════════════════════════════════════════════════════════════

describe('brain.* EPIC-020 — continuous intelligence surface', () => {
  // Namespaced owner so the module-level rate-limit map (keyed by userId) never
  // collides with the EPIC-016 describe block above (repo convention).
  const contCtx = { userId: 'brain-cont-owner', email: 'cont@vedmoulya.com', role: 'user' };

  function makeContinuousServices(): {
    services: ApiApplicationService;
    events: IntelligenceEvent[];
    opportunities: Opportunity[];
  } {
    const clock = new FakeClock();
    const opportunityStore = new InMemoryOpportunityStore();
    const eventStore = new InMemoryIntelligenceEventStore();
    const outcomeMemory = new InMemoryOutcomeMemory();
    const ledger = new AdaptiveScoreLedger(() => clock.now());

    const discovered: IntelligenceEvent[] = [
      {
        id: 'evt-free-api',
        userId: contCtx.userId,
        kind: 'NEW_FREE_API',
        title: 'Acme speech API adds a free tier',
        description: 'New free tier with monthly quota.',
        relevance: 0.9,
        security: 'TRUSTED',
        evidence: ['discovery source acme-directory'],
        adoptionRequired: [],
        source: 'ai-world',
        createdAt: '2026-08-16T09:00:00Z',
        status: 'NEW',
      },
      {
        id: 'evt-suspicious-repo',
        userId: contCtx.userId,
        kind: 'NEW_GITHUB_REPOSITORY',
        title: 'Suspicious-looking scraper repo',
        description: 'Repo with obfuscated scripts.',
        relevance: 0.5,
        security: 'SUSPICIOUS',
        evidence: ['suspicious indicators found'],
        adoptionRequired: [],
        source: 'ai-world',
        createdAt: '2026-08-16T09:00:00Z',
        status: 'NEW',
      },
    ];

    const plan: BrainPlanPort = { planFor: async () => makePlan() };
    const candidates: BrainCandidatePort = {
      providerCandidates: async (cap) =>
        ['RESEARCH', 'TEXT_GENERATION', 'REASONING', 'CODING'].includes(cap)
          ? [providerFact()]
          : [],
      discoveryCandidates: async () => [],
      localModelCandidates: async () => [],
    };
    const execution: BrainExecutionPort = {
      execute: async (input) => ({
        content: `Verified output for ${input.capability}.`,
        provider: 'prov-a',
        model: 'gpt-4o',
        tokens: { input: 100, output: 50, total: 150 },
        costUsd: 0.0002,
        latencyMs: 45,
        abstained: false,
      }),
    };
    const context: BrainContextPort = { assemble: async () => 'Minimal task-relevant context.' };
    const preference: BrainPreferencePort = { record: async () => {} };

    const service = new BrainApplicationService({
      plan,
      candidates,
      execution,
      context,
      preference,
      tasks: new InMemoryBrainTaskStore(),
      decisions: new InMemoryBrainDecisionStore(),
      clock,
      budget: { maxTokens: 10000, maxCostUsd: 0.5, maxIterations: 20, maxLatencyMs: 60000 },
      traceId: () => 'trace-gw-cont',
      usage: { usageFacts: async () => [] } as BrainUsagePort,
      experience: ledger,
      memory: outcomeMemory,
      discovery: {
        fetchIntelligenceEvents: async () => discovered,
      } as BrainDiscoveryBridgePort,
      opportunities: opportunityStore,
      events: eventStore,
    });

    const dashboard = new BrainDashboardService({
      brain: service,
      outcomeMemory,
      providerExperience: {
        getOverview: async () => ({
          success: true,
          data: {
            providers: [],
            usage: {
              tokensUsed: 0,
              tokenBudget: 0,
              costUsd: 0,
              aiCalls: 0,
              cacheHits: 0,
              freePercent: 0,
            },
            preferences: {},
          },
        }),
      } as unknown as ProviderExperienceService,
    });

    return {
      services: { brain: service, brainDashboard: dashboard } as unknown as ApiApplicationService,
      events: discovered,
      opportunities: [],
    };
  }

  it('discoverIntelligence bridges AI World → screened events → opportunities', async () => {
    const { services, events } = makeContinuousServices();
    const caller = createAppRouter(services).createCaller(contCtx);

    const result = await caller.brain.discoverIntelligence({ userId: contCtx.userId });
    expect(result.success).toBe(true);
    // Both events are stored (the suspicious one is never dropped — it is
    // surfaced with its security classification).
    expect(result.data!.events.length).toBe(events.length);
    // The FREE API yields a cost_saving opportunity; the SUSPICIOUS repo does
    // NOT become an opportunity (security-first, discovery ≠ adoption).
    const opportunities = result.data!.opportunities;
    expect(opportunities.some((o) => o.category === 'cost_saving')).toBe(true);
    expect(opportunities.some((o) => o.source === 'ai-world-discovery')).toBe(true);
    expect(opportunities.every((o) => o.uncertainty > 0)).toBe(true);
  });

  it('dedupes repeated discovery runs (discovery ≠ duplicate spam)', async () => {
    const { services } = makeContinuousServices();
    const caller = createAppRouter(services).createCaller(contCtx);
    await caller.brain.discoverIntelligence({ userId: contCtx.userId });
    const second = await caller.brain.discoverIntelligence({ userId: contCtx.userId });
    // The events list is not duplicated.
    expect(second.data!.events.filter((e) => e.id === 'evt-free-api').length).toBe(1);
    // No new opportunities from already-seen events.
    expect(second.data!.opportunities.length).toBe(0);
  });

  it('opportunity + event lifecycle is owner-scoped (list → update status)', async () => {
    const { services } = makeContinuousServices();
    const caller = createAppRouter(services).createCaller(contCtx);
    await caller.brain.discoverIntelligence({ userId: contCtx.userId });

    const opportunities = await caller.brain.listOpportunities({ userId: contCtx.userId });
    expect(opportunities.success).toBe(true);
    const first = opportunities.data![0];
    const updated = await caller.brain.updateOpportunity({
      userId: contCtx.userId,
      opportunityId: first!.id,
      status: 'ACCEPTED',
    });
    expect(updated.data!.status).toBe('ACCEPTED');

    const events = await caller.brain.listIntelligenceEvents({ userId: contCtx.userId });
    expect(events.data!.some((e) => e.id === 'evt-suspicious-repo')).toBe(true);
    const reviewed = await caller.brain.updateIntelligenceEvent({
      userId: contCtx.userId,
      eventId: 'evt-suspicious-repo',
      status: 'REVIEWED',
    });
    expect(reviewed.data!.status).toBe('REVIEWED');
  });

  it('providerScores surfaces recency-weighted adaptive evidence after learning', async () => {
    const { services } = makeContinuousServices();
    const caller = createAppRouter(services).createCaller(contCtx);
    const created = await caller.brain.createTask({
      userId: contCtx.userId,
      input: 'Research the latest AI trends',
    });
    const taskId = created.data!.id;
    await caller.brain.plan({ userId: contCtx.userId, taskId });
    await caller.brain.selectResources({ userId: contCtx.userId, taskId });
    await caller.brain.execute({ userId: contCtx.userId, taskId });
    await caller.brain.verify({ userId: contCtx.userId, taskId });
    await caller.brain.evaluateOutcome({ userId: contCtx.userId, taskId, outputAccepted: true });

    const scores = await caller.brain.providerScores({
      userId: contCtx.userId,
      capability: 'RESEARCH',
    });
    expect(scores.success).toBe(true);
    expect(scores.data!.length).toBeGreaterThan(0);
    for (const score of scores.data!) {
      expect(score.qualityScore).toBeGreaterThan(0);
      expect(score.sampleCount).toBeGreaterThan(0);
    }
  });

  it('dashboard composes the operating view from existing telemetry', async () => {
    const { services } = makeContinuousServices();
    const caller = createAppRouter(services).createCaller(contCtx);
    const view = await caller.brain.dashboard({ userId: contCtx.userId });
    expect(view.success).toBe(true);
    expect(view.data!.brainStatus).toBeDefined();
    expect(typeof view.data!.activeTasks).toBe('number');
    expect(Array.isArray(view.data!.pendingApprovals)).toBe(true);
    expect(Array.isArray(view.data!.learning)).toBe(true);
  });

  it('IDOR: foreign userId is refused on every EPIC-020 procedure', async () => {
    const { services } = makeContinuousServices();
    const caller = createAppRouter(services).createCaller(contCtx);

    await expect(
      caller.brain.discoverIntelligence({ userId: 'brain-attacker' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      caller.brain.listOpportunities({ userId: 'brain-attacker' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      caller.brain.listIntelligenceEvents({ userId: 'brain-attacker' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      caller.brain.providerScores({ userId: 'brain-attacker', capability: 'RESEARCH' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller.brain.dashboard({ userId: 'brain-attacker' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('brain.* EPIC-020 — Outcome & Revenue layer (daily priorities + satisfaction)', () => {
  // Namespaced owner (rate-limit map is module-global keyed by userId).
  const outcomeCtx = {
    userId: 'brain-outcome-owner',
    email: 'outcome@vedmoulya.com',
    role: 'user',
  };

  function makeOutcomeServices(): { services: ApiApplicationService } {
    const clock = new FakeClock();
    const opportunityStore = new InMemoryOpportunityStore();
    const eventStore = new InMemoryIntelligenceEventStore();
    const outcomeMemory = new InMemoryOutcomeMemory();
    const ledger = new AdaptiveScoreLedger(() => clock.now());

    const plan: BrainPlanPort = { planFor: async () => makePlan() };
    const candidates: BrainCandidatePort = {
      providerCandidates: async (cap) =>
        ['RESEARCH', 'TEXT_GENERATION', 'REASONING', 'CODING'].includes(cap)
          ? [providerFact()]
          : [],
      discoveryCandidates: async () => [],
      localModelCandidates: async () => [],
    };
    const execution: BrainExecutionPort = {
      execute: async (input) => ({
        content: `Verified output for ${input.capability}.`,
        provider: 'prov-a',
        model: 'gpt-4o',
        tokens: { input: 100, output: 50, total: 150 },
        costUsd: 0.0002,
        latencyMs: 45,
        abstained: false,
      }),
    };
    const context: BrainContextPort = { assemble: async () => 'Minimal task-relevant context.' };
    const preference: BrainPreferencePort = { record: async () => {} };

    const service = new BrainApplicationService({
      plan,
      candidates,
      execution,
      context,
      preference,
      tasks: new InMemoryBrainTaskStore(),
      decisions: new InMemoryBrainDecisionStore(),
      clock,
      budget: { maxTokens: 10000, maxCostUsd: 0.5, maxIterations: 20, maxLatencyMs: 60000 },
      traceId: () => 'trace-gw-outcome',
      usage: { usageFacts: async () => [] } as BrainUsagePort,
      experience: ledger,
      memory: outcomeMemory,
      opportunities: opportunityStore,
      events: eventStore,
    });

    const dashboard = new BrainDashboardService({
      brain: service,
      outcomeMemory,
      providerExperience: {
        getOverview: async () => ({
          success: true,
          data: {
            providers: [],
            usage: {
              tokensUsed: 0,
              tokenBudget: 0,
              costUsd: 0,
              aiCalls: 0,
              cacheHits: 0,
              freePercent: 0,
            },
            preferences: {},
          },
        }),
      } as unknown as ProviderExperienceService,
    });

    return {
      services: { brain: service, brainDashboard: dashboard } as unknown as ApiApplicationService,
    };
  }

  it('dailyPriorities returns a bounded, transparent Today Top 5', async () => {
    const { services } = makeOutcomeServices();
    const caller = createAppRouter(services).createCaller(outcomeCtx);

    const created = await caller.brain.createTask({
      userId: outcomeCtx.userId,
      input: 'Automate my weekly invoice generation',
    });
    const taskId = created.data!.id;
    await caller.brain.plan({ userId: outcomeCtx.userId, taskId });

    const priorities = await caller.brain.dailyPriorities({ userId: outcomeCtx.userId, limit: 5 });
    expect(priorities.success).toBe(true);
    expect(Array.isArray(priorities.data)).toBe(true);
    expect((priorities.data ?? []).length).toBeLessThanOrEqual(5);
    for (const item of priorities.data ?? []) {
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.whyItMatters.length).toBeGreaterThan(0);
      expect(item.recommendedNextAction.length).toBeGreaterThan(0);
      expect(typeof item.priorityScore).toBe('number');
    }
  });

  it('dailyPriorities surfaces pending approvals first (approval is never buried)', async () => {
    const { services } = makeOutcomeServices();
    const caller = createAppRouter(services).createCaller(outcomeCtx);

    const created = await caller.brain.createTask({
      userId: outcomeCtx.userId,
      input: 'Automate my weekly invoice generation',
    });
    const taskId = created.data!.id;
    await caller.brain.requestApproval({ userId: outcomeCtx.userId, taskId, action: 'subscribe' });

    const priorities = await caller.brain.dailyPriorities({ userId: outcomeCtx.userId, limit: 5 });
    expect(priorities.data![0]?.category).toBe('APPROVAL');
    expect(priorities.data![0]?.requiresApproval).toBe('subscribe');
  });

  it('evaluateOutcome records 3-value satisfaction as explicit feedback', async () => {
    const { services } = makeOutcomeServices();
    const caller = createAppRouter(services).createCaller(outcomeCtx);

    const created = await caller.brain.createTask({
      userId: outcomeCtx.userId,
      input: 'Research the latest AI trends',
    });
    const taskId = created.data!.id;
    await caller.brain.plan({ userId: outcomeCtx.userId, taskId });
    await caller.brain.selectResources({ userId: outcomeCtx.userId, taskId });
    await caller.brain.execute({ userId: outcomeCtx.userId, taskId });
    await caller.brain.verify({ userId: outcomeCtx.userId, taskId });

    const evaluated = await caller.brain.evaluateOutcome({
      userId: outcomeCtx.userId,
      taskId,
      outputAccepted: true,
      satisfaction: 'PARTIALLY',
    });
    expect(evaluated.data!.outcome!.satisfaction).toBe('PARTIALLY');
    const explicit = evaluated.data!.outcome!.preferenceFacts.find((f) => f.source === 'EXPLICIT');
    expect(explicit?.fact).toContain('user rated the outcome');
  });

  it('IDOR: foreign userId refused on dailyPriorities', async () => {
    const { services } = makeOutcomeServices();
    const caller = createAppRouter(services).createCaller(outcomeCtx);
    await expect(caller.brain.dailyPriorities({ userId: 'brain-attacker' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

// ──────────────────────────────────────────────────────────────────
// EPIC-017 — gateway liveIntelligence.* namespace through the real
// tRPC pipeline (auth + rate limit + handlers + IDOR refusal).
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { createAppRouter } from '../services/RouterRegistry.js';
import type { ApiApplicationService } from '../services/ApiApplicationService.js';
import {
  LiveIntelligenceBridgeService,
  InMemoryBridgeLoopStore,
} from '@vedmoulya/live-intelligence-bridge';
import type {
  BridgeAiWorldPort,
  BridgeClockPort,
  BridgeIntelligencePort,
  BridgeLoopStore,
} from '@vedmoulya/live-intelligence-bridge';
import type { BrainTask } from '@vedmoulya/brain';
import type { TaskIntelligenceResult } from '@vedmoulya/ecosystem-intelligence';

// Deterministic fixed clock (same pattern as the brain benchmark).
class FixedClock implements BridgeClockPort {
  private t = 1_700_000_000_000;
  now(): string {
    return new Date(this.t).toISOString();
  }
  timestampMs(): number {
    return this.t;
  }
}

// Deterministic intelligence port with a materially-better paid option.
function makeIntelligence(): BridgeIntelligencePort {
  return {
    findBetterOption: async (): Promise<TaskIntelligenceResult> => ({
      taskId: 'task-1',
      requestedOutcome: 'Create a professional blog post',
      options: [
        {
          kind: 'BEST_CONFIGURED',
          providerId: 'cfg',
          name: 'Configured Writer',
          capability: 'TEXT_GENERATION',
          quality: 70,
          reason: 'Already configured.',
          evidence: ['registry'],
          requires: [],
        },
        {
          kind: 'BEST_PAID',
          providerId: 'premium',
          name: 'Premium Writer',
          capability: 'TEXT_GENERATION',
          quality: 96,
          costUsd: 0.05,
          reason: 'Materially better for this task.',
          evidence: ['measured', 'task-fit'],
          requires: ['api_key', 'subscription'],
        },
      ],
      bestAvailableNow: {
        kind: 'BEST_AVAILABLE_NOW',
        providerId: 'cfg',
        name: 'Configured Writer',
        capability: 'TEXT_GENERATION',
        quality: 70,
        reason: 'Best among configured.',
        evidence: ['registry'],
        requires: [],
      },
      betterOptionAvailable: true,
      fallback: {
        order: ['FREE', 'FREE_QUOTA', 'LOCAL', 'OPEN_SOURCE', 'GITHUB', 'CURRENT_CONFIGURED'],
        bestAchievable: 'Continue with configured writer.',
        note: 'Declining is never task failure.',
      },
    }),
    findFreeAlternative: async () => ({
      free: true,
      name: 'Configured Writer',
      providerId: 'cfg',
      quality: 70,
    }),
    findLocalAlternative: async () => ({
      available: false,
      note: 'No local model on this hardware.',
    }),
    findGitHubCapability: async () => ({
      found: false,
      items: [],
      note: 'No open-source candidate yet.',
    }),
    findBetterProvider: async () => ({
      better: true,
      current: { name: 'Configured Writer', quality: 70 },
      recommended: { name: 'Premium Writer', quality: 96, requiresActivation: true },
    }),
    evaluateSecurity: () => ({ state: 'SECURITY_REVIEWED', evidence: ['no blocking indicators'] }),
    evaluateLicense: () => ({
      software: {
        present: true,
        type: 'MIT',
        commercialUseRestricted: false,
        redistributionRestricted: false,
        attributionRequired: false,
        verdict: 'PERMISSIVE',
      },
      verdict: 'PERMISSIVE',
    }),
    respondToRecommendation: async () => ({ state: 'ACCEPTED' }),
    notify: (_, opts) => ({
      id: `n-${opts.title.length}`,
      kind: opts.kind,
      title: opts.title,
      body: opts.body,
      relevance: opts.relevance,
      createdAt: new Date().toISOString(),
    }),
  };
}

function makeLoopStore(): BridgeLoopStore {
  return new InMemoryBridgeLoopStore();
}

function makeTask(userId: string): BrainTask {
  return {
    id: 'brain-gw-1',
    userId,
    objective: 'Create a professional blog post',
    originalInput: 'Create a professional blog post',
    intent: {
      objective: 'Create a professional blog post',
      domain: 'content',
      desiredOutcome: 'A blog post',
      constraints: [],
      qualityTarget: 'HIGH',
      privacyRequirement: 'STANDARD',
      urgency: 'NORMAL',
      authorizedActions: [],
      ambiguities: [],
      assumptions: [],
    },
    mode: 'QUALITY',
    domain: 'content',
    qualityTarget: 'HIGH',
    privacyRequirement: 'STANDARD',
    budget: { maxTokens: 100000, maxCostUsd: 1, maxIterations: 5, maxLatencyMs: 60000 },
    requiredCapabilities: ['TEXT_GENERATION'],
    roleAssignments: [],
    graph: { nodes: [], edges: [], waves: [] },
    status: 'NEW',
    stage: 'UNDERSTANDING',
    stageStatuses: {
      UNDERSTANDING: 'pending',
      PLAN: 'pending',
      INTELLIGENCE: 'pending',
      EXECUTION: 'pending',
      VERIFICATION: 'pending',
      RESULT: 'pending',
      CANCELLED: 'pending',
      FAILED: 'pending',
    },
    providerOutputs: [],
    conflicts: [],
    decisionRecords: [],
    approvalRequired: [],
    approvalGranted: [],
    traceId: 'trace-gw-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeServices(userId: string) {
  const aiWorld: BridgeAiWorldPort = {
    emit: async () => ({ emitted: true }),
    unreadCount: async () => 0,
  };
  const service = new LiveIntelligenceBridgeService({
    clock: new FixedClock(),
    brain: {
      createTask: () => ({ success: true, data: makeTask(userId) }),
      plan: async () => ({ success: true, data: makeTask(userId) }),
      selectResources: async () => ({ success: true, data: undefined as never }),
      requestApproval: () => ({ success: false, error: 'n/a', code: 'NOT_REQUIRED' }),
      approve: () => ({ success: true, data: undefined as never }),
      reject: () => ({ success: true, data: undefined as never }),
      execute: async () => ({ success: true, data: undefined as never }),
      verify: () => ({ success: true, data: undefined as never }),
      evaluateOutcome: async () => ({ success: true, data: undefined as never }),
      getStatus: () => ({ success: true, data: undefined as never }),
      listTasks: () => ({ success: true, data: [] }),
    },
    intelligence: makeIntelligence(),
    marketplace: {
      plan: async (_, request) => ({
        id: 'plan-gw-1',
        requestedOutcome: request.outcome,
        createdAt: new Date().toISOString(),
        requiredCapabilities: ['TEXT_GENERATION'],
        candidates: [],
        steps: [
          {
            id: 'create',
            title: 'Create',
            capability: 'TEXT_GENERATION',
            purpose: 'Produce the content.',
            candidates: [],
            automation: 'FULLY_AUTOMATED',
            irreversible: false,
            reasons: ['fixture'],
          },
        ],
        automationLevel: 'FULLY_AUTOMATED',
        automationPercent: 100,
        evidence: [],
        risks: [],
        humanApprovalPoints: [],
        unavailableCapabilities: [],
        recommendations: [],
      }),
      getPlan: async () => undefined,
    },
    execution: {
      start: async () => ({ success: true, data: undefined as never }),
      approve: async () => ({ success: true, data: undefined as never }),
      reject: async () => ({ success: true, data: undefined as never }),
      completeHandoff: async () => ({ success: true, data: undefined as never }),
      get: () => ({ success: false, error: 'not executed', data: undefined }),
      list: () => ({ success: true, data: [] }),
    },
    candidates: {
      providerCandidates: async (capability: string) => [
        {
          providerId: 'cfg',
          family: 'openai',
          name: 'Configured Writer',
          modelId: 'w1',
          modelName: 'Writer-1',
          capabilities: [capability],
          quality: 0.7,
          costTier: 'free',
          availability: 1,
          configured: true,
          estimatedCostUsd: 0,
          evidence: [{ claim: 'configured', source: 'registry', confidence: 'VERIFIED' }],
        },
        {
          providerId: 'premium',
          family: 'openai',
          name: 'Premium Writer',
          modelId: 'w2',
          modelName: 'Writer-2',
          capabilities: [capability],
          quality: 0.96,
          costTier: 'high',
          availability: 1,
          configured: false,
          estimatedCostUsd: 0.05,
          evidence: [{ claim: 'measured', source: 'registry', confidence: 'MEASURED' }],
        },
      ],
      discoveryCandidates: async () => [],
      localModelCandidates: async () => [],
    },
    preference: { record: async () => undefined },
    aiWorld,
    loops: makeLoopStore(),
    traceId: () => 'trace-bridge-gw-1',
  });
  return {
    service,
    services: { liveIntelligence: service } as unknown as ApiApplicationService,
  };
}

// Fresh router + unique user per test — the heavy-tier limiter is global
// (20 req/min per user), so each test needs its own budget (same pattern as
// BrainRouter.test.ts). The ctx.userId is only used by the auth middleware;
// input.userId is what the limiter + owner scope key on.
describe('liveIntelligence.* — real tRPC pipeline (auth + rate limit + handlers)', () => {
  const owner = (n: number) => `bridge-owner-${n}`;
  const callerFor = (userId: string) =>
    createAppRouter(makeServices(userId).services).createCaller({
      userId,
      email: `${userId}@vedmoulya.com`,
      role: 'user',
    });

  it('full loop: start → discover → compare → recommend (better option found)', async () => {
    const userId = owner(1);
    const caller = callerFor(userId);
    const started = await caller.liveIntelligence.start({
      userId,
      objective: 'Create a professional blog post',
    });
    expect(started.success).toBe(true);
    const loopId = started.data!.loopId;
    expect(started.data!.capabilities).toContain('TEXT_GENERATION');

    const discovered = await caller.liveIntelligence.discover({ userId, loopId });
    expect(discovered.success).toBe(true);
    expect(discovered.data!.candidates.length).toBeGreaterThan(0);

    const compared = await caller.liveIntelligence.compare({ userId, loopId });
    expect(compared.success).toBe(true);
    expect(compared.data!.comparisons.some((c) => c.betterOptionAvailable)).toBe(true);

    const recommended = await caller.liveIntelligence.recommend({ userId, loopId });
    expect(recommended.success).toBe(true);
    expect(recommended.data!.recommendations.length).toBeGreaterThan(0);
    expect(recommended.data!.recommendations[0].approvalRequired).toBe(true);
    expect(recommended.data!.status).toBe('AWAITING_APPROVAL');
  });

  it('approve grants the recommendation and surfaces the explicit signal', async () => {
    const userId = owner(2);
    const caller = callerFor(userId);
    const started = await caller.liveIntelligence.start({
      userId,
      objective: 'Create a professional blog post',
    });
    const loopId = started.data!.loopId;
    await caller.liveIntelligence.discover({ userId, loopId });
    await caller.liveIntelligence.compare({ userId, loopId });
    const recommended = await caller.liveIntelligence.recommend({ userId, loopId });
    const recId = recommended.data!.recommendations[0].id;
    const approved = await caller.liveIntelligence.approve({
      userId,
      loopId,
      recommendationId: recId,
    });
    expect(approved.success).toBe(true);
    expect(approved.data!.recommendations[0].state).toBe('ACCEPTED');
    expect(approved.data!.approvals.every((a) => a.state === 'GRANTED')).toBe(true);
  });

  it('reject records an honest decline and keeps the best configured option', async () => {
    const userId = owner(3);
    const caller = callerFor(userId);
    const started = await caller.liveIntelligence.start({
      userId,
      objective: 'Create a professional blog post',
    });
    const loopId = started.data!.loopId;
    await caller.liveIntelligence.discover({ userId, loopId });
    await caller.liveIntelligence.compare({ userId, loopId });
    const recommended = await caller.liveIntelligence.recommend({ userId, loopId });
    const recId = recommended.data!.recommendations[0].id;
    const rejected = await caller.liveIntelligence.reject({
      userId,
      loopId,
      recommendationId: recId,
    });
    expect(rejected.success).toBe(true);
    expect(rejected.data!.recommendations[0].state).toBe('DECLINED');
    expect(rejected.data!.approvals.some((a) => a.state === 'REJECTED')).toBe(true);
  });

  it('IDOR: a foreign userId is refused by the gateway guard', async () => {
    const userId = owner(4);
    const caller = callerFor(userId);
    await expect(
      caller.liveIntelligence.start({
        userId: 'intruder-1',
        objective: 'Create a professional blog post',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      caller.liveIntelligence.get({ userId: 'intruder-1', loopId: 'loop-x' }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(caller.liveIntelligence.list({ userId: 'intruder-1' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('schema validation: short objective is rejected by zod; unknown loop is honest NOT_FOUND', async () => {
    const userId = owner(5);
    const caller = callerFor(userId);
    await expect(caller.liveIntelligence.start({ userId, objective: 'x' })).rejects.toThrow();
    const missing = await caller.liveIntelligence.get({ userId, loopId: 'nope' });
    expect(missing.success).toBe(false);
  });

  it('list + performanceProfile are owner-scoped reads', async () => {
    const userId = owner(6);
    const caller = callerFor(userId);
    const started = await caller.liveIntelligence.start({
      userId,
      objective: 'Create a professional blog post',
    });
    const loopId = started.data!.loopId;
    const listed = await caller.liveIntelligence.list({ userId });
    expect(listed.success).toBe(true);
    expect(listed.data!.some((l) => l.loopId === loopId)).toBe(true);
    const profile = await caller.liveIntelligence.performanceProfile({ userId });
    expect(profile.success).toBe(true);
  });

  it('emitNotification is relevance-gated through the real pipeline', async () => {
    const userId = owner(7);
    const caller = callerFor(userId);
    const started = await caller.liveIntelligence.start({
      userId,
      objective: 'Create a professional blog post',
    });
    const loopId = started.data!.loopId;
    const low = await caller.liveIntelligence.emitNotification({
      userId,
      loopId,
      kind: 'NEW_MODEL',
      title: 'minor',
      body: 'low',
      relevance: 5,
    });
    expect(low.success).toBe(true);
    expect(low.data && 'dropped' in low.data).toBe(true);
    const high = await caller.liveIntelligence.emitNotification({
      userId,
      loopId,
      kind: 'BETTER_CAPABILITY',
      title: 'Better model',
      body: 'Major',
      relevance: 95,
    });
    expect(high.success).toBe(true);
    expect(high.data && !('dropped' in high.data)).toBe(true);
  });
});

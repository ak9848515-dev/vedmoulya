// ──────────────────────────────────────────────────────────────────
// EPIC-017 — additional deterministic coverage for domain branches
// and service edge paths (error handling, gating, notifications).
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { LiveIntelligenceBridgeService } from '../application/LiveIntelligenceBridgeService.js';
import { InMemoryBridgeLoopStore } from '../infrastructure/InMemoryBridgeLoopStore.js';
import { AcquisitionClassifier } from '../domain/AcquisitionClassifier.js';
import { BridgeApprovalPolicy } from '../domain/BridgeApprovalPolicy.js';
import { BridgeNotificationMapper } from '../domain/BridgeNotificationMapper.js';
import { BridgeCandidateAssembler } from '../domain/BridgeCandidateAssembler.js';
import { BridgeRecommendationBuilder } from '../domain/BridgeRecommendationBuilder.js';
import { BridgePreferenceFeedback } from '../domain/BridgePreferenceFeedback.js';
import { BridgeOutcomeEvaluator } from '../domain/BridgeOutcomeEvaluator.js';
import { BridgeComparisonBuilder } from '../domain/BridgeComparisonBuilder.js';
import type { BrainCandidatePort } from '../contracts/bridge-ports.js';
import {
  FixedClock,
  createAiWorldPort,
  createBrainPort,
  createCandidatePort,
  createExecutionPort,
  createIntelligencePort,
  createMarketplacePort,
  createPreferencePort,
  option,
} from './bridge-fixtures.js';

describe('EPIC-017 — domain branch coverage', () => {
  it('acquisition classifier: open source, open weights, local-download, manual-unknown', () => {
    const c = new AcquisitionClassifier();
    expect(c.classify(option({ name: 'os', freeClass: 'OPEN_SOURCE' })).acquisition).toBe(
      'OPEN_SOURCE',
    );
    expect(c.classify(option({ name: 'ow', freeClass: 'OPEN_WEIGHTS' })).acquisition).toBe(
      'OPEN_SOURCE',
    );
    expect(
      c.classify(option({ name: 'dl', requires: ['download', 'local_install'] })).acquisition,
    ).toBe('LOCAL_MODEL');
    expect(
      c.classify(option({ name: 'ext', requires: ['external_application'] })).acquisition,
    ).toBe('EXTERNAL_APPLICATION');
    expect(
      c.classify(option({ name: 'free', freeClass: 'FREE_API', requires: [] })).acquisition,
    ).toBe('FREE_API');
    // No evidence at all → UNKNOWN, never fabricated.
    expect(c.classify(option({ name: 'nothing' })).acquisition).toBe('UNKNOWN');
  });

  it('approval policy: sensitive-action mapping + non-sensitive passthrough', () => {
    const p = new BridgeApprovalPolicy();
    expect(p.forCandidate('FREE_WITH_QUOTA', false).required).toBe(true);
    expect(p.forCandidate('LOCAL_MODEL', false).required).toBe(true);
    expect(p.forCandidate('MANUAL', false).required).toBe(false);
    expect(p.forCandidate('UNKNOWN', false).required).toBe(false);
    expect(p.forSensitiveAction('publish').actions).toContain('publishing');
    expect(p.forSensitiveAction('deploy').actions).toContain('deployment');
    expect(p.forSensitiveAction('delete').actions).toContain('deletion');
    expect(p.forSensitiveAction('share').actions).toContain('sharing');
    expect(p.forSensitiveAction('connect_account').actions).toContain('external_app_action');
    expect(p.forSensitiveAction('read').required).toBe(false);
  });

  it('candidate assembler: configured vs configurable vs below-floor', () => {
    const a = new BridgeCandidateAssembler();
    const configured = a.assemble({
      capability: 'TEXT_GENERATION',
      qualityFloor: 60,
      option: option({ name: 'cfg', kind: 'BEST_CONFIGURED', quality: 80, requires: [] }),
      configured: true,
    });
    expect(configured.availability).toBe('AVAILABLE');
    expect(configured.approvalRequired).toBe(false);
    expect(configured.recommendation).toBe('CONSIDER');

    const belowFloor = a.assemble({
      capability: 'TEXT_GENERATION',
      qualityFloor: 80,
      option: option({ name: 'weak', quality: 40, requires: ['api_key'] }),
    });
    expect(belowFloor.recommendation).toBe('IGNORE');
    expect(belowFloor.source).toBe('provider-intelligence');

    const local = a.assemble({
      capability: 'TEXT_GENERATION',
      qualityFloor: 60,
      option: option({ name: 'local', localAvailability: 'yes' }),
    });
    expect(local.integrationType).toBe('LOCAL_MODEL');
    expect(local.source).toBe('local-model');
    expect(local.costClass).toBe('LOCAL_MODEL');
  });

  it('recommendation builder: local model kind + free/local alternatives', () => {
    const b = new BridgeRecommendationBuilder();
    const local = b.build({
      capability: 'TEXT_GENERATION',
      best: option({
        name: 'Q4',
        localAvailability: 'yes',
        requires: ['download', 'local_install'],
      }),
      now: new Date().toISOString(),
    });
    expect(local.kind).toBe('FREE_LOCAL_MODEL_AVAILABLE');
    expect(local.approvalRequired).toBe(true);

    const free = b.build({
      capability: 'TEXT_GENERATION',
      current: { name: 'Paid X', quality: 90 },
      best: option({ name: 'Free Y', freeClass: 'FREE_API', quality: 88, requires: [] }),
      freeAlternative: 'Free Y',
      localAlternative: 'Q4',
      now: new Date().toISOString(),
    });
    expect(free.kind).toBe('BETTER_CAPABILITY_FOUND');
    expect(free.approvalRequired).toBe(false);
    expect(free.freeAlternative).toBe('Free Y');
    expect(free.localAlternative).toBe('Q4');
  });

  it('notification mapper: better-capability margin below 8 is dropped', () => {
    const m = new BridgeNotificationMapper();
    const dropped = m.fromBetterCapability({
      loopId: 'l1',
      capability: 'TEXT_GENERATION',
      provider: 'P',
      quality: 85,
      currentQuality: 82,
      now: new Date().toISOString(),
    });
    expect('dropped' in dropped && dropped.dropped).toBe(true);
    const emitted = m.fromBetterCapability({
      loopId: 'l1',
      capability: 'TEXT_GENERATION',
      provider: 'P',
      quality: 96,
      currentQuality: 70,
      now: new Date().toISOString(),
    });
    expect(!('dropped' in emitted)).toBe(true);
    expect(emitted.kind).toBe('BETTER_CAPABILITY');
  });

  it('preference feedback: recency-weighted profile with decay', () => {
    const clock = new FixedClock();
    const fb = new BridgePreferenceFeedback();
    const profile = fb.taskProfile({
      loopId: 'l1',
      capability: 'CODING',
      providerId: 'a',
      now: clock.now(),
      events: [
        {
          eventId: 'e1',
          executionId: 'x',
          stepId: 's',
          source: 'explicit_user_approval',
          fact: 'f',
          provider: 'a',
          capability: 'CODING',
          reason: 'r',
          confidence: 1,
          timestamp: clock.now(),
        },
        {
          eventId: 'e2',
          executionId: 'x',
          stepId: 's',
          source: 'inferred_observation',
          fact: 'f2',
          provider: 'a',
          capability: 'CODING',
          reason: 'r2',
          confidence: 0.6,
          timestamp: clock.now(),
        },
      ] as never,
    });
    expect(profile.length).toBe(1);
    expect(profile[0].score).toBeGreaterThanOrEqual(70);
    expect(profile[0].evidenceCount).toBeGreaterThan(1);
    // Time decay: a rejection from long ago barely moves the score.
    const old = new Date(clock.timestampMs() - 40 * 24 * 3600 * 1000).toISOString();
    const decayed = fb.taskProfile({
      loopId: 'l1',
      capability: 'CODING',
      providerId: 'a',
      now: clock.now(),
      events: [
        {
          eventId: 'e1',
          executionId: 'x',
          stepId: 's',
          source: 'explicit_user_rejection',
          fact: 'f',
          provider: 'a',
          capability: 'CODING',
          reason: 'r',
          confidence: 1,
          timestamp: old,
        },
      ] as never,
    });
    expect(decayed.length).toBe(1);
    expect(decayed[0].score).toBeLessThanOrEqual(40);
  });
});

describe('EPIC-017 — service edge paths', () => {
  it('start fails honestly when the brain cannot create the task', async () => {
    const clock = new FixedClock();
    const brain = createBrainPort();
    brain.createTask = () => ({ success: false, error: 'Brain unavailable.', code: 'BRAIN_DOWN' });
    const service = new LiveIntelligenceBridgeService({
      clock,
      brain,
      intelligence: createIntelligencePort(),
      marketplace: createMarketplacePort(),
      execution: createExecutionPort(),
      candidates: createCandidatePort(),
      preference: createPreferencePort(),
      aiWorld: createAiWorldPort().port,
      loops: new InMemoryBridgeLoopStore(),
    });
    const res = await service.start('user-1', 'Create a professional blog post');
    expect(res.success).toBe(false);
    expect(res.code).toBe('BRAIN_DOWN');
  });

  it('start fails honestly when the brain cannot plan', async () => {
    const clock = new FixedClock();
    const brain = createBrainPort();
    brain.plan = async () => ({ success: false, error: 'Plan failed.', code: 'PLAN_FAILED' });
    const service = new LiveIntelligenceBridgeService({
      clock,
      brain,
      intelligence: createIntelligencePort(),
      marketplace: createMarketplacePort(),
      execution: createExecutionPort(),
      candidates: createCandidatePort(),
      preference: createPreferencePort(),
      aiWorld: createAiWorldPort().port,
      loops: new InMemoryBridgeLoopStore(),
    });
    const res = await service.start('user-1', 'Create a professional blog post');
    expect(res.success).toBe(false);
    expect(res.data).toBeUndefined();
  });

  it('discover/compare/recommend reject unknown loops (IDOR + not-found)', async () => {
    const clock = new FixedClock();
    const service = new LiveIntelligenceBridgeService({
      clock,
      brain: createBrainPort(),
      intelligence: createIntelligencePort(),
      marketplace: createMarketplacePort(),
      execution: createExecutionPort(),
      candidates: createCandidatePort(),
      preference: createPreferencePort(),
      aiWorld: createAiWorldPort().port,
      loops: new InMemoryBridgeLoopStore(),
    });
    expect((await service.discover('user-1', 'nope')).success).toBe(false);
    expect((await service.compare('user-1', 'nope')).success).toBe(false);
    expect((await service.recommend('user-1', 'nope')).success).toBe(false);
    expect((await service.approve('user-1', 'nope', 'r1')).code).toBe('NOT_FOUND');
    expect((await service.reject('user-1', 'nope', 'r1')).code).toBe('NOT_FOUND');
    expect(service.get('user-2', 'nope').success).toBe(false);
    expect(service.list('user-1').success).toBe(true);
  });

  it('handOff fails honestly when the marketplace cannot plan', async () => {
    const clock = new FixedClock();
    const marketplace = createMarketplacePort();
    marketplace.plan = async () => {
      throw new Error('marketplace down');
    };
    const service = new LiveIntelligenceBridgeService({
      clock,
      brain: createBrainPort(),
      intelligence: createIntelligencePort(),
      marketplace,
      execution: createExecutionPort(),
      candidates: createCandidatePort(),
      preference: createPreferencePort(),
      aiWorld: createAiWorldPort().port,
      loops: new InMemoryBridgeLoopStore(),
    });
    const started = await service.start('user-1', 'Create a professional blog post');
    const res = await service.handOff('user-1', started.data!.loopId);
    expect(res.success).toBe(false);
    expect(res.code).toBe('PLAN_FAILED');
  });

  it('handOff surfaces CONFIGURE gates (deep-link to existing provider screen)', async () => {
    const clock = new FixedClock();
    const execution = createExecutionPort();
    execution.start = async () => ({
      success: true,
      data: {
        ...(createExecutionPort().list('user-1').data?.[0] as never),
        status: 'CONFIGURE_REQUIRED',
        steps: [
          {
            stepId: 's1',
            title: 'Visuals',
            capability: 'IMAGE_GENERATION',
            disposition: 'CONFIGURE',
            state: 'configure_required',
            provider: 'midjourney',
            model: 'v6',
            artifacts: [],
            attempts: 0,
            retried: false,
            costUsd: 0,
            tokensUsed: 0,
            latencyMs: 0,
            updatedAt: clock.now(),
          },
        ],
      } as never,
    });
    const service = new LiveIntelligenceBridgeService({
      clock,
      brain: createBrainPort(),
      intelligence: createIntelligencePort(),
      marketplace: createMarketplacePort(),
      execution,
      candidates: createCandidatePort(),
      preference: createPreferencePort(),
      aiWorld: createAiWorldPort().port,
      loops: new InMemoryBridgeLoopStore(),
    });
    const started = await service.start('user-1', 'Create a professional blog post');
    const res = await service.handOff('user-1', started.data!.loopId);
    expect(res.success).toBe(true);
    expect(res.data!.executionHandoff?.kind).toBe('CONFIGURE');
    expect(res.data!.executionHandoff?.deepLink).toBe('/providers');
    expect(res.data!.stageStatuses.EXECUTE).toBe('blocked');
  });

  it('verify/evaluateAndLearn reject when there is no execution', async () => {
    const clock = new FixedClock();
    const service = new LiveIntelligenceBridgeService({
      clock,
      brain: createBrainPort(),
      intelligence: createIntelligencePort(),
      marketplace: createMarketplacePort(),
      execution: createExecutionPort(),
      candidates: createCandidatePort(),
      preference: createPreferencePort(),
      aiWorld: createAiWorldPort().port,
      loops: new InMemoryBridgeLoopStore(),
    });
    const started = await service.start('user-1', 'Create a professional blog post');
    const loopId = started.data!.loopId;
    expect(service.verify('user-1', loopId).code).toBe('NOT_EXECUTED');
    expect((await service.evaluateAndLearn('user-1', loopId, true)).code).toBe('NOT_EXECUTED');
  });

  it('emitNotification gates by relevance and surfaces through AI World', async () => {
    const clock = new FixedClock();
    const aiWorld = createAiWorldPort();
    const service = new LiveIntelligenceBridgeService({
      clock,
      brain: createBrainPort(),
      intelligence: createIntelligencePort(),
      marketplace: createMarketplacePort(),
      execution: createExecutionPort(),
      candidates: createCandidatePort(),
      preference: createPreferencePort(),
      aiWorld: aiWorld.port,
      loops: new InMemoryBridgeLoopStore(),
    });
    const started = await service.start('user-1', 'Create a professional blog post');
    const loopId = started.data!.loopId;
    const low = await service.emitNotification('user-1', loopId, {
      kind: 'NEW_MODEL',
      title: 'minor',
      body: 'low',
      relevance: 10,
    });
    expect(low.data && 'dropped' in low.data).toBe(true);
    const high = await service.emitNotification('user-1', loopId, {
      kind: 'NEW_MODEL',
      title: 'Major model',
      body: 'Big',
      relevance: 90,
    });
    expect(high.success).toBe(true);
    expect(aiWorld.emitted.length).toBe(1);
  });

  it('performanceProfile derives a task-specific view (reversible, no global ranking)', async () => {
    const clock = new FixedClock();
    const service = new LiveIntelligenceBridgeService({
      clock,
      brain: createBrainPort(),
      intelligence: createIntelligencePort(),
      marketplace: createMarketplacePort(),
      execution: createExecutionPort(),
      candidates: createCandidatePort(),
      preference: createPreferencePort(),
      aiWorld: createAiWorldPort().port,
      loops: new InMemoryBridgeLoopStore(),
    });
    const started = await service.start('user-1', 'Create a professional blog post');
    const loopId = started.data!.loopId;
    await service.handOff('user-1', loopId);
    await service.evaluateAndLearn('user-1', loopId, true);
    const profile = service.performanceProfile('user-1');
    expect(profile.success).toBe(true);
    expect(Array.isArray(profile.data)).toBe(true);
  });

  it('outcome evaluator: manual/configure gated steps + empty run are honest', () => {
    const clock = new FixedClock();
    const ev = new BridgeOutcomeEvaluator();
    // No steps at all → NOT_RUN validation, UNKNOWN everything.
    const empty = ev.evaluate({
      run: {
        executionId: 'e0',
        planId: 'p1',
        ownerId: 'u1',
        traceId: 't0',
        goal: 'g',
        status: 'PARTIAL',
        steps: [],
        checkpoints: [],
        handoffs: [],
        budget: {
          maxIterations: 10,
          maxTokens: 100000,
          maxCostUsd: 1,
          maxLatencyMs: 60000,
          spentTokens: 0,
          spentCostUsd: 0,
          spentLatencyMs: 0,
          iterations: 0,
          exceeded: false,
        },
        createdAt: clock.now(),
        updatedAt: clock.now(),
      },
      userApproval: 'NOT_REQUIRED',
      recommendedCapabilityUsed: false,
      evaluatedAt: clock.now(),
    });
    expect(empty.validation).toBe('NOT_RUN');
    expect(empty.quality).toBe('UNKNOWN');
    expect(empty.accuracy).toBe('UNKNOWN');

    // Manual/external/configure gates are honest hand-offs — not failures.
    const gated = ev.evaluate({
      run: {
        executionId: 'e4',
        planId: 'p1',
        ownerId: 'u1',
        traceId: 't4',
        goal: 'g',
        status: 'MANUAL_REQUIRED',
        steps: [
          {
            stepId: 's1',
            title: 'Export',
            capability: 'DEPLOYMENT',
            disposition: 'MANUAL_REQUIRED',
            state: 'manual_required',
            provider: 'canva',
            model: undefined,
            artifacts: [],
            attempts: 0,
            retried: false,
            costUsd: 0,
            tokensUsed: 0,
            latencyMs: 0,
            updatedAt: clock.now(),
          },
        ],
        checkpoints: [],
        handoffs: [],
        budget: {
          maxIterations: 10,
          maxTokens: 100000,
          maxCostUsd: 1,
          maxLatencyMs: 60000,
          spentTokens: 0,
          spentCostUsd: 0,
          spentLatencyMs: 0,
          iterations: 0,
          exceeded: false,
        },
        createdAt: clock.now(),
        updatedAt: clock.now(),
      },
      userApproval: 'NOT_REQUIRED',
      recommendedCapabilityUsed: false,
      evaluatedAt: clock.now(),
    });
    expect(gated.taskCompleted).toBe(false);
    expect(gated.failures.length).toBe(0); // gates are not failures
    expect(gated.reliability).toBe('HIGH'); // no failures/blocks
  });

  it('comparison builder: no better option → honest not-better result', () => {
    const builder = new BridgeComparisonBuilder();
    const noBetter = builder.build({
      capability: 'TEXT_GENERATION',
      qualityFloor: 60,
      result: {
        taskId: 't',
        requestedOutcome: 'o',
        options: [
          {
            kind: 'BEST_CONFIGURED',
            name: 'Current',
            capability: 'TEXT_GENERATION',
            quality: 90,
            reason: 'r',
            evidence: [],
            requires: [],
          },
        ],
        betterOptionAvailable: false,
      },
    });
    expect(noBetter.betterOptionAvailable).toBe(false);
    expect(noBetter.alternative).toBeUndefined();
    expect(noBetter.why[0]).toContain('No materially better');

    // No option at all → also honest not-better.
    const none = builder.build({
      capability: 'TEXT_GENERATION',
      qualityFloor: 60,
      result: { taskId: 't', requestedOutcome: 'o', options: [], betterOptionAvailable: true },
    });
    expect(none.betterOptionAvailable).toBe(false);
  });

  it('notification mapper: fromBetterCapability without quality evidence', () => {
    const m = new BridgeNotificationMapper();
    // No quality on either side → margin undefined → relevance floor (60).
    const emitted = m.fromBetterCapability({
      loopId: 'l1',
      capability: 'CODING',
      provider: 'P',
      now: new Date().toISOString(),
    });
    expect(!('dropped' in emitted)).toBe(true);
    expect(emitted.relevance).toBeGreaterThanOrEqual(60);
    expect(emitted.relevance).toBeLessThanOrEqual(68);
  });

  it('bridge loop store: FIFO eviction + list scoping', () => {
    const store = new InMemoryBridgeLoopStore({ maxLoopsPerOwner: 2 });
    const now = new Date().toISOString();
    const mk = (id: string, userId = 'u1') => ({
      loopId: id,
      userId,
      objective: `o-${id}`,
      status: 'NEW' as const,
      stage: 'UNDERSTAND' as const,
      stageStatuses: {},
      capabilities: [],
      candidates: [],
      comparisons: [],
      recommendations: [],
      approvals: [],
      performance: [],
      notifications: [],
      traceId: `t-${id}`,
      createdAt: now,
      updatedAt: now,
    });
    store.save(mk('a'));
    store.save(mk('b'));
    store.save(mk('c'));
    expect(store.get('u1', 'a')).toBeUndefined(); // evicted (oldest)
    expect(store.get('u1', 'b')?.loopId).toBe('b');
    expect(store.get('u1', 'c')?.loopId).toBe('c');
    expect(store.get('u2', 'b')).toBeUndefined(); // owner-scoped
    expect(store.list('u1').length).toBe(2);
    // Update keeps the same loop.
    store.save(mk('b'));
    expect(store.list('u1').length).toBe(2);
  });

  it('empty candidates produce an honest loop (no fabricated options)', async () => {
    const clock = new FixedClock();
    const emptyCandidates: BrainCandidatePort = {
      providerCandidates: async () => [],
      discoveryCandidates: async () => [],
      localModelCandidates: async () => [],
    };
    const service = new LiveIntelligenceBridgeService({
      clock,
      brain: createBrainPort(),
      intelligence: createIntelligencePort(),
      marketplace: createMarketplacePort(),
      execution: createExecutionPort(),
      candidates: emptyCandidates,
      preference: createPreferencePort(),
      aiWorld: createAiWorldPort().port,
      loops: new InMemoryBridgeLoopStore(),
    });
    const started = await service.start('user-1', 'Create a professional blog post');
    const loopId = started.data!.loopId;
    const res = await service.discover('user-1', loopId);
    expect(res.success).toBe(true);
    expect(res.data!.candidates.length).toBe(0);
    // The loop still completes honestly — the execution reports the real state.
    const handoff = await service.handOff('user-1', loopId);
    expect(handoff.success).toBe(true);
  });
});

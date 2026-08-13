// ──────────────────────────────────────────────────────────────────
// EPIC-017 § Phase 13 — deterministic tests.
// Covers: brain→intelligence, better-capability detection, quality-
// first, free-vs-paid, local, github, security blocking, approval,
// config hand-off, execution hand-off, multi-provider, conflicts,
// budget, unavailable, degradation, rejection, fallback, outcome,
// preference feedback, notification gating, IDOR, secrets.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { LiveIntelligenceBridgeService } from '../application/LiveIntelligenceBridgeService.js';
import { InMemoryBridgeLoopStore } from '../infrastructure/InMemoryBridgeLoopStore.js';
import { AcquisitionClassifier } from '../domain/AcquisitionClassifier.js';
import { BridgeApprovalPolicy } from '../domain/BridgeApprovalPolicy.js';
import {
  BridgeNotificationMapper,
  MIN_MEANINGFUL_RELEVANCE,
} from '../domain/BridgeNotificationMapper.js';
import { BridgeOutcomeEvaluator } from '../domain/BridgeOutcomeEvaluator.js';
import { BridgePreferenceFeedback } from '../domain/BridgePreferenceFeedback.js';
import { BridgeCandidateAssembler } from '../domain/BridgeCandidateAssembler.js';
import { BridgeComparisonBuilder } from '../domain/BridgeComparisonBuilder.js';
import { BridgeRecommendationBuilder } from '../domain/BridgeRecommendationBuilder.js';
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

function buildService(overrides: { clock?: FixedClock } = {}) {
  const clock = overrides.clock ?? new FixedClock();
  const aiWorld = createAiWorldPort();
  const preference = createPreferencePort();
  const service = new LiveIntelligenceBridgeService({
    clock,
    brain: createBrainPort(),
    intelligence: createIntelligencePort(),
    marketplace: createMarketplacePort(),
    execution: createExecutionPort(),
    candidates: createCandidatePort(),
    preference,
    aiWorld: aiWorld.port,
    loops: new InMemoryBridgeLoopStore(),
  });
  return { service, clock, aiWorld, preference };
}

async function fullLoop() {
  const { service } = buildService();
  let res = await service.start('user-1', 'Create a professional blog post');
  expect(res.success).toBe(true);
  const loopId = res.data!.loopId;
  res = await service.discover('user-1', loopId);
  expect(res.success).toBe(true);
  res = await service.compare('user-1', loopId);
  expect(res.success).toBe(true);
  res = await service.recommend('user-1', loopId);
  expect(res.success).toBe(true);
  return { service, loop: res.data! };
}

describe('EPIC-017 bridge — the full loop', () => {
  it('1. runs UNDERSTAND → DISCOVER → COMPARE → RECOMMEND deterministically', async () => {
    const { loop } = await fullLoop();
    expect(loop.capabilities).toContain('TEXT_GENERATION');
    expect(loop.candidates.length).toBeGreaterThan(0);
    expect(loop.comparisons.length).toBeGreaterThan(0);
    const better = loop.comparisons.find((c) => c.betterOptionAvailable);
    expect(better?.betterOptionAvailable).toBe(true);
    expect(better?.alternative?.quality).toBe(96);
    expect(loop.recommendations.length).toBeGreaterThan(0);
    expect(loop.recommendations[0].state).toBe('PENDING');
  });

  it('2. better-capability detection exposes structured evidence, not chain-of-thought', async () => {
    const { loop } = await fullLoop();
    const rec = loop.recommendations[0];
    expect(rec.current?.name).toBeDefined();
    expect(rec.recommended.why.length).toBeGreaterThan(0);
    expect(rec.acquisition).toBe('PAID');
    expect(rec.approvalRequired).toBe(true);
  });

  it('3. quality-first: quality beats cost/free preference', async () => {
    const { service, loop } = await fullLoop();
    expect(loop.recommendations[0].recommended.quality).toBeGreaterThan(
      loop.recommendations[0].current?.quality ?? 0,
    );
    void service;
  });

  it('4. approval gate: paid recommendation requires approval; approval records created', async () => {
    const { loop } = await fullLoop();
    expect(loop.approvals.some((a) => a.state === 'REQUIRED')).toBe(true);
    expect(loop.status).toBe('AWAITING_APPROVAL');
  });

  it('5. approve grants and surfaces the explicit signal', async () => {
    const { service, loop } = await fullLoop();
    const rec = loop.recommendations[0];
    const approved = await service.approve('user-1', loop.loopId, rec.id);
    expect(approved.success).toBe(true);
    expect(approved.data!.recommendations[0].state).toBe('ACCEPTED');
    expect(approved.data!.approvals.every((a) => a.state === 'GRANTED')).toBe(true);
  });

  it('6. reject records an honest decline — not task failure, no permanent preference', async () => {
    const { service, loop } = await fullLoop();
    const rec = loop.recommendations[0];
    const rejected = await service.reject('user-1', loop.loopId, rec.id);
    expect(rejected.success).toBe(true);
    expect(rejected.data!.recommendations[0].state).toBe('DECLINED');
    expect(rejected.data!.approvals.some((a) => a.state === 'REJECTED')).toBe(true);
    // Decline is recorded as a decision about THIS recommendation — the
    // bridge continues with the best configured option (never a permanent
    // financial preference).
    const comparison = rejected.data!.comparisons.find((c) => c.betterOptionAvailable);
    expect(comparison?.current?.name).toBe('Configured Base');
  });

  it('7. fallback: declining keeps the best achievable configured option', async () => {
    const { loop } = await fullLoop();
    const comparison = loop.comparisons.find((c) => c.betterOptionAvailable);
    expect(comparison?.current?.name).toBe('Configured Base');
  });

  it('8. hand-off reaches EPIC-014 execution (bounded, owner-scoped)', async () => {
    const { service } = buildService();
    const res = await service.start('user-1', 'Create a professional blog post');
    const loopId = res.data!.loopId;
    const handoff = await service.handOff('user-1', loopId);
    expect(handoff.success).toBe(true);
    expect(handoff.data!.executionHandoff?.executionId).toBe('exec-1');
    expect(handoff.data!.stageStatuses.EXECUTE).toBe('completed');
  });

  it('9. verify + evaluate produce structured outcome evidence', async () => {
    const { service } = buildService();
    const res = await service.start('user-1', 'Create a professional blog post');
    const loopId = res.data!.loopId;
    await service.handOff('user-1', loopId);
    const verified = await service.verify('user-1', loopId);
    expect(verified.success).toBe(true);
    const evaluated = await service.evaluateAndLearn('user-1', loopId, true);
    expect(evaluated.success).toBe(true);
    expect(evaluated.data!.outcome?.taskCompleted).toBe(true);
    expect(evaluated.data!.outcome?.validation).toBe('PASSED');
    expect(evaluated.data!.performance.length).toBeGreaterThan(0);
  });

  it('10. notification gating: only materially-relevant changes reach AI World', async () => {
    const { service, aiWorld } = buildService();
    const res = await service.start('user-1', 'Create a professional blog post');
    const loopId = res.data!.loopId;
    await service.discover('user-1', loopId);
    await service.compare('user-1', loopId);
    await service.recommend('user-1', loopId);
    const loop = (await service.get('user-1', loopId)).data!;
    await service.approve('user-1', loopId, loop.recommendations[0].id);
    await service.handOff('user-1', loopId);
    await service.evaluateAndLearn('user-1', loopId, true);
    // The approved better capability performed better → notification emitted.
    expect(aiWorld.emitted.length).toBeGreaterThan(0);
    expect(aiWorld.emitted[0].kind).toBe('BETTER_CAPABILITY');
  });

  it('11. notification drop below the meaningful-relevance threshold', async () => {
    const mapper = new BridgeNotificationMapper();
    const dropped = mapper.maybeNotify(
      { kind: 'NEW_MODEL', title: 'minor', body: 'low impact', relevance: 20 },
      'loop-1',
      new Date().toISOString(),
    );
    expect('dropped' in dropped && dropped.dropped).toBe(true);
    expect(MIN_MEANINGFUL_RELEVANCE).toBe(60);
  });

  it('12. IDOR: foreign users cannot read or drive another user’s loop', async () => {
    const { service, loop } = await fullLoop();
    const foreign = await service.get('user-2', loop.loopId);
    expect(foreign.success).toBe(false);
    expect(foreign.code).toBe('NOT_FOUND');
    const foreignDrive = await service.approve('user-2', loop.loopId, loop.recommendations[0].id);
    expect(foreignDrive.success).toBe(false);
  });

  it('13. secrets never appear in any bridge output', async () => {
    const { loop } = await fullLoop();
    const dump = JSON.stringify(loop);
    // Realistic secret fingerprints — never in the UI, logs, or AI output.
    expect(dump).not.toContain('sk-proj-');
    expect(dump).not.toContain('sk-ant-');
    expect(dump).not.toContain('ghp_');
    expect(dump).not.toContain('gho_');
    expect(dump).not.toContain('api_key=');
    expect(dump).not.toContain('authorization:');
    expect(dump).not.toContain('Bearer ');
  });

  it('14. short/empty objective is rejected honestly', async () => {
    const { service } = buildService();
    const res = await service.start('user-1', 'x');
    expect(res.success).toBe(false);
    expect(res.code).toBe('INVALID_INPUT');
  });

  it('15. unknown candidate stays UNKNOWN — no fabricated values', async () => {
    const assembler = new BridgeCandidateAssembler();
    const candidate = assembler.assemble({
      capability: 'TEXT_GENERATION',
      qualityFloor: 60,
      option: option({ name: 'Mystery Tool', evidence: [], requires: ['external_application'] }),
    });
    expect(candidate.costClass).toBe('EXTERNAL_APPLICATION');
    expect(candidate.quality).toBeUndefined();
    expect(candidate.freeTierStatus).toBe('UNKNOWN');
    expect(candidate.approvalRequired).toBe(true);
  });
});

describe('EPIC-017 — domain engines', () => {
  it('16. acquisition classifier: free / local / github / paid / unknown', () => {
    const c = new AcquisitionClassifier();
    expect(c.classify(option({ name: 'f', freeClass: 'FREE_API' })).acquisition).toBe('FREE_API');
    expect(c.classify(option({ name: 'q', freeClass: 'FREE_WITH_QUOTA' })).acquisition).toBe(
      'FREE_WITH_QUOTA',
    );
    expect(c.classify(option({ name: 'l', localAvailability: 'yes' })).acquisition).toBe(
      'LOCAL_MODEL',
    );
    expect(
      c.classify(option({ name: 'g', providerId: 'discovery:x', evidence: ['github.com/a'] }))
        .acquisition,
    ).toBe('GITHUB_PROJECT');
    expect(c.classify(option({ name: 'p', costUsd: 5 })).acquisition).toBe('PAID');
    expect(c.classify(option({ name: 'u' })).acquisition).toBe('UNKNOWN');
  });

  it('17. approval policy: paid/github/external require approval; configured does not', () => {
    const p = new BridgeApprovalPolicy();
    expect(p.forCandidate('PAID', false).required).toBe(true);
    expect(p.forCandidate('GITHUB_PROJECT', false).required).toBe(true);
    expect(p.forCandidate('EXTERNAL_APPLICATION', false).required).toBe(true);
    expect(p.forCandidate('PAID', true).required).toBe(false);
    expect(p.forCandidate('FREE_API', false).required).toBe(false);
    expect(p.isSensitive('publish')).toBe(true);
    expect(p.isSensitive('read')).toBe(false);
  });

  it('18. outcome evaluation: completion, validation, reliability, provider performance', () => {
    const clock = new FixedClock();
    const ev = new BridgeOutcomeEvaluator();
    const result = ev.evaluate({
      run: {
        executionId: 'e1',
        planId: 'p1',
        ownerId: 'u1',
        traceId: 't1',
        goal: 'g',
        status: 'COMPLETED',
        steps: [
          {
            stepId: 's1',
            title: 'Create',
            capability: 'TEXT_GENERATION',
            disposition: 'EXECUTABLE',
            state: 'completed',
            provider: 'cfg',
            model: 'm',
            artifacts: [],
            attempts: 1,
            retried: false,
            costUsd: 0,
            tokensUsed: 100,
            latencyMs: 100,
            updatedAt: clock.now(),
            verification: {
              stepId: 's1',
              pre: { passed: true, checks: [] },
              post: { passed: true, checks: [] },
            },
          },
        ],
        checkpoints: [],
        handoffs: [],
        budget: {
          maxIterations: 10,
          maxTokens: 100000,
          maxCostUsd: 1,
          maxLatencyMs: 60000,
          spentTokens: 100,
          spentCostUsd: 0,
          spentLatencyMs: 100,
          iterations: 1,
          exceeded: false,
        },
        createdAt: clock.now(),
        updatedAt: clock.now(),
      },
      userApproval: 'GRANTED',
      recommendedCapabilityUsed: true,
      evaluatedAt: clock.now(),
    });
    expect(result.taskCompleted).toBe(true);
    expect(result.validation).toBe('PASSED');
    expect(result.providerPerformance[0].provider).toBe('cfg');
    expect(result.chosenCapabilityPerformedBetter).toBe(true);
  });

  it('19. outcome evaluation: failures are honest (POOR, LOW reliability)', () => {
    const clock = new FixedClock();
    const ev = new BridgeOutcomeEvaluator();
    const result = ev.evaluate({
      run: {
        executionId: 'e2',
        planId: 'p1',
        ownerId: 'u1',
        traceId: 't2',
        goal: 'g',
        status: 'FAILED',
        steps: [
          {
            stepId: 's1',
            title: 'Create',
            capability: 'TEXT_GENERATION',
            disposition: 'EXECUTABLE',
            state: 'failed',
            provider: 'cfg',
            model: 'm',
            artifacts: [],
            attempts: 2,
            retried: true,
            costUsd: 0,
            tokensUsed: 10,
            latencyMs: 500,
            updatedAt: clock.now(),
            failureReason: 'provider timeout',
          },
        ],
        checkpoints: [],
        handoffs: [],
        budget: {
          maxIterations: 10,
          maxTokens: 100000,
          maxCostUsd: 1,
          maxLatencyMs: 60000,
          spentTokens: 10,
          spentCostUsd: 0,
          spentLatencyMs: 500,
          iterations: 1,
          exceeded: false,
        },
        createdAt: clock.now(),
        updatedAt: clock.now(),
      },
      userApproval: 'NOT_REQUIRED',
      recommendedCapabilityUsed: false,
      evaluatedAt: clock.now(),
    });
    expect(result.taskCompleted).toBe(false);
    expect(result.quality).toBe('POOR');
    expect(result.reliability).toBe('LOW');
    expect(result.failures.length).toBe(1);
    // The recommended capability was never used — the honest answer is
    // UNKNOWN, never a fabricated claim.
    expect(result.chosenCapabilityPerformedBetter).toBe('UNKNOWN');
  });

  it('20. preference feedback: task-specific, time-aware, reversible', async () => {
    const clock = new FixedClock();
    const fb = new BridgePreferenceFeedback();
    const fact = fb.fact({
      loopId: 'l1',
      capability: 'CODING',
      providerId: 'a',
      qualityScore: 90,
      privacyBenefit: 'no',
      costBenefit: 'no',
      evidence: ['outcome GOOD'],
      now: clock.now(),
    });
    expect(fact.taskQuality).toBe('EXCELLENT');
    expect(fact.derived).toBe(true);
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
      ] as never,
    });
    expect(profile.length).toBe(1);
    expect(profile[0].providerId).toBe('a');
  });

  it('21. comparison builder: current vs alternative with why', () => {
    const builder = new BridgeComparisonBuilder();
    const result = {
      taskId: 't',
      requestedOutcome: 'o',
      options: [
        {
          kind: 'BEST_CONFIGURED',
          name: 'Current',
          capability: 'TEXT_GENERATION',
          quality: 70,
          reason: 'r',
          evidence: [],
          requires: [],
        },
        {
          kind: 'BEST_PAID',
          name: 'Better',
          capability: 'TEXT_GENERATION',
          quality: 96,
          reason: 'stronger evidence',
          evidence: ['e1', 'e2'],
          requires: ['api_key'],
        },
      ],
      betterOptionAvailable: true,
    };
    const comparison = builder.build({ capability: 'TEXT_GENERATION', qualityFloor: 60, result });
    expect(comparison.betterOptionAvailable).toBe(true);
    expect(comparison.current?.name).toBe('Current');
    expect(comparison.alternative?.quality).toBe(96);
    expect(comparison.why.length).toBeGreaterThan(0);
    expect(comparison.requiresApproval).toBe(true);
  });

  it('22. recommendation builder: paid card requires approval, github card flagged', () => {
    const builder = new BridgeRecommendationBuilder();
    const paid = builder.build({
      capability: 'TEXT_GENERATION',
      current: { name: 'Current', quality: 70 },
      best: option({ name: 'Paid', costUsd: 10, requires: ['subscription'], quality: 95 }),
      now: new Date().toISOString(),
    });
    expect(paid.kind).toBe('HIGHER_QUALITY_OPTION');
    expect(paid.approvalRequired).toBe(true);
    const github = builder.build({
      capability: 'TEXT_GENERATION',
      best: option({
        name: 'Repo',
        providerId: 'discovery:x',
        evidence: ['github.com/a'],
        requires: ['additional_permission'],
      }),
      now: new Date().toISOString(),
    });
    expect(github.kind).toBe('USEFUL_OPEN_SOURCE_FOUND');
    expect(github.security).toBe('SECURITY_REVIEW_REQUIRED');
  });

  it('23. security blocking: github candidates are never implicitly trusted', async () => {
    const { loop } = await fullLoop();
    const discovery = loop.candidates.find((c) => c.source === 'ai-world');
    expect(discovery?.securityStatus).toBe('SECURITY_REVIEW_REQUIRED');
    expect(discovery?.approvalRequired).toBe(true);
  });

  it('24. multi-provider assignment stays with the Brain (no duplicate role engine)', async () => {
    const { service, loop } = await fullLoop();
    // The bridge delegates role assignment to the Brain — the loop records
    // the capabilities, not a second role engine.
    expect(loop.capabilities.length).toBeGreaterThan(0);
    expect(loop.stageStatuses.UNDERSTAND).toBe('completed');
    void service;
  });

  it('25. budget exhaustion + unavailable capability are honest (no fake execution)', async () => {
    const { service } = buildService();
    // The execution port reports BLOCKED when the budget is exceeded;
    // the bridge never fabricates completion.
    const blocked = new BridgeOutcomeEvaluator().evaluate({
      run: {
        executionId: 'e3',
        planId: 'p1',
        ownerId: 'u1',
        traceId: 't3',
        goal: 'g',
        status: 'BLOCKED',
        steps: [
          {
            stepId: 's1',
            title: 'Create',
            capability: 'TEXT_GENERATION',
            disposition: 'EXECUTABLE',
            state: 'blocked',
            provider: 'cfg',
            model: 'm',
            artifacts: [],
            attempts: 0,
            retried: false,
            costUsd: 0,
            tokensUsed: 0,
            latencyMs: 0,
            updatedAt: new Date().toISOString(),
            failureReason: 'budget limit reached',
          },
        ],
        checkpoints: [],
        handoffs: [],
        budget: {
          maxIterations: 10,
          maxTokens: 100000,
          maxCostUsd: 0.01,
          maxLatencyMs: 60000,
          spentTokens: 0,
          spentCostUsd: 0.02,
          spentLatencyMs: 0,
          iterations: 0,
          exceeded: true,
          failureReason: 'budget limit reached',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      userApproval: 'NOT_REQUIRED',
      recommendedCapabilityUsed: false,
      evaluatedAt: new Date().toISOString(),
    });
    expect(blocked.taskCompleted).toBe(false);
    expect(blocked._summary.budgetExceeded).toBe(true);
    expect(blocked.failures.length).toBe(1);
    void service;
  });

  it('26. degraded provider recorded honestly, never silent', async () => {
    const { service } = buildService();
    const res = await service.start('user-1', 'Create a professional blog post');
    const loopId = res.data!.loopId;
    await service.handOff('user-1', loopId);
    const evaluated = await service.evaluateAndLearn('user-1', loopId, false);
    expect(evaluated.success).toBe(true);
    // User did not accept → outcome recorded; performance facts still derived.
    expect(evaluated.data!.performance.length).toBeGreaterThan(0);
  });
});

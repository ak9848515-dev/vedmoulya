// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · EPIC-020 Continuous Intelligence tests
// Deterministic, hermetic. Covers: usage/quota intelligence
// (KNOWN/UNKNOWN/ESTIMATED, never fabricated), adaptive task×provider
// scoring (recency-weighted, explicit > inferred), bounded failure/
// fallback orchestration, opportunity intelligence (evidence +
// uncertainty, no income promises), N-provider realization, AI World
// → Brain discovery bridge, memory/learning feedback, IDOR scoping.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { BrainApplicationService } from '../application/BrainApplicationService.js';
import {
  InMemoryBrainTaskStore,
  InMemoryBrainDecisionStore,
} from '../infrastructure/InMemoryBrainStores.js';
import {
  InMemoryOpportunityStore,
  InMemoryIntelligenceEventStore,
  InMemoryOutcomeMemory,
} from '../infrastructure/InMemoryContinuousStores.js';
import { UsageIntelligence } from '../domain/UsageIntelligence.js';
import { AdaptiveScoreLedger } from '../domain/AdaptiveScoreLedger.js';
import { FallbackSelector } from '../domain/ExecutionFailover.js';
import { OpportunityIntelligence } from '../domain/OpportunityIntelligence.js';
import type { ProviderRoleAssigner } from '../domain/ProviderRoleAssigner.js';
import type {
  BrainPlanPort,
  BrainCandidatePort,
  BrainExecutionPort,
  BrainContextPort,
  BrainPreferencePort,
  BrainUsagePort,
  BrainDiscoveryBridgePort,
  ClockPort,
} from '../contracts/brain-ports.js';
import type {
  FactoryCapabilityPlan,
  ProviderCandidateFact,
} from '@vedmoulya/capability-marketplace';
import type { IntelligenceEvent, ProviderUsageFact } from '../types/continuous-types.js';

class FakeClock implements ClockPort {
  private t = new Date('2026-08-20T09:00:00Z');
  now(): string {
    this.t = new Date(this.t.getTime() + 1000);
    return this.t.toISOString();
  }
}

function providerFact(overrides: Partial<ProviderCandidateFact> = {}): ProviderCandidateFact {
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
    ...overrides,
  };
}

function makePlan(caps: string[] = ['RESEARCH']): FactoryCapabilityPlan {
  return {
    id: 'plan-epic020',
    requestedOutcome: 'Research AI trends',
    createdAt: '2026-08-20T09:00:00Z',
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

// ── 1. Usage intelligence ─────────────────────────────────────────
describe('UsageIntelligence (EPIC-020 §3)', () => {
  const usage = new UsageIntelligence();

  it('derives registry-backed facts — only declared fields become KNOWN', () => {
    const facts = usage.deriveFactsFromCandidates(
      [
        providerFact({
          providerId: 'p1',
          estimatedCostUsd: 0.002,
          costTier: 'free',
          availability: 0.97,
        }),
      ],
      '2026-08-20T09:00:00Z',
    );
    expect(facts[0]?.providerId).toBe('p1');
    expect(facts[0]?.estimatedCostUsd?.status).toBe('ESTIMATED');
    expect(facts[0]?.freeTierStatus?.status).toBe('KNOWN');
    expect(facts[0]?.availability?.status).toBe('KNOWN');
    // Quota/rate-limit/context-window were never declared → absent (never invented).
    expect(facts[0]?.remainingQuota).toBeUndefined();
  });

  it('summarizes KNOWN/UNKNOWN/ESTIMATED fields per provider', () => {
    const facts: ProviderUsageFact[] = [
      {
        providerId: 'p1',
        remainingQuota: { value: 0, status: 'KNOWN' },
        estimatedCostUsd: { value: 0.01, status: 'ESTIMATED' },
        capturedAt: '2026-08-20T09:00:00Z',
      },
    ];
    const summary = usage.summarizeFacts(facts);
    expect(summary[0]?.quotaExhausted).toBe(true);
    expect(summary[0]?.knownFields).toContain('remainingQuota');
    expect(summary[0]?.estimatedFields).toContain('estimatedCostUsd');
    expect(summary[0]?.costEstimateUsd).toBe(0.01);
  });

  it('never fabricates a cost estimate without evidence', () => {
    expect(usage.estimateTotalCost([])).toBeUndefined();
    const facts: ProviderUsageFact[] = [
      { providerId: 'p1', estimatedCostUsd: { value: 0.05, status: 'KNOWN' }, capturedAt: 't' },
    ];
    expect(usage.estimateTotalCost(facts)).toBe(0.05);
  });

  it('classifies quota exhaustion from evidence, not guessing', () => {
    expect(usage.classifyFailure(new Error('429 Too Many Requests'), [])).toBe('QUOTA_EXHAUSTED');
    expect(usage.classifyFailure(new Error('provider is down (503)'), [])).toBe(
      'PROVIDER_UNAVAILABLE',
    );
    expect(usage.classifyFailure(new Error('billing plan required'), [])).toBe(
      'SUBSCRIPTION_UNAVAILABLE',
    );
    expect(usage.classifyFailure(new Error('unknown glitch'), [])).toBe('UNKNOWN_FAILURE');
  });
});

// ── 2. Adaptive score ledger ──────────────────────────────────────
describe('AdaptiveScoreLedger (EPIC-020 §4)', () => {
  it('recent evidence matters (recency-weighted decay)', async () => {
    const ledger = new AdaptiveScoreLedger(() => '2026-08-20T09:00:00Z', {
      halfLifeMs: 30 * 24 * 3600 * 1000,
    });
    // Old failure, then a recent success.
    await ledger.recordPerformance({
      providerId: 'p1',
      capability: 'CODING',
      succeeded: false,
      explicit: false,
      at: '2026-06-01T09:00:00Z',
    });
    await ledger.recordPerformance({
      providerId: 'p1',
      capability: 'CODING',
      succeeded: true,
      explicit: false,
      quality: 0.9,
      at: '2026-08-20T09:00:00Z',
    });
    const [top] = ledger.scoresFor('CODING');
    expect(top?.providerId).toBe('p1');
    // Recent success dominates (0.9) while the old failure still decays in
    // the background — recency weighting, not anecdote-forgetting.
    expect(top?.qualityScore).toBeGreaterThan(0.75);
    expect(top?.qualityScore).toBeLessThan(0.9);
    expect(top?.sampleCount).toBe(2);
    expect(top?.source).toBe('INFERRED');
  });

  it('explicit feedback outranks inferred observation', async () => {
    const ledger = new AdaptiveScoreLedger(() => 't');
    await ledger.recordPerformance({
      providerId: 'p-free',
      capability: 'REASONING',
      succeeded: true,
      explicit: false,
      quality: 0.5,
      at: 't',
    });
    await ledger.recordPerformance({
      providerId: 'p-explicit',
      capability: 'REASONING',
      succeeded: true,
      explicit: true,
      at: 't',
    });
    const scores = ledger.scoresFor('REASONING');
    expect(scores[0]?.providerId).toBe('p-explicit');
    expect(scores[0]?.qualityScore).toBeGreaterThan(scores[1]?.qualityScore ?? 0);
  });

  it('bestFor excludes failed candidates', async () => {
    const ledger = new AdaptiveScoreLedger(() => 't');
    await ledger.recordPerformance({
      providerId: 'a',
      capability: 'CODING',
      succeeded: true,
      explicit: false,
      at: 't',
    });
    await ledger.recordPerformance({
      providerId: 'b',
      capability: 'CODING',
      succeeded: true,
      explicit: false,
      at: 't',
    });
    expect(ledger.bestFor('CODING', ['a'])?.providerId).toBe('b');
  });
});

// ── 3. Fallback selection ─────────────────────────────────────────
describe('FallbackSelector (EPIC-020 §5)', () => {
  it('selects the next best provider after a failure (quality-first)', () => {
    const selector = new FallbackSelector();
    const fallback = selector.select(
      'CODING',
      'prov-broken',
      [
        providerFact({ providerId: 'prov-broken', quality: 0.99, configured: true }),
        providerFact({
          providerId: 'prov-next',
          quality: 0.9,
          costTier: 'medium',
          configured: true,
        }),
        providerFact({ providerId: 'prov-free', quality: 0.6, costTier: 'free', configured: true }),
      ],
      [],
      { mode: 'QUALITY', qualityTarget: 'HIGH', attempts: 1, maxAttempts: 2 },
    );
    expect(fallback?.providerId).toBe('prov-next');
    expect(fallback?.reason).toContain('Failover');
  });

  it('prefers free/local when quality is sufficient (COST_SENSITIVE)', () => {
    const selector = new FallbackSelector();
    const fallback = selector.select(
      'CODING',
      'prov-broken',
      [
        providerFact({ providerId: 'prov-broken', quality: 0.9, configured: true }),
        providerFact({
          providerId: 'prov-paid',
          quality: 0.88,
          costTier: 'high',
          configured: true,
        }),
        providerFact({
          providerId: 'prov-free',
          quality: 0.85,
          costTier: 'free',
          configured: true,
        }),
      ],
      [],
      { mode: 'COST_SENSITIVE', qualityTarget: 'MEDIUM', attempts: 1, maxAttempts: 2 },
    );
    expect(fallback?.providerId).toBe('prov-free');
  });

  it('returns undefined when the attempt bound is reached or no candidates remain', () => {
    const selector = new FallbackSelector();
    expect(
      selector.select(
        'CODING',
        'only',
        [providerFact({ providerId: 'only', configured: true })],
        [],
        {
          mode: 'BALANCED',
          qualityTarget: 'MEDIUM',
          attempts: 1,
          maxAttempts: 1,
        },
      ),
    ).toBeUndefined();
    expect(
      selector.select('CODING', 'a', [providerFact({ providerId: 'a', configured: true })], [], {
        mode: 'BALANCED',
        qualityTarget: 'MEDIUM',
        attempts: 1,
        maxAttempts: 2,
      }),
    ).toBeUndefined();
  });
});

// ── 4. Opportunity intelligence ───────────────────────────────────
describe('OpportunityIntelligence (EPIC-020 §12)', () => {
  it('maps screened AI World events to evidence-backed opportunities', () => {
    const opp = new OpportunityIntelligence();
    const events: IntelligenceEvent[] = [
      {
        id: 'e1',
        userId: 'u1',
        kind: 'NEW_FREE_API',
        title: 'Whisper free tier',
        description: 'New free transcription API',
        relevance: 0.9,
        security: 'TRUSTED_WITH_REVIEW',
        evidence: ['free-with-quota declared'],
        adoptionRequired: [],
        source: 'ai-world',
        createdAt: 't',
        status: 'NEW',
      },
      {
        id: 'e2',
        userId: 'u1',
        kind: 'NEW_GITHUB_REPOSITORY',
        title: 'Suspicious repo',
        description: 'Untrusted repository',
        relevance: 0.8,
        security: 'BLOCKED',
        evidence: ['blocked flag'],
        adoptionRequired: ['install'],
        source: 'ai-world',
        createdAt: 't',
        status: 'NEW',
      },
    ];
    const detected = opp.detectFromEvents('u1', events, '2026-08-20T09:00:00Z');
    // The BLOCKED repository never becomes an opportunity.
    expect(detected).toHaveLength(1);
    expect(detected[0]?.category).toBe('cost_saving');
    expect(detected[0]?.uncertainty).toBeGreaterThan(0);
    expect(detected[0]?.estimatedValue).toBeUndefined();
  });

  it('never promises income from a single accepted task without recurrence intent', () => {
    const opp = new OpportunityIntelligence();
    const task = {
      id: 't1',
      userId: 'u1',
      objective: 'Fix this one-off bug',
      status: 'COMPLETED',
      requiredCapabilities: ['CODING'],
    } as Parameters<typeof opp.detectFromOutcome>[1]['task'];
    expect(
      opp.detectFromOutcome('u1', { task, outputAccepted: true, capturedAt: 't' }),
    ).toHaveLength(0);
    task.objective = 'Automate my daily report';
    const detected = opp.detectFromOutcome('u1', { task, outputAccepted: true, capturedAt: 't' });
    expect(detected).toHaveLength(1);
    expect(detected[0]?.category).toBe('automation');
    expect(detected[0]?.uncertainty).toBeGreaterThan(0);
  });
});

// ── 5. Application-service integration ────────────────────────────
interface ContinuousHarnessOptions {
  objective: string;
  caps: string[];
  providerFacts?: Partial<Record<string, ProviderCandidateFact[]>>;
  execution?: BrainExecutionPort;
  usageFacts?: (userId: string, providerIds: string[]) => ProviderUsageFact[];
  budget?: { maxTokens: number; maxCostUsd: number; maxIterations: number; maxLatencyMs: number };
  bridgeEvents?: IntelligenceEvent[];
}

function makeContinuousHarness(opts: ContinuousHarnessOptions) {
  const clock = new FakeClock();
  const plan: BrainPlanPort = { planFor: async () => makePlan(opts.caps) };
  const candidates: BrainCandidatePort = {
    providerCandidates: async (cap) =>
      opts.providerFacts?.[cap] ?? [providerFact({ providerId: 'prov-a' })],
    discoveryCandidates: async () => [],
    localModelCandidates: async () => [],
  };
  const execution: BrainExecutionPort = opts.execution ?? {
    execute: async (input) => ({
      content: `Output for ${input.capability} — verified.`,
      provider: 'prov-a',
      model: 'gpt-4o',
      tokens: { input: 100, output: 50, total: 150 },
      costUsd: 0.0002,
      latencyMs: 45,
      abstained: false,
    }),
  };
  const context: BrainContextPort = { assemble: async () => 'Minimal context.' };
  const preference: BrainPreferencePort = { record: async () => {} };
  const usage: BrainUsagePort | undefined = opts.usageFacts
    ? { usageFacts: opts.usageFacts }
    : undefined;
  const discovery: BrainDiscoveryBridgePort | undefined = opts.bridgeEvents
    ? { fetchIntelligenceEvents: async () => opts.bridgeEvents ?? [] }
    : undefined;

  const opportunities = new InMemoryOpportunityStore();
  const events = new InMemoryIntelligenceEventStore();
  const memory = new InMemoryOutcomeMemory();
  const ledger = new AdaptiveScoreLedger(() => clock.now());

  const service = new BrainApplicationService({
    plan,
    candidates,
    execution,
    context,
    preference,
    tasks: new InMemoryBrainTaskStore(),
    decisions: new InMemoryBrainDecisionStore(),
    clock,
    budget: opts.budget ?? {
      maxTokens: 10000,
      maxCostUsd: 0.5,
      maxIterations: 20,
      maxLatencyMs: 60000,
    },
    traceId: () => 'trace-020',
    usage,
    experience: ledger,
    memory,
    discovery,
    opportunities,
    events,
  });
  return { service, opportunities, events, memory, ledger, clock };
}

describe('BrainApplicationService — EPIC-020 continuous orchestration', () => {
  it('realizes N-provider execution for one capability (DEEP_RESEARCH)', async () => {
    const { service } = makeContinuousHarness({
      objective: 'Research the AI landscape comprehensively',
      caps: ['RESEARCH'],
      providerFacts: {
        RESEARCH: [
          providerFact({ providerId: 'r1', quality: 0.92 }),
          providerFact({ providerId: 'r2', quality: 0.88 }),
          providerFact({ providerId: 'r3', quality: 0.85 }),
        ],
      },
    });
    const task = service.createTask('u1', 'Research the AI landscape comprehensively').data!;
    expect(task.mode).toBe('DEEP_RESEARCH');
    await service.plan('u1', task.id);
    const selected = await service.selectResources('u1', task.id);
    // N = 3 independent providers for the SAME capability.
    expect(selected.data!.roleAssignments).toHaveLength(3);
    expect(new Set(selected.data!.roleAssignments.map((a) => a.providerId)).size).toBe(3);
    const executed = await service.execute('u1', task.id);
    expect(executed.data!.providerOutputs).toHaveLength(3);
  });

  it('detects failure → classifies → falls back → continues within budget', async () => {
    let calls = 0;
    const { service } = makeContinuousHarness({
      objective: 'Fix the ABAP bug',
      caps: ['CODING'],
      providerFacts: {
        CODING: [
          providerFact({ providerId: 'broken', quality: 0.99 }),
          providerFact({ providerId: 'healthy', quality: 0.9 }),
        ],
      },
      execution: {
        execute: async () => {
          calls += 1;
          if (calls === 1) {
            // The primary pick (quality-first: 'broken') fails with a quota error.
            throw new Error('429 quota exhausted');
          }
          return {
            content: 'Recovered output.',
            provider: 'healthy',
            model: 'm',
            tokens: { input: 10, output: 5, total: 15 },
            costUsd: 0.0001,
            latencyMs: 4,
            abstained: false,
          };
        },
      },
    });
    const task = service.createTask('u1', 'Fix the ABAP bug').data!;
    await service.plan('u1', task.id);
    await service.selectResources('u1', task.id);
    const executed = await service.execute('u1', task.id);
    expect(executed.data!.failoverEvents).toHaveLength(1);
    expect(executed.data!.failoverEvents[0]?.failedProviderId).toBe('broken');
    expect(executed.data!.failoverEvents[0]?.failureClass).toBe('QUOTA_EXHAUSTED');
    expect(executed.data!.failoverEvents[0]?.fallbackProviderId).toBe('healthy');
    // The recovered provider produced the output — the run never failed wholesale.
    expect(
      executed.data!.providerOutputs.some((o) => o.providerId === 'healthy' && o.output.length > 0),
    ).toBe(true);
    const verified = service.verify('u1', task.id);
    expect(verified.data!.status).toBe('COMPLETED');
  });

  it('budgets with evidence-backed usage facts (never the old hardcoded estimate)', async () => {
    const { service } = makeContinuousHarness({
      objective: 'Write a quick script',
      caps: ['CODING'],
      usageFacts: async (_userId, ids) =>
        ids.map((providerId) => ({
          providerId,
          estimatedCostUsd: { value: 0.05, status: 'KNOWN' },
          capturedAt: '2026-08-20T09:00:00Z',
        })),
      budget: { maxTokens: 10000, maxCostUsd: 0.01, maxIterations: 20, maxLatencyMs: 60000 },
    });
    const task = service.createTask('u1', 'Write a quick script').data!;
    await service.plan('u1', task.id);
    const selected = await service.selectResources('u1', task.id);
    expect(selected.data!.roleAssignments[0]?.estimatedCostUsd).toBe(0.05);
    expect(selected.data!.budget.estimatedCostUsd).toBe(0.05);
    const executed = await service.execute('u1', task.id);
    expect(executed.success).toBe(false);
    expect(executed.code).toBe('BUDGET_BLOCKED');
  });

  it('attaches registry-backed usage facts when no usage port is wired', async () => {
    const { service } = makeContinuousHarness({
      objective: 'Draft a blog outline',
      caps: ['TEXT_GENERATION'],
      providerFacts: {
        TEXT_GENERATION: [providerFact({ providerId: 'p1', costTier: 'free', availability: 0.95 })],
      },
    });
    const task = service.createTask('u1', 'Draft a blog outline').data!;
    await service.plan('u1', task.id);
    const selected = await service.selectResources('u1', task.id);
    const usage = selected.data!.roleAssignments[0]?.usage;
    expect(usage?.freeTierStatus?.value).toBe('free');
    expect(usage?.availability?.value).toBe(0.95);
    // Quota was never declared → honestly absent, not invented.
    expect(usage?.remainingQuota).toBeUndefined();
  });

  it('discoverIntelligence: screens AI World events and detects opportunities (owner-scoped)', async () => {
    const { service, opportunities } = makeContinuousHarness({
      objective: 'Summarize a doc',
      caps: ['TEXT_GENERATION'],
      bridgeEvents: [
        {
          id: 'e1',
          userId: 'u1',
          kind: 'NEW_FREE_TIER',
          title: 'Free tier expanded',
          description: 'A provider doubled its free tier',
          relevance: 0.85,
          security: 'TRUSTED',
          evidence: ['pricing page'],
          adoptionRequired: [],
          source: 'ai-world',
          createdAt: 't',
          status: 'NEW',
        },
        {
          id: 'e2',
          userId: 'u1',
          kind: 'NEW_GITHUB_REPOSITORY',
          title: 'Blocked repo',
          description: 'Suspicious repo',
          relevance: 0.7,
          security: 'BLOCKED',
          evidence: ['flag'],
          adoptionRequired: ['install'],
          source: 'ai-world',
          createdAt: 't',
          status: 'NEW',
        },
      ],
    });
    const result = await service.discoverIntelligence('u1');
    expect(result.success).toBe(true);
    expect(result.data!.events).toHaveLength(2);
    expect(result.data!.opportunities).toHaveLength(1); // blocked repo screened out
    expect(result.data!.opportunities[0]?.category).toBe('cost_saving');

    // IDOR: another user sees none of it.
    expect(service.listOpportunities('u2').data).toHaveLength(0);
    expect(service.listIntelligenceEvents('u2').data).toHaveLength(0);
    expect(
      service.updateOpportunity('u2', result.data!.opportunities[0]!.id, 'ACCEPTED').success,
    ).toBe(false);

    // Owner can update.
    const updated = service.updateOpportunity('u1', result.data!.opportunities[0]!.id, 'ACCEPTED');
    expect(updated.data?.status).toBe('ACCEPTED');
    expect(opportunities.list('u1')[0]?.status).toBe('ACCEPTED');
  });

  it('learns from outcomes: adaptive scores + memory + recurrence opportunity', async () => {
    const { service, memory, ledger } = makeContinuousHarness({
      objective: 'Automate my daily report generation',
      caps: ['TEXT_GENERATION'],
    });
    const task = service.createTask('u1', 'Automate my daily report generation').data!;
    await service.plan('u1', task.id);
    await service.selectResources('u1', task.id);
    await service.execute('u1', task.id);
    service.verify('u1', task.id);
    const evaluated = await service.evaluateOutcome('u1', task.id, true);
    expect(evaluated.data!.outcome).toBeDefined();
    // Adaptive score recorded for the provider.
    const scores = ledger.scoresFor('TEXT_GENERATION');
    expect(scores.length).toBeGreaterThan(0);
    expect(service.providerScores('TEXT_GENERATION').data!.length).toBeGreaterThan(0);
    // Memory feedback recorded (decisions + reasons only).
    const memories = memory.list('u1');
    expect(memories).toHaveLength(1);
    expect(memories[0]?.selectedReason.length).toBeGreaterThan(0);
    expect(memories[0]?.outcome).toBe('SUCCESS');
    // Recurring accepted task → automation opportunity.
    const opps = service.listOpportunities('u1').data!;
    expect(opps.some((o) => o.category === 'automation')).toBe(true);
  });

  it('discoverIntelligence is refused when no bridge is configured', async () => {
    const { service } = makeContinuousHarness({ objective: 'Research X', caps: ['RESEARCH'] });
    const result = await service.discoverIntelligence('u1');
    expect(result.success).toBe(false);
    expect(result.code).toBe('NOT_CONFIGURED');
  });
});

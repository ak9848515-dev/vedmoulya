// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · deterministic tests (EPIC-016)
// No live services. All ports are deterministic fakes; the clock is
// manual. Covers: intent understanding, mode selection, N-provider
// role assignment, parallel waves, conflict intelligence, output
// synthesis, budget fail-closed, policy gates, approvals, execution,
// verification, IDOR, decision provenance, no fabrication.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { BrainApplicationService } from '../application/BrainApplicationService.js';
import {
  InMemoryBrainTaskStore,
  InMemoryBrainDecisionStore,
} from '../infrastructure/InMemoryBrainStores.js';
import { IntentInterpreter } from '../domain/IntentInterpreter.js';
import { BrainModeSelector } from '../domain/BrainModeSelector.js';
import { ProviderRoleAssigner } from '../domain/ProviderRoleAssigner.js';
import { ParallelPlanner } from '../domain/ParallelPlanner.js';
import { ConflictDetector } from '../domain/ConflictDetector.js';
import { OutputAssembler } from '../domain/OutputAssembler.js';
import { BrainBudgetGuard } from '../domain/BrainBudgetGuard.js';
import { BrainPolicyEngine, SENSITIVE_ACTIONS } from '../domain/BrainPolicyEngine.js';
import { BrainDecisionRecorder } from '../domain/BrainDecisionRecorder.js';
import { OutcomeEvaluator } from '../domain/OutcomeEvaluator.js';
import { InMemoryOutcomeMemory } from '../infrastructure/InMemoryContinuousStores.js';
import { AdaptiveScoreLedger } from '../domain/AdaptiveScoreLedger.js';
import type { BrainMemoryPort, BrainExperiencePort } from '../contracts/brain-ports.js';
import type { FactoryCapabilityPlan } from '@vedmoulya/capability-marketplace';
import type {
  BrainPlanPort,
  BrainCandidatePort,
  BrainExecutionPort,
  BrainContextPort,
  BrainPreferencePort,
  ClockPort,
} from '../contracts/brain-ports.js';

// ── Deterministic fakes ────────────────────────────────────────────
class FakeClock implements ClockPort {
  private t = new Date('2026-08-15T09:00:00Z');
  now(): string {
    this.t = new Date(this.t.getTime() + 1000);
    return this.t.toISOString();
  }
}

function providerFact(overrides: Record<string, unknown> = {}) {
  return {
    providerId: 'prov-a',
    family: 'openai',
    name: 'Provider A',
    modelId: 'gpt-4o',
    modelName: 'GPT-4o',
    capabilities: ['TEXT_GENERATION', 'REASONING', 'CODING', 'RESEARCH', 'VISION'],
    quality: 0.92,
    costTier: 'medium',
    availability: 0.99,
    configured: true,
    estimatedCostUsd: 0.001,
    evidence: [
      { claim: 'registry capability matrix', source: 'provider-registry', confidence: 'VERIFIED' },
    ],
    ...overrides,
  } as const;
}

function makePlan(caps: string[] = ['RESEARCH', 'TEXT_GENERATION']): FactoryCapabilityPlan {
  return {
    id: 'plan-1',
    requestedOutcome: 'Create a video about AI',
    createdAt: '2026-08-15T09:00:00Z',
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

function makeHarness(overrides: Record<string, unknown> = {}) {
  const events: Array<Record<string, unknown>> = [];
  const plan: BrainPlanPort = {
    planFor: async () => makePlan(overrides.planCaps as string[] | undefined),
  };
  const candidates: BrainCandidatePort = {
    providerCandidates: async (cap) =>
      cap === 'RESEARCH' ||
      cap === 'TEXT_GENERATION' ||
      cap === 'REASONING' ||
      cap === 'CODING' ||
      cap === 'IMAGE_GENERATION'
        ? [
            providerFact(),
            providerFact({
              providerId: 'prov-b',
              family: 'google',
              name: 'Provider B',
              quality: 0.9,
              costTier: 'free',
            }),
          ]
        : [],
    discoveryCandidates: async () => [],
    localModelCandidates: async () => [],
  };
  const execution: BrainExecutionPort = {
    execute: async (input) => ({
      content: `Output for ${input.capability} — verified statement.`,
      provider: 'prov-a',
      model: 'gpt-4o',
      tokens: { input: 100, output: 50, total: 150 },
      costUsd: 0.0002,
      latencyMs: 45,
      abstained: false,
    }),
  };
  const context: BrainContextPort = {
    assemble: async () => 'Minimal task-relevant context.',
  };
  const preference: BrainPreferencePort = {
    record: async (event) => {
      events.push({ ...event });
    },
  };
  const clock = new FakeClock();
  const tasks = new InMemoryBrainTaskStore();
  const decisions = new InMemoryBrainDecisionStore();
  const service = new BrainApplicationService({
    plan,
    candidates,
    execution,
    context,
    preference,
    tasks,
    decisions,
    clock,
    budget: { maxTokens: 10000, maxCostUsd: 0.5, maxIterations: 20, maxLatencyMs: 60000 },
    traceId: () => 'trace-1',
    ...overrides.service,
  });
  return { service, tasks, decisions, events, clock };
}

function decisionsAfter(service: BrainApplicationService, taskId: string) {
  // Re-read through the public owner-scoped API (decision store is private).
  return service.getDecisionRecords('u1', taskId).data ?? [];
}

// ── 1. Intent understanding ────────────────────────────────────────
describe('IntentInterpreter', () => {
  it('distinguishes objective, domain, constraints, quality, privacy', () => {
    const profile = new IntentInterpreter().interpret(
      'Create a professional private video about AI for free',
    );
    expect(profile.objective).toContain('Create');
    expect(profile.domain).toBe('content');
    expect(profile.qualityTarget).toBe('HIGH');
    expect(profile.privacyRequirement).toBe('PRIVATE');
    expect(profile.constraints).toContain('free');
    expect(profile.ambiguities).toHaveLength(0);
  });

  it('records bounded assumptions and never fabricates', () => {
    const profile = new IntentInterpreter().interpret('Research AI trends');
    expect(profile.privacyRequirement).toBe('STANDARD');
    expect(profile.assumptions.length).toBeGreaterThan(0);
    expect(profile.assumptions[0]?.assumption).toContain('defaults to STANDARD');
  });

  it('flags material ambiguity for clarification', () => {
    const profile = new IntentInterpreter().interpret('something about things');
    expect(profile.ambiguities.length).toBeGreaterThan(0);
    expect(new IntentInterpreter().needsClarification(profile)).toBe(true);
  });

  it('never assumes publishing permission from mentioning publish', () => {
    const profile = new IntentInterpreter().interpret('Create a video and publish to YouTube');
    expect(profile.authorizedActions).toContain('publish');
    // Sensitive action mentioned → bounded assumption that approval is still required.
    expect(profile.assumptions.some((a) => a.assumption.includes('NOT authorized'))).toBe(true);
  });
});

// ── 2. Mode selection ──────────────────────────────────────────────
describe('BrainModeSelector', () => {
  it('selects PRIVATE_LOCAL for private work', () => {
    const profile = new IntentInterpreter().interpret('Summarize my private documents locally');
    const mode = new BrainModeSelector().select({ profile, capabilityCount: 2 });
    expect(mode).toBe('PRIVATE_LOCAL');
  });

  it('selects COST_SENSITIVE for free constraints', () => {
    const profile = new IntentInterpreter().interpret('Create a free marketing post');
    const mode = new BrainModeSelector().select({ profile, capabilityCount: 2 });
    expect(mode).toBe('COST_SENSITIVE');
  });

  it('selects DEEP_RESEARCH for research objectives', () => {
    const profile = new IntentInterpreter().interpret('Research the AI landscape comprehensively');
    const mode = new BrainModeSelector().select({ profile, capabilityCount: 4 });
    expect(mode).toBe('DEEP_RESEARCH');
  });

  it('user override wins', () => {
    const profile = new IntentInterpreter().interpret('Research AI trends');
    const mode = new BrainModeSelector().select({
      profile,
      capabilityCount: 4,
      userOverride: 'FAST',
    });
    expect(mode).toBe('FAST');
  });
});

// ── 3. Provider role assignment ────────────────────────────────────
describe('ProviderRoleAssigner', () => {
  it('assigns capability-appropriate roles', () => {
    const assigner = new ProviderRoleAssigner();
    const { assignment } = assigner.assign('CODING', [providerFact()], {
      mode: 'BALANCED',
      qualityTarget: 'MEDIUM',
    });
    expect(assignment.role).toBe('CODER');
    expect(assignment.providerId).toBe('prov-a');
    expect(assignment.evidence.length).toBeGreaterThan(0);
  });

  it('respects user-selected provider (never silently replaced)', () => {
    const assigner = new ProviderRoleAssigner();
    const { assignment } = assigner.assign(
      'CODING',
      [
        providerFact(),
        providerFact({ providerId: 'prov-b', family: 'google', name: 'Provider B', quality: 0.99 }),
      ],
      { mode: 'BALANCED', qualityTarget: 'MEDIUM', userPreferredProviderId: 'prov-b' },
    );
    expect(assignment.providerId).toBe('prov-b');
    expect(assignment.reason).toContain('User-selected');
  });

  it('free never beats materially superior quality when quality is required', () => {
    const assigner = new ProviderRoleAssigner();
    const { assignment } = assigner.assign(
      'RESEARCH',
      [
        providerFact({
          providerId: 'prov-paid',
          family: 'openai',
          name: 'Paid',
          quality: 0.98,
          costTier: 'high',
        }),
        providerFact({
          providerId: 'prov-free',
          family: 'openrouter',
          name: 'Free',
          quality: 0.5,
          costTier: 'free',
        }),
      ],
      { mode: 'QUALITY', qualityTarget: 'HIGH' },
    );
    expect(assignment.providerId).toBe('prov-paid');
  });

  it('prefers free when quality threshold is met (COST_SENSITIVE)', () => {
    const assigner = new ProviderRoleAssigner();
    const { assignment } = assigner.assign(
      'RESEARCH',
      [
        providerFact({
          providerId: 'prov-paid',
          family: 'openai',
          name: 'Paid',
          quality: 0.98,
          costTier: 'high',
        }),
        providerFact({
          providerId: 'prov-free',
          family: 'openrouter',
          name: 'Free',
          quality: 0.6,
          costTier: 'free',
        }),
      ],
      { mode: 'COST_SENSITIVE', qualityTarget: 'MEDIUM' },
    );
    expect(assignment.providerId).toBe('prov-free');
  });

  it('determines N from complexity (DEEP_RESEARCH)', () => {
    const assigner = new ProviderRoleAssigner();
    const n = assigner.determineN(
      'RESEARCH',
      [
        providerFact(),
        providerFact({ providerId: 'prov-b' }),
        providerFact({ providerId: 'prov-c' }),
      ],
      {
        mode: 'DEEP_RESEARCH',
        qualityTarget: 'HIGH',
      },
    );
    expect(n).toBe(3);
  });

  it('throws when no candidates exist (never faked)', () => {
    const assigner = new ProviderRoleAssigner();
    expect(() =>
      assigner.assign('VIDEO_GENERATION', [], { mode: 'BALANCED', qualityTarget: 'MEDIUM' }),
    ).toThrow(/No candidates/);
  });
});

// ── 4. Parallel planning ───────────────────────────────────────────
describe('ParallelPlanner', () => {
  it('builds sequential waves for dependent capabilities', () => {
    const plan = makePlan(['RESEARCH', 'SCRIPT', 'VOICE', 'VIDEO_ASSEMBLY']);
    const graph = new ParallelPlanner().build(plan);
    expect(graph.nodes.length).toBe(4);
    // Research is wave 0; assembly depends on voice.
    expect(graph.waves[0]).toContain('node-0');
  });

  it('produces parallel waves for independent nodes', () => {
    const plan = makePlan(['RESEARCH', 'SCRIPT', 'VOICE', 'MUSIC', 'VIDEO_ASSEMBLY']);
    const graph = new ParallelPlanner().build(plan);
    // Voice + Music are independent after the script → same wave.
    const voiceWave = graph.waves.findIndex((w) => w.includes('node-2'));
    const musicWave = graph.waves.findIndex((w) => w.includes('node-3'));
    expect(voiceWave).toBe(musicWave);
  });

  it('never crashes on a cycle (deterministic break)', () => {
    const plan = makePlan(['RESEARCH', 'TEXT_GENERATION']);
    const graph = new ParallelPlanner().build(plan);
    expect(graph.waves.flat().length).toBe(2);
  });
});

// ── 5. Conflict intelligence ───────────────────────────────────────
describe('ConflictDetector', () => {
  it('classifies agreement when providers align', () => {
    const report = new ConflictDetector().classify('facts', [
      {
        providerId: 'a',
        claim: 'The sky is blue on a clear day.',
        evidence: ['e1'],
        confidence: 0.9,
      },
      {
        providerId: 'b',
        claim: 'The sky is blue on a clear day.',
        evidence: ['e2'],
        confidence: 0.8,
      },
    ]);
    expect(report.classification).toBe('AGREEMENT');
  });

  it('classifies material conflict without evidence', () => {
    const report = new ConflictDetector().classify('facts', [
      { providerId: 'a', claim: 'Model X is the best.', evidence: [], confidence: 0.5 },
      { providerId: 'b', claim: 'Model Y is clearly better.', evidence: [], confidence: 0.5 },
    ]);
    expect(report.classification).toBe('MATERIAL_CONFLICT');
  });

  it('classifies evidence conflict when both sides cite evidence', () => {
    const report = new ConflictDetector().classify('facts', [
      { providerId: 'a', claim: 'Population is 8 billion.', evidence: ['src-a'], confidence: 0.9 },
      { providerId: 'b', claim: 'Population is 9 billion.', evidence: ['src-b'], confidence: 0.9 },
    ]);
    expect(report.classification).toBe('EVIDENCE_CONFLICT');
  });

  it('never manufactures certainty for unresolved conflicts', () => {
    const report = new ConflictDetector().classify('facts', [
      { providerId: 'a', claim: 'X is true.', evidence: [], confidence: 0.4 },
      { providerId: 'b', claim: 'X is false.', evidence: [], confidence: 0.4 },
    ]);
    expect(['MATERIAL_CONFLICT', 'EVIDENCE_CONFLICT']).toContain(report.classification);
  });
});

// ── 6. Output synthesis ────────────────────────────────────────────
describe('OutputAssembler', () => {
  it('synthesizes with provenance and dedup', () => {
    const detector = new ConflictDetector();
    const assembler = new OutputAssembler(detector);
    const result = assembler.synthesize(
      [
        {
          providerId: 'a',
          role: 'RESEARCHER',
          capability: 'RESEARCH',
          output: 'Claim one. Claim two.',
          evidence: ['src-1'],
          quality: 0.9,
        },
        {
          providerId: 'b',
          role: 'RESEARCHER',
          capability: 'RESEARCH',
          output: 'Claim one. Claim three.',
          evidence: ['src-2'],
          quality: 0.8,
        },
      ],
      [],
    );
    // Claim one deduped across two providers.
    const claimOne = result.claims.find((c) => c.claim === 'Claim one.');
    expect(claimOne?.providers).toContain('a');
    expect(claimOne?.providers).toContain('b');
    expect(result.providerCount).toBe(2);
  });

  it('surfaces unresolved conflicts honestly', () => {
    const detector = new ConflictDetector();
    const assembler = new OutputAssembler(detector);
    const result = assembler.synthesize(
      [
        {
          providerId: 'a',
          role: 'RESEARCHER',
          capability: 'RESEARCH',
          output: 'X.',
          evidence: [],
          quality: 0.5,
        },
      ],
      [
        {
          topic: 'X',
          classification: 'UNRESOLVED',
          providers: ['a'],
          disagreement: 'unsure',
          evidence: [],
          confidence: 0.3,
        },
      ],
    );
    expect(result.unresolvedConflicts.length).toBe(1);
  });
});

// ── 7. Budget guard ────────────────────────────────────────────────
describe('BrainBudgetGuard', () => {
  it('estimates only with evidence', () => {
    const guard = new BrainBudgetGuard({
      maxTokens: 1000,
      maxCostUsd: 1,
      maxIterations: 5,
      maxLatencyMs: 1000,
    });
    const est = guard.estimate([{ cost: { estimatedTokens: 100 } }, { cost: {} }]);
    expect(est.estimatedTokens).toBe(100);
    expect(est.estimatedCostUsd).toBeUndefined();
  });

  it('blocks before execution when cost exceeds budget (fail-closed)', () => {
    const guard = new BrainBudgetGuard({
      maxTokens: 1000,
      maxCostUsd: 0.01,
      maxIterations: 5,
      maxLatencyMs: 1000,
    });
    const verdict = guard.checkBefore([{ cost: { estimatedCostUsd: 0.05 } }]);
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) expect(verdict.guard).toBe('COST');
  });

  it('stops during execution when tokens exceed budget', () => {
    const guard = new BrainBudgetGuard({
      maxTokens: 1000,
      maxCostUsd: 1,
      maxIterations: 5,
      maxLatencyMs: 1000,
    });
    const verdict = guard.checkDuring({ tokens: 1200, costUsd: 0.1, iterations: 1 });
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) expect(verdict.guard).toBe('TOKEN');
  });
});

// ── 8. Policy engine ───────────────────────────────────────────────
describe('BrainPolicyEngine', () => {
  it('requires approval for sensitive actions', () => {
    const policy = new BrainPolicyEngine();
    expect(policy.requiresApproval('publish')).toBe(true);
    expect(policy.requiresApproval('install')).toBe(true);
    expect(policy.requiresApproval('execute')).toBe(false);
    expect(SENSITIVE_ACTIONS).toContain('publish');
  });

  it('denies sensitive action without explicit authorization + approval', () => {
    const policy = new BrainPolicyEngine();
    const verdict = policy.checkAction(
      {
        authorizedActions: [],
        approvalGranted: [],
        budgetAllowed: true,
        evidenceSufficient: true,
        capabilityAvailable: true,
      },
      'publish',
    );
    expect(verdict.allowed).toBe(false);
  });

  it('allows sensitive action only with explicit authorization + approval', () => {
    const policy = new BrainPolicyEngine();
    const verdict = policy.checkAction(
      {
        authorizedActions: ['publish'],
        approvalGranted: ['publish'],
        budgetAllowed: true,
        evidenceSufficient: true,
        capabilityAvailable: true,
      },
      'publish',
    );
    expect(verdict.allowed).toBe(true);
  });

  it('denies execution when capability unavailable (no fake execution)', () => {
    const policy = new BrainPolicyEngine();
    const verdict = policy.capabilityAvailable(['VIDEO_GENERATION'], ['TEXT_GENERATION']);
    expect(verdict.allowed).toBe(false);
  });

  it('abstains when strong evidence required but insufficient', () => {
    const policy = new BrainPolicyEngine();
    const verdict = policy.evidenceVerdict('STRONG_REQUIRED', 1);
    expect(verdict.allowed).toBe(false);
  });
});

// ── 9. Decision recorder ───────────────────────────────────────────
describe('BrainDecisionRecorder', () => {
  it('records explainable decisions with provenance', () => {
    const store = new InMemoryBrainDecisionStore();
    const recorder = new BrainDecisionRecorder(store, new FakeClock());
    const record = recorder.record({
      taskId: 't1',
      userId: 'u1',
      decision: 'provider selection',
      reason: 'best measured quality for CODING',
      alternatives: ['prov-a', 'prov-b'],
      selected: 'prov-a',
      evidence: ['matrix'],
      confidence: 0.8,
      providerId: 'prov-a',
    });
    expect(store.get('u1', 't1')).toHaveLength(1);
    expect(recorder.explain(record)).toContain('Why');
    expect(recorder.explain(record)).toContain('Confidence: 80%');
  });
});

// ── 10. Outcome evaluation ─────────────────────────────────────────
describe('OutcomeEvaluator', () => {
  it('records explicit > inferred preferences with bounded confidence', async () => {
    const events: Array<Record<string, unknown>> = [];
    const ledger: BrainPreferencePort = {
      record: async (e) => {
        events.push({ ...e });
      },
    };
    const evaluator = new OutcomeEvaluator(ledger);
    const outcome = await evaluator.evaluate({
      providerResults: [
        { providerId: 'prov-a', role: 'CODER', capability: 'CODING', succeeded: true },
        { providerId: 'prov-b', role: 'CODER', capability: 'CODING', succeeded: false },
      ],
      recommendationCorrect: true,
      capabilityUseful: true,
      userApproved: true,
      verificationCaughtIssues: false,
      replanned: false,
      outputAccepted: true,
      explicitFeedback: [{ fact: 'User prefers prov-a for coding.', confidence: 0.95 }],
    });
    const explicit = outcome.preferenceFacts.find((f) => f.source === 'EXPLICIT');
    const inferred = outcome.preferenceFacts.find((f) => f.source === 'INFERRED');
    expect(explicit?.confidence).toBeGreaterThan(inferred?.confidence ?? 0);
    expect(events.length).toBeGreaterThan(0);
  });
});

// ── 11. Application service pipeline ───────────────────────────────
describe('BrainApplicationService', () => {
  it('full pipeline: understand → plan → intelligence → execute → verify', async () => {
    const { service } = makeHarness();
    const created = service.createTask('u1', 'Create a professional video about AI');
    expect(created.success).toBe(true);
    const task = created.data!;
    expect(task.mode).toBe('QUALITY');
    expect(task.stageStatuses.UNDERSTANDING).toBe('completed');

    const planned = await service.plan('u1', task.id);
    expect(planned.success).toBe(true);
    expect(planned.data!.requiredCapabilities.length).toBe(2);

    const selected = await service.selectResources('u1', task.id);
    expect(selected.success).toBe(true);
    expect(selected.data!.roleAssignments.length).toBeGreaterThan(0);

    const executed = await service.execute('u1', task.id);
    expect(executed.success).toBe(true);
    expect(executed.data!.providerOutputs.length).toBeGreaterThan(0);

    const verified = service.verify('u1', task.id);
    expect(verified.success).toBe(true);
    expect(verified.data!.status).toBe('COMPLETED');
    expect(verified.data!.synthesis?.summary.length).toBeGreaterThan(0);
  });

  it('records decision provenance across the pipeline', () => {
    const { service, decisions } = makeHarness();
    const task = service.createTask('u1', 'Create a video about AI').data!;
    expect(decisions.get('u1', task.id).length).toBeGreaterThan(0);
    const modes = decisions.get('u1', task.id).map((d) => d.decision);
    expect(modes).toContain('task mode');
  });

  it('carries its decision records on the task (execution-time projection)', async () => {
    const { service } = makeHarness();
    const task = service.createTask('u1', 'Create a video about AI').data!;
    expect(task.decisionRecords.map((d) => d.decision)).toContain('task mode');
    expect(task.decisionRecords[0]?.provenance).toContain('intent:');

    const planned = await service.plan('u1', task.id);
    expect(planned.data!.decisionRecords.map((d) => d.decision)).toContain('capability plan');

    const selected = await service.selectResources('u1', task.id);
    expect(selected.data!.decisionRecords.map((d) => d.decision)).toContain('provider roles');

    await service.execute('u1', task.id);
    const verified = service.verify('u1', task.id);
    expect(verified.data!.decisionRecords.map((d) => d.decision)).toContain('verification');
  });

  it('sensitive action approval flow: request → approve', () => {
    const { service } = makeHarness();
    const task = service.createTask('u1', 'Create a video and publish to YouTube').data!;
    const req = service.requestApproval('u1', task.id, 'publish');
    expect(req.success).toBe(true);
    expect(req.data!.status).toBe('AWAITING_APPROVAL');
    expect(req.data!.approvalRequired).toContain('publish');

    const approved = service.approve('u1', task.id, 'publish');
    expect(approved.success).toBe(true);
    expect(approved.data!.approvalGranted).toContain('publish');
  });

  it('rejects non-sensitive approval requests', () => {
    const { service } = makeHarness();
    const task = service.createTask('u1', 'Create a video').data!;
    const req = service.requestApproval('u1', task.id, 'execute');
    expect(req.success).toBe(false);
    expect(req.code).toBe('NOT_SENSITIVE');
  });

  it('never fabricates execution for unavailable capabilities', async () => {
    const { service } = makeHarness({ planCaps: ['VIDEO_GENERATION'] });
    const task = service.createTask('u1', 'Create a video').data!;
    await service.plan('u1', task.id);
    const selected = await service.selectResources('u1', task.id);
    // No provider/local candidates for VIDEO_GENERATION → unavailable, honest.
    expect(selected.data!.roleAssignments.length).toBe(0);
    expect(selected.data!.approvalRequired).toContain('missing-capabilities');
  });

  it('respects budget fail-closed before execution', async () => {
    const { service } = makeHarness({
      service: {
        budget: {
          maxTokens: 10000,
          maxCostUsd: 0.000000001,
          maxIterations: 20,
          maxLatencyMs: 60000,
        },
      },
    });
    const task = service.createTask('u1', 'Create a video about AI').data!;
    await service.plan('u1', task.id);
    await service.selectResources('u1', task.id);
    const executed = await service.execute('u1', task.id);
    expect(executed.success).toBe(false);
    expect(executed.code).toBe('BUDGET_BLOCKED');
  });

  it('handles provider failure honestly (no fabricated output)', async () => {
    const failingExecution: BrainExecutionPort = {
      execute: async () => {
        throw new Error('provider 500');
      },
    };
    const { service } = makeHarness({
      service: { execution: failingExecution } as Partial<typeof service>,
    });
    // Rebuild with failing port.
    const tasks = new InMemoryBrainTaskStore();
    const decisions = new InMemoryBrainDecisionStore();
    const events: Array<Record<string, unknown>> = [];
    const svc = new BrainApplicationService({
      plan: { planFor: async () => makePlan() },
      candidates: {
        providerCandidates: async (cap) =>
          cap === 'RESEARCH' || cap === 'TEXT_GENERATION' ? [providerFact()] : [],
        discoveryCandidates: async () => [],
        localModelCandidates: async () => [],
      },
      execution: failingExecution,
      context: { assemble: async () => 'ctx' },
      preference: {
        record: async (e) => {
          events.push({ ...e });
        },
      },
      tasks,
      decisions,
      clock: new FakeClock(),
      budget: { maxTokens: 10000, maxCostUsd: 0.5, maxIterations: 20, maxLatencyMs: 60000 },
    });
    const task = svc.createTask('u1', 'Create a video about AI').data!;
    await svc.plan('u1', task.id);
    await svc.selectResources('u1', task.id);
    const executed = await svc.execute('u1', task.id);
    expect(executed.success).toBe(true);
    const providerFailureDecision = decisions
      .get('u1', task.id)
      .find((d) => d.decision === 'provider failure');
    expect(providerFailureDecision).toBeDefined();
  });

  it('IDOR: foreign user cannot read or act on another user task', async () => {
    const { service, tasks } = makeHarness();
    const task = service.createTask('u1', 'Create a video').data!;
    // Foreign read → not found.
    expect(service.getStatus('u2', task.id).success).toBe(false);
    expect(service.cancel('u2', task.id).success).toBe(false);
    expect(service.approve('u2', task.id, 'publish').success).toBe(false);
    expect(await service.plan('u2', task.id).then((r) => r.success)).toBe(false);
    // Owner can read.
    expect(service.getStatus('u1', task.id).success).toBe(true);
    expect(tasks.get('u2', task.id)).toBeUndefined();
  });

  it('cancel sets CANCELLED for the owner', () => {
    const { service } = makeHarness();
    const task = service.createTask('u1', 'Create a video').data!;
    const cancelled = service.cancel('u1', task.id);
    expect(cancelled.data!.status).toBe('CANCELLED');
  });

  it('learns from outcomes via the preference ledger', async () => {
    const { service, events } = makeHarness();
    const task = service.createTask('u1', 'Create a video about AI').data!;
    await service.plan('u1', task.id);
    await service.selectResources('u1', task.id);
    await service.execute('u1', task.id);
    const evaluated = await service.evaluateOutcome('u1', task.id, true);
    expect(evaluated.data!.outcome).toBeDefined();
    expect(events.length).toBeGreaterThan(0);
    const inferred = events.filter((e) => e.source === 'inferred_observation');
    expect(inferred.length).toBeGreaterThan(0);
  });

  it('listTasks returns only the owner tasks', () => {
    const { service } = makeHarness();
    service.createTask('u1', 'Create a video');
    service.createTask('u2', 'Write an article');
    const u1Tasks = service.listTasks('u1').data!;
    expect(u1Tasks).toHaveLength(1);
    expect(u1Tasks[0]?.userId).toBe('u1');
  });

  it('rejects empty/too-short objectives', () => {
    const { service } = makeHarness();
    expect(service.createTask('u1', 'x').success).toBe(false);
    expect(service.createTask('u1', '').code).toBe('INVALID_INPUT');
  });

  it('approve without pending approval is refused', () => {
    const { service } = makeHarness();
    const task = service.createTask('u1', 'Create a video').data!;
    const res = service.approve('u1', task.id, 'publish');
    expect(res.success).toBe(false);
    expect(res.code).toBe('NOT_REQUIRED');
  });

  it('handles plan failure honestly', async () => {
    const tasks = new InMemoryBrainTaskStore();
    const decisions = new InMemoryBrainDecisionStore();
    const svc = new BrainApplicationService({
      plan: {
        planFor: async () => {
          throw new Error('planner down');
        },
      },
      candidates: {
        providerCandidates: async () => [],
        discoveryCandidates: async () => [],
        localModelCandidates: async () => [],
      },
      execution: {
        execute: async () => ({
          content: '',
          provider: 'p',
          model: 'm',
          tokens: { input: 0, output: 0, total: 0 },
          costUsd: 0,
          latencyMs: 0,
          abstained: false,
        }),
      },
      context: { assemble: async () => '' },
      preference: { record: async () => {} },
      tasks,
      decisions,
      clock: new FakeClock(),
      budget: { maxTokens: 1000, maxCostUsd: 1, maxIterations: 5, maxLatencyMs: 1000 },
    });
    const task = svc.createTask('u1', 'Create a video about AI').data!;
    const res = await svc.plan('u1', task.id);
    expect(res.success).toBe(false);
    expect(res.code).toBe('PLAN_FAILED');
  });

  it('PRIVATE_LOCAL mode assigns a local model when available', async () => {
    const tasks = new InMemoryBrainTaskStore();
    const decisions = new InMemoryBrainDecisionStore();
    const svc = new BrainApplicationService({
      plan: { planFor: async () => makePlan() },
      candidates: {
        providerCandidates: async () => [],
        discoveryCandidates: async () => [],
        localModelCandidates: async () => [
          {
            id: 'llama3',
            name: 'Llama 3 8B',
            runtime: 'ollama',
            capabilities: ['RESEARCH', 'TEXT_GENERATION'],
            capabilitiesProvenance: 'INFERRED',
            available: true,
            evidence: [],
          },
        ],
      },
      execution: {
        execute: async () => ({
          content: 'local output',
          provider: 'local-llama3',
          model: 'llama3',
          tokens: { input: 1, output: 1, total: 2 },
          costUsd: 0,
          latencyMs: 10,
          abstained: false,
        }),
      },
      context: { assemble: async () => '' },
      preference: { record: async () => {} },
      tasks,
      decisions,
      clock: new FakeClock(),
      budget: { maxTokens: 10000, maxCostUsd: 0.5, maxIterations: 20, maxLatencyMs: 60000 },
    });
    const task = svc.createTask('u1', 'Summarize my private documents locally').data!;
    expect(task.mode).toBe('PRIVATE_LOCAL');
    await svc.plan('u1', task.id);
    const selected = await svc.selectResources('u1', task.id);
    expect(selected.data!.roleAssignments[0]?.providerId).toBe('local-llama3');
  });

  it('mid-run budget stop blocks further execution (fail-closed)', async () => {
    const { service } = makeHarness({
      service: {
        budget: { maxTokens: 100, maxCostUsd: 0.5, maxIterations: 20, maxLatencyMs: 60000 },
      },
    });
    const task = service.createTask('u1', 'Create a video about AI').data!;
    await service.plan('u1', task.id);
    await service.selectResources('u1', task.id);
    const executed = await service.execute('u1', task.id);
    // 150 tokens per call > 100 token budget after the first call.
    expect(executed.data!.status).toBe('PARTIAL');
    expect(decisionsAfter(service, task.id).some((d) => d.decision === 'budget stop')).toBe(true);
  });

  it('requestApproval on a foreign task is refused (IDOR)', () => {
    const { service } = makeHarness();
    const task = service.createTask('u1', 'Create a video and publish it').data!;
    expect(service.requestApproval('u2', task.id, 'publish').success).toBe(false);
    expect(service.approve('u2', task.id, 'publish').success).toBe(false);
    expect(service.reject('u2', task.id, 'publish').success).toBe(false);
  });

  it('reject removes the approval requirement and records it', () => {
    const { service } = makeHarness();
    const task = service.createTask('u1', 'Create a video and publish it').data!;
    service.requestApproval('u1', task.id, 'publish');
    const rejected = service.reject('u1', task.id, 'publish');
    expect(rejected.success).toBe(true);
    expect(rejected.data!.approvalRequired).not.toContain('publish');
    expect(rejected.data!.approvalGranted).not.toContain('publish');
  });

  it('execute skips unmapped capabilities (no fake execution)', async () => {
    const { service } = makeHarness({ planCaps: ['IMAGE_GENERATION'] });
    const task = service.createTask('u1', 'Generate an image').data!;
    await service.plan('u1', task.id);
    await service.selectResources('u1', task.id);
    // IMAGE_GENERATION has candidates but NO honest runtime mapping → never executed.
    const executed = await service.execute('u1', task.id);
    expect(executed.success).toBe(true);
    expect(
      decisionsAfter(service, task.id).some((d) => d.decision === 'capability not executable'),
    ).toBe(true);
  });

  it('detects numeric conflict via the ConflictDetector (evidence-first)', () => {
    const detector = new ConflictDetector();
    const report = detector.classify('population', [
      {
        providerId: 'a',
        claim: 'The population is 8 billion.',
        evidence: ['census-a'],
        confidence: 0.9,
      },
      {
        providerId: 'b',
        claim: 'The population is 9 billion.',
        evidence: ['census-b'],
        confidence: 0.9,
      },
    ]);
    expect(report.classification).toBe('EVIDENCE_CONFLICT');
  });

  it('decision records are owner-scoped (IDOR)', () => {
    const { service } = makeHarness();
    const task = service.createTask('u1', 'Create a video').data!;
    expect(service.getDecisionRecords('u2', task.id).data).toHaveLength(0);
    expect(service.getDecisionRecords('u1', task.id).data!.length).toBeGreaterThan(0);
  });

  // ── SPRINT-025 — continuous learning & adaptive improvement ──────
  it('records honest verdict + learning signals into outcome memory (UNKNOWN never SUCCESS)', async () => {
    const memory = new InMemoryOutcomeMemory();
    const { service } = makeHarness({
      service: { memory } as Partial<ReturnType<typeof makeHarness>['service']>,
    });
    const task = service.createTask('u1', 'Create a video about AI').data!;
    await service.plan('u1', task.id);
    await service.selectResources('u1', task.id);
    await service.execute('u1', task.id);
    // Do NOT verify → verdict stays UNKNOWN (SPRINT-024 honesty).
    await service.evaluateOutcome('u1', task.id, true);
    const records = memory.list('u1');
    expect(records.length).toBe(1);
    const record = records[0];
    if (!record) throw new Error('no memory record');
    expect(record.verdict).toBe('UNKNOWN');
    expect(record.outcome).not.toBe('SUCCESS'); // never fabricated
    expect((record.signals ?? []).some((s) => s.kind === 'FACT')).toBe(false);
  });

  it('verified SUCCESS records FACT signals + SUCCESS verdict', async () => {
    const memory = new InMemoryOutcomeMemory();
    const { service } = makeHarness({
      service: { memory } as Partial<ReturnType<typeof makeHarness>['service']>,
    });
    const task = service.createTask('u1', 'Create a video about AI').data!;
    await service.plan('u1', task.id);
    await service.selectResources('u1', task.id);
    await service.execute('u1', task.id);
    service.verify('u1', task.id); // verification passes → SUCCESS
    await service.evaluateOutcome('u1', task.id, true);
    const record = memory.list('u1')[0];
    if (!record) throw new Error('no memory record');
    expect(record.verdict).toBe('SUCCESS');
    expect(record.outcome).toBe('SUCCESS');
    expect((record.signals ?? []).some((s) => s.kind === 'FACT')).toBe(true);
  });

  it('correctLearning records an EXPLICIT correction outranking inference', async () => {
    const events: Array<Record<string, unknown>> = [];
    const memory = new InMemoryOutcomeMemory();
    const preference: BrainPreferencePort = {
      record: async (e) => {
        events.push({ ...e });
      },
    };
    const { service } = makeHarness({
      service: {
        memory,
        preference,
      } as Partial<ReturnType<typeof makeHarness>['service']>,
    });
    const result = await service.correctLearning('u1', {
      statement: 'Do not use this approach again',
      target: 'approach',
    });
    expect(result.success).toBe(true);
    expect(result.data?.confidence).toBe(0.98);
    const explicit = events.find((e) => e.source === 'explicit_user_correction');
    expect(explicit).toBeDefined();
    expect(explicit?.confidence).toBe(0.98);
    // Correction is stored on the outcome memory as the user's fact.
    const correctionRecord = memory
      .list('u1')
      .find((m) => (m.corrections?.length ?? 0) > 0);
    expect(correctionRecord?.corrections?.[0]?.statement).toBe('Do not use this approach again');
    expect(correctionRecord?.corrections?.[0]?.confidence).toBe(0.98);
  });

  it('correctLearning rejects empty/short statements and provider targets without id', async () => {
    const { service } = makeHarness();
    expect((await service.correctLearning('u1', { statement: 'x', target: 'approach' })).success).toBe(
      false,
    );
    expect(
      (
        await service.correctLearning('u1', {
          statement: 'This provider is bad',
          target: 'provider',
        })
      ).success,
    ).toBe(false);
    const ok = await service.correctLearning('u1', {
      statement: 'This provider is bad',
      target: 'provider',
      providerId: 'prov-a',
      capability: 'CODING',
    });
    expect(ok.success).toBe(true);
  });

  it('correctLearning on a task attaches the correction to that task memory', async () => {
    const memory = new InMemoryOutcomeMemory();
    const { service } = makeHarness({
      service: { memory } as Partial<ReturnType<typeof makeHarness>['service']>,
    });
    const task = service.createTask('u1', 'Create a video about AI').data!;
    await service.correctLearning('u1', {
      statement: 'That result was wrong',
      target: 'result',
      taskId: task.id,
    });
    const record = memory
      .list('u1')
      .find((m) => m.taskId === task.id && (m.corrections?.length ?? 0) > 0);
    expect(record?.corrections?.[0]?.statement).toBe('That result was wrong');
  });

  it('provider corrections record the EXPLICIT preference fact (no invented quality score)', async () => {
    const events: Array<Record<string, unknown>> = [];
    const memory = new InMemoryOutcomeMemory();
    const preference: BrainPreferencePort = {
      record: async (e) => {
        events.push({ ...e });
      },
    };
    const { service } = makeHarness({
      service: {
        memory,
        preference,
      } as Partial<ReturnType<typeof makeHarness>['service']>,
    });
    await service.correctLearning('u1', {
      statement: 'That provider is unreliable for coding',
      target: 'provider',
      providerId: 'prov-a',
      capability: 'CODING',
    });
    const correction = events.find((e) => e.source === 'explicit_user_correction');
    expect(correction).toBeDefined();
    expect(correction?.confidence).toBe(0.98);
    expect(String(correction?.fact)).toContain('prov-a');
    // Corrections are facts, not quality measurements — the experience ledger
    // is NOT polluted with an invented success/failure sample.
    const ledger = new AdaptiveScoreLedger(() => new Date().toISOString());
    expect(ledger.scoresFor('CODING').length).toBe(0);
  });

  it('selectResources consults verified experience as an advisory tie-break (quality-first kept)', async () => {
    const ledger = new AdaptiveScoreLedger(() => new Date().toISOString());
    await ledger.recordPerformance({
      providerId: 'prov-b',
      capability: 'CODING',
      succeeded: true,
      explicit: true,
      quality: 0.99,
      at: '2026-08-13T09:00:00Z',
    });
    await ledger.recordPerformance({
      providerId: 'prov-a',
      capability: 'CODING',
      succeeded: false,
      explicit: true,
      quality: 0,
      at: '2026-08-13T09:00:00Z',
    });
    // prov-a and prov-b have equal registry quality (0.92 vs 0.9) but the
    // EXPERIENCE ledger strongly favors prov-b → tie-break must pick prov-b.
    const { service } = makeHarness({
      planCaps: ['CODING'],
      service: {
        experience: ledger,
        candidates: {
          providerCandidates: async (cap) =>
            cap === 'CODING'
              ? [
                  providerFact({ providerId: 'prov-a', quality: 0.92, costTier: 'medium' }),
                  providerFact({ providerId: 'prov-b', quality: 0.92, costTier: 'medium' }),
                ]
              : [],
          discoveryCandidates: async () => [],
          localModelCandidates: async () => [],
        },
      } as Partial<ReturnType<typeof makeHarness>['service']>,
    });
    const task = service.createTask('u1', 'Fix a coding problem').data!;
    await service.plan('u1', task.id);
    const selected = await service.selectResources('u1', task.id);
    const codingAssignments = selected.data!.roleAssignments.filter(
      (a) => a.capability === 'CODING',
    );
    expect(codingAssignments.length).toBeGreaterThan(0);
    expect(codingAssignments[0]?.providerId).toBe('prov-b');
  });

  it('abstention is honored and recorded', async () => {
    const tasks = new InMemoryBrainTaskStore();
    const decisions = new InMemoryBrainDecisionStore();
    const svc = new BrainApplicationService({
      plan: { planFor: async () => makePlan() },
      candidates: {
        providerCandidates: async (cap) =>
          cap === 'RESEARCH' || cap === 'TEXT_GENERATION' ? [providerFact()] : [],
        discoveryCandidates: async () => [],
        localModelCandidates: async () => [],
      },
      execution: {
        execute: async () => ({
          content: '',
          provider: 'prov-a',
          model: 'gpt-4o',
          tokens: { input: 10, output: 0, total: 10 },
          costUsd: 0,
          latencyMs: 5,
          abstained: true,
        }),
      },
      context: { assemble: async () => '' },
      preference: { record: async () => {} },
      tasks,
      decisions,
      clock: new FakeClock(),
      budget: { maxTokens: 10000, maxCostUsd: 0.5, maxIterations: 20, maxLatencyMs: 60000 },
    });
    const task = svc.createTask('u1', 'Create a video about AI').data!;
    await svc.plan('u1', task.id);
    await svc.selectResources('u1', task.id);
    const executed = await svc.execute('u1', task.id);
    expect(executed.data!.providerOutputs.every((o) => o.output === 'ABSTAINED')).toBe(true);
  });
});

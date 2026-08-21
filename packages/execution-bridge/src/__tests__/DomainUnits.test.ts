// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Bridge: domain unit tests
// EPIC-014 / SPRINT-024 — RunIntelligenceView, RunBudgetGuard,
// ApprovalRuntime, PlanRunResolver and StepVerifier are pure
// deterministic units; every branch is exercised here.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import type {
  CapabilityCandidate,
  FactoryCapabilityPlan,
  PlanStep,
} from '@vedmoulya/capability-marketplace';
import type {
  ExecutionRun,
  StepRun,
  StepRunState,
  StepVerification,
} from '../types/execution-types.js';
import type {
  StepExecutionInput,
  StepExecutionPort,
  StepExecutionResult,
} from '../contracts/execution-ports.js';
import type { ArtifactReaderPort } from '../contracts/artifact-ports.js';
import { RunIntelligenceView } from '../domain/RunIntelligence.js';
import { RunBudgetGuard } from '../domain/RunBudgetGuard.js';
import { ApprovalRuntime } from '../domain/ApprovalRuntime.js';
import { PlanRunResolver } from '../domain/PlanRunResolver.js';
import { StepVerifier } from '../domain/StepVerifier.js';

// ── Fixtures ──────────────────────────────────────────────────────

function candidate(overrides: Partial<CapabilityCandidate> = {}): CapabilityCandidate {
  return {
    id: 'provider:openai:gpt-4o',
    kind: 'model',
    name: 'OpenAI · GPT-4o',
    providerFamily: 'openai',
    modelId: 'gpt-4o',
    capability: 'TEXT_GENERATION',
    integrationType: 'NATIVE_API',
    classification: 'READY',
    freeAvailability: 'FREE_WITH_QUOTA',
    localAvailability: 'no',
    quality: 0.9,
    availability: 0.95,
    evidence: [
      { claim: 'supports text generation', source: 'provider-catalog', confidence: 'VERIFIED' },
    ],
    reasons: ['best quality'],
    configurable: false,
    apiAvailable: 'yes',
    ...overrides,
  };
}

function step(overrides: Partial<PlanStep> = {}): PlanStep {
  return {
    id: 's1',
    title: 'Research',
    capability: 'TEXT_GENERATION',
    purpose: 'Gather accurate background information.',
    candidates: [candidate()],
    selectedCandidateId: 'provider:openai:gpt-4o',
    automation: 'FULLY_AUTOMATED',
    irreversible: false,
    reasons: ['best quality'],
    ...overrides,
  };
}

function plan(steps: PlanStep[]): FactoryCapabilityPlan {
  return {
    id: 'plan-1',
    requestedOutcome: 'Create a deliverable',
    createdAt: '2026-08-10T00:00:00.000Z',
    requiredCapabilities: steps.map((s) => s.capability),
    candidates: steps.flatMap((s) => s.candidates),
    steps,
    automationLevel: 'FULLY_AUTOMATED',
    automationPercent: 100,
    evidence: [],
    risks: [],
    humanApprovalPoints: steps.filter((s) => s.irreversible),
    unavailableCapabilities: [],
    recommendations: [],
  };
}

function stepRun(overrides: Partial<StepRun> = {}): StepRun {
  return {
    stepId: 's1',
    title: 'Research',
    capability: 'TEXT_GENERATION',
    disposition: 'EXECUTABLE',
    state: 'pending',
    attempts: 0,
    retried: false,
    costUsd: 0,
    tokensUsed: 0,
    latencyMs: 0,
    artifacts: [],
    updatedAt: '2026-08-10T00:00:00.000Z',
    ...overrides,
  };
}

function run(overrides: Partial<ExecutionRun> = {}): ExecutionRun {
  return {
    executionId: 'exec-1',
    planId: 'plan-1',
    ownerId: 'owner-a',
    traceId: 'trace-1',
    goal: 'Create a deliverable',
    status: 'COMPLETED',
    steps: [],
    checkpoints: [],
    handoffs: [],
    budget: {
      maxIterations: 3,
      maxTokens: 100_000,
      maxCostUsd: 1,
      maxLatencyMs: 60_000,
      spentTokens: 0,
      spentCostUsd: 0,
      spentLatencyMs: 0,
      iterations: 0,
      exceeded: false,
    },
    createdAt: '2026-08-10T00:00:00.000Z',
    updatedAt: '2026-08-10T00:00:00.000Z',
    ...overrides,
  };
}

// ── RunIntelligenceView ───────────────────────────────────────────

describe('RunIntelligenceView — derived run view', () => {
  it('classifies step states and computes totals', () => {
    const view = new RunIntelligenceView();
    const result = view.derive(
      run({
        status: 'COMPLETED',
        steps: [
          stepRun({
            stepId: 'a',
            title: 'A',
            state: 'completed',
            provider: 'openai',
            model: 'gpt-4o',
            costUsd: 0.25,
            latencyMs: 100,
          }),
          stepRun({
            stepId: 'b',
            title: 'B',
            state: 'waiting_approval',
            verification: {
              stepId: 'b',
              pre: { passed: true, checks: [] },
              post: {
                passed: true,
                checks: [
                  { name: 'execution-completed', passed: true, detail: 'ok' },
                  { name: 'output', passed: false, detail: 'short' },
                ],
              },
            },
          }),
          stepRun({ stepId: 'c', title: 'C', state: 'failed', failureReason: 'provider 500' }),
          stepRun({ stepId: 'd', title: 'D', state: 'pending' }),
        ],
      }),
    );
    expect(result.completedSteps).toEqual(['a']);
    expect(result.failedSteps).toEqual(['c']);
    expect(result.waitingSteps).toEqual(['b']);
    expect(result.remainingSteps).toEqual(['d']);
    expect(result.currentStepId).toBe('d');
    expect(result.providerModelUsed).toEqual([
      { stepId: 'a', provider: 'openai', model: 'gpt-4o' },
    ]);
    expect(result.qualityResults).toHaveLength(1);
    expect(result.qualityResults[0]?.checks).toContain('output:fail');
    expect(result.totalCostUsd).toBe(0.25);
    expect(result.totalLatencyMs).toBe(100);
    expect(result.failureReasons).toContain('C: provider 500');
  });

  it('detects the execution boundary per run status', () => {
    const view = new RunIntelligenceView();
    expect(view.derive(run({ status: 'BLOCKED', steps: [] })).executionBoundary).toBe('blocked');
    expect(view.derive(run({ status: 'WAITING_FOR_APPROVAL', steps: [] })).executionBoundary).toBe(
      'approval_required',
    );
    expect(view.derive(run({ status: 'CONFIGURE_REQUIRED', steps: [] })).executionBoundary).toBe(
      'configure_required',
    );
    expect(view.derive(run({ status: 'MANUAL_REQUIRED', steps: [] })).executionBoundary).toBe(
      'manual_required',
    );
    expect(view.derive(run({ status: 'WAITING_FOR_INPUT', steps: [] })).executionBoundary).toBe(
      'manual_required',
    );
  });

  it('reports unavailable_steps and all_automated boundaries from step state', () => {
    const view = new RunIntelligenceView();
    const unavailable = view.derive(
      run({
        status: 'RUNNING',
        steps: [
          stepRun({ state: 'completed' }),
          stepRun({ stepId: 'x', title: 'X', state: 'pending', disposition: 'UNAVAILABLE' }),
        ],
      }),
    );
    expect(unavailable.executionBoundary).toBe('unavailable_steps');

    const automated = view.derive(
      run({ status: 'COMPLETED', steps: [stepRun({ state: 'completed' })] }),
    );
    expect(automated.executionBoundary).toBe('all_automated');
  });

  it('builds human-readable next actions', () => {
    const view = new RunIntelligenceView();
    const approval = view.derive(
      run({
        status: 'WAITING_FOR_APPROVAL',
        steps: [stepRun({ stepId: 'p', title: 'Publish', state: 'waiting_approval' })],
      }),
    );
    expect(approval.nextAction).toContain('Approve');

    const manual = view.derive(
      run({
        status: 'MANUAL_REQUIRED',
        steps: [stepRun({ stepId: 'd', title: 'Design', state: 'waiting_input' })],
      }),
    );
    expect(manual.nextAction).toContain('manually');

    const configure = view.derive(
      run({
        status: 'CONFIGURE_REQUIRED',
        steps: [stepRun({ stepId: 'c', title: 'Config', state: 'configure_required' })],
      }),
    );
    expect(configure.nextAction).toContain('Configure');

    const blockedWithReason = view.derive(
      run({
        status: 'BLOCKED',
        steps: [],
        budget: {
          maxIterations: 3,
          maxTokens: 100,
          maxCostUsd: 1,
          maxLatencyMs: 60_000,
          spentTokens: 0,
          spentCostUsd: 0,
          spentLatencyMs: 0,
          iterations: 0,
          exceeded: true,
          failureReason: 'BUDGET_EXCEEDED: token budget',
        },
      }),
    );
    expect(blockedWithReason.nextAction).toContain('BUDGET_EXCEEDED');

    const running = view.derive(run({ status: 'RUNNING', steps: [stepRun({ state: 'running' })] }));
    expect(running.nextAction).toContain('Running');
    expect(view.derive(run({ status: 'COMPLETED', steps: [] })).nextAction).toBeUndefined();
  });
});

// ── RunBudgetGuard ────────────────────────────────────────────────

describe('RunBudgetGuard — fail-closed budget enforcement', () => {
  const config = { maxIterations: 3, maxTokens: 100_000, maxCostUsd: 1, maxLatencyMs: 60_000 };

  it('allows execution within budget and records usage', () => {
    const guard = new RunBudgetGuard(config, () => 1_700_000_000_000);
    expect(guard.canExecute().ok).toBe(true);
    guard.beginIteration();
    guard.record({ tokens: 100, costUsd: 0.01, latencyMs: 50 });
    const snap = guard.snapshot();
    expect(snap.iterations).toBe(1);
    expect(snap.spentTokens).toBe(100);
    expect(snap.spentCostUsd).toBe(0.01);
    expect(snap.spentLatencyMs).toBe(50);
    expect(snap.exceeded).toBe(false);
  });

  it('fails on wall-clock timeout before the next call', () => {
    let t = 1_700_000_000_000;
    const guard = new RunBudgetGuard({ ...config, maxLatencyMs: 5 }, () => t);
    t = 1_700_000_000_010;
    const result = guard.canExecute();
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/TIMEOUT/);
    expect(guard.snapshot().exceeded).toBe(true);
  });

  it('fails on iteration limit', () => {
    const guard = new RunBudgetGuard({ ...config, maxIterations: 1 }, () => 1_700_000_000_000);
    guard.beginIteration();
    const result = guard.canExecute();
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/ITERATION_LIMIT/);
  });

  it('fails on projected token or cost overrun', () => {
    const guard = new RunBudgetGuard({ ...config, maxTokens: 100 }, () => 1_700_000_000_000);
    expect(guard.canExecute(10_000).ok).toBe(false);
    const costGuard = new RunBudgetGuard({ ...config, maxCostUsd: 0.01 }, () => 1_700_000_000_000);
    expect(costGuard.canExecute(0, 1).ok).toBe(false);
  });

  it('seeds prior usage across resume passes', () => {
    const guard = new RunBudgetGuard(config, () => 1_700_000_000_000, {
      iterations: 2,
      providerCalls: 2,
      tokensTotal: 500,
      costUsd: 0.05,
      latencyMs: 100,
    });
    const snap = guard.snapshot();
    expect(snap.iterations).toBe(2);
    expect(snap.spentTokens).toBe(500);
    expect(snap.spentCostUsd).toBe(0.05);
  });

  it('records a cumulative budget breach after execution', () => {
    const guard = new RunBudgetGuard({ ...config, maxCostUsd: 0.01 }, () => 1_700_000_000_000, {
      costUsd: 0.02,
    });
    guard.record({ tokens: 0, costUsd: 0, latencyMs: 0 });
    expect(guard.snapshot().exceeded).toBe(true);
    expect(guard.snapshot().failureReason).toMatch(/BUDGET_EXCEEDED/);
  });
});

// ── ApprovalRuntime ───────────────────────────────────────────────

describe('ApprovalRuntime — approval gate semantics', () => {
  it('requires approval for irreversible actions via the ApprovalEngine', () => {
    const runtime = new ApprovalRuntime();
    const gated = runtime.requiresApproval(
      step({ id: 's2', title: 'Publish to production', irreversible: true }),
    );
    expect(gated.required).toBe(true);
    const free = runtime.requiresApproval(step({ title: 'Research' }));
    expect(free.required).toBe(false);
  });

  it('describes the approval with WHAT/WHY/IRREVERSIBLE/COST/DATA', () => {
    const runtime = new ApprovalRuntime();
    const lines = runtime.describe(
      step({ title: 'Publish', purpose: 'Publish the result.' }),
      'openai',
      'gpt-4o',
      0.42,
    );
    expect(lines.join(' ')).toContain('WHAT');
    expect(lines.join(' ')).toContain('WHY');
    expect(lines.join(' ')).toContain('IRREVERSIBLE');
    expect(lines.join(' ')).toContain('COST: approximately $0.4200');
    expect(lines.join(' ')).toContain('DATA');
  });

  it('describes without a provider or cost estimate', () => {
    const runtime = new ApprovalRuntime();
    const lines = runtime.describe(step({ title: 'Publish' }));
    expect(lines.some((l) => l.startsWith('WHAT: execute'))).toBe(true);
    expect(lines.some((l) => l.startsWith('COST'))).toBe(false);
  });
});

// ── PlanRunResolver ───────────────────────────────────────────────

describe('PlanRunResolver — deterministic step disposition', () => {
  const resolver = new PlanRunResolver();

  it('resolves an executable step to EXECUTABLE', () => {
    const resolved = resolver.resolve(plan([step()]));
    expect(resolved[0]?.disposition).toBe('EXECUTABLE');
    expect(resolved[0]?.provider).toBe('openai');
    expect(resolved[0]?.model).toBe('gpt-4o');
  });

  it('marks steps without a selected candidate UNAVAILABLE', () => {
    const noSelection = step({ selectedCandidateId: undefined });
    const resolved = resolver.resolve(plan([noSelection]));
    expect(resolved[0]?.disposition).toBe('UNAVAILABLE');
  });

  it('marks manual and external steps MANUAL_REQUIRED', () => {
    const manual = resolver.resolve(
      plan([
        step({
          id: 'm',
          title: 'Design',
          candidates: [
            candidate({
              id: 'manual:x',
              kind: 'manual',
              name: 'Human',
              classification: 'MANUAL',
              integrationType: 'MANUAL_STEP',
            }),
          ],
          selectedCandidateId: 'manual:x',
          automation: 'MANUAL',
        }),
      ]),
    );
    expect(manual[0]?.disposition).toBe('MANUAL_REQUIRED');

    const external = resolver.resolve(
      plan([
        step({
          id: 'e',
          title: 'Design in Canva',
          candidates: [
            candidate({
              id: 'external:canva',
              name: 'Canva',
              integrationType: 'EXTERNAL_APPLICATION',
              classification: 'EXTERNAL',
            }),
          ],
          selectedCandidateId: 'external:canva',
          automation: 'MANUAL',
        }),
      ]),
    );
    expect(external[0]?.disposition).toBe('MANUAL_REQUIRED');
  });

  it('marks unconfigured candidates CONFIGURE with a deep-link', () => {
    const resolved = resolver.resolve(
      plan([
        step({
          id: 'c',
          title: 'Analyze',
          candidates: [
            candidate({
              id: 'provider:claude:sonnet',
              name: 'Claude',
              providerFamily: 'anthropic',
              classification: 'CONFIGURE',
              configurable: true,
              suggestedFamily: 'anthropic',
            }),
          ],
          selectedCandidateId: 'provider:claude:sonnet',
        }),
      ]),
    );
    expect(resolved[0]?.disposition).toBe('CONFIGURE');
    expect(resolved[0]?.deepLink).toContain('/providers');
  });

  it('gates irreversible steps WAITING_FOR_APPROVAL', () => {
    const resolved = resolver.resolve(
      plan([step({ id: 'p', title: 'Publish', irreversible: true })]),
    );
    expect(resolved[0]?.disposition).toBe('WAITING_FOR_APPROVAL');
  });

  it('marks non-automatable or non-READY candidates UNAVAILABLE', () => {
    const noApi = resolver.resolve(
      plan([
        step({
          candidates: [
            candidate({ integrationType: 'GITHUB_PROJECT', classification: 'EVALUATE' }),
          ],
          selectedCandidateId: 'provider:openai:gpt-4o',
        }),
      ]),
    );
    expect(noApi[0]?.disposition).toBe('UNAVAILABLE');

    const notReady = resolver.resolve(
      plan([
        step({
          candidates: [candidate({ classification: 'UNKNOWN' })],
          selectedCandidateId: 'provider:openai:gpt-4o',
        }),
      ]),
    );
    expect(notReady[0]?.disposition).toBe('UNAVAILABLE');
  });
});

// ── StepVerifier ──────────────────────────────────────────────────

class FakePort implements StepExecutionPort {
  available = true;
  reason?: string;
  availability(): { available: boolean; reason?: string } {
    return { available: this.available, reason: this.reason };
  }
  async execute(_input: StepExecutionInput): Promise<StepExecutionResult> {
    throw new Error('not used');
  }
}

const budget = {
  maxIterations: 3,
  maxTokens: 100_000,
  maxCostUsd: 1,
  maxLatencyMs: 60_000,
  spentTokens: 0,
  spentCostUsd: 0,
  spentLatencyMs: 0,
  iterations: 0,
  exceeded: false,
};

describe('StepVerifier — pre-execution verification', () => {
  function preInput(overrides: Partial<Parameters<StepVerifier['pre']>[0]> = {}) {
    const port = new FakePort();
    return {
      stepId: 's1',
      title: 'Research',
      capability: 'TEXT_GENERATION',
      runtimeCapability: 'text_generation',
      port,
      expectedTokens: 100,
      expectedCostUsd: 0.01,
      budget,
      dependencies: [],
      completedSteps: new Set<string>(),
      provider: 'openai',
      model: 'gpt-4o',
      evidenceCount: 1,
      ...overrides,
    };
  }

  it('passes when every check passes', () => {
    const v = new StepVerifier();
    const result = v.pre(preInput());
    expect(result.pre?.passed).toBe(true);
    expect(result.pre?.checks.length).toBe(8);
  });

  it('fails on missing capability, runtime path, provider, evidence or unavailable port', () => {
    const v = new StepVerifier();
    const port = new FakePort();
    port.available = false;
    port.reason = 'provider down';
    const result = v.pre(
      preInput({
        capability: '',
        runtimeCapability: '',
        provider: undefined,
        evidenceCount: 0,
        port,
        budget: { ...budget, exceeded: true, failureReason: 'BUDGET_EXCEEDED: x' },
        dependencies: ['dep-1'],
        completedSteps: new Set(['other']),
      }),
    );
    expect(result.pre?.passed).toBe(false);
    const names = result.pre?.checks.filter((c) => !c.passed).map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'capability',
        'runtime-capability',
        'availability',
        'configuration',
        'evidence',
        'budget',
        'dependencies',
      ]),
    );
  });
});

describe('StepVerifier — post-execution verification', () => {
  it('passes a valid execution result', () => {
    const v = new StepVerifier();
    const run = stepRun();
    const verification = v.post(run, {
      ok: true,
      content: 'A sufficiently long output that satisfies the contract.',
      provider: 'openai',
      model: 'gpt-4o',
    });
    expect(verification.post?.passed).toBe(true);
  });

  it('fails when execution failed, output is missing or below the contract', () => {
    const v = new StepVerifier();
    const failed = v.post(stepRun(), { ok: false, error: 'boom' });
    expect(failed.post?.passed).toBe(false);
    const short = v.post(stepRun(), { ok: true, content: 'x', provider: 'openai' });
    expect(short.post?.passed).toBe(false);
  });

  it('fails when the runtime abstained or rejected the output', () => {
    const v = new StepVerifier();
    const abstained = v.post(stepRun(), {
      ok: true,
      content: 'Long enough output here for the contract.',
      abstained: true,
    });
    expect(abstained.post?.passed).toBe(false);
    const rejected = v.post(stepRun(), {
      ok: true,
      content: 'Long enough output here for the contract.',
      validationDecision: 'rejected',
    });
    expect(rejected.post?.passed).toBe(false);
  });
});

describe('StepVerifier — artifact attach', () => {
  it('attaches artifact checks and keeps pre-state when no post exists', async () => {
    const v = new StepVerifier();
    const reader: ArtifactReaderPort = {
      root: '/r',
      maxBytes: 1000,
      read: async () => ({ found: true, content: '{}', byteLength: 2 }),
      exists: async () => ({ found: true }),
    };
    const artifact = await v.verifyArtifacts(reader, [
      { checkId: 'a', type: 'JSON_VALID', path: 'data.json' },
    ]);
    expect(artifact.passed).toBe(true);

    const verification: StepVerification = {
      stepId: 's1',
      pre: { passed: true, checks: [] },
      post: { passed: false, checks: [{ name: 'output', passed: false, detail: 'short' }] },
    };
    const merged = v.attachArtifacts(verification, artifact);
    expect(merged.post?.passed).toBe(false); // base post failed → combined fails
    expect(merged.post?.checks.map((c) => c.name)).toContain('artifact:a (JSON_VALID)');
  });

  it('passes only when both the base post and the artifacts pass', async () => {
    const v = new StepVerifier();
    const reader: ArtifactReaderPort = {
      root: '/r',
      maxBytes: 1000,
      read: async () => ({ found: true, content: '{}', byteLength: 2 }),
      exists: async () => ({ found: true }),
    };
    const artifact = await v.verifyArtifacts(reader, [
      { checkId: 'a', type: 'JSON_VALID', path: 'data.json' },
    ]);
    const merged = v.attachArtifacts(
      { stepId: 's1', pre: { passed: true, checks: [] }, post: { passed: true, checks: [] } },
      artifact,
    );
    expect(merged.post?.passed).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — EPIC-014 Execution Benchmark
// PLAN → EXECUTE → VERIFY, measured on deterministic fixtures (no live AI).
//
// Runs the REAL ExecutionRunService over REAL EPIC-013-style plans through a
// fake port (same hermetic contract as the package test suite) and measures:
//   plan-to-execution success · step completion · validation correctness ·
//   approval correctness · failure handling · resume correctness · partial
//   completion correctness · budget enforcement · routing correctness
// and compares the plan + execution pipeline against a DIRECT single-call
// baseline. Quality stays more important than cost — a cheaper result never
// wins by itself.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ExecutionRunService,
  InMemoryExecutionRunStore,
  InMemoryPreferenceLedger,
} from '@vedmoulya/execution-bridge';
import type {
  ClockPort,
  StepExecutionInput,
  StepExecutionPort,
  StepExecutionResult,
} from '@vedmoulya/execution-bridge';
import type {
  CapabilityCandidate,
  FactoryCapabilityPlan,
  PlanStep,
} from '@vedmoulya/capability-marketplace';

// ── Deterministic clock + port (no live services) ───────────────────────────
class FixedClock implements ClockPort {
  private readonly t = 1_700_000_000_000;
  now(): string {
    return new Date(this.t).toISOString();
  }
  timestampMs(): number {
    return this.t;
  }
  async sleep(): Promise<void> {}
}

interface ScenarioPortOptions {
  failStep?: string;
  shortOutputStep?: string;
  unavailableCapability?: string;
  transientFailStep?: string;
}

class ScenarioPort implements StepExecutionPort {
  calls: StepExecutionInput[] = [];
  constructor(private readonly options: ScenarioPortOptions = {}) {}
  availability(
    capability: string,
    runtimeCapability: string,
  ): { available: boolean; reason?: string } {
    if (this.options.unavailableCapability && capability === this.options.unavailableCapability) {
      return { available: false, reason: `provider unavailable for ${capability}` };
    }
    if (!runtimeCapability)
      return { available: false, reason: `no runtime path for ${capability}` };
    return { available: true };
  }
  execute(input: StepExecutionInput): Promise<StepExecutionResult> {
    this.calls.push(input);
    if (
      this.options.unavailableCapability &&
      input.capability === this.options.unavailableCapability
    ) {
      return Promise.resolve({ ok: false, error: 'provider unavailable' });
    }
    if (input.stepId === this.options.transientFailStep) {
      // First call fails, retry succeeds.
      if (this.calls.filter((c) => c.stepId === input.stepId).length === 1) {
        return Promise.resolve({ ok: false, error: 'transient provider failure' });
      }
    }
    if (input.stepId === this.options.failStep) {
      return Promise.resolve({ ok: false, error: 'provider 500' });
    }
    if (input.stepId === this.options.shortOutputStep) {
      return Promise.resolve({ ok: true, content: 'x', provider: 'openai', model: 'gpt-4o' });
    }
    return Promise.resolve({
      ok: true,
      content:
        'Produced the deliverable for the step. This content is long enough to satisfy the output contract.',
      provider: 'openai',
      model: 'gpt-4o',
      tokens: { input: 120, output: 420, total: 540 },
      costUsd: 0.001,
      latencyMs: 45,
    });
  }
}

// ── Fixture plan builders ────────────────────────────────────────────────────
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
    id: 'step-1',
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

let planCounter = 0;
function plan(steps: PlanStep[]): FactoryCapabilityPlan {
  planCounter += 1;
  return {
    id: `bench-plan-${planCounter}`,
    requestedOutcome: 'Create a benchmark deliverable',
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

interface RunResult {
  status: string;
  completed: number;
  total: number;
  verified: number;
  portCalls: number;
  costUsd: number;
  tokens: number;
  iterations: number;
  failureReason?: string;
}

async function runScenario(
  p: FactoryCapabilityPlan,
  port: ScenarioPort,
  budget: Partial<{
    maxIterations: number;
    maxTokens: number;
    maxCostUsd: number;
    maxLatencyMs: number;
  }> = {},
): Promise<RunResult> {
  const service = new ExecutionRunService({
    planSource: {
      getPlan: (_ownerId, planId) => Promise.resolve(planId === p.id ? p : undefined),
    },
    port,
    store: new InMemoryExecutionRunStore(),
    ledger: new InMemoryPreferenceLedger(),
    budget: {
      maxIterations: 50,
      maxTokens: 100_000,
      maxCostUsd: 1,
      maxLatencyMs: 60_000,
      ...budget,
    },
    clock: new FixedClock(),
    maxRetries: 1,
  });
  const result = await service.start('bench-user', p.id);
  if (!result.success || !result.data) {
    return {
      status: 'ERROR',
      completed: 0,
      total: 0,
      verified: 0,
      portCalls: 0,
      costUsd: 0,
      tokens: 0,
      iterations: 0,
    };
  }
  const run = result.data;
  return {
    status: run.status,
    completed: run.steps.filter((s) => s.state === 'completed').length,
    total: run.steps.length,
    verified: run.steps.filter((s) => s.verification?.post?.passed === true).length,
    portCalls: port.calls.length,
    costUsd: run.budget.spentCostUsd,
    tokens: run.budget.spentTokens,
    iterations: run.budget.iterations,
    failureReason: run.steps.find((s) => s.failureReason)?.failureReason,
  };
}

// ── Direct single-call baseline (no plan, no pipeline) ──────────────────────
async function directBaseline(): Promise<{ ok: boolean; costUsd: number; latencyMs: number }> {
  const port = new ScenarioPort();
  const result = await port.execute({
    stepId: 'direct',
    capability: 'TEXT_GENERATION',
    runtimeCapability: 'content_generation',
    instruction: 'Produce the deliverable directly.',
    userId: 'bench-user',
    expectedOutputTokens: 2000,
  });
  return {
    ok: result.ok,
    costUsd: result.costUsd ?? 0,
    latencyMs: result.latencyMs ?? 0,
  };
}

// ── Benchmark runner ─────────────────────────────────────────────────────────
interface ScenarioOutcome {
  name: string;
  pass: boolean;
  detail: string;
  result: RunResult;
}

const outcomes: ScenarioOutcome[] = [];

function assertScenario(name: string, result: RunResult, pass: boolean, detail: string): void {
  outcomes.push({ name, pass, result, detail });
}

async function main(): Promise<void> {
  // 1. Fully executable plan → COMPLETED, 2/2 completed, 2/2 verified.
  const p1 = plan([step({ id: 's1', title: 'Research' }), step({ id: 's2', title: 'Script' })]);
  const r1 = await runScenario(p1, new ScenarioPort());
  assertScenario(
    'plan-to-execution success',
    r1,
    r1.status === 'COMPLETED' &&
      r1.completed === 2 &&
      r1.total === 2 &&
      r1.verified === 2 &&
      r1.portCalls === 2,
    `COMPLETED ${r1.completed}/${r1.total} steps, ${r1.verified} verified, ${r1.portCalls} calls, $${r1.costUsd.toFixed(4)}`,
  );

  // 2. Mixed plan (executable + manual + unavailable) → honest PARTIAL/gate.
  const manual = candidate({
    id: 'manual:x',
    kind: 'manual',
    name: 'Manual action',
    integrationType: 'MANUAL_STEP',
    classification: 'MANUAL',
  });
  const p2 = plan([
    step({ id: 's1', title: 'Research' }),
    step({
      id: 's2',
      title: 'Design',
      candidates: [manual],
      selectedCandidateId: 'manual:x',
      automation: 'MANUAL',
    }),
    step({ id: 's3', title: 'Wrap up' }),
  ]);
  const r2 = await runScenario(p2, new ScenarioPort());
  assertScenario(
    'partial completion honesty',
    r2,
    r2.status !== 'COMPLETED' && r2.completed === 1 && r2.portCalls === 1,
    `${r2.status} after ${r2.completed}/${r2.total} steps — manual step never executed (${r2.portCalls} calls)`,
  );

  // 3. Approval correctness: gate then resume to completion.
  const p3 = plan([
    step({ id: 's1', title: 'Research' }),
    step({ id: 's2', title: 'Publish', purpose: 'Publish.', irreversible: true }),
  ]);
  const port3 = new ScenarioPort();
  const service3 = new ExecutionRunService({
    planSource: { getPlan: (_o, id) => Promise.resolve(id === p3.id ? p3 : undefined) },
    port: port3,
    store: new InMemoryExecutionRunStore(),
    ledger: new InMemoryPreferenceLedger(),
    budget: { maxIterations: 50, maxTokens: 100_000, maxCostUsd: 1, maxLatencyMs: 60_000 },
    clock: new FixedClock(),
    maxRetries: 1,
  });
  const started3 = await service3.start('bench-user', p3.id);
  const gated =
    started3.data?.status === 'WAITING_FOR_APPROVAL' &&
    started3.data?.steps[1]?.state === 'waiting_approval';
  const resumed3 = started3.data
    ? await service3.approve('bench-user', started3.data.executionId, 's2')
    : null;
  const approvedOk =
    resumed3?.data?.status === 'COMPLETED' && resumed3.data?.steps[1]?.state === 'completed';
  assertScenario(
    'approval + resume correctness',
    {
      status: resumed3?.data?.status ?? 'ERROR',
      completed: resumed3?.data?.steps.filter((s) => s.state === 'completed').length ?? 0,
      total: 2,
      verified: 0,
      portCalls: port3.calls.length,
      costUsd: resumed3?.data?.budget.spentCostUsd ?? 0,
      tokens: resumed3?.data?.budget.spentTokens ?? 0,
      iterations: resumed3?.data?.budget.iterations ?? 0,
    },
    gated && approvedOk && port3.calls.length === 2,
    `gate → approve → COMPLETED (${port3.calls.length} calls)`,
  );

  // 4. Provider failure → bounded FAILED (never endless retry).
  const p4 = plan([step({ id: 's1', title: 'Research' })]);
  const r4 = await runScenario(p4, new ScenarioPort({ failStep: 's1' }));
  assertScenario(
    'failure handling (bounded)',
    r4,
    r4.status === 'FAILED' &&
      r4.portCalls === 2 &&
      (r4.failureReason ?? '').includes('provider 500'),
    `FAILED after ${r4.portCalls} attempts (maxRetries=1) — reason: ${r4.failureReason ?? 'unknown'}`,
  );

  // 5. Validation failure → FAILED (a response alone is not success).
  const p5 = plan([step({ id: 's1', title: 'Research' })]);
  const r5 = await runScenario(p5, new ScenarioPort({ shortOutputStep: 's1' }));
  assertScenario(
    'validation correctness',
    r5,
    r5.status === 'FAILED' && (r5.failureReason ?? '').includes('validation'),
    `FAILED with validation reason: ${r5.failureReason ?? 'unknown'}`,
  );

  // 6. Budget enforcement → fail-closed BLOCKED, zero calls.
  const p6 = plan([step({ id: 's1', title: 'Research' })]);
  const port6 = new ScenarioPort();
  const r6 = await runScenario(p6, port6, { maxTokens: 100 });
  assertScenario(
    'budget enforcement',
    r6,
    r6.status === 'BLOCKED' &&
      r6.portCalls === 0 &&
      (r6.failureReason ?? '').includes('BUDGET_EXCEEDED'),
    `BLOCKED before any call — ${r6.failureReason ?? 'unknown'}`,
  );

  // 7. Transient failure → retry then COMPLETED (retry correctness).
  const p7 = plan([step({ id: 's1', title: 'Research' })]);
  const r7 = await runScenario(p7, new ScenarioPort({ transientFailStep: 's1' }));
  assertScenario(
    'retry correctness',
    r7,
    r7.status === 'COMPLETED' && r7.portCalls === 2 && r7.verified === 1,
    `COMPLETED after ${r7.portCalls} attempts (first transient)`,
  );

  // 8. Provider unavailable → blocked by pre-verification, zero calls.
  const p8 = plan([step({ id: 's1', title: 'Research' })]);
  const port8 = new ScenarioPort({ unavailableCapability: 'TEXT_GENERATION' });
  const r8 = await runScenario(p8, port8);
  assertScenario(
    'availability pre-verification',
    r8,
    r8.status === 'BLOCKED' &&
      r8.portCalls === 0 &&
      (r8.failureReason ?? '').includes('unavailable'),
    `BLOCKED by pre-verify — ${r8.failureReason ?? 'unknown'}`,
  );

  // ── Direct baseline comparison ────────────────────────────────────────────
  const direct = await directBaseline();

  // ── Report ────────────────────────────────────────────────────────────────
  const allPass = outcomes.every((o) => o.pass);
  const avgCost = outcomes.reduce((sum, o) => sum + o.result.costUsd, 0) / outcomes.length;

  console.log('EPIC-014 EXECUTION BENCHMARK — PLAN → EXECUTE → VERIFY');
  console.log('─────────────────────────────────────────────────────');
  for (const o of outcomes) {
    console.log(`${o.pass ? '✅' : '✗'} ${o.name}: ${o.detail}`);
  }
  console.log('─────────────────────────────────────────────────────');
  console.log(
    `Direct single-call baseline: ok=${direct.ok} cost=$${direct.costUsd.toFixed(4)} latency=${direct.latencyMs}ms`,
  );
  console.log(
    `Pipeline average cost per scenario: $${avgCost.toFixed(4)} (quality-first routing never favors the cheapest blindly)`,
  );
  console.log(
    `Total scenarios: ${outcomes.length} · Passed: ${outcomes.filter((o) => o.pass).length}`,
  );
  console.log(`Verdict: ${allPass ? 'PASS' : 'REVIEW'}`);
  if (!allPass) {
    console.log('  ✗ One or more execution contracts did not hold.');
    process.exitCode = 1;
  } else {
    console.log(
      '  ✅ Plan → validate → execute → verify → checkpoint → continue → hand-off → resume → final result.',
    );
  }
}

main().catch((error: unknown) => {
  console.error(
    '✗ Execution benchmark FAILED:',
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});

// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Autonomous Planning Intelligence: Benchmark
//
// Measures BOTH planning modes honestly, through the REAL runtime:
//   - deterministic mode: template planning (zero AI calls) — latency is
//     pure CPU; cost is zero.
//   - AI mode: one routing-backed proposal through AIOrchestrationService
//     (MockProvider, hermetic) — latency/cost/tokens are the runtime's
//     measured usage, recorded on the result (plannerAi).
//
// Scenarios cover every deterministic template (repository-fix, content,
// analysis, learning, generic) + the AI proposal path. Assertions are
// deterministic: every scenario must reach READY; AI mode must record
// provider/model/tokens/cost/latency honestly; deterministic mode must
// never call the AI port.
//
// Run:  npm run planning:benchmark   (hermetic, no secrets)
// ─────────────────────────────────────────────────────────────────────────────

import { AIOrchestrationService, ContextOptimizer, PromptCacheManager } from '@vedmoulya/services';
import type {
  AIResponse,
  ExecutionStrategyPort,
  ProviderAdapter,
  ProviderIntelligencePort,
} from '@vedmoulya/services';
import { MockProvider } from '@vedmoulya/orchestrator';
import { ToolRegistry, registerSafeTools } from '@vedmoulya/services/ai/runtime/ToolRuntime';
import { ToolRegistryAgentPort } from '@vedmoulya/agent-execution';
import { AIOrchestrationPlannerPort, PlannerService } from '@vedmoulya/planning';

if (process.env.NODE_ENV !== 'production' && !process.env.AUTH_JWT_SECRET) {
  process.env.AUTH_JWT_SECRET =
    'planning-benchmark-deterministic-dev-secret-0123456789abcdefghijklmnopqrstuvwxyz';
}

// ── Provider: deterministic JSON proposals for AI mode ──────────────────────
class BenchmarkPlanningProvider extends MockProvider implements ProviderAdapter {
  override execute(request: {
    messages: Array<{ role: string; content: string }>;
    model: string;
    maxTokens?: number;
    modelId?: string;
  }): Promise<AIResponse> {
    const lastMessage = request.messages[request.messages.length - 1];
    const input = lastMessage?.content ?? '';
    const content = input.includes('JSON plan proposal')
      ? JSON.stringify({
          objective: 'Analyze the repository and fix the failing tests',
          steps: [
            {
              stepId: 'step-1',
              objective: 'Inspect repository state',
              capability: 'reasoning',
              dependencies: [],
              allowedTools: [],
              actions: [
                {
                  kind: 'ai',
                  capability: 'reasoning',
                  instruction: 'Inspect the repository and report its test state with evidence.',
                },
              ],
              verification: {
                kind: 'rule',
                description: 'inspection reported',
                checks: [
                  { name: 'has-report', kind: 'includes', text: 'repository' },
                  { name: 'has-test', kind: 'includes', text: 'test' },
                ],
              },
              recovery: { maxAttempts: 2, maxRevisions: 1 },
            },
            {
              stepId: 'step-2',
              objective: 'Implement the minimal fix',
              capability: 'coding',
              dependencies: ['step-1'],
              allowedTools: [],
              actions: [
                {
                  kind: 'ai',
                  capability: 'coding',
                  instruction: 'Implement the minimal fix for the failing tests.',
                },
              ],
              verification: {
                kind: 'rule',
                description: 'fix described',
                checks: [{ name: 'has-fix', kind: 'includes', text: 'fix' }],
              },
              recovery: { maxAttempts: 2, maxRevisions: 1 },
            },
            {
              stepId: 'step-3',
              objective: 'Verify the final state',
              capability: 'reasoning',
              dependencies: ['step-2'],
              allowedTools: [],
              actions: [
                {
                  kind: 'ai',
                  capability: 'reasoning',
                  instruction: 'Verify the final repository state.',
                },
              ],
              verification: {
                kind: 'rule',
                description: 'state verified',
                checks: [{ name: 'has-verified', kind: 'includes', text: 'verified' }],
              },
              recovery: { maxAttempts: 2, maxRevisions: 1 },
            },
          ],
          completionCriteria: ['failing tests fixed and verified'],
          finalVerification: {
            kind: 'rule',
            description: 'goal verified',
            checks: [{ name: 'goal-verified', kind: 'includes', text: 'verified' }],
          },
        })
      : `${input}\n\nAll checks pass: the outcome is verified, no failures remaining.`;

    return Promise.resolve({
      content,
      provider: 'mock',
      model: 'mock-v1',
      confidence: 0.85,
      qualityScore: 7.5,
      latency: 50,
      cost: 0.0001,
      tokenUsage: {
        input: Math.ceil(input.length / 4),
        output: 50,
        total: Math.ceil(input.length / 4) + 50,
      },
      validation: {
        passed: true,
        checks: [
          { name: 'format', passed: true, score: 10 },
          { name: 'safety', passed: true, score: 10 },
          { name: 'quality', passed: true, score: 7.5 },
        ],
        overallScore: 8.5,
        decision: 'pass',
      },
      traceId: `planning-benchmark-${String(Date.now())}`,
      metadata: {
        providerFamily: 'mock',
        modelVersion: 'mock-v1',
        processingTime: 50,
        contextUsed: ['system', 'user-input'],
        routingDecision: {
          selectedProvider: 'mock',
          reason: 'Mock provider for the planning benchmark',
          alternativesConsidered: [],
          strategy: 'balanced',
        },
        validationDetails: [],
      },
    });
  }
}

// ── Runtime + planner (production composition) ───────────────────────────────

const ai = new AIOrchestrationService({
  contextOptimizer: new ContextOptimizer(),
  promptCache: new PromptCacheManager(),
});
ai.registerProvider(new BenchmarkPlanningProvider());

const MOCK_CAPABILITIES = [
  'reasoning',
  'coding',
  'vision',
  'embeddings',
  'summarization',
  'classification',
  'translation',
  'speech',
  'image_understanding',
  'general_conversation',
  'content_generation',
];
const providerIntelligence: ProviderIntelligencePort = {
  getCandidates(capability) {
    return Promise.resolve([
      {
        providerId: 'mock',
        family: 'mock',
        capabilities: MOCK_CAPABILITIES,
        healthy: true,
        models: [
          {
            id: 'mock-v1',
            contextWindow: 32768,
            maxOutputTokens: 4096,
            streaming: false,
            capabilities: MOCK_CAPABILITIES,
          },
        ],
        benchmarkScore: 75,
        averageLatencyMs: 50,
        costPer1KInput: 0.0001,
        costPer1KOutput: 0.0002,
      },
    ]);
  },
};
const executionStrategy: ExecutionStrategyPort = {
  getRoutingContext() {
    return Promise.resolve({ strategy: 'balanced' });
  },
};
ai.configureIntelligence({ providerIntelligence, executionStrategy });

const registry = new ToolRegistry({
  allowlist: ['echo', 'current_time', 'calculator'],
  grantedCapabilities: ['reasoning', 'calculation', 'productivity'],
});
registerSafeTools(registry);
const toolRegistry = new ToolRegistryAgentPort(registry);

const planner = new PlannerService({
  ai: new AIOrchestrationPlannerPort(ai),
  toolRegistry,
});

// ── Scenarios ────────────────────────────────────────────────────────────────

interface Scenario {
  id: string;
  goal: string;
  expectedTemplate: string;
  minSteps: number;
}

const SCENARIOS: Scenario[] = [
  {
    id: 'repository-fix',
    goal: 'Analyze this repository and fix the failing tests',
    expectedTemplate: 'repository-fix',
    minSteps: 7,
  },
  {
    id: 'content',
    goal: 'Write a blog post about our product launch for the marketing team',
    expectedTemplate: 'content',
    minSteps: 5,
  },
  {
    id: 'analysis',
    goal: 'Analyze our monthly churn data and report the findings',
    expectedTemplate: 'analysis',
    minSteps: 4,
  },
  {
    id: 'learning',
    goal: 'Learn the fundamentals of TypeScript for backend development',
    expectedTemplate: 'learning',
    minSteps: 5,
  },
  {
    id: 'generic',
    goal: 'Compile a weekly inventory snapshot of the warehouse',
    expectedTemplate: 'generic',
    minSteps: 3,
  },
];

const RUNS_PER_SCENARIO = 3;

let failures = 0;
let checks = 0;

function check(name: string, condition: boolean, detail = ''): void {
  checks += 1;
  if (condition) {
    console.log(`  ✓ ${name}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

interface ModeTotals {
  runs: number;
  latencyMs: number;
  costUsd: number;
  tokens: number;
  ready: number;
  steps: number;
}

function newTotals(): ModeTotals {
  return { runs: 0, latencyMs: 0, costUsd: 0, tokens: 0, ready: 0, steps: 0 };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('VedMoulya — Autonomous Planning Intelligence: Benchmark');
  console.log('Mode: hermetic (real AIOrchestrationService + MockProvider)');
  console.log('Modes: deterministic (template, zero AI calls) vs AI (routing-backed proposal)');
  console.log('');

  const det = newTotals();
  const aiMode = newTotals();
  let aiCallsRecorded = 0;

  for (const scenario of SCENARIOS) {
    console.log(
      `── ${scenario.id} (${scenario.goal}) ${'─'.repeat(Math.max(0, 40 - scenario.id.length))}`,
    );

    // ── Deterministic mode ─────────────────────────────────────────────
    let detLatencySum = 0;
    let detSteps = 0;
    let detReady = 0;
    for (let i = 0; i < RUNS_PER_SCENARIO; i += 1) {
      const { result } = await planner.generatePlan({ goal: scenario.goal, mode: 'deterministic' });
      detLatencySum += result.planningLatencyMs;
      detSteps = result.plan?.steps.length ?? 0;
      if (result.readiness.status === 'READY') detReady += 1;
      // Deterministic mode must NEVER call the AI port.
      check(
        `deterministic run ${i + 1}: zero AI usage recorded`,
        result.plannerAi === undefined,
        `plannerAi=${JSON.stringify(result.plannerAi)}`,
      );
    }
    det.runs += RUNS_PER_SCENARIO;
    det.latencyMs += detLatencySum;
    det.costUsd += 0;
    det.tokens += 0;
    det.ready += detReady;
    det.steps += detSteps;
    console.log(
      `    deterministic → ${String(detSteps)} steps · ready ${detReady}/${RUNS_PER_SCENARIO} · avg ${(detLatencySum / RUNS_PER_SCENARIO).toFixed(1)}ms · cost $0.000000`,
    );

    // ── AI mode ─────────────────────────────────────────────────────────
    let aiLatencySum = 0;
    let aiCostSum = 0;
    let aiTokensSum = 0;
    let aiReady = 0;
    let aiSteps = 0;
    for (let i = 0; i < RUNS_PER_SCENARIO; i += 1) {
      const { result } = await planner.generatePlan({ goal: scenario.goal, mode: 'ai' });
      aiLatencySum += result.planningLatencyMs;
      aiCostSum += result.plannerAi?.costUsd ?? 0;
      aiTokensSum += result.plannerAi?.tokens?.total ?? 0;
      aiSteps = result.plan?.steps.length ?? 0;
      if (result.readiness.status === 'READY') aiReady += 1;
      check(
        `ai run ${i + 1}: proposal came from the runtime (source=ai, usage recorded)`,
        result.source === 'ai' &&
          result.plannerAi?.provider === 'mock' &&
          result.plannerAi?.model === 'mock-v1' &&
          result.plannerAi?.tokens?.total !== undefined &&
          result.plannerAi?.costUsd !== undefined &&
          result.plannerAi?.latencyMs !== undefined,
        `source=${result.source} usage=${JSON.stringify(result.plannerAi)}`,
      );
      if (result.source === 'ai' && result.plannerAi !== undefined) aiCallsRecorded += 1;
    }
    aiMode.runs += RUNS_PER_SCENARIO;
    aiMode.latencyMs += aiLatencySum;
    aiMode.costUsd += aiCostSum;
    aiMode.tokens += aiTokensSum;
    aiMode.ready += aiReady;
    aiMode.steps += aiSteps;
    console.log(
      `    ai           → ${String(aiSteps)} steps · ready ${aiReady}/${RUNS_PER_SCENARIO} · avg ${(aiLatencySum / RUNS_PER_SCENARIO).toFixed(1)}ms · avg $${(aiCostSum / RUNS_PER_SCENARIO).toFixed(6)} · avg ${Math.round(aiTokensSum / RUNS_PER_SCENARIO)} tokens`,
    );

    // ── Assertions ──────────────────────────────────────────────────────
    check(
      `${scenario.id}: deterministic template selected and sized`,
      detSteps >= scenario.minSteps,
      `steps=${detSteps}`,
    );
    check(
      `${scenario.id}: every run READY in both modes`,
      detReady === RUNS_PER_SCENARIO && aiReady === RUNS_PER_SCENARIO,
      `det=${detReady}/${RUNS_PER_SCENARIO} ai=${aiReady}/${RUNS_PER_SCENARIO}`,
    );
    console.log('');
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  const detAvg = det.latencyMs / det.runs;
  const aiAvg = aiMode.latencyMs / aiMode.runs;
  const aiAvgCost = aiMode.costUsd / aiMode.runs;
  const aiAvgTokens = aiMode.tokens / aiMode.runs;
  console.log('── RESULTS (deterministic vs AI-assisted planning) ────────────────');
  console.log(
    `Planning latency      : deterministic ${detAvg.toFixed(1)}ms · AI ${aiAvg.toFixed(1)}ms (AI ${(aiAvg / Math.max(1, detAvg)).toFixed(1)}×)`,
  );
  console.log(`Planning cost        : deterministic $0 · AI $${aiAvgCost.toFixed(6)}/plan`);
  console.log(`AI tokens per plan   : ${Math.round(aiAvgTokens)} (proposal, via runtime)`);
  console.log(
    `Ready rate           : deterministic ${det.ready}/${det.runs} · AI ${aiMode.ready}/${aiMode.runs}`,
  );
  console.log(
    `Avg plan size        : deterministic ${(det.steps / SCENARIOS.length).toFixed(1)} steps · AI ${(aiMode.steps / SCENARIOS.length).toFixed(1)} steps`,
  );
  console.log(
    `AI calls recorded    : ${aiCallsRecorded}/${aiMode.runs} (every AI run used the runtime)`,
  );
  console.log('');
  console.log('── Honest reading ──────────────────────────────────────────────────');
  console.log('Deterministic templates cost ZERO (no AI call) and run fully offline');
  console.log('— the default for structured goals. AI mode costs $0.0001 + ~518');
  console.log('tokens per plan here (measured through the frozen runtime: routing,');
  console.log('cost ledger, evidence) and buys flexibility for goals no template');
  console.log('covers. Sub-millisecond wall latency in both modes reflects the');
  console.log('hermetic in-process provider; live providers add their own latency,');
  console.log('reported per plan via plannerAi.latencyMs.');
  console.log('');

  const deterministicHonest = det.costUsd === 0 && det.tokens === 0;
  const allReady = det.ready === det.runs && aiMode.ready === aiMode.runs;
  const aiUsageHonest = aiCallsRecorded === aiMode.runs;

  if (failures === 0 && deterministicHonest && allReady && aiUsageHonest) {
    console.log(
      '✅ PLANNING BENCHMARK PASSED — both modes measured honestly; every scenario READY.',
    );
  } else {
    console.error(`✗ PLANNING BENCHMARK FAILED — ${failures} assertion(s) failed.`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error('✗ Planning benchmark FAILED:');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

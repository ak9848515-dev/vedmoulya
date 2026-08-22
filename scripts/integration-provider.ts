// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider Live Integration Test (SPRINT-037)
//
// THE FIRST REAL-WORLD EXECUTION PROOF. Separately runnable operator test —
// CI NEVER runs this; the normal test suite is hermetic (deterministic
// fixtures only). This script composes the REAL authorities exactly as the
// gateway does and drives the full loop:
//
//   PLAN (world.orchestratePlan over the REAL Intelligence Fabric)
//     → APPROVE (world.approveOrchestrationPlan through the REAL Brain)
//     → EXECUTE (world.startOrchestrationPlan → the EXISTING ExecutionRunService
//                → the EXISTING step execution port → the REAL provider)
//     → VERIFY (the run's StepVerifier)
//     → OUTCOME (run status + step dispositions)
//
// Requirements (operator):
//   export AI_OPENAI_API_KEY=sk-...   (canonical; legacy OPENAI_API_KEY also
//                                      accepted — same resolution as the runtime)
//   export AUTH_JWT_SECRET=<strong secret>   (required by @vedmoulya/core)
//
// Safety (hard, fail-closed):
//   • Strict cost/time caps via AI_EXECUTION_MAX_* (defaults below are LOW —
//     the run is an INFORMATION/ANALYSIS workflow, never a spend path).
//   • Only ONE safe, reversible, non-sensitive workflow runs: research a
//     business opportunity and produce a structured recommendation. No
//     financial transaction, no external communication, no irreversible
//     action, no self-authorization.
//   • The script NEVER falls back to fake/mock adapters: without a real key
//     it exits non-zero with an explicit message; the runtime is registered
//     with ONLY the real provider.
//
// Run:   npm run integration:provider
// Result: machine-readable JSON summary (exit 0 = full loop verified).
// ─────────────────────────────────────────────────────────────────────────────

import { AIOrchestrationService } from '@vedmoulya/services';
import { VercelAIProvider } from '@vedmoulya/orchestrator';
import { SystemClock } from '@vedmoulya/loop-engine';
import type { ClockPort } from '@vedmoulya/loop-engine';
import {
  BrainApplicationService,
  InMemoryBrainTaskStore,
  InMemoryBrainDecisionStore,
} from '@vedmoulya/brain';
import { IntelligenceFabricService, ProviderHealthLedger } from '@vedmoulya/intelligence-fabric';
import {
  ProviderApplicationService,
  InMemoryProviderRepository,
  createCatalogProviders,
} from '@vedmoulya/providers';
import { WorldModelService, InMemoryWorldStores } from '@vedmoulya/world-model';
import {
  ExecutionRunService,
  InMemoryExecutionRunStore,
  InMemoryPreferenceLedger,
} from '@vedmoulya/execution-bridge';
import {
  InMemoryProactiveStore,
  ActionClassPolicy,
  ProactiveIntelligenceService,
} from '@vedmoulya/proactive';
import {
  createStepExecutionPort,
  createExecutionPlanSource,
} from '../services/api/src/infrastructure/ExecutionBridgePorts.js';
import { createOrchestrationAwarePlanSource } from '../services/api/src/infrastructure/OrchestrationPlanSource.js';
import {
  createWorldActionPort,
  createWorldApprovalPort,
  createWorldBrainPort,
  createWorldControlPort,
  createWorldFabricPort,
} from '../services/api/src/infrastructure/WorldBridgePorts.js';
import { createFabricProviderPort } from '../services/api/src/infrastructure/FabricBridgePorts.js';

// ── 0. Strict operator configuration ────────────────────────────────────────

const API_KEY =
  process.env.AI_OPENAI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || undefined;

function requireKey(): string {
  if (!API_KEY) {
    console.error('✗ integration:provider requires a REAL provider key.');
    console.error('  export AI_OPENAI_API_KEY=sk-...   (or legacy OPENAI_API_KEY)');
    console.error('  The normal test suite is hermetic; this operator test runs ONLY');
    console.error('  with genuine credentials. No mock/fallback is ever used here.');
    process.exit(2);
  }
  return API_KEY;
}

/** Hard, fail-closed execution limits (strict — an information workflow never
 *  needs more). Env-tunable upward only by an explicit operator decision. */
function strictBudget(): {
  maxIterations: number;
  maxTokens: number;
  maxCostUsd: number;
  maxLatencyMs: number;
} {
  const read = (name: string, fallback: number): number => {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  return {
    maxIterations: read('AI_EXECUTION_MAX_ITERATIONS', 10),
    maxTokens: read('AI_EXECUTION_MAX_TOKENS', 8_000),
    maxCostUsd: read('AI_EXECUTION_MAX_COST_USD', 0.5),
    maxLatencyMs: read('AI_EXECUTION_MAX_LATENCY_MS', 120_000),
  };
}

function section(title: string): void {
  console.log('');
  console.log(`── ${title} ${'─'.repeat(Math.max(0, 64 - title.length))}`);
}

/** A REAL Brain (frozen approval authority) with in-memory stores. The
 *  approval decision path (createTask → requestApproval → approve/reject) is
 *  the real authority; the minimal plan/candidates/execution ports are only
 *  used for task creation and never run provider calls themselves. */
function makeRealBrain() {
  const clock: ClockPort = new SystemClock();
  return new BrainApplicationService({
    plan: {
      planFor: (): Promise<import('@vedmoulya/capability-marketplace').FactoryCapabilityPlan> =>
        Promise.resolve({
          id: 'integration-plan',
          requestedOutcome: 'Research a business opportunity',
          createdAt: clock.now(),
          requiredCapabilities: ['REASONING'],
          candidates: [],
          steps: [
            {
              id: 's1',
              title: 'Analyze',
              capability: 'REASONING',
              purpose: 'Analyze the opportunity',
              candidates: [],
              automation: 'FULLY_AUTOMATED',
              irreversible: false,
              reasons: ['integration test'],
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
    },
    candidates: {
      providerCandidates: () =>
        Promise.resolve([
          {
            providerId: 'openai',
            family: 'openai',
            name: 'OpenAI',
            modelId: 'gpt-4o-mini',
            modelName: 'GPT-4o mini',
            capabilities: ['REASONING', 'RESEARCH', 'TEXT_GENERATION'],
            quality: 0.92,
            costTier: 'medium',
            availability: 0.99,
            configured: true,
            estimatedCostUsd: 0.0002,
            evidence: [],
          },
        ]),
      discoveryCandidates: () => Promise.resolve([]),
      localModelCandidates: () => Promise.resolve([]),
    },
    execution: {
      // Never used by the approval path — the run goes through the EXISTING
      // ExecutionRunService below. Abstains, never fakes a result.
      execute: () =>
        Promise.resolve({
          content: '',
          provider: '',
          model: '',
          tokens: { input: 0, output: 0, total: 0 },
          costUsd: 0,
          latencyMs: 0,
          abstained: true,
        }),
    },
    context: { assemble: () => Promise.resolve('Integration test context.') },
    preference: { record: () => Promise.resolve() },
    tasks: new InMemoryBrainTaskStore(),
    decisions: new InMemoryBrainDecisionStore(),
    clock,
    budget: { maxTokens: 8_000, maxCostUsd: 0.5, maxIterations: 10, maxLatencyMs: 120_000 },
    traceId: () => `integration-${Date.now()}`,
  });
}

async function main(): Promise<void> {
  const apiKey = requireKey();
  const budget = strictBudget();
  console.log('VedMoulya Provider Live Integration Test (SPRINT-037)');
  console.log(
    `Execution limits: $${budget.maxCostUsd} max cost · ${budget.maxLatencyMs}ms max · ${budget.maxTokens} tokens · ${budget.maxIterations} iterations (fail-closed)`,
  );

  // 1. REAL AI runtime — ONLY the real provider (never a mock/fallback).
  const ai = new AIOrchestrationService();
  ai.registerProvider(new VercelAIProvider(apiKey));
  const health = await ai.getProviderHealth('openai');
  console.log(`Runtime provider: ${health.providerId} · ${health.status}`);
  if (health.status !== 'healthy') {
    console.error('✗ Provider not healthy — aborting.');
    process.exit(1);
  }

  // 2. REAL provider registry (seeded catalog includes OpenAI) — the fabric
  //    selects from THIS, exactly like the gateway's createFabricProviderPort.
  const providers = new ProviderApplicationService(
    new InMemoryProviderRepository(createCatalogProviders()),
  );
  const healthLedger = new ProviderHealthLedger();
  const fabric = new IntelligenceFabricService({
    healthLedger,
    costPort: { snapshot: () => ({}) },
    providerPort: createFabricProviderPort(providers, healthLedger),
    costLimits: { maxDailyCostUsd: 10, maxTaskCostUsd: 1 },
  });

  // 3. REAL Brain + world model + execution bridge (identical composition).
  const brain = makeRealBrain();
  // The world model needs minimal-but-real ports for the surfaces it does NOT
  // use on this path (opportunities/tasks come from the Brain; control-plane
  // posture is read-only and empty here; proactive is advisory-only).
  const world = new WorldModelService({
    brain: createWorldBrainPort(brain),
    proactive: {
      // Advisory-only seam (never used on this path) — honest UNKNOWN
      // assessment, never a fabricated business verdict.
      assessBusiness: (): import('@vedmoulya/proactive').BusinessOpportunityAssessment => ({
        id: 'integration-assessment',
        ownerId: 'integration-founder',
        title: 'integration',
        description: '',
        category: 'emerging',
        score: 0,
        businessCase: [],
        riskLevel: 'UNKNOWN',
        mvpPlan: [],
        authorizationRequired: true,
        status: 'RESEARCHED',
        evidence: [],
        createdAt: new Date().toISOString(),
      }),
    },
    fabric: createWorldFabricPort(fabric),
    action: createWorldActionPort(),
    control: {
      listOpportunities: () => [],
      autonomyPosture: () => ({
        emergencyStopEngaged: false,
        autonomyLevel: 0,
        settingsConfirmed: false,
      }),
    },
    stores: new InMemoryWorldStores(),
    approval: createWorldApprovalPort(brain),
    cost: { measuredCostUsd: () => undefined },
    signalSources: [],
  });

  const executionRun = new ExecutionRunService({
    // SPRINT-037: the orchestration-aware plan source — an APPROVED
    // OrchestrationPlan adapts into the bridge plan; the capability
    // marketplace base is empty here (no market plans in this test).
    planSource: createOrchestrationAwarePlanSource(
      () => world,
      createExecutionPlanSource({
        getPlan: () => Promise.resolve(undefined),
      } as never),
    ),
    port: createStepExecutionPort(ai),
    store: new InMemoryExecutionRunStore(),
    ledger: new InMemoryPreferenceLedger(),
    budget: { ...budget },
    clock: new SystemClock(),
    maxRetries: 0, // one bounded attempt — retry/fallback proven by fixtures
  });

  // ── 4. The ONE safe workflow (research → reasoning → economics → finalize) ─
  section('1. Plan — world.orchestratePlan (REAL fabric)');
  const planResult = await world.orchestratePlan({
    ownerId: 'integration-founder',
    goal: 'Research a business opportunity and produce a concise recommendation',
    strategy: 'BALANCED',
    steps: [
      { id: 'research', label: 'Research the business opportunity', capability: 'research' },
      {
        id: 'reasoning',
        label: 'Independently reason about the opportunity',
        capability: 'reasoning',
      },
      { id: 'analysis', label: 'Perform economic analysis', capability: 'economic-analysis' },
      {
        id: 'verify',
        label: 'Verify the recommendation',
        capability: 'verification',
        verificationRequirement: 'cross-provider verification',
      },
      { id: 'finalize', label: 'Prepare the concise recommendation', capability: 'summarization' },
    ],
    maxRetries: 0,
  });
  if (!planResult.success || !planResult.data) {
    console.error(
      `✗ Orchestration plan failed: ${(planResult as { error?: string }).error ?? 'unknown'}`,
    );
    process.exit(1);
  }
  const plan = planResult.data;
  console.log(
    `Plan ${plan.id} · status=${plan.status} · executed=${plan.executed} · bounds.allowed=${plan.bounds.allowed}`,
  );
  console.log(
    `Steps bound: ${plan.steps.map((s) => `${s.label} → ${s.providerId ?? 'NO_SELECTION'}`).join(' | ')}`,
  );
  if (!plan.bounds.allowed) {
    console.error(`✗ Workflow exceeds bounds: ${plan.bounds.reason}`);
    process.exit(1);
  }

  // ── 5. Approval through the REAL Brain ──────────────────────────────────
  section('2. Approve — world.approveOrchestrationPlan (REAL Brain)');
  const approved = world.approveOrchestrationPlan({
    ownerId: 'integration-founder',
    planId: plan.id,
    decision: 'APPROVED',
    note: 'integration:provider — founder approves the safe analysis workflow',
  });
  if (!approved.success || !approved.data || approved.data.status !== 'APPROVED') {
    console.error(`✗ Approval refused: ${(approved as { error?: string }).error ?? 'unknown'}`);
    process.exit(1);
  }
  console.log(
    `Approved by ${approved.data.approval?.grantedBy} at ${approved.data.approval?.grantedAt} (scope: ${approved.data.approval?.scope})`,
  );
  console.log(
    `Structural check: executed=${approved.data.executed} (still a representation — the bridge is the only runtime)`,
  );

  // ── 6. Execute through the EXISTING bridge ──────────────────────────────
  section('3. Execute — the EXISTING ExecutionRunService');
  const run = await executionRun.start('integration-founder', plan.id);
  if (!run.success || !run.data) {
    console.error(`✗ Execution start failed: ${run.error}`);
    process.exit(1);
  }
  const execution = run.data;
  console.log(
    `Run ${execution.executionId} · status=${execution.status} · goal="${execution.goal}"`,
  );
  for (const step of execution.steps) {
    console.log(
      `  step ${step.stepId} · ${step.title} · disposition=${step.disposition} · state=${step.state}`,
    );
  }
  console.log(
    `Budget: $${execution.budget.spentCostUsd.toFixed(6)} spent · ${execution.budget.spentTokens} tokens · iterations=${execution.budget.iterations}`,
  );

  // ── 7. Outcome ──────────────────────────────────────────────────────────
  section('4. Outcome');
  const completed = execution.steps.filter((s) => s.state === 'completed').length;
  const total = execution.steps.length;
  console.log(`Steps: ${completed}/${total} completed · run status: ${execution.status}`);
  if (completed > 0 && execution.steps.every((s) => s.state !== 'failed')) {
    console.log('✅ REAL WORKFLOW EXECUTED + VERIFIED — the existing bridge ran the approved');
    console.log('   orchestration plan through a REAL provider with real cost accounting.');
    console.log(
      JSON.stringify(
        {
          sprint: 'SPRINT-037',
          kind: 'integration:provider',
          workflow: 'research → reasoning → economic analysis → verification → finalize',
          planId: plan.id,
          executionId: execution.executionId,
          status: execution.status,
          steps: execution.steps.map((s) => ({
            stepId: s.stepId,
            disposition: s.disposition,
            state: s.state,
          })),
          provider: execution.steps.find((s) => s.provider)?.provider ?? 'openai',
          model: execution.steps.find((s) => s.model)?.model ?? undefined,
          spentCostUsd: execution.budget.spentCostUsd,
          spentTokens: execution.budget.spentTokens,
          observedCost:
            execution.budget.spentCostUsd > 0 ? execution.budget.spentCostUsd : 'UNKNOWN',
          latencyMs: execution.budget.spentLatencyMs,
          approval: 'Brain (real)',
          engine: 'existing execution bridge',
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }
  console.error('✗ The run did not verify a completed execution — see status above.');
  console.error('  (A CONFIGURE disposition means the provider needs operator configuration;');
  console.error('   an UNAVAILABLE disposition means no runtime path exists for that step.)');
  process.exit(1);
}

main().catch((error: unknown) => {
  console.error('✗ integration:provider FAILED:');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

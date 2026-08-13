// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — SPRINT-023 Outcome Intelligence & Real-Problem Execution
// Journey Benchmark
//
// Proves — with deterministic, hermetic workloads (fixed clock + scripted
// ports, no network, no secrets) — that a REAL user problem flows through
// the problem→outcome pipeline with an actual outcome or an honest,
// actionable failure. NO new engine is exercised: this benchmark COMPOSES
// the existing estate:
//
//   goals.ProblemUnderstandingService + GoalsApplicationService
//     (problem → typed definition → goal → task DAG) ·
//   capability-marketplace (decomposer · automation boundary · approval ·
//     quality-first selection) ·
//   brain outcome vocabulary + OutcomePriorityEngine + DailyOutcomeEngine ·
//   brain execution harness (provider failover · verification · approval ·
//     budget) — the EPIC-016/020 BrainApplicationService with scripted ports.
//
// Journeys:
//   1. simple question                2. multi-step research
//   3. document/data task             4. automation request
//   5. coding problem                 6. career problem
//   7. business/earning opportunity   8. tool/API task
//   9. provider failure + fallback   10. verification failure + recovery
//  11. human approval workflow       12. budget/token exhaustion
//
// Run:  npm run outcome:journey:benchmark
// ─────────────────────────────────────────────────────────────────────────────

import {
  ProblemUnderstandingService,
  GoalsApplicationService,
  InMemoryGoalRepository,
  InMemoryTaskRepository,
} from '@vedmoulya/goals';
import {
  CapabilityDecomposer,
  AutomationBoundaryEngine,
  ApprovalEngine,
  QualityFirstSelector,
} from '@vedmoulya/capability-marketplace';
import type { CapabilityCandidate, FactoryCapabilityPlan } from '@vedmoulya/capability-marketplace';
import {
  BrainApplicationService,
  InMemoryBrainTaskStore,
  InMemoryBrainDecisionStore,
  InMemoryOpportunityStore,
  InMemoryIntelligenceEventStore,
  InMemoryOutcomeMemory,
  AdaptiveScoreLedger,
  OutcomePriorityEngine,
  DailyOutcomeEngine,
  OUTCOME_TYPES,
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
} from '@vedmoulya/brain';

// ── Shared fixtures ──────────────────────────────────────────────────────────

const PROBLEMS = new ProblemUnderstandingService();

function makeCandidate(
  cap: string,
  overrides: Partial<CapabilityCandidate> = {},
): CapabilityCandidate {
  return {
    id: `cand-${cap}`,
    kind: 'provider',
    name: `Provider for ${cap}`,
    capability: cap as CapabilityCandidate['capability'],
    integrationType: 'NATIVE_API',
    classification: 'READY',
    freeAvailability: 'FREE_WITH_QUOTA',
    localAvailability: 'UNKNOWN',
    quality: 0.8,
    availability: 0.95,
    evidence: [{ claim: 'benchmark evidence', source: 'registry', confidence: 'VERIFIED' }],
    reasons: ['fixture'],
    configurable: true,
    apiAvailable: 'yes',
    ...overrides,
  };
}

class FixedClock implements ClockPort {
  private t = new Date('2026-08-16T09:00:00Z');
  now(): string {
    this.t = new Date(this.t.getTime() + 1000);
    return this.t.toISOString();
  }
}

function makePlan(): FactoryCapabilityPlan {
  const caps = ['RESEARCH', 'TEXT_GENERATION'] as const;
  return {
    id: 'plan-1',
    requestedOutcome: 'benchmark outcome',
    createdAt: '2026-08-16T09:00:00Z',
    requiredCapabilities: [...caps],
    candidates: [],
    steps: caps.map((c, i) => ({
      id: `step-${i}`,
      title: `Step ${i + 1}`,
      capability: c,
      purpose: `do ${c}`,
      candidates: [],
      automation: 'FULLY_AUTOMATED' as const,
      irreversible: false,
      reasons: [],
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

function providerFact(
  providerId = 'prov-a',
  quality = 0.8,
  costTier: 'free' | 'low' | 'high' = 'low',
  capabilities: readonly string[] = ['RESEARCH', 'TEXT_GENERATION', 'REASONING', 'CODING'],
) {
  return {
    providerId,
    family: 'openai',
    name: providerId,
    capabilities,
    quality,
    costTier,
    availability: 0.95,
    configured: true,
    estimatedCostUsd: costTier === 'free' ? 0 : 0.01,
    evidence: [{ claim: 'benchmark evidence', confidence: 0.8 }],
  };
}

// ── Brain execution harness (journeys 9–12) — the EXISTING EPIC-016/020
//    application service with scripted ports (same pattern as the
//    outcome-intelligence benchmark). ─────────────────────────────────────────

class JourneyHarness {
  readonly clock = new FixedClock();
  private execCalls = 0;
  readonly opportunities = new InMemoryOpportunityStore();
  readonly events = new InMemoryIntelligenceEventStore();
  readonly memory = new InMemoryOutcomeMemory();
  service!: BrainApplicationService;
  // NOTE: these are RUNTIME capability ids — the execution port receives
  // mapCapability(capability).runtime (e.g. 'reasoning' for marketplace
  // RESEARCH), exactly as the real runtime adapter would.
  private readonly failCapabilities = new Set<string>();
  private readonly abstainCapability?: string;
  private readonly flakyCapability?: string;
  private flakyFired = false;
  private readonly heavyTokens?: number;
  private readonly budget: { maxTokens?: number; maxCostUsd?: number; maxIterations?: number };
  private readonly providers: ReturnType<typeof providerFact>[];

  constructor(
    opts: {
      providers?: ReturnType<typeof providerFact>[];
      /** RUNTIME capability ids that throw (provider unavailable, persistently). */
      failCapabilities?: string[];
      /** RUNTIME capability id that abstains (no output). */
      abstainCapability?: string;
      /** RUNTIME capability id that throws ONLY on the first call — the fallback
       *  provider then recovers (flaky-provider journey 9). */
      flakyCapability?: string;
      /** Report this many tokens per successful call (budget-exhaustion journeys). */
      heavyTokens?: number;
      budget?: { maxTokens?: number; maxCostUsd?: number; maxIterations?: number };
    } = {},
  ) {
    this.providers = opts.providers ?? [providerFact()];
    this.failCapabilities = new Set(opts.failCapabilities ?? []);
    this.abstainCapability = opts.abstainCapability;
    this.flakyCapability = opts.flakyCapability;
    this.heavyTokens = opts.heavyTokens;
    this.budget = opts.budget ?? { maxTokens: 10000, maxCostUsd: 0.5, maxIterations: 3 };
  }

  build(): void {
    const candidates: BrainCandidatePort = {
      providerCandidates: async (cap) =>
        this.providers.filter((p) => p.capabilities.includes(cap as never)),
      discoveryCandidates: async () => [],
      localModelCandidates: async (cap) =>
        cap === 'RESEARCH'
          ? [{ id: 'local-1', name: 'Local Llama', capabilities: ['RESEARCH'], available: true }]
          : [],
    };
    const execution: BrainExecutionPort = {
      execute: async (input) => {
        this.execCalls += 1;
        if (this.failCapabilities.has(input.capability)) {
          throw new Error('provider 503 unavailable (benchmark simulated)');
        }
        if (input.capability === this.flakyCapability && !this.flakyFired) {
          // First attempt fails — the bounded fallback (next provider) recovers.
          this.flakyFired = true;
          throw new Error('provider 503 unavailable (benchmark simulated — first attempt only)');
        }
        if (input.capability === this.abstainCapability) {
          return {
            content: '',
            provider: 'prov-a',
            model: 'm',
            tokens: { input: 100, output: 0, total: 100 },
            costUsd: 0.0001,
            latencyMs: 5,
            abstained: true,
          };
        }
        return {
          content: `Deterministic output for ${input.capability}.`,
          provider: 'prov-a',
          model: 'm',
          tokens: { input: 100, output: 50, total: this.heavyTokens ?? 150 },
          costUsd: 0.0002,
          latencyMs: 4,
          abstained: false,
        };
      },
    };
    const usage: BrainUsagePort = {
      usageFacts: async (_u, providerIds) =>
        providerIds.map((providerId) => ({
          providerId,
          capturedAt: this.clock.now(),
        })),
    };
    const discovery: BrainDiscoveryBridgePort = { fetchIntelligenceEvents: async () => [] };
    this.service = new BrainApplicationService({
      plan: { planFor: async () => makePlan() },
      candidates,
      execution,
      context: { assemble: () => Promise.resolve('Minimal task-relevant context.') },
      preference: { record: () => Promise.resolve() },
      tasks: new InMemoryBrainTaskStore(),
      decisions: new InMemoryBrainDecisionStore(),
      clock: this.clock,
      budget: this.budget,
      traceId: () => 'trace-journey-bench',
      usage,
      experience: new AdaptiveScoreLedger(() => this.clock.now()),
      memory: this.memory,
      discovery,
      opportunities: this.opportunities,
      events: this.events,
    });
  }

  create(goal: string): string {
    const created = this.service.createTask('bench-user', goal);
    if (!created.success || !created.data) throw new Error('createTask failed in benchmark');
    return created.data.id;
  }

  execCount(): number {
    return this.execCalls;
  }
}

// ── Assertion harness ────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assertScenario(name: string, condition: boolean, detail: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✅ ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  ❌ ${name} — ${detail}`);
  }
}

function makeGoals(): GoalsApplicationService {
  return new GoalsApplicationService(new InMemoryGoalRepository(), new InMemoryTaskRepository());
}

async function main(): Promise<void> {
  console.log('SPRINT-023 — Outcome Intelligence & Real-Problem Execution: 12 Journeys');
  console.log('────────────────────────────────────────────────────────────────────────');

  // ── 1. Simple question ─────────────────────────────────────────────────────
  {
    const d = PROBLEMS.understand('What is RAG and how does retrieval-augmented generation work?');
    assertScenario(
      '1. simple question → intent ANSWER with a typed definition',
      d.intent === 'ANSWER' && d.domain.length > 0,
      `intent=${d.intent}`,
    );
    assertScenario(
      '1b. outcome vocabulary available (LEARN/RESEARCH)',
      OUTCOME_TYPES.includes('RESEARCH') && OUTCOME_TYPES.includes('LEARN'),
      'outcome types missing',
    );
  }

  // ── 2. Multi-step research problem ────────────────────────────────────────
  {
    const goals = makeGoals();
    const d = PROBLEMS.understand(
      'Research AI developments this quarter and produce a verified report with sources',
    );
    const created = await goals.createGoal({
      title: d.normalizedProblem.slice(0, 60),
      description: d.normalizedProblem,
    });
    if (!created.success || !created.data) throw new Error('createGoal failed');
    const graph = await goals.generateTasks(created.data.goalId);
    if (!graph.success || !graph.data) throw new Error('generateTasks failed');
    assertScenario(
      '2. multi-step research → validated task DAG with critical path',
      graph.data.validated && graph.data.criticalPath.length > 0,
      `validated=${graph.data.validated} tasks=${graph.data.tasks.length}`,
    );
    assertScenario(
      '2b. decomposition produced multiple tasks',
      graph.data.tasks.length >= 3,
      `tasks=${graph.data.tasks.length}`,
    );
  }

  // ── 3. Document/data task ─────────────────────────────────────────────────
  {
    const d = PROBLEMS.understand(
      'Summarize this monthly sales data into a clean report for the business team',
    );
    assertScenario(
      '3. document/data task → summarization capability + business domain',
      d.requiredCapabilities.includes('summarization') && d.domain === 'business',
      `caps=${d.requiredCapabilities.join(',')} domain=${d.domain}`,
    );
    const goals = makeGoals();
    const created = await goals.createGoal({
      title: 'Sales summary',
      description: d.normalizedProblem,
    });
    if (!created.success || !created.data) throw new Error('createGoal failed');
    const valid = await goals.validateGoal(created.data.goalId);
    assertScenario(
      '3b. document task goal validates (definition + criteria)',
      valid.success,
      String(valid.error),
    );
  }

  // ── 4. Automation request ─────────────────────────────────────────────────
  {
    const d = PROBLEMS.understand('Automate my daily Excel report before Friday');
    assertScenario(
      '4. automation request → ACTION intent with deadline constraint',
      d.intent === 'ACTION' && d.constraints.some((c) => c.kind === 'deadline'),
      `intent=${d.intent}`,
    );
    const boundary = new AutomationBoundaryEngine();
    const assessed = boundary.assess([makeCandidate('CODING')], false);
    assertScenario(
      '4b. automation boundary: real candidates never degrade to MANUAL',
      assessed.automation !== 'MANUAL',
      assessed.automation,
    );
    const noCandidates = boundary.assess([], false);
    assertScenario(
      '4c. no fake automation: no candidates → honest MANUAL',
      noCandidates.automation === 'MANUAL',
      noCandidates.automation,
    );
  }

  // ── 5. Coding/technical problem ───────────────────────────────────────────
  {
    const d = PROBLEMS.understand('Build a small script that renames files safely');
    assertScenario(
      '5. coding problem → coding capability required',
      d.requiredCapabilities.includes('coding'),
      `caps=${d.requiredCapabilities.join(',')}`,
    );
    const selector = new QualityFirstSelector();
    const result = selector.select([
      makeCandidate('CODING', {
        id: 'free-weak',
        name: 'Free weak',
        quality: 0.3,
        freeAvailability: 'FREE',
      }),
      makeCandidate('CODING', {
        id: 'paid-strong',
        name: 'Paid strong',
        quality: 0.95,
        freeAvailability: 'PAID',
      }),
    ]);
    assertScenario(
      '5b. quality-first allocation: paid/strong beats free/weak',
      result.selected?.id === 'paid-strong',
      `selected=${result.selected?.id}`,
    );
  }

  // ── 6. Career problem ─────────────────────────────────────────────────────
  {
    const d = PROBLEMS.understand('Improve my resume to land a senior engineer role');
    assertScenario(
      '6. career problem → career domain + OUTCOME intent',
      d.domain === 'career' && d.intent === 'OUTCOME',
      `domain=${d.domain} intent=${d.intent}`,
    );
    assertScenario(
      '6b. no fabricated success criteria for a vague career goal',
      d.successCriteria.length === 0 && d.missingInformation.length > 0,
      `criteria=${d.successCriteria.length}`,
    );
  }

  // ── 7. Business/earning opportunity ───────────────────────────────────────
  {
    const d = PROBLEMS.understand('I want to earn money from my Excel automation skills');
    assertScenario(
      '7. earning problem → revenue domain + OUTCOME intent',
      d.domain === 'revenue' && d.intent === 'OUTCOME',
      `domain=${d.domain} intent=${d.intent}`,
    );
    assertScenario(
      '7b. MAKE_MONEY is a first-class outcome type',
      OUTCOME_TYPES.includes('MAKE_MONEY'),
      'missing',
    );
    const engine = new OutcomePriorityEngine();
    const ranked = engine.rank(
      [
        {
          id: 'free',
          title: 'Free template',
          category: 'EARNING',
          priority: 'MEDIUM',
          costClass: 'free',
          quality: 0.3,
          evidence: 0.2,
          recommendedNextAction: 'x',
          whyItMatters: ['x'],
          source: { kind: 'opportunity', id: 'a' },
        },
        {
          id: 'quality',
          title: 'Quality paid service',
          category: 'EARNING',
          priority: 'MEDIUM',
          costClass: 'paid',
          quality: 0.95,
          evidence: 0.9,
          recommendedNextAction: 'x',
          whyItMatters: ['x'],
          source: { kind: 'opportunity', id: 'b' },
        },
      ],
      5,
    );
    assertScenario(
      '7c. earning priority: quality never outranked by price',
      ranked[0]?.id === 'quality',
      `top=${ranked[0]?.id}`,
    );
    const daily = new DailyOutcomeEngine();
    const plan = daily.plan(
      {
        tasks: [],
        opportunities: [
          {
            id: 'opp-1',
            userId: 'bench-user',
            category: 'earning',
            title: 'Sell Excel automation as a service',
            description: 'Reusable automation for small businesses',
            relevance: 0.8,
            uncertainty: 0.4,
            security: 'TRUSTED',
            evidence: [],
            recommendedNextAction: 'Write a one-page offer',
            status: 'NEW',
            createdAt: '2026-08-16T09:00:00Z',
            updatedAt: '2026-08-16T09:00:00Z',
          },
        ],
        events: [],
      },
      5,
    );
    assertScenario(
      '7d. earning opportunity surfaces with a next action (no income promise)',
      plan[0]?.category === 'EARNING' && plan[0]?.recommendedNextAction.length > 0,
      `top=${plan[0]?.category}`,
    );
  }

  // ── 8. Tool/API task ──────────────────────────────────────────────────────
  {
    const decomposer = new CapabilityDecomposer();
    const decomposition = decomposer.decompose(
      'Use the GitHub API to list my repositories and open a pull request',
    );
    assertScenario(
      '8. tool/API task → decomposed into typed steps',
      decomposition.steps.length > 0 && decomposition.requiredCapabilities.length > 0,
      `steps=${decomposition.steps.length}`,
    );
    const approval = new ApprovalEngine();
    const decision = approval.decide(
      'Open a pull request to production',
      'Send changes to the repository maintainers',
    );
    assertScenario(
      '8b. write/send actions require approval (no silent irreversible action)',
      decision.irreversible && decision.actions.length > 0,
      `actions=${decision.actions.join(',')}`,
    );
  }

  // ── 9. Provider failure + fallback (RECOVERY) ─────────────────────────────
  {
    // The first RESEARCH call ('reasoning' = the runtime id mapCapability emits
    // for marketplace RESEARCH) fails on prov-a; the bounded ExecutionFailover
    // picks prov-b (never re-picks the failed provider) and the work RECOVERS.
    const h = new JourneyHarness({
      providers: [providerFact('prov-a', 0.8, 'low'), providerFact('prov-b', 0.7, 'free')],
      flakyCapability: 'reasoning',
    });
    h.build();
    const id = h.create('Research a topic with a flaky provider');
    await h.service.plan('bench-user', id);
    await h.service.selectResources('bench-user', id);
    await h.service.execute('bench-user', id);
    const task = h.service.getStatus('bench-user', id);
    if (!task.success || !task.data) throw new Error('getStatus failed');
    assertScenario(
      '9. provider failure → failover recorded (never infinite retry)',
      task.data.failoverEvents.length > 0,
      `failovers=${task.data.failoverEvents.length}`,
    );
    const failover = task.data.failoverEvents[0];
    assertScenario(
      '9b. recovery: fallback never re-picks the failed provider and completes the work (bounded)',
      Boolean(failover) &&
        failover.fallbackProviderId !== failover.failedProviderId &&
        task.data.providerOutputs.some((o) => o.output.length > 0) &&
        h.execCount() <= 12,
      `failed=${failover?.failedProviderId} fallback=${failover?.fallbackProviderId} execCalls=${h.execCount()}`,
    );
  }

  // ── 10. Verification failure + recovery ───────────────────────────────────
  {
    // The provider ABSTAINS on the research step (runtime 'reasoning') — the
    // verification layer must catch it and never report fabricated success.
    const h = new JourneyHarness({ abstainCapability: 'reasoning' });
    h.build();
    const id = h.create('Research where the provider abstains');
    await h.service.plan('bench-user', id);
    await h.service.selectResources('bench-user', id);
    await h.service.execute('bench-user', id);
    h.service.verify('bench-user', id);
    const task = h.service.getStatus('bench-user', id);
    if (!task.success || !task.data) throw new Error('getStatus failed');
    assertScenario(
      '10. abstention is recorded (the failure path is real, not vacuous)',
      task.data.providerOutputs.some((o) => o.output === 'ABSTAINED'),
      `outputs=${task.data.providerOutputs.map((o) => o.output).join(',')}`,
    );
    assertScenario(
      '10b. verification failure is never reported as success',
      !task.data.verification?.passed,
      JSON.stringify(task.data.verification),
    );
    assertScenario(
      '10c. honest partial status + verification detail (recoverable, actionable)',
      task.data.status === 'PARTIAL' && (task.data.verification?.checks.length ?? 0) > 0,
      `status=${task.data.status}`,
    );
  }

  // ── 11. Human approval workflow ───────────────────────────────────────────
  {
    // The FREE provider cannot perform the task's capability, so the PAID
    // provider is the only eligible candidate → selection must create a paid
    // approval point. Nothing may execute before the user approves.
    //
    // HONESTY NOTE: the Brain's execute() does not itself gate on task.status —
    // "approval before execution" is enforced by the CALLER (the live bridge /
    // UI flow never invokes execute() while the task is AWAITING_APPROVAL).
    // This journey therefore proves the intended workflow end-to-end, not an
    // engine-level refusal; the engine enforces the policy for the sensitive
    // action itself (approval is granted only via approve()).
    const h = new JourneyHarness({
      providers: [
        providerFact('prov-paid', 0.95, 'high', ['TEXT_GENERATION', 'RESEARCH']),
        providerFact('prov-free', 0.6, 'free', ['RESEARCH']),
      ],
    });
    h.build();
    const id = h.create('Produce a marketing brief');
    await h.service.plan('bench-user', id);
    await h.service.selectResources('bench-user', id);
    const before = h.service.getStatus('bench-user', id).data;
    assertScenario(
      '11. nothing executes before approval',
      h.execCount() === 0,
      `execCalls=${h.execCount()}`,
    );
    const paid = before?.roleAssignments.find((a) => a.providerId === 'prov-paid');
    // The paid branch MUST be entered — a fallback would hide the approval path.
    if (!paid)
      throw new Error(
        'benchmark setup failure: paid provider was not assigned for the approval journey',
      );
    // 'purchase' is a real SENSITIVE_ACTION — paid-provider use needs it.
    const requested = h.service.requestApproval('bench-user', id, 'purchase');
    assertScenario(
      '11a. paid option pauses for approval (AWAITING_APPROVAL)',
      requested.success && requested.data?.status === 'AWAITING_APPROVAL',
      String(requested.error),
    );
    const approved = h.service.approve('bench-user', id, 'purchase');
    assertScenario(
      '11b. paid option requires + records human approval',
      approved.success && approved.data?.approvalGranted.includes('purchase'),
      String(approved.error),
    );
    // Only AFTER approval does the paid provider actually run.
    await h.service.execute('bench-user', id);
    h.service.verify('bench-user', id);
    const after = h.service.getStatus('bench-user', id).data;
    assertScenario(
      '11c. task advances to a real outcome only after approval',
      Boolean(after) &&
        (after.status === 'COMPLETED' || after.status === 'PARTIAL') &&
        h.execCount() > 0,
      `status=${after?.status} exec=${h.execCount()}`,
    );
  }

  // ── 12. Budget/token exhaustion ───────────────────────────────────────────
  {
    // Every successful call reports 5000 tokens (heavyTokens) against a 2000
    // hard budget → the BrainBudgetGuard (LoopBudget semantics) must trip
    // mid-run and STOP fail-closed before further work.
    const h = new JourneyHarness({
      providers: [providerFact('prov-a')],
      failCapabilities: ['reasoning'],
      heavyTokens: 5000,
      budget: { maxTokens: 2000, maxCostUsd: 0.1, maxIterations: 1 },
    });
    h.build();
    const id = h.create('A heavy research task on a tiny budget');
    await h.service.plan('bench-user', id);
    await h.service.selectResources('bench-user', id);
    await h.service.execute('bench-user', id);
    const task = h.service.getStatus('bench-user', id);
    if (!task.success || !task.data) throw new Error('getStatus failed');
    assertScenario(
      '12. budget exhaustion → fail-closed stop (never fabricated success)',
      task.data.status === 'PARTIAL' &&
        task.data.decisionRecords.some((d) => d.decision.includes('budget')),
      `status=${task.data.status} decisions=${task.data.decisionRecords.map((d) => d.decision).join('|')}`,
    );
    assertScenario(
      '12b. the run actually stopped at the budget trip (bounded)',
      h.execCount() <= 4,
      `execCalls=${h.execCount()}`,
    );
  }

  console.log('────────────────────────────────────────────────────────────────────────');
  console.log(`Total assertions: ${passed + failed} · Passed: ${passed}`);
  console.log(`Verdict: ${failed === 0 ? 'PASS' : 'FAIL'}`);
  if (failures.length > 0) {
    console.log(`Failed: ${failures.join(', ')}`);
    process.exit(1);
  }
  console.log(
    '  ✅ PROBLEM → UNDERSTAND → OUTCOME → DECOMPOSE → ALLOCATE → EXECUTE → VERIFY → APPROVE → FAIL-SAFE — composed entirely from existing engines.',
  );
}

void main();

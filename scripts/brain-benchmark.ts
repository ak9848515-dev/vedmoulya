// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — EPIC-016 Brain Benchmark
// SINGLE vs ROUTED vs BRAIN (N-provider role orchestration)
//
// Proves — with measured, deterministic workloads — what the VedMoulya Brain
// (EPIC-016) actually adds over a raw single provider call and over the frozen
// LoopEngine (EPIC-006). Hermetic: no secrets, no network. The SAME underlying
// deterministic specialist behavior backs all three paths; only the execution
// STRATEGY differs:
//
//   SINGLE  — one direct specialist call with the whole goal, judged by the
//             same deterministic critic the loop uses.
//   ROUTED  — the frozen LoopEngine (understand → decompose → specialist →
//             critic → bounded refinement), fully budget-bounded.
//   BRAIN   — the Brain pipeline (understand → EPIC-013 plan → N-provider
//             role assignment → bounded execution → verification → synthesis),
//             executing one specialist call per assigned capability role.
//
// Scenarios measure the honest trade-off — orchestration is NOT automatically
// better; the Brain is NOT free:
//   - first-shot-correct   → single is cheapest; brain/loop overhead is
//                            measured and reported, never hidden.
//   - multi-capability     → the brain decomposes into N provider roles and
//                            executes each; a single call cannot.
//   - provider failure     → loop retries; brain records honestly and never
//                            fabricates success content.
//   - quality beats cost   → the cheapest provider never wins by itself.
//   - free wins when quality is sufficient → preference, not a rule.
//   - deep research, no evidence → honest PARTIAL (abstain, never fake).
//   - approval gate        → sensitive actions pause for explicit approval.
//   - budget refusal       → fail-closed before/while spending.
//   - no runtime path      → capability is never faked.
//   - missing capability   → explicit hand-off, never silent.
//   - local model          → PRIVATE_LOCAL preference respected.
//
// Every brain run must produce decision records (provenance). A provider
// response alone is never success; every COMPLETED run must pass verification.
//
// Run:  npm run brain:benchmark
// ─────────────────────────────────────────────────────────────────────────────

import {
  BrainApplicationService,
  InMemoryBrainTaskStore,
  InMemoryBrainDecisionStore,
} from '@vedmoulya/brain';
import type {
  BrainPlanPort,
  BrainCandidatePort,
  BrainExecutionPort,
  BrainContextPort,
  BrainPreferencePort,
} from '@vedmoulya/brain';
import type { BrainBudget, BrainTask, BrainTaskStatus } from '@vedmoulya/brain';
import type {
  CapabilityId,
  FactoryCapabilityPlan,
  LocalModelCandidateFact,
  ProviderCandidateFact,
} from '@vedmoulya/capability-marketplace';
import { mapCapability } from '@vedmoulya/execution-bridge';
import { CriticEvaluator, GoalUnderstandingService, LoopEngine } from '@vedmoulya/loop-engine';
import type {
  RagSearchPort,
  SpecialistExecutionInput,
  SpecialistExecutionResult,
  ToolExecutionPort,
} from '@vedmoulya/loop-engine';
import type { EvidenceState } from '@vedmoulya/services';

if (process.env.NODE_ENV !== 'production' && !process.env.AUTH_JWT_SECRET) {
  process.env.AUTH_JWT_SECRET =
    'brain-benchmark-deterministic-dev-secret-0123456789abcdefghijklmnopqrstuvwxyz';
}

// ── Deterministic specialist behavior (identical for all three paths) ───────

/** Content that satisfies every required-section success criterion. */
const FULL_ANSWER = [
  '## Diagnosis\nThe root cause is an untyped reference in the DATA statement.',
  '## Explanation\nThe reference is dereferenced before the field symbol is assigned.',
  '## Corrected Code\nDATA(lv_ref) = ls_item-ref.\nIF lv_ref IS NOT INITIAL.',
  '## Validation\nAll checks PASS: syntax, null-handling, types.',
  '## Requirements\nUsers, core workflows and acceptance criteria are defined.',
  '## Architecture\nThe stack, components, data model and deployment are defined.',
  '## UI Plan\nScreens, navigation and design language are defined.',
  '## Implementation Plan\nMilestones, module order, tests and launch checklist are defined.',
  '## Capabilities\nEach AI touchpoint maps to a capability and quality tier.',
  '## Implementation\nThe implementation plan with validation is complete.',
  '## Deliverable\nThe complete deliverable is present.',
].join('\n\n');

const ABAP_GOAL = 'Build an ABAP debugger for short dumps in production SAP code.';

interface Behavior {
  content?: (input: SpecialistExecutionInput, index: number) => string;
  throwAt?: (input: SpecialistExecutionInput, index: number) => boolean;
}

/** Shared deterministic clock (brain + loop contracts). */
class FixedClock {
  private readonly t = 1_700_000_000_000;
  now(): string {
    return new Date(this.t).toISOString();
  }
  timestampMs(): number {
    return this.t;
  }
  async sleep(): Promise<void> {}
}

class BenchmarkSpecialist {
  calls = 0;
  private index = 0;
  constructor(private readonly behavior: Behavior = {}) {}

  async execute(input: SpecialistExecutionInput): Promise<SpecialistExecutionResult> {
    const index = this.index;
    this.index += 1;
    this.calls += 1;
    if (this.behavior.throwAt?.(input, index)) {
      throw new Error('provider 503 unavailable (benchmark simulated)');
    }
    return await Promise.resolve({
      content: this.behavior.content?.(input, index) ?? `Output for ${input.taskId}`,
      provider: 'benchmark-mock',
      model: 'benchmark-v1',
      tokens: { input: 120, output: 60, total: 180 },
      costUsd: 0.0002,
      latencyMs: 4,
      abstained: false,
      evidenceState: 'SUFFICIENT_EVIDENCE',
      selectionExplanation:
        'Selected benchmark-mock/benchmark-v1 (balanced) — deterministic benchmark fixture.',
      validationDecision: 'pass',
    });
  }
}

// ── Loop path fixtures (frozen LoopEngine) ──────────────────────────────────
const FAKE_RAG: RagSearchPort = {
  search() {
    return Promise.resolve({
      results: [
        {
          title: 'SAP ABAP knowledge base',
          content:
            'ABAP short dumps on unassigned field symbols: check DATA declarations and dereferencing.',
          score: 0.9,
          source: 'sap-kb-1',
        },
      ],
    });
  },
};

const FAKE_TOOLS: ToolExecutionPort = {
  execute() {
    return Promise.resolve({ ok: true, denied: false, outcome: 'success', latencyMs: 1 });
  },
  listAllowed() {
    return ['echo', 'calculator', 'current_time'];
  },
};

// ── Brain fixtures ──────────────────────────────────────────────────────────
function providerFact(overrides: Partial<ProviderCandidateFact>): ProviderCandidateFact {
  return {
    providerId: 'prov-base',
    family: 'openai',
    name: 'Base provider',
    modelId: 'gpt-4o',
    modelName: 'GPT-4o',
    capabilities: ['TEXT_GENERATION', 'REASONING', 'RESEARCH', 'CODING'],
    quality: 0.9,
    costTier: 'medium',
    availability: 0.98,
    configured: true,
    estimatedCostUsd: 0.001,
    evidence: [
      { claim: 'registry capability matrix', source: 'provider-registry', confidence: 'VERIFIED' },
    ],
    ...overrides,
  };
}

function makePlan(caps: CapabilityId[]): FactoryCapabilityPlan {
  return {
    id: `bench-plan-${caps.join('-')}`,
    requestedOutcome: ABAP_GOAL,
    createdAt: '2026-08-16T09:00:00Z',
    requiredCapabilities: caps,
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

interface BrainHarnessOptions {
  goal: string;
  caps: CapabilityId[];
  providerFacts?: Partial<Record<CapabilityId, ProviderCandidateFact[]>>;
  localFacts?: Partial<Record<CapabilityId, LocalModelCandidateFact[]>>;
  budget?: Partial<BrainBudget>;
  failCapability?: CapabilityId;
  preferenceHints?: { costSensitive?: boolean; localFirst?: boolean };
}

class BrainHarness {
  readonly task: BrainTask;
  readonly port: BenchmarkSpecialist;
  readonly preferenceEvents: Array<Record<string, unknown>>;
  private readonly service: BrainApplicationService;

  constructor(opts: BrainHarnessOptions) {
    this.port = new BenchmarkSpecialist({
      content: () => FULL_ANSWER,
    });
    this.preferenceEvents = [];

    const plan: BrainPlanPort = { planFor: () => Promise.resolve(makePlan(opts.caps)) };
    const candidates: BrainCandidatePort = {
      providerCandidates: (cap) => Promise.resolve(opts.providerFacts?.[cap] ?? []),
      discoveryCandidates: () => Promise.resolve([]),
      localModelCandidates: (cap) => Promise.resolve(opts.localFacts?.[cap] ?? []),
    };
    // The Brain service maps the marketplace capability to the frozen runtime
    // capability BEFORE calling the port — this benchmark keys the simulated
    // failure on the SAME mapper the frozen estate uses (single source of truth).
    const execution: BrainExecutionPort = {
      execute: async (input) => {
        const failRuntime = opts.failCapability
          ? mapCapability(opts.failCapability).runtime
          : undefined;
        if (failRuntime && failRuntime === input.capability) {
          throw new Error(`provider 500 for ${input.capability} (benchmark simulated)`);
        }
        return this.port.execute(input);
      },
    };
    const context: BrainContextPort = {
      assemble: () => Promise.resolve('Minimal task-relevant context.'),
    };
    const preference: BrainPreferencePort = {
      record: (event) => {
        this.preferenceEvents.push({ ...event });
        return Promise.resolve();
      },
    };
    const service = new BrainApplicationService({
      plan,
      candidates,
      execution,
      context,
      preference,
      tasks: new InMemoryBrainTaskStore(),
      decisions: new InMemoryBrainDecisionStore(),
      clock: new FixedClock(),
      budget: {
        maxTokens: 10000,
        maxCostUsd: 0.5,
        maxIterations: 20,
        maxLatencyMs: 60000,
        ...opts.budget,
      },
      preferenceHints: opts.preferenceHints,
      traceId: () => 'trace-bench',
    });

    const created = service.createTask('bench-user', opts.goal);
    if (!created.success || !created.data) {
      throw new Error('brain createTask failed in benchmark fixture');
    }
    this.task = created.data;
    this.service = service;
  }

  async planAndSelect(): Promise<void> {
    const planned = await this.service.plan('bench-user', this.task.id);
    if (!planned.success) throw new Error(`brain plan failed: ${planned.error}`);
    const selected = await this.service.selectResources('bench-user', this.task.id);
    if (!selected.success) throw new Error(`brain selectResources failed: ${selected.error}`);
  }

  async runFull(): Promise<void> {
    await this.planAndSelect();
    const executed = await this.service.execute('bench-user', this.task.id);
    if (!executed.success && executed.code !== 'BUDGET_BLOCKED') {
      throw new Error(`brain execute failed: ${executed.error}`);
    }
    this.service.verify('bench-user', this.task.id);
  }

  serviceRequestApproval(action: string): boolean {
    const result = this.service.requestApproval('bench-user', this.task.id, action);
    return result.success;
  }

  serviceApprove(action: string): boolean {
    const result = this.service.approve('bench-user', this.task.id, action);
    return result.success;
  }

  /** Execute only (after planAndSelect) — returns the raw service result. */
  async executeOnly(): Promise<{ success: boolean; code?: string }> {
    const result = await this.service.execute('bench-user', this.task.id);
    return { success: result.success, code: result.code };
  }

  /** Decision records: task-carried projection + owner-scoped store. */
  decisionTitles(): string[] {
    const titles = this.task.decisionRecords.map((d) => d.decision);
    const stored = this.service.getDecisionRecords('bench-user', this.task.id);
    for (const d of stored.success ? (stored.data ?? []) : []) {
      if (!titles.includes(d.decision)) titles.push(d.decision);
    }
    return titles;
  }

  roleAssignments() {
    return this.task.roleAssignments;
  }

  status(): BrainTaskStatus {
    return this.task.status;
  }
}

// ── Scenario runner ─────────────────────────────────────────────────────────
interface ScenarioOutcome {
  name: string;
  pass: boolean;
  detail: string;
}

const outcomes: ScenarioOutcome[] = [];
const BRAIN_DECISIONS: number[] = [];

function assertScenario(name: string, pass: boolean, detail: string): void {
  outcomes.push({ name, pass, detail });
}

// ── Metrics ─────────────────────────────────────────────────────────────────
interface PathMetrics {
  label: string;
  success: boolean;
  calls: number;
  tokens: number;
  costUsd: number;
  latencyMs: number;
  detail: string;
}
const pathMetrics: PathMetrics[] = [];

// ── Main ────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(
    'VedMoulya — EPIC-016 BRAIN BENCHMARK — single vs routed (LoopEngine) vs brain (N-provider)',
  );
  console.log('Mode: hermetic (deterministic mock model + fake ports — no network, no secrets)');
  console.log('All paths use the SAME deterministic model; only the execution strategy differs.');
  console.log('');

  // ══ PATH COMPARISON 1 — first-shot-correct (easy goal) ═══════════════════
  // Single is the cheapest path; the brain adds role assignment + decision
  // provenance + verification. Overhead is measured, never hidden.
  {
    // SINGLE
    const spec = new GoalUnderstandingService().derive(ABAP_GOAL);
    const single = new BenchmarkSpecialist({ content: () => FULL_ANSWER });
    let singleOk = false;
    let singleTokens = 0;
    let singleCost = 0;
    let singleLatency = 0;
    let singleDetail = 'n/a';
    try {
      const result = await single.execute({
        taskId: 'single',
        capability: 'reasoning',
        qualityTier: spec.qualityTier,
        userInput: ABAP_GOAL,
        enableOptimization: true,
        groundingRequired: true,
      });
      const evidenceState: EvidenceState = result.evidenceState ?? 'SUFFICIENT_EVIDENCE';
      const assessment = new CriticEvaluator().evaluate({
        output: result.content,
        successCriteria: spec.successCriteria,
        evidenceState,
        groundingRequired: true,
        format: 'text',
      });
      singleOk = assessment.verdict === 'PASS';
      singleTokens = result.tokens.total;
      singleCost = result.costUsd;
      singleLatency = result.latencyMs;
      singleDetail = assessment.verdict;
    } catch (error) {
      singleDetail = error instanceof Error ? error.message : String(error);
    }

    // ROUTED
    const routedSpecialist = new BenchmarkSpecialist({ content: () => FULL_ANSWER });
    const routed = await new LoopEngine({
      specialist: routedSpecialist,
      rag: FAKE_RAG,
      tools: FAKE_TOOLS,
      clock: new FixedClock(),
    }).run({ goal: ABAP_GOAL, userId: 'bench-user' });
    const routedOk = routed.terminationReason === 'SUCCESS';

    // BRAIN
    const brain1 = new BrainHarness({
      goal: ABAP_GOAL,
      caps: ['RESEARCH', 'CODING'],
      providerFacts: {
        RESEARCH: [
          providerFact({
            providerId: 'prov-research',
            name: 'Research',
            quality: 0.92,
            costTier: 'medium',
          }),
        ],
        CODING: [
          providerFact({ providerId: 'prov-coding', name: 'Code', quality: 0.9, costTier: 'low' }),
        ],
      },
    });
    await brain1.runFull();
    const brain1Ok = brain1.status() === 'COMPLETED';
    const brain1Calls = brain1.port.calls;

    pathMetrics.push(
      {
        label: 'first-shot-correct · single',
        success: singleOk,
        calls: 1,
        tokens: singleTokens,
        costUsd: singleCost,
        latencyMs: singleLatency,
        detail: singleDetail,
      },
      {
        label: 'first-shot-correct · routed ',
        success: routedOk,
        calls: routedSpecialist.calls,
        tokens: routed.budgetUsage.tokensTotal,
        costUsd: routed.budgetUsage.costUsd,
        latencyMs: routed.budgetUsage.latencyMs,
        detail: String(routed.terminationReason),
      },
      {
        label: 'first-shot-correct · brain  ',
        success: brain1Ok,
        calls: brain1Calls,
        tokens: brain1Calls * 180,
        costUsd: brain1Calls * 0.0002,
        latencyMs: brain1Calls * 4,
        detail: `${brain1.status()} · ${brain1.roleAssignments().length} role(s)`,
      },
    );

    assertScenario(
      'first-shot-correct: all paths succeed honestly',
      singleOk && routedOk && brain1Ok,
      `single ${singleDetail} · routed ${routed.terminationReason} · brain ${brain1.status()} (${brain1Calls} exec calls, ${brain1.roleAssignments().length} roles)`,
    );
    BRAIN_DECISIONS.push(brain1.task.decisionRecords.length);

    // ══ PATH COMPARISON 2 — multi-capability: N-provider role assignment ════
    const brain2 = new BrainHarness({
      goal: ABAP_GOAL,
      caps: ['RESEARCH', 'REASONING', 'CODING'],
      providerFacts: {
        RESEARCH: [
          providerFact({
            providerId: 'prov-research-a',
            name: 'Research A',
            quality: 0.92,
            costTier: 'medium',
          }),
        ],
        REASONING: [
          providerFact({
            providerId: 'prov-reason-b',
            name: 'Reason B',
            quality: 0.9,
            costTier: 'low',
          }),
        ],
        CODING: [
          providerFact({
            providerId: 'prov-code-c',
            name: 'Code C',
            quality: 0.88,
            costTier: 'free',
          }),
        ],
      },
    });
    await brain2.runFull();
    const roles = brain2.roleAssignments();
    const roleNames = roles.map((r) => r.role);
    assertScenario(
      'multi-capability: brain assigns N provider roles (RESEARCHER/CODER/…)',
      roles.length === 3 &&
        brain2.status() === 'COMPLETED' &&
        roleNames.includes('RESEARCHER') &&
        roleNames.includes('CODER') &&
        brain2.port.calls === 3,
      `${brain2.status()} · roles: ${roleNames.join(', ')} · ${brain2.port.calls} exec calls for 3 capabilities`,
    );
    BRAIN_DECISIONS.push(brain2.task.decisionRecords.length);

    // ══ PATH COMPARISON 3 — provider failure ════════════════════════════════
    // The loop retries and recovers; the brain records the failure honestly
    // (decision record, empty output — never fabricated success content).
    {
      const spec3 = new GoalUnderstandingService().derive(ABAP_GOAL);
      const single3 = new BenchmarkSpecialist({
        content: () => FULL_ANSWER,
        throwAt: (_input, index) => index === 0,
      });
      let single3Ok = false;
      let single3Detail = 'n/a';
      try {
        const result = await single3.execute({
          taskId: 'single',
          capability: 'reasoning',
          qualityTier: spec3.qualityTier,
          userInput: ABAP_GOAL,
          enableOptimization: true,
          groundingRequired: true,
        });
        const evidenceState3: EvidenceState = result.evidenceState ?? 'SUFFICIENT_EVIDENCE';
        const assessment = new CriticEvaluator().evaluate({
          output: result.content,
          successCriteria: spec3.successCriteria,
          evidenceState: evidenceState3,
          groundingRequired: true,
          format: 'text',
        });
        single3Ok = assessment.verdict === 'PASS';
        single3Detail = assessment.verdict;
      } catch (error) {
        single3Detail = `threw: ${error instanceof Error ? error.message : String(error)}`;
      }

      const routed3Specialist = new BenchmarkSpecialist({
        content: () => FULL_ANSWER,
        throwAt: (_input, index) => index === 0,
      });
      const routed3 = await new LoopEngine({
        specialist: routed3Specialist,
        rag: FAKE_RAG,
        tools: FAKE_TOOLS,
        clock: new FixedClock(),
      }).run({ goal: ABAP_GOAL, userId: 'bench-user' });

      // Brain: fail the CODING execution — recorded honestly, never faked.
      const brain3 = new BrainHarness({
        goal: ABAP_GOAL,
        caps: ['RESEARCH', 'CODING'],
        providerFacts: {
          RESEARCH: [providerFact({ providerId: 'prov-r', name: 'Research', quality: 0.9 })],
          CODING: [providerFact({ providerId: 'prov-c', name: 'Code', quality: 0.85 })],
        },
        failCapability: 'CODING',
      });
      await brain3.runFull();
      const failureRecorded = brain3.decisionTitles().some((d) => d.includes('provider failure'));
      const noFabricatedContent = brain3.task.providerOutputs.every(
        (o) => o.capability !== 'CODING' || o.output === '',
      );

      assertScenario(
        'provider failure: single throws, loop recovers, brain records honestly',
        !single3Ok &&
          routed3.terminationReason === 'SUCCESS' &&
          failureRecorded &&
          noFabricatedContent,
        `single ${single3Detail} · routed ${routed3.terminationReason} (${routed3Specialist.calls} calls) · brain failure decision=${failureRecorded} no-fake=${noFabricatedContent}`,
      );
      BRAIN_DECISIONS.push(brain3.task.decisionRecords.length);
    }
  }

  // ══ BRAIN QUALITY GATES ═══════════════════════════════════════════════════
  // 4. Quality beats cost — the cheapest provider never wins by itself.
  {
    const brain = new BrainHarness({
      goal: 'Build a professional ABAP debugger — high quality matters.',
      caps: ['CODING'],
      providerFacts: {
        CODING: [
          providerFact({
            providerId: 'free-weak',
            name: 'Free lite',
            quality: 0.5,
            costTier: 'free',
            availability: 0.99,
          }),
          providerFact({
            providerId: 'paid-strong',
            name: 'Premium coder',
            quality: 0.95,
            costTier: 'high',
            availability: 0.98,
          }),
        ],
      },
    });
    await brain.planAndSelect();
    const selected = brain.roleAssignments()[0]?.providerId;
    assertScenario(
      'quality beats cost: high-quality provider selected over free/cheap',
      selected === 'paid-strong',
      `selected ${String(selected)} (quality-first — the free 0.5 provider loses to the 0.95 provider)`,
    );
    BRAIN_DECISIONS.push(brain.task.decisionRecords.length);
  }

  // 5. Free wins when quality is sufficient — a preference, not a rule.
  {
    const brain = new BrainHarness({
      goal: 'Write a quick draft of the ABAP fix.',
      caps: ['CODING'],
      providerFacts: {
        CODING: [
          providerFact({
            providerId: 'prov-low-cost',
            name: 'Paid mid',
            quality: 0.86,
            costTier: 'medium',
            availability: 0.99,
          }),
          providerFact({
            providerId: 'prov-free-mid',
            name: 'Free mid',
            quality: 0.85,
            costTier: 'free',
            availability: 0.98,
          }),
        ],
      },
    });
    await brain.planAndSelect();
    const selected = brain.roleAssignments()[0]?.providerId;
    assertScenario(
      'free wins when quality is sufficient (preference, not a rule)',
      selected === 'prov-free-mid',
      `selected ${String(selected)} — quality 0.85 free beats 0.86 paid because quality is sufficient (MEDIUM target)`,
    );
    BRAIN_DECISIONS.push(brain.task.decisionRecords.length);
  }

  // 6. Deep research without evidence → honest PARTIAL, never fabricated.
  {
    const brain = new BrainHarness({
      goal: 'Research and compare the best ABAP debugging approaches comprehensively.',
      caps: ['RESEARCH'],
      providerFacts: {
        RESEARCH: [
          providerFact({ providerId: 'prov-r1', name: 'Research 1', quality: 0.92 }),
          providerFact({ providerId: 'prov-r2', name: 'Research 2', quality: 0.88 }),
          providerFact({ providerId: 'prov-r3', name: 'Research 3', quality: 0.85 }),
        ],
      },
    });
    await brain.runFull();
    const mode = brain.task.mode;
    const role = brain.roleAssignments()[0]?.role;
    const evidencePolicyFailed = brain.task.verification?.checks.some(
      (c) => c.name === 'evidence policy' && !c.passed,
    );
    assertScenario(
      'deep research, no evidence → honest PARTIAL (abstain, never fake)',
      mode === 'DEEP_RESEARCH' &&
        role === 'RESEARCHER' &&
        brain.status() === 'PARTIAL' &&
        evidencePolicyFailed === true,
      `mode ${mode} · role ${role} · status ${brain.status()} · evidence policy check failed honestly`,
    );
    BRAIN_DECISIONS.push(brain.task.decisionRecords.length);
  }

  // 7. Approval gate — sensitive actions pause for explicit approval.
  {
    const brain = new BrainHarness({
      goal: 'Create a video and publish it to YouTube.',
      caps: ['TEXT_GENERATION'],
      providerFacts: {
        TEXT_GENERATION: [
          providerFact({ providerId: 'prov-writer', name: 'Writer', quality: 0.9 }),
        ],
      },
    });
    await brain.planAndSelect();
    const requested = brain.serviceRequestApproval('publish');
    const approved = brain.serviceApprove('publish');
    assertScenario(
      'approval gate: sensitive action pauses, explicit approval resumes',
      requested && approved && brain.task.approvalGranted.includes('publish'),
      `AWAITING_APPROVAL → explicit approval granted (${brain.task.approvalGranted.join(', ')})`,
    );
    BRAIN_DECISIONS.push(brain.task.decisionRecords.length);
  }

  // 8. Budget refusal — fail-closed before spending.
  {
    const brain = new BrainHarness({
      goal: 'Build an ABAP debugger.',
      caps: ['CODING'],
      providerFacts: {
        CODING: [providerFact({ providerId: 'prov-c', name: 'Code', quality: 0.85 })],
      },
      budget: { maxCostUsd: 0.00001 },
    });
    await brain.planAndSelect();
    const executed = await brain.executeOnly();
    const blocked = !executed.success && executed.code === 'BUDGET_BLOCKED';
    const zeroCalls = brain.port.calls === 0;
    assertScenario(
      'budget refusal: fail-closed, zero provider calls',
      blocked && zeroCalls,
      `execute ${blocked ? 'BUDGET_BLOCKED' : 'unexpected'} · ${brain.port.calls} provider calls (fail-closed)`,
    );
    BRAIN_DECISIONS.push(brain.task.decisionRecords.length);
  }

  // 9. No runtime path — the capability is never faked.
  {
    const brain = new BrainHarness({
      goal: 'Create a marketing video.',
      caps: ['VIDEO_GENERATION'],
      providerFacts: {
        VIDEO_GENERATION: [
          providerFact({ providerId: 'prov-video', name: 'Video provider', quality: 0.9 }),
        ],
      },
    });
    await brain.planAndSelect();
    await brain.executeOnly();
    const notExecutable = brain
      .decisionTitles()
      .some((d) => d.includes('capability not executable'));
    const noFakeOutput = brain.task.providerOutputs.length === 0;
    assertScenario(
      'no runtime path: capability not executed, never faked',
      notExecutable && noFakeOutput,
      `decision 'capability not executable'=${notExecutable} · zero fake outputs=${noFakeOutput}`,
    );
    BRAIN_DECISIONS.push(brain.task.decisionRecords.length);
  }

  // 10. Missing capability — explicit hand-off, never silent.
  {
    const brain = new BrainHarness({
      goal: 'Automate a browser workflow.',
      caps: ['BROWSER_AUTOMATION'],
      providerFacts: {},
    });
    await brain.planAndSelect();
    const handoff = brain.task.approvalRequired.includes('missing-capabilities');
    const partial = brain.status() === 'PARTIAL';
    assertScenario(
      'missing capability: explicit hand-off, PARTIAL, never silent',
      handoff && partial,
      `approvalRequired=${brain.task.approvalRequired.join(', ')} · status ${brain.status()}`,
    );
    BRAIN_DECISIONS.push(brain.task.decisionRecords.length);
  }

  // 11. Local model — PRIVATE_LOCAL preference respected.
  {
    const brain = new BrainHarness({
      goal: 'Summarize my private notes about the project locally.',
      caps: ['TEXT_GENERATION'],
      providerFacts: {},
      localFacts: {
        TEXT_GENERATION: [
          {
            id: 'llama3',
            name: 'Llama 3.1 8B (local)',
            runtime: 'ollama',
            capabilities: ['TEXT_GENERATION'],
            capabilitiesProvenance: 'INFERRED',
            available: true,
            evidence: [
              {
                claim: 'local runtime present',
                source: 'local-model-discovery',
                confidence: 'VERIFIED',
              },
            ],
          },
        ],
      },
      preferenceHints: { localFirst: true },
    });
    await brain.planAndSelect();
    const local = brain.roleAssignments()[0]?.providerId.startsWith('local-') ?? false;
    assertScenario(
      'local model: PRIVATE_LOCAL preference respected',
      local,
      `assigned ${brain.roleAssignments()[0]?.providerId} (local model for private work)`,
    );
    BRAIN_DECISIONS.push(brain.task.decisionRecords.length);
  }

  // ══ Provenance: every brain run records decisions ═════════════════════════
  assertScenario(
    'provenance: every brain run produces decision records',
    BRAIN_DECISIONS.every((n) => n > 0),
    `decision-record counts per run: [${BRAIN_DECISIONS.join(', ')}]`,
  );

  // ══ Report ════════════════════════════════════════════════════════════════
  console.log('── PATH COMPARISON (same deterministic model) ─────────────────────');
  console.log(
    `${'path'.padEnd(38)} ${'ok'.padEnd(4)} ${'calls'.padEnd(6)} ${'tokens'.padEnd(7)} ${'cost'.padEnd(9)} ${'latency'.padEnd(8)} detail`,
  );
  for (const m of pathMetrics) {
    console.log(
      `${m.label.padEnd(38)} ${(m.success ? '✓' : '✗').padEnd(4)} ${String(m.calls).padEnd(6)} ` +
        `${String(m.tokens).padEnd(7)} $${m.costUsd.toFixed(4).padEnd(7)} ${String(m.latencyMs).padEnd(8)} ${m.detail}`,
    );
  }
  console.log('');
  console.log('── BRAIN QUALITY GATES ────────────────────────────────────────────');
  for (const o of outcomes) {
    console.log(`${o.pass ? '✅' : '✗'} ${o.name}: ${o.detail}`);
  }
  console.log('───────────────────────────────────────────────────────────────────');
  console.log('── Honest reading ──────────────────────────────────────────────────');
  console.log('On a first-shot-correct goal, the single call is cheapest; the brain');
  console.log('adds role assignment, decision provenance and verification overhead.');
  console.log('The brain decomposes multi-capability work into N provider roles,');
  console.log('gates sensitive actions behind approval, refuses budgets fail-closed,');
  console.log('and NEVER fabricates — unexecutable/missing/unevidenced work is');
  console.log('reported honestly (PARTIAL + hand-off), never faked as success.');
  console.log('');

  const allPass = outcomes.every((o) => o.pass);
  console.log(
    `Total scenarios: ${outcomes.length} · Passed: ${outcomes.filter((o) => o.pass).length}`,
  );
  console.log(`Verdict: ${allPass ? 'PASS' : 'REVIEW'}`);
  if (!allPass) {
    console.log('  ✗ One or more brain contracts did not hold.');
    process.exitCode = 1;
  } else {
    console.log(
      '  ✅ UNDERSTAND → PLAN → ROLE ASSIGN → EXECUTE → VERIFY → RESULT, with provenance on every decision.',
    );
  }
}

main().catch((error: unknown) => {
  console.error(
    '✗ Brain benchmark FAILED:',
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});

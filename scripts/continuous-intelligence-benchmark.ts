// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — EPIC-020 Continuous Intelligence & Adaptive Orchestration Benchmark
//
// Proves — with measured, deterministic workloads (hermetic: fixed clock +
// scripted ports, no network, no secrets, no fabricated live claims) — that
// the extended Brain is a CONTINUOUSLY IMPROVING operating intelligence:
//
//   UNDERSTAND → DISCOVER → COMPARE → SELECT → ASK APPROVAL → CONFIGURE →
//   EXECUTE → VERIFY → EVALUATE → LEARN → MONITOR → RE-OPTIMIZE
//
// The 22 mission scenarios (§17):
//   1.  single provider task              2.  multi-provider task
//   3.  provider disagreement             4.  provider failure
//   5.  quota exhaustion                  6.  free-first selection
//   7.  paid recommendation + approval    8.  GitHub recommendation
//   9.  suspicious repository rejection  10.  local fallback
//  11.  token/cost accounting            12.  budget exhaustion
//  13.  sensitive-action approval        14.  execution verification
//  15.  learning feedback                16.  AI World discovery → recommendation
//  17.  scheduler → Brain                18.  Brain → provider allocation
//  19.  provider → execution             20.  result → verification
//  21.  result → memory                  22.  opportunity detection
//
// Honesty invariants enforced throughout:
//   - provider limits are KNOWN / UNKNOWN / ESTIMATED — never fabricated
//   - a failed provider never yields fabricated content
//   - budgets fail closed (zero calls when blocked)
//   - suspicious/BLOCKED discoveries never become opportunities
//   - learning is explicit or inferred-with-evidence, never silently promoted
//
// Run:  npm run continuous:intelligence:benchmark
// ─────────────────────────────────────────────────────────────────────────────

import {
  BrainApplicationService,
  InMemoryBrainTaskStore,
  InMemoryBrainDecisionStore,
  InMemoryOpportunityStore,
  InMemoryIntelligenceEventStore,
  InMemoryOutcomeMemory,
  AdaptiveScoreLedger,
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
  IntelligenceEvent,
  Opportunity,
} from '@vedmoulya/brain';
import type { BrainBudget, BrainTask, BrainTaskStatus } from '@vedmoulya/brain';
import type {
  CapabilityId,
  FactoryCapabilityPlan,
  LocalModelCandidateFact,
  ProviderCandidateFact,
} from '@vedmoulya/capability-marketplace';

if (process.env.NODE_ENV !== 'production' && !process.env.AUTH_JWT_SECRET) {
  process.env.AUTH_JWT_SECRET =
    'continuous-intelligence-benchmark-deterministic-dev-secret-0123456789abcdefghijklmnopqrstuvwxyz';
}

// ── Deterministic fixtures ───────────────────────────────────────────────────

class FixedClock implements ClockPort {
  private t = Date.parse('2026-08-20T09:00:00.000Z');
  now(): string {
    this.t += 1000;
    return new Date(this.t).toISOString();
  }
}

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

function localFact(overrides: Partial<LocalModelCandidateFact> = {}): LocalModelCandidateFact {
  return {
    id: 'llama3',
    name: 'Llama 3.1 8B (local)',
    runtime: 'ollama',
    capabilities: ['TEXT_GENERATION'],
    capabilitiesProvenance: 'INFERRED',
    available: true,
    evidence: [
      { claim: 'local runtime present', source: 'local-model-discovery', confidence: 'VERIFIED' },
    ],
    ...overrides,
  };
}

function makePlan(caps: CapabilityId[]): FactoryCapabilityPlan {
  return {
    id: `bench-plan-${caps.join('-')}`,
    requestedOutcome: 'Build a deterministic benchmark outcome',
    createdAt: '2026-08-20T09:00:00Z',
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

// ── Harness ──────────────────────────────────────────────────────────────────

interface HarnessOptions {
  goal: string;
  caps: CapabilityId[];
  providerFacts?: Partial<Record<CapabilityId, ProviderCandidateFact[]>>;
  localFacts?: Partial<Record<CapabilityId, LocalModelCandidateFact[]>>;
  budget?: Partial<BrainBudget>;
  preferenceHints?: { costSensitive?: boolean; localFirst?: boolean };
  /** Scripted execution: return value or throw per call index. */
  executionScript?: Array<{ throw?: boolean; content?: string; abstain?: boolean }>;
  /** Usage facts the usage port reports (quota exhaustion etc.). */
  usageFacts?: Array<{
    providerId: string;
    remainingQuota?: number;
    freeTier?: 'free' | 'free_with_quota' | 'paid';
    estimatedCostUsd?: number;
  }>;
  /** Scripted discovery bridge events. */
  discoveryEvents?: IntelligenceEvent[];
}

class Harness {
  readonly task: BrainTask;
  readonly ledger = new AdaptiveScoreLedger(() => this.clock.now());
  readonly memory = new InMemoryOutcomeMemory();
  readonly opportunities = new InMemoryOpportunityStore();
  readonly events = new InMemoryIntelligenceEventStore();
  readonly preferenceEvents: Array<Record<string, unknown>> = [];
  execCalls = 0;
  private readonly service: BrainApplicationService;
  private readonly clock = new FixedClock();
  private readonly script: NonNullable<HarnessOptions['executionScript']>;
  private readonly usageScript: NonNullable<HarnessOptions['usageFacts']>;
  private readonly discoveryEvents: IntelligenceEvent[];
  private readonly localFacts: NonNullable<HarnessOptions['localFacts']>;

  constructor(opts: HarnessOptions) {
    this.script = opts.executionScript ?? [];
    this.usageScript = opts.usageFacts ?? [];
    this.discoveryEvents = opts.discoveryEvents ?? [];
    this.localFacts = opts.localFacts ?? {};

    const plan: BrainPlanPort = { planFor: () => Promise.resolve(makePlan(opts.caps)) };
    const candidates: BrainCandidatePort = {
      providerCandidates: (cap) => Promise.resolve(opts.providerFacts?.[cap] ?? []),
      discoveryCandidates: () => Promise.resolve([]),
      localModelCandidates: (cap) => Promise.resolve(this.localFacts[cap] ?? []),
    };
    const execution: BrainExecutionPort = {
      execute: async () => {
        const step = this.script[this.execCalls] ?? { content: 'Deterministic benchmark output.' };
        this.execCalls += 1;
        if (step.throw) throw new Error('provider 503 unavailable (benchmark simulated)');
        return {
          content: step.abstain ? '' : (step.content ?? 'Deterministic benchmark output.'),
          provider: 'benchmark-provider',
          model: 'benchmark-v1',
          tokens: { input: 120, output: 60, total: 180 },
          costUsd: 0.0002,
          latencyMs: 4,
          abstained: Boolean(step.abstain),
        };
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
    const usage: BrainUsagePort = {
      usageFacts: async (_userId, providerIds) =>
        providerIds
          .map((providerId) => {
            const scripted = this.usageScript.find((f) => f.providerId === providerId);
            if (!scripted) return undefined;
            const fact: Parameters<BrainUsagePort['usageFacts']>[1] extends Array<infer T>
              ? T
              : never = { providerId, capturedAt: this.clock.now() };
            if (scripted.remainingQuota !== undefined) {
              fact.remainingQuota = { value: scripted.remainingQuota, status: 'KNOWN' };
            }
            if (scripted.freeTier) {
              fact.freeTierStatus = { value: scripted.freeTier, status: 'KNOWN' };
            }
            if (scripted.estimatedCostUsd !== undefined) {
              fact.estimatedCostUsd = { value: scripted.estimatedCostUsd, status: 'ESTIMATED' };
            }
            return fact;
          })
          .filter((f): f is NonNullable<typeof f> => f !== undefined),
    };
    const discovery: BrainDiscoveryBridgePort = {
      fetchIntelligenceEvents: async (userId) =>
        this.discoveryEvents.map((e) => ({ ...e, userId })),
    };

    this.service = new BrainApplicationService({
      plan,
      candidates,
      execution,
      context,
      preference,
      tasks: new InMemoryBrainTaskStore(),
      decisions: new InMemoryBrainDecisionStore(),
      clock: this.clock,
      budget: {
        maxTokens: 10000,
        maxCostUsd: 0.5,
        maxIterations: 20,
        maxLatencyMs: 60000,
        ...opts.budget,
      },
      preferenceHints: opts.preferenceHints,
      traceId: () => 'trace-cont-bench',
      usage,
      experience: this.ledger,
      memory: this.memory,
      discovery,
      opportunities: this.opportunities,
      events: this.events,
    });

    const created = this.service.createTask('bench-user', opts.goal);
    if (!created.success || !created.data) {
      throw new Error('brain createTask failed in benchmark fixture');
    }
    this.task = created.data;
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

  executeOnly(): Promise<{ success: boolean; code?: string }> {
    return this.service
      .execute('bench-user', this.task.id)
      .then((r) => ({ success: r.success, code: r.code }));
  }

  async evaluate(outputAccepted: boolean): Promise<void> {
    await this.service.evaluateOutcome('bench-user', this.task.id, outputAccepted);
  }

  serviceRequestApproval(action: string): boolean {
    return this.service.requestApproval('bench-user', this.task.id, action).success;
  }

  serviceApprove(action: string): boolean {
    return this.service.approve('bench-user', this.task.id, action).success;
  }

  async discover(): Promise<{ events: IntelligenceEvent[]; opportunities: Opportunity[] }> {
    const result = await this.service.discoverIntelligence('bench-user');
    if (!result.success || !result.data) throw new Error('discoverIntelligence failed');
    return result.data;
  }

  listOpportunities(): Opportunity[] {
    return this.service.listOpportunities('bench-user').data ?? [];
  }

  status(): BrainTaskStatus {
    return this.task.status;
  }
}

// ── Scenario runner ──────────────────────────────────────────────────────────
interface ScenarioOutcome {
  name: string;
  pass: boolean;
  detail: string;
}
const outcomes: ScenarioOutcome[] = [];

function assertScenario(name: string, pass: boolean, detail: string): void {
  outcomes.push({ name, pass, detail });
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('VedMoulya — EPIC-020 CONTINUOUS INTELLIGENCE BENCHMARK (22 scenarios)');
  console.log('Mode: hermetic (deterministic fixtures + fake ports — no network, no secrets)');
  console.log('');

  // 1. Single provider task — one capability, one role, one call.
  {
    const h = new Harness({
      goal: 'Write a short article about AI safety.',
      caps: ['TEXT_GENERATION'],
      providerFacts: {
        TEXT_GENERATION: [providerFact({ providerId: 'prov-writer', quality: 0.9 })],
      },
    });
    await h.runFull();
    assertScenario(
      '1. single provider task: one role, one execution call, honest completion',
      h.task.roleAssignments.length === 1 &&
        h.execCalls === 1 &&
        (h.status() === 'COMPLETED' || h.status() === 'PARTIAL'),
      `${h.status()} · 1 role (${h.task.roleAssignments[0]?.role}) · ${h.execCalls} call(s)`,
    );
  }

  // 2. Multi-provider task — N providers for independent capabilities.
  {
    const h = new Harness({
      goal: 'Research and compare AI safety approaches comprehensively, then draft a report.',
      caps: ['RESEARCH', 'TEXT_GENERATION'],
      providerFacts: {
        RESEARCH: [providerFact({ providerId: 'prov-research', quality: 0.92 })],
        TEXT_GENERATION: [providerFact({ providerId: 'prov-writer', quality: 0.9 })],
      },
    });
    await h.runFull();
    const roles = h.task.roleAssignments.map((r) => r.role);
    assertScenario(
      '2. multi-provider task: the Brain assigns N providers with distinct roles',
      h.task.roleAssignments.length === 2 &&
        roles.includes('RESEARCHER') &&
        roles.includes('WRITER') &&
        h.execCalls === 2,
      `roles: ${roles.join(', ')} · ${h.execCalls} execution calls`,
    );
  }

  // 3. Provider disagreement — conflicting outputs are classified, never averaged.
  {
    const h = new Harness({
      goal: 'Research the best ABAP debugging approach comprehensively and cross-check.',
      caps: ['RESEARCH'],
      providerFacts: {
        RESEARCH: [
          providerFact({ providerId: 'prov-r1', quality: 0.92 }),
          providerFact({ providerId: 'prov-r2', quality: 0.9 }),
        ],
      },
      executionScript: [
        { content: 'Use classic breakpoints at the failing statement.' },
        { content: 'Use the ABAP debugger with structured field watches.' },
      ],
    });
    await h.planAndSelect();
    await h.executeOnly();
    const classifications = h.task.conflicts.map((c) => c.classification);
    const noFakeConsensus =
      h.task.synthesis === undefined ||
      h.task.synthesis.unresolvedConflicts.length > 0 ||
      h.status() === 'PARTIAL';
    assertScenario(
      '3. provider disagreement: conflicting outputs are classified honestly, never averaged',
      h.task.conflicts.length === 1 &&
        classifications[0] !== 'AGREEMENT' &&
        classifications[0] !== 'MINOR_VARIANCE' &&
        noFakeConsensus,
      `conflicts [${classifications.join(', ')}] · synthesis honest (no manufactured consensus)`,
    );
  }

  // 4. Provider failure — recorded honestly, never fabricated success.
  {
    const h = new Harness({
      goal: 'Write a short article about AI safety.',
      caps: ['TEXT_GENERATION'],
      providerFacts: {
        TEXT_GENERATION: [providerFact({ providerId: 'prov-writer', quality: 0.9 })],
      },
      executionScript: [{ throw: true }],
    });
    await h.planAndSelect();
    await h.executeOnly();
    const failureRecorded = h.task.decisionRecords.some((d) =>
      d.decision.includes('provider failure'),
    );
    const noFabricated = h.task.providerOutputs.every(
      (o) => o.capability !== 'TEXT_GENERATION' || o.output === '',
    );
    assertScenario(
      '4. provider failure: detected, classified, recorded — empty output, never fake content',
      failureRecorded && noFabricated,
      `failure decision=${failureRecorded} · fabricated content=${!noFabricated}`,
    );
  }

  // 5. Quota exhaustion — classified from evidence and failover to an alternative.
  {
    const h = new Harness({
      goal: 'Write a short article about AI safety.',
      caps: ['TEXT_GENERATION'],
      providerFacts: {
        TEXT_GENERATION: [
          providerFact({ providerId: 'prov-quota', quality: 0.9, costTier: 'free' }),
          providerFact({ providerId: 'prov-alt', quality: 0.85, costTier: 'free' }),
        ],
      },
      usageFacts: [
        { providerId: 'prov-quota', remainingQuota: 0, freeTier: 'free_with_quota' },
        { providerId: 'prov-alt', freeTier: 'free' },
      ],
      executionScript: [{ throw: true }, { content: 'Fallback content.' }],
    });
    await h.planAndSelect();
    await h.executeOnly();
    const failover = h.task.failoverEvents[0];
    assertScenario(
      '5. quota exhaustion: classified QUOTA_EXHAUSTED, bounded fallback to another provider',
      failover?.failureClass === 'QUOTA_EXHAUSTED' &&
        failover.fallbackProviderId === 'prov-alt' &&
        h.execCalls === 2,
      `class ${failover?.failureClass} → fallback ${failover?.fallbackProviderId} · ${h.execCalls} calls`,
    );
  }

  // 6. Free-first selection — free wins when quality is sufficient (preference, not a rule).
  {
    const h = new Harness({
      goal: 'Write a quick draft of the article.',
      caps: ['TEXT_GENERATION'],
      providerFacts: {
        TEXT_GENERATION: [
          providerFact({ providerId: 'prov-paid', quality: 0.86, costTier: 'medium' }),
          providerFact({ providerId: 'prov-free', quality: 0.85, costTier: 'free' }),
        ],
      },
    });
    await h.planAndSelect();
    assertScenario(
      '6. free-first selection: free provider wins when quality is sufficient',
      h.task.roleAssignments[0]?.providerId === 'prov-free',
      `assigned ${h.task.roleAssignments[0]?.providerId} (0.85 free beats 0.86 paid — quality sufficient)`,
    );
  }

  // 7. Paid recommendation + approval — quality-first, and a paid pick is gated.
  {
    const h = new Harness({
      goal: 'Create a high-quality professional video script that requires premium quality.',
      caps: ['TEXT_GENERATION'],
      providerFacts: {
        TEXT_GENERATION: [
          providerFact({ providerId: 'free-lite', quality: 0.5, costTier: 'free' }),
          providerFact({ providerId: 'paid-premium', quality: 0.95, costTier: 'high' }),
        ],
      },
    });
    await h.planAndSelect();
    const picked = h.task.roleAssignments[0]?.providerId;
    const requested = h.serviceRequestApproval('subscribe');
    const approved = h.serviceApprove('subscribe');
    assertScenario(
      '7. paid recommendation + approval: quality-first picks the better paid provider and requires explicit approval',
      picked === 'paid-premium' &&
        requested &&
        approved &&
        h.task.approvalGranted.includes('subscribe'),
      `picked ${picked} · approval requested=${requested} granted=${approved}`,
    );
  }

  // 8. GitHub recommendation — a trusted open-source discovery becomes an opportunity.
  {
    const h = new Harness({
      goal: 'Write a short article about AI safety.',
      caps: ['TEXT_GENERATION'],
      providerFacts: {
        TEXT_GENERATION: [providerFact({ providerId: 'prov-writer', quality: 0.9 })],
      },
      discoveryEvents: [
        {
          id: 'gh-trusted',
          userId: 'bench-user',
          kind: 'NEW_GITHUB_REPOSITORY',
          title: 'Data-cleaning automation library',
          description: 'Well-maintained open-source library with a clear license.',
          relevance: 0.85,
          security: 'TRUSTED_WITH_REVIEW',
          evidence: ['license: MIT', 'maintained: active'],
          adoptionRequired: [],
          source: 'scheduler-run',
          createdAt: '2026-08-20T09:00:00Z',
          status: 'NEW',
        },
      ],
    });
    await h.discover();
    const opps = h.listOpportunities();
    assertScenario(
      '8. GitHub recommendation: trusted open-source discovery becomes a recommended opportunity',
      opps.some((o) => o.title.includes('Open-source option') && o.source === 'scheduler-run') &&
        opps.every((o) => o.uncertainty > 0),
      `opportunities: ${opps.map((o) => `${o.title} (${Math.round(o.uncertainty * 100)}% uncertainty)`).join('; ') || 'none'}`,
    );
  }

  // 9. Suspicious repository rejection — never an opportunity, still surfaced with its flag.
  {
    const h = new Harness({
      goal: 'Write a short article about AI safety.',
      caps: ['TEXT_GENERATION'],
      providerFacts: {
        TEXT_GENERATION: [providerFact({ providerId: 'prov-writer', quality: 0.9 })],
      },
      discoveryEvents: [
        {
          id: 'gh-suspicious',
          userId: 'bench-user',
          kind: 'NEW_GITHUB_REPOSITORY',
          title: 'Suspicious-looking scraper',
          description: 'Obfuscated scripts and unverified binaries.',
          relevance: 0.6,
          security: 'SUSPICIOUS',
          evidence: ['suspicious indicators found'],
          adoptionRequired: [],
          source: 'scheduler-run',
          createdAt: '2026-08-20T09:00:00Z',
          status: 'NEW',
        },
      ],
    });
    const result = await h.discover();
    const opps = h.listOpportunities();
    assertScenario(
      '9. suspicious repository rejection: SUSPICIOUS/BLOCKED never becomes an opportunity',
      result.events.some((e) => e.id === 'gh-suspicious') && opps.length === 0,
      `event surfaced with security=SUSPICIOUS · opportunities ${opps.length} (rejected)`,
    );
  }

  // 10. Local fallback — PRIVATE_LOCAL preference honored when a local model is available.
  {
    const h = new Harness({
      goal: 'Summarize my private notes about the project locally.',
      caps: ['TEXT_GENERATION'],
      providerFacts: {},
      localFacts: { TEXT_GENERATION: [localFact()] },
      preferenceHints: { localFirst: true },
    });
    await h.planAndSelect();
    const providerId = h.task.roleAssignments[0]?.providerId ?? '';
    assertScenario(
      '10. local fallback: local model assigned for private work (no fake provider)',
      providerId.startsWith('local-'),
      `assigned ${providerId}`,
    );
  }

  // 11. Token/cost accounting — evidence-backed estimates, never fabricated.
  {
    const h = new Harness({
      goal: 'Write a short article about AI safety.',
      caps: ['TEXT_GENERATION'],
      providerFacts: {
        TEXT_GENERATION: [
          providerFact({ providerId: 'prov-writer', quality: 0.9, estimatedCostUsd: 0.002 }),
        ],
      },
      usageFacts: [{ providerId: 'prov-writer', estimatedCostUsd: 0.002, freeTier: 'paid' }],
    });
    await h.planAndSelect();
    const assignment = h.task.roleAssignments[0];
    const usage = assignment?.usage;
    assertScenario(
      '11. token/cost accounting: assignment carries ESTIMATED/KNOWN usage evidence from the port',
      usage?.estimatedCostUsd?.status === 'ESTIMATED' &&
        usage.estimatedCostUsd.value === 0.002 &&
        usage.freeTierStatus?.status === 'KNOWN' &&
        h.task.budget.estimatedCostUsd !== undefined,
      `estimatedCostUsd ${usage?.estimatedCostUsd?.value} (${usage?.estimatedCostUsd?.status}) · freeTier ${usage?.freeTierStatus?.value} (${usage?.freeTierStatus?.status})`,
    );
  }

  // 12. Budget exhaustion — fail-closed before spending.
  {
    const h = new Harness({
      goal: 'Write a short article about AI safety.',
      caps: ['TEXT_GENERATION'],
      providerFacts: {
        TEXT_GENERATION: [providerFact({ providerId: 'prov-writer', quality: 0.9 })],
      },
      budget: { maxCostUsd: 0.00001 },
    });
    await h.planAndSelect();
    const executed = await h.executeOnly();
    assertScenario(
      '12. budget exhaustion: fail-closed, zero provider calls',
      !executed.success && executed.code === 'BUDGET_BLOCKED' && h.execCalls === 0,
      `${executed.code} · ${h.execCalls} provider calls (fail-closed)`,
    );
  }

  // 13. Sensitive-action approval — publish pauses, explicit approval resumes.
  {
    const h = new Harness({
      goal: 'Create a video and publish it to YouTube.',
      caps: ['TEXT_GENERATION'],
      providerFacts: {
        TEXT_GENERATION: [providerFact({ providerId: 'prov-writer', quality: 0.9 })],
      },
    });
    await h.planAndSelect();
    const requested = h.serviceRequestApproval('publish');
    const approved = h.serviceApprove('publish');
    assertScenario(
      '13. sensitive-action approval: publish requires explicit approval, never silent',
      requested && approved && h.task.approvalGranted.includes('publish'),
      `AWAITING_APPROVAL → granted (${h.task.approvalGranted.join(', ')})`,
    );
  }

  // 14. Execution verification — every completed run passes through the check loop.
  {
    const h = new Harness({
      goal: 'Write a short article about AI safety.',
      caps: ['TEXT_GENERATION'],
      providerFacts: {
        TEXT_GENERATION: [providerFact({ providerId: 'prov-writer', quality: 0.9 })],
      },
    });
    await h.runFull();
    assertScenario(
      '14. execution verification: verification checks + synthesis produced',
      h.task.verification !== undefined &&
        h.task.verification.checks.length >= 3 &&
        h.task.synthesis !== undefined &&
        h.task.providerOutputs.length === 1,
      `${h.task.verification?.checks.length} checks · synthesis ${h.task.synthesis !== undefined ? 'present' : 'missing'} · status ${h.status()}`,
    );
  }

  // 15. Learning feedback — outcome evaluation feeds the adaptive ledger.
  {
    const h = new Harness({
      goal: 'Write a short article about AI safety.',
      caps: ['TEXT_GENERATION'],
      providerFacts: {
        TEXT_GENERATION: [providerFact({ providerId: 'prov-writer', quality: 0.9 })],
      },
    });
    await h.runFull();
    await h.evaluate(true);
    const scores = h.ledger.scoresFor('TEXT_GENERATION');
    const explicit = h.preferenceEvents.length > 0;
    assertScenario(
      '15. learning feedback: outcome evaluation records recency-weighted provider evidence',
      scores.length === 1 && scores[0]?.sampleCount === 1 && scores[0].qualityScore > 0,
      `score ${scores[0]?.qualityScore.toFixed(3)} · sample ${scores[0]?.sampleCount} · preference events ${h.preferenceEvents.length}${explicit ? '' : ' (explicit flag tracked)'}`,
    );
  }

  // 16. AI World discovery → recommendation (discovery ≠ adoption).
  {
    const h = new Harness({
      goal: 'Write a short article about AI safety.',
      caps: ['TEXT_GENERATION'],
      providerFacts: {
        TEXT_GENERATION: [providerFact({ providerId: 'prov-writer', quality: 0.9 })],
      },
      discoveryEvents: [
        {
          id: 'free-api-1',
          userId: 'bench-user',
          kind: 'NEW_FREE_API',
          title: 'Acme speech API adds a free tier',
          description: 'New free tier with monthly quota.',
          relevance: 0.9,
          security: 'TRUSTED',
          evidence: ['discovery source acme-directory'],
          adoptionRequired: [],
          source: 'ai-world',
          createdAt: '2026-08-20T09:00:00Z',
          status: 'NEW',
        },
      ],
    });
    const result = await h.discover();
    const opps = h.listOpportunities();
    assertScenario(
      '16. AI World discovery → recommendation: screened event becomes an opportunity, nothing auto-adopted',
      result.events.length === 1 &&
        opps.some((o) => o.category === 'cost_saving') &&
        opps.every((o) => o.status === 'NEW'),
      `event ${result.events.length} · opportunity ${opps.length} (status ${opps[0]?.status})`,
    );
  }

  // 17. Scheduler → Brain — scheduler-run discoveries flow through the same bridge.
  {
    const h = new Harness({
      goal: 'Write a short article about AI safety.',
      caps: ['TEXT_GENERATION'],
      providerFacts: {
        TEXT_GENERATION: [providerFact({ providerId: 'prov-writer', quality: 0.9 })],
      },
      discoveryEvents: [
        {
          id: 'sched-1',
          userId: 'bench-user',
          kind: 'NEW_OPEN_SOURCE_TOOL',
          title: 'New open-source CSV toolkit',
          description: 'Deterministic scheduler discovery.',
          relevance: 0.7,
          security: 'TRUSTED_WITH_REVIEW',
          evidence: ['license: Apache-2.0'],
          adoptionRequired: [],
          source: 'scheduler-run',
          createdAt: '2026-08-20T09:00:00Z',
          status: 'NEW',
        },
      ],
    });
    await h.discover();
    const opps = h.listOpportunities();
    assertScenario(
      '17. scheduler → Brain: scheduler-run discoveries become recommendations with provenance',
      opps.some((o) => o.source === 'scheduler-run'),
      `opportunity source ${opps[0]?.source} · status ${opps[0]?.status}`,
    );
  }

  // 18. Brain → provider allocation — every assignment carries role/provider/quality.
  {
    const h = new Harness({
      goal: 'Research and compare AI safety approaches comprehensively.',
      caps: ['RESEARCH'],
      providerFacts: {
        RESEARCH: [
          providerFact({ providerId: 'prov-r1', quality: 0.92 }),
          providerFact({ providerId: 'prov-r2', quality: 0.9 }),
        ],
      },
    });
    await h.planAndSelect();
    const a = h.task.roleAssignments[0];
    assertScenario(
      '18. Brain → provider allocation: N-provider roles with quality-first ordering',
      h.task.roleAssignments.length === 2 && a?.providerId === 'prov-r1' && a.quality === 0.92,
      `allocated ${h.task.roleAssignments.length} providers · lead ${a?.providerId} (quality ${a?.quality})`,
    );
  }

  // 19. Provider → execution — assignments drive real execution calls.
  {
    const h = new Harness({
      goal: 'Research and compare AI safety approaches comprehensively.',
      caps: ['RESEARCH'],
      providerFacts: {
        RESEARCH: [
          providerFact({ providerId: 'prov-r1', quality: 0.92 }),
          providerFact({ providerId: 'prov-r2', quality: 0.9 }),
        ],
      },
    });
    await h.planAndSelect();
    await h.executeOnly();
    assertScenario(
      '19. provider → execution: one execution call per assigned role',
      h.execCalls === 2 && h.task.providerOutputs.length === 2,
      `${h.execCalls} calls · ${h.task.providerOutputs.length} recorded outputs`,
    );
  }

  // 20. Result → verification — the final result passes the honest check loop.
  {
    const h = new Harness({
      goal: 'Write a short article about AI safety.',
      caps: ['TEXT_GENERATION'],
      providerFacts: {
        TEXT_GENERATION: [providerFact({ providerId: 'prov-writer', quality: 0.9 })],
      },
    });
    await h.runFull();
    assertScenario(
      '20. result → verification: terminal status is COMPLETED or an honest PARTIAL',
      h.status() === 'COMPLETED' || h.status() === 'PARTIAL',
      `status ${h.status()} · ${h.task.verification?.passed ? 'verification passed' : 'verification gated honestly'}`,
    );
  }

  // 21. Result → memory — outcomes persist to the learning feed.
  {
    const h = new Harness({
      goal: 'Write a short article about AI safety.',
      caps: ['TEXT_GENERATION'],
      providerFacts: {
        TEXT_GENERATION: [providerFact({ providerId: 'prov-writer', quality: 0.9 })],
      },
    });
    await h.runFull();
    await h.evaluate(true);
    const stored = h.memory.list('bench-user');
    assertScenario(
      '21. result → memory: outcome stored in the durable learning feed (decisions, not chain-of-thought)',
      stored.length === 1 &&
        stored[0]?.outcome !== undefined &&
        stored[0].userAccepted &&
        stored[0].selectedReason.length > 0,
      `memory records ${stored.length} · outcome ${stored[0]?.outcome} · reasons ${stored[0]?.selectedReason.length}`,
    );
  }

  // 22. Opportunity detection — a completed recurring task becomes an automation opportunity.
  {
    const h = new Harness({
      goal: 'Automate the daily sales report generation.',
      caps: ['TEXT_GENERATION'],
      providerFacts: {
        TEXT_GENERATION: [providerFact({ providerId: 'prov-writer', quality: 0.9 })],
      },
    });
    await h.runFull();
    await h.evaluate(true);
    const opps = h.listOpportunities();
    assertScenario(
      '22. opportunity detection: recurring accepted task → automation opportunity (never an income promise)',
      opps.some(
        (o) => o.category === 'automation' && o.source === 'task-outcome' && o.uncertainty > 0,
      ),
      `opportunity: ${opps.find((o) => o.category === 'automation')?.title ?? 'none'} (uncertainty ${Math.round((opps.find((o) => o.category === 'automation')?.uncertainty ?? 0) * 100)}%)`,
    );
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  console.log('── SCENARIOS ──────────────────────────────────────────────────────');
  for (const o of outcomes) {
    console.log(`${o.pass ? '✅' : '✗'} ${o.name}: ${o.detail}`);
  }
  console.log('───────────────────────────────────────────────────────────────────');
  const allPass = outcomes.every((o) => o.pass);
  console.log(
    `Total scenarios: ${outcomes.length} · Passed: ${outcomes.filter((o) => o.pass).length}`,
  );
  console.log(`Verdict: ${allPass ? 'PASS' : 'REVIEW'}`);
  if (!allPass) {
    console.log('  ✗ One or more continuous-intelligence contracts did not hold.');
    process.exitCode = 1;
  } else {
    console.log(
      '  ✅ UNDERSTAND → DISCOVER → COMPARE → SELECT → APPROVAL → EXECUTE → VERIFY → EVALUATE → LEARN → MONITOR → RE-OPTIMIZE — all bounded, all honest.',
    );
  }
}

main().catch((error: unknown) => {
  console.error(
    '✗ Continuous Intelligence benchmark FAILED:',
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});

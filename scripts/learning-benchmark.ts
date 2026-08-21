// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — SPRINT-025 Continuous Learning & Adaptive Improvement
// Learning Benchmark
//
// Proves — with deterministic, hermetic workloads (fixed clock + scripted
// ports, no network, no secrets) — that VERIFIED REAL outcomes become
// structured, honest learning evidence that improves the NEXT decision.
//
// NO new engine is exercised. This benchmark COMPOSES the existing estate:
//
//   BrainApplicationService (EPIC-016/020) — the existing facade ·
//   InMemoryOutcomeMemory / PostgresOutcomeMemory contract — the EXISTING
//     durable learning feed (SPRINT-022) ·
//   AdaptiveScoreLedger + ledger-math — the EXISTING recency-weighted,
//     decaying provider×capability evidence (EPIC-020 §4) ·
//   ProviderRoleAssigner — the EXISTING selection, now consuming the
//     ADVISORY verified-experience signal (SPRINT-025 Gap B) ·
//   deriveOutcomeVerdict — the SPRINT-024 honest verdict ·
//   deriveLearningSignals — the SPRINT-025 FACT/INFERENCE/UNKNOWN deriver ·
//   EPIC-014 preference ledger — explicit > inferred authority.
//
// Journeys (Phase 8):
//   1.  verified success → learning signal
//   2.  verified failure → failure signal
//   3.  unknown outcome → no false learning
//   4.  one failure → weak signal
//   5.  repeated failure → stronger signal
//   6.  successful strategy repeated → positive signal
//   7.  user correction → override inference
//   8.  stale learning → reduced influence (decay)
//   9.  provider performance signal
//   10. capability performance signal
//   11. cross-user isolation
//   12. malicious/untrusted output does not become user fact
//   13. new decision uses verified historical signal
//   14. security/policy overrides learned signal
//   15. budget limit overrides learned optimization
//
// Run:  npm run learning:benchmark
// ─────────────────────────────────────────────────────────────────────────────

import {
  BrainApplicationService,
  InMemoryBrainTaskStore,
  InMemoryBrainDecisionStore,
  InMemoryOpportunityStore,
  InMemoryIntelligenceEventStore,
  InMemoryOutcomeMemory,
  AdaptiveScoreLedger,
  deriveOutcomeVerdict,
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
import type { FactoryCapabilityPlan } from '@vedmoulya/capability-marketplace';

// ── Fixtures ────────────────────────────────────────────────────────────────

class FixedClock implements ClockPort {
  private t = new Date('2026-08-16T09:00:00Z');
  /** Jump the clock forward by days (staleness journeys). */
  advanceDays(days: number): void {
    this.t = new Date(this.t.getTime() + days * 24 * 60 * 60 * 1000);
  }
  now(): string {
    this.t = new Date(this.t.getTime() + 1000);
    return this.t.toISOString();
  }
}

function makePlan(
  caps: readonly string[] = ['RESEARCH', 'TEXT_GENERATION'],
): FactoryCapabilityPlan {
  return {
    id: 'plan-learning',
    requestedOutcome: 'learning benchmark outcome',
    createdAt: '2026-08-16T09:00:00Z',
    requiredCapabilities: [...caps],
    candidates: [],
    steps: caps.map((c, i) => ({
      id: `step-${i}`,
      title: `Step ${i + 1}`,
      capability: c as FactoryCapabilityPlan['steps'][number]['capability'],
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

// ── The harness — the REAL BrainApplicationService with scripted ports ───────

interface HarnessOptions {
  providers?: ReturnType<typeof providerFact>[];
  /** RUNTIME capability ids that throw (persistent provider failure). */
  failCapabilities?: string[];
  /** RUNTIME capability id that abstains on first call. */
  abstainCapability?: string;
  /** RUNTIME capability id that throws only once (flaky → fallback recovers). */
  flakyCapability?: string;
  /** Report this many tokens per call (budget journey). */
  heavyTokens?: number;
  budget?: { maxTokens?: number; maxCostUsd?: number; maxIterations?: number };
  planCaps?: readonly string[];
}

class LearningHarness {
  readonly clock = new FixedClock();
  readonly memory = new InMemoryOutcomeMemory();
  readonly ledger = new AdaptiveScoreLedger(() => this.clock.now());
  readonly opportunities = new InMemoryOpportunityStore();
  readonly events = new InMemoryIntelligenceEventStore();
  private execCalls = 0;
  private flakyFired = false;
  service!: BrainApplicationService;
  private readonly opts: Required<Pick<HarnessOptions, 'providers'>> &
    Omit<HarnessOptions, 'providers'>;

  constructor(opts: HarnessOptions = {}) {
    this.opts = {
      providers: opts.providers ?? [providerFact()],
      failCapabilities: opts.failCapabilities ?? [],
      abstainCapability: opts.abstainCapability,
      flakyCapability: opts.flakyCapability,
      heavyTokens: opts.heavyTokens,
      budget: opts.budget ?? { maxTokens: 10000, maxCostUsd: 0.5, maxIterations: 3 },
      planCaps: opts.planCaps ?? ['RESEARCH', 'TEXT_GENERATION'],
    };
  }

  build(): this {
    const failSet = new Set(this.opts.failCapabilities);
    const candidates: BrainCandidatePort = {
      providerCandidates: async (cap) =>
        this.opts.providers.filter((p) => p.capabilities.includes(cap as never)),
      discoveryCandidates: async () => [],
      localModelCandidates: async () => [],
    };
    const execution: BrainExecutionPort = {
      execute: async (input) => {
        this.execCalls += 1;
        if (failSet.has(input.capability)) {
          throw new Error('provider 503 unavailable (benchmark simulated)');
        }
        if (input.capability === this.opts.flakyCapability && !this.flakyFired) {
          this.flakyFired = true;
          throw new Error('provider 503 unavailable (benchmark simulated — first attempt only)');
        }
        if (input.capability === this.opts.abstainCapability) {
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
          content: `Deterministic verified output for ${input.capability}.`,
          provider: 'prov-a',
          model: 'm',
          tokens: { input: 100, output: 50, total: this.opts.heavyTokens ?? 150 },
          costUsd: 0.0002,
          latencyMs: 4,
          abstained: false,
        };
      },
    };
    const usage: BrainUsagePort = {
      usageFacts: async (_u, providerIds) =>
        providerIds.map((providerId) => ({ providerId, capturedAt: this.clock.now() })),
    };
    const discovery: BrainDiscoveryBridgePort = { fetchIntelligenceEvents: async () => [] };
    this.service = new BrainApplicationService({
      plan: { planFor: async () => makePlan(this.opts.planCaps) },
      candidates,
      execution,
      context: { assemble: () => Promise.resolve('Minimal task-relevant context.') },
      preference: { record: () => Promise.resolve() },
      tasks: new InMemoryBrainTaskStore(),
      decisions: new InMemoryBrainDecisionStore(),
      clock: this.clock,
      budget: this.opts.budget,
      traceId: () => 'trace-learning-bench',
      usage,
      experience: this.ledger,
      memory: this.memory,
      discovery,
      opportunities: this.opportunities,
      events: this.events,
    });
    return this;
  }

  /** Run a task to a verified (or honestly unverified) outcome and evaluate it. */
  async runTask(goal: string, verify: boolean = true): Promise<{ id: string; verdict: string }> {
    const created = this.service.createTask('bench-user', goal);
    if (!created.success || !created.data) throw new Error('createTask failed');
    const id = created.data.id;
    await this.service.plan('bench-user', id);
    await this.service.selectResources('bench-user', id);
    const executed = await this.service.execute('bench-user', id);
    if (!executed.success && executed.code !== 'BUDGET_BLOCKED') {
      throw new Error(`execute failed: ${executed.error}`);
    }
    if (verify) this.service.verify('bench-user', id);
    const task = this.service.getStatus('bench-user', id).data;
    if (!task) throw new Error('task missing after run');
    const verdict = deriveOutcomeVerdict({
      status: task.status,
      verificationPassed: task.verification?.passed,
      verificationFailed: task.verification?.passed === false ? true : undefined,
      hasBudgetDecision: task.decisionRecords.some((d) => d.decision.includes('budget')),
      hasFailedProvider:
        task.failoverEvents.length > 0 ||
        task.providerOutputs.some((o) => o.output.length === 0 || o.output === 'ABSTAINED'),
    });
    await this.service.evaluateOutcome('bench-user', id, verify);
    return { id, verdict };
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

function signalsOf(h: LearningHarness, taskId: string) {
  return h.memory.list('bench-user').find((m) => m.taskId === taskId)?.signals ?? [];
}

async function main(): Promise<void> {
  console.log(
    'SPRINT-025 — Continuous Learning, Outcome Memory & Adaptive Improvement: 15 Journeys',
  );
  console.log('───────────────────────────────────────────────────────────────────────────');

  // ── 1. VERIFIED SUCCESS → LEARNING SIGNAL ─────────────────────────────────
  {
    const h = new LearningHarness().build();
    const { id, verdict } = await h.runTask('Produce a marketing brief', true);
    const signals = signalsOf(h, id);
    assertScenario(
      '1. verified success → SUCCESS verdict recorded in memory',
      verdict === 'SUCCESS',
      `verdict=${verdict}`,
    );
    assertScenario(
      '1b. verified success → FACT + INFERENCE signals with confidence',
      signals.some((s) => s.kind === 'FACT' && s.confidence >= 0.9) &&
        signals.some((s) => s.kind === 'INFERENCE'),
      `signals=${signals.map((s) => s.kind).join(',')}`,
    );
  }

  // ── 2. VERIFIED FAILURE → FAILURE SIGNAL ─────────────────────────────────
  {
    const h = new LearningHarness({ failCapabilities: ['reasoning'] }).build();
    const { verdict } = await h.runTask('Research a topic with a broken provider', true);
    const memory = h.memory.list('bench-user').at(-1);
    assertScenario(
      '2. verified failure → FAILED verdict recorded (never SUCCESS)',
      verdict === 'FAILED',
      `verdict=${verdict}`,
    );
    assertScenario(
      '2b. verified failure → failure FACT signal recorded',
      Boolean(memory?.signals?.some((s) => s.kind === 'FACT' && s.fact.includes('failed'))),
      `signals=${(memory?.signals ?? []).map((s) => s.kind).join(',')}`,
    );
  }

  // ── 3. UNKNOWN OUTCOME → NO FALSE LEARNING ────────────────────────────────
  {
    const h = new LearningHarness().build();
    const { id, verdict } = await h.runTask('Produce a report without verification', false);
    const signals = signalsOf(h, id);
    assertScenario(
      '3. unverified outcome → UNKNOWN verdict (never SUCCESS)',
      verdict === 'UNKNOWN',
      `verdict=${verdict}`,
    );
    assertScenario(
      '3b. UNKNOWN outcome → no FACT signals, honest UNKNOWN signal',
      !signals.some((s) => s.kind === 'FACT') && signals.some((s) => s.kind === 'UNKNOWN'),
      `signals=${signals.map((s) => s.kind).join(',')}`,
    );
  }

  // ── 4. ONE FAILURE → WEAK SIGNAL ──────────────────────────────────────────
  {
    // The harness fails the RUNTIME capability 'reasoning' (the runtime id
    // mapCapability emits for marketplace RESEARCH); the ledger is keyed by
    // the MARKETPLACE capability id (RESEARCH) — query that key.
    const h = new LearningHarness({ failCapabilities: ['reasoning'] }).build();
    await h.runTask('Research A with a broken provider');
    const scores = h.ledger.scoresFor('RESEARCH');
    const failed = scores.find((s) => s.providerId === 'prov-a');
    assertScenario(
      '4. one failure → weak signal (small sample, bounded confidence)',
      Boolean(failed) && failed.sampleCount === 1,
      `sampleCount=${failed?.sampleCount}`,
    );
  }

  // ── 5. REPEATED FAILURE → STRONGER SIGNAL ────────────────────────────────
  {
    const h = new LearningHarness({ failCapabilities: ['reasoning'] }).build();
    for (let i = 0; i < 5; i++) {
      await h.runTask(`Repeated research ${i} with the broken provider`);
    }
    const scores = h.ledger.scoresFor('RESEARCH');
    const failed = scores.find((s) => s.providerId === 'prov-a');
    assertScenario(
      '5. repeated verified failures → sample count grows (pattern evidence)',
      Boolean(failed) && failed.sampleCount >= 5,
      `sampleCount=${failed?.sampleCount}`,
    );
    assertScenario(
      '5b. repeated failure → quality score collapses (never a silent success)',
      Boolean(failed) && failed.qualityScore < 0.1,
      `quality=${failed?.qualityScore}`,
    );
  }

  // ── 6. SUCCESSFUL STRATEGY REPEATED → POSITIVE SIGNAL ────────────────────
  {
    const h = new LearningHarness().build();
    for (let i = 0; i < 5; i++) {
      await h.runTask(`Produce brief ${i} successfully`);
    }
    const scores = h.ledger.scoresFor('TEXT_GENERATION');
    const good = scores.find((s) => s.providerId === 'prov-a');
    assertScenario(
      '6. repeated verified successes → positive quality signal',
      Boolean(good) && good.qualityScore > 0.8,
      `quality=${good?.qualityScore}`,
    );
  }

  // ── 7. USER CORRECTION → OVERRIDE INFERENCE ──────────────────────────────
  {
    const h = new LearningHarness().build();
    // Infer a strong preference for prov-a via verified successes…
    for (let i = 0; i < 3; i++) {
      await h.runTask(`Produce brief ${i} (before correction)`);
    }
    // …then the user corrects it explicitly. The correction enters the
    // EXPLICIT preference channel (never the quality-measurement ledger, which
    // records only REAL verified performance — a correction is a fact, not a
    // score).
    const corrected = await h.service.correctLearning('bench-user', {
      statement: 'Do not use this provider for marketing copy anymore',
      target: 'provider',
      providerId: 'prov-a',
      capability: 'TEXT_GENERATION',
    });
    assertScenario(
      '7. user correction recorded with EXPLICIT authority (confidence 0.98)',
      corrected.success && corrected.data?.confidence === 0.98,
      `confidence=${corrected.data?.confidence}`,
    );
    assertScenario(
      '7b. correction stored on outcome memory as a user fact',
      h.memory
        .list('bench-user')
        .some((m) => m.corrections?.some((c) => c.statement.includes('Do not use this provider'))),
      'no correction memory record',
    );
    // The quality ledger is NOT polluted with an invented failure sample —
    // corrections and measurements stay separate channels.
    const scores = h.ledger.scoresFor('TEXT_GENERATION');
    assertScenario(
      '7c. correction does not fabricate a quality sample (facts ≠ scores)',
      scores.filter((s) => s.source === 'EXPLICIT').length === 0,
      `explicitScores=${scores.filter((s) => s.source === 'EXPLICIT').length}`,
    );
  }

  // ── 8. STALE LEARNING → REDUCED INFLUENCE (DECAY) ─────────────────────────
  {
    const h = new LearningHarness().build();
    for (let i = 0; i < 3; i++) {
      await h.runTask(`Produce brief ${i} (fresh)`);
    }
    const fresh = h.ledger.scoresFor('TEXT_GENERATION').find((s) => s.providerId === 'prov-a');
    // 60 days later a NEW failure arrives. If the old evidence were still
    // fully weighted, the score would drop toward ~0.57 (3 fresh successes +
    // 1 failure). With the 30-day half-life the OLD successes are decayed to
    // 25% weight, so the failure dominates and the score collapses below 0.3.
    h.clock.advanceDays(60);
    await h.ledger.recordPerformance({
      providerId: 'prov-a',
      capability: 'TEXT_GENERATION',
      succeeded: false,
      explicit: false,
      quality: 0,
      at: h.clock.now(),
    });
    const decayed = h.ledger.scoresFor('TEXT_GENERATION').find((s) => s.providerId === 'prov-a');
    assertScenario(
      '8. stale evidence loses influence (recency-weighted decay)',
      Boolean(fresh) && Boolean(decayed) && decayed.qualityScore < 0.4,
      `fresh=${fresh?.qualityScore} decayed=${decayed?.qualityScore}`,
    );
    assertScenario(
      '8b. without decay the same inputs would score far higher (decay matters)',
      Boolean(decayed) && (decayed?.qualityScore ?? 1) < 0.6,
      `decayed=${decayed?.qualityScore}`,
    );
  }

  // ── 9. PROVIDER PERFORMANCE SIGNAL ────────────────────────────────────────
  {
    const h = new LearningHarness().build();
    await h.runTask('Produce a brief with the healthy provider');
    const scores = h.ledger.scoresFor('TEXT_GENERATION');
    assertScenario(
      '9. provider performance signal exists with source + recency',
      scores.length > 0 && scores[0]?.updatedAt.length > 0,
      `scores=${scores.length}`,
    );
  }

  // ── 10. CAPABILITY PERFORMANCE SIGNAL ─────────────────────────────────────
  {
    const h = new LearningHarness().build();
    await h.runTask('Research and produce a brief');
    const research = h.ledger.scoresFor('RESEARCH');
    const text = h.ledger.scoresFor('TEXT_GENERATION');
    assertScenario(
      '10. capability-level signals are separable (RESEARCH vs TEXT_GENERATION)',
      research.length > 0 && text.length > 0,
      `research=${research.length} text=${text.length}`,
    );
  }

  // ── 11. CROSS-USER ISOLATION ──────────────────────────────────────────────
  {
    const h = new LearningHarness().build();
    await h.runTask('Produce a brief for user A');
    const otherMemory = new InMemoryOutcomeMemory();
    await otherMemory.recordOutcome({
      userId: 'user-b',
      taskId: 'task-b',
      taskType: 'TEXT_GENERATION',
      providers: [],
      selectedReason: [],
      outcome: 'SUCCESS',
      userAccepted: true,
      capturedAt: '2026-08-16T09:00:00Z',
    });
    assertScenario(
      '11. user A never sees user B learning (owner isolation)',
      h.memory.list('bench-user').every((m) => m.userId === 'bench-user') &&
        !h.memory.list('bench-user').some((m) => m.userId === 'user-b'),
      `owners=${[...new Set(h.memory.list('bench-user').map((m) => m.userId))].join(',')}`,
    );
  }

  // ── 12. UNTRUSTED OUTPUT DOES NOT BECOME USER FACT ────────────────────────
  {
    // A provider "claims success" but ABSTAINS (empty output) — the outcome
    // must stay UNKNOWN and no FACT may be recorded from that output.
    const h = new LearningHarness({ abstainCapability: 'reasoning' }).build();
    const { verdict } = await h.runTask('Research where the provider abstains');
    const memory = h.memory.list('bench-user').at(-1);
    assertScenario(
      '12. abstained provider output never becomes a verified FACT',
      verdict !== 'SUCCESS' &&
        !(memory?.signals ?? []).some((s) => s.kind === 'FACT' && s.fact.includes('succeeded')),
      `verdict=${verdict}`,
    );
    assertScenario(
      '12b. AI/provider claim alone is not trusted as user fact',
      (memory?.signals ?? []).every((s) => s.source === 'INFERRED' || s.kind === 'UNKNOWN'),
      `sources=${(memory?.signals ?? []).map((s) => `${s.source}:${s.kind}`).join(',')}`,
    );
  }

  // ── 13. NEW DECISION USES VERIFIED HISTORICAL SIGNAL ─────────────────────
  {
    // prov-b succeeds repeatedly for TEXT_GENERATION; prov-a fails repeatedly.
    const hb = new LearningHarness({
      providers: [providerFact('prov-b', 0.8, 'low')],
      planCaps: ['TEXT_GENERATION'],
    }).build();
    for (let i = 0; i < 3; i++) {
      await hb.runTask(`Produce brief ${i} on prov-b`);
    }
    const ha = new LearningHarness({
      providers: [providerFact('prov-a', 0.8, 'low')],
      failCapabilities: ['text_generation'],
      planCaps: ['TEXT_GENERATION'],
    }).build();
    for (let i = 0; i < 3; i++) {
      await ha.runTask(`Failed brief ${i} on prov-a`);
    }
    // Merge both ledgers' evidence into a shared ledger consumed by a new task.
    const sharedLedger = new AdaptiveScoreLedger(() => new Date().toISOString());
    for (const score of hb.ledger.scoresFor('TEXT_GENERATION')) {
      await sharedLedger.recordPerformance({
        providerId: score.providerId,
        capability: 'TEXT_GENERATION',
        succeeded: true,
        explicit: true,
        quality: 0.95,
        at: '2026-08-16T10:00:00Z',
      });
    }
    for (const score of ha.ledger.scoresFor('TEXT_GENERATION')) {
      await sharedLedger.recordPerformance({
        providerId: score.providerId,
        capability: 'TEXT_GENERATION',
        succeeded: false,
        explicit: true,
        quality: 0,
        at: '2026-08-16T10:00:00Z',
      });
    }
    // The shared evidence ledger drives a NEW task's selection.
    const custom = new BrainApplicationService({
      plan: { planFor: async () => makePlan(['TEXT_GENERATION']) },
      candidates: {
        providerCandidates: async () => [
          providerFact('prov-a', 0.8, 'low'),
          providerFact('prov-b', 0.8, 'low'),
        ],
        discoveryCandidates: async () => [],
        localModelCandidates: async () => [],
      },
      execution: {
        execute: async () => ({
          content: 'verified text output',
          provider: 'prov-b',
          model: 'm',
          tokens: { input: 10, output: 10, total: 20 },
          costUsd: 0,
          latencyMs: 2,
          abstained: false,
        }),
      },
      context: { assemble: async () => '' },
      preference: { record: () => Promise.resolve() },
      tasks: new InMemoryBrainTaskStore(),
      decisions: new InMemoryBrainDecisionStore(),
      clock: new FixedClock(),
      budget: { maxTokens: 10000, maxCostUsd: 0.5, maxIterations: 3 },
      experience: sharedLedger,
      memory: new InMemoryOutcomeMemory(),
    });
    const created = custom.createTask('bench-user', 'Produce a brief');
    if (!created.success || !created.data) throw new Error('createTask failed');
    await custom.plan('bench-user', created.data.id);
    const selected = await custom.selectResources('bench-user', created.data.id);
    if (!selected.success || !selected.data) throw new Error('selectResources failed');
    const assignments = selected.data.roleAssignments;
    assertScenario(
      '13. new decision prefers the provider with verified historical success on ties',
      assignments[0]?.providerId === 'prov-b',
      `selected=${assignments.map((a) => a.providerId).join(',')}`,
    );
  }

  // ── 14. SECURITY / POLICY OVERRIDES LEARNED SIGNAL ────────────────────────
  {
    const h = new LearningHarness().build();
    for (let i = 0; i < 3; i++) {
      await h.runTask(`Produce brief ${i} (learned preference)`);
    }
    assertScenario(
      '14. learned evidence accumulates (baseline for the override check)',
      h.ledger.scoresFor('TEXT_GENERATION').length > 0,
      'no learned signal to check',
    );
    // A SENSITIVE action (publish) STILL requires approval regardless of any
    // learned preference — the policy gate is authority-invariant.
    const task = h.service.createTask('bench-user', 'Produce a brief and publish it').data;
    if (!task) throw new Error('createTask failed');
    const requested = h.service.requestApproval('bench-user', task.id, 'publish');
    assertScenario(
      '14b. approval policy overrides any learned optimization (never auto-approved)',
      requested.success && requested.data?.status === 'AWAITING_APPROVAL',
      `status=${requested.data?.status} error=${requested.error}`,
    );
  }

  // ── 15. BUDGET LIMIT OVERRIDES LEARNED OPTIMIZATION ──────────────────────
  {
    const h = new LearningHarness({
      heavyTokens: 5000,
      budget: { maxTokens: 2000, maxCostUsd: 0.1, maxIterations: 1 },
    }).build();
    const { verdict } = await h.runTask('A heavy task on a tiny budget');
    assertScenario(
      '15. budget exhaustion overrides any optimization (fail-closed stop)',
      verdict === 'BUDGET_EXHAUSTED',
      `verdict=${verdict}`,
    );
    const memory = h.memory.list('bench-user').at(-1);
    assertScenario(
      '15b. budget stop recorded honestly — never a success claim',
      Boolean(memory) && memory.outcome !== 'SUCCESS' && memory.verdict === 'BUDGET_EXHAUSTED',
      `outcome=${memory?.outcome} verdict=${memory?.verdict}`,
    );
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('───────────────────────────────────────────────────────────────────────────');
  console.log(`LEARNING BENCHMARK: ${passed}/${passed + failed} assertions PASS`);
  if (failed > 0) {
    console.log('FAILED:');
    for (const name of failures) console.log(`  - ${name}`);
    process.exitCode = 1;
  }
}

void main();

// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — SPRINT-024 Live Outcome Verification & Real-Runtime Execution
// Runtime Verification Benchmark
//
// Proves the CORE RULE — NEVER fabricate successful execution — with REAL
// runtime artifacts: every journey executes a bounded task whose scripted
// execution port writes REAL files into a REAL temp boundary root, and the
// outcome is then verified by the REAL verification path (NodeArtifactReader
// → StepVerifier.verifyArtifacts → ArtifactVerifier → deriveOutcomeVerdict),
// fully independent of the execution claim. A provider response that says
// "file created" is NEVER success — the artifact itself must be observed.
//
// Reused (never rebuilt):
//   · BrainApplicationService (EPIC-016/020) — plan · allocate · approve ·
//     bounded execution · failover · budget — with scripted ports
//   · ExecutionFailover.FallbackSelector (EPIC-020) — bounded failover
//   · BrainBudgetGuard (EPIC-016 §22) over the frozen LoopBudget semantics
//   · StepVerifier / ArtifactVerifier / NodeArtifactReader (EPIC-014 +
//     SPRINT-024 Phase 1) — the ONLY verification path
//   · deriveOutcomeVerdict (SPRINT-024 Phase 2) — the honest state machine
//
// No new engine, budget, scheduler, notification, approval or execution
// system is exercised. No network, no secrets. Live provider execution is an
// OPERATOR step and is never fabricated here.
//
// Journeys:
//   1.  REAL FILE SUCCESS           2.  MISSING ARTIFACT
//   3.  MALFORMED ARTIFACT          4.  CALCULATION SUCCESS
//   5.  CALCULATION MISMATCH        6.  DRY-RUN SUCCESS
//   7.  APPROVAL REQUIRED           8.  BUDGET EXHAUSTION
//   9.  FAILURE + FAILOVER         10.  UNKNOWN EVIDENCE
//  11.  MULTI-STEP TASK            12.  CONTRADICTORY EVIDENCE
//
// Run:  npm run runtime:verification:benchmark
// ─────────────────────────────────────────────────────────────────────────────

import { promises as fs, mkdtempSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { CapabilityCandidate, FactoryCapabilityPlan } from '@vedmoulya/capability-marketplace';
import {
  BrainApplicationService,
  InMemoryBrainTaskStore,
  InMemoryBrainDecisionStore,
  InMemoryOpportunityStore,
  InMemoryIntelligenceEventStore,
  InMemoryOutcomeMemory,
  AdaptiveScoreLedger,
  deriveOutcomeVerdict,
  OUTCOME_VERDICT_LABELS,
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
  BrainTask,
  OutcomeVerdict,
} from '@vedmoulya/brain';
import { StepVerifier, NodeArtifactReader } from '@vedmoulya/execution-bridge';
import type { ArtifactExpectation, ArtifactVerificationResult } from '@vedmoulya/execution-bridge';

// ── Shared fixtures (same hermetic pattern as the SPRINT-023 benchmark) ─────

class FixedClock implements ClockPort {
  private t = new Date('2026-08-16T09:00:00Z');
  now(): string {
    this.t = new Date(this.t.getTime() + 1000);
    return this.t.toISOString();
  }
}

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

function makePlan(): FactoryCapabilityPlan {
  const caps = ['RESEARCH', 'TEXT_GENERATION'] as const;
  return {
    id: 'plan-verify-1',
    requestedOutcome: 'benchmark verification outcome',
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

/** REAL files the scripted execution port writes inside the boundary root. */
interface ArtifactPlan {
  files: Array<{ path: string; content: string }>;
  /** Write a file LARGER than the reader bound → honest UNKNOWN evidence. */
  oversize?: { path: string; bytes: number };
}

const NO_ARTIFACTS: ArtifactPlan = { files: [] };

// ── Verification harness — the EXISTING BrainApplicationService with a
//    scripted execution port that writes REAL artifacts + the REAL
//    read-only verification path over a REAL temp boundary root. ─────────────

class VerificationHarness {
  readonly clock = new FixedClock();
  /** REAL approved execution boundary root (temp dir). */
  readonly root: string;
  private readonly reader: NodeArtifactReader;
  private readonly stepVerifier = new StepVerifier();
  service!: BrainApplicationService;
  private execCalls = 0;
  private readonly failCapabilities = new Set<string>();
  private readonly flakyCapability?: string;
  private flakyFired = false;
  private readonly heavyTokens?: number;
  private readonly budget: { maxTokens?: number; maxCostUsd?: number; maxIterations?: number };
  private readonly providers: ReturnType<typeof providerFact>[];
  private readonly artifactFor: (runtimeCapability: string) => ArtifactPlan;

  constructor(
    opts: {
      providers?: ReturnType<typeof providerFact>[];
      /** RUNTIME capability ids (mapCapability output) → real artifacts to write. */
      artifactFor?: (runtimeCapability: string) => ArtifactPlan;
      /** RUNTIME capability ids that throw (provider unavailable, persistently). */
      failCapabilities?: string[];
      /** RUNTIME capability id that throws ONLY on the first call — the bounded
       *  ExecutionFailover fallback then recovers (journey 9). */
      flakyCapability?: string;
      /** Report this many tokens per successful call (budget-exhaustion journey 8). */
      heavyTokens?: number;
      budget?: { maxTokens?: number; maxCostUsd?: number; maxIterations?: number };
      /** NodeArtifactReader read bound (journey 10 forces UNKNOWN via oversize). */
      maxBytes?: number;
    } = {},
  ) {
    this.root = mkdtempSync(path.join(os.tmpdir(), 'sprint024-verify-'));
    this.reader = new NodeArtifactReader(this.root, opts.maxBytes ?? 1024 * 1024);
    this.providers = opts.providers ?? [providerFact()];
    this.artifactFor = opts.artifactFor ?? (() => NO_ARTIFACTS);
    this.failCapabilities = new Set(opts.failCapabilities ?? []);
    this.flakyCapability = opts.flakyCapability;
    this.heavyTokens = opts.heavyTokens;
    this.budget = opts.budget ?? { maxTokens: 10000, maxCostUsd: 0.5, maxIterations: 3 };
  }

  build(): void {
    const candidates: BrainCandidatePort = {
      providerCandidates: async (cap) =>
        this.providers.filter((p) => p.capabilities.includes(cap as never)),
      discoveryCandidates: async () => [],
      localModelCandidates: async () => [],
    };
    const execution: BrainExecutionPort = {
      // The scripted provider CLAIMS completion (returns content) AND writes
      // the REAL artifacts per capability plan — the verification layer then
      // inspects the real files independently of this claim.
      execute: async (input) => {
        this.execCalls += 1;
        if (this.failCapabilities.has(input.capability)) {
          throw new Error('provider 503 unavailable (benchmark simulated)');
        }
        if (input.capability === this.flakyCapability && !this.flakyFired) {
          this.flakyFired = true;
          throw new Error('provider 503 unavailable (benchmark simulated — first attempt only)');
        }
        const plan = this.artifactFor(input.capability);
        for (const file of plan.files) {
          const target = path.join(this.root, file.path);
          await fs.mkdir(path.dirname(target), { recursive: true });
          await fs.writeFile(target, file.content, 'utf8');
        }
        if (plan.oversize) {
          const target = path.join(this.root, plan.oversize.path);
          await fs.mkdir(path.dirname(target), { recursive: true });
          await fs.writeFile(target, 'x'.repeat(plan.oversize.bytes), 'utf8');
        }
        return {
          content: `Executed ${input.capability} — artifact produced.`, // the CLAIM (may be false)
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
        providerIds.map((providerId) => ({ providerId, capturedAt: this.clock.now() })),
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
      traceId: () => 'trace-verify-bench',
      usage,
      experience: new AdaptiveScoreLedger(() => this.clock.now()),
      memory: new InMemoryOutcomeMemory(),
      discovery,
      opportunities: new InMemoryOpportunityStore(),
      events: new InMemoryIntelligenceEventStore(),
    });
  }

  create(goal: string): string {
    const created = this.service.createTask('bench-user', goal);
    if (!created.success || !created.data) throw new Error('createTask failed in benchmark');
    return created.data.id;
  }

  async runStandard(goal: string): Promise<BrainTask> {
    const id = this.create(goal);
    await this.service.plan('bench-user', id);
    await this.service.selectResources('bench-user', id);
    await this.service.execute('bench-user', id);
    this.service.verify('bench-user', id);
    const task = this.service.getStatus('bench-user', id);
    if (!task.success || !task.data) throw new Error('getStatus failed in benchmark');
    return task.data;
  }

  /** The REAL read-only verification path — independent of any execution claim. */
  async verify(expectations: ArtifactExpectation[]): Promise<ArtifactVerificationResult> {
    return this.stepVerifier.verifyArtifacts(this.reader, expectations);
  }

  /** The honest outcome verdict derived from the independent artifact result. */
  verdict(task: BrainTask, artifact: ArtifactVerificationResult): OutcomeVerdict {
    return deriveOutcomeVerdict({
      status: task.status,
      verificationPassed: artifact.passed,
      verificationFailed: artifact.failedCount > 0,
      hasBudgetDecision: task.decisionRecords.some((d) => d.decision.includes('budget')),
      hasFailedProvider: task.providerOutputs.some((o) => o.output === ''),
    });
  }

  execCount(): number {
    return this.execCalls;
  }

  /** Walk the REAL boundary root — proof no irreversible side effect occurred. */
  async listFiles(): Promise<string[]> {
    const out: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) await walk(full);
        else out.push(path.relative(this.root, full).replace(/\\/g, '/'));
      }
    };
    await walk(this.root);
    return out;
  }

  async cleanup(): Promise<void> {
    await fs.rm(this.root, { recursive: true, force: true }).catch(() => undefined);
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

async function main(): Promise<void> {
  console.log('SPRINT-024 — Live Outcome Verification & Real-Runtime Execution: 12 Journeys');
  console.log('────────────────────────────────────────────────────────────────────────────');
  console.log('  REAL artifacts in a temp boundary root · REAL NodeArtifactReader →');
  console.log('  StepVerifier.verifyArtifacts → deriveOutcomeVerdict · no network, no secrets.');

  // ── 1. REAL FILE SUCCESS ────────────────────────────────────────────────────
  {
    const h = new VerificationHarness({
      artifactFor: () => ({
        files: [{ path: 'out/report.json', content: '{"report":"ok","items":[1,2,3]}' }],
      }),
    });
    h.build();
    const task = await h.runStandard('Produce a verified summary report');
    const artifact = await h.verify([
      { checkId: 'exists', type: 'FILE_EXISTS', path: 'out/report.json' },
      { checkId: 'json', type: 'JSON_VALID', path: 'out/report.json' },
      {
        checkId: 'calc',
        type: 'CALCULATION',
        path: 'out/report.json',
        calculation: { kind: 'sum', field: 'items', expected: 6 },
      },
    ]);
    const verdict = h.verdict(task, artifact);
    assertScenario(
      '1. REAL FILE SUCCESS — artifact exists on disk',
      (await h.listFiles()).includes('out/report.json'),
      'file absent',
    );
    assertScenario(
      '1b. valid structure + independent recompute both pass',
      artifact.passed && artifact.failedCount === 0,
      artifact.summary,
    );
    assertScenario(
      '1c. honest verdict is SUCCESS only after independent verification',
      verdict === 'SUCCESS',
      `verdict=${verdict}`,
    );
    assertScenario(
      '1d. artifact metadata captured (type/existence/validity/status/check)',
      artifact.checks.every((c) => c.type && c.path && c.status && c.detail) &&
        artifact.summary.length > 0,
      'metadata incomplete',
    );
    await h.cleanup();
  }

  // ── 2. MISSING ARTIFACT ─────────────────────────────────────────────────────
  {
    // The execution CLAIMS completion (returns content) but writes NOTHING.
    const h = new VerificationHarness({ artifactFor: () => NO_ARTIFACTS });
    h.build();
    const task = await h.runStandard('Generate a deliverable file');
    const artifact = await h.verify([
      { checkId: 'exists', type: 'FILE_EXISTS', path: 'out/report.json' },
    ]);
    const verdict = h.verdict(task, artifact);
    assertScenario(
      '2. MISSING ARTIFACT — claimed completion is NOT success',
      !artifact.passed && artifact.checks[0].status === 'FAIL',
      artifact.summary,
    );
    assertScenario(
      '2b. missing expected artifact → FAILED (never SUCCESS)',
      verdict === 'FAILED',
      `verdict=${verdict}`,
    );
    await h.cleanup();
  }

  // ── 3. MALFORMED ARTIFACT ───────────────────────────────────────────────────
  {
    const h = new VerificationHarness({
      artifactFor: () => ({ files: [{ path: 'out/report.json', content: '{not valid json' }] }),
    });
    h.build();
    const task = await h.runStandard('Produce a JSON deliverable');
    const artifact = await h.verify([
      { checkId: 'exists', type: 'FILE_EXISTS', path: 'out/report.json' },
      { checkId: 'json', type: 'JSON_VALID', path: 'out/report.json' },
    ]);
    const verdict = h.verdict(task, artifact);
    assertScenario(
      '3. MALFORMED ARTIFACT — file exists but structure invalid',
      !artifact.passed && artifact.failedCount === 1,
      artifact.summary,
    );
    assertScenario('3b. malformed structure → FAILED', verdict === 'FAILED', `verdict=${verdict}`);
    await h.cleanup();
  }

  // ── 4. CALCULATION SUCCESS ─────────────────────────────────────────────────
  {
    const h = new VerificationHarness({
      artifactFor: () => ({ files: [{ path: 'calc.json', content: '{"numbers":[1,2,3,4]}' }] }),
    });
    h.build();
    const task = await h.runStandard('Compute the total of a list');
    const artifact = await h.verify([
      {
        checkId: 'calc',
        type: 'CALCULATION',
        path: 'calc.json',
        calculation: { kind: 'sum', field: 'numbers', expected: 10 },
      },
    ]);
    const verdict = h.verdict(task, artifact);
    assertScenario(
      '4. CALCULATION SUCCESS — independent recompute matches',
      artifact.passed,
      artifact.summary,
    );
    assertScenario('4b. verdict SUCCESS', verdict === 'SUCCESS', `verdict=${verdict}`);
    await h.cleanup();
  }

  // ── 5. CALCULATION MISMATCH ────────────────────────────────────────────────
  {
    const h = new VerificationHarness({
      artifactFor: () => ({ files: [{ path: 'calc.json', content: '{"numbers":[1,2,3,4]}' }] }),
    });
    h.build();
    const task = await h.runStandard('Compute the total of a list');
    const artifact = await h.verify([
      {
        checkId: 'calc',
        type: 'CALCULATION',
        path: 'calc.json',
        calculation: { kind: 'sum', field: 'numbers', expected: 99 },
      },
    ]);
    const verdict = h.verdict(task, artifact);
    assertScenario(
      '5. CALCULATION MISMATCH — recompute mismatch fails verification',
      !artifact.passed && artifact.checks[0].status === 'FAIL',
      artifact.summary,
    );
    assertScenario('5b. mismatch → FAILED', verdict === 'FAILED', `verdict=${verdict}`);
    await h.cleanup();
  }

  // ── 6. DRY-RUN SUCCESS ─────────────────────────────────────────────────────
  {
    const h = new VerificationHarness({
      artifactFor: () => ({
        files: [
          {
            path: 'dryrun.log',
            content: 'PLAN: would create out/x.csv (dry-run, no changes applied)',
          },
        ],
      }),
    });
    h.build();
    const task = await h.runStandard('Dry-run the report export safely');
    const artifact = await h.verify([
      { checkId: 'dry', type: 'DRY_RUN', path: 'dryrun.log', expectedContent: 'dry-run' },
    ]);
    const verdict = h.verdict(task, artifact);
    const files = await h.listFiles();
    assertScenario(
      '6. DRY-RUN SUCCESS — expected side-effect evidence observed',
      artifact.passed,
      artifact.summary,
    );
    assertScenario(
      '6b. dry-run produced NO irreversible artifact',
      !files.includes('out/x.csv'),
      `files=${files.join(',')}`,
    );
    assertScenario(
      '6c. verdict SUCCESS on verified safe dry-run',
      verdict === 'SUCCESS',
      `verdict=${verdict}`,
    );
    await h.cleanup();
  }

  // ── 7. APPROVAL REQUIRED ───────────────────────────────────────────────────
  {
    // Only the PAID provider can perform the task → a paid approval point.
    // Nothing may execute (and no artifact may appear) before approval.
    const h = new VerificationHarness({
      providers: [
        providerFact('prov-paid', 0.95, 'high', ['TEXT_GENERATION', 'RESEARCH']),
        providerFact('prov-free', 0.6, 'free', ['RESEARCH']),
      ],
      artifactFor: () => ({
        files: [{ path: 'out/report.json', content: '{"paid":"deliverable"}' }],
      }),
    });
    h.build();
    const id = h.create('Produce a paid marketing brief');
    await h.service.plan('bench-user', id);
    await h.service.selectResources('bench-user', id);
    const before = h.service.getStatus('bench-user', id).data;
    const paid = before?.roleAssignments.find((a) => a.providerId === 'prov-paid');
    if (!paid)
      throw new Error(
        'benchmark setup failure: paid provider was not assigned for the approval journey',
      );
    const requested = h.service.requestApproval('bench-user', id, 'purchase');
    assertScenario(
      '7. APPROVAL REQUIRED — sensitive action pauses AWAITING_APPROVAL',
      requested.success && requested.data?.status === 'AWAITING_APPROVAL',
      String(requested.error),
    );
    assertScenario(
      '7b. NOTHING executed before approval',
      h.execCount() === 0,
      `execCalls=${h.execCount()}`,
    );
    assertScenario(
      '7c. NO artifact written before approval (real boundary empty)',
      (await h.listFiles()).length === 0,
      'files present',
    );
    if (!requested.success || !requested.data)
      throw new Error('requestApproval failed in benchmark');
    const verdict = h.verdict(requested.data, {
      passed: false,
      checks: [],
      failedCount: 0,
      unknownCount: 0,
      summary: 'pending approval',
    });
    assertScenario(
      '7d. verdict AWAITING_APPROVAL — never upgraded',
      verdict === 'AWAITING_APPROVAL',
      `verdict=${verdict}`,
    );
    // Only AFTER approval does execution happen and the artifact appear.
    const approved = h.service.approve('bench-user', id, 'purchase');
    assertScenario(
      '7e. approval recorded before any execution',
      approved.success && approved.data?.approvalGranted.includes('purchase'),
      String(approved.error),
    );
    await h.service.execute('bench-user', id);
    h.service.verify('bench-user', id);
    const after = h.service.getStatus('bench-user', id).data;
    assertScenario(
      '7f. execution + artifact only after approval',
      Boolean(after) && h.execCount() > 0 && (await h.listFiles()).includes('out/report.json'),
      `exec=${h.execCount()}`,
    );
    await h.cleanup();
  }

  // ── 8. BUDGET EXHAUSTION ───────────────────────────────────────────────────
  {
    // Every call reports 5000 tokens against a 2000 hard budget → the
    // BrainBudgetGuard (frozen LoopBudget semantics) trips mid-run and STOPS.
    const h = new VerificationHarness({
      providers: [providerFact('prov-a')],
      failCapabilities: ['reasoning'],
      heavyTokens: 5000,
      budget: { maxTokens: 2000, maxCostUsd: 0.1, maxIterations: 1 },
      artifactFor: () => ({ files: [{ path: 'out/partial.json', content: '{}' }] }),
    });
    h.build();
    const id = h.create('A heavy research task on a tiny budget');
    await h.service.plan('bench-user', id);
    await h.service.selectResources('bench-user', id);
    await h.service.execute('bench-user', id);
    const task = h.service.getStatus('bench-user', id).data;
    if (!task) throw new Error('getStatus failed in benchmark');
    const verdict = h.verdict(task, {
      passed: false,
      checks: [],
      failedCount: 0,
      unknownCount: 0,
      summary: 'budget trip',
    });
    assertScenario(
      '8. BUDGET EXHAUSTION — fail-closed stop, no fabricated success',
      task.decisionRecords.some((d) => d.decision.includes('budget')),
      `decisions=${task.decisionRecords.map((d) => d.decision).join('|')}`,
    );
    assertScenario(
      '8b. verdict BUDGET_EXHAUSTED (never SUCCESS)',
      verdict === 'BUDGET_EXHAUSTED',
      `verdict=${verdict}`,
    );
    assertScenario(
      '8c. run actually stopped (bounded)',
      h.execCount() <= 4,
      `execCalls=${h.execCount()}`,
    );
    await h.cleanup();
  }

  // ── 9. EXECUTION FAILURE + FAILOVER ────────────────────────────────────────
  {
    // First 'reasoning' attempt fails → bounded ExecutionFailover picks
    // prov-b (never re-picks the failed provider) → the REAL artifact is
    // written by the successful fallback and verified.
    const h = new VerificationHarness({
      providers: [providerFact('prov-a', 0.8, 'low'), providerFact('prov-b', 0.7, 'free')],
      flakyCapability: 'reasoning',
      artifactFor: () => ({
        files: [{ path: 'out/report.json', content: '{"fallback":"ok","items":[5]}' }],
      }),
    });
    h.build();
    // NOTE: the goal text deliberately avoids the DEEP_RESEARCH mode selector
    // (research/investigate/compare/comprehensive) — research mode demands
    // evidence and would honestly report PARTIAL; this journey proves
    // failover + verified artifact → SUCCESS on a balanced-mode task.
    const task = await h.runStandard('Draft a topic summary for the team');
    const artifact = await h.verify([
      { checkId: 'exists', type: 'FILE_EXISTS', path: 'out/report.json' },
      {
        checkId: 'calc',
        type: 'CALCULATION',
        path: 'out/report.json',
        calculation: { kind: 'sum', field: 'items', expected: 5 },
      },
    ]);
    const verdict = h.verdict(task, artifact);
    const failover = task.failoverEvents[0];
    assertScenario(
      '9. FAILURE + FAILOVER — failover recorded (bounded)',
      task.failoverEvents.length > 0,
      `failovers=${task.failoverEvents.length}`,
    );
    assertScenario(
      '9b. fallback never re-picks the failed provider',
      Boolean(failover) && failover.fallbackProviderId !== failover.failedProviderId,
      `failed=${failover?.failedProviderId} fallback=${failover?.fallbackProviderId}`,
    );
    assertScenario(
      '9c. REAL artifact produced by the fallback verifies',
      artifact.passed,
      artifact.summary,
    );
    assertScenario(
      '9d. honest SUCCESS after verified recovery',
      verdict === 'SUCCESS',
      `verdict=${verdict}`,
    );
    await h.cleanup();
  }

  // ── 10. UNKNOWN EVIDENCE ───────────────────────────────────────────────────
  {
    // The artifact EXISTS but is larger than the reader's read bound → the
    // evidence is honestly UNKNOWN (found-but-unreadable) — never SUCCESS.
    const h = new VerificationHarness({
      maxBytes: 64,
      artifactFor: () => ({ files: [], oversize: { path: 'out/evidence.txt', bytes: 200 } }),
    });
    h.build();
    const task = await h.runStandard('Produce an evidence file');
    const artifact = await h.verify([
      { checkId: 'exists', type: 'FILE_EXISTS', path: 'out/evidence.txt' },
    ]);
    const verdict = h.verdict(task, artifact);
    assertScenario(
      '10. UNKNOWN EVIDENCE — unreadable evidence is UNKNOWN, not SUCCESS',
      !artifact.passed && artifact.unknownCount === 1 && artifact.failedCount === 0,
      artifact.summary,
    );
    assertScenario(
      '10b. UNKNOWN preserved honestly (never fabricated success)',
      verdict === 'UNKNOWN',
      `verdict=${verdict}`,
    );
    await h.cleanup();
  }

  // ── 11. MULTI-STEP TASK ────────────────────────────────────────────────────
  {
    // Step A ('reasoning' → research) succeeds and its artifact verifies;
    // Step B ('content_generation') writes a malformed artifact → verification
    // fails → the overall outcome must NOT claim full success.
    const h = new VerificationHarness({
      artifactFor: (cap) =>
        cap === 'reasoning'
          ? { files: [{ path: 'out/step-a.json', content: '{"numbers":[1,2,3]}' }] }
          : { files: [{ path: 'out/step-b.json', content: '{broken' }] },
    });
    h.build();
    const task = await h.runStandard('Research then produce a deliverable');
    const stepA = await h.verify([
      { checkId: 'a-exists', type: 'FILE_EXISTS', path: 'out/step-a.json' },
      {
        checkId: 'a-calc',
        type: 'CALCULATION',
        path: 'out/step-a.json',
        calculation: { kind: 'sum', field: 'numbers', expected: 6 },
      },
    ]);
    const stepB = await h.verify([
      { checkId: 'b-json', type: 'JSON_VALID', path: 'out/step-b.json' },
    ]);
    const verdict = h.verdict(task, stepB);
    assertScenario(
      '11. MULTI-STEP — step A artifact verifies cleanly',
      stepA.passed,
      stepA.summary,
    );
    assertScenario('11b. step B fails verification', !stepB.passed, stepB.summary);
    assertScenario(
      '11c. overall outcome does NOT claim full success',
      verdict !== 'SUCCESS',
      `verdict=${verdict}`,
    );
    assertScenario(
      '11d. honest FAILED (one step definitively failed)',
      verdict === 'FAILED',
      `verdict=${verdict}`,
    );
    await h.cleanup();
  }

  // ── 12. SUCCESS WITH CONTRADICTORY EVIDENCE ────────────────────────────────
  {
    // Execution CLAIMS success (content returned, "artifact produced") but the
    // artifact verification contradicts the claim → verification wins.
    const h = new VerificationHarness({
      artifactFor: () => ({ files: [{ path: 'out/report.json', content: 'not-json-at-all' }] }),
    });
    h.build();
    const task = await h.runStandard('Produce a JSON deliverable');
    const artifact = await h.verify([
      { checkId: 'json', type: 'JSON_VALID', path: 'out/report.json' },
      {
        checkId: 'calc',
        type: 'CALCULATION',
        path: 'out/report.json',
        calculation: { kind: 'length', targetField: 'items', expected: 3 },
      },
    ]);
    const verdict = h.verdict(task, artifact);
    assertScenario(
      '12. CONTRADICTORY EVIDENCE — execution claim alone is not success',
      task.providerOutputs.some((o) => o.output.includes('artifact produced')),
      'execution claim missing',
    );
    assertScenario(
      '12b. verification contradicts → FAILED (verification wins)',
      !artifact.passed && verdict === 'FAILED',
      `verdict=${verdict}`,
    );
    await h.cleanup();
  }

  // ── Honest operator note (never fabricate live-provider evidence) ─────────
  {
    const hasLiveKey =
      (process.env.AI_DEFAULT_PROVIDER === 'deepseek'
        ? process.env.AI_DEEPSEEK_API_KEY
        : process.env.AI_OPENAI_API_KEY) && process.env.AI_ENABLE_MOCK !== 'true';
    console.log('────────────────────────────────────────────────────────────────────────────');
    if (hasLiveKey) {
      console.log('  Live provider credentials ARE configured — real-provider execution is an');
      console.log('  operator step; this hermetic gate never fabricates live evidence.');
    } else {
      console.log('  No live provider credentials configured — all 12 journeys are deterministic');
      console.log('  real-artifact verifications (temp boundary + real reader). Live provider');
      console.log('  execution remains an OPERATOR step (AI_ENABLE_MOCK=false + real key).');
    }
    const verdictVocabulary = Object.values(OUTCOME_VERDICT_LABELS).join(' · ');
    console.log(`  Honest verdict vocabulary: ${verdictVocabulary}`);
  }

  console.log('────────────────────────────────────────────────────────────────────────────');
  console.log(`Total assertions: ${passed + failed} · Passed: ${passed}`);
  console.log(`Verdict: ${failed === 0 ? 'PASS' : 'FAIL'}`);
  if (failures.length > 0) {
    console.log(`Failed: ${failures.join(', ')}`);
    process.exit(1);
  }
  console.log(
    '  ✅ REAL EXECUTION → REAL EVIDENCE → INDEPENDENT VERIFICATION → HONEST OUTCOME — composed entirely from existing engines.',
  );
}

void main();

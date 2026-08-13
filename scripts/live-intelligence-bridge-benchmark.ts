// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — EPIC-017 Live Intelligence Bridge Benchmark
// UNDERSTAND → DISCOVER → COMPARE → RECOMMEND → APPROVAL → CONFIGURE/HANDOFF →
// PLAN → EXECUTE → VERIFY → EVALUATE → FEEDBACK → NOTIFY
//
// Runs the REAL LiveIntelligenceBridgeService over REAL EPIC-013-style plans
// and the REAL Brain/Intelligence/Marketplace/Execution/AI-World seams through
// deterministic ports (same hermetic contract as the package test suite — no
// live AI, no network, no secrets) and verifies:
//   full-loop completion · better-capability detection (quality-first) ·
//   paid approval gating · decline-is-not-failure · GitHub never auto-activated ·
//   free/local fallback honesty · notification relevance gating ·
//   execution failure honesty · owner-scoping/IDOR · short-objective rejection
//
// Everything is deterministic; the same fixtures drive the package test suite.
// ─────────────────────────────────────────────────────────────────────────────

import {
  InMemoryBridgeLoopStore,
  LiveIntelligenceBridgeService,
} from '@vedmoulya/live-intelligence-bridge';
import type {
  BridgeAiWorldPort,
  BridgeBrainPort,
  BridgeClockPort,
  BridgeExecutionPort,
  BridgeIntelligencePort,
  BridgeLoopRun,
  BridgeMarketplacePort,
} from '@vedmoulya/live-intelligence-bridge';
import type { BrainCandidatePort, BrainPreferencePort } from '@vedmoulya/live-intelligence-bridge';
import type { CapabilityId, FactoryCapabilityPlan } from '@vedmoulya/capability-marketplace';
import type { BrainTask } from '@vedmoulya/brain';
import type {
  IntelligenceNotification,
  IntelligenceNotificationKind,
  IntelligenceTaskContext,
  TaskIntelligenceResult,
} from '@vedmoulya/ecosystem-intelligence';
import type { ExecutionRun, StepRun } from '@vedmoulya/execution-bridge';

// ── Deterministic clock (no live services) ───────────────────────────────────
class FixedClock implements BridgeClockPort {
  private readonly t = 1_700_000_000_000;
  now(): string {
    return new Date(this.t).toISOString();
  }
  timestampMs(): number {
    return this.t;
  }
}

// ── Deterministic candidate port: configured free + paid alternative + GitHub + local ──
function createCandidatePort(): BrainCandidatePort {
  return {
    providerCandidates: (capability: CapabilityId) =>
      Promise.resolve([
        {
          providerId: 'cfg-base',
          family: 'openai',
          name: 'Configured Base',
          modelId: 'gpt-base',
          modelName: 'GPT-Base',
          capabilities: [capability],
          quality: 0.7,
          costTier: 'free',
          availability: 1,
          configured: true,
          estimatedCostUsd: 0,
          evidence: [
            { claim: 'Configured and usable now.', source: 'registry', confidence: 'VERIFIED' },
          ],
        },
        {
          providerId: 'paid-star',
          family: 'openai',
          name: 'Paid Star',
          modelId: 'gpt-star',
          modelName: 'GPT-Star',
          capabilities: [capability],
          quality: 0.96,
          costTier: 'high',
          availability: 1,
          configured: false,
          estimatedCostUsd: 0.05,
          evidence: [
            { claim: 'High quality evidenced.', source: 'registry', confidence: 'MEASURED' },
          ],
        },
      ]),
    discoveryCandidates: () =>
      Promise.resolve([
        {
          itemId: 'item-github-1',
          category: 'github',
          title: 'OpenRepo Kit',
          capabilities: [],
          freeClass: 'OPEN_SOURCE',
          localAvailability: 'UNKNOWN',
          configurable: false,
          evidence: [
            {
              claim: 'Open-source project with active maintenance.',
              source: 'github',
              confidence: 'MEASURED',
            },
          ],
          securityFlags: ['needs-review'],
        },
      ]),
    localModelCandidates: () =>
      Promise.resolve([
        {
          id: 'local-q4',
          name: 'Local Q4',
          runtime: 'ollama',
          capabilities: [],
          capabilitiesProvenance: 'INFERRED',
          available: false,
          evidence: [
            {
              claim: 'Local runtime detected; quality inferred.',
              source: 'local',
              confidence: 'INFERRED',
            },
          ],
        },
      ]),
  };
}

// ── Deterministic intelligence port (evidence-first, never fabricated) ──────
function createIntelligencePort(): BridgeIntelligencePort {
  return {
    findBetterOption: (): Promise<TaskIntelligenceResult> =>
      Promise.resolve({
        taskId: 'task-1',
        requestedOutcome: 'benchmark',
        options: [
          {
            kind: 'BEST_CONFIGURED',
            providerId: 'cfg-base',
            name: 'Configured Base',
            capability: 'TEXT_GENERATION',
            quality: 70,
            reason: 'Already configured — usable now.',
            evidence: ['registry claim'],
            requires: [],
          },
          {
            kind: 'BEST_PAID',
            providerId: 'paid-star',
            name: 'Paid Star',
            capability: 'TEXT_GENERATION',
            quality: 96,
            costUsd: 0.05,
            reason: 'Stronger task evidence — materially better.',
            evidence: ['measured quality 96', 'task-fit evidence'],
            requires: ['api_key', 'subscription'],
          },
        ],
        bestAvailableNow: {
          kind: 'BEST_AVAILABLE_NOW',
          providerId: 'cfg-base',
          name: 'Configured Base',
          capability: 'TEXT_GENERATION',
          quality: 70,
          reason: 'Best among configured.',
          evidence: ['registry claim'],
          requires: [],
        },
        betterOptionAvailable: true,
        fallback: {
          order: ['FREE', 'FREE_QUOTA', 'LOCAL', 'OPEN_SOURCE', 'GITHUB', 'CURRENT_CONFIGURED'],
          bestAchievable: 'Continue with configured base.',
          note: 'Declining is never task failure.',
        },
      }),
    findFreeAlternative: () =>
      Promise.resolve({ free: true, name: 'Configured Base', providerId: 'cfg-base', quality: 70 }),
    findLocalAlternative: () =>
      Promise.resolve({ available: false, note: 'No local model available on current hardware.' }),
    findGitHubCapability: () =>
      Promise.resolve({
        found: true,
        items: [{ title: 'OpenRepo Kit', configurable: false, securityFlags: ['needs-review'] }],
      }),
    findBetterProvider: () =>
      Promise.resolve({
        better: true,
        current: { name: 'Configured Base', quality: 70 },
        recommended: { name: 'Paid Star', quality: 96, requiresActivation: true },
      }),
    evaluateSecurity: () => ({ state: 'SECURITY_REVIEWED', evidence: ['no blocking indicators'] }),
    evaluateLicense: (_userId, facts) => ({
      license: facts.license,
      software: {
        present: Boolean(facts.license),
        type: facts.license,
        commercialUseRestricted: false,
        redistributionRestricted: false,
        attributionRequired: false,
        verdict: facts.license ? 'PERMISSIVE' : 'LICENSE_UNKNOWN',
      },
      verdict: facts.license ? 'PERMISSIVE' : 'LICENSE_UNKNOWN',
    }),
    respondToRecommendation: (_userId, _recommendationId, action) =>
      Promise.resolve({
        state: action === 'use_recommended' ? 'ACCEPTED' : 'DECLINED',
      }),
    notify: (
      _userId,
      opts: { kind: IntelligenceNotificationKind; title: string; body: string; relevance: number },
    ): IntelligenceNotification => ({
      id: `notif-${opts.title.length}`,
      kind: opts.kind,
      title: opts.title,
      body: opts.body,
      relevance: opts.relevance,
      createdAt: new Date().toISOString(),
    }),
  };
}

// ── Deterministic brain port ─────────────────────────────────────────────────
function brainTask(id: string): BrainTask {
  return {
    id,
    userId: 'bench-user',
    objective: 'Create a professional blog post',
    originalInput: 'Create a professional blog post',
    intent: {
      objective: 'Create a professional blog post',
      domain: 'content',
      desiredOutcome: 'A professional blog post',
      constraints: [],
      qualityTarget: 'HIGH',
      privacyRequirement: 'STANDARD',
      urgency: 'NORMAL',
      authorizedActions: [],
      ambiguities: [],
      assumptions: [],
    },
    mode: 'QUALITY',
    domain: 'content',
    qualityTarget: 'HIGH',
    privacyRequirement: 'STANDARD',
    budget: { maxTokens: 100000, maxCostUsd: 1, maxIterations: 5, maxLatencyMs: 60000 },
    requiredCapabilities: ['TEXT_GENERATION'],
    roleAssignments: [],
    graph: { nodes: [], edges: [], waves: [] },
    status: 'NEW',
    stage: 'UNDERSTANDING',
    stageStatuses: {
      UNDERSTANDING: 'pending',
      PLAN: 'pending',
      INTELLIGENCE: 'pending',
      EXECUTION: 'pending',
      VERIFICATION: 'pending',
      RESULT: 'pending',
      CANCELLED: 'pending',
      FAILED: 'pending',
    },
    providerOutputs: [],
    conflicts: [],
    decisionRecords: [],
    approvalRequired: [],
    approvalGranted: [],
    traceId: `trace-${id}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createBrainPort(): BridgeBrainPort {
  return {
    createTask: () => ({ success: true, data: brainTask('brain-1') }),
    plan: () =>
      Promise.resolve({
        success: true,
        data: {
          ...brainTask('brain-1'),
          capabilityPlanId: 'plan-1',
          requiredCapabilities: ['TEXT_GENERATION'],
          stage: 'PLAN',
          stageStatuses: { ...brainTask('brain-1').stageStatuses, PLAN: 'completed' },
        },
      }),
    selectResources: () => Promise.resolve({ success: true, data: brainTask('brain-1') }),
    requestApproval: () => ({ success: false, error: 'Not required.', code: 'NOT_REQUIRED' }),
    approve: () => ({
      success: true,
      data: { ...brainTask('brain-1'), approvalGranted: ['purchase'] },
    }),
    reject: () => ({ success: true, data: brainTask('brain-1') }),
    execute: () => Promise.resolve({ success: true, data: brainTask('brain-1') }),
    verify: () => ({ success: true, data: brainTask('brain-1') }),
    evaluateOutcome: () => Promise.resolve({ success: true, data: brainTask('brain-1') }),
    getStatus: () => ({ success: true, data: brainTask('brain-1') }),
    listTasks: () => ({ success: true, data: [brainTask('brain-1')] }),
  };
}

// ── Deterministic marketplace + execution ports ──────────────────────────────
function capabilityPlan(): FactoryCapabilityPlan {
  return {
    id: 'plan-1',
    requestedOutcome: 'Create a professional blog post',
    createdAt: new Date().toISOString(),
    requiredCapabilities: ['TEXT_GENERATION'],
    candidates: [],
    steps: [
      {
        id: 'create',
        title: 'Create',
        capability: 'TEXT_GENERATION',
        purpose: 'Produce the core content.',
        candidates: [],
        automation: 'FULLY_AUTOMATED',
        irreversible: false,
        reasons: ['benchmark'],
      },
    ],
    automationLevel: 'FULLY_AUTOMATED',
    automationPercent: 100,
    evidence: [],
    risks: [],
    humanApprovalPoints: [],
    unavailableCapabilities: [],
    recommendations: [],
  };
}

function createMarketplacePort(): BridgeMarketplacePort {
  const plan = capabilityPlan();
  return {
    plan: () => Promise.resolve(plan),
    getPlan: (_userId, id) => Promise.resolve(id === plan.id ? plan : undefined),
  };
}

function runStep(state: StepRun['state']): StepRun {
  return {
    stepId: 'create',
    title: 'Create',
    capability: 'TEXT_GENERATION',
    disposition: 'EXECUTABLE',
    state,
    provider: 'cfg-base',
    model: 'gpt-base',
    artifacts: [],
    attempts: 1,
    retried: false,
    costUsd: 0,
    tokensUsed: 100,
    latencyMs: 200,
    updatedAt: new Date().toISOString(),
    ...(state === 'completed'
      ? {
          verification: {
            stepId: 'create',
            pre: { passed: true, checks: [] },
            post: { passed: true, checks: [] },
          },
        }
      : {}),
  };
}

function executionRun(over: Partial<ExecutionRun> = {}): ExecutionRun {
  return {
    executionId: 'exec-1',
    planId: 'plan-1',
    ownerId: 'bench-user',
    traceId: 'trace-exec-1',
    goal: 'Create a professional blog post',
    status: 'COMPLETED',
    steps: [runStep('completed')],
    checkpoints: [],
    handoffs: [],
    budget: {
      maxIterations: 10,
      maxTokens: 100000,
      maxCostUsd: 1,
      maxLatencyMs: 60000,
      spentTokens: 100,
      spentCostUsd: 0,
      spentLatencyMs: 200,
      iterations: 1,
      exceeded: false,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...over,
  };
}

function createExecutionPort(overrides: Partial<BridgeExecutionPort> = {}): BridgeExecutionPort {
  return {
    start: () => Promise.resolve({ success: true, data: executionRun() }),
    approve: () => Promise.resolve({ success: true, data: executionRun() }),
    reject: () => Promise.resolve({ success: true, data: executionRun({ status: 'BLOCKED' }) }),
    completeHandoff: () => Promise.resolve({ success: true, data: executionRun() }),
    get: () => ({ success: true, data: executionRun() }),
    list: () => ({ success: true, data: [executionRun()] }),
    ...overrides,
  };
}

// ── AI World emission + preference ledger (recording) ────────────────────────
function createAiWorldPort(): {
  port: BridgeAiWorldPort;
  emitted: Array<{ kind: string; title: string }>;
} {
  const emitted: Array<{ kind: string; title: string }> = [];
  return {
    emitted,
    port: {
      emit: (_userId, event) => {
        emitted.push({ kind: event.kind, title: event.title });
        return { emitted: true };
      },
      unreadCount: () => emitted.length,
    },
  };
}

function createPreferencePort(): BrainPreferencePort & { events: unknown[] } {
  const events: unknown[] = [];
  return {
    events,
    record: (event) => {
      events.push(event);
      return Promise.resolve();
    },
  };
}

// ── Harness ──────────────────────────────────────────────────────────────────
interface Harness {
  service: LiveIntelligenceBridgeService;
  aiWorldEmitted: Array<{ kind: string; title: string }>;
  preferenceEvents: unknown[];
}

function createHarness(executionOverrides: Partial<BridgeExecutionPort> = {}): Harness {
  const aiWorld = createAiWorldPort();
  const preference = createPreferencePort();
  const service = new LiveIntelligenceBridgeService({
    clock: new FixedClock(),
    brain: createBrainPort(),
    intelligence: createIntelligencePort(),
    marketplace: createMarketplacePort(),
    execution: createExecutionPort(executionOverrides),
    candidates: createCandidatePort(),
    preference,
    aiWorld: aiWorld.port,
    loops: new InMemoryBridgeLoopStore(),
    traceId: () => 'trace-bench',
  });
  return { service, aiWorldEmitted: aiWorld.emitted, preferenceEvents: preference.events };
}

// ── Full deterministic loop helper ───────────────────────────────────────────
async function runFullLoop(h: Harness, accept: boolean): Promise<BridgeLoopRun> {
  const started = await h.service.start('bench-user', 'Create a professional blog post');
  if (!started.success || !started.data) throw new Error('start failed');
  const loopId = started.data.loopId;
  await h.service.discover('bench-user', loopId);
  await h.service.compare('bench-user', loopId);
  const rec = await h.service.recommend('bench-user', loopId);
  if (!rec.success || !rec.data) throw new Error('recommend failed');
  const recommendation = rec.data.recommendations[0];
  if (!recommendation) throw new Error('no recommendation produced');
  if (accept) {
    await h.service.approve('bench-user', loopId, recommendation.id);
  } else {
    await h.service.reject('bench-user', loopId, recommendation.id);
  }
  await h.service.handOff('bench-user', loopId);
  h.service.verify('bench-user', loopId);
  await h.service.evaluateAndLearn('bench-user', loopId, accept);
  const final = h.service.get('bench-user', loopId);
  if (!final.success || !final.data) throw new Error('final read failed');
  return final.data;
}

// ── Benchmark runner ─────────────────────────────────────────────────────────
interface ScenarioOutcome {
  name: string;
  pass: boolean;
  detail: string;
}

const outcomes: ScenarioOutcome[] = [];

function assertScenario(name: string, pass: boolean, detail: string): void {
  outcomes.push({ name, pass, detail });
}

async function main(): Promise<void> {
  // 1. Full loop → COMPLETED with recommendation, approval, feedback + AI World emission.
  {
    const h = createHarness();
    const loop = await runFullLoop(h, true);
    assertScenario(
      'full loop (accept) → COMPLETED',
      loop.status === 'COMPLETED' &&
        loop.recommendations.some((r) => r.state === 'ACCEPTED') &&
        loop.approvals.some((a) => a.state === 'GRANTED') &&
        loop.performance.length > 0 &&
        loop.outcome?.taskCompleted === true &&
        h.preferenceEvents.length > 0,
      `${loop.status} · ${loop.recommendations.length} rec(s), ${loop.approvals.length} approval(s), ${loop.performance.length} perf fact(s), ${h.preferenceEvents.length} preference event(s), ${h.aiWorldEmitted.length} AI World emission(s)`,
    );
  }

  // 2. Decline → NOT task failure; loop still completes with best available.
  {
    const h = createHarness();
    const loop = await runFullLoop(h, false);
    assertScenario(
      'decline is never task failure',
      loop.recommendations.some((r) => r.state === 'DECLINED') &&
        loop.approvals.some((a) => a.state === 'REJECTED') &&
        (loop.status === 'COMPLETED' || loop.status === 'PARTIAL') &&
        loop.outcome?.userApproval === 'REJECTED',
      `${loop.status} after rejection · outcome.userApproval=${loop.outcome?.userApproval}`,
    );
  }

  // 3. Paid recommendation requires explicit approval (never auto-activated).
  {
    const h = createHarness();
    const started = await h.service.start('bench-user', 'Create a professional blog post');
    const loopId = started.data?.loopId ?? '';
    await h.service.discover('bench-user', loopId);
    await h.service.compare('bench-user', loopId);
    const rec = await h.service.recommend('bench-user', loopId);
    const loop = rec.data;
    assertScenario(
      'paid capability gated behind approval',
      loop !== undefined &&
        loop.status === 'AWAITING_APPROVAL' &&
        loop.approvals.some((a) => a.state === 'REQUIRED') &&
        loop.recommendations.some((r) => r.approvalRequired && r.acquisition === 'PAID'),
      `status=${loop?.status} · approvals=${loop?.approvals.map((a) => a.state).join(',')} · acquisition=${loop?.recommendations[0]?.acquisition}`,
    );
  }

  // 4. GitHub discovery is UNTRUSTED INPUT — never auto-activated, approval required.
  //    Discovery items flow through the ai-world seam (untrusted until security
  //    + license review); the assembler flags them SECURITY_REVIEW_REQUIRED and
  //    approvalRequired=true — they are never assumed executable.
  {
    const h = createHarness();
    const started = await h.service.start('bench-user', 'Create a professional blog post');
    const loopId = started.data?.loopId ?? '';
    const discovered = await h.service.discover('bench-user', loopId);
    const github = discovered.data?.candidates.find((c) => c.candidate === 'OpenRepo Kit');
    assertScenario(
      'GitHub candidate stays untrusted (approval-required)',
      github !== undefined &&
        github.approvalRequired &&
        github.securityStatus === 'SECURITY_REVIEW_REQUIRED' &&
        github.costClass === 'GITHUB_PROJECT',
      `source=${github?.source} · costClass=${github?.costClass} · approvalRequired=${github?.approvalRequired} · security=${github?.securityStatus}`,
    );
  }

  // 5. Quality beats cost: the paid alternative is RECOMMENDED because evidence
  //    is materially better — never because it is paid, never blocked because free.
  {
    const h = createHarness();
    const started = await h.service.start('bench-user', 'Create a professional blog post');
    const loopId = started.data?.loopId ?? '';
    await h.service.discover('bench-user', loopId);
    await h.service.compare('bench-user', loopId);
    const rec = await h.service.recommend('bench-user', loopId);
    const cmp = rec.data?.comparisons[0];
    assertScenario(
      'quality-first comparison (96 > 70, evidence-backed)',
      cmp?.betterOptionAvailable === true &&
        cmp.alternative?.quality === 96 &&
        cmp.materialImprovement &&
        cmp.why.length > 0,
      `better=${cmp?.betterOptionAvailable} · altQuality=${cmp?.alternative?.quality} · why=${cmp?.why.length} reason(s)`,
    );
  }

  // 6. Free/local fallback honesty: the local model is NOT available on this
  //    hardware → the recommendation never invents a localAlternative; and when
  //    the better option is paid, no free alternative is fabricated either
  //    (the configured free base remains the current option, not a claim).
  {
    const h = createHarness();
    const started = await h.service.start('bench-user', 'Create a professional blog post');
    const loopId = started.data?.loopId ?? '';
    const discovered = await h.service.discover('bench-user', loopId);
    await h.service.compare('bench-user', loopId);
    const rec = await h.service.recommend('bench-user', loopId);
    const recommendation = rec.data?.recommendations[0];
    const local = discovered.data?.candidates.find((c) => c.candidate === 'Local Q4');
    assertScenario(
      'free/local fallback honesty',
      recommendation !== undefined &&
        recommendation.localAlternative === undefined &&
        local !== undefined &&
        local.localAvailability === 'no' &&
        local.approvalRequired,
      `localCandidate=${local?.localAvailability ?? 'absent'} · localAlternative=${recommendation?.localAlternative ?? 'none (honest: unavailable)'} · freeAlternative=${recommendation?.freeAlternative ?? 'none (paid alternative, no free claim)'}`,
    );
  }

  // 7. Execution failure → honest FAILED, never fabricated success.
  {
    const h = createHarness({
      start: () =>
        Promise.resolve({ success: false, error: 'execution start failed (benchmark simulated)' }),
    });
    const started = await h.service.start('bench-user', 'Create a professional blog post');
    const loopId = started.data?.loopId ?? '';
    await h.service.discover('bench-user', loopId);
    await h.service.compare('bench-user', loopId);
    const rec = await h.service.recommend('bench-user', loopId);
    const recommendation = rec.data?.recommendations[0];
    if (recommendation) await h.service.approve('bench-user', loopId, recommendation.id);
    const handoff = await h.service.handOff('bench-user', loopId);
    assertScenario(
      'execution failure is honest (no fabricated result)',
      !handoff.success && (handoff.code === 'PLAN_FAILED' || handoff.error !== undefined),
      `handoff.success=${handoff.success} · error=${handoff.error ?? 'none'}`,
    );
  }

  // 8. Notification gating: only materially relevant events are emitted.
  {
    const h = createHarness();
    const started = await h.service.start('bench-user', 'Create a professional blog post');
    const loopId = started.data?.loopId ?? '';
    await h.service.discover('bench-user', loopId);
    await h.service.compare('bench-user', loopId);
    await h.service.recommend('bench-user', loopId);
    await h.service.approve('bench-user', loopId, 'n/a');
    const loop = h.service.get('bench-user', loopId);
    const loopToNotify =
      loop.data ?? (await h.service.start('bench-user', 'Create a professional blog post')).data;
    if (loopToNotify) {
      const low = await h.service.emitNotification('bench-user', loopToNotify.loopId, {
        kind: 'PRICE_CHANGE',
        title: 'Minor price tweak',
        body: 'No material change for this task.',
        relevance: 5,
      });
      const high = await h.service.emitNotification('bench-user', loopToNotify.loopId, {
        kind: 'BETTER_MODEL',
        title: 'Materially better model available',
        body: 'Strong task evidence for your current goal.',
        relevance: 92,
      });
      assertScenario(
        'notification relevance gating',
        low.success &&
          low.data !== undefined &&
          'dropped' in (low.data as { dropped?: boolean }) &&
          high.success &&
          high.data !== undefined &&
          !('dropped' in (high.data as { dropped?: boolean })),
        `lowRelevance=${
          low.data && 'dropped' in (low.data as { dropped?: boolean }) ? 'dropped' : 'emitted'
        } · highRelevance=${
          high.data && !('dropped' in (high.data as { dropped?: boolean })) ? 'emitted' : 'dropped'
        }`,
      );
    } else {
      assertScenario('notification relevance gating', false, 'loop unavailable');
    }
  }

  // 9. Owner scoping / IDOR: another owner cannot read or list the loop.
  {
    const h = createHarness();
    const started = await h.service.start('bench-user', 'Create a professional blog post');
    const loopId = started.data?.loopId ?? '';
    const foreignGet = h.service.get('attacker-user', loopId);
    const foreignList = h.service.list('attacker-user');
    const ownerList = h.service.list('bench-user');
    assertScenario(
      'owner scoping / IDOR',
      !foreignGet.success &&
        foreignGet.code === 'NOT_FOUND' &&
        foreignList.data?.length === 0 &&
        (ownerList.data?.length ?? 0) >= 1,
      `foreignGet.code=${foreignGet.code} · foreignList=${foreignList.data?.length} · ownerList=${ownerList.data?.length}`,
    );
  }

  // 10. Short/unparseable objective → INVALID_INPUT before any work.
  {
    const h = createHarness();
    const res = await h.service.start('bench-user', 'x');
    assertScenario(
      'short objective rejected',
      !res.success && res.code === 'INVALID_INPUT',
      `success=${res.success} · code=${res.code ?? 'none'}`,
    );
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  const allPass = outcomes.every((o) => o.pass);
  console.log('EPIC-017 LIVE INTELLIGENCE BRIDGE BENCHMARK — UNDERSTAND → … → NOTIFY');
  console.log('───────────────────────────────────────────────────────────────────');
  for (const o of outcomes) {
    console.log(`${o.pass ? '✅' : '✗'} ${o.name}: ${o.detail}`);
  }
  console.log('───────────────────────────────────────────────────────────────────');
  console.log(
    `Total scenarios: ${outcomes.length} · Passed: ${outcomes.filter((o) => o.pass).length}`,
  );
  console.log(`Verdict: ${allPass ? 'PASS' : 'REVIEW'}`);
  if (!allPass) {
    console.log('  ✗ One or more bridge contracts did not hold.');
    process.exitCode = 1;
  } else {
    console.log(
      '  ✅ USER TASK → BRAIN → INTELLIGENCE → COMPARE → RECOMMEND → APPROVAL → HANDOFF → EXECUTE → VERIFY → EVALUATE → FEEDBACK → NOTIFY.',
    );
  }
}

main().catch((error: unknown) => {
  console.error(
    '✗ Live Intelligence Bridge benchmark FAILED:',
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});

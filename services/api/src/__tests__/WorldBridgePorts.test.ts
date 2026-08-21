// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Gateway: WorldBridgePorts unit tests (SPRINT-034/035)
// The REAL seams between the world model and the frozen estate. The
// WorldRouter tests above use a hand-built world service — these tests
// exercise the actual factory functions so the production wiring is covered:
//   createWorldBrainPort       — opportunities/tasks through the Brain
//   createWorldProactivePort   — assessBusiness (failure throws honestly)
//   createWorldFabricPort      — advisory select/validate + measured cost
//   createWorldActionPort      — the frozen ActionClassPolicy boundary
//   createWorldApprovalPort    — approval ONLY through the Brain authority
//   createWorldCostPort        — measure-only, honest absent (never zero)
//   createCommandCenterPresentationPort — read-only voice answers, VOICE ≠ AUTH
//   resolveWorldSignalSources  — operator env → LiveSignalAdapter (UNAVAILABLE honest)
//   createWorldControlPort     — opportunity lifecycle + autonomy posture
// ─────────────────────────────────────────────────────────────────────────────

import { afterEach, describe, expect, it } from 'vitest';
import { InMemoryTraceStore, ExecutionTraceProvider } from '@vedmoulya/core';
import { InMemoryWorldStores, WorldModelService } from '@vedmoulya/world-model';
import type { BrainApplicationService } from '@vedmoulya/brain';
import type { ActiveIntelligenceControlPlane } from '@vedmoulya/control-plane';
import type { IntelligenceFabricService } from '@vedmoulya/intelligence-fabric';
import type { ProactiveIntelligenceService } from '@vedmoulya/proactive';
import { CostLedger } from '../observability/CostLedger.js';
import {
  createWorldActionPort,
  createWorldApprovalPort,
  createWorldBrainPort,
  createWorldControlPort,
  createWorldCostPort,
  createWorldFabricPort,
  createWorldProactivePort,
  createCommandCenterPresentationPort,
  resolveWorldSignalSources,
} from '../infrastructure/WorldBridgePorts.js';

// ── Fakes (structural — the factories only depend on the public surface) ────

function fakeBrain(overrides: Record<string, unknown> = {}): BrainApplicationService {
  return {
    listOpportunities: (userId: string) => ({
      success: true,
      data: [
        {
          id: 'opp-1',
          category: 'business',
          title: 'AI automation service',
          description: 'Deliver workflow automation.',
          evidence: ['ai-world-discovery'],
          uncertainty: 0.3,
          status: 'RECOMMENDED',
          estimatedValue: 1000,
          cost: 100,
          risk: 'MEDIUM',
          requiredCapabilities: ['TEXT_GENERATION'],
          recommendedNextAction: 'Research customers.',
          userId,
        },
      ],
    }),
    listTasks: (userId: string) => ({
      success: true,
      data: [
        {
          id: 'task-1',
          objective: 'Research the market',
          status: 'AWAITING_APPROVAL',
          createdAt: 'now',
          userId,
        },
      ],
    }),
    createTask: (userId: string, action: string) => ({
      success: true,
      data: { id: 'brain-task-1', userId, objective: action },
    }),
    requestApproval: () => ({
      success: true,
      data: { id: 'brain-task-1', status: 'AWAITING_APPROVAL' },
    }),
    approve: (userId: string, _taskId: string, action: string) => ({
      success: true,
      data: {
        id: 'brain-task-1',
        userId,
        updatedAt: '2026-08-15T10:00:00.000Z',
        approvalGranted: [action],
      },
    }),
    reject: () => ({ success: true, data: { id: 'brain-task-1' } }),
    ...overrides,
  } as unknown as BrainApplicationService;
}

function fakeFabric(): IntelligenceFabricService {
  return {
    select: async (input: never) => ({
      strategy: (input as { strategy: string }).strategy,
      selected: { providerId: 'openai', name: 'OpenAI', capabilityMatched: true, evidence: [] },
      ranked: [],
      reasons: ['matched'],
    }),
    validateWorkflow: (plan: never) =>
      (plan as { taskCount: number }).taskCount <= 24
        ? { allowed: true, reason: 'within bounds' }
        : { allowed: false, reason: 'too many tasks', exceeded: 'tasks' },
    costPort: undefined,
  } as unknown as IntelligenceFabricService;
}

function fakeProactive(): ProactiveIntelligenceService {
  return {
    assessBusiness: (userId: string, input: never) => ({
      success: true,
      data: {
        id: 'ba-1',
        ownerId: userId,
        title: (input as { title: string }).title,
        description: 'desc',
        category: 'Consulting / services',
        score: 0.5,
        businessCase: ['Capability fit.'],
        riskLevel: 'MEDIUM',
        mvpPlan: ['Research.'],
        authorizationRequired: true,
        status: 'RESEARCHED',
        evidence: ['capability fit'],
        createdAt: '2026-08-14T10:00:00.000Z',
      },
    }),
  } as unknown as ProactiveIntelligenceService;
}

function fakeControlPlane(overrides: Record<string, unknown> = {}): ActiveIntelligenceControlPlane {
  return {
    listOpportunities: () => [
      {
        id: 'opp-1',
        title: 'AI automation service',
        category: 'business',
        status: 'RECOMMENDED',
        riskLevel: 'MEDIUM',
        estimatedCost: { value: 100, status: 'ESTIMATED', evidence: ['x'] },
        estimatedValue: { value: 1000, status: 'ESTIMATED', evidence: ['x'] },
        evidence: ['ai-world-discovery'],
        recommendedWorkflow: 'build',
        createdAt: 'now',
        updatedAt: 'now',
        ownerId: 'c-1',
      },
    ],
    getSettings: () => ({ autonomyLevel: 2, userConfirmed: true, maxDailyCostUsd: 10 }),
    stopStatus: () => ({ engaged: false }),
    ...overrides,
  } as unknown as ActiveIntelligenceControlPlane;
}

/** A minimal world service with ONLY the read surfaces the presentation port
 *  uses — the port is a structural consumer. */
function fakeWorld(overrides: Record<string, unknown> = {}): WorldModelService {
  return {
    founderBriefing: async (userId: string) => ({
      success: true,
      data: {
        advisory: true,
        hasContent: true,
        today: {
          pendingApprovals: [{ title: 'Publish the report', category: 'OPPORTUNITY' }],
          activeOpportunities: 1,
        },
        attention: [{ title: 'Signals unavailable', reason: 'No configured source.' }],
        whatChanged: [{ label: 'New opportunity discovered' }],
      },
      userId,
    }),
    opportunityPipeline: (userId: string) => ({
      success: true,
      data: [{ title: 'AI automation service', score: 0.8, capitalMode: 'LOW_COST', userId }],
    }),
    listBlueprintApprovals: () => ({
      success: true,
      data: [
        {
          id: 'req-1',
          action: 'Publish the report to the website',
          status: 'WAITING_FOR_APPROVAL',
          executed: false,
        },
      ],
    }),
    revenueRanking: (userId: string) => ({
      advisory: true,
      entries: [
        { streamName: 'AI services', estimatedMargin: 0.6, roiUsd: 2.0, rankScore: 0.8, userId },
      ],
    }),
    overview: async (userId: string) => ({ success: true, data: { userId } }),
    commandCenter: async (userId: string) => ({
      advisory: true,
      portfolio: { costDailyUsd: 1.25 },
      userId,
    }),
    ...overrides,
  } as unknown as WorldModelService;
}

const origEnv = { ...process.env };

afterEach(() => {
  if (origEnv.WORLD_SIGNAL_BASE_URL)
    process.env.WORLD_SIGNAL_BASE_URL = origEnv.WORLD_SIGNAL_BASE_URL;
  else delete process.env.WORLD_SIGNAL_BASE_URL;
  if (origEnv.WORLD_SIGNAL_TOKEN) process.env.WORLD_SIGNAL_TOKEN = origEnv.WORLD_SIGNAL_TOKEN;
  else delete process.env.WORLD_SIGNAL_TOKEN;
});

describe('createWorldBrainPort', () => {
  it('maps Brain opportunities + tasks into the world DTO', () => {
    const port = createWorldBrainPort(fakeBrain());
    const opps = port.listOpportunities('c-1');
    expect(opps.success).toBe(true);
    if (!opps.success) return;
    expect(opps.data[0]?.title).toBe('AI automation service');
    expect(opps.data[0]?.evidence).toEqual(['ai-world-discovery']);
    const tasks = port.listTasks('c-1');
    expect(tasks.success).toBe(true);
    if (!tasks.success) return;
    expect(tasks.data[0]?.objective).toBe('Research the market');
  });

  it('surfaces a Brain failure honestly (never fabricates a result)', () => {
    const port = createWorldBrainPort(
      fakeBrain({
        listOpportunities: () => ({ success: false, error: 'Brain unavailable.' }),
      }),
    );
    const result = port.listOpportunities('c-1');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Brain unavailable.');
  });
});

describe('createWorldProactivePort', () => {
  it('returns the assessor result (research/score only)', () => {
    const port = createWorldProactivePort(fakeProactive());
    const result = port.assessBusiness('c-1', { title: 'AI consulting' } as never);
    expect(result.authorizationRequired).toBe(true);
    expect(result.title).toBe('AI consulting');
  });

  it('throws honestly when the assessor fails', () => {
    const failing: ProactiveIntelligenceService = {
      assessBusiness: () => ({ success: false, error: 'Assessor down.' }),
    } as unknown as ProactiveIntelligenceService;
    const port = createWorldProactivePort(failing);
    expect(() => port.assessBusiness('c-1', { title: 'x' } as never)).toThrow(/Assessor down/);
  });
});

describe('createWorldFabricPort', () => {
  it('delegates advisory selection + bounded validation to the fabric', async () => {
    const port = createWorldFabricPort(fakeFabric());
    const strategy = await port.selectStrategy({
      strategy: 'QUALITY',
      taskPrivacy: 'public',
      capability: 'TEXT_GENERATION',
    });
    expect(strategy.strategy).toBe('QUALITY');
    expect(strategy.selected?.providerId).toBe('openai');
    const ok = port.validateWorkflow({ taskCount: 5 } as never);
    expect(ok.allowed).toBe(true);
    const denied = port.validateWorkflow({ taskCount: 100 } as never);
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) expect(denied.exceeded).toBe('tasks');
  });

  it('returns measured cost only when the fabric exposes a cost port', async () => {
    const port = createWorldFabricPort(fakeFabric());
    const snapshot = port.costSnapshot('c-1');
    expect(snapshot.dailyUsd).toBeUndefined();
    expect(snapshot.providerUsd).toBeUndefined();
  });
});

describe('createWorldActionPort', () => {
  it('classifies through the frozen ActionClassPolicy', () => {
    const port = createWorldActionPort();
    const cls = port.classify('Publish the report to the website', {});
    expect(cls.actionClass).toBe('C');
  });
});

describe('createWorldApprovalPort', () => {
  it('requestApproval creates the Brain task and registers it — the world never approves itself', () => {
    const port = createWorldApprovalPort(fakeBrain());
    const result = port.requestApproval({
      userId: 'c-1',
      action: 'Publish the report to the website',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.taskId).toBe('brain-task-1');
  });

  it('requestApproval fails honestly when the Brain cannot create the task', () => {
    const port = createWorldApprovalPort(
      fakeBrain({ createTask: () => ({ success: false, error: 'Invalid objective.' }) }),
    );
    const result = port.requestApproval({ userId: 'c-1', action: 'x' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/Invalid objective/);
  });

  it('requestApproval fails honestly when the Brain refuses registration', () => {
    const port = createWorldApprovalPort(
      fakeBrain({ requestApproval: () => ({ success: false, error: 'Not sensitive.' }) }),
    );
    const result = port.requestApproval({ userId: 'c-1', action: 'Read a file' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/Not sensitive/);
  });

  it('approve grants ONLY through the Brain authority; records the decision', () => {
    const port = createWorldApprovalPort(fakeBrain());
    const result = port.approve({
      userId: 'c-1',
      taskId: 'brain-task-1',
      action: 'Publish the report to the website',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.grantedBy).toBe('c-1');
      expect(result.data.scope).toBe('Publish the report to the website');
      expect(result.data.grantedAt).toBe('2026-08-15T10:00:00.000Z');
    }
  });

  it('approve surfaces a Brain refusal (no approval → no grant)', () => {
    const port = createWorldApprovalPort(
      fakeBrain({ approve: () => ({ success: false, error: 'No pending approval.' }) }),
    );
    const result = port.approve({ userId: 'c-1', taskId: 't', action: 'x' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/No pending approval/);
  });

  it('reject routes through the same Brain authority', () => {
    const port = createWorldApprovalPort(fakeBrain());
    const result = port.reject({ userId: 'c-1', taskId: 'brain-task-1', action: 'x' });
    expect(result.success).toBe(true);
  });
});

describe('createWorldCostPort', () => {
  it('returns the measured owner aggregate from the CostLedger (never fabricated)', async () => {
    const store = new InMemoryTraceStore();
    const provider = new ExecutionTraceProvider({ store });
    const ledger = new CostLedger();
    await provider.withSpan({ name: 'ai.stream', userId: 'c-1' }, async (root) => {
      root.addEvent('loop.step', { provider: 'openai', cost_usd: 2.5, tokens_total: 1000 });
    });
    const port = createWorldCostPort(ledger, store);
    const owner = port.measuredCostUsd('c-1');
    expect(owner?.value).toBeCloseTo(2.5, 5);
    expect(owner?.evidence).toEqual(['cost-ledger:owner-aggregate']);
  });

  it('stream-scoped queries return undefined — a per-stream figure would be fabricated', async () => {
    const store = new InMemoryTraceStore();
    const ledger = new CostLedger();
    const port = createWorldCostPort(ledger, store);
    expect(port.measuredCostUsd('c-1', { streamId: 'stream-1' })).toBeUndefined();
  });

  it('absent spend returns undefined — unknown cost is never zero', async () => {
    const store = new InMemoryTraceStore();
    const ledger = new CostLedger();
    const port = createWorldCostPort(ledger, store);
    expect(port.measuredCostUsd('nobody')).toBeUndefined();
  });
});

describe('createCommandCenterPresentationPort (SPRINT-035)', () => {
  const cases: Array<{
    question:
      | 'FOCUS_TODAY'
      | 'OPPORTUNITIES'
      | 'PENDING_APPROVALS'
      | 'BEST_MARGIN'
      | 'WHAT_CHANGED'
      | 'WORKFLOW_COST';
    expect: RegExp;
  }> = [
    { question: 'FOCUS_TODAY', expect: /Today you have 2 items to focus on/ },
    { question: 'OPPORTUNITIES', expect: /1 opportunity in your pipeline/ },
    { question: 'PENDING_APPROVALS', expect: /1 action waiting for your approval/ },
    { question: 'BEST_MARGIN', expect: /AI services has the best margin evidence/ },
    { question: 'WHAT_CHANGED', expect: /New opportunity discovered/ },
    { question: 'WORKFLOW_COST', expect: /Measured cost is 1.250 USD per day/ },
  ];

  it.each(cases)(
    'answers $question with read-only text (no side effects)',
    async ({ question, expect: re }) => {
      const port = createCommandCenterPresentationPort(() => fakeWorld());
      const answer = await port.ask({ userId: 'c-1', question });
      expect(answer.ok).toBe(true);
      expect(answer.content).toMatch(re);
    },
  );

  it('answers honestly when the world model is not ready', async () => {
    const port = createCommandCenterPresentationPort(() => undefined);
    const answer = await port.ask({ userId: 'c-1', question: 'FOCUS_TODAY' });
    expect(answer.ok).toBe(false);
    expect(answer.error).toMatch(/not ready/);
  });

  it('FOCUS_TODAY stays no-spam when the briefing has no content', async () => {
    const port = createCommandCenterPresentationPort(() =>
      fakeWorld({ founderBriefing: async () => ({ success: true, data: { hasContent: false } }) }),
    );
    const answer = await port.ask({ userId: 'c-1', question: 'FOCUS_TODAY' });
    expect(answer.ok).toBe(true);
    expect(answer.content).toMatch(/Nothing urgent/);
  });

  it('OPPORTUNITIES is honest-empty when the pipeline is empty', async () => {
    const port = createCommandCenterPresentationPort(() =>
      fakeWorld({ opportunityPipeline: () => ({ success: true, data: [] }) }),
    );
    const answer = await port.ask({ userId: 'c-1', question: 'OPPORTUNITIES' });
    expect(answer.content).toMatch(/pipeline is empty/);
  });

  it('PENDING_APPROVALS is honest when nothing waits', async () => {
    const port = createCommandCenterPresentationPort(() =>
      fakeWorld({ listBlueprintApprovals: () => ({ success: true, data: [] }) }),
    );
    const answer = await port.ask({ userId: 'c-1', question: 'PENDING_APPROVALS' });
    expect(answer.content).toMatch(/Nothing is waiting/);
  });

  it('BEST_MARGIN refuses to fabricate margin when no evidence exists', async () => {
    const port = createCommandCenterPresentationPort(() =>
      fakeWorld({ revenueRanking: () => ({ advisory: true, entries: [] }) }),
    );
    const answer = await port.ask({ userId: 'c-1', question: 'BEST_MARGIN' });
    expect(answer.content).toMatch(/no verified margin evidence/);
  });

  it('WHAT_CHANGED is honest when nothing changed', async () => {
    const port = createCommandCenterPresentationPort(() =>
      fakeWorld({
        founderBriefing: async () => ({
          success: true,
          data: { hasContent: false, whatChanged: [] },
        }),
      }),
    );
    const answer = await port.ask({ userId: 'c-1', question: 'WHAT_CHANGED' });
    expect(answer.content).toMatch(/Nothing significant changed/);
  });

  it('WORKFLOW_COST is honest when no measured cost exists', async () => {
    const port = createCommandCenterPresentationPort(() =>
      fakeWorld({ commandCenter: async () => ({ advisory: true, portfolio: {} }) }),
    );
    const answer = await port.ask({ userId: 'c-1', question: 'WORKFLOW_COST' });
    expect(answer.content).toMatch(/No measured cost evidence/);
  });

  // ── SPRINT-039 — founder evidence loop presentation (read-only) ───────────
  const comparison = (entryOverrides: Record<string, unknown> = {}) => ({
    advisory: true,
    ownerId: 'c-1',
    generatedAt: '2026-08-15T00:00:00.000Z',
    entries: [
      {
        problemId: 'p-1',
        problemStatement: 'Manual invoice reconciliation is slow',
        state: 'STRONG_EVIDENCE',
        problemSeverity: 0.8,
        evidenceStrength: 'STRONG',
        opportunityScore: 0.7,
        willingnessToPaySignals: 2,
        verifiedPayments: 1,
        experimentCost: 'NO_COST',
        founderInvolvement: 'LOW',
        risk: 'LOW',
        nextBestAction: 'RUN_NO_COST_EXPERIMENT',
        reasons: ['Four independent customers confirmed the pain.'],
        ...entryOverrides,
      },
    ],
  });

  it.each([
    { question: 'STRONGEST_OPPORTUNITIES' as const, expect: /strongest opportunities/ },
    { question: 'EVIDENCE' as const, expect: /Evidence summary/ },
    { question: 'NEXT_TEST' as const, expect: /Next test/ },
    { question: 'WHY_RECOMMENDATION' as const, expect: /Because:/ },
    { question: 'STRONGEST_PAYMENT' as const, expect: /strongest payment evidence/ },
    { question: 'STOP_OPPORTUNITIES' as const, expect: /Nothing is currently flagged to stop/ },
  ])('answers $question with read-only text (SPRINT-039)', async ({ question, expect: re }) => {
    const port = createCommandCenterPresentationPort(() =>
      fakeWorld({ compareOpportunities: () => comparison() }),
    );
    const answer = await port.ask({ userId: 'c-1', question });
    expect(answer.ok).toBe(true);
    expect(answer.content).toMatch(re);
  });

  it('STOP_OPPORTUNITIES names the STOP candidates when evidence supports it', async () => {
    const port = createCommandCenterPresentationPort(() =>
      fakeWorld({
        compareOpportunities: () =>
          comparison({
            state: 'STOP',
            nextBestAction: 'STOP',
            reasons: ['No willingness-to-pay evidence after three attempts.'],
          }),
      }),
    );
    const answer = await port.ask({ userId: 'c-1', question: 'STOP_OPPORTUNITIES' });
    expect(answer.ok).toBe(true);
    expect(answer.content).toMatch(/Consider stopping/);
  });

  it('STRONGEST_OPPORTUNITIES is honest-empty with no qualifying evidence', async () => {
    const port = createCommandCenterPresentationPort(() =>
      fakeWorld({
        compareOpportunities: () =>
          comparison({ state: 'INSUFFICIENT_EVIDENCE', verifiedPayments: 0 }),
      }),
    );
    const answer = await port.ask({ userId: 'c-1', question: 'STRONGEST_OPPORTUNITIES' });
    expect(answer.content).toMatch(/meet the evidence bar/);
  });

  it('STRONGEST_PAYMENT never promotes interest to revenue', async () => {
    const port = createCommandCenterPresentationPort(() =>
      fakeWorld({ compareOpportunities: () => comparison({ verifiedPayments: 0 }) }),
    );
    const answer = await port.ask({ userId: 'c-1', question: 'STRONGEST_PAYMENT' });
    expect(answer.content).toMatch(/No verified payment evidence exists yet/);
  });
});

describe('resolveWorldSignalSources (SPRINT-034)', () => {
  it('returns NO sources without operator configuration — honest UNAVAILABLE upstream', () => {
    delete process.env.WORLD_SIGNAL_BASE_URL;
    expect(resolveWorldSignalSources()).toEqual([]);
  });

  it('builds a LiveSignalAdapter from server-side env configuration', () => {
    process.env.WORLD_SIGNAL_BASE_URL = 'https://signals.example.test';
    process.env.WORLD_SIGNAL_TOKEN = 'secret-token';
    const sources = resolveWorldSignalSources();
    expect(sources.length).toBe(1);
  });
});

describe('createWorldControlPort', () => {
  it('maps the control plane opportunity lifecycle records', () => {
    const port = createWorldControlPort(fakeControlPlane());
    const opps = port.listOpportunities('c-1');
    expect(opps[0]?.title).toBe('AI automation service');
    expect(opps[0]?.status).toBe('RECOMMENDED');
  });

  it('reports autonomy posture read-only; defaults to level 0 without confirmed settings', () => {
    const port = createWorldControlPort(
      fakeControlPlane({ getSettings: () => undefined, stopStatus: () => ({ engaged: true }) }),
    );
    const posture = port.autonomyPosture('c-1');
    expect(posture.emergencyStopEngaged).toBe(true);
    expect(posture.autonomyLevel).toBe(0);
    expect(posture.settingsConfirmed).toBe(false);
  });
});

// The remaining exports are compile-time structural re-exports — verify the
// factory identity is preserved so wiring cannot silently no-op.
describe('createWorldStores', () => {
  it('passes the persistence-bundle stores through unchanged', async () => {
    const { createWorldStores } = await import('../infrastructure/WorldBridgePorts.js');
    const stores = new InMemoryWorldStores();
    expect(createWorldStores(stores)).toBe(stores);
  });
});

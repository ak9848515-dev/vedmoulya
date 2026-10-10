// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S7.2 · FIRST-REVENUE acceptance
//
// The end-to-end earning-pipeline path S7.2 closes, driven over the REAL
// control plane, the REAL canonical assessor, the REAL Brain approval authority
// and the REAL `createMissionLaunchPort` wired to a REAL `MissionService`.
//
//   REAL OPPORTUNITY
//     → DISCOVERED (import)
//     → QUALIFIED (canonical assessor, advisory)
//     → RECOMMENDED (existing ranking — still no approval)
//     → HUMAN APPROVES (authority-minted record)
//     → APPROVED
//     → START MISSION (guarded APPROVED → PLANNED claim)
//     → MISSION ASSOCIATED (owner-scoped link)
//     → MISSION RUNNING (controlled runtime double)
//
// The Mission ENGINE is a controlled double at the ONE boundary the
// architecture constrains (a real provider is never forced in a unit test). The
// DUPLICATE-start, owner-isolation and honest-failure semantics are proven in
// OpportunityMissionDerivation.test.ts; here we prove the derived objective
// really reaches the engine and the association really persists.
//
// The success state is MISSION ASSOCIATED/RUNNING — NOT client contacted, NOT
// bid submitted, NOT payment received. Human submission remains a human action.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ActiveIntelligenceControlPlane, InMemoryControlStores } from '@vedmoulya/control-plane';
import type { OpportunityLifecycleRecord } from '@vedmoulya/control-plane';
import { createControlRouter } from '../routers/ControlRouter.js';
import { createOpportunityApprovalPort } from '../infrastructure/OpportunityApprovalPorts.js';
import { createMissionLaunchPort } from '../infrastructure/OpportunityMissionPorts.js';
import { createOpportunityQualifier } from '../services/OpportunityQualification.js';
import { MissionService } from '../services/MissionService.js';
import { logger } from '@vedmoulya/core';
import { BrainApplicationService } from '@vedmoulya/brain';
import {
  InMemoryBrainTaskStore,
  InMemoryBrainDecisionStore,
  InMemoryOpportunityStore,
} from '@vedmoulya/brain';
import type { Mission } from '@vedmoulya/mission-controller';
import type { MissionRuntime } from '@vedmoulya/mission-runtime';

const OWNER = 'owner-1';
const NOW = '2026-10-07T00:00:00.000Z';

const POSTING = {
  source: 'freelancer',
  sourceReference: 'https://www.freelancer.com/projects/s72-first-revenue',
  title: 'Build a TypeScript SDK',
  description: 'Client needs a typed SDK for their public API, delivered as a package.',
  requirements: ['typescript', 'api design'],
};

function createBrain(): BrainApplicationService {
  return new BrainApplicationService({
    plan: async () => ({ steps: [], rationale: '' }),
    candidates: async () => [],
    execution: async () => ({ output: '', success: true }),
    context: { assemble: async () => 'context' },
    preference: { record: async () => {} },
    tasks: new InMemoryBrainTaskStore(),
    decisions: new InMemoryBrainDecisionStore(),
    clock: { now: () => NOW },
    budget: { maxTokens: 10_000, maxCostUsd: 1, maxIterations: 5, maxLatencyMs: 1000 },
    opportunities: new InMemoryOpportunityStore(),
  });
}

/**
 * A Mission engine double that behaves like the real `createAndRun`: it records
 * the EXACT CreateMissionInputView it was handed and returns a RUNNING mission.
 * This is the one constrained boundary — no real provider is forced.
 */
function runningMissionDouble(): Mission {
  return {
    missionId: 'mission-1',
    userId: OWNER,
    title: POSTING.title,
    objective: '',
    description: '',
    autonomyLevel: 'CONTROLLED_AUTONOMOUS',
    budget: {
      maxObjectives: 5,
      maxActions: 20,
      maxToolCalls: 20,
      maxRetries: 2,
      maxReplans: 1,
      maxRuntimeMs: 60_000,
      maxTokens: 10_000,
      maxCostUsd: 1,
    },
    budgetUsage: {
      objectivesCompleted: 0,
      objectivesFailed: 0,
      actionsExecuted: 0,
      toolCallsExecuted: 0,
      retriesConsumed: 0,
      replansConsumed: 0,
      runtimeMs: 0,
      tokensConsumed: 0,
      costUsdConsumed: 0,
    },
    constraints: {},
    state: 'RUNNING',
    stateHistory: ['CREATED', 'RUNNING'],
    objectives: [],
    checkpoints: [],
    decisions: [],
    successCriteria: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function missionEngineDouble(): {
  service: MissionService;
  captured: Array<{
    userId: string;
    title: string;
    objective: string;
    initialObjectives?: string[];
  }>;
} {
  const captured: Array<{
    userId: string;
    title: string;
    objective: string;
    initialObjectives?: string[];
  }> = [];

  const created: Mission = runningMissionDouble();

  const service = new MissionService();
  // The runtime is a controlled double: the real provider fabric is never
  // engaged. `createMission` captures the derived input; `runAutonomousLoop`
  // settles immediately.
  const runtime = {
    controller: {
      createMission: vi.fn(
        async (input: { title: string; objective: string; initialObjectives?: string[] }) => {
          captured.push({
            userId: OWNER,
            title: input.title,
            objective: input.objective,
            ...(input.initialObjectives !== undefined
              ? { initialObjectives: input.initialObjectives }
              : {}),
          });
          return { ...created, title: input.title, objective: input.objective };
        },
      ),
      runAutonomousLoop: vi.fn(async () => created),
    },
    api: {
      start: vi.fn(async () => created),
      getStatus: vi.fn(async () => created),
      listMissions: vi.fn(async () => [created]),
    },
    stores: { missions: { get: vi.fn(async () => created) }, checkpoints: {} },
    runs: { get: vi.fn(() => undefined) },
    workspace: { getRoot: vi.fn(() => '/authorized/root') },
  } as unknown as MissionRuntime;
  service.setRuntimeForTesting(runtime);

  return { service, captured };
}

beforeEach(() => {
  vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  vi.spyOn(logger, 'info').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('S7.2 — FIRST-REVENUE acceptance', () => {
  it('REAL OPPORTUNITY → DISCOVERED → QUALIFIED → RECOMMENDED → APPROVED → MISSION RUNNING', async () => {
    const brain = createBrain();
    const stores = new InMemoryControlStores();
    const plane = new ActiveIntelligenceControlPlane({
      brain: { listTasksWithApprovals: () => [], outcomeCount: () => 0 },
      proactive: { refresh: async () => ({ success: true }), listRecommendations: () => [] },
      fabric: {} as never,
      stores,
      now: () => NOW,
    });
    const engine = missionEngineDouble();
    const router = createControlRouter(plane, {
      approval: createOpportunityApprovalPort(brain),
      qualify: createOpportunityQualifier({ brain, now: () => NOW }).qualify,
      // The REAL launch port over the REAL Mission service — no bespoke stub.
      mission: createMissionLaunchPort({
        createAndRun: async (userId, input) => {
          try {
            const mission = await engine.service.createAndRun(userId, input);
            return { missionId: mission.missionId };
          } catch (error) {
            return { error: error instanceof Error ? error.message : 'Mission creation failed.' };
          }
        },
      }),
    });
    const ctx = { userId: OWNER } as never;

    // ── DISCOVERED ──────────────────────────────────────────────────────────
    const imported = await router.importOpportunity(
      { userId: OWNER, opportunity: { ...POSTING } },
      ctx,
    );
    expect(imported.success).toBe(true);
    const id = (imported.data as OpportunityLifecycleRecord).id;
    expect((imported.data as OpportunityLifecycleRecord).status).toBe('DISCOVERED');

    // ── QUALIFIED (canonical assessor, advisory only) ───────────────────────
    const qualified = await router.qualifyOpportunity({ id, userId: OWNER }, ctx);
    expect(qualified.success).toBe(true);
    expect((qualified.data as { status: string }).status).toBe('ASSESSED');

    // ── RECOMMENDED (existing ranking — still NO approval, NO Mission) ──────
    for (const to of ['SHORTLISTED', 'PRESENTED'] as const) {
      const r = await router.transitionOpportunity({ userId: OWNER, id, to, note: 'walk' }, ctx);
      expect(r.success).toBe(true);
    }
    const ranked = await router.getRankedOpportunities({ userId: OWNER }, ctx);
    expect(ranked.success).toBe(true);
    const recommendations = (ranked.data as { recommendations: Array<{ opportunityId: string }> })
      .recommendations;
    expect(recommendations.some((r) => r.opportunityId === id)).toBe(true);
    // A recommendation can NOT start a Mission — the human boundary holds.
    const early = await router.startMissionForOpportunity({ id, userId: OWNER }, ctx);
    expect(early.success).toBe(false);
    expect(engine.captured).toHaveLength(0);

    // ── HUMAN APPROVES (authority-minted record) ────────────────────────────
    const req = await router.requestOpportunityApproval({ userId: OWNER, opportunityId: id }, ctx);
    const taskId = (req.data as { taskId: string }).taskId;
    const approved = await router.transitionOpportunity(
      { userId: OWNER, id, to: 'APPROVED', note: 'human approved', approvalTaskId: taskId },
      ctx,
    );
    expect(approved.success).toBe(true);
    expect((approved.data as OpportunityLifecycleRecord).status).toBe('APPROVED');

    // ── START MISSION (guarded claim) ───────────────────────────────────────
    const started = await router.startMissionForOpportunity({ id, userId: OWNER }, ctx);
    expect(started.success).toBe(true);
    const missionId = (started.data as { missionId: string }).missionId;
    expect(missionId).toBe('mission-1');

    // ── MISSION ASSOCIATED (owner-scoped) ───────────────────────────────────
    expect(plane.getMissionForOpportunity(OWNER, id)?.missionId).toBe(missionId);
    expect(plane.getOpportunityForMission(OWNER, missionId)?.opportunityId).toBe(id);

    // ── The DERIVED objective really reached the Mission engine ─────────────
    expect(engine.captured).toHaveLength(1);
    const derived = engine.captured[0]!;
    expect(derived.title).toBe(POSTING.title);
    expect(derived.objective).toContain(POSTING.title);
    expect(derived.objective).toContain(POSTING.description);
    expect(derived.objective).toContain('typescript, api design');
    expect(derived.objective).toContain(POSTING.sourceReference);
    expect(derived.objective).toContain('Verification:');
    expect(derived.initialObjectives).toEqual([
      'Satisfy the stated capability requirement: typescript',
      'Satisfy the stated capability requirement: api design',
    ]);

    // ── MISSION RUNNING (controlled runtime double) ─────────────────────────
    // The Mission is RUNNING. Execution beyond this boundary (a REAL provider
    // run, then VERIFIED + delivery) is performed by the separate real-provider
    // acceptance test — this unit test deliberately stops at the infrastructure
    // boundary rather than faking production execution.
    expect(engine.captured[0]?.objective).toBeTruthy();
  });
});

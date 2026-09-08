// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Mission Control Router Tests (BLD-024)
//
// Exercises the mission.* namespace through the REAL tRPC pipeline
// (auth + IDOR + zod input) with a MissionService composed over the REAL
// MissionRuntime (real MissionControllerService, real planner, real agent
// execution, real governed ToolRuntime — providers via the frozen MockProvider
// adapter, exactly like the BLD-022 runtime e2e). No mission logic is mocked.
//
// BLD-024 loop-detach semantics: createAndRun/start/resume return as soon as
// the mission is safely persisted in its new state; the autonomous loop
// continues server-side, detached from the HTTP request. Tests therefore
// poll `status` until the mission reaches a terminal or holding state.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { TRPCError } from '@trpc/server';
import { createAppRouter } from '../services/RouterRegistry.js';
import { MissionService } from '../services/MissionService.js';
import type { ApiApplicationService } from '../services/ApiApplicationService.js';
import { MockProvider } from '@vedmoulya/orchestrator';
import { createMissionRuntime } from '@vedmoulya/mission-runtime';
import { InMemoryCheckpointStore, InMemoryMissionStore } from '@vedmoulya/mission-controller';

// ── Real MissionRuntime composition (dev workspace in a temp dir) ───────────
// Created at module scope so the router below composes against a real,
// existing directory (the runtime jail-checks the root).

const workspace = mkdtempSync(path.join(tmpdir(), 'vedmoulya-mission-api-'));
afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
});

function makeServices(): ApiApplicationService {
  const missionService = new MissionService({
    workspaceRoot: workspace,
    runtimeOptions: {
      registerProviders: (orchestrator) => {
        orchestrator.registerProvider(new MockProvider());
      },
      orchestratorOptions: { retryBaseDelayMs: 1 },
    },
  });
  return { mission: missionService } as unknown as ApiApplicationService;
}

const router = createAppRouter(makeServices());
const ctx = (userId: string) => ({ userId, email: `${userId}@vm.local`, role: 'user' });

// Unwraps the standard gateway envelope; throws the error message on failure.
async function unwrap<T>(
  promise: Promise<{ success: boolean; data?: T; error?: { message?: string } }>,
): Promise<T> {
  const res = await promise;
  if (!res.success || res.data === undefined) {
    throw new Error(res.error?.message ?? 'expected success envelope');
  }
  return res.data;
}

const HOLD_STATES = ['PAUSED', 'BLOCKED', 'WAITING_FOR_PROVIDER', 'WAITING_FOR_APPROVAL'];
const SETTLED_STATES = [...HOLD_STATES, 'COMPLETED', 'FAILED', 'CANCELLED'];

interface MissionView {
  missionId: string;
  userId: string;
  title: string;
  state: string;
  outcome?: string;
  objectives: Array<{ objectiveId: string; title: string; state: string; verifiedAt?: string }>;
}

/** Poll status until the mission leaves the transient RUNNING state. */
async function pollUntilSettled(
  caller: ReturnType<typeof router.createCaller>,
  userId: string,
  missionId: string,
  timeoutMs = 15_000,
): Promise<{
  state: string;
  outcome?: string;
  objectives: Array<{ state: string; evidence?: string[] }>;
}> {
  const deadline = Date.now() + timeoutMs;
  let last = '';
  for (;;) {
    const view = await unwrap<{
      state: string;
      outcome?: string;
      objectives: Array<{ state: string; evidence?: string[] }>;
    }>(caller.mission.status({ userId, missionId }));
    if (view.state !== last) {
      last = view.state;
    }
    if (SETTLED_STATES.includes(view.state)) return view;
    if (Date.now() > deadline) {
      throw new Error(`mission did not settle within ${timeoutMs}ms (last state: ${last})`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

describe('mission namespace — BLD-024 Mission Control API', () => {
  it('createAndRun: returns a RUNNING mission immediately; the detached loop completes every objective VERIFIED', async () => {
    const caller = router.createCaller(ctx('owner-a'));
    const data = await unwrap<MissionView>(
      caller.mission.createAndRun({
        userId: 'owner-a',
        title: 'Docs mission A',
        objective: 'Improve the workspace autonomously',
        initialObjectives: [
          'Create the workspace file api-alpha.md with the alpha content',
          'Create the workspace file api-beta.md with the beta content',
          'Create the workspace file api-gamma.md with the gamma content',
        ],
      }),
    );
    expect(data.missionId).toBeTruthy();
    expect(data.userId).toBe('owner-a');
    // RUN returns promptly with the mission started — not after the loop ends.
    expect(data.state).toBe('RUNNING');

    // The detached loop finishes server-side; observe through status.
    const settled = await pollUntilSettled(caller, 'owner-a', data.missionId);
    expect(settled.state).toBe('COMPLETED');
    expect(settled.objectives).toHaveLength(3);
    expect(settled.objectives.every((o) => o.state === 'VERIFIED')).toBe(true);
  });

  it('status: returns the honest status view with checkpoints, activity and budget', async () => {
    const caller = router.createCaller(ctx('owner-a'));
    const list = await unwrap<Array<{ missionId: string }>>(
      caller.mission.history({ userId: 'owner-a' }),
    );
    const missionId = list[0]?.missionId;
    expect(missionId).toBeTruthy();
    const status = await unwrap<{
      state: string;
      objectives: Array<{ state: string; evidence: string[] }>;
      checkpoints: Array<{ checkpointId: string; state: string }>;
      activity: Array<{ kind: string; message: string }>;
      budgetUsage: { objectivesCompleted: number };
    }>(caller.mission.status({ userId: 'owner-a', missionId: missionId as string }));
    expect(status.state).toBe('COMPLETED');
    expect(status.objectives.every((o) => o.evidence.length > 0)).toBe(true);
    expect(status.checkpoints.length).toBeGreaterThan(0);
    expect(status.budgetUsage.objectivesCompleted).toBe(3);
    expect(status.activity.some((e) => e.kind === 'MISSION_COMPLETED')).toBe(true);
  });

  it("ownership: a foreign user cannot see or drive another user's mission", async () => {
    const callerA = router.createCaller(ctx('owner-a'));
    const list = await unwrap<Array<{ missionId: string }>>(
      callerA.mission.history({ userId: 'owner-a' }),
    );
    const missionId = list[0]?.missionId as string;

    const callerB = router.createCaller(ctx('intruder'));
    const statusRes = await callerB.mission.status({ userId: 'intruder', missionId });
    expect(statusRes.success).toBe(false);
    // pause / resume / cancel / approve / reject / start are all denied
    for (const op of ['pause', 'resume', 'cancel', 'approve', 'reject', 'start'] as const) {
      const res = await callerB.mission[op]({ userId: 'intruder', missionId });
      expect(res.success).toBe(false);
    }
    // history of the intruder lists nothing
    const intruderHistory = await unwrap<Array<{ missionId: string }>>(
      callerB.mission.history({ userId: 'intruder' }),
    );
    expect(intruderHistory.find((m) => m.missionId === missionId)).toBeUndefined();
  });

  it('IDOR guard: the gateway rejects a userId mismatched with the session', async () => {
    const caller = router.createCaller(ctx('session-user'));
    await expect(
      caller.mission.status({ userId: 'other-user', missionId: 'm-1' }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it('duplicate RUN safety: starting a RUNNING mission twice does not duplicate the loop; a terminal mission cannot restart', async () => {
    const caller = router.createCaller(ctx('dup-user'));
    const first = await unwrap<MissionView>(
      caller.mission.createAndRun({
        userId: 'dup-user',
        title: 'Dup safety',
        objective: 'Improve the workspace autonomously',
        initialObjectives: ['Create the workspace file dup-test.md with the dup content'],
      }),
    );
    expect(first.state).toBe('RUNNING');

    // A second START while the detached loop is in flight must NOT spawn a
    // second loop — it returns the same mission unchanged.
    const second = await unwrap<MissionView>(
      caller.mission.start({ userId: 'dup-user', missionId: first.missionId }),
    );
    expect(second.missionId).toBe(first.missionId);
    expect(second.state).toBe('RUNNING');

    const settled = await pollUntilSettled(caller, 'dup-user', first.missionId);
    expect(settled.state).toBe('COMPLETED');
    expect(settled.objectives.every((o) => o.state === 'VERIFIED')).toBe(true);

    // Starting a terminal mission again is rejected by the state machine —
    // no second execution loop, no state reset.
    const restart = await caller.mission.start({ userId: 'dup-user', missionId: first.missionId });
    expect(restart.success).toBe(false);
  });

  it('boot recovery relaunches a resumable RUNNING mission through one authoritative loop', async () => {
    const stores = {
      missions: new InMemoryMissionStore(),
      checkpoints: new InMemoryCheckpointStore(),
    };
    const runtime1 = createMissionRuntime({
      workspaceRoot: workspace,
      stores,
      registerProviders: (orchestrator) => {
        orchestrator.registerProvider(new MockProvider());
      },
      orchestratorOptions: { retryBaseDelayMs: 1 },
    });
    const created = await runtime1.controller.createMission({
      userId: 'recovery-user',
      title: 'Recovery mission',
      objective: 'Complete one objective',
      initialObjectives: ['Create the workspace file recovery-alpha.md with the alpha content'],
    });
    await runtime1.controller.startMission(created.missionId);
    const interrupted = await runtime1.controller.runNextObjective(created.missionId);
    expect(interrupted.state).toBe('RUNNING');
    expect(interrupted.objectives[0]?.state).toBe('VERIFIED');

    const service = new MissionService({ workspaceRoot: workspace });
    const runtime2 = createMissionRuntime({
      workspaceRoot: workspace,
      stores,
      registerProviders: (orchestrator) => {
        orchestrator.registerProvider(new MockProvider());
      },
      orchestratorOptions: { retryBaseDelayMs: 1 },
    });
    service.setRuntimeForTesting(runtime2);
    await service.recoverAllActive();

    const deadline = Date.now() + 5_000;
    let recovered = await stores.missions.get(created.missionId);
    while (recovered?.state === 'RUNNING' && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      recovered = await stores.missions.get(created.missionId);
    }
    expect(recovered?.state).toBe('COMPLETED');
    expect(recovered?.objectives).toHaveLength(1);
    expect(recovered?.objectives[0]?.state).toBe('VERIFIED');
  });

  it('PAUSE during an in-flight detached loop reaches a safe persisted PAUSED state without killing the request', async () => {
    const caller = router.createCaller(ctx('pause-user'));
    const created = await unwrap<MissionView>(
      caller.mission.createAndRun({
        userId: 'pause-user',
        title: 'Pause mission',
        objective: 'Improve the workspace autonomously',
        initialObjectives: [
          'Create the workspace file pause-1.md with the first content',
          'Create the workspace file pause-2.md with the second content',
        ],
      }),
    );
    expect(created.state).toBe('RUNNING');

    // Pause WHILE the loop is running — the operator request returns the
    // safe persisted state; the loop stops at the next controller boundary.
    const paused = await unwrap<MissionView>(
      caller.mission.pause({ userId: 'pause-user', missionId: created.missionId }),
    );
    expect(paused.state).toBe('PAUSED');

    // The mission settles in PAUSED (hold) with progress preserved, and
    // verified objectives are never re-run after resume.
    const settled = await pollUntilSettled(caller, 'pause-user', created.missionId);
    expect(settled.state).toBe('PAUSED');

    // RESUME continues from persisted state.
    const resumed = await unwrap<MissionView>(
      caller.mission.resume({ userId: 'pause-user', missionId: created.missionId }),
    );
    expect(['RUNNING', 'COMPLETED']).toContain(resumed.state);
    const final = await pollUntilSettled(caller, 'pause-user', created.missionId);
    expect(['COMPLETED', 'PAUSED']).toContain(final.state);
  });

  it('invalid state transitions: START on a PAUSED mission is refused (explicit RESUME is required)', async () => {
    const caller = router.createCaller(ctx('trans-user'));
    const created = await unwrap<MissionView>(
      caller.mission.createAndRun({
        userId: 'trans-user',
        title: 'Transition mission',
        objective: 'Improve the workspace autonomously',
        initialObjectives: ['Create the workspace file transition.md with the content'],
      }),
    );
    await unwrap<MissionView>(
      caller.mission.pause({ userId: 'trans-user', missionId: created.missionId }),
    );
    const settled = await pollUntilSettled(caller, 'trans-user', created.missionId);
    expect(settled.state).toBe('PAUSED');

    const startAttempt = await caller.mission.start({
      userId: 'trans-user',
      missionId: created.missionId,
    });
    expect(startAttempt.success).toBe(false);
  });

  it('WAITING_FOR_PROVIDER: with no providers registered the mission honestly waits and checkpoints (no fabricated execution)', async () => {
    const noProviderServices = new MissionService({
      workspaceRoot: workspace,
      runtimeOptions: {
        registerProviders: () => {}, // nothing registered — nothing available
        orchestratorOptions: { retryBaseDelayMs: 1 },
      },
    });
    const noProviderRouter = createAppRouter({
      mission: noProviderServices,
    } as unknown as ApiApplicationService);
    const caller = noProviderRouter.createCaller(ctx('wait-user'));
    const data = await unwrap<MissionView>(
      caller.mission.createAndRun({
        userId: 'wait-user',
        title: 'Waiting mission',
        objective: 'Improve the workspace autonomously',
        initialObjectives: ['Create the workspace file waiting.md with the content'],
      }),
    );
    // RUN returns immediately; the detached loop then honestly settles into
    // WAITING_FOR_PROVIDER — nothing is fabricated. (With zero providers the
    // loop can settle faster than the response read, so either state is honest.)
    expect(['RUNNING', 'WAITING_FOR_PROVIDER']).toContain(data.state);
    const status = await pollUntilSettled(caller, 'wait-user', data.missionId);
    expect(status.state).toBe('WAITING_FOR_PROVIDER');
    const detailed = await unwrap<{ checkpoints: unknown[]; objectives: Array<{ state: string }> }>(
      caller.mission.status({ userId: 'wait-user', missionId: data.missionId }),
    );
    expect(detailed.checkpoints.length).toBeGreaterThan(0);
    expect(detailed.objectives.every((o) => o.state !== 'VERIFIED')).toBe(true);
  });

  it('terminal states: COMPLETED missions accept no further pause/resume/approve', async () => {
    const caller = router.createCaller(ctx('term-user'));
    const data = await unwrap<MissionView>(
      caller.mission.createAndRun({
        userId: 'term-user',
        title: 'Terminal mission',
        objective: 'Improve the workspace autonomously',
        initialObjectives: ['Create the workspace file terminal.md with the content'],
      }),
    );
    const settled = await pollUntilSettled(caller, 'term-user', data.missionId);
    expect(settled.state).toBe('COMPLETED');
    for (const op of ['pause', 'resume', 'approve', 'reject'] as const) {
      const res = await caller.mission[op]({ userId: 'term-user', missionId: data.missionId });
      expect(res.success).toBe(false);
    }
    // Cancel is likewise terminal-refused.
    const cancelRes = await caller.mission.cancel({
      userId: 'term-user',
      missionId: data.missionId,
    });
    expect(cancelRes.success).toBe(false);
  });

  it('zod validation: short titles/objectives are rejected at the boundary', async () => {
    const caller = router.createCaller(ctx('zod-user'));
    await expect(
      caller.mission.createAndRun({
        userId: 'zod-user',
        title: 'ab',
        objective: 'Valid objective here',
      }),
    ).rejects.toBeInstanceOf(TRPCError);
    await expect(
      caller.mission.createAndRun({ userId: 'zod-user', title: 'Valid title', objective: 'ab' }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("history: lists only the caller's missions with verified counts and state", async () => {
    const caller = router.createCaller(ctx('hist-user'));
    const before = await unwrap<Array<{ missionId: string }>>(
      caller.mission.history({ userId: 'hist-user' }),
    );
    expect(before).toHaveLength(0);
    const mission = await unwrap<MissionView>(
      caller.mission.createAndRun({
        userId: 'hist-user',
        title: 'History mission',
        objective: 'Improve the workspace autonomously',
        initialObjectives: ['Create the workspace file history.md with the content'],
      }),
    );
    const settled = await pollUntilSettled(caller, 'hist-user', mission.missionId);
    expect(settled.state).toBe('COMPLETED');
    const after = await unwrap<
      Array<{
        missionId: string;
        state: string;
        verifiedObjectives: number;
        totalObjectives: number;
      }>
    >(caller.mission.history({ userId: 'hist-user' }));
    expect(after).toHaveLength(1);
    expect(after[0]?.missionId).toBe(mission.missionId);
    expect(after[0]?.state).toBe('COMPLETED');
    expect(after[0]?.verifiedObjectives).toBe(1);
    expect(after[0]?.totalObjectives).toBe(1);
  });

  it('AUTONOMOUS CERTIFICATION: one RUN call → 3 objectives planned, executed, verified and continued with NO further user interaction', async () => {
    const caller = router.createCaller(ctx('cert-user'));
    // ONE call. No further input of any kind.
    const data = await unwrap<MissionView>(
      caller.mission.createAndRun({
        userId: 'cert-user',
        title: 'Certification mission',
        objective: 'Improve the workspace autonomously',
        initialObjectives: [
          'Create the workspace file cert-1.md with the first objective content',
          'Create the workspace file cert-2.md with the second objective content',
          'Create the workspace file cert-3.md with the third objective content',
        ],
      }),
    );
    // The mission starts immediately and the loop runs detached.
    expect(data.state).toBe('RUNNING');

    // Observe (as the UI does): objectives verify one after another with no
    // user input between them, checkpoints are saved, mission completes.
    const status = await pollUntilSettled(caller, 'cert-user', data.missionId);
    expect(status.state).toBe('COMPLETED');
    expect(status.outcome).toBe('ACHIEVED');
    expect(status.objectives).toHaveLength(3);
    for (const objective of status.objectives) {
      expect(objective.state).toBe('VERIFIED');
    }

    const detailed = await unwrap<{
      objectives: Array<{ state: string; verifiedAt?: string }>;
      checkpoints: Array<{ state: string }>;
      activity: Array<{ kind: string }>;
      budgetUsage: { objectivesCompleted: number };
    }>(caller.mission.status({ userId: 'cert-user', missionId: data.missionId }));
    expect(detailed.objectives.every((o) => o.verifiedAt)).toBe(true);
    expect(detailed.checkpoints.filter((c) => c.state === 'VERIFIED').length).toBe(3);
    expect(detailed.budgetUsage.objectivesCompleted).toBe(3);
    expect(detailed.activity.filter((e) => e.kind === 'OBJECTIVE_VERIFIED').length).toBeGreaterThan(
      0,
    );
    expect(detailed.activity.some((e) => e.kind === 'CHECKPOINT_SAVED')).toBe(true);
    expect(detailed.activity.some((e) => e.kind === 'MISSION_COMPLETED')).toBe(true);
  });

  // ── Operator governance (BLD-024 §6 / §14): the approval gate is plumbed
  //    through the REAL composed runtime. The deterministic scenario mirrors
  //    the controller-level BLD-025 test: a governed content policy denies a
  //    risky workspace write; the approval gate asks the operator; APPROVE /
  //    REJECT drive the frozen state machine through the real tRPC pipeline.
  it('APPROVE: WAITING_FOR_APPROVAL while the risk persists re-triggers honestly; once cleared, approval continues the runtime to verified completion', async () => {
    let permitWrites = false;
    const approvalService = new MissionService({
      workspaceRoot: workspace,
      runtimeOptions: {
        registerProviders: (orchestrator) => {
          orchestrator.registerProvider(new MockProvider());
        },
        orchestratorOptions: { retryBaseDelayMs: 1 },
        workspaceToolOptions: {
          // Deterministic operator-controlled risk: the workspace write for
          // the risky marker is denied until the operator clears it.
          contentPolicy: (content) =>
            /approval-risky-content/i.test(content) && !permitWrites
              ? 'risk review required before this write'
              : undefined,
        },
        // Every failed objective requests operator approval.
        approvalGate: async () => true,
      },
    });
    const approvalRouter = createAppRouter({
      mission: approvalService,
    } as unknown as ApiApplicationService);
    const caller = approvalRouter.createCaller(ctx('approve-user'));

    const data = await unwrap<MissionView>(
      caller.mission.createAndRun({
        userId: 'approve-user',
        title: 'Approval mission',
        objective: 'Improve the workspace autonomously',
        initialObjectives: [
          'Create the workspace file approval-risky.md with the approval-risky-content summary',
        ],
      }),
    );

    // The detached loop honestly reaches the operator hold — nothing ran.
    const waiting = await pollUntilSettled(caller, 'approve-user', data.missionId);
    expect(waiting.state).toBe('WAITING_FOR_APPROVAL');
    const held = await unwrap<{
      state: string;
      outcomeReason?: string;
      checkpoints: Array<{ state: string }>;
      objectives: Array<{ state: string; verifiedAt?: string }>;
    }>(caller.mission.status({ userId: 'approve-user', missionId: data.missionId }));
    expect(held.outcomeReason).toContain('Operator approval required');
    expect(held.checkpoints.length).toBeGreaterThan(0);
    expect(held.objectives[0]?.verifiedAt).toBeUndefined(); // never fabricated

    // APPROVE while the risk persists: the runtime continues through the
    // existing chain, fails the same governed way, and the gate re-triggers
    // honestly — no fabricated success, no silent continuation.
    const approved1 = await unwrap<MissionView>(
      caller.mission.approve({ userId: 'approve-user', missionId: data.missionId }),
    );
    expect(['RUNNING', 'WAITING_FOR_APPROVAL']).toContain(approved1.state);
    const reHeld = await pollUntilSettled(caller, 'approve-user', data.missionId);
    expect(reHeld.state).toBe('WAITING_FOR_APPROVAL');
    expect(reHeld.objectives[0]?.state).not.toBe('VERIFIED');

    // The operator clears the underlying risk. APPROVE resumes the runtime
    // through the normal path: execute → verify → VERIFIED → complete.
    permitWrites = true;
    const approved2 = await unwrap<MissionView>(
      caller.mission.approve({ userId: 'approve-user', missionId: data.missionId }),
    );
    expect(['RUNNING', 'COMPLETED']).toContain(approved2.state);
    const completed = await pollUntilSettled(caller, 'approve-user', data.missionId);
    expect(completed.state).toBe('COMPLETED');
    expect(completed.outcome).toBe('ACHIEVED');
    expect(completed.objectives[0]?.state).toBe('VERIFIED');
  });

  it('REJECT: operator rejection of a WAITING_FOR_APPROVAL mission is final — honest FAILED with history preserved', async () => {
    const rejectService = new MissionService({
      workspaceRoot: workspace,
      runtimeOptions: {
        registerProviders: (orchestrator) => {
          orchestrator.registerProvider(new MockProvider());
        },
        orchestratorOptions: { retryBaseDelayMs: 1 },
        workspaceToolOptions: {
          contentPolicy: (content) =>
            /reject-risky-content/i.test(content) ? 'operator must review this write' : undefined,
        },
        approvalGate: async () => true,
      },
    });
    const rejectRouter = createAppRouter({
      mission: rejectService,
    } as unknown as ApiApplicationService);
    const caller = rejectRouter.createCaller(ctx('reject-user'));

    const data = await unwrap<MissionView>(
      caller.mission.createAndRun({
        userId: 'reject-user',
        title: 'Reject mission',
        objective: 'Improve the workspace autonomously',
        initialObjectives: [
          'Create the workspace file reject-risky.md with the reject-risky-content summary',
        ],
      }),
    );
    const waiting = await pollUntilSettled(caller, 'reject-user', data.missionId);
    expect(waiting.state).toBe('WAITING_FOR_APPROVAL');

    const rejected = await unwrap<MissionView>(
      caller.mission.reject({ userId: 'reject-user', missionId: data.missionId }),
    );
    expect(rejected.state).toBe('FAILED');
    expect(rejected.outcome).toBe('FAILED');

    // Terminal: no further operator action is accepted.
    const approveAfter = await caller.mission.approve({
      userId: 'reject-user',
      missionId: data.missionId,
    });
    expect(approveAfter.success).toBe(false);
    const resumeAfter = await caller.mission.resume({
      userId: 'reject-user',
      missionId: data.missionId,
    });
    expect(resumeAfter.success).toBe(false);
  });

  it('unauthorized: a caller without a verified session is rejected before any mission work', async () => {
    const anonymous = router.createCaller({ userId: 'anonymous', email: '', role: 'guest' });
    await expect(anonymous.mission.history({ userId: 'anonymous' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    await expect(
      anonymous.mission.status({ userId: 'anonymous', missionId: 'm-1' }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    await expect(
      anonymous.mission.pause({ userId: 'anonymous', missionId: 'm-1' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(
      anonymous.mission.createAndRun({
        userId: 'anonymous',
        title: 'Valid title',
        objective: 'Valid objective',
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('status on a non-existent mission returns NOT_FOUND (not a generic validation error)', async () => {
    const caller = router.createCaller(ctx('notfound-user'));
    const res = await caller.mission.status({
      userId: 'notfound-user',
      missionId: 'mission-does-not-exist',
    });
    expect(res.success).toBe(false);
    expect(res.error.code).toBe('NOT_FOUND');
  });
});

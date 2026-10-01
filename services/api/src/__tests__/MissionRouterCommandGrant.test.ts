// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Mission Control allowCommandExecution propagation (PROVIDER-01)
//
// The regression this pins: `allowCommandExecution` was NOT declared in the
// mission.createAndRun Zod input schema. Zod strips undeclared keys, so a
// caller-supplied override was silently dropped before MissionRouter could
// destructure it, and the objective-text heuristic was the only grant path.
// A repository-integration objective that did not match the heuristic then
// received read/write only (no run_command / EXECUTE) and could not execute.
//
// These tests route through the REAL tRPC pipeline (auth + zod input) into a
// capturing MissionService, and assert the exact CreateMissionInputView the
// service receives — proving the value survives Zod → router → service.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { createAppRouter } from '../services/RouterRegistry.js';
import type { ApiApplicationService } from '../services/ApiApplicationService.js';
import type { CreateMissionInputView } from '../services/MissionService.js';
import type { Mission } from '@vedmoulya/mission-controller';

const callerCtx = (userId: string) => ({ userId, email: `${userId}@vm.local`, role: 'user' });

interface Captured {
  userId: string;
  input: CreateMissionInputView;
}

/** A MissionService stub that records the exact createAndRun input view. */
function capturingService(captured: Captured[]): ApiApplicationService {
  const noop = async (): Promise<Mission> => ({}) as unknown as Mission;
  const missionService = {
    createAndRun: async (userId: string, input: CreateMissionInputView) => {
      captured.push({ userId, input });
      return {
        missionId: 'mission-captured',
        userId,
        title: input.title,
        objective: input.objective,
        state: 'RUNNING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        objectives: [],
      } as unknown as Mission;
    },
    createMission: async () => ({}) as unknown as Mission,
    startAutonomousLoop: noop,
    resumeAutonomousLoop: noop,
    start: noop,
    pause: noop,
    resume: noop,
    cancel: noop,
    approve: noop,
    reject: noop,
    getStatus: async () => ({}),
    listMissionSummaries: async () => [],
  };
  return { mission: missionService } as unknown as ApiApplicationService;
}

async function unwrapData(res: { success: boolean; data?: unknown; error?: { message?: string } }) {
  if (!res.success) throw new Error(res.error?.message ?? 'expected success envelope');
  return res.data;
}

describe('mission.createAndRun — allowCommandExecution reaches the service (PROVIDER-01)', () => {
  it('forwards allowCommandExecution: true through Zod + the router to the service input', async () => {
    const captured: Captured[] = [];
    const caller = createAppRouter(capturingService(captured)).createCaller(
      callerCtx('override-user'),
    );

    await unwrapData(
      await caller.mission.createAndRun({
        userId: 'override-user',
        title: 'Integration mission',
        objective: 'Improve the workspace documentation',
        allowCommandExecution: true,
      }),
    );

    expect(captured).toHaveLength(1);
    // Must not be stripped by Zod or dropped during object construction.
    expect(captured[0]?.input.allowCommandExecution).toBe(true);
  });

  it('forwards allowCommandExecution: false — an explicit withhold survives too', async () => {
    const captured: Captured[] = [];
    const caller = createAppRouter(capturingService(captured)).createCaller(callerCtx('deny-user'));

    await unwrapData(
      await caller.mission.createAndRun({
        userId: 'deny-user',
        title: 'Docs mission',
        objective: 'Fix the failing tests',
        allowCommandExecution: false,
      }),
    );

    expect(captured).toHaveLength(1);
    expect(captured[0]?.input.allowCommandExecution).toBe(false);
  });

  it('omits the key entirely when the caller sends none (heuristic remains the default)', async () => {
    const captured: Captured[] = [];
    const caller = createAppRouter(capturingService(captured)).createCaller(
      callerCtx('plain-user'),
    );

    await unwrapData(
      await caller.mission.createAndRun({
        userId: 'plain-user',
        title: 'Plain mission',
        objective: 'Improve the workspace autonomously',
      }),
    );

    expect(captured).toHaveLength(1);
    expect('allowCommandExecution' in (captured[0]?.input ?? {})).toBe(false);
  });
});

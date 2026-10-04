// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — S2 Part I: DURABLE MISSION RECOVERY
//
// Proves a Mission survives a RUNTIME LOSS using the REAL composed runtime.
// Runtime A executes the mission and persists it; Runtime B is a completely
// fresh composition over the SAME durable stores and must recover the mission
// with its real, honest state intact.
//
// Nothing here is a fake port: this is the real MissionRuntime, the real
// MissionControllerService, the real governed tool path and the real
// verification. Only the AI provider is deterministic, because this test is
// about DURABILITY, not model quality.
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { MockProvider } from '@vedmoulya/orchestrator';
import { InMemoryCheckpointStore, InMemoryMissionStore } from '@vedmoulya/mission-controller';
import { COMMAND_EXECUTION_TOOL, createMissionRuntime } from '../index.js';
import type { MissionRuntime } from '../index.js';

const workspaces: string[] = [];

function makeWorkspace(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'vedmoulya-recovery-'));
  workspaces.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of workspaces) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
});

interface Stores {
  missions: InMemoryMissionStore;
  checkpoints: InMemoryCheckpointStore;
}

/** A fresh runtime over the SAME durable stores — i.e. a restarted process. */
function restart(workspace: string, stores: Stores): MissionRuntime {
  return createMissionRuntime({
    workspaceRoot: workspace,
    stores,
    orchestratorOptions: { retryBaseDelayMs: 1 },
    registerProviders: (o) => {
      o.registerProvider(new MockProvider());
    },
  });
}

const CONSTRAINTS = {
  allowedTools: ['workspace_write', 'workspace_read', COMMAND_EXECUTION_TOOL],
  grantedPermissionClasses: ['READ', 'WRITE', 'EXECUTE'],
} as never;

describe('S2 Part I — durable Mission recovery across a runtime loss', () => {
  it('recovers completed objectives and preserves verifiedAt exactly', async () => {
    const workspace = makeWorkspace();
    const stores: Stores = {
      missions: new InMemoryMissionStore(),
      checkpoints: new InMemoryCheckpointStore(),
    };

    // ── RUNTIME A: execute for real ──
    const runtimeA = restart(workspace, stores);
    const mission = await runtimeA.controller.createMission({
      userId: 'recovery-user',
      title: 'Recovery: dependent objectives complete in order',
      objective: 'Create the workspace file recovery-a.md containing alpha marker',
      description: 'Create the workspace file recovery-a.md containing alpha marker',
      mode: 'DEVELOPMENT',
      workspace,
      constraints: CONSTRAINTS,
      initialObjectives: [
        'Create the workspace file recovery-a.md containing alpha marker',
        'Create the workspace file recovery-b.md containing beta marker',
      ],
      objectiveDependencies: [{ objectiveIndex: 1, dependsOn: [0] }],
    });
    const missionId = mission.missionId;

    await runtimeA.controller.startMission(missionId);
    const doneA = await runtimeA.controller.runAutonomousLoop(missionId);

    expect(doneA.state).toBe('COMPLETED');
    expect(doneA.objectives[0]?.state).toBe('VERIFIED');
    const verifiedAtA = doneA.objectives[0]?.verifiedOutcome?.verifiedAt;
    expect(verifiedAtA).toBeDefined();
    expect(doneA.objectives[1]?.state).toBe('VERIFIED');
    expect(doneA.checkpoints.length).toBeGreaterThan(0);

    // The real artifacts exist — recovery is not a paper exercise.
    expect(existsSync(path.join(workspace, 'recovery-a.md'))).toBe(true);
    expect(existsSync(path.join(workspace, 'recovery-b.md'))).toBe(true);

    // ── RUNTIME B: a COMPLETELY FRESH runtime over the SAME durable stores ──
    const runtimeB = restart(workspace, stores);
    const recovered = await runtimeB.controller.getMission(missionId);

    expect(recovered.missionId).toBe(missionId);
    expect(recovered.objectives).toHaveLength(2);

    // A completed objective stays completed and verifiedAt is preserved
    // EXACTLY: recovery never re-verifies or re-stamps completed work.
    expect(recovered.objectives[0]?.state).toBe('VERIFIED');
    expect(recovered.objectives[0]?.verifiedOutcome?.verifiedAt).toBe(verifiedAtA);
    expect(recovered.objectives[0]?.verifiedOutcome?.achieved).toBe(true);
    expect(recovered.objectives[1]?.state).toBe('VERIFIED');

    // Resuming a recovered, already-complete mission invents no new work.
    const resumed = await runtimeB.controller.runAutonomousLoop(missionId);
    expect(resumed.objectives[0]?.verifiedOutcome?.verifiedAt).toBe(verifiedAtA);
    expect(resumed.objectives[0]?.state).toBe('VERIFIED');
  });

  it('keeps a failed objective failed and never runs its dependent, across recovery', async () => {
    const workspace = makeWorkspace();
    // A REAL failing prerequisite: the goal demands a node verification script
    // that does not exist, so the governed command exits non-zero honestly.
    mkdirSync(path.join(workspace, 'src', 'lib'), { recursive: true });
    writeFileSync(path.join(workspace, 'src', 'lib', 'thing.mjs'), 'export const x = 1;\n', 'utf8');

    const stores: Stores = {
      missions: new InMemoryMissionStore(),
      checkpoints: new InMemoryCheckpointStore(),
    };

    const runtimeA = restart(workspace, stores);
    const failGoal =
      'Update the workspace file blocked.md with exact content ok then confirm with the node script verify/absent.verify.mjs so that the tests pass.';
    const mission = await runtimeA.controller.createMission({
      userId: 'recovery-user',
      title: 'Recovery: failed prerequisite must block its dependent',
      objective: failGoal,
      description: failGoal,
      mode: 'DEVELOPMENT',
      workspace,
      budget: { maxRetries: 0 },
      constraints: CONSTRAINTS,
      initialObjectives: [
        failGoal,
        'Create the workspace file never.md containing downstream marker',
      ],
      objectiveDependencies: [{ objectiveIndex: 1, dependsOn: [0] }],
    });
    const missionId = mission.missionId;

    await runtimeA.controller.startMission(missionId);
    const doneA = await runtimeA.controller.runAutonomousLoop(missionId);

    expect(doneA.objectives[0]?.state).toBe('FAILED');
    expect(doneA.objectives[0]?.verifiedOutcome?.achieved).not.toBe(true);
    expect(doneA.outcome).not.toBe('ACHIEVED');
    // The dependent objective never ran.
    expect(doneA.objectives[1]?.state).toBe('PENDING');
    expect(existsSync(path.join(workspace, 'never.md'))).toBe(false);

    // ── Recover over the same durable stores ──
    const runtimeB = restart(workspace, stores);
    const recovered = await runtimeB.controller.getMission(missionId);
    expect(recovered.objectives[0]?.state).toBe('FAILED');
    expect(recovered.objectives[1]?.state).toBe('PENDING');

    // Resuming must not "retry into success" nor run the blocked dependent.
    const resumed = await runtimeB.controller.runAutonomousLoop(missionId);
    expect(resumed.objectives[0]?.state).toBe('FAILED');
    expect(resumed.objectives[1]?.state).toBe('PENDING');
    expect(resumed.outcome).not.toBe('ACHIEVED');
    expect(existsSync(path.join(workspace, 'never.md'))).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: BLD-025 Physical Restart Recovery
//
// Category B verification: simulates an actual process restart by
// creating TWO independent MissionRuntime instances over the SAME
// authoritative persistence stores (the only restart boundary an
// integration test can model without killing the test process).
//
// Proves the complete physical restart scenario:
//   1. Create a persisted mission.
//   2. Start it.
//   3. Persist it in an active/RUNNING state (one objective VERIFIED).
//   4. Terminate/recreate the application process (fresh MissionRuntime).
//   5. Execute the boot recovery path (recoverAllActive).
//   6. Discover the same persisted mission.
//   7. Resume it from persisted state/checkpoint.
//   8. Continue execution.
//   9. Verify that the mission completes without duplicate execution.
//
// Uses the REAL composition: real MissionControllerService, real
// PlanningApplicationService, real AgentExecutionService, real
// MockProvider, real InMemoryMissionStore/CheckpointStore as the
// authoritative durable layer. No recovery logic is duplicated —
// every step goes through the frozen controller/runtime pipeline.
// ──────────────────────────────────────────────────────────────────

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { MockProvider } from '@vedmoulya/orchestrator';
import { InMemoryCheckpointStore, InMemoryMissionStore } from '@vedmoulya/mission-controller';
import { createMissionRuntime } from '../index.js';

const tempRoots: string[] = [];

function newWorkspace(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'vedmoulya-restart-'));
  tempRoots.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of tempRoots) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('BLD-025 physical restart recovery (Category B)', () => {
  it('discovers, recovers, and completes a mission after simulated process restart — no duplicate execution', async () => {
    // ── Shared authoritative persistence (simulates durable storage) ──
    // Both runtimes read/write the SAME stores — exactly what happens
    // when a fresh process opens the same database after a crash.
    const stores = {
      missions: new InMemoryMissionStore(),
      checkpoints: new InMemoryCheckpointStore(),
    };

    const workspace = newWorkspace();

    // ── RUNTIME 1: the "original" application process ──
    const runtime1 = createMissionRuntime({
      workspaceRoot: workspace,
      stores, // SAME durable stores
      registerProviders: (orchestrator) => {
        orchestrator.registerProvider(new MockProvider());
      },
      orchestratorOptions: { retryBaseDelayMs: 1 },
    });

    // Step 1: Create a persisted mission with TWO objectives.
    const mission = await runtime1.controller.createMission({
      userId: 'u1',
      title: 'Restart recovery mission',
      objective: 'Complete two objectives across a process restart',
      workspace,
      mode: 'DEVELOPMENT',
      initialObjectives: [
        'Create the workspace file restart-alpha.md with the alpha summary',
        'Create the workspace file restart-beta.md with the beta summary',
      ],
    });

    // Step 2: Start it (CREATED → RUNNING).
    await runtime1.controller.startMission(mission.missionId);

    // Step 3: Execute the FIRST objective only — leaves the mission in
    // a persisted RUNNING state with one VERIFIED + one PENDING.
    const afterFirst = await runtime1.controller.runNextObjective(mission.missionId);
    expect(afterFirst.state).toBe('RUNNING');
    expect(afterFirst.objectives[0]?.state).toBe('VERIFIED');
    expect(afterFirst.objectives[1]?.state).toBe('PENDING');

    // Record the first objective's verification timestamp — this is the
    // duplicate-execution sentinel. If recovery re-runs objective 1,
    // this timestamp will change.
    const firstObjectiveVerifiedAt = afterFirst.objectives[0]?.verifiedOutcome?.verifiedAt;
    expect(firstObjectiveVerifiedAt).toBeDefined();

    const firstObjectiveRunId = afterFirst.objectives[0]?.executionRunId;
    expect(firstObjectiveRunId).toBeDefined();

    // ── Step 4: SIMULATED PROCESS RESTART ──
    // A fresh MissionRuntime over the SAME authoritative stores. The
    // old runtime1 is discarded — its in-memory state is gone, exactly
    // like a killed process. Only the persisted mission remains.
    const runtime2 = createMissionRuntime({
      workspaceRoot: workspace,
      stores, // SAME durable stores
      registerProviders: (orchestrator) => {
        orchestrator.registerProvider(new MockProvider());
      },
      orchestratorOptions: { retryBaseDelayMs: 1 },
    });

    // Step 5: Execute the BOOT RECOVERY PATH — the same call
    // ApiApplicationService.recoverActiveMissionsOnBoot() makes.
    const { recovered, active } = await runtime2.controller.recoverAllActive();
    expect(active).toBe(1); // one non-terminal mission discovered
    expect(recovered).toBe(1); // one mission recovered

    // Step 6: Discover the same persisted mission.
    const recoveredMission = await runtime2.stores.missions.get(mission.missionId);
    expect(recoveredMission).toBeDefined();
    expect(recoveredMission?.missionId).toBe(mission.missionId);
    expect(recoveredMission?.state).toBe('RUNNING'); // never terminal-reopened

    // Step 7: Verify persisted state — first objective still VERIFIED,
    // second still PENDING. No fabricated state, no re-execution.
    expect(recoveredMission?.objectives[0]?.state).toBe('VERIFIED');
    expect(recoveredMission?.objectives[0]?.verifiedOutcome?.verifiedAt).toBe(
      firstObjectiveVerifiedAt,
    );
    expect(recoveredMission?.objectives[1]?.state).toBe('PENDING');

    // Step 8: Continue execution — the autonomous loop drives the
    // remaining PENDING objective to VERIFIED and completes the mission.
    const completed = await runtime2.controller.runAutonomousLoop(mission.missionId);

    // Step 9: Verify mission completes WITHOUT duplicate execution.
    expect(completed.state).toBe('COMPLETED');
    expect(completed.objectives).toHaveLength(2);
    expect(completed.objectives[0]?.state).toBe('VERIFIED');
    expect(completed.objectives[1]?.state).toBe('VERIFIED');
    expect(completed.budgetUsage.objectivesCompleted).toBe(2);

    // The critical assertion: objective 1 was NOT re-executed.
    // Its verification timestamp and run ID are unchanged from the
    // original execution before the "crash".
    expect(completed.objectives[0]?.verifiedOutcome?.verifiedAt).toBe(firstObjectiveVerifiedAt);
    expect(completed.objectives[0]?.executionRunId).toBe(firstObjectiveRunId);

    // Objective 2 was executed exactly once by runtime2.
    expect(completed.objectives[1]?.verifiedOutcome).toBeDefined();
    expect(completed.objectives[1]?.verifiedOutcome?.achieved).toBe(true);
  });
});

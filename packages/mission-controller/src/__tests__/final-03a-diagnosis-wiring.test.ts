// ──────────────────────────────────────────────────────────────────
// VedMoulya — FINAL-03A: Production Root-Cause Diagnosis Wiring Tests
//
// Proves the EXISTING structured diagnosis capability (AUTONOMY-04
// `diagnosis-repair.ts`) is invoked by the REAL production failure path of
// the FROZEN MissionControllerService — automatically, after a failure is
// detected and classified, and BEFORE the bounded repair/revision decision.
//
// The diagnosis port here is a thin observer over the REAL production
// contract: it delegates to the EXISTING deterministic diagnosis engine
// (`createDiagnosis`) and records the exact structured input/output the
// controller exchanged. No new diagnosis architecture is introduced and no
// recovery semantics are mocked.
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { createTestService } from './fixtures.js';
import type {
  CommandFailureEvidence,
  FailureDiagnosis,
  RepairResult,
} from '../domain/diagnosis-repair.js';
import { createDiagnosis } from '../domain/diagnosis-repair.js';
import type { FailureDiagnosisPort, FailureRepairPort } from '../contracts/mission-ports.js';

/**
 * A pass-through diagnosis port that uses the REAL AUTONOMY-04 engine and
 * records every structured exchange so the test can assert on production
 * behavior (not on a fabricated diagnosis).
 */
function recordingDiagnosisPort(options?: { fail?: boolean }): {
  port: FailureDiagnosisPort;
  calls: Array<{ evidence: CommandFailureEvidence; diagnosis?: FailureDiagnosis; threw?: boolean }>;
} {
  const calls: Array<{
    evidence: CommandFailureEvidence;
    diagnosis?: FailureDiagnosis;
    threw?: boolean;
  }> = [];
  const port: FailureDiagnosisPort = {
    diagnose: async (input) => {
      if (options?.fail) {
        calls.push({ evidence: input.evidence, threw: true });
        throw new Error('diagnosis engine unavailable');
      }
      const diagnosis = createDiagnosis({
        evidence: input.evidence,
        objective: input.objective,
        missionContext: input.missionContext,
        workspaceFiles: input.workspaceFiles,
        historicalLearning: input.historicalLearning,
      });
      calls.push({ evidence: input.evidence, diagnosis });
      return diagnosis;
    },
  };
  return { port, calls };
}

describe('FINAL-03A: production diagnosis wiring (MissionControllerService)', () => {
  it('TEST 1 — structured FailureDiagnosis is produced by the production recovery path', async () => {
    const { port, calls } = recordingDiagnosisPort();
    const { service } = createTestService({
      diagnosisPort: port,
      executorResult: {
        success: false,
        verified: false,
        error: "Error: Cannot find module 'lodash'",
        failureClass: 'TRANSIENT_TOOL',
      },
      verifierResult: { verified: false, evidence: ['execution failed'] },
    });

    const mission = await service.createMission({
      userId: 'u1',
      title: 'Diagnosis mission',
      objective: 'Do work',
      budget: { maxRetries: 1, maxReplans: 1 },
      initialObjectives: ['Task'],
    });
    await service.startMission(mission.missionId);
    const result = await service.runAutonomousLoop(mission.missionId);

    // The production path invoked the diagnosis automatically — no human
    // prompt, no second API call, no manual endpoint.
    expect(calls.length).toBeGreaterThanOrEqual(1);

    // The diagnosis is the EXISTING structured contract, derived from real
    // execution evidence.
    const objective = result.objectives[0];
    expect(objective?.diagnosisHistory?.length).toBeGreaterThanOrEqual(1);
    const record = objective?.diagnosisHistory?.[0];
    expect(record?.diagnosis.failureClass).toBeDefined();
    expect(record?.diagnosis.confidence).toBe('HIGH');
    expect(record?.diagnosis.rootCause?.category).toBe('MISSING_DEPENDENCY');
    expect(record?.diagnosis.suggestedRepair).toBe('ADD_OR_UPDATE_DEPENDENCY');
    expect(record?.diagnosis.evidence.length).toBeGreaterThan(0);
  });

  it('TEST 2 — the diagnosis reaches the EXISTING repair/revision mechanism', async () => {
    const { port } = recordingDiagnosisPort();
    const { service } = createTestService({
      diagnosisPort: port,
      executorResult: {
        success: true,
        verified: true,
        error: 'verification failed: tests did not pass',
      },
      // Verification failure → the frozen classifier yields REVISE_OBJECTIVE,
      // which is the existing revision entry point.
      verifierResult: { verified: false, evidence: ['assertion failure in suite'] },
    });

    const mission = await service.createMission({
      userId: 'u1',
      title: 'Revision mission',
      objective: 'Do work',
      budget: { maxRetries: 3, maxReplans: 3 },
      initialObjectives: ['Task'],
    });
    await service.startMission(mission.missionId);
    const result = await service.runAutonomousLoop(mission.missionId);

    const objective = result.objectives[0];
    // The existing revision mechanism ran…
    expect(objective?.revisionAttempt ?? 0).toBeGreaterThanOrEqual(1);
    expect(objective?.revisionHistory?.length ?? 0).toBeGreaterThanOrEqual(1);
    // …and it RECEIVED the structured diagnosis produced by the production path.
    const revision = objective?.revisionHistory?.[0];
    expect(revision?.failureDiagnosis).toBeDefined();
    expect(revision?.failureDiagnosis?.failureClass).toBeDefined();
    expect(revision?.failureDiagnosis?.summary.length).toBeGreaterThan(0);
    // The existing AUTONOMY-02 failure context is still produced alongside it.
    expect(revision?.failureContext).toBeDefined();
    // The controller recorded that the frozen bounded policy permitted repair.
    expect(objective?.diagnosisHistory?.[0]?.repairPermitted).toBe(true);
    expect(objective?.diagnosisHistory?.[0]?.nextAction).toBe('REPAIR');
  });

  it('TEST 4 — diagnosis does NOT create unlimited retries; bounded recovery stays intact', async () => {
    const { port, calls } = recordingDiagnosisPort();
    const { service } = createTestService({
      diagnosisPort: port,
      executorResult: {
        success: false,
        verified: false,
        error: 'tool failed permanently',
        failureClass: 'TRANSIENT_TOOL',
      },
      verifierResult: { verified: false, evidence: ['failed'] },
    });

    const mission = await service.createMission({
      userId: 'u1',
      title: 'Bounded mission',
      objective: 'Do work',
      budget: { maxRetries: 2, maxReplans: 2 },
      initialObjectives: ['Task'],
    });
    await service.startMission(mission.missionId);
    const result = await service.runAutonomousLoop(mission.missionId);

    // The frozen budget remains the authority: retries never exceed maxRetries.
    const retryCount = result.objectives[0]?.retryCount ?? 0;
    expect(retryCount).toBeLessThanOrEqual(2);
    expect(result.budgetUsage.replansConsumed).toBeLessThanOrEqual(2);
    // A diagnosis ran per failed attempt but granted no extra attempt.
    expect(calls.length).toBeLessThanOrEqual(retryCount + 2);
    // The durable diagnosis trail is itself bounded.
    expect(result.objectives[0]?.diagnosisHistory?.length ?? 0).toBeLessThanOrEqual(5);
  });

  it('TEST 6 — a diagnosis failure is safe: no false success, recovery behavior intact', async () => {
    const { port, calls } = recordingDiagnosisPort({ fail: true });
    const { service } = createTestService({
      diagnosisPort: port,
      executorResult: {
        success: false,
        verified: false,
        error: 'tool failed',
        failureClass: 'TRANSIENT_TOOL',
      },
      verifierResult: { verified: false, evidence: ['failed'] },
    });

    const mission = await service.createMission({
      userId: 'u1',
      title: 'Safe diagnosis mission',
      objective: 'Do work',
      budget: { maxRetries: 1, maxReplans: 1 },
      initialObjectives: ['Task'],
    });
    await service.startMission(mission.missionId);
    const result = await service.runAutonomousLoop(mission.missionId);

    // The port really threw...
    expect(calls.some((c) => c.threw === true)).toBe(true);
    // ...the mission must NOT falsely report success...
    expect(result.state).not.toBe('COMPLETED');
    expect(result.objectives[0]?.state).not.toBe('VERIFIED');
    expect(result.objectives[0]?.verifiedOutcome).toBeUndefined();
    // ...no diagnosis was fabricated...
    expect(result.objectives[0]?.diagnosisHistory ?? []).toHaveLength(0);
    // ...and the EXISTING recovery behavior still ran (bounded retry).
    expect(result.budgetUsage.retriesConsumed).toBeGreaterThanOrEqual(1);
  });

  it('TEST 6c — a governed repair is a reported failure is NEVER reported as success', async () => {
    const { port } = recordingDiagnosisPort();
    const repairs: RepairResult[] = [];
    const repairPort: FailureRepairPort = {
      repair: async () => {
        const result: RepairResult = {
          attempted: true,
          success: false,
          modifiedFiles: [],
          nextAction: 'REPLAN',
        };
        repairs.push(result);
        return result;
      },
    };
    const { service } = createTestService({
      diagnosisPort: port,
      repairPort,
      executorResult: {
        success: true,
        verified: true,
        error: 'verification failed: tests did not pass',
      },
      verifierResult: { verified: false, evidence: ['assertion failure in suite'] },
    });

    const mission = await service.createMission({
      userId: 'u1',
      title: 'Failed repair mission',
      objective: 'Do work',
      budget: { maxRetries: 1, maxReplans: 1 },
      initialObjectives: ['Task'],
    });
    await service.startMission(mission.missionId);
    const result = await service.runAutonomousLoop(mission.missionId);

    expect(repairs.length).toBeGreaterThanOrEqual(1);
    // A failed repair grants nothing: no VERIFIED objective, no COMPLETED mission.
    expect(result.state).not.toBe('COMPLETED');
    expect(result.objectives[0]?.state).not.toBe('VERIFIED');
    expect(result.objectives[0]?.verifiedOutcome).toBeUndefined();
    // The honest outcome is durably recorded with the diagnosis.
    expect(result.objectives[0]?.diagnosisHistory?.[0]?.repair?.success).toBe(false);
  });

  it('TEST 6b — with no diagnosis wired at all the frozen behavior is unchanged', async () => {
    const { service } = createTestService({
      executorResult: {
        success: false,
        verified: false,
        error: 'tool failed',
        failureClass: 'TRANSIENT_TOOL',
      },
      verifierResult: { verified: false, evidence: ['failed'] },
    });

    const mission = await service.createMission({
      userId: 'u1',
      title: 'No diagnosis mission',
      objective: 'Do work',
      budget: { maxRetries: 1, maxReplans: 1 },
      initialObjectives: ['Task'],
    });
    await service.startMission(mission.missionId);
    const result = await service.runAutonomousLoop(mission.missionId);

    expect(result.budgetUsage.retriesConsumed).toBeGreaterThanOrEqual(1);
    expect(result.objectives[0]?.diagnosisHistory).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// FINAL-03A — GOVERNED REPAIR WIRING
//
// The structured diagnosis's repair intent reaches the governed repair
// mechanism ONLY on the revision attempt the FROZEN recovery policy already
// authorised, and its outcome is durably recorded. The repair can never add
// recovery: no revision ⇒ no repair.
// ══════════════════════════════════════════════════════════════════════════

describe('FINAL-03A: governed repair wiring (MissionControllerService)', () => {
  function recordingRepairPort(): { port: FailureRepairPort; calls: unknown[] } {
    const calls: unknown[] = [];
    return {
      calls,
      port: {
        repair: async (input) => {
          calls.push(input);
          return {
            attempted: true,
            success: true,
            modifiedFiles: ['src.js'],
            nextAction: 'CONTINUE',
          };
        },
      },
    };
  }

  /** A verification failure → the frozen classifier yields REVISE_OBJECTIVE. */
  const verificationFailure = {
    executorResult: {
      success: true,
      verified: true,
      error: 'verification failed: tests did not pass',
    },
    verifierResult: { verified: false, evidence: ['assertion failure in suite'] },
  };

  it('TEST 4 — the structured diagnosis reaches the governed repair on the authorised revision', async () => {
    const { port } = recordingDiagnosisPort();
    const repair = recordingRepairPort();
    const { service } = createTestService({
      diagnosisPort: port,
      repairPort: repair.port,
      ...verificationFailure,
    });

    const mission = await service.createMission({
      userId: 'u1',
      title: 'Repair mission',
      objective: 'Do work',
      budget: { maxRetries: 2, maxReplans: 2 },
      initialObjectives: ['Task'],
    });
    await service.startMission(mission.missionId);
    const result = await service.runAutonomousLoop(mission.missionId);
    const objective = result.objectives[0];

    // The repair was invoked with the STRUCTURED diagnosis + the mission's own
    // governed allowlist/permission classes (never a widened one).
    expect(repair.calls.length).toBeGreaterThanOrEqual(1);
    const first = repair.calls[0] as {
      diagnosis: FailureDiagnosis;
      objective: string;
      classification: { suggestedAction: string };
      allowedTools?: string[];
    };
    expect(first.diagnosis.failureClass).toBe('VERIFICATION_FAILURE');
    expect(first.diagnosis.evidence.length).toBeGreaterThan(0);
    expect(first.classification.suggestedAction).toBe('REVISE_OBJECTIVE');

    // …and its outcome is durably recorded with both the diagnosis and the
    // revision the frozen policy created. (The bounded trail is newest-first,
    // so the repairing record is the one the policy authorised as REPAIR.)
    const repairing = (objective?.diagnosisHistory ?? []).find((d) => d.nextAction === 'REPAIR');
    expect(repairing).toBeDefined();
    expect(repairing?.repairPermitted).toBe(true);
    expect(repairing?.repair?.success).toBe(true);
    expect(objective?.revisionHistory?.[0]?.repairResult?.modifiedFiles).toEqual(['src.js']);

    // BOUNDED: the repair rides the existing revision budget — it is never
    // invoked more often than the frozen policy authorised revisions.
    expect(repair.calls.length).toBeLessThanOrEqual(objective?.retryCount ?? 0);
    expect(repair.calls.length).toBeLessThanOrEqual(result.budgetUsage.replansConsumed);
  });

  it('TEST 10 — no authorised revision ⇒ no governed repair (recovery stays bounded)', async () => {
    const { port, calls: diagnosisCalls } = recordingDiagnosisPort();
    const repair = recordingRepairPort();
    const { service } = createTestService({
      diagnosisPort: port,
      repairPort: repair.port,
      ...verificationFailure,
    });

    const mission = await service.createMission({
      userId: 'u1',
      title: 'Bounded repair mission',
      objective: 'Do work',
      // The frozen policy permits NO revision at all.
      budget: { maxRetries: 0, maxReplans: 0 },
      initialObjectives: ['Task'],
    });
    await service.startMission(mission.missionId);
    const result = await service.runAutonomousLoop(mission.missionId);

    // A diagnosis is still produced as durable evidence…
    expect(diagnosisCalls.length).toBeGreaterThanOrEqual(1);
    // …but the repair mechanism is NEVER invoked, and recovery grants nothing.
    expect(repair.calls).toHaveLength(0);
    expect(result.objectives[0]?.state).toBe('FAILED');
    expect(result.objectives[0]?.diagnosisHistory?.[0]?.nextAction).toBe('FAIL');
    expect(result.objectives[0]?.diagnosisHistory?.[0]?.repairPermitted).toBe(false);
  });

  it('TEST 9b — a diagnosis failure never triggers a repair and never fabricates success', async () => {
    const { port } = recordingDiagnosisPort({ fail: true });
    const repair = recordingRepairPort();
    const { service } = createTestService({
      diagnosisPort: port,
      repairPort: repair.port,
      ...verificationFailure,
    });

    const mission = await service.createMission({
      userId: 'u1',
      title: 'Broken diagnosis mission',
      objective: 'Do work',
      budget: { maxRetries: 2, maxReplans: 2 },
      initialObjectives: ['Task'],
    });
    await service.startMission(mission.missionId);
    const result = await service.runAutonomousLoop(mission.missionId);

    expect(repair.calls).toHaveLength(0);
    expect(result.state).not.toBe('COMPLETED');
    expect(result.objectives[0]?.diagnosisHistory ?? []).toHaveLength(0);
  });

  it('TEST 9c — a throwing repair port is treated as "no repair" (mission unaffected)', async () => {
    const { port, calls: diagnosisCalls } = recordingDiagnosisPort();
    const repairPort: FailureRepairPort = {
      repair: async () => {
        throw new Error('repair mechanism unavailable');
      },
    };
    const { service } = createTestService({
      diagnosisPort: port,
      repairPort,
      ...verificationFailure,
    });

    const mission = await service.createMission({
      userId: 'u1',
      title: 'Throwing repair mission',
      objective: 'Do work',
      budget: { maxRetries: 1, maxReplans: 1 },
      initialObjectives: ['Task'],
    });
    await service.startMission(mission.missionId);
    const result = await service.runAutonomousLoop(mission.missionId);

    // The diagnosis still happened; the repair failure changed no semantics.
    expect(diagnosisCalls.length).toBeGreaterThanOrEqual(1);
    expect(result.objectives[0]?.diagnosisHistory?.[0]?.repair).toBeUndefined();
    expect(result.state).not.toBe('COMPLETED');
    expect(result.budgetUsage.replansConsumed).toBeLessThanOrEqual(1);
  });
});

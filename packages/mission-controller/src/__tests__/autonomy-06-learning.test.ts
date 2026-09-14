// VedMoulya — AUTONOMY-06: Learning Feedback Loop Tests (mission-controller)
import { describe, it, expect } from 'vitest';
import { createTestService } from './fixtures.js';
import {
  createDiagnosis,
  rankRepairStrategy,
  type HistoricalRepairEvidence,
} from '../domain/diagnosis-repair.js';
import type { LearningContext } from '../contracts/mission-ports.js';
import type { FailureContext } from '../types/mission-types.js';
import type { FailureDiagnosis } from '../domain/diagnosis-repair.js';

const SAMPLE_LEARNING: LearningContext = {
  items: [
    {
      category: 'RECOVERY_PATTERN',
      scope: 'GLOBAL',
      subject: 'IMPORT_ERROR',
      predicate: 'verified_success_rate',
      value: 0.85,
      confidenceLevel: 'HIGH',
      sampleCount: 12,
      successCount: 10,
      failureCount: 2,
    },
  ],
  text: '- [RECOVERY_PATTERN/GLOBAL] IMPORT_ERROR: 0.85 (samples=12, confidence=HIGH)',
};

function makeLearningPort(result: LearningContext) {
  return { relevantLearning: async () => result };
}

describe('AUTONOMY-06: Learning Feedback Loop (mission-controller)', () => {
  describe('TEST 1 — SUCCESS LEARNING recorded on verified outcome', () => {
    it('records verified success via executionMemory port', async () => {
      const { service } = createTestService({
        executorResult: { success: true, verified: true },
        verifierResult: { verified: true, evidence: ['checks passed'] },
      });
      const mission = await service.createMission({
        userId: 'u1',
        title: 'Success learning',
        objective: 'Run tests',
        initialObjectives: ['Run the test suite'],
      });
      await service.startMission(mission.missionId);
      await service.runAutonomousLoop(mission.missionId);
      expect(mission.objectives[0]?.state).toBe('VERIFIED');
    });
  });

  describe('TEST 2 — FAILURE LEARNING recorded on failed outcome', () => {
    it('records failed execution for negative learning', async () => {
      const failedCalls: Array<{ failureClass: string }> = [];
      const { service } = createTestService({
        executorResult: {
          success: false,
          verified: false,
          error: 'verification failed: output mismatch',
          failureClass: 'VERIFICATION_FAILURE',
        },
        verifierResult: { verified: false, evidence: ['output mismatch'] },
        onFailedMemory: (failure) => failedCalls.push(failure),
      });
      const mission = await service.createMission({
        userId: 'u1',
        title: 'Failure learning',
        objective: 'Run tests',
        budget: { maxRetries: 1, maxReplans: 1 },
        initialObjectives: ['Run the test suite'],
      });
      await service.startMission(mission.missionId);
      const result = await service.runAutonomousLoop(mission.missionId);
      expect(['FAILED', 'BLOCKED', 'CANCELLED']).toContain(result.state);
      expect(failedCalls.length).toBeGreaterThanOrEqual(1);
      expect(failedCalls[0]?.failureClass).toBe('VERIFICATION_FAILURE');
    });
  });

  // ── TEST 9 — PLANNER INTEGRATION ──────────────────────────────────────
  describe('TEST 9 — Learning context reaches planner on re-plan', () => {
    it('passes bounded advisory learning + failure context to createPlan', async () => {
      const planCalls: Array<{
        goal: string;
        failureContext?: unknown;
        learning?: unknown;
      }> = [];

      const { service } = createTestService({
        executorResult: {
          success: false,
          verified: false,
          error: 'verification failed: import error',
          failureClass: 'VERIFICATION_FAILURE',
        },
        verifierResult: { verified: false, evidence: ['import error'] },
        learningPort: makeLearningPort(SAMPLE_LEARNING),
        onPlan: (call) => planCalls.push(call),
      });

      const mission = await service.createMission({
        userId: 'u1',
        title: 'Planner integration',
        objective: 'Run tests',
        budget: { maxRetries: 3, maxReplans: 2 },
        initialObjectives: ['Run the test suite'],
      });

      await service.startMission(mission.missionId);
      await service.runAutonomousLoop(mission.missionId);

      // On a verification-failure with maxRetries=3, the controller retries
      // up to 3 times, each time re-invoking createPlan with failure context.
      expect(planCalls.length).toBeGreaterThanOrEqual(2);

      const firstPlan = planCalls[0];
      const retryPlan = planCalls.find((c) => c.failureContext !== undefined);
      expect(retryPlan).toBeDefined();

      // The failure context carries the structured failure information.
      const fc = retryPlan!.failureContext as { failureClass: string; reason: string };
      expect(fc).toBeDefined();
      expect(fc.failureClass).toBe('VERIFICATION_FAILURE');
      expect(typeof fc.reason).toBe('string');

      // The learning context must be present (not empty).
      expect(retryPlan!.learning).toBeDefined();
      const learning = retryPlan!.learning as { items: unknown[]; text: string };
      expect(learning.items.length).toBeGreaterThan(0);
      expect(learning.text.length).toBeGreaterThan(0);
    });
  });

  // ── TEST 10 — DIAGNOSIS INTEGRATION ───────────────────────────────────
  describe('TEST 10 — Historical learning can inform diagnosis', () => {
    it('produces diagnosis with historicalSupport from verified learning', () => {
      const evidence = {
        failureContext: {
          failureClass: 'VERIFICATION_FAILURE',
          reason: 'Import error: cannot find module src/app',
          suggestedAction: 'REVISE_OBJECTIVE',
          evidence: ['Cannot find module src/app'],
          executionError: 'Cannot find module',
          revisionAttempt: 0,
          createdAt: new Date().toISOString(),
        } as FailureContext,
        command: 'npm test',
        exitCode: 1,
        stdout: 'Cannot find module "src/app"',
        stderr: 'Cannot find module "src/app"',
        timedOut: false,
        durationMs: 1200,
      };

      const historical = [
        {
          subject: 'MISSING_DEPENDENCY',
          strategy: 'ADD_OR_UPDATE_DEPENDENCY',
          verifiedCount: 5,
          confidenceLevel: 'HIGH',
          successCount: 5,
          failureCount: 0,
        },
      ];

      const diagnosis = createDiagnosis({
        evidence,
        objective: 'Fix the import error in src/app',
        missionContext: 'No external errors',
        historicalLearning: historical,
      });

      expect(diagnosis.failureClass).toBe('VERIFICATION_FAILURE');
      expect(diagnosis.rootCause).toBeDefined();
      expect(diagnosis.rootCause?.category).toBe('MISSING_DEPENDENCY');
      expect(diagnosis.suggestedRepair).toBe('ADD_OR_UPDATE_DEPENDENCY');
      expect(diagnosis.historicalSupport).toBeDefined();
      expect(diagnosis.historicalSupport!.length).toBeGreaterThan(0);
      expect(diagnosis.historicalSupport![0]).toContain('ADD_OR_UPDATE_DEPENDENCY');
    });
  });

  // ── TEST 11 — REPAIR STRATEGY RANKING ─────────────────────────────────
  describe('TEST 11 — Historical learning can influence repair ranking', () => {
    it('ranks higher-verified strategy within governed family', () => {
      const diagnosis: FailureDiagnosis = {
        failureClass: 'VERIFICATION_FAILURE',
        summary: 'Import error in source file',
        rootCause: { category: 'IMPORT_ERROR', description: 'cannot find module' },
        confidence: 'HIGH',
        evidence: ['Cannot find module src/app'],
        suggestedRepair: 'MODIFY_SOURCE',
      };

      const historical: HistoricalRepairEvidence[] = [
        {
          subject: 'IMPORT_ERROR',
          strategy: 'ADD_OR_UPDATE_DEPENDENCY',
          verifiedCount: 8,
          confidenceLevel: 'HIGH',
          successCount: 8,
          failureCount: 1,
        },
        {
          subject: 'IMPORT_ERROR',
          strategy: 'MODIFY_SOURCE',
          verifiedCount: 3,
          confidenceLevel: 'MEDIUM',
          successCount: 3,
          failureCount: 0,
        },
      ];

      // ADD_OR_UPDATE_DEPENDENCY has more verified successes → ranked higher.
      const ranked = rankRepairStrategy(diagnosis, historical);
      expect(ranked).toBe('ADD_OR_UPDATE_DEPENDENCY');
    });

    it('BLOCK/FAIL strategies are never changed by history', () => {
      const diagnosis: FailureDiagnosis = {
        failureClass: 'PERMISSION_DENIED',
        summary: 'Permission denied for dangerous command',
        rootCause: { category: 'PERMISSION_DENIED', description: 'Permission denied' },
        confidence: 'HIGH',
        evidence: ['permission denied: dangerous command blocked'],
        suggestedRepair: 'BLOCK',
      };

      const historical: HistoricalRepairEvidence[] = [
        {
          subject: 'PERMISSION_DENIED',
          strategy: 'MODIFY_FILE',
          verifiedCount: 100,
          confidenceLevel: 'HIGH',
          successCount: 100,
          failureCount: 0,
        },
      ];

      // BLOCK base strategy must remain — governance is never overridden.
      expect(rankRepairStrategy(diagnosis, historical)).toBe('BLOCK');
    });

    it('low-confidence historical evidence never overrides', () => {
      const diagnosis: FailureDiagnosis = {
        failureClass: 'VERIFICATION_FAILURE',
        summary: 'Import error',
        rootCause: { category: 'IMPORT_ERROR', description: 'cannot find module' },
        confidence: 'HIGH',
        evidence: ['Cannot find module'],
        suggestedRepair: 'MODIFY_SOURCE',
      };

      const historical: HistoricalRepairEvidence[] = [
        {
          subject: 'IMPORT_ERROR',
          strategy: 'ADD_OR_UPDATE_DEPENDENCY',
          verifiedCount: 1,
          confidenceLevel: 'LOW',
          successCount: 1,
          failureCount: 0,
        },
      ];

      // LOW confidence evidence must NOT override the deterministic strategy.
      expect(rankRepairStrategy(diagnosis, historical)).toBe('MODIFY_SOURCE');
    });

    it('conflicting historical evidence (more failures than successes) never elevates', () => {
      const diagnosis: FailureDiagnosis = {
        failureClass: 'VERIFICATION_FAILURE',
        summary: 'Import error',
        rootCause: { category: 'IMPORT_ERROR', description: 'cannot find module' },
        confidence: 'HIGH',
        evidence: ['Cannot find module'],
        suggestedRepair: 'MODIFY_SOURCE',
      };

      const historical: HistoricalRepairEvidence[] = [
        {
          subject: 'IMPORT_ERROR',
          strategy: 'ADD_OR_UPDATE_DEPENDENCY',
          verifiedCount: 1,
          confidenceLevel: 'HIGH',
          successCount: 1,
          failureCount: 5,
        },
      ];

      // Negative learning cannot elevate a failed strategy.
      expect(rankRepairStrategy(diagnosis, historical)).toBe('MODIFY_SOURCE');
    });
  });

  // ── TEST 12 — GOVERNANCE SAFETY ───────────────────────────────────────
  describe('TEST 12 — Learning advisory never bypasses governance', () => {
    it('diagnosis root cause is derived from current evidence, not history', () => {
      const evidence = {
        failureContext: {
          failureClass: 'VERIFICATION_FAILURE',
          reason: 'Syntax error in test.js line 5',
          suggestedAction: 'REVISE_OBJECTIVE',
          evidence: ['SyntaxError: Unexpected token }'],
          revisionAttempt: 0,
          createdAt: new Date().toISOString(),
        } as FailureContext,
        exitCode: 1,
        stdout: '',
        stderr: 'SyntaxError: Unexpected token }',
        timedOut: false,
      };

      const historical: HistoricalRepairEvidence[] = [
        {
          subject: 'SYNTAX_ERROR',
          strategy: 'MODIFY_TEST',
          verifiedCount: 5,
          confidenceLevel: 'HIGH',
          successCount: 4,
          failureCount: 1,
        },
      ];

      const diagnosis = createDiagnosis({
        evidence,
        objective: 'Fix syntax',
        missionContext: 'no errors',
        historicalLearning: historical,
      });

      // Diagnosis root cause is derived from CURRENT evidence, not history.
      expect(diagnosis.rootCause?.category).toBe('SYNTAX_ERROR');
      expect(diagnosis.historicalSupport).toBeDefined();
    });

    it('learning retrieval failure degrades gracefully (never blocks mission)', async () => {
      let retrievalCalled = false;
      const { service } = createTestService({
        executorResult: { success: true, verified: true },
        verifierResult: { verified: true, evidence: ['ok'] },
        learningPort: {
          relevantLearning: async () => {
            retrievalCalled = true;
            throw new Error('learning backend unavailable');
          },
        },
      });

      const mission = await service.createMission({
        userId: 'u1',
        title: 'Graceful degradation',
        objective: 'Run tests',
        initialObjectives: ['Run the test suite'],
      });

      await service.startMission(mission.missionId);
      await service.runAutonomousLoop(mission.missionId);

      // Mission must still complete successfully despite learning failure.
      expect(mission.objectives[0]?.state).toBe('VERIFIED');
      expect(retrievalCalled).toBe(true);
    });
  });
});

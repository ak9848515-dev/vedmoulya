// VedMoulya — AUTONOMY-04: Autonomous Failure Diagnosis + Repair Tests
import { describe, it, expect } from 'vitest';
import {
  analyzeRootCause,
  selectRepairStrategy,
  createDiagnosis,
  createRepairRecord,
  type CommandFailureEvidence,
  type FailureDiagnosis,
} from '../domain/diagnosis-repair.js';
import type { FailureContext } from '../types/mission-types.js';

function createFailureContext(overrides?: Partial<FailureContext>): FailureContext {
  return {
    failureClass: 'VERIFICATION_FAILURE',
    reason: 'Test failed',
    suggestedAction: 'RETRY',
    evidence: ['test output mismatch'],
    failedObjectiveId: 'obj_1',
    failedObjectiveTitle: 'Test objective',
    revisionAttempt: 1,
    failedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createEvidence(overrides?: Partial<CommandFailureEvidence>): CommandFailureEvidence {
  return {
    failureContext: createFailureContext(),
    ...overrides,
  };
}

describe('AUTONOMY-04: Failure Diagnosis + Repair', () => {
  describe('TEST 1 — DIAGNOSIS FROM REAL FAILURE', () => {
    it('diagnoses missing dependency from stderr', () => {
      const evidence = createEvidence({
        command: 'npm test',
        exitCode: 1,
        stderr: "Error: Cannot find module 'lodash'",
        stdout: '',
      });

      const diagnosis = createDiagnosis({
        evidence,
        objective: 'Run tests',
        missionContext: 'Test mission',
      });

      expect(diagnosis.rootCause).toBeDefined();
      expect(diagnosis.rootCause?.category).toBe('MISSING_DEPENDENCY');
      expect(diagnosis.confidence).toBe('HIGH');
    });

    it('diagnoses syntax error from stderr', () => {
      const evidence = createEvidence({
        command: 'node script.js',
        exitCode: 1,
        stderr: 'SyntaxError: Unexpected token }',
      });

      const diagnosis = createDiagnosis({
        evidence,
        objective: 'Run script',
        missionContext: 'Test mission',
      });

      expect(diagnosis.rootCause?.category).toBe('SYNTAX_ERROR');
    });

    it('handles unknown failure gracefully', () => {
      const evidence = createEvidence({
        command: undefined,
        stderr: undefined,
        stdout: undefined,
      });

      const diagnosis = createDiagnosis({
        evidence,
        objective: 'Run command',
        missionContext: 'Test mission',
      });

      expect(diagnosis.rootCause).toBeUndefined();
      expect(diagnosis.confidence).toBe('LOW');
    });

    // FINAL-03A — a NAMED command that really exited non-zero is a real command
    // failure even when the governed subprocess captured no output text (the
    // child died before writing any). The process evidence itself is the signal,
    // so a diagnosable, governed repair stays possible instead of degrading to
    // an unclassifiable blind retry.
    it('classifies a non-zero command exit with no captured output as a test failure', () => {
      const evidence = createEvidence({
        command: 'npm test',
        exitCode: 1,
        stdout: '',
        stderr: '',
        timedOut: false,
      });

      const diagnosis = createDiagnosis({
        evidence,
        objective: 'Fix the failing test in the repository',
        missionContext: 'Repository development mission',
      });

      expect(diagnosis.rootCause?.category).toBe('TEST_FAILURE');
      expect(diagnosis.confidence).toBe('HIGH');
      // The selected strategy is a GOVERNED workspace mutation, never a
      // fabricated repair and never an unclassifiable retry.
      expect(diagnosis.suggestedRepair).toBe('MODIFY_TEST');
      expect(selectRepairStrategy(diagnosis)).toBe('MODIFY_TEST');
    });

    it('a zero exit with a named command is never invented into a failure', () => {
      const evidence = createEvidence({
        command: 'npm test',
        exitCode: 0,
        stdout: '',
        stderr: '',
      });

      const diagnosis = createDiagnosis({
        evidence,
        objective: 'Run command',
        missionContext: 'Test mission',
      });

      expect(diagnosis.rootCause).toBeUndefined();
      expect(diagnosis.confidence).toBe('MEDIUM');
    });
  });

  describe('TEST 2 — REPAIR STRATEGY SELECTION', () => {
    it('selects ADD_OR_UPDATE_DEPENDENCY for missing dependency', () => {
      const diagnosis: FailureDiagnosis = {
        failureClass: 'VERIFICATION_FAILURE',
        summary: 'Missing dependency',
        rootCause: {
          category: 'MISSING_DEPENDENCY',
          identifier: 'lodash',
          description: 'Missing lodash',
        },
        confidence: 'HIGH',
        evidence: [],
        suggestedRepair: 'RETRY_COMMAND',
      };

      expect(selectRepairStrategy(diagnosis)).toBe('ADD_OR_UPDATE_DEPENDENCY');
    });

    it('selects BLOCK for permission denied', () => {
      const diagnosis: FailureDiagnosis = {
        failureClass: 'PERMISSION_DENIED',
        summary: 'Permission denied',
        rootCause: { category: 'PERMISSION_DENIED', description: 'Cannot write' },
        confidence: 'HIGH',
        evidence: [],
        suggestedRepair: 'RETRY_COMMAND',
      };

      expect(selectRepairStrategy(diagnosis)).toBe('BLOCK');
    });
  });

  describe('TEST 3 — REPAIR RECORD CREATION', () => {
    it('creates repair record with correct structure', () => {
      const diagnosis: FailureDiagnosis = {
        failureClass: 'VERIFICATION_FAILURE',
        summary: 'Missing dependency',
        rootCause: {
          category: 'MISSING_DEPENDENCY',
          identifier: 'lodash',
          description: 'Missing lodash',
        },
        confidence: 'HIGH',
        evidence: ['test failed'],
        suggestedRepair: 'ADD_OR_UPDATE_DEPENDENCY',
      };

      const record = createRepairRecord(
        diagnosis,
        'ADD_OR_UPDATE_DEPENDENCY',
        ['package.json'],
        true,
        new Date().toISOString(),
        { verificationResult: { verified: true, exitCode: 0 } },
      );

      expect(record.repairId).toBeDefined();
      expect(record.strategy).toBe('ADD_OR_UPDATE_DEPENDENCY');
      expect(record.modifiedFiles).toEqual(['package.json']);
      expect(record.success).toBe(true);
    });
  });

  describe('TEST 4 — FAILURE CLASS REGRESSION', () => {
    it('preserves failure class from context', () => {
      const evidence = createEvidence({
        failureContext: createFailureContext({ failureClass: 'PERMISSION_DENIED' }),
      });

      const diagnosis = createDiagnosis({
        evidence,
        objective: 'Test',
        missionContext: 'Test',
      });

      expect(diagnosis.failureClass).toBe('PERMISSION_DENIED');
    });
  });

  describe('TEST 5 — AUTONOMY-02 REGRESSION', () => {
    it('FailureContext structure remains compatible', () => {
      const ctx = createFailureContext({
        failureClass: 'VERIFICATION_FAILURE',
        suggestedAction: 'REVISE_OBJECTIVE',
      });

      expect(ctx.failureClass).toBe('VERIFICATION_FAILURE');
      expect(ctx.suggestedAction).toBe('REVISE_OBJECTIVE');
      expect(ctx.revisionAttempt).toBe(1);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Execution Errors unit tests
// BLD-009 — Execution Intelligence Engine
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  ExecutionError,
  ExecutionPlanNotFoundError,
  ExecutionValidationError,
  ExecutionStateTransitionError,
  ExecutionTaskNotFoundError,
  ExecutionMissionNotFoundError,
  ExecutionDependencyError,
  ExecutionScheduleConflictError,
  ExecutionRecoveryFailedError,
  DecisionEngineUnavailableError,
  KnowledgeGraphUnavailableError,
  MemoryEngineUnavailableError,
  AIOrchestratorUnavailableError,
} from '../ExecutionErrors.js';

describe('ExecutionErrors', () => {
  it('ExecutionError defaults to 500 with no details', () => {
    const err = new ExecutionError('CODE', 'message');
    expect(err.code).toBe('CODE');
    expect(err.message).toBe('message');
    expect(err.statusCode).toBe(500);
    expect(err.details).toBeUndefined();
    expect(err.name).toBe('ExecutionError');
    expect(err).toBeInstanceOf(Error);
  });

  it('ExecutionError accepts status and details', () => {
    const err = new ExecutionError('CODE', 'message', 422, { field: 'x' });
    expect(err.statusCode).toBe(422);
    expect(err.details).toEqual({ field: 'x' });
  });

  it('ExecutionPlanNotFoundError', () => {
    const err = new ExecutionPlanNotFoundError('plan_1');
    expect(err.code).toBe('PLAN_NOT_FOUND');
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain('plan_1');
  });

  it('ExecutionValidationError', () => {
    const err = new ExecutionValidationError('bad input', { field: 'title' });
    expect(err.code).toBe('EXECUTION_VALIDATION_ERROR');
    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual({ field: 'title' });
  });

  it('ExecutionStateTransitionError', () => {
    const err = new ExecutionStateTransitionError('pending', 'completed');
    expect(err.code).toBe('INVALID_STATE_TRANSITION');
    expect(err.statusCode).toBe(409);
    expect(err.message).toContain('pending');
    expect(err.message).toContain('completed');
  });

  it('ExecutionTaskNotFoundError', () => {
    const err = new ExecutionTaskNotFoundError('task_1', 'plan_1');
    expect(err.code).toBe('TASK_NOT_FOUND');
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain('task_1');
    expect(err.message).toContain('plan_1');
  });

  it('ExecutionMissionNotFoundError', () => {
    const err = new ExecutionMissionNotFoundError('mis_1', 'plan_1');
    expect(err.code).toBe('MISSION_NOT_FOUND');
    expect(err.statusCode).toBe(404);
  });

  it('ExecutionDependencyError', () => {
    const err = new ExecutionDependencyError('task_2', 'task_1');
    expect(err.code).toBe('DEPENDENCY_ERROR');
    expect(err.statusCode).toBe(409);
    expect(err.message).toContain('task_1');
  });

  it('ExecutionScheduleConflictError', () => {
    const err = new ExecutionScheduleConflictError('task_1');
    expect(err.code).toBe('SCHEDULE_CONFLICT');
    expect(err.statusCode).toBe(409);
  });

  it('ExecutionRecoveryFailedError', () => {
    const err = new ExecutionRecoveryFailedError('plan_1', 'timeout');
    expect(err.code).toBe('RECOVERY_FAILED');
    expect(err.statusCode).toBe(500);
    expect(err.message).toContain('timeout');
  });

  it('integration-unavailable errors return 503', () => {
    expect(new DecisionEngineUnavailableError().code).toBe('DECISION_ENGINE_UNAVAILABLE');
    expect(new DecisionEngineUnavailableError().statusCode).toBe(503);
    expect(new KnowledgeGraphUnavailableError().code).toBe('KNOWLEDGE_GRAPH_UNAVAILABLE');
    expect(new KnowledgeGraphUnavailableError().statusCode).toBe(503);
    expect(new MemoryEngineUnavailableError().code).toBe('MEMORY_ENGINE_UNAVAILABLE');
    expect(new MemoryEngineUnavailableError().statusCode).toBe(503);
    expect(new AIOrchestratorUnavailableError().code).toBe('AI_ORCHESTRATOR_UNAVAILABLE');
    expect(new AIOrchestratorUnavailableError().statusCode).toBe(503);
  });

  it('all errors are instances of ExecutionError and Error', () => {
    const errors = [
      new ExecutionPlanNotFoundError('a'),
      new ExecutionValidationError('b'),
      new ExecutionStateTransitionError('x', 'y'),
      new ExecutionRecoveryFailedError('a', 'b'),
      new DecisionEngineUnavailableError(),
    ];
    for (const err of errors) {
      expect(err).toBeInstanceOf(ExecutionError);
      expect(err).toBeInstanceOf(Error);
    }
  });
});

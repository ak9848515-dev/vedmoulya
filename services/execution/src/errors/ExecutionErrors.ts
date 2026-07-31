export class ExecutionError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    statusCode: number = 500,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ExecutionError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ExecutionPlanNotFoundError extends ExecutionError {
  constructor(id: string) {
    super('PLAN_NOT_FOUND', `Execution plan not found: ${id}`, 404);
  }
}

export class ExecutionValidationError extends ExecutionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('EXECUTION_VALIDATION_ERROR', message, 400, details);
  }
}

export class ExecutionStateTransitionError extends ExecutionError {
  constructor(from: string, to: string) {
    super('INVALID_STATE_TRANSITION', `Cannot transition from ${from} to ${to}`, 409);
  }
}

export class ExecutionTaskNotFoundError extends ExecutionError {
  constructor(taskId: string, planId: string) {
    super('TASK_NOT_FOUND', `Task ${taskId} not found in plan ${planId}`, 404);
  }
}

export class ExecutionMissionNotFoundError extends ExecutionError {
  constructor(missionId: string, planId: string) {
    super('MISSION_NOT_FOUND', `Mission ${missionId} not found in plan ${planId}`, 404);
  }
}

export class ExecutionDependencyError extends ExecutionError {
  constructor(taskId: string, dependencyId: string) {
    super('DEPENDENCY_ERROR', `Task ${taskId} has unresolved dependency: ${dependencyId}`, 409);
  }
}

export class ExecutionScheduleConflictError extends ExecutionError {
  constructor(taskId: string) {
    super('SCHEDULE_CONFLICT', `Schedule conflict for task: ${taskId}`, 409);
  }
}

export class ExecutionRecoveryFailedError extends ExecutionError {
  constructor(planId: string, reason: string) {
    super('RECOVERY_FAILED', `Recovery failed for plan ${planId}: ${reason}`, 500);
  }
}

export class DecisionEngineUnavailableError extends ExecutionError {
  constructor() {
    super('DECISION_ENGINE_UNAVAILABLE', 'Decision Engine service is unavailable', 503);
  }
}

export class KnowledgeGraphUnavailableError extends ExecutionError {
  constructor() {
    super('KNOWLEDGE_GRAPH_UNAVAILABLE', 'Knowledge Graph service is unavailable', 503);
  }
}

export class MemoryEngineUnavailableError extends ExecutionError {
  constructor() {
    super('MEMORY_ENGINE_UNAVAILABLE', 'Memory Engine service is unavailable', 503);
  }
}

export class AIOrchestratorUnavailableError extends ExecutionError {
  constructor() {
    super('AI_ORCHESTRATOR_UNAVAILABLE', 'AI Orchestrator service is unavailable', 503);
  }
}

// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Error Types
// Structured error types for the Decision Intelligence Engine
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

export class DecisionError extends Error {
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
    this.name = 'DecisionError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class DecisionNotFoundError extends DecisionError {
  constructor(id: string) {
    super('DECISION_NOT_FOUND', `Decision not found: ${id}`, 404);
  }
}

export class DecisionValidationError extends DecisionError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('DECISION_VALIDATION_ERROR', message, 400, details);
  }
}

export class DecisionStateTransitionError extends DecisionError {
  constructor(from: string, to: string) {
    super('INVALID_STATE_TRANSITION', `Cannot transition from ${from} to ${to}`, 409);
  }
}

export class DecisionOptionNotFoundError extends DecisionError {
  constructor(optionId: string, decisionId: string) {
    super('OPTION_NOT_FOUND', `Option ${optionId} not found in decision ${decisionId}`, 404);
  }
}

export class DecisionDuplicateOptionError extends DecisionError {
  constructor(optionId: string) {
    super('DUPLICATE_OPTION', `Option already exists: ${optionId}`, 409);
  }
}

export class DecisionNoOptionsError extends DecisionError {
  constructor(decisionId: string) {
    super('NO_OPTIONS', `Decision ${decisionId} has no options`, 400);
  }
}

export class DecisionNoScoreError extends DecisionError {
  constructor(decisionId: string) {
    super('NO_SCORES', `Decision ${decisionId} has no scored options`, 400);
  }
}

export class DecisionInvalidCategoryError extends DecisionError {
  constructor(category: string) {
    super('INVALID_CATEGORY', `Invalid decision category: ${category}`, 400);
  }
}

export class KnowledgeGraphUnavailableError extends DecisionError {
  constructor() {
    super('KNOWLEDGE_GRAPH_UNAVAILABLE', 'Knowledge Graph service is unavailable', 503);
  }
}

export class MemoryEngineUnavailableError extends DecisionError {
  constructor() {
    super('MEMORY_ENGINE_UNAVAILABLE', 'Memory Engine service is unavailable', 503);
  }
}

export class AIOrchestratorUnavailableError extends DecisionError {
  constructor() {
    super('AI_ORCHESTRATOR_UNAVAILABLE', 'AI Orchestrator service is unavailable', 503);
  }
}

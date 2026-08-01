// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Decision Error Types unit tests
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  DecisionError,
  DecisionNotFoundError,
  DecisionValidationError,
  DecisionStateTransitionError,
  DecisionOptionNotFoundError,
  DecisionDuplicateOptionError,
  DecisionNoOptionsError,
  DecisionNoScoreError,
  DecisionInvalidCategoryError,
  KnowledgeGraphUnavailableError,
  MemoryEngineUnavailableError,
  AIOrchestratorUnavailableError,
} from '../DecisionErrors.js';

describe('DecisionError base', () => {
  it('uses default status 500 and optional details', () => {
    const err = new DecisionError('TEST', 'boom');
    expect(err.code).toBe('TEST');
    expect(err.statusCode).toBe(500);
    expect(err.details).toBeUndefined();
    expect(err.name).toBe('DecisionError');

    const detailed = new DecisionError('TEST2', 'boom', 400, { field: 'x' });
    expect(detailed.statusCode).toBe(400);
    expect(detailed.details).toEqual({ field: 'x' });
  });
});

describe('Decision error subclasses', () => {
  it('DecisionNotFoundError carries 404 + code', () => {
    const err = new DecisionNotFoundError('d-1');
    expect(err).toBeInstanceOf(DecisionError);
    expect(err.code).toBe('DECISION_NOT_FOUND');
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain('d-1');
  });

  it('DecisionValidationError carries 400 + details', () => {
    const err = new DecisionValidationError('bad', { field: 'x' });
    expect(err.code).toBe('DECISION_VALIDATION_ERROR');
    expect(err.statusCode).toBe(400);
    expect(err.details).toEqual({ field: 'x' });
  });

  it('DecisionStateTransitionError carries 409', () => {
    const err = new DecisionStateTransitionError('requested', 'decided');
    expect(err.code).toBe('INVALID_STATE_TRANSITION');
    expect(err.statusCode).toBe(409);
    expect(err.message).toContain('requested');
    expect(err.message).toContain('decided');
  });

  it('DecisionOptionNotFoundError carries 404 + both ids', () => {
    const err = new DecisionOptionNotFoundError('opt-1', 'dec-1');
    expect(err.code).toBe('OPTION_NOT_FOUND');
    expect(err.message).toContain('opt-1');
    expect(err.message).toContain('dec-1');
  });

  it('DecisionDuplicateOptionError carries 409', () => {
    const err = new DecisionDuplicateOptionError('opt-1');
    expect(err.code).toBe('DUPLICATE_OPTION');
    expect(err.statusCode).toBe(409);
  });

  it('DecisionNoOptionsError carries 400', () => {
    const err = new DecisionNoOptionsError('dec-1');
    expect(err.code).toBe('NO_OPTIONS');
    expect(err.statusCode).toBe(400);
  });

  it('DecisionNoScoreError carries 400', () => {
    const err = new DecisionNoScoreError('dec-1');
    expect(err.code).toBe('NO_SCORES');
    expect(err.statusCode).toBe(400);
  });

  it('DecisionInvalidCategoryError carries 400', () => {
    const err = new DecisionInvalidCategoryError('nonsense');
    expect(err.code).toBe('INVALID_CATEGORY');
    expect(err.message).toContain('nonsense');
  });
});

describe('Decision integration unavailability errors', () => {
  it('KnowledgeGraphUnavailableError is a 503', () => {
    const err = new KnowledgeGraphUnavailableError();
    expect(err.code).toBe('KNOWLEDGE_GRAPH_UNAVAILABLE');
    expect(err.statusCode).toBe(503);
  });

  it('MemoryEngineUnavailableError is a 503', () => {
    const err = new MemoryEngineUnavailableError();
    expect(err.code).toBe('MEMORY_ENGINE_UNAVAILABLE');
    expect(err.statusCode).toBe(503);
  });

  it('AIOrchestratorUnavailableError is a 503', () => {
    const err = new AIOrchestratorUnavailableError();
    expect(err.code).toBe('AI_ORCHESTRATOR_UNAVAILABLE');
    expect(err.statusCode).toBe(503);
  });
});

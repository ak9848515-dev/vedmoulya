// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Core error classes unit tests
// Implements BLP-001/D01 — error taxonomy coverage
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DomainError,
  InternalError,
} from '../index.js';

describe('AppError base class', () => {
  it('sets name, code, statusCode and details from constructor args', () => {
    class TestError extends AppError {
      constructor() {
        super('boom', 'TEST_CODE', 418, { detail: 'x' });
      }
    }
    const err = new TestError();
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('TestError');
    expect(err.code).toBe('TEST_CODE');
    expect(err.statusCode).toBe(418);
    expect(err.details).toEqual({ detail: 'x' });
  });

  it('defaults statusCode to 500 and details to undefined', () => {
    class DefaultError extends AppError {
      constructor() {
        super('msg', 'CODE');
      }
    }
    const err = new DefaultError();
    expect(err.statusCode).toBe(500);
    expect(err.details).toBeUndefined();
    expect(err.message).toBe('msg');
  });
});

describe('specific error classes', () => {
  it('ValidationError maps to 400 VALIDATION_ERROR with details', () => {
    const err = new ValidationError('bad input', { field: 'name' });
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual({ field: 'name' });
  });

  it('AuthenticationError defaults message and maps to 401', () => {
    const err = new AuthenticationError();
    expect(err.message).toBe('Authentication required');
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('AUTHENTICATION_ERROR');
  });

  it('AuthenticationError accepts a custom message', () => {
    const err = new AuthenticationError('Token expired');
    expect(err.message).toBe('Token expired');
  });

  it('AuthorizationError defaults message and maps to 403', () => {
    const err = new AuthorizationError();
    expect(err.message).toBe('Insufficient permissions');
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('AUTHORIZATION_ERROR');
  });

  it('NotFoundError without id maps to 404', () => {
    const err = new NotFoundError('User');
    expect(err.message).toBe('User not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });

  it('NotFoundError with id includes the id in the message', () => {
    const err = new NotFoundError('User', 'u-123');
    expect(err.message).toBe('User not found: u-123');
  });

  it('ConflictError maps to 409', () => {
    const err = new ConflictError('Duplicate email');
    expect(err.message).toBe('Duplicate email');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
  });

  it('RateLimitError defaults message and maps to 429', () => {
    const err = new RateLimitError();
    expect(err.message).toBe('Too many requests');
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('RATE_LIMIT');
  });

  it('DomainError maps to 422 with details', () => {
    const err = new DomainError('Invalid state transition', { from: 'a', to: 'b' });
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('DOMAIN_ERROR');
    expect(err.details).toEqual({ from: 'a', to: 'b' });
  });

  it('InternalError defaults message and maps to 500', () => {
    const err = new InternalError();
    expect(err.message).toBe('Internal server error');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
  });
});

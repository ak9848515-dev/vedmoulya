import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapErrorToResponse } from '../middleware/ErrorMapper.js';

const mockJson = vi.hoisted(() => vi.fn().mockReturnValue('response'));
const mockContext = vi.hoisted(() => ({
  json: mockJson,
}));

vi.mock('@vedmoulya/core', () => ({
  AppError: class AppError extends Error {
    code: string;
    statusCode: number;
    constructor(code: string, message: string, statusCode: number) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
    }
  },
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}));

import { AppError } from '@vedmoulya/core';

describe('mapErrorToResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps AppError to error response with correct status code', () => {
    const error = new AppError('NOT_FOUND', 'Memory not found', 404);
    mapErrorToResponse(error, mockContext as never);

    expect(mockJson).toHaveBeenCalledWith(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Memory not found',
          details: undefined,
        },
      },
      404,
    );
  });

  it('maps AppError with BAD_REQUEST status code', () => {
    const error = new AppError('VALIDATION_ERROR', 'Invalid input', 400);
    mapErrorToResponse(error, mockContext as never);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
        }),
      }),
      400,
    );
  });

  it('maps AppError with INTERNAL_ERROR status code', () => {
    const error = new AppError('DB_ERROR', 'Database connection failed', 500);
    mapErrorToResponse(error, mockContext as never);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'DB_ERROR',
        }),
      }),
      500,
    );
  });

  it('maps standard Error to internal error response', () => {
    const error = new Error('Something broke');
    mapErrorToResponse(error, mockContext as never);

    expect(mockJson).toHaveBeenCalledWith(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      500,
    );
  });

  it('maps unknown error type to unknown error response', () => {
    mapErrorToResponse('string error', mockContext as never);

    expect(mockJson).toHaveBeenCalledWith(
      {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'An unknown error occurred',
        },
      },
      500,
    );
  });

  it('maps null error to unknown error response', () => {
    mapErrorToResponse(null, mockContext as never);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'UNKNOWN_ERROR',
        }),
      }),
      500,
    );
  });

  it('maps AppError with details when present', () => {
    const error = new AppError('VALIDATION_ERROR', 'Invalid input', 400);
    (error as Record<string, unknown>).details = { field: 'title', reason: 'too short' };

    mapErrorToResponse(error, mockContext as never);

    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          details: { field: 'title', reason: 'too short' },
        }),
      }),
      400,
    );
  });
});

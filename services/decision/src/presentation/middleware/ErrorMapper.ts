// ──────────────────────────────────────────────────────────────────
// VedMoulya — Decision Error Mapping Middleware
// Maps domain/application errors to consistent HTTP error responses
// ARC-003/ARC-004 — Decision Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

import type { Context } from 'hono';
import { AppError, logger } from '@vedmoulya/core';

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/** Map any error to a standardized HTTP error response */
export function mapErrorToResponse(error: unknown, c: Context): Response {
  if (error instanceof AppError) {
    logger.warn('Decision application error', {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
    });

    return c.json<ErrorResponse>(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details:
            'details' in error
              ? (error as AppError & { details: Record<string, unknown> }).details
              : undefined,
        },
      },
      error.statusCode as unknown as Parameters<typeof c.json>[1],
    );
  }

  if (error instanceof Error) {
    logger.error('Decision unexpected error', {
      message: error.message,
      stack: error.stack,
    });

    return c.json<ErrorResponse>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      500,
    );
  }

  return c.json<ErrorResponse>(
    {
      success: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred',
      },
    },
    500,
  );
}

/** Error middleware for Hono router */
export const errorMiddleware = async (c: Context, next: () => Promise<void>): Promise<void> => {
  try {
    await next();
  } catch (error) {
    const response = mapErrorToResponse(error, c);
    void response;
  }
};

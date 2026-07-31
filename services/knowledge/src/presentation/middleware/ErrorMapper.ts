// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Error Mapping Middleware
// Maps domain/application errors to consistent HTTP error responses
// ARC-003 — Knowledge Graph Bounded Context
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
    logger.warn('Knowledge application error', {
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
          details: error.details,
        },
      },
      error.statusCode as 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500,
    );
  }

  // Unknown/unhandled errors
  const message = error instanceof Error ? error.message : 'Internal server error';
  logger.error('Unhandled knowledge error', {
    error: message,
    stack: error instanceof Error ? error.stack : undefined,
  });

  return c.json<ErrorResponse>(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    },
    500,
  );
}

/** Express/Connect-style error handler for Hono */
export async function errorMiddleware(c: Context, next: () => Promise<void>): Promise<void> {
  try {
    await next();
  } catch (error) {
    void mapErrorToResponse(error, c);
  }
}

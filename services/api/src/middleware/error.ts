// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Error Middleware
// Centralized error handling with standardized error responses
// BLD-016A — API Gateway & Platform Services
// ─────────────────────────────────────────────────────────────────────────────

import { TRPCError } from '@trpc/server';

// ── Error Codes ─────────────────────────────────────────────────────────────

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'DEPENDENCY_FAILURE';

// ── Standardized Error ──────────────────────────────────────────────────────

export interface GatewayError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  statusCode: number;
}

/**
 * Maps application errors to standardized GatewayError responses.
 * Does NOT expose internal implementation details (stack traces, etc.)
 */
export function toGatewayError(
  error: unknown,
  defaultMessage = 'An unexpected error occurred',
): GatewayError {
  if (error instanceof TRPCError) {
    switch (error.code) {
      case 'BAD_REQUEST':
        return { code: 'VALIDATION_ERROR', message: error.message, statusCode: 400 };
      case 'UNAUTHORIZED':
        return { code: 'AUTHENTICATION_ERROR', message: error.message, statusCode: 401 };
      case 'FORBIDDEN':
        return { code: 'AUTHORIZATION_ERROR', message: error.message, statusCode: 403 };
      case 'NOT_FOUND':
        return { code: 'NOT_FOUND', message: error.message, statusCode: 404 };
      case 'TOO_MANY_REQUESTS':
        return { code: 'RATE_LIMITED', message: error.message, statusCode: 429 };
      case 'TIMEOUT':
        return { code: 'SERVICE_UNAVAILABLE', message: 'Request timed out', statusCode: 504 };
      case 'INTERNAL_SERVER_ERROR':
        return { code: 'INTERNAL_ERROR', message: defaultMessage, statusCode: 500 };
      default:
        return { code: 'INTERNAL_ERROR', message: defaultMessage, statusCode: 500 };
    }
  }

  if (error instanceof Error) {
    return { code: 'INTERNAL_ERROR', message: defaultMessage, statusCode: 500 };
  }

  return { code: 'INTERNAL_ERROR', message: defaultMessage, statusCode: 500 };
}

/**
 * Creates a standardized not-found error.
 */
export function notFound(resource: string): TRPCError {
  return new TRPCError({
    code: 'NOT_FOUND',
    message: `${resource} not found`,
  });
}

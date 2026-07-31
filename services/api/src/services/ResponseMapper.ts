// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Response Mapper
// Standardizes API responses with consistent envelope format
// BLD-016A — API Gateway & Platform Services
// ─────────────────────────────────────────────────────────────────────────────

import { toGatewayError, type GatewayError } from '../middleware/error.js';

// ── Response Envelope ───────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: GatewayError;
  meta?: ResponseMeta;
}

export interface ResponseMeta {
  timestamp: string;
  duration: number;
  version: string;
}

// ── Response Mapper ─────────────────────────────────────────────────────────

const API_VERSION = '1.0.0';

/**
 * Maps a successful service result to a standardized API response.
 */
export function successResponse<T>(data: T, duration = 0): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      duration,
      version: API_VERSION,
    },
  };
}

/**
 * Maps an error to a standardized API error response.
 * Never exposes internal error details to clients.
 */
export function errorResponse(
  error: unknown,
  duration = 0,
  defaultMessage?: string,
): ApiResponse<never> {
  const gatewayError = toGatewayError(error, defaultMessage);

  return {
    success: false,
    error: gatewayError,
    meta: {
      timestamp: new Date().toISOString(),
      duration,
      version: API_VERSION,
    },
  };
}

/**
 * Wraps a service result into an ApiResponse.
 * Service results use LifeOSResult pattern: { success, data, error, latency }
 */
export function fromServiceResult<T>(result: {
  success: boolean;
  data?: T;
  error?: string;
  latency?: number;
}): ApiResponse<T> {
  if (result.success && result.data) {
    return successResponse(result.data, result.latency);
  }

  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: result.error ?? 'Service returned an error',
      statusCode: 500,
    },
    meta: {
      timestamp: new Date().toISOString(),
      duration: result.latency ?? 0,
      version: API_VERSION,
    },
  };
}

/**
 * Creates a paginated response envelope.
 */
export function paginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
  duration = 0,
): ApiResponse<{ items: T[]; total: number; page: number; pageSize: number; totalPages: number }> {
  return {
    success: true,
    data: {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
    meta: {
      timestamp: new Date().toISOString(),
      duration,
      version: API_VERSION,
    },
  };
}

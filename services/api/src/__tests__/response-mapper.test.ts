// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: ResponseMapper Tests
// BLD-016A — API Gateway & Platform Services
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  successResponse,
  errorResponse,
  fromServiceResult,
  paginatedResponse,
} from '../services/ResponseMapper.js';

describe('successResponse', () => {
  it('wraps data in success envelope', () => {
    const result = successResponse({ name: 'Ved' }, 42);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'Ved' });
    expect(result.meta?.duration).toBe(42);
    expect(result.meta?.version).toBe('1.0.0');
    expect(result.meta?.timestamp).toBeDefined();
  });

  it('handles array data', () => {
    const result = successResponse([1, 2, 3]);
    expect(result.success).toBe(true);
    expect(result.data).toEqual([1, 2, 3]);
  });

  it('handles null data', () => {
    const result = successResponse(null);
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });
});

describe('errorResponse', () => {
  it('wraps Error in error envelope without exposing internals', () => {
    const error = new Error('Internal: DB connection failed at host:port:password');
    const result = errorResponse(error, 50, 'Something went wrong');
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INTERNAL_ERROR');
    expect(result.error?.message).toBe('Something went wrong');
    expect(result.error?.message).not.toContain('password');
    expect(result.meta?.duration).toBe(50);
  });

  it('handles string errors', () => {
    const result = errorResponse('string error', 0, 'Fallback');
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Fallback');
  });
});

describe('fromServiceResult', () => {
  it('maps successful service result', () => {
    const result = fromServiceResult({
      success: true,
      data: { id: '1' },
      latency: 100,
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: '1' });
    expect(result.meta?.duration).toBe(100);
  });

  it('maps failed service result', () => {
    const result = fromServiceResult({
      success: false,
      error: 'Service unavailable',
      latency: 200,
    });
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Service unavailable');
    expect(result.meta?.duration).toBe(200);
  });

  it('handles success with no data gracefully', () => {
    const result = fromServiceResult({
      success: true,
      error: 'Missing data',
    });
    expect(result.success).toBe(false);
  });
});

describe('paginatedResponse', () => {
  it('creates paginated envelope', () => {
    const result = paginatedResponse([{ id: '1' }, { id: '2' }], 50, 1, 20, 30);
    expect(result.success).toBe(true);
    expect(result.data?.items).toHaveLength(2);
    expect(result.data?.total).toBe(50);
    expect(result.data?.page).toBe(1);
    expect(result.data?.pageSize).toBe(20);
    expect(result.data?.totalPages).toBe(3);
    expect(result.meta?.duration).toBe(30);
  });

  it('handles empty results', () => {
    const result = paginatedResponse([], 0, 1, 20);
    expect(result.success).toBe(true);
    expect(result.data?.items).toHaveLength(0);
    expect(result.data?.totalPages).toBe(0);
  });
});

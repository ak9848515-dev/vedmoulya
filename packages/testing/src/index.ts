// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/testing
// Shared testing utilities, test helpers, and mock factories
// Implements BLP-001/D09 Testing Strategy
// ──────────────────────────────────────────────────────────────────

import type { Result, BrandedId } from '@vedmoulya/core';

// ── Mock Types ──────────────────────────────────────────────────────────────

/**
 * Replaces `jest.Mocked<T>` — a type that makes all properties of T mockable.
 * Avoids dependency on @types/jest.
 */
export type Mocked<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R ? MockFn<A, R> : T[K];
};

/**
 * Mock function type matching jest.fn() signature.
 */
export interface MockFn<A extends unknown[] = unknown[], R = unknown> {
  (...args: A): R;
  mockReturnValue(value: R): this;
  mockResolvedValue(value: R extends Promise<infer U> ? U : unknown): this;
  mockRejectedValue(error: unknown): this;
  mockImplementation(fn: (...args: A) => R): this;
  mockClear(): this;
  mockReset(): this;
  calls: A[];
  results: Array<{ type: string; value: R }>;
}

// ── Mock Factory ────────────────────────────────────────────────────────────

/**
 * Creates a mock function with jest.fn()-like interface.
 */
export function mockFn<A extends unknown[] = unknown[], R = unknown>(): MockFn<A, R> {
  const calls: A[] = [];
  const results: Array<{ type: string; value: R }> = [];
  let implementation: ((...args: A) => R) | undefined;
  let returnValue: R | undefined;
  let resolvedValue: unknown;
  let rejectedValue: unknown;

  const fn = ((...args: A): R => {
    calls.push(args);
    if (implementation) {
      const result = implementation(...args);
      results.push({ type: 'return', value: result });
      return result;
    }
    if (rejectedValue !== undefined) {
      results.push({ type: 'throw', value: rejectedValue as R });
      throw rejectedValue instanceof Error
        ? rejectedValue
        : new Error(JSON.stringify(rejectedValue));
    }
    if (resolvedValue !== undefined) {
      const result = Promise.resolve(resolvedValue) as unknown as R;
      results.push({ type: 'return', value: result });
      return result;
    }
    if (returnValue !== undefined) {
      results.push({ type: 'return', value: returnValue });
      return returnValue;
    }
    const result = undefined as unknown as R;
    results.push({ type: 'return', value: result });
    return result;
  }) as MockFn<A, R>;

  fn.calls = calls;
  fn.results = results;
  fn.mockReturnValue = (value: R): typeof fn => {
    returnValue = value;
    return fn;
  };
  fn.mockResolvedValue = (value: R extends Promise<infer U> ? U : unknown): typeof fn => {
    resolvedValue = value;
    return fn;
  };
  fn.mockRejectedValue = (error: unknown): typeof fn => {
    rejectedValue = error;
    return fn;
  };
  fn.mockImplementation = (impl: (...args: A) => R): typeof fn => {
    implementation = impl;
    return fn;
  };
  fn.mockClear = (): typeof fn => {
    calls.length = 0;
    results.length = 0;
    return fn;
  };
  fn.mockReset = (): typeof fn => {
    calls.length = 0;
    results.length = 0;
    implementation = undefined;
    returnValue = undefined;
    resolvedValue = undefined;
    rejectedValue = undefined;
    return fn;
  };

  return fn;
}

// ── Test Helpers ────────────────────────────────────────────────────────────

/**
 * Creates a async test wrapper that handles errors
 */
export async function expectAsyncError<T>(fn: () => Promise<T>): Promise<Error> {
  try {
    await fn();
    throw new Error('Expected function to throw');
  } catch (error) {
    return error as Error;
  }
}

/**
 * Waits for a condition to be true (for polling in tests)
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = await condition();
    if (result) return;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error('Condition not met within timeout');
}

/**
 * Creates a resolved successful Result
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true as const, value };
}

/**
 * Creates a resolved failed Result
 */
export function fail<E = Error>(error: E): Result<never, E> {
  return { ok: false as const, error };
}

/**
 * Creates a mock object with jest-like interface
 */
export function createMock<T extends object>(): Mocked<T> {
  return new Proxy({} as Mocked<T>, {
    get(target: Mocked<T>, prop: string | symbol): unknown {
      if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
      const mock = mockFn();
      (target as Record<string | symbol, unknown>)[prop] = mock;
      return mock;
    },
  });
}

/**
 * Creates a mock service with all methods mocked
 */
export function createMockService<T extends Record<string, unknown>>(
  methods: (keyof T)[],
): Mocked<T> {
  const mock = {} as Mocked<T>;
  for (const method of methods) {
    (mock as unknown as Record<string, MockFn>)[method as string] = mockFn();
  }
  return mock;
}

// ── Test Data Generators ───────────────────────────────────────────────────

/**
 * Creates a BrandedId for testing
 */
export function createId<T extends string>(prefix: string): BrandedId<T> {
  return `${prefix}_${crypto.randomUUID()}` as BrandedId<T>;
}

/**
 * Creates a Date in the past for testing
 */
export function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * Creates a Date in the future for testing
 */
export function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

// ── Re-export for convenience ──────────────────────────────────────────────

export { faker } from '@faker-js/faker';

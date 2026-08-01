// ──────────────────────────────────────────────────────────────────
// VedMoulya — Correlation Context
// Request correlation IDs propagated through async context
// PH-002 — Enterprise Operations & Reliability (T1 Observability)
// ──────────────────────────────────────────────────────────────────

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

/**
 * Async-local storage that carries the current correlation ID through
 * synchronous and asynchronous boundaries (await, timers, promises).
 */
const storage = new AsyncLocalStorage<{ correlationId: string }>();

/**
 * Generate a new correlation ID (short UUID prefix for log-friendliness).
 */
export function createCorrelationId(): string {
  return `corr_${randomUUID().slice(0, 13)}`;
}

/**
 * Run a function within a correlation context. Any nested async work
 * (promises, timers) inherits the same correlation ID.
 */
export function runWithCorrelation<T>(correlationId: string, fn: () => T): T {
  return storage.run({ correlationId }, fn);
}

/**
 * Run a function inside a NEW correlation context (generates the ID).
 */
export function withNewCorrelation<T>(fn: () => T): T {
  return runWithCorrelation(createCorrelationId(), fn);
}

/**
 * Return the current correlation ID, or `undefined` outside any context.
 */
export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}

/**
 * Obtain a correlation ID, creating one when none is active.
 */
export function ensureCorrelationId(): string {
  return getCorrelationId() ?? createCorrelationId();
}

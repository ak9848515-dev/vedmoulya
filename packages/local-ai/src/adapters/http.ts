// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya Local AI — shared HTTP helpers for runtime adapters
//
// The failure classification is IDENTICAL for every local runtime: a connection
// refusal means nothing is listening (NOT_RUNNING), while a timeout or any other
// failure proves only that no answer arrived (UNREACHABLE). Keeping it in ONE
// place stops a second adapter from inventing a different (and less honest)
// verdict.
// ─────────────────────────────────────────────────────────────────────────────

import type { LocalRuntimeErrorKind } from '../types.js';

/** Narrow an unknown JSON value to a plain record. */
export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

/** Read a Node/undici error code out of a thrown value (directly or via cause). */
export function readErrorCode(error: unknown): string | undefined {
  const record = asRecord(error);
  if (record === null) return undefined;
  const direct = record['code'];
  if (typeof direct === 'string') return direct;
  const cause = asRecord(record['cause']);
  const causeCode = cause?.['code'];
  return typeof causeCode === 'string' ? causeCode : undefined;
}

/**
 * Classify a thrown fetch failure.
 *
 * ECONNREFUSED/ECONNRESET mean nothing accepted the connection — the runtime is
 * almost certainly not started (NOT_RUNNING). A timeout or any other failure
 * proves only that no answer arrived (UNREACHABLE), never absence.
 */
export function classifyNetworkError(error: unknown): LocalRuntimeErrorKind {
  const code = readErrorCode(error);
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET') return 'NOT_RUNNING';
  return 'UNREACHABLE';
}

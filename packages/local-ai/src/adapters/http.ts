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

/**
 * Normalize a runtime base URL: trim, then drop trailing slashes.
 *
 * The trim is a single linear scan rather than `/\/+$/`: the regex is
 * quadratic on adversarial slash runs (every start position re-scans the run
 * before the anchor fails), which CodeQL reports as js/polynomial-redos
 * (CWE-1333). Both local runtime adapters share this ONE implementation.
 */
export function normalizeEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim();
  let end = trimmed.length;
  while (end > 0 && trimmed.charAt(end - 1) === '/') end -= 1;
  return trimmed.slice(0, end);
}

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

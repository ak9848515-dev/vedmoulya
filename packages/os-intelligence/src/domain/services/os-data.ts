// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Data Accessors
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// Tolerant, JSON-safe accessors over the engine DTOs consumed by the
// OS validators. The engine DTO shapes are known and stable (each is
// produced by the owning engine's application service), but the OS
// layer deliberately accesses them through a small tolerant surface
// so a shape change in one engine degrades a check instead of
// crashing the whole OS health pass.
// ──────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-object-injection -- Heuristic false-positive:
   dynamic member access here uses developer-provided literal keys against
   engine DTO shapes — never attacker-controlled property names. */

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

export function numOf(data: unknown, key: string): number | undefined {
  const record = asRecord(data);
  if (!record) return undefined;
  const value = record[key];
  return typeof value === 'number' ? value : undefined;
}

export function strOf(data: unknown, key: string): string | undefined {
  const record = asRecord(data);
  if (!record) return undefined;
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

export function arrOf(data: unknown, key: string): unknown[] | undefined {
  const record = asRecord(data);
  if (!record) return undefined;
  const value = record[key];
  return Array.isArray(value) ? (value as unknown[]) : undefined;
}

export function objOf(data: unknown, key: string): Record<string, unknown> | undefined {
  const record = asRecord(data);
  if (!record) return undefined;
  return asRecord(record[key]);
}

/** Nested count lookup: data.totals[key] (used by the dashboard DTOs). */
export function totalsNum(data: unknown, key: string): number | undefined {
  return numOf(objOf(data, 'totals'), key);
}

/** data.countByX[key] lookups (context/knowledge/memory dashboards). */
export function countBy(data: unknown, key: string, bucket: string): number | undefined {
  return numOf(objOf(data, key), bucket);
}

/** data.byType[key] lookups (memory/learning dashboards). */
export function byTypeNum(data: unknown, key: string): number | undefined {
  return countBy(data, 'byType', key);
}

/** data.pipelineSummary[key] (intelligence dashboard). */
export function pipelineSummaryNum(data: unknown, key: string): number | undefined {
  return numOf(objOf(data, 'pipelineSummary'), key);
}

/** First non-undefined number of the given keys (tolerant OR). */
export function firstNum(data: unknown, keys: readonly string[]): number | undefined {
  for (const key of keys) {
    const value = numOf(data, key);
    if (value !== undefined) return value;
  }
  return undefined;
}

export function firstTotalsNum(data: unknown, keys: readonly string[]): number | undefined {
  for (const key of keys) {
    const value = totalsNum(data, key);
    if (value !== undefined) return value;
  }
  return undefined;
}

/** Array length fallback: arr.length when the key holds an array. */
export function arrLen(data: unknown, key: string): number | undefined {
  const value = arrOf(data, key);
  return value === undefined ? undefined : value.length;
}

/** data.totals[key] when a number, else arr.length — tolerant for both shapes. */
export function countOf(data: unknown, key: string): number | undefined {
  return numOf(data, key) ?? totalsNum(data, key) ?? arrLen(data, key);
}

// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Controller: bounded activity trail helpers
//
// LEASE-02 — the activity trail is now published by MERGE, never by writing a
// whole mission document. Merging by event id makes every publication
// idempotent (a retried required write cannot duplicate events) and keeps a
// second actor's events instead of replacing them — which is exactly what makes
// the remaining conditional writes safe: history can only grow.
// ──────────────────────────────────────────────────────────────────

import type { MissionActivityEvent } from '../types/mission-types.js';

/** Default bounded trail length (the service's own default, kept in sync). */
export const DEFAULT_MAX_ACTIVITY_EVENTS = 200;

/**
 * Merge `incoming` events into `current`, deduped by id and bounded to `limit`.
 * Order is preserved: existing history first, new events appended.
 */
export function mergeMissionActivity(
  current: MissionActivityEvent[] | undefined,
  incoming: MissionActivityEvent[] | undefined,
  limit: number = DEFAULT_MAX_ACTIVITY_EVENTS,
): MissionActivityEvent[] {
  const merged = [...(current ?? [])];
  if (incoming) {
    for (const event of incoming) {
      if (!merged.some((existing) => existing.id === event.id)) merged.push(event);
    }
  }
  const max = Math.max(0, limit);
  while (merged.length > max) merged.shift();
  return merged;
}

// ──────────────────────────────────────────────────────────────────
// VedMoulya — Goal & Task Intelligence: Event Service
// EI-006 — Enterprise Goal & Task Intelligence Engine
// Appends immutable, timestamped events to a goal's history.
// ──────────────────────────────────────────────────────────────────

import type { GoalEvent, GoalEventType } from '../../types/goal-types.js';

export class GoalEventService {
  /** Build an event (goalId defaults to the raw id prefix). */
  create(
    goalId: string,
    type: GoalEventType,
    message: string,
    metadata: Record<string, string | number | boolean> = {},
  ): GoalEvent {
    return {
      eventId: `event_${Math.random().toString(36).slice(2, 10)}`,
      goalId,
      type,
      timestamp: new Date().toISOString(),
      message,
      metadata,
    };
  }

  /** Append a new event to a goal's timeline (immutable append). */
  append(
    events: GoalEvent[],
    goalId: string,
    type: GoalEventType,
    message: string,
    metadata: Record<string, string | number | boolean> = {},
  ): GoalEvent[] {
    return [...events, this.create(goalId, type, message, metadata)];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Control Plane · EmergencyStop
// SPRINT-031 — a NARROW, audited emergency-stop control.
//
//   • ENGAGE — stops autonomous execution pathways (the gate returns
//     EMERGENCY_STOP for every action until released).
//   • RELEASE — clears the stop (also audited).
//   • Never deletes data, never corrupts state — it only flips a flag and
//     records WHO / WHEN / WHY / STATE-BEFORE / STATE-AFTER.
//   • FAILS CLOSED: an engaged stop blocks everything; an unreadable store is
//     treated as engaged (never assume "not stopped" on a read error).
// ─────────────────────────────────────────────────────────────────────────────

import type { EmergencyStopEvent, EmergencyStopState } from '../types/control-types.js';

export interface EmergencyStopStore {
  get(ownerId: string): EmergencyStopState | undefined;
  save(state: EmergencyStopState): void;
}

const STOP_ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

function newId(): string {
  let id = '';
  for (let i = 0; i < 12; i++) {
    const char = STOP_ID_CHARS[Math.floor(Math.random() * STOP_ID_CHARS.length)];
    if (char !== undefined) id += char;
  }
  return `estop-${id}`;
}

export class EmergencyStop {
  constructor(
    private readonly store: EmergencyStopStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  isEngaged(ownerId: string): boolean {
    const state = this.store.get(ownerId);
    // Fail-closed: missing/unreadable state is NOT "safe" — but an owner with
    // no record has never engaged the stop, so the default is NOT engaged.
    // A malformed record (engaged flag present but no timestamp) is treated as
    // engaged — never assume safe on ambiguity.
    if (!state) return false;
    if (state.engaged && !state.engagedAt) return true;
    return state.engaged;
  }

  engage(input: {
    ownerId: string;
    actor: string;
    reason: string;
    source: 'user' | 'system' | 'operator';
  }): {
    success: true;
    state: EmergencyStopState;
  } {
    const previous = this.store.get(input.ownerId);
    const wasEngaged = previous?.engaged ?? false;
    const timestamp = this.now();
    const event: EmergencyStopEvent = {
      id: newId(),
      ownerId: input.ownerId,
      action: 'ENGAGE',
      actor: input.actor,
      timestamp,
      reason: input.reason.slice(0, 500),
      source: input.source,
      engagedBefore: wasEngaged,
      engagedAfter: true,
    };
    const state: EmergencyStopState = {
      ownerId: input.ownerId,
      engaged: true,
      engagedAt: timestamp,
      engagedBy: input.actor,
      reason: event.reason,
      history: [...(previous?.history ?? []), event].slice(-100),
    };
    this.store.save(state);
    return { success: true, state };
  }

  release(input: {
    ownerId: string;
    actor: string;
    reason: string;
    source: 'user' | 'system' | 'operator';
  }): {
    success: true;
    state: EmergencyStopState;
  } {
    const previous = this.store.get(input.ownerId);
    const wasEngaged = previous?.engaged ?? false;
    const timestamp = this.now();
    const event: EmergencyStopEvent = {
      id: newId(),
      ownerId: input.ownerId,
      action: 'RELEASE',
      actor: input.actor,
      timestamp,
      reason: input.reason.slice(0, 500),
      source: input.source,
      engagedBefore: wasEngaged,
      engagedAfter: false,
    };
    const state: EmergencyStopState = {
      ownerId: input.ownerId,
      engaged: false,
      engagedAt: previous?.engagedAt,
      engagedBy: previous?.engagedBy,
      reason: previous?.reason,
      history: [...(previous?.history ?? []), event].slice(-100),
    };
    this.store.save(state);
    return { success: true, state };
  }

  history(ownerId: string): EmergencyStopEvent[] {
    return this.store.get(ownerId)?.history ?? [];
  }
}

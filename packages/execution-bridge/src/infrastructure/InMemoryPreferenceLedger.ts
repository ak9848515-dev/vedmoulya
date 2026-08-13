// ──────────────────────────────────────────────────────────────────
// VedMoulya — Execution Bridge: In-Memory Preference Ledger
// EPIC-014 — Phase 5 provenance ledger (bounded, append-only).
// ──────────────────────────────────────────────────────────────────

import type { ExecutionPreferenceEvent } from '../types/execution-types.js';
import type { PreferenceLedgerPort } from '../contracts/execution-ports.js';

export class InMemoryPreferenceLedger implements PreferenceLedgerPort {
  private readonly events: ExecutionPreferenceEvent[] = [];
  private readonly maxEvents: number;

  constructor(maxEvents = 1000) {
    this.maxEvents = maxEvents;
  }

  record(event: ExecutionPreferenceEvent): ExecutionPreferenceEvent {
    this.events.push(event);
    while (this.events.length > this.maxEvents) {
      this.events.shift();
    }
    return event;
  }

  list(executionId?: string): ExecutionPreferenceEvent[] {
    const events = executionId
      ? this.events.filter((e) => e.executionId === executionId)
      : this.events;
    return [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }
}

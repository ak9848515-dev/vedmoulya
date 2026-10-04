/* eslint-disable @typescript-eslint/require-await -- In-memory store
   implements the Promise-returning port with a synchronous Map body (the
   documented pattern used by InMemoryProviderPreferencesStore too). */

// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Durable AI Usage Ledger (in-memory hermetic store)
// Canonical accounting spine: AI EXECUTION → USAGE EVENT → DURABLE LEDGER →
// AGGREGATION (provider / model / source / day / month) → BUDGET+QUOTA → UI
//
// STORES:
//   InMemoryAiUsageStore — bounded FIFO hermetic double (dev/test)
//   PostgresAiUsageStore — production durability (`ai_usage_events` table,
//     idempotent event_id PK, owner index)
//
// LOCAL RULE: local events are observable and NEVER in cloud totals.
// No secrets/prompts are ever written — only measured usage + safe metadata.
// ─────────────────────────────────────────────────────────────────────────────

import { normalizeUsageInput, type AiUsageEvent, type AiUsageStore } from './AiUsageLedgerTypes.js';

// ── In-memory hermetic double ────────────────────────────────────────────────

export class InMemoryAiUsageStore implements AiUsageStore {
  private readonly events = new Map<string, AiUsageEvent>();
  private readonly maxEvents: number;

  constructor(maxEvents = 20_000) {
    this.maxEvents = maxEvents;
  }

  async record(event: AiUsageEvent): Promise<boolean> {
    const normalized = normalizeUsageInput({ ...event, eventId: event.eventId });
    if (this.events.has(normalized.eventId)) return false;
    if (this.events.size >= this.maxEvents) {
      const oldest = this.events.keys().next().value;
      if (oldest !== undefined) this.events.delete(oldest);
    }
    this.events.set(normalized.eventId, normalized);
    return true;
  }

  async list(query: Parameters<AiUsageStore['list']>[0] = {}): Promise<AiUsageEvent[]> {
    const q = query;
    const limit = q.limit ?? 5000;
    const out: AiUsageEvent[] = [];
    for (const event of Array.from(this.events.values()).reverse()) {
      if (q.userId !== undefined && event.userId !== q.userId) continue;
      if (q.provider !== undefined && event.provider !== q.provider) continue;
      if (q.model !== undefined && event.model !== q.model) continue;
      if (q.source !== undefined && event.source !== q.source) continue;
      if (q.missionId !== undefined && event.missionId !== q.missionId) continue;
      if (q.executionId !== undefined && event.executionId !== q.executionId) continue;
      if (q.since !== undefined && event.timestamp < q.since) continue;
      if (q.until !== undefined && event.timestamp >= q.until) continue;
      if (q.excludeLocal === true && event.local) continue;
      if (q.localOnly === true && !event.local) continue;
      out.push(event);
      if (out.length >= limit) break;
    }
    return out;
  }

  async count(userId?: string): Promise<number> {
    if (userId === undefined) return this.events.size;
    let n = 0;
    for (const event of this.events.values()) if (event.userId === userId) n += 1;
    return n;
  }

  async clear(userId?: string): Promise<void> {
    if (userId === undefined) {
      this.events.clear();
      return;
    }
    for (const [id, event] of this.events) if (event.userId === userId) this.events.delete(id);
  }
}

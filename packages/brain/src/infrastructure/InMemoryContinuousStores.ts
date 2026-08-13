// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · In-memory continuous-intelligence stores
// EPIC-020
// Bounded (FIFO) + owner-scoped, same convention as EPIC-016 stores.
// Postgres stores follow the same interfaces in production
// (documented operator step — never silently swapped).
// ──────────────────────────────────────────────────────────────────

import type {
  BrainOutcomeMemory,
  IntelligenceEvent,
  Opportunity,
} from '../types/continuous-types.js';
import type {
  BrainMemoryPort,
  IntelligenceEventStore,
  OpportunityStore,
} from '../contracts/brain-ports.js';

export class InMemoryOpportunityStore implements OpportunityStore {
  private readonly byOwner = new Map<string, Opportunity[]>();

  constructor(private readonly maxPerOwner = 100) {}

  save(opportunity: Opportunity): void {
    const list = this.byOwner.get(opportunity.userId) ?? [];
    if (!list.some((o) => o.id === opportunity.id)) {
      list.push(opportunity);
    }
    while (list.length > this.maxPerOwner) list.shift();
    this.byOwner.set(opportunity.userId, list);
  }

  list(userId: string): Opportunity[] {
    return this.byOwner.get(userId) ?? [];
  }

  update(
    userId: string,
    opportunityId: string,
    patch: Partial<Pick<Opportunity, 'status'>>,
  ): Opportunity | undefined {
    const list = this.byOwner.get(userId) ?? [];
    const index = list.findIndex((o) => o.id === opportunityId);
    if (index < 0) return undefined;
    const updated = { ...(list[index] as Opportunity), ...patch };
    list[index] = updated;
    this.byOwner.set(userId, list);
    return updated;
  }
}

export class InMemoryIntelligenceEventStore implements IntelligenceEventStore {
  private readonly byOwner = new Map<string, IntelligenceEvent[]>();

  constructor(private readonly maxPerOwner = 200) {}

  save(event: IntelligenceEvent): void {
    const list = this.byOwner.get(event.userId) ?? [];
    if (!list.some((e) => e.id === event.id)) {
      list.push(event);
    }
    while (list.length > this.maxPerOwner) list.shift();
    this.byOwner.set(event.userId, list);
  }

  list(userId: string): IntelligenceEvent[] {
    return this.byOwner.get(userId) ?? [];
  }

  update(
    userId: string,
    eventId: string,
    patch: Partial<Pick<IntelligenceEvent, 'status'>>,
  ): IntelligenceEvent | undefined {
    const list = this.byOwner.get(userId) ?? [];
    const index = list.findIndex((e) => e.id === eventId);
    if (index < 0) return undefined;
    const updated = { ...(list[index] as IntelligenceEvent), ...patch };
    list[index] = updated;
    this.byOwner.set(userId, list);
    return updated;
  }
}

/** Owner-scoped outcome memory — the Brain's durable learning feed. */
export class InMemoryOutcomeMemory implements BrainMemoryPort {
  private readonly byOwner = new Map<string, BrainOutcomeMemory[]>();

  constructor(private readonly maxPerOwner = 100) {}

  async recordOutcome(memory: BrainOutcomeMemory): Promise<void> {
    const list = this.byOwner.get(memory.userId) ?? [];
    list.push(memory);
    while (list.length > this.maxPerOwner) list.shift();
    this.byOwner.set(memory.userId, list);
  }

  /** Owner-scoped read for the learning feed / dashboard. */
  list(userId: string): BrainOutcomeMemory[] {
    return this.byOwner.get(userId) ?? [];
  }
}

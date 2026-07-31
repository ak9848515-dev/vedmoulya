// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: ExecutionTimeline
// Chronological tracking of execution events
// ARC-004 — Execution Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

export interface TimelineEntry {
  timestamp: Date;
  eventType: string;
  description: string;
  entityId: string;
  entityType: string;
}

export class ExecutionTimeline {
  private readonly _entries: TimelineEntry[];

  constructor(entries: TimelineEntry[] = []) {
    this._entries = [...entries].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  static empty(): ExecutionTimeline {
    return new ExecutionTimeline();
  }

  addEntry(
    eventType: string,
    description: string,
    entityId: string,
    entityType: string,
  ): ExecutionTimeline {
    return new ExecutionTimeline([
      ...this._entries,
      {
        timestamp: new Date(),
        eventType,
        description,
        entityId,
        entityType,
      },
    ]);
  }

  get entries(): readonly TimelineEntry[] {
    return Object.freeze([...this._entries]);
  }

  entriesSince(date: Date): TimelineEntry[] {
    return this._entries.filter((e) => e.timestamp >= date);
  }

  get lastEntry(): TimelineEntry | undefined {
    return this._entries.length > 0 ? this._entries[this._entries.length - 1] : undefined;
  }

  get entryCount(): number {
    return this._entries.length;
  }

  toString(): string {
    return `${String(this._entries.length)} entries, last: ${this.lastEntry?.eventType ?? 'none'}`;
  }
}

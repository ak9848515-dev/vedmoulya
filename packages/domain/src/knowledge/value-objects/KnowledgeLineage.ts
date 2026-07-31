// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: KnowledgeLineage
// Tracks the provenance chain of knowledge graph data
// ──────────────────────────────────────────────────────────────────

import type { KnowledgeEventType } from '../events/KnowledgeEvent.js';

export interface LineageEntry {
  eventType: KnowledgeEventType;
  sourceId: string;
  timestamp: Date;
  description: string;
}

/**
 * KnowledgeLineage value object.
 * Records the complete provenance trail for any piece of knowledge.
 * Every piece of knowledge must be traceable to its source.
 */
export class KnowledgeLineage {
  private readonly _entries: LineageEntry[];

  constructor(entries: LineageEntry[] = []) {
    this._entries = [...entries];
  }

  /** Create lineage from the initial creation event */
  static initial(
    eventType: KnowledgeEventType,
    sourceId: string,
    description: string,
  ): KnowledgeLineage {
    return new KnowledgeLineage([{ eventType, sourceId, timestamp: new Date(), description }]);
  }

  /** Add a lineage entry */
  addEntry(eventType: KnowledgeEventType, sourceId: string, description: string): KnowledgeLineage {
    return new KnowledgeLineage([
      ...this._entries,
      { eventType, sourceId, timestamp: new Date(), description },
    ]);
  }

  get entries(): readonly LineageEntry[] {
    return Object.freeze([...this._entries]);
  }

  get length(): number {
    return this._entries.length;
  }

  get first(): LineageEntry | undefined {
    return this._entries[0];
  }

  get last(): LineageEntry | undefined {
    return this._entries[this._entries.length - 1];
  }

  hasSource(sourceId: string): boolean {
    return this._entries.some((e) => e.sourceId === sourceId);
  }

  equals(other: KnowledgeLineage): boolean {
    if (this._entries.length !== other._entries.length) return false;
    return this._entries.every((e, i) => {
      const o = other._entries[i];
      return o && e.eventType === o.eventType && e.sourceId === o.sourceId;
    });
  }
}

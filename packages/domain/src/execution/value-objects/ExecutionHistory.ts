// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: ExecutionHistory
// Historical record of execution activities and outcomes
// ARC-004 — Execution Intelligence Engine (Execution History)
// ──────────────────────────────────────────────────────────────────

import type { ExecutionResultValue } from './ExecutionResult.js';

export interface HistoricalEntry {
  planId: string;
  planTitle: string;
  taskId: string;
  taskLabel: string;
  result: ExecutionResultValue;
  actualDuration: number; // minutes
  quality?: number; // 1–5
  completedAt: Date;
  notes?: string[];
}

export class ExecutionHistory {
  private readonly _entries: HistoricalEntry[];
  private readonly _planId: string;

  constructor(planId: string, entries: HistoricalEntry[] = []) {
    this._planId = planId;
    this._entries = [...entries].sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
  }

  static empty(planId: string): ExecutionHistory {
    return new ExecutionHistory(planId);
  }

  get planId(): string {
    return this._planId;
  }
  get entries(): readonly HistoricalEntry[] {
    return Object.freeze([...this._entries]);
  }
  get totalEntries(): number {
    return this._entries.length;
  }

  addEntry(entry: HistoricalEntry): ExecutionHistory {
    return new ExecutionHistory(this._planId, [...this._entries, entry]);
  }

  get successfulEntries(): HistoricalEntry[] {
    return this._entries.filter((e) => e.result === 'success');
  }

  get failedEntries(): HistoricalEntry[] {
    return this._entries.filter((e) => e.result === 'failed');
  }

  get successRate(): number {
    if (this._entries.length === 0) return 0;
    const successes = this.successfulEntries.length;
    return Math.round((successes / this._entries.length) * 100);
  }

  get averageDuration(): number {
    if (this._entries.length === 0) return 0;
    const total = this._entries.reduce((sum, e) => sum + e.actualDuration, 0);
    return Math.round(total / this._entries.length);
  }

  get averageQuality(): number {
    const withQuality = this._entries.filter((e) => e.quality !== undefined);
    if (withQuality.length === 0) return 0;
    const total = withQuality.reduce((sum, e) => sum + (e.quality ?? 0), 0);
    return Math.round((total / withQuality.length) * 10) / 10;
  }

  toString(): string {
    return `${String(this._entries.length)} entries, ${String(this.successRate)}% success rate`;
  }
}

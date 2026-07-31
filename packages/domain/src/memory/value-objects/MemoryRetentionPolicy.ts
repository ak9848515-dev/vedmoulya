// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: MemoryRetentionPolicy
// Rules for how long and under what conditions a memory is retained
// ──────────────────────────────────────────────────────────────────

export type RetentionClass = 'permanent' | 'long_term' | 'short_term' | 'transient';

/**
 * MemoryRetentionPolicy value object.
 * Defines how long a memory persists and when it should be forgotten.
 */
export class MemoryRetentionPolicy {
  private readonly _class: RetentionClass;
  private readonly _ttlDays: number; // Time-to-live in days (0 = infinite)
  private readonly _minImportanceScore: number; // Minimum importance to retain
  private readonly _requireReinforcement: boolean; // Needs periodic recall

  private constructor(
    retentionClass: RetentionClass,
    ttlDays: number,
    minImportanceScore: number,
    requireReinforcement: boolean,
  ) {
    this._class = retentionClass;
    this._ttlDays = ttlDays;
    this._minImportanceScore = minImportanceScore;
    this._requireReinforcement = requireReinforcement;
  }

  static permanent(minImportance: number = 7): MemoryRetentionPolicy {
    return new MemoryRetentionPolicy('permanent', 0, minImportance, false);
  }

  static longTerm(ttlDays: number = 365, minImportance: number = 5): MemoryRetentionPolicy {
    return new MemoryRetentionPolicy('long_term', ttlDays, minImportance, true);
  }

  static shortTerm(ttlDays: number = 30, minImportance: number = 3): MemoryRetentionPolicy {
    return new MemoryRetentionPolicy('short_term', ttlDays, minImportance, true);
  }

  static transient(ttlDays: number = 7): MemoryRetentionPolicy {
    return new MemoryRetentionPolicy('transient', ttlDays, 1, false);
  }

  static fromClass(retentionClass: string): MemoryRetentionPolicy {
    switch (retentionClass) {
      case 'permanent':
        return MemoryRetentionPolicy.permanent();
      case 'long_term':
        return MemoryRetentionPolicy.longTerm();
      case 'short_term':
        return MemoryRetentionPolicy.shortTerm();
      default:
        return MemoryRetentionPolicy.transient();
    }
  }

  get retentionClass(): RetentionClass {
    return this._class;
  }
  get ttlDays(): number {
    return this._ttlDays;
  }
  get minImportanceScore(): number {
    return this._minImportanceScore;
  }
  get requireReinforcement(): boolean {
    return this._requireReinforcement;
  }
  get isPermanent(): boolean {
    return this._class === 'permanent';
  }

  /** Check if a memory with given importance and recall count should be retained */
  shouldRetain(importanceScore: number, daysSinceLastRecall: number): boolean {
    if (this._class === 'permanent') return importanceScore >= this._minImportanceScore;
    if (daysSinceLastRecall > this._ttlDays) return false;
    if (
      this._requireReinforcement &&
      daysSinceLastRecall > this._ttlDays / 2 &&
      importanceScore < this._minImportanceScore
    )
      return false;
    return true;
  }

  equals(other: MemoryRetentionPolicy): boolean {
    return this._class === other._class;
  }

  toString(): string {
    return `${this._class} (TTL: ${this._ttlDays === 0 ? '∞' : `${String(this._ttlDays)}d`}, min: ${String(this._minImportanceScore)})`;
  }
}

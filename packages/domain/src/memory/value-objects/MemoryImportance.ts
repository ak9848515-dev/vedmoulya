// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: MemoryImportance
// Measures the importance/priority of a memory (1-10 scale)
// ──────────────────────────────────────────────────────────────────

export type ImportanceLevel = 'critical' | 'high' | 'medium' | 'low' | 'trivial';

/**
 * MemoryImportance value object.
 * Determines retention priority and decay rate.
 * Higher importance → slower decay, stronger retention.
 */
export class MemoryImportance {
  private readonly _level: ImportanceLevel;
  private readonly _score: number; // 1-10

  private constructor(level: ImportanceLevel, score: number) {
    this._level = level;
    this._score = score;
  }

  static critical(): MemoryImportance {
    return new MemoryImportance('critical', 10);
  }
  static high(): MemoryImportance {
    return new MemoryImportance('high', 7);
  }
  static medium(): MemoryImportance {
    return new MemoryImportance('medium', 5);
  }
  static low(): MemoryImportance {
    return new MemoryImportance('low', 3);
  }
  static trivial(): MemoryImportance {
    return new MemoryImportance('trivial', 1);
  }

  static fromScore(score: number): MemoryImportance {
    const clamped = Math.max(1, Math.min(10, Math.round(score)));
    if (clamped >= 9) return new MemoryImportance('critical', clamped);
    if (clamped >= 6) return new MemoryImportance('high', clamped);
    if (clamped >= 4) return new MemoryImportance('medium', clamped);
    if (clamped >= 2) return new MemoryImportance('low', clamped);
    return new MemoryImportance('trivial', clamped);
  }

  static fromLevel(level: string): MemoryImportance {
    switch (level) {
      case 'critical':
        return MemoryImportance.critical();
      case 'high':
        return MemoryImportance.high();
      case 'medium':
        return MemoryImportance.medium();
      case 'low':
        return MemoryImportance.low();
      default:
        return MemoryImportance.trivial();
    }
  }

  get level(): ImportanceLevel {
    return this._level;
  }

  get score(): number {
    return this._score;
  }

  /** Boost importance by a delta (capped at 10) */
  boost(delta: number): MemoryImportance {
    return MemoryImportance.fromScore(this._score + delta);
  }

  /** Reduce importance by a delta (floored at 1) */
  reduce(delta: number): MemoryImportance {
    return MemoryImportance.fromScore(this._score - delta);
  }

  isAtLeast(minimum: ImportanceLevel): boolean {
    const order: ImportanceLevel[] = ['critical', 'high', 'medium', 'low', 'trivial'];
    return order.indexOf(this._level) <= order.indexOf(minimum);
  }

  equals(other: MemoryImportance): boolean {
    return this._score === other._score;
  }

  toString(): string {
    return `${this._level} (${String(this._score)}/10)`;
  }
}

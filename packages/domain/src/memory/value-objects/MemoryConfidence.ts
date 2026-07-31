// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: MemoryConfidence
// Measures certainty/accuracy of a memory
// ──────────────────────────────────────────────────────────────────

export type MemoryConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown';

/**
 * MemoryConfidence value object.
 * Indicates how certain we are that a memory is accurate.
 * Can change over time as new evidence supports or contradicts.
 */
export class MemoryConfidence {
  private readonly _level: MemoryConfidenceLevel;
  private readonly _score: number; // 0.0 to 1.0

  private constructor(level: MemoryConfidenceLevel, score: number) {
    this._level = level;
    this._score = score;
  }

  static high(): MemoryConfidence {
    return new MemoryConfidence('high', 1.0);
  }
  static medium(): MemoryConfidence {
    return new MemoryConfidence('medium', 0.6);
  }
  static low(): MemoryConfidence {
    return new MemoryConfidence('low', 0.3);
  }
  static unknown(): MemoryConfidence {
    return new MemoryConfidence('unknown', 0.0);
  }

  static fromLevel(level: string): MemoryConfidence {
    switch (level) {
      case 'high':
        return MemoryConfidence.high();
      case 'medium':
        return MemoryConfidence.medium();
      case 'low':
        return MemoryConfidence.low();
      default:
        return MemoryConfidence.unknown();
    }
  }

  static fromScore(score: number): MemoryConfidence {
    if (score >= 0.8) return new MemoryConfidence('high', score);
    if (score >= 0.4) return new MemoryConfidence('medium', score);
    if (score > 0) return new MemoryConfidence('low', score);
    return new MemoryConfidence('unknown', 0);
  }

  get level(): MemoryConfidenceLevel {
    return this._level;
  }

  get score(): number {
    return this._score;
  }

  isReliable(): boolean {
    return this._level === 'high' || this._level === 'medium';
  }

  /** Increase confidence based on corroborating evidence */
  strengthen(amount: number): MemoryConfidence {
    return MemoryConfidence.fromScore(Math.min(1, this._score + amount));
  }

  /** Decrease confidence based on contradictory evidence */
  weaken(amount: number): MemoryConfidence {
    return MemoryConfidence.fromScore(Math.max(0, this._score - amount));
  }

  equals(other: MemoryConfidence): boolean {
    return this._level === other._level;
  }

  toString(): string {
    return `${this._level} (${String(this._score)})`;
  }
}

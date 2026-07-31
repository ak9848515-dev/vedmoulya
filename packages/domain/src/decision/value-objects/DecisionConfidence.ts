// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: DecisionConfidence
// Measures certainty/correctness of a decision
// ──────────────────────────────────────────────────────────────────

export type DecisionConfidenceLevel = 'very_high' | 'high' | 'medium' | 'low' | 'unknown';

/**
 * DecisionConfidence value object.
 * Indicates how certain the system is that the decision is correct.
 * Based on evidence strength, data quality, and reasoning completeness.
 */
export class DecisionConfidence {
  private readonly _level: DecisionConfidenceLevel;
  private readonly _score: number; // 0.0–1.0

  private constructor(level: DecisionConfidenceLevel, score: number) {
    this._level = level;
    this._score = score;
  }

  static veryHigh(): DecisionConfidence {
    return new DecisionConfidence('very_high', 1.0);
  }
  static high(): DecisionConfidence {
    return new DecisionConfidence('high', 0.8);
  }
  static medium(): DecisionConfidence {
    return new DecisionConfidence('medium', 0.5);
  }
  static low(): DecisionConfidence {
    return new DecisionConfidence('low', 0.2);
  }
  static unknown(): DecisionConfidence {
    return new DecisionConfidence('unknown', 0.0);
  }

  static fromScore(score: number): DecisionConfidence {
    if (score >= 0.9) return new DecisionConfidence('very_high', score);
    if (score >= 0.7) return new DecisionConfidence('high', score);
    if (score >= 0.4) return new DecisionConfidence('medium', score);
    if (score > 0) return new DecisionConfidence('low', score);
    return new DecisionConfidence('unknown', 0);
  }

  static fromLevel(level: string): DecisionConfidence {
    switch (level) {
      case 'very_high':
        return DecisionConfidence.veryHigh();
      case 'high':
        return DecisionConfidence.high();
      case 'medium':
        return DecisionConfidence.medium();
      case 'low':
        return DecisionConfidence.low();
      default:
        return DecisionConfidence.unknown();
    }
  }

  get level(): DecisionConfidenceLevel {
    return this._level;
  }
  get score(): number {
    return this._score;
  }

  isReliable(): boolean {
    return this._level === 'very_high' || this._level === 'high' || this._level === 'medium';
  }

  /** Increase confidence */
  strengthen(amount: number): DecisionConfidence {
    return DecisionConfidence.fromScore(Math.min(1, this._score + amount));
  }

  /** Decrease confidence */
  weaken(amount: number): DecisionConfidence {
    return DecisionConfidence.fromScore(Math.max(0, this._score - amount));
  }

  equals(other: DecisionConfidence): boolean {
    return this._level === other._level;
  }

  toString(): string {
    return `${this._level} (${String(this._score)})`;
  }
}

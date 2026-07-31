// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: DecisionPriority
// Urgency/importance level for a decision
// ──────────────────────────────────────────────────────────────────

export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low' | 'optional';

/**
 * DecisionPriority value object.
 * Determines how urgently a decision must be made.
 * Critical decisions bypass normal queue processing.
 */
export class DecisionPriority {
  private readonly _level: PriorityLevel;
  private readonly _score: number; // 1–10

  private constructor(level: PriorityLevel, score: number) {
    this._level = level;
    this._score = score;
  }

  static critical(): DecisionPriority {
    return new DecisionPriority('critical', 10);
  }
  static high(): DecisionPriority {
    return new DecisionPriority('high', 7);
  }
  static medium(): DecisionPriority {
    return new DecisionPriority('medium', 5);
  }
  static low(): DecisionPriority {
    return new DecisionPriority('low', 3);
  }
  static optional(): DecisionPriority {
    return new DecisionPriority('optional', 1);
  }

  static fromScore(score: number): DecisionPriority {
    const clamped = Math.max(1, Math.min(10, Math.round(score)));
    if (clamped >= 9) return new DecisionPriority('critical', clamped);
    if (clamped >= 6) return new DecisionPriority('high', clamped);
    if (clamped >= 4) return new DecisionPriority('medium', clamped);
    if (clamped >= 2) return new DecisionPriority('low', clamped);
    return new DecisionPriority('optional', clamped);
  }

  static fromLevel(level: string): DecisionPriority {
    switch (level) {
      case 'critical':
        return DecisionPriority.critical();
      case 'high':
        return DecisionPriority.high();
      case 'medium':
        return DecisionPriority.medium();
      case 'low':
        return DecisionPriority.low();
      default:
        return DecisionPriority.optional();
    }
  }

  get level(): PriorityLevel {
    return this._level;
  }
  get score(): number {
    return this._score;
  }

  /** Increase priority */
  boost(delta: number): DecisionPriority {
    return DecisionPriority.fromScore(this._score + delta);
  }

  /** Decrease priority */
  reduce(delta: number): DecisionPriority {
    return DecisionPriority.fromScore(this._score - delta);
  }

  isAtLeast(minimum: PriorityLevel): boolean {
    const order: PriorityLevel[] = ['critical', 'high', 'medium', 'low', 'optional'];
    return order.indexOf(this._level) <= order.indexOf(minimum);
  }

  equals(other: DecisionPriority): boolean {
    return this._score === other._score;
  }

  toString(): string {
    return `${this._level} (${String(this._score)}/10)`;
  }
}

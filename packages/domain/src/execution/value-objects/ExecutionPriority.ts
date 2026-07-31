// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: ExecutionPriority
// Urgency/importance for tasks, missions, and plans
// ARC-004 — Execution Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

export type ExecutionPriorityLevel = 'critical' | 'high' | 'medium' | 'low' | 'optional';

export class ExecutionPriority {
  private readonly _level: ExecutionPriorityLevel;
  private readonly _score: number; // 1–10

  private constructor(level: ExecutionPriorityLevel, score: number) {
    this._level = level;
    this._score = score;
  }

  static critical(): ExecutionPriority {
    return new ExecutionPriority('critical', 10);
  }
  static high(): ExecutionPriority {
    return new ExecutionPriority('high', 7);
  }
  static medium(): ExecutionPriority {
    return new ExecutionPriority('medium', 5);
  }
  static low(): ExecutionPriority {
    return new ExecutionPriority('low', 3);
  }
  static optional(): ExecutionPriority {
    return new ExecutionPriority('optional', 1);
  }

  static fromScore(score: number): ExecutionPriority {
    const clamped = Math.max(1, Math.min(10, Math.round(score)));
    if (clamped >= 9) return new ExecutionPriority('critical', clamped);
    if (clamped >= 6) return new ExecutionPriority('high', clamped);
    if (clamped >= 4) return new ExecutionPriority('medium', clamped);
    if (clamped >= 2) return new ExecutionPriority('low', clamped);
    return new ExecutionPriority('optional', clamped);
  }

  static fromLevel(level: string): ExecutionPriority {
    switch (level) {
      case 'critical':
        return ExecutionPriority.critical();
      case 'high':
        return ExecutionPriority.high();
      case 'medium':
        return ExecutionPriority.medium();
      case 'low':
        return ExecutionPriority.low();
      default:
        return ExecutionPriority.optional();
    }
  }

  get level(): ExecutionPriorityLevel {
    return this._level;
  }
  get score(): number {
    return this._score;
  }

  boost(delta: number): ExecutionPriority {
    return ExecutionPriority.fromScore(this._score + delta);
  }

  reduce(delta: number): ExecutionPriority {
    return ExecutionPriority.fromScore(this._score - delta);
  }

  isAtLeast(minimum: ExecutionPriorityLevel): boolean {
    const order: ExecutionPriorityLevel[] = ['critical', 'high', 'medium', 'low', 'optional'];
    return order.indexOf(this._level) <= order.indexOf(minimum);
  }

  equals(other: ExecutionPriority): boolean {
    return this._score === other._score;
  }
  toString(): string {
    return `${this._level} (${String(this._score)}/10)`;
  }
}

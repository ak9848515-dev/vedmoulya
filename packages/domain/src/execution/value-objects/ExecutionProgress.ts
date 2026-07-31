// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: ExecutionProgress
// Tracks completion progress of execution entities
// ARC-004 — Execution Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

export class ExecutionProgress {
  private readonly _completed: number;
  private readonly _total: number;
  private readonly _percentage: number;

  constructor(completed: number, total: number) {
    this._completed = Math.max(0, completed);
    this._total = Math.max(1, total);
    this._percentage = Math.round((this._completed / this._total) * 100);
  }

  static empty(): ExecutionProgress {
    return new ExecutionProgress(0, 1);
  }

  static complete(): ExecutionProgress {
    return new ExecutionProgress(1, 1);
  }

  static fromPercentage(percentage: number, total: number = 1): ExecutionProgress {
    const completed = Math.round((percentage / 100) * total);
    return new ExecutionProgress(completed, total);
  }

  get completed(): number {
    return this._completed;
  }
  get total(): number {
    return this._total;
  }
  get percentage(): number {
    return this._percentage;
  }

  get isComplete(): boolean {
    return this._percentage >= 100;
  }
  get isStarted(): boolean {
    return this._completed > 0;
  }
  get isAtRisk(): boolean {
    return this._percentage < 50 && this._total > this._completed + 3;
  }

  advance(amount: number = 1): ExecutionProgress {
    return new ExecutionProgress(this._completed + amount, this._total);
  }

  toString(): string {
    return `${String(this._completed)}/${String(this._total)} (${String(this._percentage)}%)`;
  }

  equals(other: ExecutionProgress): boolean {
    return this._completed === other._completed && this._total === other._total;
  }
}

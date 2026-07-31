// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: ExecutionResult
// Records the outcome of executing a task or step
// ARC-004 — Execution Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

export type ExecutionResultValue = 'success' | 'partial' | 'failed' | 'skipped' | 'unknown';

export class ExecutionResult {
  private readonly _value: ExecutionResultValue;
  private readonly _description: string;
  private readonly _actualDuration?: number; // minutes
  private readonly _quality?: number; // 1–5
  private readonly _notes?: string[];
  private readonly _recordedAt: Date;

  constructor(params: {
    value: ExecutionResultValue;
    description: string;
    actualDuration?: number;
    quality?: number;
    notes?: string[];
    recordedAt?: Date;
  }) {
    this._value = params.value;
    this._description = params.description;
    this._actualDuration = params.actualDuration;
    this._quality = params.quality ? Math.max(1, Math.min(5, params.quality)) : undefined;
    this._notes = params.notes;
    this._recordedAt = params.recordedAt ?? new Date();
  }

  static success(description: string, actualDuration?: number, quality?: number): ExecutionResult {
    return new ExecutionResult({ value: 'success', description, actualDuration, quality });
  }

  static partial(description: string): ExecutionResult {
    return new ExecutionResult({ value: 'partial', description });
  }

  static failed(description: string, notes?: string[]): ExecutionResult {
    return new ExecutionResult({ value: 'failed', description, notes });
  }

  static skipped(reason: string): ExecutionResult {
    return new ExecutionResult({ value: 'skipped', description: reason });
  }

  get value(): ExecutionResultValue {
    return this._value;
  }
  get description(): string {
    return this._description;
  }
  get actualDuration(): number | undefined {
    return this._actualDuration;
  }
  get quality(): number | undefined {
    return this._quality;
  }
  get notes(): readonly string[] | undefined {
    return this._notes ? Object.freeze([...this._notes]) : undefined;
  }
  get recordedAt(): Date {
    return this._recordedAt;
  }

  get isPositive(): boolean {
    return this._value === 'success' || this._value === 'partial';
  }
  get isNegative(): boolean {
    return this._value === 'failed';
  }

  toString(): string {
    return `${this._value}: ${this._description}`;
  }

  equals(other: ExecutionResult): boolean {
    return this._value === other._value && this._description === other._description;
  }
}

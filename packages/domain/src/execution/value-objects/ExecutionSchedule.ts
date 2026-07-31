// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: ExecutionSchedule
// Time allocation for tasks in the Execution Engine
// ARC-004 — Execution Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

export class ExecutionSchedule {
  private readonly _scheduledStart: Date;
  private readonly _scheduledEnd: Date;
  private readonly _estimatedDuration: number; // minutes
  private readonly _timeBlock?: string;

  constructor(
    scheduledStart: Date,
    scheduledEnd: Date,
    estimatedDuration: number,
    timeBlock?: string,
  ) {
    this._scheduledStart = scheduledStart;
    this._scheduledEnd = scheduledEnd;
    this._estimatedDuration = estimatedDuration;
    this._timeBlock = timeBlock;
  }

  get scheduledStart(): Date {
    return this._scheduledStart;
  }
  get scheduledEnd(): Date {
    return this._scheduledEnd;
  }
  get estimatedDuration(): number {
    return this._estimatedDuration;
  }
  get timeBlock(): string | undefined {
    return this._timeBlock;
  }

  get isOverdue(): boolean {
    return new Date() > this._scheduledEnd;
  }

  get isStartingSoon(): boolean {
    const soon = new Date(Date.now() + 15 * 60 * 1000);
    return this._scheduledStart <= soon && this._scheduledStart >= new Date();
  }

  reschedule(newStart: Date, newEnd: Date): ExecutionSchedule {
    return new ExecutionSchedule(newStart, newEnd, this._estimatedDuration, this._timeBlock);
  }

  toString(): string {
    return `${this._scheduledStart.toISOString()} → ${this._scheduledEnd.toISOString()} (${String(this._estimatedDuration)}min)`;
  }

  equals(other: ExecutionSchedule): boolean {
    return (
      this._scheduledStart.getTime() === other._scheduledStart.getTime() &&
      this._scheduledEnd.getTime() === other._scheduledEnd.getTime()
    );
  }
}

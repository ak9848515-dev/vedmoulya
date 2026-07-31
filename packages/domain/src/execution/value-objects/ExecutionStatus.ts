// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: ExecutionStatus
// Lifecycle state machine for Execution entities
// ARC-004 — Execution Intelligence Engine Bounded Context
// ──────────────────────────────────────────────────────────────────

export type ExecutionStatusValue =
  | 'pending'
  | 'ready'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'blocked'
  | 'skipped';

export type ExecutionEntityType = 'plan' | 'mission' | 'task' | 'step';

/**
 * ExecutionStatus value object.
 * Status lifecycle varies by entity type.
 * Generic flow: pending → ready → in_progress → completed
 * Blocked/paused/cancelled/failed at any point.
 */
export class ExecutionStatus {
  private readonly _value: ExecutionStatusValue;
  private readonly _reason?: string;

  private constructor(value: ExecutionStatusValue, reason?: string) {
    this._value = value;
    this._reason = reason;
  }

  static pending(reason?: string): ExecutionStatus {
    return new ExecutionStatus('pending', reason);
  }
  static ready(): ExecutionStatus {
    return new ExecutionStatus('ready');
  }
  static inProgress(): ExecutionStatus {
    return new ExecutionStatus('in_progress');
  }
  static paused(reason?: string): ExecutionStatus {
    return new ExecutionStatus('paused', reason);
  }
  static completed(): ExecutionStatus {
    return new ExecutionStatus('completed');
  }
  static failed(reason?: string): ExecutionStatus {
    return new ExecutionStatus('failed', reason);
  }
  static cancelled(reason?: string): ExecutionStatus {
    return new ExecutionStatus('cancelled', reason);
  }
  static blocked(reason?: string): ExecutionStatus {
    return new ExecutionStatus('blocked', reason);
  }
  static skipped(reason?: string): ExecutionStatus {
    return new ExecutionStatus('skipped', reason);
  }

  static fromStatus(status: string, reason?: string): ExecutionStatus {
    const valid: ExecutionStatusValue[] = [
      'pending',
      'ready',
      'in_progress',
      'paused',
      'completed',
      'failed',
      'cancelled',
      'blocked',
      'skipped',
    ];
    if (!(valid as string[]).includes(status)) {
      throw new Error(`Invalid execution status: ${status}`);
    }
    return new ExecutionStatus(status as ExecutionStatusValue, reason);
  }

  get value(): ExecutionStatusValue {
    return this._value;
  }
  get reason(): string | undefined {
    return this._reason;
  }

  get isPending(): boolean {
    return this._value === 'pending';
  }
  get isReady(): boolean {
    return this._value === 'ready';
  }
  get isInProgress(): boolean {
    return this._value === 'in_progress';
  }
  get isPaused(): boolean {
    return this._value === 'paused';
  }
  get isCompleted(): boolean {
    return this._value === 'completed';
  }
  get isFailed(): boolean {
    return this._value === 'failed';
  }
  get isCancelled(): boolean {
    return this._value === 'cancelled';
  }
  get isBlocked(): boolean {
    return this._value === 'blocked';
  }
  get isSkipped(): boolean {
    return this._value === 'skipped';
  }

  get isActive(): boolean {
    return this._value === 'ready' || this._value === 'in_progress';
  }

  get isTerminal(): boolean {
    return (
      this._value === 'completed' ||
      this._value === 'failed' ||
      this._value === 'cancelled' ||
      this._value === 'skipped'
    );
  }

  canTransitionTo(target: ExecutionStatusValue): boolean {
    const transitions: Record<ExecutionStatusValue, ExecutionStatusValue[]> = {
      pending: ['ready', 'cancelled'],
      ready: ['in_progress', 'blocked', 'cancelled', 'skipped'],
      in_progress: ['completed', 'paused', 'failed', 'blocked', 'cancelled'],
      paused: ['in_progress', 'cancelled'],
      completed: [],
      failed: ['pending', 'ready'],
      cancelled: [],
      blocked: ['pending', 'ready', 'cancelled'],
      skipped: [],
    };
    return transitions[this._value].includes(target);
  }

  equals(other: ExecutionStatus): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._reason ? `${this._value} (${this._reason})` : this._value;
  }
}

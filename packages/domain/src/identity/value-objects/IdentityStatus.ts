// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: IdentityStatus
// Immutable identity lifecycle status with domain rules
// ──────────────────────────────────────────────────────────────────

export type IdentityState = 'pending' | 'active' | 'suspended' | 'deleted' | 'locked';

export class IdentityStatus {
  private readonly _state: IdentityState;
  private readonly _emailVerified: boolean;
  private readonly _reason?: string;
  private readonly _changedAt: Date;

  private constructor(
    state: IdentityState,
    emailVerified: boolean,
    reason?: string,
    changedAt?: Date,
  ) {
    this._state = state;
    this._emailVerified = emailVerified;
    this._reason = reason;
    this._changedAt = changedAt ?? new Date();
  }

  get state(): IdentityState {
    return this._state;
  }
  get emailVerified(): boolean {
    return this._emailVerified;
  }
  get reason(): string | undefined {
    return this._reason;
  }
  get changedAt(): Date {
    return this._changedAt;
  }

  get isPending(): boolean {
    return this._state === 'pending';
  }
  get isActive(): boolean {
    return this._state === 'active';
  }
  get isSuspended(): boolean {
    return this._state === 'suspended';
  }
  get isDeleted(): boolean {
    return this._state === 'deleted';
  }
  get isLocked(): boolean {
    return this._state === 'locked';
  }
  get canAuthenticate(): boolean {
    return this._state === 'active';
  }

  withEmailVerified(): IdentityStatus {
    return new IdentityStatus(this._state, true, this._reason, new Date());
  }

  static pending(): IdentityStatus {
    return new IdentityStatus('pending', false);
  }
  static active(): IdentityStatus {
    return new IdentityStatus('active', false);
  }
  static suspended(reason: string): IdentityStatus {
    return new IdentityStatus('suspended', false, reason);
  }
  static deleted(): IdentityStatus {
    return new IdentityStatus('deleted', false);
  }
  static locked(reason: string): IdentityStatus {
    return new IdentityStatus('locked', false, reason);
  }
  static from(
    state: IdentityState,
    emailVerified: boolean,
    reason?: string,
    changedAt?: Date,
  ): IdentityStatus {
    return new IdentityStatus(state, emailVerified, reason, changedAt);
  }

  toJSON(): Record<string, unknown> {
    return {
      state: this._state,
      emailVerified: this._emailVerified,
      reason: this._reason,
      changedAt: this._changedAt.toISOString(),
    };
  }
}

// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: MemoryState
// Lifecycle state of a memory entity
// ──────────────────────────────────────────────────────────────────

export type MemoryStateValue =
  'active' | 'recalled' | 'decaying' | 'strengthened' | 'merged' | 'archived' | 'forgotten';

/**
 * MemoryState value object.
 * Memory lifecycle: active → decaying → archived/forgotten
 * Recalled memories go back to active, strengthened memories increase importance.
 */
export class MemoryState {
  private readonly _state: MemoryStateValue;
  private readonly _reason?: string;

  private constructor(state: MemoryStateValue, reason?: string) {
    this._state = state;
    this._reason = reason;
  }

  static active(): MemoryState {
    return new MemoryState('active');
  }
  static recalled(): MemoryState {
    return new MemoryState('recalled');
  }
  static decaying(reason?: string): MemoryState {
    return new MemoryState('decaying', reason);
  }
  static strengthened(): MemoryState {
    return new MemoryState('strengthened');
  }
  static merged(reason?: string): MemoryState {
    return new MemoryState('merged', reason);
  }
  static archived(reason?: string): MemoryState {
    return new MemoryState('archived', reason);
  }
  static forgotten(reason?: string): MemoryState {
    return new MemoryState('forgotten', reason);
  }

  static fromState(state: string, reason?: string): MemoryState {
    const valid: MemoryStateValue[] = [
      'active',
      'recalled',
      'decaying',
      'strengthened',
      'merged',
      'archived',
      'forgotten',
    ];
    if (!(valid as string[]).includes(state)) {
      throw new Error(`Invalid memory state: ${state}`);
    }
    return new MemoryState(state as MemoryStateValue, reason);
  }

  get state(): MemoryStateValue {
    return this._state;
  }

  get reason(): string | undefined {
    return this._reason;
  }

  get isActive(): boolean {
    return this._state === 'active';
  }
  get isDecaying(): boolean {
    return this._state === 'decaying';
  }
  get isArchived(): boolean {
    return this._state === 'archived';
  }
  get isForgotten(): boolean {
    return this._state === 'forgotten';
  }
  get isRecalled(): boolean {
    return this._state === 'recalled';
  }
  get isStrengthened(): boolean {
    return this._state === 'strengthened';
  }
  get isMerged(): boolean {
    return this._state === 'merged';
  }

  canTransitionTo(target: MemoryStateValue): boolean {
    const transitions: Record<MemoryStateValue, MemoryStateValue[]> = {
      active: ['decaying', 'recalled', 'archived', 'merged'],
      recalled: ['active', 'strengthened', 'archived'],
      decaying: ['active', 'archived', 'forgotten'],
      strengthened: ['active', 'decaying', 'archived'],
      merged: ['archived'],
      archived: ['forgotten'],
      forgotten: [],
    };
    return transitions[this._state].includes(target);
  }

  equals(other: MemoryState): boolean {
    return this._state === other._state;
  }

  toString(): string {
    return this._reason ? `${this._state} (${this._reason})` : this._state;
  }
}

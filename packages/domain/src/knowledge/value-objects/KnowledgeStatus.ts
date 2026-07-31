// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: KnowledgeStatus
// Lifecycle state of a knowledge graph entity
// ──────────────────────────────────────────────────────────────────

export type KnowledgeState =
  'draft' | 'active' | 'paused' | 'completed' | 'archived' | 'invalidated';

/**
 * KnowledgeStatus value object.
 * Every entity passes through: Draft → Active → Completed → Archived
 * Active can be Paused, then resumed back to Active.
 */
export class KnowledgeStatus {
  private readonly _state: KnowledgeState;
  private readonly _reason?: string;

  private constructor(state: KnowledgeState, reason?: string) {
    this._state = state;
    this._reason = reason;
  }

  static draft(): KnowledgeStatus {
    return new KnowledgeStatus('draft');
  }

  static active(): KnowledgeStatus {
    return new KnowledgeStatus('active');
  }

  static paused(reason?: string): KnowledgeStatus {
    return new KnowledgeStatus('paused', reason);
  }

  static completed(): KnowledgeStatus {
    return new KnowledgeStatus('completed');
  }

  static archived(reason?: string): KnowledgeStatus {
    return new KnowledgeStatus('archived', reason);
  }

  static invalidated(reason?: string): KnowledgeStatus {
    return new KnowledgeStatus('invalidated', reason);
  }

  static fromState(state: string, reason?: string): KnowledgeStatus {
    const valid: KnowledgeState[] = [
      'draft',
      'active',
      'paused',
      'completed',
      'archived',
      'invalidated',
    ];
    if (!(valid as string[]).includes(state)) {
      throw new Error(`Invalid knowledge state: ${state}`);
    }
    return new KnowledgeStatus(state as KnowledgeState, reason);
  }

  get state(): KnowledgeState {
    return this._state;
  }

  get reason(): string | undefined {
    return this._reason;
  }

  get isDraft(): boolean {
    return this._state === 'draft';
  }

  get isActive(): boolean {
    return this._state === 'active';
  }

  get isPaused(): boolean {
    return this._state === 'paused';
  }

  get isCompleted(): boolean {
    return this._state === 'completed';
  }

  get isArchived(): boolean {
    return this._state === 'archived';
  }

  get isInvalidated(): boolean {
    return this._state === 'invalidated';
  }

  canTransitionTo(target: KnowledgeState): boolean {
    const transitions: Record<KnowledgeState, KnowledgeState[]> = {
      draft: ['active', 'archived'],
      active: ['paused', 'completed', 'archived'],
      paused: ['active', 'archived'],
      completed: ['archived'],
      archived: [],
      invalidated: ['archived'],
    };
    return transitions[this._state].includes(target);
  }

  equals(other: KnowledgeStatus): boolean {
    return this._state === other._state;
  }

  toString(): string {
    return this._reason ? `${this._state} (${this._reason})` : this._state;
  }
}

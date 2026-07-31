// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: DecisionStatus
// Lifecycle state of a decision entity
// ──────────────────────────────────────────────────────────────────

export type DecisionStatusValue =
  | 'requested'
  | 'analyzing'
  | 'evaluating'
  | 'decided'
  | 'implementing'
  | 'completed'
  | 'reviewed'
  | 'archived'
  | 'cancelled';

/**
 * DecisionStatus value object.
 * Decision lifecycle: requested → analyzing → evaluating → decided → implementing → completed → reviewed → archived
 * A decision can be cancelled at any point.
 */
export class DecisionStatus {
  private readonly _value: DecisionStatusValue;
  private readonly _reason?: string;

  private constructor(value: DecisionStatusValue, reason?: string) {
    this._value = value;
    this._reason = reason;
  }

  static requested(): DecisionStatus {
    return new DecisionStatus('requested');
  }
  static analyzing(): DecisionStatus {
    return new DecisionStatus('analyzing');
  }
  static evaluating(): DecisionStatus {
    return new DecisionStatus('evaluating');
  }
  static decided(): DecisionStatus {
    return new DecisionStatus('decided');
  }
  static implementing(): DecisionStatus {
    return new DecisionStatus('implementing');
  }
  static completed(): DecisionStatus {
    return new DecisionStatus('completed');
  }
  static reviewed(): DecisionStatus {
    return new DecisionStatus('reviewed');
  }
  static archived(reason?: string): DecisionStatus {
    return new DecisionStatus('archived', reason);
  }
  static cancelled(reason?: string): DecisionStatus {
    return new DecisionStatus('cancelled', reason);
  }

  static fromStatus(status: string, reason?: string): DecisionStatus {
    const valid: DecisionStatusValue[] = [
      'requested',
      'analyzing',
      'evaluating',
      'decided',
      'implementing',
      'completed',
      'reviewed',
      'archived',
      'cancelled',
    ];
    if (!(valid as string[]).includes(status)) {
      throw new Error(`Invalid decision status: ${status}`);
    }
    return new DecisionStatus(status as DecisionStatusValue, reason);
  }

  get value(): DecisionStatusValue {
    return this._value;
  }

  get reason(): string | undefined {
    return this._reason;
  }

  get isRequested(): boolean {
    return this._value === 'requested';
  }
  get isAnalyzing(): boolean {
    return this._value === 'analyzing';
  }
  get isEvaluating(): boolean {
    return this._value === 'evaluating';
  }
  get isDecided(): boolean {
    return this._value === 'decided';
  }
  get isImplementing(): boolean {
    return this._value === 'implementing';
  }
  get isCompleted(): boolean {
    return this._value === 'completed';
  }
  get isReviewed(): boolean {
    return this._value === 'reviewed';
  }
  get isArchived(): boolean {
    return this._value === 'archived';
  }
  get isCancelled(): boolean {
    return this._value === 'cancelled';
  }
  get isActive(): boolean {
    return !this.isArchived && !this.isCancelled;
  }
  get isTerminal(): boolean {
    return this.isCompleted || this.isReviewed || this.isArchived || this.isCancelled;
  }

  canTransitionTo(target: DecisionStatusValue): boolean {
    const transitions: Record<DecisionStatusValue, DecisionStatusValue[]> = {
      requested: ['analyzing', 'cancelled'],
      analyzing: ['evaluating', 'cancelled', 'requested'],
      evaluating: ['decided', 'cancelled', 'analyzing'],
      decided: ['implementing', 'cancelled', 'evaluating'],
      implementing: ['completed', 'cancelled'],
      completed: ['reviewed', 'archived'],
      reviewed: ['archived'],
      archived: [],
      cancelled: [],
    };
    return transitions[this._value].includes(target);
  }

  equals(other: DecisionStatus): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._reason ? `${this._value} (${this._reason})` : this._value;
  }
}

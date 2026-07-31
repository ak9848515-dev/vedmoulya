// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: DecisionOutcome
// Records the result of a decision after implementation
// ──────────────────────────────────────────────────────────────────

export type OutcomeResult = 'success' | 'partial' | 'neutral' | 'failure' | 'unknown';

/**
 * DecisionOutcome value object.
 * Captures what happened after a decision was implemented.
 * Used for decision history learning and future improvement.
 */
export class DecisionOutcome {
  private readonly _result: OutcomeResult;
  private readonly _description: string;
  private readonly _actualImpact?: string;
  private readonly _lessons?: string[];
  private readonly _measuredAt: Date;

  constructor(params: {
    result: OutcomeResult;
    description: string;
    actualImpact?: string;
    lessons?: string[];
    measuredAt?: Date;
  }) {
    this._result = params.result;
    this._description = params.description;
    this._actualImpact = params.actualImpact;
    this._lessons = params.lessons;
    this._measuredAt = params.measuredAt ?? new Date();
  }

  static success(description: string, actualImpact?: string, lessons?: string[]): DecisionOutcome {
    return new DecisionOutcome({ result: 'success', description, actualImpact, lessons });
  }

  static partial(description: string, actualImpact?: string, lessons?: string[]): DecisionOutcome {
    return new DecisionOutcome({ result: 'partial', description, actualImpact, lessons });
  }

  static neutral(description: string): DecisionOutcome {
    return new DecisionOutcome({ result: 'neutral', description });
  }

  static failure(description: string, lessons?: string[]): DecisionOutcome {
    return new DecisionOutcome({ result: 'failure', description, lessons });
  }

  get result(): OutcomeResult {
    return this._result;
  }
  get description(): string {
    return this._description;
  }
  get actualImpact(): string | undefined {
    return this._actualImpact;
  }
  get lessons(): readonly string[] | undefined {
    return this._lessons ? Object.freeze([...this._lessons]) : undefined;
  }
  get measuredAt(): Date {
    return this._measuredAt;
  }

  isPositive(): boolean {
    return this._result === 'success' || this._result === 'partial';
  }

  equals(other: DecisionOutcome): boolean {
    return this._result === other._result && this._description === other._description;
  }

  toString(): string {
    return `${this._result}: ${this._description}`;
  }
}

// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: DecisionOpportunity
// Opportunity assessment for a decision option
// ──────────────────────────────────────────────────────────────────

export type OpportunityLevel = 'transformational' | 'high' | 'moderate' | 'low' | 'minimal';

/**
 * DecisionOpportunity value object.
 * Assesses potential positive outcomes of a decision option.
 * Includes potential value, growth areas, and strategic alignment.
 */
export class DecisionOpportunity {
  private readonly _level: OpportunityLevel;
  private readonly _score: number; // 0–10
  private readonly _description: string;
  private readonly _expectedValue?: string;

  constructor(level: OpportunityLevel, score: number, description: string, expectedValue?: string) {
    this._level = level;
    this._score = score;
    this._description = description;
    this._expectedValue = expectedValue;
  }

  static fromScore(
    score: number,
    description: string,
    expectedValue?: string,
  ): DecisionOpportunity {
    const clamped = Math.max(0, Math.min(10, Math.round(score)));
    if (clamped >= 9)
      return new DecisionOpportunity('transformational', clamped, description, expectedValue);
    if (clamped >= 6) return new DecisionOpportunity('high', clamped, description, expectedValue);
    if (clamped >= 3)
      return new DecisionOpportunity('moderate', clamped, description, expectedValue);
    if (clamped >= 1) return new DecisionOpportunity('low', clamped, description, expectedValue);
    return new DecisionOpportunity('minimal', clamped, description, expectedValue);
  }

  get level(): OpportunityLevel {
    return this._level;
  }
  get score(): number {
    return this._score;
  }
  get description(): string {
    return this._description;
  }
  get expectedValue(): string | undefined {
    return this._expectedValue;
  }

  isSignificant(): boolean {
    return this._level === 'transformational' || this._level === 'high';
  }

  toString(): string {
    return `${this._level} opportunity (${String(this._score)}/10): ${this._description}`;
  }

  equals(other: DecisionOpportunity): boolean {
    return this._level === other._level && this._description === other._description;
  }
}

// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: DecisionRisk
// Risk assessment for a decision option
// ──────────────────────────────────────────────────────────────────

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'negligible';

/**
 * DecisionRisk value object.
 * Assesses potential negative outcomes of a decision option.
 * Includes severity, likelihood, and impact areas.
 */
export class DecisionRisk {
  private readonly _level: RiskLevel;
  private readonly _score: number; // 0–10
  private readonly _description: string;
  private readonly _mitigation?: string;

  constructor(level: RiskLevel, score: number, description: string, mitigation?: string) {
    this._level = level;
    this._score = score;
    this._description = description;
    this._mitigation = mitigation;
  }

  static fromScore(score: number, description: string, mitigation?: string): DecisionRisk {
    const clamped = Math.max(0, Math.min(10, Math.round(score)));
    if (clamped >= 9) return new DecisionRisk('critical', clamped, description, mitigation);
    if (clamped >= 6) return new DecisionRisk('high', clamped, description, mitigation);
    if (clamped >= 3) return new DecisionRisk('medium', clamped, description, mitigation);
    if (clamped >= 1) return new DecisionRisk('low', clamped, description, mitigation);
    return new DecisionRisk('negligible', clamped, description, mitigation);
  }

  get level(): RiskLevel {
    return this._level;
  }
  get score(): number {
    return this._score;
  }
  get description(): string {
    return this._description;
  }
  get mitigation(): string | undefined {
    return this._mitigation;
  }

  isAcceptable(): boolean {
    return this._level === 'low' || this._level === 'negligible';
  }

  isCritical(): boolean {
    return this._level === 'critical' || this._level === 'high';
  }

  toString(): string {
    return `${this._level} risk (${String(this._score)}/10): ${this._description}`;
  }

  equals(other: DecisionRisk): boolean {
    return this._level === other._level && this._description === other._description;
  }
}

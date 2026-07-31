// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: DecisionScore
// Numerical scoring for decision options
// ├── Overall score (weighted composite)
// ├── Criteria scores (individual dimensions)
// └── Weights applied per criterion
// ──────────────────────────────────────────────────────────────────

export interface CriterionScore {
  criterion: string;
  score: number; // 0–10
  weight: number; // 0–1
  weightedScore: number;
}

/**
 * DecisionScore value object.
 * Captures a scored evaluation of a decision option across multiple criteria.
 * Used for comparing and ranking options.
 */
export class DecisionScore {
  private readonly _overall: number; // 0–10 weighted composite
  private readonly _criteria: CriterionScore[];

  constructor(overall: number, criteria: CriterionScore[]) {
    this._overall = overall;
    this._criteria = criteria;
  }

  static compute(
    criteria: Array<{ criterion: string; score: number; weight: number }>,
  ): DecisionScore {
    const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
    const normalizedWeight = totalWeight > 0 ? totalWeight : 1;

    const scored = criteria.map((c) => ({
      criterion: c.criterion,
      score: Math.max(0, Math.min(10, c.score)),
      weight: c.weight,
      weightedScore: (c.score * c.weight) / normalizedWeight,
    }));

    const overall = criteria.reduce((sum, c) => sum + (c.score * c.weight) / normalizedWeight, 0);

    return new DecisionScore(Math.max(0, Math.min(10, Math.round(overall * 10) / 10)), scored);
  }

  get overall(): number {
    return this._overall;
  }
  get criteria(): readonly CriterionScore[] {
    return Object.freeze([...this._criteria]);
  }

  get highestCriterion(): CriterionScore | undefined {
    return this._criteria.reduce<CriterionScore | undefined>(
      (best, c) => (!best || c.score > best.score ? c : best),
      undefined,
    );
  }

  get weakestCriterion(): CriterionScore | undefined {
    return this._criteria.reduce<CriterionScore | undefined>(
      (worst, c) => (!worst || c.score < worst.score ? c : worst),
      undefined,
    );
  }

  isBetterThan(other: DecisionScore): boolean {
    return this._overall > other._overall;
  }

  equals(other: DecisionScore): boolean {
    return this._overall === other._overall;
  }

  toString(): string {
    return `Score: ${String(this._overall)}/10 (${String(this._criteria.length)} criteria)`;
  }
}

// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: DecisionConstraint
// A rule or boundary that limits decision options
// ──────────────────────────────────────────────────────────────────

export type ConstraintType =
  'must' | 'must_not' | 'should' | 'should_not' | 'limit' | 'requirement';

export type ConstraintCategory =
  'time' | 'cost' | 'resource' | 'quality' | 'compliance' | 'strategic' | 'technical' | 'ethical';

/** Types that are always binding (hard) when no explicit flag is given. */
const HARD_TYPES = new Set<ConstraintType>(['must', 'must_not', 'limit', 'requirement']);

/**
 * DecisionConstraint value object.
 * Represents a boundary condition that options must satisfy.
 * Hard constraints (must/must_not) are binding; soft constraints (should/should_not) are preferences.
 */
export class DecisionConstraint {
  private readonly _type: ConstraintType;
  private readonly _category: ConstraintCategory;
  private readonly _description: string;
  private readonly _isHard: boolean;

  constructor(
    type: ConstraintType,
    category: ConstraintCategory,
    description: string,
    isHard?: boolean,
  ) {
    this._type = type;
    this._category = category;
    this._description = description;
    this._isHard = isHard ?? HARD_TYPES.has(type);
  }

  static must(category: ConstraintCategory, description: string): DecisionConstraint {
    return new DecisionConstraint('must', category, description, true);
  }

  static mustNot(category: ConstraintCategory, description: string): DecisionConstraint {
    return new DecisionConstraint('must_not', category, description, true);
  }

  static should(category: ConstraintCategory, description: string): DecisionConstraint {
    return new DecisionConstraint('should', category, description, false);
  }

  static shouldNot(category: ConstraintCategory, description: string): DecisionConstraint {
    return new DecisionConstraint('should_not', category, description, false);
  }

  static limit(category: ConstraintCategory, description: string): DecisionConstraint {
    return new DecisionConstraint('limit', category, description, true);
  }

  static requirement(category: ConstraintCategory, description: string): DecisionConstraint {
    return new DecisionConstraint('requirement', category, description, true);
  }

  get type(): ConstraintType {
    return this._type;
  }
  get category(): ConstraintCategory {
    return this._category;
  }
  get description(): string {
    return this._description;
  }
  get isHard(): boolean {
    return this._isHard;
  }

  toString(): string {
    return `${this._isHard ? 'HARD' : 'SOFT'} [${this._type}] ${this._category}: ${this._description}`;
  }

  equals(other: DecisionConstraint): boolean {
    return (
      this._type === other._type &&
      this._category === other._category &&
      this._description === other._description
    );
  }
}

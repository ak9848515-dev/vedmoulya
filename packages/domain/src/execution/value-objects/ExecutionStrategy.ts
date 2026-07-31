// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: ExecutionStrategy
// Defines the approach for achieving goals within a plan
// ARC-004/D04 — Planning Framework (strategic approach)
// ──────────────────────────────────────────────────────────────────

export type StrategyType =
  'linear' | 'parallel' | 'agile' | 'waterfall' | 'opportunistic' | 'custom';

export interface StrategyAlternative {
  label: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  estimatedEffort: string;
}

export class ExecutionStrategy {
  private readonly _type: StrategyType;
  private readonly _description: string;
  private readonly _alternatives: StrategyAlternative[];
  private readonly _selectedAlternative?: string;
  private readonly _rationale: string;

  constructor(params: {
    type: StrategyType;
    description: string;
    alternatives?: StrategyAlternative[];
    selectedAlternative?: string;
    rationale: string;
  }) {
    this._type = params.type;
    this._description = params.description;
    this._alternatives = params.alternatives ?? [];
    this._selectedAlternative = params.selectedAlternative;
    this._rationale = params.rationale;
  }

  static linear(
    description: string,
    rationale: string,
    alternatives?: StrategyAlternative[],
  ): ExecutionStrategy {
    return new ExecutionStrategy({ type: 'linear', description, alternatives, rationale });
  }

  static parallel(
    description: string,
    rationale: string,
    alternatives?: StrategyAlternative[],
  ): ExecutionStrategy {
    return new ExecutionStrategy({ type: 'parallel', description, alternatives, rationale });
  }

  get type(): StrategyType {
    return this._type;
  }
  get description(): string {
    return this._description;
  }
  get alternatives(): readonly StrategyAlternative[] {
    return Object.freeze([...this._alternatives]);
  }
  get selectedAlternative(): string | undefined {
    return this._selectedAlternative;
  }
  get rationale(): string {
    return this._rationale;
  }

  toString(): string {
    return `[${this._type}] ${this._description}`;
  }

  equals(other: ExecutionStrategy): boolean {
    return this._type === other._type && this._description === other._description;
  }
}

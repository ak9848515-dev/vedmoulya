// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: DecisionReasoning
// Captures the logic and rationale behind a decision
// ──────────────────────────────────────────────────────────────────

export type ReasoningMethod =
  'analytical' | 'comparative' | 'rule_based' | 'heuristic' | 'ai_assisted' | 'manual';

/**
 * DecisionReasoning value object.
 * Records how a decision was reached for explainability and audit.
 * Every decision must include its reasoning for traceability.
 */
export class DecisionReasoning {
  private readonly _method: ReasoningMethod;
  private readonly _summary: string;
  private readonly _assumptions: string[];
  private readonly _pros: string[];
  private readonly _cons: string[];
  private readonly _confidenceFactors: Record<string, number>;

  constructor(params: {
    method: ReasoningMethod;
    summary: string;
    assumptions?: string[];
    pros?: string[];
    cons?: string[];
    confidenceFactors?: Record<string, number>;
  }) {
    this._method = params.method;
    this._summary = params.summary;
    this._assumptions = params.assumptions ?? [];
    this._pros = params.pros ?? [];
    this._cons = params.cons ?? [];
    this._confidenceFactors = params.confidenceFactors ?? {};
  }

  get method(): ReasoningMethod {
    return this._method;
  }
  get summary(): string {
    return this._summary;
  }
  get assumptions(): readonly string[] {
    return Object.freeze([...this._assumptions]);
  }
  get pros(): readonly string[] {
    return Object.freeze([...this._pros]);
  }
  get cons(): readonly string[] {
    return Object.freeze([...this._cons]);
  }
  get confidenceFactors(): Readonly<Record<string, number>> {
    return this._confidenceFactors;
  }

  equals(other: DecisionReasoning): boolean {
    return this._method === other._method && this._summary === other._summary;
  }

  toString(): string {
    return `[${this._method}] ${this._summary} (${String(this._pros.length)} pros, ${String(this._cons.length)} cons)`;
  }
}

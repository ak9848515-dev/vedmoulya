// ──────────────────────────────────────────────────────────────────
// VedMoulya — CostEstimate Value Object
// Estimated cost for an AI provider request
// ARC-005 — AI Orchestration
// ──────────────────────────────────────────────────────────────────

export class CostEstimate {
  private constructor(
    public readonly estimatedInputTokens: number,
    public readonly estimatedOutputTokens: number,
    public readonly estimatedCost: number,
    public readonly currency: string,
    public readonly providerId: string,
    public readonly confidence: 'high' | 'medium' | 'low',
  ) {
    if (estimatedCost < 0) throw new Error('Cost must be non-negative');
  }

  static create(params: {
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    estimatedCost: number;
    currency: string;
    providerId: string;
    confidence: 'high' | 'medium' | 'low';
  }): CostEstimate {
    return new CostEstimate(
      params.estimatedInputTokens,
      params.estimatedOutputTokens,
      params.estimatedCost,
      params.currency,
      params.providerId,
      params.confidence,
    );
  }

  equals(other: CostEstimate): boolean {
    return this.providerId === other.providerId && this.estimatedCost === other.estimatedCost;
  }
}

// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: KnowledgeConfidence
// Measures certainty of knowledge graph data
// ──────────────────────────────────────────────────────────────────

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown';

/**
 * KnowledgeConfidence value object.
 * Indicates how certain we are that a piece of knowledge is accurate.
 */
export class KnowledgeConfidence {
  private readonly _level: ConfidenceLevel;
  private readonly _score: number; // 0.0 to 1.0

  private constructor(level: ConfidenceLevel, score: number) {
    this._level = level;
    this._score = score;
  }

  static high(): KnowledgeConfidence {
    return new KnowledgeConfidence('high', 1.0);
  }

  static medium(): KnowledgeConfidence {
    return new KnowledgeConfidence('medium', 0.6);
  }

  static low(): KnowledgeConfidence {
    return new KnowledgeConfidence('low', 0.3);
  }

  static unknown(): KnowledgeConfidence {
    return new KnowledgeConfidence('unknown', 0.0);
  }

  static fromLevel(level: string): KnowledgeConfidence {
    switch (level) {
      case 'high':
        return KnowledgeConfidence.high();
      case 'medium':
        return KnowledgeConfidence.medium();
      case 'low':
        return KnowledgeConfidence.low();
      default:
        return KnowledgeConfidence.unknown();
    }
  }

  static fromScore(score: number): KnowledgeConfidence {
    if (score >= 0.8) return new KnowledgeConfidence('high', score);
    if (score >= 0.4) return new KnowledgeConfidence('medium', score);
    if (score > 0) return new KnowledgeConfidence('low', score);
    return new KnowledgeConfidence('unknown', 0);
  }

  get level(): ConfidenceLevel {
    return this._level;
  }

  get score(): number {
    return this._score;
  }

  isReliable(): boolean {
    return this._level === 'high' || this._level === 'medium';
  }

  equals(other: KnowledgeConfidence): boolean {
    return this._level === other._level;
  }

  toString(): string {
    return `${this._level} (${String(this._score)})`;
  }
}

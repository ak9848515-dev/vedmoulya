// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: KnowledgeQuality
// Quality metadata for knowledge graph entities
// ARC-003/D05 — Knowledge Quality
// ──────────────────────────────────────────────────────────────────

export interface QualityMetrics {
  accuracy: number; // 0.0 to 1.0
  completeness: number; // 0.0 to 1.0
  consistency: number; // 0.0 to 1.0
  timeliness: number; // 0.0 to 1.0
  relevance: number; // 0.0 to 1.0
}

/**
 * KnowledgeQuality value object.
 * Measures the quality dimensions of knowledge: accuracy, completeness,
 * consistency, timeliness, and relevance.
 */
export class KnowledgeQuality {
  private readonly _accuracy: number;
  private readonly _completeness: number;
  private readonly _consistency: number;
  private readonly _timeliness: number;
  private readonly _relevance: number;

  constructor(metrics: Partial<QualityMetrics>) {
    this._accuracy = clamp01(metrics.accuracy ?? 0);
    this._completeness = clamp01(metrics.completeness ?? 0);
    this._consistency = clamp01(metrics.consistency ?? 0);
    this._timeliness = clamp01(metrics.timeliness ?? 0);
    this._relevance = clamp01(metrics.relevance ?? 0);
  }

  static initial(): KnowledgeQuality {
    return new KnowledgeQuality({
      accuracy: 0.5,
      completeness: 0.5,
      consistency: 0.5,
      timeliness: 1.0,
      relevance: 0.5,
    });
  }

  static high(): KnowledgeQuality {
    return new KnowledgeQuality({
      accuracy: 1.0,
      completeness: 1.0,
      consistency: 1.0,
      timeliness: 1.0,
      relevance: 1.0,
    });
  }

  get accuracy(): number {
    return this._accuracy;
  }
  get completeness(): number {
    return this._completeness;
  }
  get consistency(): number {
    return this._consistency;
  }
  get timeliness(): number {
    return this._timeliness;
  }
  get relevance(): number {
    return this._relevance;
  }

  /** Compute overall quality score (average of all dimensions) */
  get overall(): number {
    return (
      (this._accuracy +
        this._completeness +
        this._consistency +
        this._timeliness +
        this._relevance) /
      5
    );
  }

  /** Returns true if overall quality is above 0.7 */
  isHighQuality(): boolean {
    return this.overall >= 0.7;
  }

  /** Returns true if overall quality is above 0.4 */
  isAcceptable(): boolean {
    return this.overall >= 0.4;
  }

  toMetrics(): QualityMetrics {
    return {
      accuracy: this._accuracy,
      completeness: this._completeness,
      consistency: this._consistency,
      timeliness: this._timeliness,
      relevance: this._relevance,
    };
  }

  equals(other: KnowledgeQuality): boolean {
    return (
      this._accuracy === other._accuracy &&
      this._completeness === other._completeness &&
      this._consistency === other._consistency &&
      this._timeliness === other._timeliness &&
      this._relevance === other._relevance
    );
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

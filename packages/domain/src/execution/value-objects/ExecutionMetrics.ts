// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: ExecutionMetrics
// Tracks execution analytics and key performance indicators
// ARC-004 — Execution Intelligence Engine (Execution Metrics)
// ──────────────────────────────────────────────────────────────────

export class ExecutionMetrics {
  private readonly _completionRate: number; // 0–100%
  private readonly _onTimeRate: number; // 0–100%
  private readonly _estimationAccuracy: number; // 0–100%
  private readonly _momentumScore: number; // 0–10
  private readonly _consistencyScore: number; // 0–10
  private readonly _streakLength: number; // days
  private readonly _qualityScore: number; // 1–5
  private readonly _adaptationFrequency: number; // changes per week
  private readonly _recoveryTime: number; // hours to recover from disruption

  constructor(params: {
    completionRate?: number;
    onTimeRate?: number;
    estimationAccuracy?: number;
    momentumScore?: number;
    consistencyScore?: number;
    streakLength?: number;
    qualityScore?: number;
    adaptationFrequency?: number;
    recoveryTime?: number;
  }) {
    this._completionRate = params.completionRate ?? 0;
    this._onTimeRate = params.onTimeRate ?? 0;
    this._estimationAccuracy = params.estimationAccuracy ?? 0;
    this._momentumScore = params.momentumScore ?? 0;
    this._consistencyScore = params.consistencyScore ?? 0;
    this._streakLength = params.streakLength ?? 0;
    this._qualityScore = params.qualityScore ?? 1;
    this._adaptationFrequency = params.adaptationFrequency ?? 0;
    this._recoveryTime = params.recoveryTime ?? 0;
  }

  static empty(): ExecutionMetrics {
    return new ExecutionMetrics({});
  }

  get completionRate(): number {
    return this._completionRate;
  }
  get onTimeRate(): number {
    return this._onTimeRate;
  }
  get estimationAccuracy(): number {
    return this._estimationAccuracy;
  }
  get momentumScore(): number {
    return this._momentumScore;
  }
  get consistencyScore(): number {
    return this._consistencyScore;
  }
  get streakLength(): number {
    return this._streakLength;
  }
  get qualityScore(): number {
    return this._qualityScore;
  }
  get adaptationFrequency(): number {
    return this._adaptationFrequency;
  }
  get recoveryTime(): number {
    return this._recoveryTime;
  }

  get isGoodMomentum(): boolean {
    return this._momentumScore >= 6;
  }
  get isLowMomentum(): boolean {
    return this._momentumScore < 3;
  }
  get isHighQuality(): boolean {
    return this._qualityScore >= 4;
  }
  get isReliable(): boolean {
    return this._completionRate >= 70 && this._onTimeRate >= 70;
  }

  toString(): string {
    return `Completion: ${String(this._completionRate)}%, Momentum: ${String(this._momentumScore)}/10, Quality: ${String(this._qualityScore)}/5`;
  }

  equals(other: ExecutionMetrics): boolean {
    return (
      this._completionRate === other._completionRate && this._momentumScore === other._momentumScore
    );
  }
}

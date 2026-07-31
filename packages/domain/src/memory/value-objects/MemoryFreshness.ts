// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: MemoryFreshness
// Tracks how recently a memory was accessed/recalled
// Used for decay calculations and retrieval strength
// ──────────────────────────────────────────────────────────────────

export type FreshnessState = 'vivid' | 'recent' | 'fading' | 'stale' | 'archival';

/**
 * MemoryFreshness value object.
 * Determines retrieval speed and decay behavior.
 * Each recall strengthens freshness; time weakens it.
 */
export class MemoryFreshness {
  private readonly _state: FreshnessState;
  private readonly _lastRecalledAt: Date;
  private readonly _recallCount: number;

  constructor(lastRecalledAt: Date, recallCount: number) {
    this._lastRecalledAt = lastRecalledAt;
    this._recallCount = recallCount;
    this._state = this.computeState(lastRecalledAt, recallCount);
  }

  static initial(): MemoryFreshness {
    return new MemoryFreshness(new Date(), 1);
  }

  private computeState(lastRecalled: Date, _count: number): FreshnessState {
    const hoursSinceRecall = (Date.now() - lastRecalled.getTime()) / (1000 * 60 * 60);
    if (hoursSinceRecall < 1) return 'vivid';
    if (hoursSinceRecall < 24) return 'recent';
    if (hoursSinceRecall < 168) return 'fading'; // 7 days
    if (hoursSinceRecall < 720) return 'stale'; // 30 days
    return 'archival';
  }

  /** Record a recall event, refreshing the freshness */
  recall(): MemoryFreshness {
    return new MemoryFreshness(new Date(), this._recallCount + 1);
  }

  get state(): FreshnessState {
    return this._state;
  }

  get lastRecalledAt(): Date {
    return this._lastRecalledAt;
  }

  get recallCount(): number {
    return this._recallCount;
  }

  get hoursSinceRecall(): number {
    return (Date.now() - this._lastRecalledAt.getTime()) / (1000 * 60 * 60);
  }

  isVivid(): boolean {
    return this._state === 'vivid';
  }

  isStale(): boolean {
    return this._state === 'stale' || this._state === 'archival';
  }

  equals(other: MemoryFreshness): boolean {
    return this._state === other._state && this._recallCount === other._recallCount;
  }

  toString(): string {
    return `${this._state} (recalled ${String(this._recallCount)} times, last ${String(Math.round(this.hoursSinceRecall))}h ago)`;
  }
}

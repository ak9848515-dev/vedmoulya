// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: MemoryStrength
// Retrieval strength based on spaced repetition algorithm
// Higher strength → easier to recall, slower to decay
// ──────────────────────────────────────────────────────────────────

/**
 * MemoryStrength value object.
 * Implements a simplified spaced repetition model:
 * - Each successful recall increases strength
 * - Each failed recall decreases strength
 * - Strength decays over time without recall
 */
export class MemoryStrength {
  private readonly _value: number; // 0.0 to 1.0
  private readonly _interval: number; // Current recall interval in hours
  private readonly _easeFactor: number; // Ease factor (1.3 to 3.0)

  constructor(value: number, interval: number, easeFactor: number = 2.5) {
    this._value = Math.max(0, Math.min(1, value));
    this._interval = Math.max(1, interval);
    this._easeFactor = Math.max(1.3, Math.min(3.0, easeFactor));
  }

  static initial(): MemoryStrength {
    return new MemoryStrength(0.3, 1, 2.5);
  }

  /** Record a successful recall — strengthen the memory */
  successfulRecall(): MemoryStrength {
    const newInterval = Math.round(this._interval * this._easeFactor);
    const newValue = Math.min(1, this._value + 0.15);
    return new MemoryStrength(newValue, newInterval, this._easeFactor + 0.1);
  }

  /** Record a failed recall — weaken the memory */
  failedRecall(): MemoryStrength {
    const newInterval = Math.max(1, Math.round(this._interval * 0.5));
    const newValue = Math.max(0, this._value - 0.25);
    return new MemoryStrength(newValue, newInterval, Math.max(1.3, this._easeFactor - 0.2));
  }

  /** Calculate the current strength after elapsed hours without recall */
  decay(elapsedHours: number): MemoryStrength {
    const decayFactor = Math.exp(-elapsedHours / (this._interval * 24));
    const newValue = this._value * decayFactor;
    return new MemoryStrength(newValue, this._interval, this._easeFactor);
  }

  /** Predict the strength after a given number of hours */
  predictStrength(afterHours: number): number {
    return this._value * Math.exp(-afterHours / (this._interval * 24));
  }

  get value(): number {
    return this._value;
  }

  get interval(): number {
    return this._interval;
  }

  get easeFactor(): number {
    return this._easeFactor;
  }

  isStrong(): boolean {
    return this._value >= 0.7;
  }

  isWeak(): boolean {
    return this._value < 0.3;
  }

  equals(other: MemoryStrength): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return `${String(Math.round(this._value * 100))}% strength (interval: ${String(this._interval)}h, ease: ${this._easeFactor.toFixed(1)})`;
  }
}

// ──────────────────────────────────────────────────────────────────
// VedMoulya — ProviderId Value Object
// Branded identifier for AI providers
// ARC-005 — AI Orchestration
// ──────────────────────────────────────────────────────────────────

const BRAND = Symbol('ProviderId');

export class ProviderId {
  private readonly _brand: typeof BRAND = BRAND;

  private constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('ProviderId must not be empty');
    }
  }

  static create(value: string): ProviderId {
    return new ProviderId(value);
  }

  equals(other: ProviderId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

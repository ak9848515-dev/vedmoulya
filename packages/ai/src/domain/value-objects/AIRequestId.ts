// ──────────────────────────────────────────────────────────────────
// VedMoulya — AIRequestId Value Object
// Branded identifier for AI requests
// ARC-005 — AI Orchestration
// ──────────────────────────────────────────────────────────────────

import { generateId } from '@vedmoulya/core';

const BRAND = Symbol('AIRequestId');

export class AIRequestId {
  private readonly _brand: typeof BRAND = BRAND;

  private constructor(public readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('AIRequestId must not be empty');
    }
  }

  static create(value?: string): AIRequestId {
    return new AIRequestId(value ?? generateId());
  }

  equals(other: AIRequestId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

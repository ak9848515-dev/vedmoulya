// ──────────────────────────────────────────────────────────────────
// VedMoulya — Capability Value Object
// Represents an AI capability that can be routed to providers
// ARC-005 — AI Orchestration
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '../../types/index.js';

export class Capability {
  private constructor(public readonly type: CapabilityType) {}

  static create(type: CapabilityType): Capability {
    return new Capability(type);
  }

  equals(other: Capability): boolean {
    return this.type === other.type;
  }

  toString(): string {
    return this.type;
  }
}

// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: CapabilityStatus
// Lifecycle: design → draft → testing → active → deprecated → archived
// ──────────────────────────────────────────────────────────────────

import type { CapabilityStatus as CapabilityStatusValue } from '../../types/capability-types.js';

// ── Transition Map ─────────────────────────────────────────────────────────

const TRANSITIONS: Record<CapabilityStatusValue, readonly CapabilityStatusValue[]> = {
  design: ['draft'],
  draft: ['testing', 'design'],
  testing: ['active', 'draft'],
  active: ['deprecated', 'draft'],
  deprecated: ['archived', 'active'],
  archived: [],
};

const ORDER: readonly CapabilityStatusValue[] = [
  'design',
  'draft',
  'testing',
  'active',
  'deprecated',
  'archived',
];

/**
 * CapabilityStatus — lifecycle state of a capability with validated
 * transitions. Archived is terminal; deprecated may be revived to active.
 */
export class CapabilityStatus {
  private readonly _value: CapabilityStatusValue;

  private constructor(value: CapabilityStatusValue) {
    this._value = value;
  }

  static create(value: CapabilityStatusValue): CapabilityStatus {
    return new CapabilityStatus(value);
  }

  static design(): CapabilityStatus {
    return new CapabilityStatus('design');
  }

  static fromStatus(value: CapabilityStatusValue): CapabilityStatus {
    return new CapabilityStatus(value);
  }

  get value(): CapabilityStatusValue {
    return this._value;
  }

  toString(): string {
    return this._value;
  }

  canTransitionTo(next: CapabilityStatusValue): boolean {
    return TRANSITIONS[this._value].includes(next);
  }

  get allowedTransitions(): readonly CapabilityStatusValue[] {
    return TRANSITIONS[this._value];
  }

  /** Numeric progression order (for sorting/filtering). */
  get progression(): number {
    return ORDER.indexOf(this._value);
  }

  isActive(): boolean {
    return this._value === 'active';
  }

  isArchived(): boolean {
    return this._value === 'archived';
  }

  equals(other: CapabilityStatus): boolean {
    return this._value === other._value;
  }
}

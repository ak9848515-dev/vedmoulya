// ──────────────────────────────────────────────────────────────────
// VedMoulya — Value Object: ProviderLifecycleStatus
// Lifecycle: draft → testing → active → maintenance → deprecated → archived
// ──────────────────────────────────────────────────────────────────

import type { ProviderLifecycleStatus as ProviderLifecycleStatusValue } from '../../types/provider-types.js';

// ── Transition Map ─────────────────────────────────────────────────────────

const TRANSITIONS: Record<ProviderLifecycleStatusValue, readonly ProviderLifecycleStatusValue[]> = {
  draft: ['testing'],
  testing: ['active', 'draft'],
  active: ['maintenance', 'deprecated', 'testing'],
  maintenance: ['active', 'deprecated'],
  deprecated: ['archived', 'active'],
  archived: [],
};

const ORDER: readonly ProviderLifecycleStatusValue[] = [
  'draft',
  'testing',
  'active',
  'maintenance',
  'deprecated',
  'archived',
];

/**
 * ProviderLifecycleStatus — lifecycle state of a provider with validated
 * transitions. Archived is terminal; deprecated may be revived to active.
 */
export class ProviderLifecycleStatus {
  private readonly _value: ProviderLifecycleStatusValue;

  private constructor(value: ProviderLifecycleStatusValue) {
    this._value = value;
  }

  static create(value: ProviderLifecycleStatusValue): ProviderLifecycleStatus {
    return new ProviderLifecycleStatus(value);
  }

  static draft(): ProviderLifecycleStatus {
    return new ProviderLifecycleStatus('draft');
  }

  static fromStatus(value: ProviderLifecycleStatusValue): ProviderLifecycleStatus {
    return new ProviderLifecycleStatus(value);
  }

  get value(): ProviderLifecycleStatusValue {
    return this._value;
  }

  toString(): string {
    return this._value;
  }

  canTransitionTo(next: ProviderLifecycleStatusValue): boolean {
    return TRANSITIONS[this._value].includes(next);
  }

  get allowedTransitions(): readonly ProviderLifecycleStatusValue[] {
    return TRANSITIONS[this._value];
  }

  /** Numeric progression order (for sorting/filtering). */
  get progression(): number {
    return ORDER.indexOf(this._value);
  }

  isActive(): boolean {
    return this._value === 'active' || this._value === 'maintenance';
  }

  isArchived(): boolean {
    return this._value === 'archived';
  }

  equals(other: ProviderLifecycleStatus): boolean {
    return this._value === other._value;
  }
}

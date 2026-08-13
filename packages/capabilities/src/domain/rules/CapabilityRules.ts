// ──────────────────────────────────────────────────────────────────
// VedMoulya — Capability Business Rules
// Validation rules for capability definitions and lifecycle
// EI-001 — Enterprise Capability Registry & Marketplace
// ──────────────────────────────────────────────────────────────────

import type {
  BusinessModule,
  CapabilityCategory,
  CapabilityStatus,
} from '../../types/capability-types.js';
import {
  BUSINESS_MODULES,
  CAPABILITY_CATEGORIES,
  CAPABILITY_STATUSES,
} from '../../types/capability-types.js';

export interface RuleResult {
  passed: boolean;
  message?: string;
}

/** Capability name must be non-empty and reasonably short. */
export function capabilityNameRule(name: string): RuleResult {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { passed: false, message: 'Capability name is required' };
  }
  if (trimmed.length > 80) {
    return { passed: false, message: 'Capability name must be ≤ 80 characters' };
  }
  return { passed: true };
}

/** Capability category must be a known category. */
export function capabilityCategoryRule(category: CapabilityCategory): RuleResult {
  if (!CAPABILITY_CATEGORIES.includes(category)) {
    return { passed: false, message: `Unknown capability category: ${category}` };
  }
  return { passed: true };
}

/** Capability status must be a known lifecycle status. */
export function capabilityStatusRule(status: CapabilityStatus): RuleResult {
  if (!CAPABILITY_STATUSES.includes(status)) {
    return { passed: false, message: `Unknown capability status: ${status}` };
  }
  return { passed: true };
}

/** Business modules must be known module ids. */
export function businessModulesRule(modules: readonly BusinessModule[]): RuleResult {
  const unknown = modules.filter((m) => !BUSINESS_MODULES.includes(m));
  if (unknown.length > 0) {
    return { passed: false, message: `Unknown business modules: ${unknown.join(', ')}` };
  }
  return { passed: true };
}

/** Confidence must be within [0, 1]. */
export function confidenceRule(confidence: number): RuleResult {
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    return { passed: false, message: 'Confidence must be within [0, 1]' };
  }
  return { passed: true };
}

/** Quality profile: minimum ≤ target, both within [0, 1]. */
export function qualityProfileRule(target: number, minimum: number): RuleResult {
  if (!Number.isFinite(target) || target < 0 || target > 1) {
    return { passed: false, message: 'Quality target must be within [0, 1]' };
  }
  if (!Number.isFinite(minimum) || minimum < 0 || minimum > 1) {
    return { passed: false, message: 'Quality minimum must be within [0, 1]' };
  }
  if (minimum > target) {
    return { passed: false, message: 'Quality minimum cannot exceed target' };
  }
  return { passed: true };
}

/** Run a list of rules; returns first failure or a pass. */
export function validate(rules: RuleResult[]): RuleResult {
  for (const rule of rules) {
    if (!rule.passed) return rule;
  }
  return { passed: true };
}

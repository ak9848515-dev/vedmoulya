// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider Business Rules
// Validation rules for provider definitions
// EI-002 — Enterprise Provider Registry & Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import type { ProviderFamily } from '@vedmoulya/ai';
import type { ProviderLifecycleStatus } from '../../types/provider-types.js';
import { PROVIDER_LIFECYCLE_STATUSES } from '../../types/provider-types.js';

export interface RuleResult {
  passed: boolean;
  message?: string;
}

export const PROVIDER_FAMILIES: readonly ProviderFamily[] = [
  'openai',
  'anthropic',
  'google',
  'deepseek',
  'openrouter',
  'ollama',
  'mock',
] as const;

/** Provider name must be non-empty and reasonably short. */
export function providerNameRule(name: string): RuleResult {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { passed: false, message: 'Provider name is required' };
  }
  if (trimmed.length > 80) {
    return { passed: false, message: 'Provider name must be ≤ 80 characters' };
  }
  return { passed: true };
}

/** Provider family must be a known family. */
export function providerFamilyRule(family: ProviderFamily): RuleResult {
  if (!PROVIDER_FAMILIES.includes(family)) {
    return { passed: false, message: `Unknown provider family: ${family}` };
  }
  return { passed: true };
}

/** Lifecycle status must be a known lifecycle value. */
export function providerLifecycleStatusRule(status: ProviderLifecycleStatus): RuleResult {
  if (!PROVIDER_LIFECYCLE_STATUSES.includes(status)) {
    return { passed: false, message: `Unknown provider lifecycle status: ${status}` };
  }
  return { passed: true };
}

/** Availability must be within [0, 1]. */
export function availabilityRule(availability: number): RuleResult {
  if (!Number.isFinite(availability) || availability < 0 || availability > 1) {
    return { passed: false, message: 'Availability must be within [0, 1]' };
  }
  return { passed: true };
}

/** A provider must expose at least one model. */
export function modelsRule(modelCount: number): RuleResult {
  if (modelCount < 1) {
    return { passed: false, message: 'Provider must expose at least one model' };
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

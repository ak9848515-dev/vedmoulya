// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Orchestration Business Rules
// Business rules for AI request validation and orchestration decisions
// ARC-005 — AI Orchestration
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType, QualityTier, FailureReason } from '../../types/index.js';

export interface RuleResult {
  passed: boolean;
  message?: string;
}

/**
 * Capability routing rule: Ensure capability is supported
 */
export function supportedCapabilityRule(capability: CapabilityType): RuleResult {
  const supported: CapabilityType[] = [
    'reasoning',
    'coding',
    'vision',
    'embeddings',
    'summarization',
    'classification',
    'translation',
    'speech',
    'image_understanding',
    'general_conversation',
  ];
  const passed = supported.includes(capability);
  return {
    passed,
    message: passed ? undefined : `Capability '${capability}' is not supported`,
  };
}

/**
 * Quality tier rule: Ensure tier is valid for the capability
 */
export function qualityTierRule(capability: CapabilityType, tier: QualityTier): RuleResult {
  if (tier === 'premium' || tier === 'standard') {
    return { passed: true };
  }

  const criticalCapabilities: CapabilityType[] = ['reasoning', 'coding'];
  if (criticalCapabilities.includes(capability)) {
    return {
      passed: false,
      message: `${tier} tier does not support ${capability} capability`,
    };
  }

  return { passed: true };
}

/**
 * Retry rule: Determine maximum retries for a failure type
 */
export function retryLimitRule(failureReason: FailureReason, currentAttempts: number): RuleResult {
  const retryableReasons: FailureReason[] = ['timeout', 'rate_limited', 'provider_unavailable'];

  if (!retryableReasons.includes(failureReason)) {
    return { passed: false, message: `Non-retryable failure: ${failureReason}` };
  }

  const passed = currentAttempts < 3;
  return {
    passed,
    message: passed ? undefined : `Max retries (3) exceeded for ${failureReason}`,
  };
}

/**
 * Fallback rule: Determine if fallback to another provider is appropriate
 */
export function fallbackRule(
  primaryProviderFailed: boolean,
  alternativeProviderAvailable: boolean,
  attemptCount: number,
): RuleResult {
  if (!primaryProviderFailed) {
    return { passed: true };
  }

  const passed = alternativeProviderAvailable && attemptCount < 5;
  return {
    passed,
    message: passed ? undefined : 'No fallback provider available or max attempts exceeded',
  };
}

/**
 * Cost rule: Verify the request is within budget constraints
 */
export function costRule(estimatedCost: number, maxBudget: number | undefined): RuleResult {
  if (maxBudget === undefined) {
    return { passed: true };
  }

  const passed = estimatedCost <= maxBudget;
  return {
    passed,
    message: passed
      ? undefined
      : `Estimated cost ${String(estimatedCost)} exceeds budget ${String(maxBudget)}`,
  };
}

/**
 * Privacy rule: Validate context does not contain sensitive information
 */
export function privacyRule(contextSections: string[], sensitivePatterns: string[]): RuleResult {
  for (const section of contextSections) {
    for (const pattern of sensitivePatterns) {
      if (section.toLowerCase().includes(pattern.toLowerCase())) {
        return {
          passed: false,
          message: `Context contains sensitive pattern: ${pattern}`,
        };
      }
    }
  }
  return { passed: true };
}

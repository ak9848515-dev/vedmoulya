// ──────────────────────────────────────────────────────────────────
// VedMoulya — AI Domain Service
// Domain logic for AI request validation and orchestration rules
// ARC-005 — AI Orchestration
// ──────────────────────────────────────────────────────────────────

import { BaseService } from '@vedmoulya/core';
import type { AIRequest } from '../entities/AIRequest.js';
import type { CapabilityType, QualityTier, FailureReason } from '../../types/index.js';

export class AIDomainService extends BaseService {
  constructor() {
    super('ai-domain');
  }

  /**
   * Validate that a capability is supported
   */
  validateCapability(capability: CapabilityType): boolean {
    const validCapabilities: CapabilityType[] = [
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
    return validCapabilities.includes(capability);
  }

  /**
   * Determine if a quality tier is appropriate for a given capability
   */
  validateQualityTier(capability: CapabilityType, tier: QualityTier): boolean {
    // Premium tier is always valid
    if (tier === 'premium') return true;

    // Economy/free tiers not valid for critical capabilities
    const criticalCapabilities: CapabilityType[] = ['reasoning', 'coding'];
    if ((tier === 'economy' || tier === 'free') && criticalCapabilities.includes(capability)) {
      return false;
    }

    return true;
  }

  /**
   * Determine if a failure is retryable
   */
  isRetryableFailure(reason: FailureReason): boolean {
    const retryable: FailureReason[] = ['timeout', 'rate_limited', 'provider_unavailable'];
    return retryable.includes(reason);
  }

  /**
   * Calculate exponential backoff delay
   */
  calculateBackoff(attempt: number, baseDelayMs: number = 1000): number {
    return Math.min(baseDelayMs * Math.pow(2, attempt - 1), 30000);
  }

  /**
   * Validate request constraints
   */
  validateConstraints(request: AIRequest): string[] {
    const errors: string[] = [];

    if (request.qualityTier === 'free' && request.capability.type === 'reasoning') {
      errors.push('Free tier does not support reasoning capability');
    }

    return errors;
  }

  /**
   * Determine if provider switching is needed based on failure pattern
   */
  shouldSwitchProvider(request: AIRequest): boolean {
    if (!request.failureReason) return false;
    if (!this.isRetryableFailure(request.failureReason)) return true;
    return request.attempts >= 3;
  }
}

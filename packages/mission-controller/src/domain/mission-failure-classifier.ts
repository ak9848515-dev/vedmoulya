// Deterministic failure classification for mission objectives
import type { MissionFailureClassification, ProviderStatus } from '../types/mission-types.js';

export function classifyFailure(
  error: string,
  executionResult: { failureClass?: string; usage: unknown },
  providerStatus: ProviderStatus,
): MissionFailureClassification {
  const lowerError = error.toLowerCase();

  // Provider transient failures
  if (lowerError.includes('provider') && lowerError.includes('unavailable')) {
    const alternateAvailable = providerStatus.capableProviders.length > 1;
    return {
      failureClass: 'TRANSIENT_PROVIDER',
      recoverable: alternateAvailable,
      reason: 'Provider temporarily unavailable',
      suggestedAction: alternateAvailable ? 'ALTERNATE_PROVIDER' : 'WAIT',
      evidence: [error],
    };
  }

  if (lowerError.includes('timeout') || lowerError.includes('network')) {
    return {
      failureClass: 'TRANSIENT_NETWORK',
      recoverable: true,
      reason: 'Network/timeout error — transient',
      suggestedAction: 'RETRY',
      evidence: [error],
    };
  }

  // Tool failures
  if (lowerError.includes('tool') && lowerError.includes('fail')) {
    return {
      failureClass: 'TRANSIENT_TOOL',
      recoverable: true,
      reason: 'Tool execution failed — may succeed on retry',
      suggestedAction: 'RETRY',
      evidence: [error],
    };
  }

  // Permission denials — never retry
  if (
    lowerError.includes('permission') ||
    lowerError.includes('denied') ||
    lowerError.includes('unauthorized')
  ) {
    return {
      failureClass: 'PERMISSION_DENIED',
      recoverable: false,
      reason: 'Permission denied — cannot be resolved by retrying',
      suggestedAction: 'BLOCK',
      evidence: [error],
    };
  }

  // Capability unavailable
  if (lowerError.includes('capability') && lowerError.includes('unavailable')) {
    return {
      failureClass: 'CAPABILITY_UNAVAILABLE',
      recoverable: false,
      reason: 'Required capability is not available',
      suggestedAction: 'BLOCK',
      evidence: [error],
    };
  }

  // Budget exhaustion
  if (
    lowerError.includes('budget') ||
    lowerError.includes('cost') ||
    lowerError.includes('token limit')
  ) {
    return {
      failureClass: 'BUDGET_EXHAUSTION',
      recoverable: false,
      reason: 'Budget exhausted — cannot continue',
      suggestedAction: 'FAIL',
      evidence: [error],
    };
  }

  // Verification failures — may be recoverable through replan
  if (lowerError.includes('verification') || lowerError.includes('verify')) {
    return {
      failureClass: 'VERIFICATION_FAILURE',
      recoverable: true,
      reason: 'Verification failed — objective may need revision',
      suggestedAction: 'REVISE_OBJECTIVE',
      evidence: [error],
    };
  }

  // Default: transient, retry once
  return {
    failureClass: 'TRANSIENT_PROVIDER',
    recoverable: true,
    reason: `Unclassified error: ${error}`,
    suggestedAction: 'RETRY',
    evidence: [error],
  };
}

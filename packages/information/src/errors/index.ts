// ──────────────────────────────────────────────────────────────────
// VedMoulya — Information Errors
// Domain errors for information model violations
// ──────────────────────────────────────────────────────────────────

import { DomainError } from '@vedmoulya/core';

/** Thrown when information fails classification validation */
export class ClassificationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(`Classification error: ${message}`, details);
  }
}

/** Thrown when an invalid lifecycle transition is attempted */
export class LifecycleTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super(`Cannot transition from '${from}' to '${to}'`, { from, to });
  }
}

/** Thrown when information quality is below threshold */
export class QualityThresholdError extends DomainError {
  constructor(field: string, value: number, threshold: number) {
    super(`Quality check failed for '${field}': ${String(value)} < ${String(threshold)}`, {
      field,
      value,
      threshold,
    });
  }
}

/** Thrown when consent is missing for PII processing */
export class ConsentRequiredError extends DomainError {
  constructor(informationType: string) {
    super(`Consent required for processing: ${informationType}`, { informationType });
  }
}

/** Thrown when a required validation rule fails */
export class ValidationRuleError extends DomainError {
  constructor(field: string, rule: string, message: string) {
    super(`Validation failed: ${message}`, { field, rule });
  }
}

// ──────────────────────────────────────────────────────────────────
// VedMoulya — Information Utilities
// Helper functions for information lifecycle, classification, and quality
// ──────────────────────────────────────────────────────────────────

import type {
  ClassificationLevel,
  IdentityInformationType,
  InformationLifecycleStage,
} from '../types/index.js';
import {
  VALID_LIFECYCLE_TRANSITIONS,
  CLASSIFICATION_LEVEL_ORDER,
  PII_INFORMATION_TYPES,
} from '../constants/index.js';

/** Check if a lifecycle transition is valid */
export function canTransition(
  from: InformationLifecycleStage,
  to: InformationLifecycleStage,
): boolean {
  return VALID_LIFECYCLE_TRANSITIONS[from].includes(to);
}

/** Check if a classification level is at least as restrictive as another */
export function isAtLeast(level: ClassificationLevel, minimum: ClassificationLevel): boolean {
  return CLASSIFICATION_LEVEL_ORDER[level] >= CLASSIFICATION_LEVEL_ORDER[minimum];
}

/** Check if an information type is considered PII */
export function isPiiType(informationType: IdentityInformationType): boolean {
  return PII_INFORMATION_TYPES.includes(informationType);
}

/** Calculate a simple completeness score based on filled fields */
export function calculateCompleteness(
  data: Record<string, unknown>,
  requiredFields: string[],
): number {
  if (requiredFields.length === 0) return 100;
  const fields = requiredFields;
  const filled = fields.filter((f) => data[f] !== undefined && data[f] !== null && data[f] !== '');
  return Math.round((filled.length / requiredFields.length) * 100);
}

/** Calculate timeliness in ms since last update */
export function calculateTimeliness(updatedAt: Date): number {
  return Date.now() - updatedAt.getTime();
}

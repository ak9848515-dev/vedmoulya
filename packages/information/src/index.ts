// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/information
// Information architecture — BLD-004 Identity Information Model
// ──────────────────────────────────────────────────────────────────

export const name = 'information' as const;

// ── Types ─────────────────────────────────────────────────────────────────
export type {
  Ownership,
  Provenance,
  Classification,
  ClassificationLevel,
  ValidationRule,
  ValidationResult,
  InformationLifecycleStage,
  LifecycleEvent,
  Lifecycle,
  QualityMetadata,
  IdentityInformation,
  IdentityInformationType,
} from './types/index.js';

export { createIdentityInformation } from './types/index.js';

// ── Constants ─────────────────────────────────────────────────────────────
export {
  CLASSIFICATION_LEVELS,
  CLASSIFICATION_LEVEL_ORDER,
  PII_INFORMATION_TYPES,
  LIFECYCLE_STAGES,
  VALID_LIFECYCLE_TRANSITIONS,
  DEFAULT_RETENTION_DAYS,
  PROVENANCE_WEIGHT,
  REQUIRED_CONSENT_TYPES,
} from './constants/index.js';

// ── Errors ────────────────────────────────────────────────────────────────
export {
  ClassificationError,
  LifecycleTransitionError,
  QualityThresholdError,
  ConsentRequiredError,
  ValidationRuleError,
} from './errors/index.js';

// ── Utilities ─────────────────────────────────────────────────────────────
export {
  canTransition,
  isAtLeast,
  isPiiType,
  calculateCompleteness,
  calculateTimeliness,
} from './utils/index.js';

// ── Module ────────────────────────────────────────────────────────────────
export { informationModule } from './modules/index.js';

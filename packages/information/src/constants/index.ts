// ──────────────────────────────────────────────────────────────────
// VedMoulya — Information Constants
// Classification, lifecycle, and governance constants
// ──────────────────────────────────────────────────────────────────

import type {
  ClassificationLevel,
  IdentityInformationType,
  InformationLifecycleStage,
} from '../types/index.js';

// ── Classification ─────────────────────────────────────────────────────────

export const CLASSIFICATION_LEVELS: ClassificationLevel[] = [
  'public',
  'internal',
  'sensitive',
  'confidential',
  'restricted',
];

export const CLASSIFICATION_LEVEL_ORDER: Record<ClassificationLevel, number> = {
  public: 0,
  internal: 1,
  sensitive: 2,
  confidential: 3,
  restricted: 4,
};

export const PII_INFORMATION_TYPES: IdentityInformationType[] = [
  'user_profile',
  'user_identity',
  'user_credentials',
  'consent_record',
];

// ── Lifecycle ─────────────────────────────────────────────────────────────

export const LIFECYCLE_STAGES: InformationLifecycleStage[] = [
  'captured',
  'active',
  'archived',
  'purged',
  'errored',
];

export const VALID_LIFECYCLE_TRANSITIONS: Record<
  InformationLifecycleStage,
  InformationLifecycleStage[]
> = {
  captured: ['active', 'errored'],
  active: ['archived', 'errored'],
  archived: ['active', 'purged'],
  purged: [],
  errored: ['captured', 'active', 'archived'],
};

// ── Retention ─────────────────────────────────────────────────────────────

export const DEFAULT_RETENTION_DAYS: Record<IdentityInformationType, number> = {
  user_profile: 730, // 2 years
  user_preferences: 730, // 2 years
  user_settings: 730, // 2 years
  user_credentials: 365, // 1 year after last change
  user_identity: 730, // 2 years
  authentication_log: 90, // 90 days
  authorization_policy: 365, // 1 year
  consent_record: 3650, // 10 years (regulatory)
  audit_trail: 2555, // 7 years (regulatory)
};

// ── Provenance ────────────────────────────────────────────────────────────

export const PROVENANCE_WEIGHT: Record<string, number> = {
  user_input: 100,
  system_generated: 90,
  derived: 70,
  imported: 50,
  third_party: 30,
};

// ── Regulatory ────────────────────────────────────────────────────────────

export const REQUIRED_CONSENT_TYPES = [
  'data_processing',
  'marketing',
  'analytics',
  'third_party_sharing',
  'profile_visibility',
] as const;

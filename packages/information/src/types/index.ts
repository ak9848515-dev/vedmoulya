// ──────────────────────────────────────────────────────────────────
// VedMoulya — Information Types
// Information architecture types for data classification, lifecycle,
// lineage, and governance — BLD-004 Identity Information Model
// ──────────────────────────────────────────────────────────────────

// ── Ownership ─────────────────────────────────────────────────────────────

/** Ownership chain for an information item */
export interface Ownership {
  /** The user or system that created/owns this information */
  ownerId: string;
  /** The bounded context that is the authoritative source */
  sourceContext: string;
  /** Users/groups with steward responsibilities */
  stewards: string[];
  /** The original data source (user input, system-generated, derived, imported) */
  provenance: Provenance;
}

export type Provenance = 'user_input' | 'system_generated' | 'derived' | 'imported' | 'third_party';

// ── Classification ────────────────────────────────────────────────────────

/** Data sensitivity classification */
export type ClassificationLevel =
  'public' | 'internal' | 'sensitive' | 'confidential' | 'restricted';

export interface Classification {
  level: ClassificationLevel;
  /** GDPR, CCPA, HIPAA, etc. */
  regulatoryTags: string[];
  /** Whether this information is personally identifiable */
  isPii: boolean;
  /** Whether this requires consent for processing */
  requiresConsent: boolean;
}

// ── Validation ────────────────────────────────────────────────────────────

export interface ValidationRule {
  field: string;
  rule: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  rules: ValidationRule[];
  validatedAt: Date;
}

// ── Lifecycle ─────────────────────────────────────────────────────────────

export type InformationLifecycleStage =
  | 'captured' // Information first recorded
  | 'active' // Currently in use
  | 'archived' // Stored but not active
  | 'purged' // Deleted per retention policy
  | 'errored'; // Failed validation or processing

export interface LifecycleEvent {
  stage: InformationLifecycleStage;
  timestamp: Date;
  triggeredBy: string;
  reason: string;
}

export interface Lifecycle {
  currentStage: InformationLifecycleStage;
  history: LifecycleEvent[];
  createdAt: Date;
  updatedAt: Date;
  /** Retention period in days (0 = indefinite) */
  retentionDays: number;
  /** When this information should be purged */
  purgeAt?: Date;
}

// ── Quality Metadata ──────────────────────────────────────────────────────

export interface QualityMetadata {
  /** Completeness score 0-100 */
  completeness: number;
  /** Accuracy score 0-100 */
  accuracy: number;
  /** Timeliness in milliseconds since last update */
  timelinessMs: number;
  /** Confidence score 0-100 (for derived/inferred data) */
  confidence: number;
  /** Schema version this data conforms to */
  schemaVersion: string;
}

// ── Identity Information Type ─────────────────────────────────────────────

/** Core information type for all Identity bounded context data */
export interface IdentityInformation {
  /** Unique identifier for this information instance */
  id: string;
  /** The type of identity information */
  informationType: IdentityInformationType;
  ownership: Ownership;
  classification: Classification;
  validation: ValidationResult;
  lifecycle: Lifecycle;
  quality: QualityMetadata;
  /** The actual data payload */
  data: Record<string, unknown>;
}

export type IdentityInformationType =
  | 'user_profile'
  | 'user_preferences'
  | 'user_settings'
  | 'user_credentials'
  | 'user_identity'
  | 'authentication_log'
  | 'authorization_policy'
  | 'consent_record'
  | 'audit_trail';

// ── Factory ───────────────────────────────────────────────────────────────

export function createIdentityInformation(props: {
  informationType: IdentityInformationType;
  ownerId: string;
  sourceContext: string;
  data: Record<string, unknown>;
  classificationLevel?: ClassificationLevel;
  isPii?: boolean;
  provenance?: Provenance;
}): IdentityInformation {
  return {
    id: crypto.randomUUID(),
    informationType: props.informationType,
    ownership: {
      ownerId: props.ownerId,
      sourceContext: props.sourceContext,
      stewards: [props.ownerId],
      provenance: props.provenance ?? 'system_generated',
    },
    classification: {
      level: props.classificationLevel ?? 'internal',
      regulatoryTags: props.isPii ? ['gdpr'] : [],
      isPii: props.isPii ?? false,
      requiresConsent: props.isPii ?? false,
    },
    validation: {
      valid: true,
      rules: [],
      validatedAt: new Date(),
    },
    lifecycle: {
      currentStage: 'active',
      history: [
        {
          stage: 'captured',
          timestamp: new Date(),
          triggeredBy: props.ownerId,
          reason: 'Information captured',
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      retentionDays: props.isPii ? 730 : 365, // 2 years for PII, 1 year otherwise
    },
    quality: {
      completeness: 100,
      accuracy: 100,
      timelinessMs: 0,
      confidence: 100,
      schemaVersion: '1.0.0',
    },
    data: props.data,
  };
}

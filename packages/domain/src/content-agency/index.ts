// ──────────────────────────────────────────────────────────────────
// VedMoulya — Content Agency Domain
// EPIC-003 / SPRINT AC-001 — AI Content Agency Foundation
// ──────────────────────────────────────────────────────────────────

export type {
  ContentType,
  ContentStatus,
  WorkflowStage,
  ReviewDecision,
  ClientRecord,
  BrandRecord,
  ProjectRecord,
  ContentVersionRecord,
  ContentReviewRecord,
  ContentAIMetadata,
  ContentItemRecord,
  InvoiceRecord,
} from './types.js';

export type { ContentAgencyRepository } from './repository/ContentAgencyRepository.js';

// ── Client Operations (EPIC-003/AC-002) ────────────────────────────────────

export type {
  LeadStatus,
  LeadRecord,
  InteractionType,
  LeadInteractionRecord,
  LeadTaskRecord,
  LeadContactRecord,
  ProposalStatus,
  ProposalPricingLine,
  ProposalContentRecord,
  ProposalVersionRecord,
  ProposalRecord,
  ContractStatus,
  ContractVersionRecord,
  ContractApprovalRecord,
  ContractRecord,
  QuotationStatus,
  QuotationPackageRecord,
  QuotationRecord,
  PaymentRecord,
  DocumentKind,
  DocumentVersionRecord,
  DocumentRecord,
  PortalAccessRecord,
  OpsNotificationType,
  OpsNotificationAudience,
  OpsNotificationRecord,
} from './ops-types.js';

export type { ClientOpsRepository } from './repository/ClientOpsRepository.js';

// ── Payment money & evidence (MISSION 002 — revenue safety hardening) ──────
export {
  MONEY_MINOR_SCALE,
  MONEY_MINOR_MAX,
  toMinorUnits,
  fromMinorUnits,
  formatMinorUnits,
  normalizeCurrency,
  isValidCurrency,
  MANUAL_PAYMENT_METHODS,
  isManualPaymentMethod,
  validatePaymentEvidence,
  validateReviewerIdentity,
  resolveIdempotencyKey,
  paymentDetailsFingerprint,
  IDEMPOTENCY_KEY_MAX,
} from './payments.js';
export type {
  PaymentEvidence,
  PaymentEvidenceKind,
  PaymentStatus,
  ValidatedPaymentEvidence,
  EvidenceValidation,
  MinorUnitResult,
  IdempotencyKeyResult,
} from './payments.js';

export { settlementRecordFromPayment, isSamePaymentDetails } from './payment-settlement.js';

export type {
  PaymentSettlementPort,
  PaymentSettlementCommand,
  PaymentVerificationCommand,
  PaymentSettlementResult,
  PaymentSettlementSuccess,
  PaymentSettlementFailure,
  PaymentSettlementFailureCode,
  PaymentSettlementRecord,
} from './payment-settlement.js';

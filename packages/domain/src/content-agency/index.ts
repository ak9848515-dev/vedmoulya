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

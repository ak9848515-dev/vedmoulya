// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/content-agency
// AI Content Agency Service — Domain Infrastructure
// EPIC-003 / SPRINT AC-001 — AI Content Agency Foundation
// ──────────────────────────────────────────────────────────────────

export const serviceName = 'content-agency' as const;

// ── Schema ─────────────────────────────────────────────────────────────────
export {
  contentAgencyClients,
  contentAgencyBrands,
  contentAgencyProjects,
  contentAgencyContent,
  contentAgencyInvoices,
  clientOpsLeads,
  clientOpsLeadInteractions,
  clientOpsLeadTasks,
  clientOpsLeadContacts,
  clientOpsProposals,
  clientOpsContracts,
  clientOpsQuotations,
  clientOpsPayments,
  clientOpsDocuments,
  clientOpsPortalAccess,
  clientOpsNotifications,
} from './schema/content-agency.js';
export type {
  ContentAgencyClientRow,
  ContentAgencyBrandRow,
  ContentAgencyProjectRow,
  ContentAgencyContentRow,
  ContentAgencyInvoiceRow,
  ClientOpsLeadRow,
  NewClientOpsLeadRow,
  ClientOpsInteractionRow,
  ClientOpsTaskRow,
  ClientOpsContactRow,
  ClientOpsProposalRow,
  NewClientOpsProposalRow,
  ClientOpsContractRow,
  NewClientOpsContractRow,
  ClientOpsQuotationRow,
  NewClientOpsQuotationRow,
  ClientOpsPaymentRow,
  NewClientOpsPaymentRow,
  ClientOpsDocumentRow,
  NewClientOpsDocumentRow,
  ClientOpsPortalAccessRow,
  NewClientOpsPortalAccessRow,
  ClientOpsNotificationRow,
  NewClientOpsNotificationRow,
} from './schema/types.js';

// ── Infrastructure — Persistence ───────────────────────────────────────────
export { PostgresContentAgencyRepository } from './infrastructure/persistence/PostgresContentAgencyRepository.js';
export { PostgresClientOpsRepository } from './infrastructure/persistence/PostgresClientOpsRepository.js';
export {
  initializeDatabase,
  closeDatabase,
  getDatabase,
} from './infrastructure/persistence/DatabaseConnection.js';

// ── Infrastructure — DI ────────────────────────────────────────────────────
export {
  registerContentAgencyServices,
  contentAgencyModule,
} from './infrastructure/di/ContentAgencyModule.js';

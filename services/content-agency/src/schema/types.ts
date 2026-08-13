// ──────────────────────────────────────────────────────────────────
// VedMoulya — Content Agency Schema Row Types
// EPIC-003 / SPRINT AC-001 — AI Content Agency Foundation
// ──────────────────────────────────────────────────────────────────

import type {
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
} from './content-agency.js';

export type ContentAgencyClientRow = typeof contentAgencyClients.$inferSelect;
export type NewContentAgencyClientRow = typeof contentAgencyClients.$inferInsert;

export type ContentAgencyBrandRow = typeof contentAgencyBrands.$inferSelect;
export type NewContentAgencyBrandRow = typeof contentAgencyBrands.$inferInsert;

export type ContentAgencyProjectRow = typeof contentAgencyProjects.$inferSelect;
export type NewContentAgencyProjectRow = typeof contentAgencyProjects.$inferInsert;

export type ContentAgencyContentRow = typeof contentAgencyContent.$inferSelect;
export type NewContentAgencyContentRow = typeof contentAgencyContent.$inferInsert;

export type ContentAgencyInvoiceRow = typeof contentAgencyInvoices.$inferSelect;
export type NewContentAgencyInvoiceRow = typeof contentAgencyInvoices.$inferInsert;

// ── Client Operations (EPIC-003 / AC-002) ───────────────────────────────────

export type ClientOpsLeadRow = typeof clientOpsLeads.$inferSelect;
export type NewClientOpsLeadRow = typeof clientOpsLeads.$inferInsert;

export type ClientOpsInteractionRow = typeof clientOpsLeadInteractions.$inferSelect;
export type ClientOpsTaskRow = typeof clientOpsLeadTasks.$inferSelect;
export type ClientOpsContactRow = typeof clientOpsLeadContacts.$inferSelect;

export type ClientOpsProposalRow = typeof clientOpsProposals.$inferSelect;
export type NewClientOpsProposalRow = typeof clientOpsProposals.$inferInsert;

export type ClientOpsContractRow = typeof clientOpsContracts.$inferSelect;
export type NewClientOpsContractRow = typeof clientOpsContracts.$inferInsert;

export type ClientOpsQuotationRow = typeof clientOpsQuotations.$inferSelect;
export type NewClientOpsQuotationRow = typeof clientOpsQuotations.$inferInsert;

export type ClientOpsPaymentRow = typeof clientOpsPayments.$inferSelect;
export type NewClientOpsPaymentRow = typeof clientOpsPayments.$inferInsert;

export type ClientOpsDocumentRow = typeof clientOpsDocuments.$inferSelect;
export type NewClientOpsDocumentRow = typeof clientOpsDocuments.$inferInsert;

export type ClientOpsPortalAccessRow = typeof clientOpsPortalAccess.$inferSelect;
export type NewClientOpsPortalAccessRow = typeof clientOpsPortalAccess.$inferInsert;

export type ClientOpsNotificationRow = typeof clientOpsNotifications.$inferSelect;
export type NewClientOpsNotificationRow = typeof clientOpsNotifications.$inferInsert;

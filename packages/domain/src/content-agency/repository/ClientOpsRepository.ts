// ──────────────────────────────────────────────────────────────────
// VedMoulya — Client Operations Repository Interface
// EPIC-003 / SPRINT AC-002 — Client Operations & Revenue Engine
// Contract for AC-002 persistence. Implemented by
// PostgresClientOpsRepository (production) and
// InMemoryClientOpsRepository (tests / dev).
// ──────────────────────────────────────────────────────────────────

import type {
  LeadRecord,
  LeadInteractionRecord,
  LeadTaskRecord,
  LeadContactRecord,
  ProposalRecord,
  ContractRecord,
  QuotationRecord,
  PaymentRecord,
  DocumentRecord,
  PortalAccessRecord,
  OpsNotificationRecord,
  OpsNotificationAudience,
} from '../ops-types.js';

export interface ClientOpsRepository {
  // ── Leads ───────────────────────────────────────────────────────────────
  listLeads(userId: string): Promise<LeadRecord[]>;
  findLeadById(id: string, userId: string): Promise<LeadRecord | null>;
  saveLead(lead: LeadRecord): Promise<void>;

  // ── Lead interactions ───────────────────────────────────────────────────
  listInteractions(leadId: string, userId: string): Promise<LeadInteractionRecord[]>;
  saveInteraction(interaction: LeadInteractionRecord): Promise<void>;

  // ── Lead tasks ──────────────────────────────────────────────────────────
  listTasks(leadId: string, userId: string): Promise<LeadTaskRecord[]>;
  saveTask(task: LeadTaskRecord): Promise<void>;

  // ── Lead contacts ───────────────────────────────────────────────────────
  listContacts(leadId: string, userId: string): Promise<LeadContactRecord[]>;
  saveContact(contact: LeadContactRecord): Promise<void>;
  deleteContact(id: string, userId: string): Promise<void>;

  // ── Proposals ───────────────────────────────────────────────────────────
  listProposals(userId: string): Promise<ProposalRecord[]>;
  findProposalById(id: string, userId: string): Promise<ProposalRecord | null>;
  saveProposal(proposal: ProposalRecord): Promise<void>;
  deleteProposal(id: string, userId: string): Promise<void>;

  // ── Contracts ───────────────────────────────────────────────────────────
  listContracts(userId: string): Promise<ContractRecord[]>;
  findContractById(id: string, userId: string): Promise<ContractRecord | null>;
  saveContract(contract: ContractRecord): Promise<void>;
  deleteContract(id: string, userId: string): Promise<void>;

  // ── Quotations ──────────────────────────────────────────────────────────
  listQuotations(userId: string): Promise<QuotationRecord[]>;
  findQuotationById(id: string, userId: string): Promise<QuotationRecord | null>;
  saveQuotation(quotation: QuotationRecord): Promise<void>;
  deleteQuotation(id: string, userId: string): Promise<void>;

  // ── Payments ────────────────────────────────────────────────────────────
  listPayments(userId: string): Promise<PaymentRecord[]>;
  listPaymentsByInvoice(invoiceId: string, userId: string): Promise<PaymentRecord[]>;
  savePayment(payment: PaymentRecord): Promise<void>;

  // ── Documents ───────────────────────────────────────────────────────────
  listDocuments(userId: string): Promise<DocumentRecord[]>;
  findDocumentById(id: string, userId: string): Promise<DocumentRecord | null>;
  saveDocument(document: DocumentRecord): Promise<void>;
  deleteDocument(id: string, userId: string): Promise<void>;

  // ── Portal access ───────────────────────────────────────────────────────
  listPortalAccess(userId: string): Promise<PortalAccessRecord[]>;
  findPortalAccessByTokenHash(tokenHash: string): Promise<PortalAccessRecord | null>;
  savePortalAccess(access: PortalAccessRecord): Promise<void>;
  deletePortalAccess(id: string, userId: string): Promise<void>;

  // ── Notifications ───────────────────────────────────────────────────────
  listNotifications(
    userId: string,
    audience: OpsNotificationAudience,
  ): Promise<OpsNotificationRecord[]>;
  saveNotification(notification: OpsNotificationRecord): Promise<void>;
}

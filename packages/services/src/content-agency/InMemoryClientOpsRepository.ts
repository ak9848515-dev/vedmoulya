// ──────────────────────────────────────────────────────────────────
// VedMoulya — In-Memory Client Operations Repository
// EPIC-003 / SPRINT AC-002 — Client Operations & Revenue Engine
// Map-backed implementation of the ClientOpsRepository contract.
// Used by unit tests and dev; the production path uses
// PostgresClientOpsRepository (same interface).
// ──────────────────────────────────────────────────────────────────

import type { ClientOpsRepository } from '@vedmoulya/domain';
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
} from '@vedmoulya/domain';

export class InMemoryClientOpsRepository implements ClientOpsRepository {
  private readonly leads = new Map<string, LeadRecord>();
  private readonly interactions = new Map<string, LeadInteractionRecord>();
  private readonly tasks = new Map<string, LeadTaskRecord>();
  private readonly contacts = new Map<string, LeadContactRecord>();
  private readonly proposals = new Map<string, ProposalRecord>();
  private readonly contracts = new Map<string, ContractRecord>();
  private readonly quotations = new Map<string, QuotationRecord>();
  private readonly payments = new Map<string, PaymentRecord>();
  private readonly documents = new Map<string, DocumentRecord>();
  private readonly portalAccess = new Map<string, PortalAccessRecord>();
  private readonly notifications = new Map<string, OpsNotificationRecord>();

  // ── Leads ─────────────────────────────────────────────────────────────

  async listLeads(userId: string): Promise<LeadRecord[]> {
    return [...this.leads.values()].filter((l) => l.userId === userId);
  }

  async findLeadById(id: string, userId: string): Promise<LeadRecord | null> {
    const lead = this.leads.get(id);
    return lead && lead.userId === userId ? lead : null;
  }

  async saveLead(lead: LeadRecord): Promise<void> {
    this.leads.set(lead.id, { ...lead });
  }

  // ── Interactions ───────────────────────────────────────────────────────

  async listInteractions(leadId: string, userId: string): Promise<LeadInteractionRecord[]> {
    return [...this.interactions.values()].filter(
      (i) => i.leadId === leadId && i.userId === userId,
    );
  }

  async saveInteraction(interaction: LeadInteractionRecord): Promise<void> {
    this.interactions.set(interaction.id, { ...interaction });
  }

  // ── Tasks ──────────────────────────────────────────────────────────────

  async listTasks(leadId: string, userId: string): Promise<LeadTaskRecord[]> {
    return [...this.tasks.values()].filter((t) => t.leadId === leadId && t.userId === userId);
  }

  async saveTask(task: LeadTaskRecord): Promise<void> {
    this.tasks.set(task.id, { ...task });
  }

  // ── Contacts ───────────────────────────────────────────────────────────

  async listContacts(leadId: string, userId: string): Promise<LeadContactRecord[]> {
    return [...this.contacts.values()].filter((c) => c.leadId === leadId && c.userId === userId);
  }

  async saveContact(contact: LeadContactRecord): Promise<void> {
    this.contacts.set(contact.id, { ...contact });
  }

  async deleteContact(id: string, userId: string): Promise<void> {
    const existing = this.contacts.get(id);
    if (existing && existing.userId === userId) this.contacts.delete(id);
  }

  // ── Proposals ──────────────────────────────────────────────────────────

  async listProposals(userId: string): Promise<ProposalRecord[]> {
    return [...this.proposals.values()].filter((p) => p.userId === userId);
  }

  async findProposalById(id: string, userId: string): Promise<ProposalRecord | null> {
    const proposal = this.proposals.get(id);
    return proposal && proposal.userId === userId ? proposal : null;
  }

  async saveProposal(proposal: ProposalRecord): Promise<void> {
    this.proposals.set(proposal.id, { ...proposal });
  }

  async deleteProposal(id: string, userId: string): Promise<void> {
    const existing = this.proposals.get(id);
    if (existing && existing.userId === userId) this.proposals.delete(id);
  }

  // ── Contracts ──────────────────────────────────────────────────────────

  async listContracts(userId: string): Promise<ContractRecord[]> {
    return [...this.contracts.values()].filter((c) => c.userId === userId);
  }

  async findContractById(id: string, userId: string): Promise<ContractRecord | null> {
    const contract = this.contracts.get(id);
    return contract && contract.userId === userId ? contract : null;
  }

  async saveContract(contract: ContractRecord): Promise<void> {
    this.contracts.set(contract.id, { ...contract });
  }

  async deleteContract(id: string, userId: string): Promise<void> {
    const existing = this.contracts.get(id);
    if (existing && existing.userId === userId) this.contracts.delete(id);
  }

  // ── Quotations ─────────────────────────────────────────────────────────

  async listQuotations(userId: string): Promise<QuotationRecord[]> {
    return [...this.quotations.values()].filter((q) => q.userId === userId);
  }

  async findQuotationById(id: string, userId: string): Promise<QuotationRecord | null> {
    const quotation = this.quotations.get(id);
    return quotation && quotation.userId === userId ? quotation : null;
  }

  async saveQuotation(quotation: QuotationRecord): Promise<void> {
    this.quotations.set(quotation.id, { ...quotation });
  }

  async deleteQuotation(id: string, userId: string): Promise<void> {
    const existing = this.quotations.get(id);
    if (existing && existing.userId === userId) this.quotations.delete(id);
  }

  // ── Payments ───────────────────────────────────────────────────────────

  async listPayments(userId: string): Promise<PaymentRecord[]> {
    return [...this.payments.values()].filter((p) => p.userId === userId);
  }

  async listPaymentsByInvoice(invoiceId: string, userId: string): Promise<PaymentRecord[]> {
    return [...this.payments.values()].filter(
      (p) => p.invoiceId === invoiceId && p.userId === userId,
    );
  }

  async savePayment(payment: PaymentRecord): Promise<void> {
    this.payments.set(payment.id, { ...payment });
  }

  // ── Documents ──────────────────────────────────────────────────────────

  async listDocuments(userId: string): Promise<DocumentRecord[]> {
    return [...this.documents.values()].filter((d) => d.userId === userId);
  }

  async findDocumentById(id: string, userId: string): Promise<DocumentRecord | null> {
    const document = this.documents.get(id);
    return document && document.userId === userId ? document : null;
  }

  async saveDocument(document: DocumentRecord): Promise<void> {
    this.documents.set(document.id, { ...document });
  }

  async deleteDocument(id: string, userId: string): Promise<void> {
    const existing = this.documents.get(id);
    if (existing && existing.userId === userId) this.documents.delete(id);
  }

  // ── Portal access ──────────────────────────────────────────────────────

  async listPortalAccess(userId: string): Promise<PortalAccessRecord[]> {
    return [...this.portalAccess.values()].filter((a) => a.userId === userId);
  }

  async findPortalAccessByTokenHash(tokenHash: string): Promise<PortalAccessRecord | null> {
    for (const access of this.portalAccess.values()) {
      if (access.tokenHash === tokenHash) return access;
    }
    return null;
  }

  async savePortalAccess(access: PortalAccessRecord): Promise<void> {
    this.portalAccess.set(access.id, { ...access });
  }

  async deletePortalAccess(id: string, userId: string): Promise<void> {
    const existing = this.portalAccess.get(id);
    if (existing && existing.userId === userId) this.portalAccess.delete(id);
  }

  // ── Notifications ──────────────────────────────────────────────────────

  async listNotifications(
    userId: string,
    audience: OpsNotificationAudience,
  ): Promise<OpsNotificationRecord[]> {
    return [...this.notifications.values()].filter(
      (n) => n.userId === userId && n.audience === audience,
    );
  }

  async saveNotification(notification: OpsNotificationRecord): Promise<void> {
    this.notifications.set(notification.id, { ...notification });
  }
}

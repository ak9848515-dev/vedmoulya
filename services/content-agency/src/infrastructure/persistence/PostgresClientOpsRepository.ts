// ──────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Client Operations Repository
// Production persistence for the AC-002 bounded context
// EPIC-003 / SPRINT AC-002 — Client Operations & Revenue Engine
// ──────────────────────────────────────────────────────────────────

import { eq } from 'drizzle-orm';
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
import { getDatabase } from './DatabaseConnection.js';
import {
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
} from '../../schema/content-agency.js';

// Typed drizzle select rows — the mappers consume these instead of
// `Record<string, unknown>` so field nullability is exact and no
// stringification is needed at the call sites.
type LeadRow = typeof clientOpsLeads.$inferSelect;
type ProposalRow = typeof clientOpsProposals.$inferSelect;
type ContractRow = typeof clientOpsContracts.$inferSelect;
type QuotationRow = typeof clientOpsQuotations.$inferSelect;
type DocumentRow = typeof clientOpsDocuments.$inferSelect;

/** JSON-encode nested record fields for jsonb columns. */
const encode = (value: unknown): unknown => (value === undefined ? null : JSON.stringify(value));

/** JSON-decode jsonb columns back to their record shapes. */
function decode<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

const iso = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
};

const nullable = (value: string | null | undefined): string | null =>
  value === undefined ? null : value;

export class PostgresClientOpsRepository implements ClientOpsRepository {
  // ── Leads ─────────────────────────────────────────────────────────────

  async listLeads(userId: string): Promise<LeadRecord[]> {
    const rows = await getDatabase()
      .select()
      .from(clientOpsLeads)
      .where(eq(clientOpsLeads.userId, userId))
      .orderBy(clientOpsLeads.updatedAt);
    return rows.map((row) => this.mapLead(row));
  }

  async findLeadById(id: string, userId: string): Promise<LeadRecord | null> {
    const rows = await getDatabase()
      .select()
      .from(clientOpsLeads)
      .where(eq(clientOpsLeads.id, id))
      .limit(1);
    const first = rows[0];
    if (!first || first.userId !== userId) return null;
    return this.mapLead(first);
  }

  async saveLead(lead: LeadRecord): Promise<void> {
    const db = getDatabase();
    await db
      .insert(clientOpsLeads)
      .values({
        id: lead.id,
        userId: lead.userId,
        company: lead.company,
        contactName: lead.contactName,
        contactEmail: lead.contactEmail,
        contactPhone: lead.contactPhone,
        industry: lead.industry,
        source: lead.source,
        status: lead.status,
        archived: lead.archived,
        value: lead.value,
        currency: lead.currency,
        healthScore: lead.healthScore,
        nextFollowUp: nullable(lead.nextFollowUp),
        notes: lead.notes,
        clientId: nullable(lead.clientId),
        createdAt: new Date(lead.createdAt),
        updatedAt: new Date(lead.updatedAt),
      })
      .onConflictDoUpdate({
        target: clientOpsLeads.id,
        set: {
          company: lead.company,
          contactName: lead.contactName,
          contactEmail: lead.contactEmail,
          contactPhone: lead.contactPhone,
          industry: lead.industry,
          source: lead.source,
          status: lead.status,
          archived: lead.archived,
          value: lead.value,
          currency: lead.currency,
          healthScore: lead.healthScore,
          nextFollowUp: nullable(lead.nextFollowUp),
          notes: lead.notes,
          clientId: nullable(lead.clientId),
          updatedAt: new Date(lead.updatedAt),
        },
      });
  }

  // ── Interactions ───────────────────────────────────────────────────────

  async listInteractions(leadId: string, userId: string): Promise<LeadInteractionRecord[]> {
    const rows = await getDatabase()
      .select()
      .from(clientOpsLeadInteractions)
      .where(eq(clientOpsLeadInteractions.leadId, leadId))
      .orderBy(clientOpsLeadInteractions.createdAt);
    return rows
      .filter((row) => row.userId === userId)
      .map((row) => ({
        id: row.id,
        leadId: row.leadId,
        userId: row.userId,
        type: row.type as LeadInteractionRecord['type'],
        summary: row.summary,
        createdAt: iso(row.createdAt),
      }));
  }

  async saveInteraction(interaction: LeadInteractionRecord): Promise<void> {
    await getDatabase()
      .insert(clientOpsLeadInteractions)
      .values({
        id: interaction.id,
        leadId: interaction.leadId,
        userId: interaction.userId,
        type: interaction.type,
        summary: interaction.summary,
        createdAt: new Date(interaction.createdAt),
      })
      .onConflictDoUpdate({
        target: clientOpsLeadInteractions.id,
        set: { summary: interaction.summary, type: interaction.type },
      });
  }

  // ── Tasks ──────────────────────────────────────────────────────────────

  async listTasks(leadId: string, userId: string): Promise<LeadTaskRecord[]> {
    const rows = await getDatabase()
      .select()
      .from(clientOpsLeadTasks)
      .where(eq(clientOpsLeadTasks.leadId, leadId))
      .orderBy(clientOpsLeadTasks.createdAt);
    return rows
      .filter((row) => row.userId === userId)
      .map((row) => ({
        id: row.id,
        leadId: row.leadId,
        userId: row.userId,
        title: row.title,
        dueAt: row.dueAt,
        completed: row.completed,
        createdAt: iso(row.createdAt),
      }));
  }

  async saveTask(task: LeadTaskRecord): Promise<void> {
    await getDatabase()
      .insert(clientOpsLeadTasks)
      .values({
        id: task.id,
        leadId: task.leadId,
        userId: task.userId,
        title: task.title,
        dueAt: nullable(task.dueAt),
        completed: task.completed,
        createdAt: new Date(task.createdAt),
      })
      .onConflictDoUpdate({
        target: clientOpsLeadTasks.id,
        set: { title: task.title, dueAt: nullable(task.dueAt), completed: task.completed },
      });
  }

  // ── Contacts ───────────────────────────────────────────────────────────

  async listContacts(leadId: string, userId: string): Promise<LeadContactRecord[]> {
    const rows = await getDatabase()
      .select()
      .from(clientOpsLeadContacts)
      .where(eq(clientOpsLeadContacts.leadId, leadId))
      .orderBy(clientOpsLeadContacts.createdAt);
    return rows
      .filter((row) => row.userId === userId)
      .map((row) => ({
        id: row.id,
        leadId: row.leadId,
        userId: row.userId,
        name: row.name,
        email: row.email ?? '',
        phone: row.phone ?? '',
        role: row.role ?? '',
        isPrimary: row.isPrimary,
        createdAt: iso(row.createdAt),
      }));
  }

  async saveContact(contact: LeadContactRecord): Promise<void> {
    await getDatabase()
      .insert(clientOpsLeadContacts)
      .values({
        id: contact.id,
        leadId: contact.leadId,
        userId: contact.userId,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        role: contact.role,
        isPrimary: contact.isPrimary,
        createdAt: new Date(contact.createdAt),
      })
      .onConflictDoUpdate({
        target: clientOpsLeadContacts.id,
        set: {
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          role: contact.role,
          isPrimary: contact.isPrimary,
        },
      });
  }

  async deleteContact(id: string, userId: string): Promise<void> {
    const rows = await getDatabase()
      .select()
      .from(clientOpsLeadContacts)
      .where(eq(clientOpsLeadContacts.id, id))
      .limit(1);
    const first = rows[0];
    if (first && first.userId === userId) {
      await getDatabase().delete(clientOpsLeadContacts).where(eq(clientOpsLeadContacts.id, id));
    }
  }

  // ── Proposals ──────────────────────────────────────────────────────────

  async listProposals(userId: string): Promise<ProposalRecord[]> {
    const rows = await getDatabase()
      .select()
      .from(clientOpsProposals)
      .where(eq(clientOpsProposals.userId, userId))
      .orderBy(clientOpsProposals.updatedAt);
    return rows.map((row) => this.mapProposal(row));
  }

  async findProposalById(id: string, userId: string): Promise<ProposalRecord | null> {
    const rows = await getDatabase()
      .select()
      .from(clientOpsProposals)
      .where(eq(clientOpsProposals.id, id))
      .limit(1);
    const first = rows[0];
    if (!first || first.userId !== userId) return null;
    return this.mapProposal(first);
  }

  async saveProposal(proposal: ProposalRecord): Promise<void> {
    const db = getDatabase();
    await db
      .insert(clientOpsProposals)
      .values({
        id: proposal.id,
        userId: proposal.userId,
        title: proposal.title,
        status: proposal.status,
        leadId: nullable(proposal.leadId),
        clientId: nullable(proposal.clientId),
        currentVersion: proposal.currentVersion,
        versions: encode(proposal.versions),
        aiMetadata: proposal.aiMetadata ? encode(proposal.aiMetadata) : null,
        sentAt: nullable(proposal.sentAt),
        acceptedAt: nullable(proposal.acceptedAt),
        createdAt: new Date(proposal.createdAt),
        updatedAt: new Date(proposal.updatedAt),
      })
      .onConflictDoUpdate({
        target: clientOpsProposals.id,
        set: {
          title: proposal.title,
          status: proposal.status,
          leadId: nullable(proposal.leadId),
          clientId: nullable(proposal.clientId),
          currentVersion: proposal.currentVersion,
          versions: encode(proposal.versions),
          aiMetadata: proposal.aiMetadata ? encode(proposal.aiMetadata) : null,
          sentAt: nullable(proposal.sentAt),
          acceptedAt: nullable(proposal.acceptedAt),
          updatedAt: new Date(proposal.updatedAt),
        },
      });
  }

  async deleteProposal(id: string, userId: string): Promise<void> {
    const rows = await getDatabase()
      .select()
      .from(clientOpsProposals)
      .where(eq(clientOpsProposals.id, id))
      .limit(1);
    const first = rows[0];
    if (first && first.userId === userId) {
      await getDatabase().delete(clientOpsProposals).where(eq(clientOpsProposals.id, id));
    }
  }

  // ── Contracts ──────────────────────────────────────────────────────────

  async listContracts(userId: string): Promise<ContractRecord[]> {
    const rows = await getDatabase()
      .select()
      .from(clientOpsContracts)
      .where(eq(clientOpsContracts.userId, userId))
      .orderBy(clientOpsContracts.updatedAt);
    return rows.map((row) => this.mapContract(row));
  }

  async findContractById(id: string, userId: string): Promise<ContractRecord | null> {
    const rows = await getDatabase()
      .select()
      .from(clientOpsContracts)
      .where(eq(clientOpsContracts.id, id))
      .limit(1);
    const first = rows[0];
    if (!first || first.userId !== userId) return null;
    return this.mapContract(first);
  }

  async saveContract(contract: ContractRecord): Promise<void> {
    const db = getDatabase();
    await db
      .insert(clientOpsContracts)
      .values({
        id: contract.id,
        userId: contract.userId,
        clientId: contract.clientId,
        title: contract.title,
        startDate: contract.startDate,
        endDate: contract.endDate,
        value: contract.value,
        currency: contract.currency,
        status: contract.status,
        renewal: contract.renewal,
        autoRenew: contract.autoRenew,
        currentVersion: contract.currentVersion,
        versions: encode(contract.versions),
        approvals: encode(contract.approvals),
        createdAt: new Date(contract.createdAt),
        updatedAt: new Date(contract.updatedAt),
      })
      .onConflictDoUpdate({
        target: clientOpsContracts.id,
        set: {
          clientId: contract.clientId,
          title: contract.title,
          startDate: contract.startDate,
          endDate: contract.endDate,
          value: contract.value,
          currency: contract.currency,
          status: contract.status,
          renewal: contract.renewal,
          autoRenew: contract.autoRenew,
          currentVersion: contract.currentVersion,
          versions: encode(contract.versions),
          approvals: encode(contract.approvals),
          updatedAt: new Date(contract.updatedAt),
        },
      });
  }

  async deleteContract(id: string, userId: string): Promise<void> {
    const rows = await getDatabase()
      .select()
      .from(clientOpsContracts)
      .where(eq(clientOpsContracts.id, id))
      .limit(1);
    const first = rows[0];
    if (first && first.userId === userId) {
      await getDatabase().delete(clientOpsContracts).where(eq(clientOpsContracts.id, id));
    }
  }

  // ── Quotations ─────────────────────────────────────────────────────────

  async listQuotations(userId: string): Promise<QuotationRecord[]> {
    const rows = await getDatabase()
      .select()
      .from(clientOpsQuotations)
      .where(eq(clientOpsQuotations.userId, userId))
      .orderBy(clientOpsQuotations.updatedAt);
    return rows.map((row) => this.mapQuotation(row));
  }

  async findQuotationById(id: string, userId: string): Promise<QuotationRecord | null> {
    const rows = await getDatabase()
      .select()
      .from(clientOpsQuotations)
      .where(eq(clientOpsQuotations.id, id))
      .limit(1);
    const first = rows[0];
    if (!first || first.userId !== userId) return null;
    return this.mapQuotation(first);
  }

  async saveQuotation(quotation: QuotationRecord): Promise<void> {
    const db = getDatabase();
    await db
      .insert(clientOpsQuotations)
      .values({
        id: quotation.id,
        userId: quotation.userId,
        title: quotation.title,
        status: quotation.status,
        leadId: nullable(quotation.leadId),
        clientId: nullable(quotation.clientId),
        packages: encode(quotation.packages),
        discount: quotation.discount,
        taxRate: quotation.taxRate,
        recurring: quotation.recurring,
        currency: quotation.currency,
        subtotal: quotation.subtotal,
        total: quotation.total,
        sentAt: nullable(quotation.sentAt),
        createdAt: new Date(quotation.createdAt),
        updatedAt: new Date(quotation.updatedAt),
      })
      .onConflictDoUpdate({
        target: clientOpsQuotations.id,
        set: {
          title: quotation.title,
          status: quotation.status,
          leadId: nullable(quotation.leadId),
          clientId: nullable(quotation.clientId),
          packages: encode(quotation.packages),
          discount: quotation.discount,
          taxRate: quotation.taxRate,
          recurring: quotation.recurring,
          currency: quotation.currency,
          subtotal: quotation.subtotal,
          total: quotation.total,
          sentAt: nullable(quotation.sentAt),
          updatedAt: new Date(quotation.updatedAt),
        },
      });
  }

  async deleteQuotation(id: string, userId: string): Promise<void> {
    const rows = await getDatabase()
      .select()
      .from(clientOpsQuotations)
      .where(eq(clientOpsQuotations.id, id))
      .limit(1);
    const first = rows[0];
    if (first && first.userId === userId) {
      await getDatabase().delete(clientOpsQuotations).where(eq(clientOpsQuotations.id, id));
    }
  }

  // ── Payments ───────────────────────────────────────────────────────────

  async listPayments(userId: string): Promise<PaymentRecord[]> {
    const rows = await getDatabase()
      .select()
      .from(clientOpsPayments)
      .where(eq(clientOpsPayments.userId, userId))
      .orderBy(clientOpsPayments.createdAt);
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      invoiceId: row.invoiceId,
      clientId: row.clientId,
      amount: row.amount,
      currency: row.currency ?? 'USD',
      method: row.method ?? '',
      receivedAt: row.receivedAt,
      note: row.note ?? '',
      createdAt: iso(row.createdAt),
    }));
  }

  async listPaymentsByInvoice(invoiceId: string, userId: string): Promise<PaymentRecord[]> {
    const rows = await getDatabase()
      .select()
      .from(clientOpsPayments)
      .where(eq(clientOpsPayments.invoiceId, invoiceId))
      .orderBy(clientOpsPayments.createdAt);
    return rows
      .filter((row) => row.userId === userId)
      .map((row) => ({
        id: row.id,
        userId: row.userId,
        invoiceId: row.invoiceId,
        clientId: row.clientId,
        amount: row.amount,
        currency: row.currency ?? 'USD',
        method: row.method ?? '',
        receivedAt: row.receivedAt,
        note: row.note ?? '',
        createdAt: iso(row.createdAt),
      }));
  }

  async savePayment(payment: PaymentRecord): Promise<void> {
    await getDatabase()
      .insert(clientOpsPayments)
      .values({
        id: payment.id,
        userId: payment.userId,
        invoiceId: payment.invoiceId,
        clientId: payment.clientId,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        receivedAt: payment.receivedAt,
        note: payment.note,
        createdAt: new Date(payment.createdAt),
      })
      .onConflictDoUpdate({
        target: clientOpsPayments.id,
        set: {
          amount: payment.amount,
          currency: payment.currency,
          method: payment.method,
          receivedAt: payment.receivedAt,
          note: payment.note,
        },
      });
  }

  // ── Documents ──────────────────────────────────────────────────────────

  async listDocuments(userId: string): Promise<DocumentRecord[]> {
    const rows = await getDatabase()
      .select()
      .from(clientOpsDocuments)
      .where(eq(clientOpsDocuments.userId, userId))
      .orderBy(clientOpsDocuments.updatedAt);
    return rows.map((row) => this.mapDocument(row));
  }

  async findDocumentById(id: string, userId: string): Promise<DocumentRecord | null> {
    const rows = await getDatabase()
      .select()
      .from(clientOpsDocuments)
      .where(eq(clientOpsDocuments.id, id))
      .limit(1);
    const first = rows[0];
    if (!first || first.userId !== userId) return null;
    return this.mapDocument(first);
  }

  async saveDocument(document: DocumentRecord): Promise<void> {
    const db = getDatabase();
    await db
      .insert(clientOpsDocuments)
      .values({
        id: document.id,
        userId: document.userId,
        clientId: document.clientId,
        projectId: nullable(document.projectId),
        contractId: nullable(document.contractId),
        name: document.name,
        kind: document.kind,
        mime: document.mime,
        size: document.size,
        storageKey: document.storageKey,
        metadata: encode(document.metadata),
        currentVersion: document.currentVersion,
        versions: encode(document.versions),
        createdAt: new Date(document.createdAt),
        updatedAt: new Date(document.updatedAt),
      })
      .onConflictDoUpdate({
        target: clientOpsDocuments.id,
        set: {
          clientId: document.clientId,
          projectId: nullable(document.projectId),
          contractId: nullable(document.contractId),
          name: document.name,
          kind: document.kind,
          mime: document.mime,
          size: document.size,
          storageKey: document.storageKey,
          metadata: encode(document.metadata),
          currentVersion: document.currentVersion,
          versions: encode(document.versions),
          updatedAt: new Date(document.updatedAt),
        },
      });
  }

  async deleteDocument(id: string, userId: string): Promise<void> {
    const rows = await getDatabase()
      .select()
      .from(clientOpsDocuments)
      .where(eq(clientOpsDocuments.id, id))
      .limit(1);
    const first = rows[0];
    if (first && first.userId === userId) {
      await getDatabase().delete(clientOpsDocuments).where(eq(clientOpsDocuments.id, id));
    }
  }

  // ── Portal access ──────────────────────────────────────────────────────

  async listPortalAccess(userId: string): Promise<PortalAccessRecord[]> {
    const rows = await getDatabase()
      .select()
      .from(clientOpsPortalAccess)
      .where(eq(clientOpsPortalAccess.userId, userId))
      .orderBy(clientOpsPortalAccess.createdAt);
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      clientId: row.clientId,
      email: row.email,
      tokenHash: row.tokenHash,
      enabled: row.enabled,
      lastLoginAt: row.lastLoginAt,
      createdAt: iso(row.createdAt),
    }));
  }

  async findPortalAccessByTokenHash(tokenHash: string): Promise<PortalAccessRecord | null> {
    const rows = await getDatabase()
      .select()
      .from(clientOpsPortalAccess)
      .where(eq(clientOpsPortalAccess.tokenHash, tokenHash))
      .limit(1);
    const first = rows[0];
    if (!first) return null;
    return {
      id: first.id,
      userId: first.userId,
      clientId: first.clientId,
      email: first.email,
      tokenHash: first.tokenHash,
      enabled: first.enabled,
      lastLoginAt: first.lastLoginAt,
      createdAt: iso(first.createdAt),
    };
  }

  async savePortalAccess(access: PortalAccessRecord): Promise<void> {
    await getDatabase()
      .insert(clientOpsPortalAccess)
      .values({
        id: access.id,
        userId: access.userId,
        clientId: access.clientId,
        email: access.email,
        tokenHash: access.tokenHash,
        enabled: access.enabled,
        lastLoginAt: nullable(access.lastLoginAt),
        createdAt: new Date(access.createdAt),
      })
      .onConflictDoUpdate({
        target: clientOpsPortalAccess.id,
        set: {
          email: access.email,
          enabled: access.enabled,
          lastLoginAt: nullable(access.lastLoginAt),
        },
      });
  }

  async deletePortalAccess(id: string, userId: string): Promise<void> {
    const rows = await getDatabase()
      .select()
      .from(clientOpsPortalAccess)
      .where(eq(clientOpsPortalAccess.id, id))
      .limit(1);
    const first = rows[0];
    if (first && first.userId === userId) {
      await getDatabase().delete(clientOpsPortalAccess).where(eq(clientOpsPortalAccess.id, id));
    }
  }

  // ── Notifications ──────────────────────────────────────────────────────

  async listNotifications(
    userId: string,
    audience: OpsNotificationAudience,
  ): Promise<OpsNotificationRecord[]> {
    const rows = await getDatabase()
      .select()
      .from(clientOpsNotifications)
      .where(eq(clientOpsNotifications.userId, userId))
      .orderBy(clientOpsNotifications.createdAt);
    return rows
      .filter((row) => row.audience === audience)
      .map((row) => ({
        id: row.id,
        userId: row.userId,
        audience: row.audience as OpsNotificationAudience,
        clientId: row.clientId ?? undefined,
        type: row.type as OpsNotificationRecord['type'],
        title: row.title,
        message: row.message,
        entityId: row.entityId ?? undefined,
        isRead: row.isRead,
        createdAt: iso(row.createdAt),
      }));
  }

  async saveNotification(notification: OpsNotificationRecord): Promise<void> {
    await getDatabase()
      .insert(clientOpsNotifications)
      .values({
        id: notification.id,
        userId: notification.userId,
        audience: notification.audience,
        clientId: nullable(notification.clientId),
        type: notification.type,
        title: notification.title,
        message: notification.message,
        entityId: nullable(notification.entityId),
        isRead: notification.isRead,
        createdAt: new Date(notification.createdAt),
      })
      .onConflictDoUpdate({
        target: clientOpsNotifications.id,
        set: { isRead: notification.isRead },
      });
  }

  // ── Mappers ────────────────────────────────────────────────────────────

  private mapLead(row: LeadRow): LeadRecord {
    return {
      id: row.id,
      userId: row.userId,
      company: row.company,
      contactName: row.contactName ?? '',
      contactEmail: row.contactEmail ?? '',
      contactPhone: row.contactPhone ?? '',
      industry: row.industry ?? '',
      source: row.source ?? '',
      status: row.status as LeadRecord['status'],
      archived: row.archived,
      value: row.value ?? 0,
      currency: row.currency ?? 'USD',
      healthScore: row.healthScore ?? 50,
      nextFollowUp: row.nextFollowUp || null,
      notes: row.notes ?? '',
      clientId: row.clientId || null,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    };
  }

  private mapProposal(row: ProposalRow): ProposalRecord {
    return {
      id: row.id,
      userId: row.userId,
      title: row.title,
      status: row.status as ProposalRecord['status'],
      leadId: row.leadId ?? undefined,
      clientId: row.clientId ?? undefined,
      currentVersion: row.currentVersion,
      versions: decode<ProposalRecord['versions']>(row.versions, []),
      aiMetadata: row.aiMetadata ? decode<Record<string, unknown>>(row.aiMetadata, {}) : null,
      sentAt: row.sentAt ?? undefined,
      acceptedAt: row.acceptedAt ?? undefined,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    };
  }

  private mapContract(row: ContractRow): ContractRecord {
    return {
      id: row.id,
      userId: row.userId,
      clientId: row.clientId,
      title: row.title,
      startDate: row.startDate,
      endDate: row.endDate,
      value: row.value ?? 0,
      currency: row.currency ?? 'USD',
      status: row.status as ContractRecord['status'],
      renewal: row.renewal,
      autoRenew: row.autoRenew,
      currentVersion: row.currentVersion,
      versions: decode<ContractRecord['versions']>(row.versions, []),
      approvals: decode<ContractRecord['approvals']>(row.approvals, []),
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    };
  }

  private mapQuotation(row: QuotationRow): QuotationRecord {
    return {
      id: row.id,
      userId: row.userId,
      title: row.title,
      status: row.status as QuotationRecord['status'],
      leadId: row.leadId ?? undefined,
      clientId: row.clientId ?? undefined,
      packages: decode<QuotationRecord['packages']>(row.packages, []),
      discount: row.discount ?? 0,
      taxRate: row.taxRate ?? 0,
      recurring: row.recurring,
      currency: row.currency ?? 'USD',
      subtotal: row.subtotal ?? 0,
      total: row.total ?? 0,
      sentAt: row.sentAt ?? undefined,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    };
  }

  private mapDocument(row: DocumentRow): DocumentRecord {
    return {
      id: row.id,
      userId: row.userId,
      clientId: row.clientId,
      projectId: row.projectId ?? undefined,
      contractId: row.contractId ?? undefined,
      name: row.name,
      kind: row.kind as DocumentRecord['kind'],
      mime: row.mime ?? '',
      size: row.size ?? 0,
      storageKey: row.storageKey ?? '',
      metadata: decode<Record<string, unknown>>(row.metadata, {}),
      currentVersion: row.currentVersion,
      versions: decode<DocumentRecord['versions']>(row.versions, []),
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    };
  }
}

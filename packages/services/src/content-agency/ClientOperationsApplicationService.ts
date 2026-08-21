// ──────────────────────────────────────────────────────────────────
// VedMoulya — Client Operations Application Service
// EPIC-003 / SPRINT AC-002 — Client Operations & Revenue Engine
//
// Facade over the ClientOpsRepository (AC-002 persistence) and the
// AC-001 ContentAgencyApplicationService (clients, projects, content,
// invoices — reused, never duplicated). Covers: Client CRM, Proposal
// Engine, Contract Management, Quotations, Invoicing & Payment
// Tracking, Client Portal, Document Management, Notifications and
// Business Analytics.
// ──────────────────────────────────────────────────────────────────

import type {
  ClientOpsRepository,
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
  LeadStatus,
  ProposalContentRecord,
  ContractStatus,
} from '@vedmoulya/domain';
import type {
  ContentAgencyApplicationService,
  ContentAgencyResult,
} from './ContentAgencyApplicationService.js';
import type { ClientOpsAIService } from './ClientOpsAIService.js';
import type {
  LeadDTO,
  LeadDetailDTO,
  LeadInteractionDTO,
  LeadTaskDTO,
  LeadContactDTO,
  CreateLeadInput,
  UpdateLeadInput,
  AddInteractionInput,
  AddTaskInput,
  AddContactInput,
  ProposalDTO,
  ProposalDetailDTO,
  CreateProposalInput,
  UpdateProposalInput,
  GenerateProposalInput,
  ProposalExportDTO,
  ContractDTO,
  ContractDetailDTO,
  CreateContractInput,
  UpdateContractInput,
  ContractApprovalInput,
  RenewContractInput,
  QuotationDTO,
  CreateQuotationInput,
  UpdateQuotationInput,
  PaymentDTO,
  AddPaymentInput,
  RevenueOverviewDTO,
  DocumentDTO,
  DocumentDetailDTO,
  UploadDocumentInput,
  UpdateDocumentInput,
  PortalAccessDTO,
  CreatePortalAccessInput,
  CreatePortalAccessResult,
  PortalSessionDTO,
  PortalDashboardDTO,
  OpsNotificationDTO,
  BusinessAnalyticsDTO,
  ContentItemDTO,
  InvoiceDTO,
  PortalContentPayload,
} from './ClientOpsDTO.js';

export interface ClientOpsResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const uid = (prefix: string): string => `${prefix}_${crypto.randomUUID().slice(0, 12)}`;
const now = (): string => new Date().toISOString();
const DAY_MS = 24 * 60 * 60 * 1000;

/** SHA-256 hex digest (Web Crypto — available in Node 18+ and tests). */
async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

/** Minimal Markdown → HTML (headings, lists, paragraphs, tables). */
function markdownToHtml(markdown: string): string {
  const lines = markdown.split('\n');
  const out: string[] = [];
  let inList = false;
  let inTable = false;
  const closeList = (): void => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };
  const closeTable = (): void => {
    if (inTable) {
      out.push('</table>');
      inTable = false;
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      closeList();
      closeTable();
      continue;
    }
    if (/^\|/.test(line)) {
      if (!inTable) {
        out.push('<table>');
        inTable = true;
      }
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim())
        .filter((c) => c !== '' && !/^:?-{2,}:?$/.test(c));
      if (cells.length > 0) {
        out.push(`<tr>${cells.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`);
      }
      continue;
    }
    closeTable();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1]?.length ?? 1;
      out.push(`<h${level}>${escapeHtml(heading[2] ?? '')}</h${level}>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${escapeHtml(line.replace(/^[-*]\s+/, ''))}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${escapeHtml(line)}</p>`);
  }
  closeList();
  closeTable();
  return out.join('\n');
}

// ── Service ────────────────────────────────────────────────────────────────

export class ClientOperationsApplicationService {
  private readonly repo: ClientOpsRepository;
  private readonly contentAgency: ContentAgencyApplicationService;
  private readonly ai: ClientOpsAIService;

  constructor(
    repo: ClientOpsRepository,
    contentAgency: ContentAgencyApplicationService,
    ai: ClientOpsAIService,
  ) {
    this.repo = repo;
    this.contentAgency = contentAgency;
    this.ai = ai;
  }

  // ══════════════════════════════════════════════════════════════════════
  // MODULE 1 — CLIENT CRM
  // ══════════════════════════════════════════════════════════════════════

  async listLeads(
    userId: string,
    status?: 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost' | 'archived',
  ): Promise<ClientOpsResult<LeadDTO[]>> {
    const leads = await this.repo.listLeads(userId);
    const visible =
      status === 'archived' ? leads.filter((l) => l.archived) : leads.filter((l) => !l.archived);
    const filtered =
      status && status !== 'archived' ? visible.filter((l) => l.status === status) : visible;
    const dtos: LeadDTO[] = [];
    for (const lead of filtered) {
      dtos.push(await this.toLeadDTO(lead, userId));
    }
    dtos.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return { success: true, data: dtos };
  }

  async getLead(userId: string, leadId: string): Promise<ClientOpsResult<LeadDetailDTO>> {
    const lead = await this.repo.findLeadById(leadId, userId);
    if (!lead) return { success: false, error: 'Lead not found' };
    const dto = await this.toLeadDTO(lead, userId);
    const [interactions, tasks, contacts] = await Promise.all([
      this.repo.listInteractions(leadId, userId),
      this.repo.listTasks(leadId, userId),
      this.repo.listContacts(leadId, userId),
    ]);
    const detail: LeadDetailDTO = {
      ...dto,
      interactions: interactions
        .map((i): LeadInteractionDTO => ({
          id: i.id,
          type: i.type,
          summary: i.summary,
          createdAt: i.createdAt,
        }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      tasks: tasks
        .map((t): LeadTaskDTO => ({
          id: t.id,
          title: t.title,
          dueAt: t.dueAt,
          completed: t.completed,
          createdAt: t.createdAt,
        }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      contacts: contacts.map((c): LeadContactDTO => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        role: c.role,
        isPrimary: c.isPrimary,
        createdAt: c.createdAt,
      })),
    };
    return { success: true, data: detail };
  }

  async createLead(userId: string, input: CreateLeadInput): Promise<ClientOpsResult<LeadDTO>> {
    if (!input.company.trim()) return { success: false, error: 'Company is required' };
    const timestamp = now();
    const lead: LeadRecord = {
      id: uid('lead'),
      userId,
      company: input.company.trim(),
      contactName: input.contactName ?? '',
      contactEmail: input.contactEmail ?? '',
      contactPhone: input.contactPhone ?? '',
      industry: input.industry ?? '',
      source: input.source ?? 'manual',
      status: input.status ?? 'lead',
      archived: false,
      value: input.value ?? 0,
      currency: input.currency ?? 'USD',
      healthScore: 50,
      nextFollowUp: input.nextFollowUp ?? null,
      notes: input.notes ?? '',
      clientId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.repo.saveLead(lead);
    return { success: true, data: await this.toLeadDTO(lead, userId) };
  }

  async updateLead(
    userId: string,
    leadId: string,
    input: UpdateLeadInput,
  ): Promise<ClientOpsResult<LeadDTO>> {
    const lead = await this.repo.findLeadById(leadId, userId);
    if (!lead) return { success: false, error: 'Lead not found' };
    const updated: LeadRecord = {
      ...lead,
      company: input.company?.trim() || lead.company,
      contactName: input.contactName ?? lead.contactName,
      contactEmail: input.contactEmail ?? lead.contactEmail,
      contactPhone: input.contactPhone ?? lead.contactPhone,
      industry: input.industry ?? lead.industry,
      source: input.source ?? lead.source,
      status: input.status ?? lead.status,
      value: input.value ?? lead.value,
      currency: input.currency ?? lead.currency,
      nextFollowUp: input.nextFollowUp === undefined ? lead.nextFollowUp : input.nextFollowUp,
      notes: input.notes ?? lead.notes,
      updatedAt: now(),
    };
    await this.repo.saveLead(updated);
    return { success: true, data: await this.toLeadDTO(updated, userId) };
  }

  /**
   * Advance a lead through the pipeline. 'won' auto-provisions the AC-001
   * client record (a won lead becomes an active client) and links it.
   */
  async moveLead(
    userId: string,
    leadId: string,
    to: LeadStatus,
  ): Promise<ClientOpsResult<LeadDTO>> {
    const lead = await this.repo.findLeadById(leadId, userId);
    if (!lead) return { success: false, error: 'Lead not found' };
    if (to === lead.status) return { success: true, data: await this.toLeadDTO(lead, userId) };

    let next: LeadRecord = { ...lead, status: to, updatedAt: now() };
    if (to === 'won') {
      if (!lead.clientId) {
        const created = await this.contentAgency.createClient(userId, {
          company: lead.company,
          industry: lead.industry || undefined,
          aiMemory: lead.notes || undefined,
        });
        if (!created.success || !created.data) {
          return { success: false, error: 'Could not provision client for won lead' };
        }
        next = { ...next, clientId: (created.data as { id: string }).id };
        await this.repo.saveLead(next);
      }
    } else {
      await this.repo.saveLead(next);
    }
    return { success: true, data: await this.toLeadDTO(next, userId) };
  }

  async archiveLead(userId: string, leadId: string): Promise<ClientOpsResult<LeadDTO>> {
    const lead = await this.repo.findLeadById(leadId, userId);
    if (!lead) return { success: false, error: 'Lead not found' };
    const updated: LeadRecord = { ...lead, archived: true, updatedAt: now() };
    await this.repo.saveLead(updated);
    return { success: true, data: await this.toLeadDTO(updated, userId) };
  }

  async addInteraction(
    userId: string,
    leadId: string,
    input: AddInteractionInput,
  ): Promise<ClientOpsResult<LeadInteractionDTO>> {
    const lead = await this.repo.findLeadById(leadId, userId);
    if (!lead) return { success: false, error: 'Lead not found' };
    if (!input.summary.trim()) return { success: false, error: 'Summary is required' };
    const interaction: LeadInteractionRecord = {
      id: uid('int'),
      leadId,
      userId,
      type: input.type,
      summary: input.summary.trim(),
      createdAt: now(),
    };
    await this.repo.saveInteraction(interaction);
    await this.repo.saveLead({ ...lead, updatedAt: now() });
    return {
      success: true,
      data: {
        id: interaction.id,
        type: interaction.type,
        summary: interaction.summary,
        createdAt: interaction.createdAt,
      },
    };
  }

  async addTask(
    userId: string,
    leadId: string,
    input: AddTaskInput,
  ): Promise<ClientOpsResult<LeadTaskDTO>> {
    const lead = await this.repo.findLeadById(leadId, userId);
    if (!lead) return { success: false, error: 'Lead not found' };
    if (!input.title.trim()) return { success: false, error: 'Task title is required' };
    const task: LeadTaskRecord = {
      id: uid('task'),
      leadId,
      userId,
      title: input.title.trim(),
      dueAt: input.dueAt ?? null,
      completed: false,
      createdAt: now(),
    };
    await this.repo.saveTask(task);
    await this.repo.saveLead({ ...lead, updatedAt: now() });
    return {
      success: true,
      data: {
        id: task.id,
        title: task.title,
        dueAt: task.dueAt,
        completed: task.completed,
        createdAt: task.createdAt,
      },
    };
  }

  async completeTask(
    userId: string,
    leadId: string,
    taskId: string,
  ): Promise<ClientOpsResult<LeadTaskDTO>> {
    const tasks = await this.repo.listTasks(leadId, userId);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return { success: false, error: 'Task not found' };
    const updated: LeadTaskRecord = { ...task, completed: true };
    await this.repo.saveTask(updated);
    return {
      success: true,
      data: {
        id: updated.id,
        title: updated.title,
        dueAt: updated.dueAt,
        completed: updated.completed,
        createdAt: updated.createdAt,
      },
    };
  }

  async addContact(
    userId: string,
    leadId: string,
    input: AddContactInput,
  ): Promise<ClientOpsResult<LeadContactDTO>> {
    const lead = await this.repo.findLeadById(leadId, userId);
    if (!lead) return { success: false, error: 'Lead not found' };
    if (!input.name.trim()) return { success: false, error: 'Contact name is required' };
    const contact: LeadContactRecord = {
      id: uid('ctc'),
      leadId,
      userId,
      name: input.name.trim(),
      email: input.email ?? '',
      phone: input.phone ?? '',
      role: input.role ?? '',
      isPrimary: input.isPrimary ?? false,
      createdAt: now(),
    };
    await this.repo.saveContact(contact);
    return {
      success: true,
      data: {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        role: contact.role,
        isPrimary: contact.isPrimary,
        createdAt: contact.createdAt,
      },
    };
  }

  async deleteContact(
    userId: string,
    leadId: string,
    contactId: string,
  ): Promise<ClientOpsResult<{ ok: true }>> {
    const contacts = await this.repo.listContacts(leadId, userId);
    if (!contacts.some((c) => c.id === contactId))
      return { success: false, error: 'Contact not found' };
    await this.repo.deleteContact(contactId, userId);
    return { success: true, data: { ok: true } };
  }

  // ══════════════════════════════════════════════════════════════════════
  // MODULE 2 — PROPOSAL ENGINE
  // ══════════════════════════════════════════════════════════════════════

  async listProposals(userId: string): Promise<ClientOpsResult<ProposalDTO[]>> {
    const proposals = await this.repo.listProposals(userId);
    proposals.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return { success: true, data: proposals.map((p) => this.toProposalDTO(p)) };
  }

  async getProposal(
    userId: string,
    proposalId: string,
  ): Promise<ClientOpsResult<ProposalDetailDTO>> {
    const proposal = await this.repo.findProposalById(proposalId, userId);
    if (!proposal) return { success: false, error: 'Proposal not found' };
    const dto = this.toProposalDTO(proposal);
    return {
      success: true,
      data: {
        ...dto,
        versions: [...proposal.versions]
          .sort((a, b) => b.version - a.version)
          .map((v) => ({
            version: v.version,
            content: v.content,
            note: v.note,
            createdAt: v.createdAt,
          })),
      },
    };
  }

  async createProposal(
    userId: string,
    input: CreateProposalInput,
  ): Promise<ClientOpsResult<ProposalDTO>> {
    if (!input.title.trim()) return { success: false, error: 'Title is required' };
    const timestamp = now();
    const proposal: ProposalRecord = {
      id: uid('prop'),
      userId,
      title: input.title.trim(),
      status: 'draft',
      leadId: input.leadId,
      clientId: input.clientId,
      currentVersion: 1,
      versions: [{ version: 1, content: input.content, createdAt: timestamp }],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.repo.saveProposal(proposal);
    return { success: true, data: this.toProposalDTO(proposal) };
  }

  async updateProposal(
    userId: string,
    proposalId: string,
    input: UpdateProposalInput,
  ): Promise<ClientOpsResult<ProposalDTO>> {
    const proposal = await this.repo.findProposalById(proposalId, userId);
    if (!proposal) return { success: false, error: 'Proposal not found' };
    const latest = proposal.versions[proposal.versions.length - 1];
    const base = latest
      ? latest.content
      : {
          company: '',
          requirements: '',
          scope: '',
          timeline: '',
          deliverables: [],
          terms: '',
          pricing: [],
        };
    const merged: ProposalContentRecord = {
      ...base,
      ...(input.content ?? {}),
      deliverables: input.content?.deliverables ?? base.deliverables,
      pricing: input.content?.pricing ?? base.pricing,
    };
    const version = proposal.currentVersion + 1;
    const timestamp = now();
    const updated: ProposalRecord = {
      ...proposal,
      title: input.title?.trim() || proposal.title,
      currentVersion: version,
      versions: [
        ...proposal.versions,
        { version, content: merged, createdAt: timestamp, note: 'updated' },
      ],
      updatedAt: timestamp,
    };
    await this.repo.saveProposal(updated);
    return { success: true, data: this.toProposalDTO(updated) };
  }

  async generateProposal(
    userId: string,
    input: GenerateProposalInput,
  ): Promise<ClientOpsResult<ProposalDTO>> {
    if (!input.title.trim()) return { success: false, error: 'Title is required' };
    if (!input.company.trim() || !input.requirements.trim()) {
      return { success: false, error: 'Company and requirements are required for AI generation' };
    }
    let generation: Awaited<ReturnType<ClientOpsAIService['generateProposal']>>;
    try {
      generation = await this.ai.generateProposal(userId, {
        company: input.company,
        industry: input.industry,
        requirements: input.requirements,
        scope: input.scope,
        timeline: input.timeline,
        deliverables: input.deliverables,
        goals: input.goals,
        brandVoice: input.brandVoice,
        pricing: input.pricing,
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI proposal generation failed',
      };
    }
    const timestamp = now();
    const content: ProposalContentRecord = {
      company: input.company,
      requirements: input.requirements,
      scope: input.scope ?? '',
      timeline: input.timeline ?? '',
      deliverables: input.deliverables ?? [],
      terms: '',
      pricing: input.pricing ?? [],
      document: generation.document,
      notes: `AI-generated proposal (${generation.model})`,
    };
    const proposal: ProposalRecord = {
      id: uid('prop'),
      userId,
      title: input.title.trim(),
      status: 'draft',
      leadId: input.leadId,
      clientId: input.clientId,
      currentVersion: 1,
      versions: [{ version: 1, content, createdAt: timestamp }],
      aiMetadata: {
        provider: generation.provider,
        model: generation.model,
        qualityScore: generation.qualityScore,
        traceId: generation.traceId,
        tokenUsage: generation.tokenUsage,
        cost: generation.cost,
        latencyMs: generation.latencyMs,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.repo.saveProposal(proposal);
    return { success: true, data: this.toProposalDTO(proposal) };
  }

  async sendProposal(userId: string, proposalId: string): Promise<ClientOpsResult<ProposalDTO>> {
    const proposal = await this.repo.findProposalById(proposalId, userId);
    if (!proposal) return { success: false, error: 'Proposal not found' };
    const updated: ProposalRecord = {
      ...proposal,
      status: 'sent',
      sentAt: now(),
      updatedAt: now(),
    };
    await this.repo.saveProposal(updated);
    await this.notifyClient(updated.clientId, userId, {
      type: 'proposal_sent',
      title: 'Proposal sent',
      message: `Proposal "${updated.title}" is ready for your review.`,
      entityId: updated.id,
    });
    return { success: true, data: this.toProposalDTO(updated) };
  }

  async acceptProposal(userId: string, proposalId: string): Promise<ClientOpsResult<ProposalDTO>> {
    const proposal = await this.repo.findProposalById(proposalId, userId);
    if (!proposal) return { success: false, error: 'Proposal not found' };
    const updated: ProposalRecord = {
      ...proposal,
      status: 'accepted',
      acceptedAt: now(),
      updatedAt: now(),
    };
    await this.repo.saveProposal(updated);
    // A won proposal promotes its linked lead to a client (pipeline reuse).
    if (proposal.leadId) {
      const lead = await this.repo.findLeadById(proposal.leadId, userId);
      if (lead && lead.status !== 'won' && lead.status !== 'lost') {
        await this.moveLead(userId, lead.id, 'won');
      }
    }
    return { success: true, data: this.toProposalDTO(updated) };
  }

  async rejectProposal(userId: string, proposalId: string): Promise<ClientOpsResult<ProposalDTO>> {
    const proposal = await this.repo.findProposalById(proposalId, userId);
    if (!proposal) return { success: false, error: 'Proposal not found' };
    const updated: ProposalRecord = { ...proposal, status: 'rejected', updatedAt: now() };
    await this.repo.saveProposal(updated);
    return { success: true, data: this.toProposalDTO(updated) };
  }

  async exportProposal(
    userId: string,
    proposalId: string,
    format: 'markdown' | 'html' | 'pdf' | 'docx',
  ): Promise<ClientOpsResult<ProposalExportDTO>> {
    const proposal = await this.repo.findProposalById(proposalId, userId);
    if (!proposal) return { success: false, error: 'Proposal not found' };
    const document = this.buildProposalDocument(proposal);
    const slug =
      proposal.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'proposal';
    const base = {
      proposalId: proposal.id,
      title: proposal.title,
    };
    switch (format) {
      case 'markdown':
        return {
          success: true,
          data: { ...base, format, filename: `${slug}.md`, data: document, supported: true },
        };
      case 'html': {
        const html = `<h1>${escapeHtml(proposal.title)}</h1>\n${markdownToHtml(document)}`;
        return {
          success: true,
          data: { ...base, format, filename: `${slug}.html`, data: html, supported: true },
        };
      }
      case 'pdf':
      case 'docx':
        // Roadmap (same contract as AC-001 delivery): PDF/DOCX need a
        // server-side renderer; expose the document for client-side print.
        return {
          success: true,
          data: {
            ...base,
            format,
            filename: `${slug}.${format === 'pdf' ? 'pdf' : 'docx'}`,
            data: document,
            supported: false,
          },
        };
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // MODULE 3 — CONTRACT MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════

  async listContracts(userId: string): Promise<ClientOpsResult<ContractDTO[]>> {
    const contracts = await this.repo.listContracts(userId);
    contracts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return { success: true, data: contracts.map((c) => this.toContractDTO(c)) };
  }

  async getContract(
    userId: string,
    contractId: string,
  ): Promise<ClientOpsResult<ContractDetailDTO>> {
    const contract = await this.repo.findContractById(contractId, userId);
    if (!contract) return { success: false, error: 'Contract not found' };
    const dto = this.toContractDTO(contract);
    return {
      success: true,
      data: {
        ...dto,
        versions: [...contract.versions]
          .sort((a, b) => b.version - a.version)
          .map((v) => ({
            version: v.version,
            content: v.content,
            note: v.note,
            createdAt: v.createdAt,
          })),
        approvals: [...contract.approvals].sort(
          (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
        ),
      },
    };
  }

  async createContract(
    userId: string,
    input: CreateContractInput,
  ): Promise<ClientOpsResult<ContractDTO>> {
    if (!input.title.trim() || !input.clientId)
      return { success: false, error: 'Title and client are required' };
    const timestamp = now();
    const contract: ContractRecord = {
      id: uid('ctr'),
      userId,
      clientId: input.clientId,
      title: input.title.trim(),
      startDate: input.startDate,
      endDate: input.endDate,
      value: input.value,
      currency: input.currency ?? 'USD',
      status: 'draft',
      renewal: input.renewal ?? false,
      autoRenew: input.autoRenew ?? false,
      currentVersion: 1,
      versions: [{ version: 1, content: input.content ?? '', createdAt: timestamp }],
      approvals: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.repo.saveContract(contract);
    return { success: true, data: this.toContractDTO(contract) };
  }

  async updateContract(
    userId: string,
    contractId: string,
    input: UpdateContractInput,
  ): Promise<ClientOpsResult<ContractDTO>> {
    const contract = await this.repo.findContractById(contractId, userId);
    if (!contract) return { success: false, error: 'Contract not found' };
    const version = contract.currentVersion + 1;
    const timestamp = now();
    const updated: ContractRecord = {
      ...contract,
      title: input.title?.trim() || contract.title,
      startDate: input.startDate ?? contract.startDate,
      endDate: input.endDate ?? contract.endDate,
      value: input.value ?? contract.value,
      currentVersion: version,
      versions: [
        ...contract.versions,
        {
          version,
          content: input.content ?? contract.versions[contract.versions.length - 1]?.content ?? '',
          createdAt: timestamp,
          note: input.note ?? 'updated',
        },
      ],
      updatedAt: timestamp,
    };
    await this.repo.saveContract(updated);
    return { success: true, data: this.toContractDTO(updated) };
  }

  async approveContract(
    userId: string,
    contractId: string,
    input: ContractApprovalInput,
  ): Promise<ClientOpsResult<ContractDTO>> {
    const contract = await this.repo.findContractById(contractId, userId);
    if (!contract) return { success: false, error: 'Contract not found' };
    const approval = {
      id: uid('aprv'),
      approved: input.approved,
      comment: input.comment ?? '',
      by: input.by,
      at: now(),
    };
    const allApproved =
      contract.approvals.filter((a) => a.approved).length + (input.approved ? 1 : 0);
    const updated: ContractRecord = {
      ...contract,
      approvals: [...contract.approvals, approval],
      status: input.approved && allApproved >= 1 ? 'active' : contract.status,
      updatedAt: now(),
    };
    await this.repo.saveContract(updated);
    return { success: true, data: this.toContractDTO(updated) };
  }

  async terminateContract(
    userId: string,
    contractId: string,
  ): Promise<ClientOpsResult<ContractDTO>> {
    const contract = await this.repo.findContractById(contractId, userId);
    if (!contract) return { success: false, error: 'Contract not found' };
    const updated: ContractRecord = { ...contract, status: 'terminated', updatedAt: now() };
    await this.repo.saveContract(updated);
    return { success: true, data: this.toContractDTO(updated) };
  }

  async renewContract(
    userId: string,
    contractId: string,
    input: RenewContractInput,
  ): Promise<ClientOpsResult<ContractDTO>> {
    const contract = await this.repo.findContractById(contractId, userId);
    if (!contract) return { success: false, error: 'Contract not found' };
    const version = contract.currentVersion + 1;
    const timestamp = now();
    const updated: ContractRecord = {
      ...contract,
      startDate: input.startDate,
      endDate: input.endDate,
      value: input.value ?? contract.value,
      status: 'active',
      renewal: true,
      currentVersion: version,
      versions: [
        ...contract.versions,
        {
          version,
          content: contract.versions[contract.versions.length - 1]?.content ?? '',
          createdAt: timestamp,
          note: input.note ?? 'renewed',
        },
      ],
      updatedAt: timestamp,
    };
    await this.repo.saveContract(updated);
    return { success: true, data: this.toContractDTO(updated) };
  }

  async listExpiringContracts(userId: string, days = 30): Promise<ClientOpsResult<ContractDTO[]>> {
    const contracts = await this.repo.listContracts(userId);
    const horizon = Date.now() + days * DAY_MS;
    const expiring = contracts.filter((c) => {
      if (c.status !== 'active') return false;
      const end = new Date(c.endDate).getTime();
      return end >= Date.now() && end <= horizon;
    });
    return { success: true, data: expiring.map((c) => this.toContractDTO(c)) };
  }

  // ══════════════════════════════════════════════════════════════════════
  // MODULE 4 — QUOTATIONS
  // ══════════════════════════════════════════════════════════════════════

  async listQuotations(userId: string): Promise<ClientOpsResult<QuotationDTO[]>> {
    const quotations = await this.repo.listQuotations(userId);
    quotations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return { success: true, data: quotations.map((q) => this.toQuotationDTO(q)) };
  }

  async getQuotation(userId: string, quotationId: string): Promise<ClientOpsResult<QuotationDTO>> {
    const quotation = await this.repo.findQuotationById(quotationId, userId);
    if (!quotation) return { success: false, error: 'Quotation not found' };
    return { success: true, data: this.toQuotationDTO(quotation) };
  }

  async createQuotation(
    userId: string,
    input: CreateQuotationInput,
  ): Promise<ClientOpsResult<QuotationDTO>> {
    if (!input.title.trim()) return { success: false, error: 'Title is required' };
    if (!input.packages.length)
      return { success: false, error: 'At least one package is required' };
    const timestamp = now();
    const quotation: QuotationRecord = {
      id: uid('quot'),
      userId,
      title: input.title.trim(),
      status: 'draft',
      leadId: input.leadId,
      clientId: input.clientId,
      packages: input.packages,
      discount: input.discount ?? 0,
      taxRate: input.taxRate ?? 0,
      recurring: input.recurring ?? false,
      currency: input.currency ?? 'USD',
      subtotal: 0,
      total: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const totals = this.computeQuotationTotals(quotation);
    const saved: QuotationRecord = { ...quotation, ...totals };
    await this.repo.saveQuotation(saved);
    return { success: true, data: this.toQuotationDTO(saved) };
  }

  async updateQuotation(
    userId: string,
    quotationId: string,
    input: UpdateQuotationInput,
  ): Promise<ClientOpsResult<QuotationDTO>> {
    const quotation = await this.repo.findQuotationById(quotationId, userId);
    if (!quotation) return { success: false, error: 'Quotation not found' };
    const merged: QuotationRecord = {
      ...quotation,
      title: input.title?.trim() || quotation.title,
      packages: input.packages ?? quotation.packages,
      discount: input.discount ?? quotation.discount,
      taxRate: input.taxRate ?? quotation.taxRate,
      recurring: input.recurring ?? quotation.recurring,
      currency: input.currency ?? quotation.currency,
      updatedAt: now(),
    };
    const totals = this.computeQuotationTotals(merged);
    const saved: QuotationRecord = { ...merged, ...totals };
    await this.repo.saveQuotation(saved);
    return { success: true, data: this.toQuotationDTO(saved) };
  }

  async sendQuotation(userId: string, quotationId: string): Promise<ClientOpsResult<QuotationDTO>> {
    const quotation = await this.repo.findQuotationById(quotationId, userId);
    if (!quotation) return { success: false, error: 'Quotation not found' };
    const updated: QuotationRecord = {
      ...quotation,
      status: 'sent',
      sentAt: now(),
      updatedAt: now(),
    };
    await this.repo.saveQuotation(updated);
    await this.notifyClient(updated.clientId, userId, {
      type: 'proposal_sent',
      title: 'Quotation sent',
      message: `Quotation "${updated.title}" has been shared with you.`,
      entityId: updated.id,
    });
    return { success: true, data: this.toQuotationDTO(updated) };
  }

  async acceptQuotation(
    userId: string,
    quotationId: string,
  ): Promise<ClientOpsResult<QuotationDTO>> {
    const quotation = await this.repo.findQuotationById(quotationId, userId);
    if (!quotation) return { success: false, error: 'Quotation not found' };
    const updated: QuotationRecord = { ...quotation, status: 'accepted', updatedAt: now() };
    await this.repo.saveQuotation(updated);
    if (quotation.leadId) {
      const lead = await this.repo.findLeadById(quotation.leadId, userId);
      if (lead && lead.status !== 'won' && lead.status !== 'lost') {
        await this.moveLead(userId, lead.id, 'won');
      }
    }
    return { success: true, data: this.toQuotationDTO(updated) };
  }

  async rejectQuotation(
    userId: string,
    quotationId: string,
  ): Promise<ClientOpsResult<QuotationDTO>> {
    const quotation = await this.repo.findQuotationById(quotationId, userId);
    if (!quotation) return { success: false, error: 'Quotation not found' };
    const updated: QuotationRecord = { ...quotation, status: 'rejected', updatedAt: now() };
    await this.repo.saveQuotation(updated);
    return { success: true, data: this.toQuotationDTO(updated) };
  }

  // ══════════════════════════════════════════════════════════════════════
  // MODULES 5 & 6 — INVOICING & PAYMENT TRACKING
  // ══════════════════════════════════════════════════════════════════════

  async addPayment(userId: string, input: AddPaymentInput): Promise<ClientOpsResult<PaymentDTO>> {
    const invoice = await this.contentAgency.getInvoice(userId, input.invoiceId);
    if (!invoice.success || !invoice.data) return { success: false, error: 'Invoice not found' };
    const invoiceData = invoice.data as {
      id: string;
      clientId: string;
      amount: number;
      currency: string;
    };
    if (input.amount <= 0) return { success: false, error: 'Payment amount must be positive' };
    const payment: PaymentRecord = {
      id: uid('pay'),
      userId,
      invoiceId: input.invoiceId,
      clientId: invoiceData.clientId,
      amount: input.amount,
      currency: input.currency ?? invoiceData.currency,
      method: input.method ?? 'bank_transfer',
      receivedAt: input.receivedAt ?? now(),
      note: input.note ?? '',
      createdAt: now(),
    };
    await this.repo.savePayment(payment);

    const paid = await this.repo.listPaymentsByInvoice(input.invoiceId, userId);
    const totalPaid = paid.reduce((sum, p) => sum + p.amount, 0);
    if (totalPaid >= invoiceData.amount) {
      const updated = await this.contentAgency.updateInvoiceStatus(userId, input.invoiceId, 'paid');
      if (!updated.success) {
        return { success: false, error: 'Payment recorded but invoice could not be marked paid' };
      }
    }
    return { success: true, data: await this.toPaymentDTO(payment, userId) };
  }

  async listPayments(userId: string): Promise<ClientOpsResult<PaymentDTO[]>> {
    const payments = await this.repo.listPayments(userId);
    const dtos: PaymentDTO[] = [];
    for (const payment of payments) {
      dtos.push(await this.toPaymentDTO(payment, userId));
    }
    dtos.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
    return { success: true, data: dtos };
  }

  async getRevenueOverview(userId: string): Promise<ClientOpsResult<RevenueOverviewDTO>> {
    const invoices = await this.safeArray(this.contentAgency.listInvoices(userId));
    const payments = await this.repo.listPayments(userId);
    const currency = invoices[0]?.currency ?? 'USD';

    const paidTotal = payments.reduce((sum, p) => sum + p.amount, 0);
    const nowMs = Date.now();
    let outstanding = 0;
    let overdueCount = 0;
    let paidCount = 0;
    let pendingCount = 0;
    for (const invoice of invoices) {
      const inv = invoice as { amount?: number; status?: string; dueDate?: string | null };
      const amount = inv.amount ?? 0;
      if (inv.status === 'paid') {
        paidCount += 1;
      } else {
        pendingCount += 1;
        outstanding += amount;
        if (inv.dueDate && new Date(inv.dueDate).getTime() < nowMs) {
          overdueCount += 1;
        }
      }
    }

    const months = this.lastMonths(6);
    const monthlyRevenue = months.map((month) => ({
      month,
      amount: round2(
        payments
          .filter((p) => p.receivedAt.slice(0, 7) === month)
          .reduce((sum, p) => sum + p.amount, 0),
      ),
    }));
    const currentYear = new Date().getFullYear().toString();
    const annualRevenue = round2(
      payments
        .filter((p) => p.receivedAt.slice(0, 4) === currentYear)
        .reduce((sum, p) => sum + p.amount, 0),
    );
    const cashflow = months.map((month) => ({
      month,
      received: round2(
        payments
          .filter((p) => p.receivedAt.slice(0, 7) === month)
          .reduce((sum, p) => sum + p.amount, 0),
      ),
      outstanding: round2(
        invoices
          .filter((i) => i.dueDate?.slice(0, 7) === month && i.status !== 'paid')
          .reduce((sum, i) => sum + i.amount, 0),
      ),
    }));

    return {
      success: true,
      data: {
        currency,
        paidTotal: round2(paidTotal),
        outstanding: round2(outstanding),
        overdueCount,
        paidCount,
        pendingCount,
        annualRevenue,
        monthlyRevenue,
        cashflow,
      },
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // MODULE 8 — DOCUMENT MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════

  async listDocuments(userId: string): Promise<ClientOpsResult<DocumentDTO[]>> {
    const documents = await this.repo.listDocuments(userId);
    documents.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return { success: true, data: documents.map((d) => this.toDocumentDTO(d)) };
  }

  async getDocument(
    userId: string,
    documentId: string,
  ): Promise<ClientOpsResult<DocumentDetailDTO>> {
    const document = await this.repo.findDocumentById(documentId, userId);
    if (!document) return { success: false, error: 'Document not found' };
    return {
      success: true,
      data: {
        ...this.toDocumentDTO(document),
        storageKey: document.storageKey,
        versions: [...document.versions]
          .sort((a, b) => b.version - a.version)
          .map((v) => ({ version: v.version, size: v.size, note: v.note, createdAt: v.createdAt })),
      },
    };
  }

  async uploadDocument(
    userId: string,
    input: UploadDocumentInput,
  ): Promise<ClientOpsResult<DocumentDTO>> {
    if (!input.clientId || !input.name.trim())
      return { success: false, error: 'Client and document name are required' };
    const client = await this.contentAgency.getClient(userId, input.clientId);
    if (!client.success || !client.data) return { success: false, error: 'Client not found' };
    const bytes = Math.floor((input.contentBase64.length * 3) / 4);
    if (bytes > 2 * 1024 * 1024)
      return { success: false, error: 'Document exceeds the 2 MB limit' };
    const timestamp = now();
    const storageKey = `data:${input.mime};base64,${input.contentBase64}`;
    const document: DocumentRecord = {
      id: uid('doc'),
      userId,
      clientId: input.clientId,
      projectId: input.projectId,
      contractId: input.contractId,
      name: input.name.trim(),
      kind: input.kind,
      mime: input.mime,
      size: bytes,
      storageKey,
      metadata: input.metadata ?? {},
      currentVersion: 1,
      versions: [{ version: 1, storageKey, size: bytes, createdAt: timestamp }],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.repo.saveDocument(document);
    return { success: true, data: this.toDocumentDTO(document) };
  }

  async updateDocument(
    userId: string,
    documentId: string,
    input: UpdateDocumentInput,
  ): Promise<ClientOpsResult<DocumentDTO>> {
    const document = await this.repo.findDocumentById(documentId, userId);
    if (!document) return { success: false, error: 'Document not found' };
    const version = document.currentVersion + 1;
    const timestamp = now();
    const updated: DocumentRecord = { ...document };
    if (input.contentBase64) {
      const bytes = Math.floor((input.contentBase64.length * 3) / 4);
      if (bytes > 2 * 1024 * 1024)
        return { success: false, error: 'Document exceeds the 2 MB limit' };
      updated.storageKey = `data:${input.mime ?? document.mime};base64,${input.contentBase64}`;
      updated.size = bytes;
      updated.mime = input.mime ?? document.mime;
      updated.currentVersion = version;
      updated.versions = [
        ...document.versions,
        {
          version,
          storageKey: updated.storageKey,
          size: bytes,
          createdAt: timestamp,
          note: input.note,
        },
      ];
    }
    if (input.name) updated.name = input.name.trim();
    updated.updatedAt = timestamp;
    await this.repo.saveDocument(updated);
    return { success: true, data: this.toDocumentDTO(updated) };
  }

  async deleteDocument(userId: string, documentId: string): Promise<ClientOpsResult<{ ok: true }>> {
    const document = await this.repo.findDocumentById(documentId, userId);
    if (!document) return { success: false, error: 'Document not found' };
    await this.repo.deleteDocument(documentId, userId);
    return { success: true, data: { ok: true } };
  }

  async searchDocuments(userId: string, query: string): Promise<ClientOpsResult<DocumentDTO[]>> {
    const documents = await this.repo.listDocuments(userId);
    const q = query.trim().toLowerCase();
    if (!q) return { success: true, data: documents.map((d) => this.toDocumentDTO(d)) };
    const matches = documents.filter((d) => {
      const metadata = JSON.stringify(d.metadata).toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        d.kind.toLowerCase().includes(q) ||
        d.mime.toLowerCase().includes(q) ||
        metadata.includes(q)
      );
    });
    return { success: true, data: matches.map((d) => this.toDocumentDTO(d)) };
  }

  // ══════════════════════════════════════════════════════════════════════
  // MODULE 7 — CLIENT PORTAL
  // ══════════════════════════════════════════════════════════════════════

  async createPortalAccess(
    userId: string,
    input: CreatePortalAccessInput,
  ): Promise<ClientOpsResult<CreatePortalAccessResult>> {
    const client = await this.contentAgency.getClient(userId, input.clientId);
    if (!client.success || !client.data) return { success: false, error: 'Client not found' };
    if (!input.email.trim()) return { success: false, error: 'Email is required' };
    const rawToken = [...crypto.getRandomValues(new Uint8Array(24))]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const access: PortalAccessRecord = {
      id: uid('portal'),
      userId,
      clientId: input.clientId,
      email: input.email.trim(),
      tokenHash: await sha256Hex(rawToken),
      enabled: true,
      lastLoginAt: null,
      createdAt: now(),
    };
    await this.repo.savePortalAccess(access);
    return {
      success: true,
      data: {
        access: {
          id: access.id,
          clientId: access.clientId,
          email: access.email,
          enabled: access.enabled,
          lastLoginAt: access.lastLoginAt,
          createdAt: access.createdAt,
        },
        rawToken,
      },
    };
  }

  async listPortalAccess(userId: string): Promise<ClientOpsResult<PortalAccessDTO[]>> {
    const accessList = await this.repo.listPortalAccess(userId);
    const dtos: PortalAccessDTO[] = accessList.map((a) => ({
      id: a.id,
      clientId: a.clientId,
      email: a.email,
      enabled: a.enabled,
      lastLoginAt: a.lastLoginAt,
      createdAt: a.createdAt,
    }));
    return { success: true, data: dtos };
  }

  async revokePortalAccess(
    userId: string,
    accessId: string,
  ): Promise<ClientOpsResult<{ ok: true }>> {
    const accessList = await this.repo.listPortalAccess(userId);
    if (!accessList.some((a) => a.id === accessId))
      return { success: false, error: 'Portal access not found' };
    await this.repo.deletePortalAccess(accessId, userId);
    return { success: true, data: { ok: true } };
  }

  /** Portal sign-in — the raw token is the credential (hashed at rest). */
  async portalLogin(token: string): Promise<ClientOpsResult<PortalSessionDTO>> {
    const session = await this.resolvePortalSession(token);
    if (!session.success || !session.data) return session;
    return { success: true, data: session.data };
  }

  async portalDashboard(token: string): Promise<ClientOpsResult<PortalDashboardDTO>> {
    const session = await this.resolvePortalSession(token);
    if (!session.success || !session.data)
      return session as unknown as ClientOpsResult<PortalDashboardDTO>;
    const { clientId, agencyUserId, company } = session.data;

    const [projects, content, invoices, notifications] = await Promise.all([
      this.safeArray(this.contentAgency.listProjects(agencyUserId)),
      this.safeArray(this.contentAgency.listContent(agencyUserId)),
      this.safeArray(this.contentAgency.listInvoices(agencyUserId)),
      this.repo.listNotifications(agencyUserId, 'client'),
    ]);

    const clientProjects = projects.filter((p) => p.clientId === clientId);
    const clientContent = content.filter((c) => c.clientId === clientId);
    const clientInvoices = invoices.filter((i) => i.clientId === clientId);
    const clientNotifications = notifications
      .filter((n) => n.clientId === clientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((n): OpsNotificationDTO => this.toNotificationDTO(n));

    return {
      success: true,
      data: {
        session: {
          clientId,
          company,
          email: session.data.email,
          lastLoginAt: session.data.lastLoginAt,
        },
        projects: clientProjects,
        content: clientContent,
        contentStats: {
          total: clientContent.length,
          awaitingApproval: clientContent.filter((c) => c.status === 'review').length,
          published: clientContent.filter((c) => c.status === 'published').length,
        },
        invoices: clientInvoices,
        notifications: clientNotifications,
      },
    };
  }

  async portalListContent(token: string): Promise<ClientOpsResult<ContentItemDTO[]>> {
    const session = await this.resolvePortalSession(token);
    if (!session.success || !session.data)
      return session as unknown as ClientOpsResult<ContentItemDTO[]>;
    const content = await this.safeArray(this.contentAgency.listContent(session.data.agencyUserId));
    return { success: true, data: content.filter((c) => c.clientId === session.data?.clientId) };
  }

  async portalGetContent(
    token: string,
    contentId: string,
  ): Promise<ClientOpsResult<PortalContentPayload>> {
    const session = await this.resolvePortalSession(token);
    if (!session.success || !session.data)
      return session as unknown as ClientOpsResult<PortalContentPayload>;
    const item = await this.contentAgency.getContent(session.data.agencyUserId, contentId);
    if (!item.success || !item.data) return { success: false, error: 'Content not found' };
    if (item.data.clientId !== session.data.clientId)
      return { success: false, error: 'Content not found' };
    return { success: true, data: { content: item.data, deliverable: null } };
  }

  async portalApproveContent(
    token: string,
    contentId: string,
    comment: string,
  ): Promise<ClientOpsResult<PortalContentPayload>> {
    const session = await this.resolvePortalSession(token);
    if (!session.success || !session.data)
      return session as unknown as ClientOpsResult<PortalContentPayload>;
    const { clientId, agencyUserId } = session.data;
    const item = await this.contentAgency.getContent(agencyUserId, contentId);
    if (!item.success || !item.data || item.data.clientId !== clientId) {
      return { success: false, error: 'Content not found' };
    }
    const review = await this.contentAgency.addReview(agencyUserId, contentId, {
      stage: 'review',
      reviewer: 'Client',
      comment,
      decision: 'accepted',
    });
    if (!review.success) return { success: false, error: 'Could not record approval' };
    const transition = await this.contentAgency.transitionStatus(
      agencyUserId,
      contentId,
      'approved',
    );
    if (!transition.success) {
      return { success: false, error: 'Approval recorded but status could not advance' };
    }
    await this.notifyAgency(agencyUserId, {
      type: 'client_comment',
      title: 'Client approved content',
      message: `Client approved "${item.data.title}".`,
      entityId: contentId,
      clientId,
    });
    return this.portalGetContent(token, contentId);
  }

  async portalRejectContent(
    token: string,
    contentId: string,
    comment: string,
  ): Promise<ClientOpsResult<PortalContentPayload>> {
    const session = await this.resolvePortalSession(token);
    if (!session.success || !session.data)
      return session as unknown as ClientOpsResult<PortalContentPayload>;
    const { clientId, agencyUserId } = session.data;
    const item = await this.contentAgency.getContent(agencyUserId, contentId);
    if (!item.success || !item.data || item.data.clientId !== clientId) {
      return { success: false, error: 'Content not found' };
    }
    const review = await this.contentAgency.addReview(agencyUserId, contentId, {
      stage: 'review',
      reviewer: 'Client',
      comment,
      decision: 'rejected',
    });
    if (!review.success) return { success: false, error: 'Could not record rejection' };
    await this.notifyAgency(agencyUserId, {
      type: 'client_comment',
      title: 'Client requested changes',
      message: `Client requested changes on "${item.data.title}".`,
      entityId: contentId,
      clientId,
    });
    return this.portalGetContent(token, contentId);
  }

  async portalCommentContent(
    token: string,
    contentId: string,
    comment: string,
  ): Promise<ClientOpsResult<PortalContentPayload>> {
    const session = await this.resolvePortalSession(token);
    if (!session.success || !session.data)
      return session as unknown as ClientOpsResult<PortalContentPayload>;
    const { clientId, agencyUserId } = session.data;
    const item = await this.contentAgency.getContent(agencyUserId, contentId);
    if (!item.success || !item.data || item.data.clientId !== clientId) {
      return { success: false, error: 'Content not found' };
    }
    const review = await this.contentAgency.addReview(agencyUserId, contentId, {
      stage: 'review',
      reviewer: 'Client',
      comment,
      decision: 'comment',
    });
    if (!review.success) return { success: false, error: 'Could not record comment' };
    await this.notifyAgency(agencyUserId, {
      type: 'client_comment',
      title: 'New client comment',
      message: `Client commented on "${item.data.title}".`,
      entityId: contentId,
      clientId,
    });
    return this.portalGetContent(token, contentId);
  }

  async portalDownloadDeliverable(
    token: string,
    contentId: string,
    format: 'markdown' | 'html' | 'pdf' | 'docx',
  ): Promise<
    ClientOpsResult<{
      contentId: string;
      title: string;
      format: string;
      filename: string;
      data: string;
      supported: boolean;
    }>
  > {
    const session = await this.resolvePortalSession(token);
    if (!session.success || !session.data)
      return session as unknown as ClientOpsResult<{
        contentId: string;
        title: string;
        format: string;
        filename: string;
        data: string;
        supported: boolean;
      }>;
    const item = await this.contentAgency.getContent(session.data.agencyUserId, contentId);
    if (!item.success || !item.data || item.data.clientId !== session.data.clientId) {
      return { success: false, error: 'Content not found' };
    }
    const exported = await this.contentAgency.exportContent(
      session.data.agencyUserId,
      contentId,
      format,
    );
    if (!exported.success || !exported.data) return { success: false, error: 'Export failed' };
    return { success: true, data: exported.data };
  }

  async portalListInvoices(token: string): Promise<ClientOpsResult<InvoiceDTO[]>> {
    const session = await this.resolvePortalSession(token);
    if (!session.success || !session.data)
      return session as unknown as ClientOpsResult<InvoiceDTO[]>;
    const invoices = await this.safeArray(
      this.contentAgency.listInvoices(session.data.agencyUserId),
    );
    return { success: true, data: invoices.filter((i) => i.clientId === session.data?.clientId) };
  }

  async portalGetInvoice(token: string, invoiceId: string): Promise<ClientOpsResult<InvoiceDTO>> {
    const session = await this.resolvePortalSession(token);
    if (!session.success || !session.data) return session as unknown as ClientOpsResult<InvoiceDTO>;
    const invoice = await this.contentAgency.getInvoice(session.data.agencyUserId, invoiceId);
    if (!invoice.success || !invoice.data) return { success: false, error: 'Invoice not found' };
    if (invoice.data.clientId !== session.data.clientId)
      return { success: false, error: 'Invoice not found' };
    return { success: true, data: invoice.data };
  }

  // ══════════════════════════════════════════════════════════════════════
  // MODULE 9 — NOTIFICATIONS
  // ══════════════════════════════════════════════════════════════════════

  async listNotifications(userId: string): Promise<ClientOpsResult<OpsNotificationDTO[]>> {
    await this.ensureDerivedNotifications(userId);
    const notifications = await this.repo.listNotifications(userId, 'agency');
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { success: true, data: notifications.map((n) => this.toNotificationDTO(n)) };
  }

  async markNotificationRead(
    userId: string,
    notificationId: string,
  ): Promise<ClientOpsResult<OpsNotificationDTO>> {
    const notifications = await this.repo.listNotifications(userId, 'agency');
    const target = notifications.find((n) => n.id === notificationId);
    if (!target) return { success: false, error: 'Notification not found' };
    const updated: OpsNotificationRecord = { ...target, isRead: true };
    await this.repo.saveNotification(updated);
    return { success: true, data: this.toNotificationDTO(updated) };
  }

  async markAllNotificationsRead(userId: string): Promise<ClientOpsResult<{ ok: true }>> {
    const notifications = await this.repo.listNotifications(userId, 'agency');
    for (const notification of notifications) {
      if (!notification.isRead) {
        await this.repo.saveNotification({ ...notification, isRead: true });
      }
    }
    return { success: true, data: { ok: true } };
  }

  // ══════════════════════════════════════════════════════════════════════
  // MODULE 10 — BUSINESS ANALYTICS
  // ══════════════════════════════════════════════════════════════════════

  async getBusinessAnalytics(userId: string): Promise<ClientOpsResult<BusinessAnalyticsDTO>> {
    const [clients, projects, content, leads, payments] = await Promise.all([
      this.safeArray(this.contentAgency.listClients(userId)),
      this.safeArray(this.contentAgency.listProjects(userId)),
      this.safeArray(this.contentAgency.listContent(userId)),
      this.repo.listLeads(userId),
      this.repo.listPayments(userId),
    ]);

    const yearMonth = new Date().toISOString().slice(0, 7);
    const newThisMonth = clients.filter((c) => c.createdAt.slice(0, 7) === yearMonth).length;

    const won = leads.filter((l) => l.status === 'won').length;
    const lost = leads.filter((l) => l.status === 'lost').length;
    const winRate = won + lost > 0 ? round2((won / (won + lost)) * 100) : 0;

    // Approval time: avg days from content creation to an accepted review.
    let approvalTotalMs = 0;
    let approvalSamples = 0;
    for (const item of content) {
      const accepted = item.reviews.find((r) => r.decision === 'accepted');
      if (accepted) {
        approvalTotalMs +=
          new Date(accepted.createdAt).getTime() - new Date(item.createdAt).getTime();
        approvalSamples += 1;
      }
    }
    const approvalTimeDays =
      approvalSamples > 0 ? round2(approvalTotalMs / approvalSamples / DAY_MS) : 0;

    // Delivery: avg days from creation to scheduled/published for delivered items.
    let deliveryTotalMs = 0;
    let deliverySamples = 0;
    for (const item of content) {
      if (item.status === 'published' || item.status === 'scheduled') {
        const end = item.scheduledFor ?? item.updatedAt;
        deliveryTotalMs += new Date(end).getTime() - new Date(item.createdAt).getTime();
        deliverySamples += 1;
      }
    }
    const avgDeliveryDays =
      deliverySamples > 0 ? round2(deliveryTotalMs / deliverySamples / DAY_MS) : 0;

    let tokens = 0;
    let cost = 0;
    let aiRequests = 0;
    for (const item of content) {
      const meta = item.aiMetadata;
      if (meta) {
        aiRequests += 1;
        tokens += meta.tokenUsage.total;
        cost += meta.cost;
      }
    }

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const months = this.lastMonths(6);
    const monthly = months.map((month) => ({
      month,
      amount: round2(
        payments
          .filter((p) => p.receivedAt.slice(0, 7) === month)
          .reduce((sum, p) => sum + p.amount, 0),
      ),
    }));

    return {
      success: true,
      data: {
        revenue: { total: round2(totalPaid), monthly },
        clients: { total: clients.length, newThisMonth },
        projects: {
          total: projects.length,
          active: projects.filter((p) => p.status === 'active').length,
          completed: projects.filter((p) => p.status === 'completed').length,
        },
        winRate,
        approvalTimeDays,
        aiUsage: { requests: aiRequests, tokens, cost: round2(cost) },
        contentGenerated: content.length,
        avgDeliveryDays,
      },
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // Helpers
  // ══════════════════════════════════════════════════════════════════════

  private async toLeadDTO(lead: LeadRecord, userId: string): Promise<LeadDTO> {
    const [interactions, tasks] = await Promise.all([
      this.repo.listInteractions(lead.id, userId),
      this.repo.listTasks(lead.id, userId),
    ]);
    return {
      id: lead.id,
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
      healthScore: this.computeHealth(lead, interactions, tasks),
      nextFollowUp: lead.nextFollowUp,
      notes: lead.notes,
      clientId: lead.clientId,
      openTasks: tasks.filter((t) => !t.completed).length,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    };
  }

  private computeHealth(
    lead: LeadRecord,
    interactions: LeadInteractionRecord[],
    tasks: LeadTaskRecord[],
  ): number {
    let score = 50;
    const nowMs = Date.now();
    const recent7 = interactions.filter(
      (i) => nowMs - new Date(i.createdAt).getTime() <= 7 * DAY_MS,
    ).length;
    const recent14 = interactions.filter(
      (i) => nowMs - new Date(i.createdAt).getTime() <= 14 * DAY_MS,
    ).length;
    const recent30 = interactions.filter(
      (i) => nowMs - new Date(i.createdAt).getTime() <= 30 * DAY_MS,
    ).length;
    if (recent7 > 0) score += 20;
    else if (recent14 > 0) score += 10;
    else if (recent30 > 0) score += 5;
    const openTasks = tasks.filter((t) => !t.completed).length;
    score += openTasks === 0 ? 10 : -5;
    if (lead.nextFollowUp && new Date(lead.nextFollowUp).getTime() > nowMs) score += 10;
    const stageBoost: Record<LeadStatus, number> = {
      lead: 0,
      qualified: 5,
      proposal: 10,
      negotiation: 15,
      won: 20,
      lost: 0,
    };
    score += stageBoost[lead.status];
    return Math.max(0, Math.min(100, score));
  }

  private toProposalDTO(proposal: ProposalRecord): ProposalDTO {
    const latest = proposal.versions[proposal.versions.length - 1];
    return {
      id: proposal.id,
      title: proposal.title,
      status: proposal.status,
      leadId: proposal.leadId,
      clientId: proposal.clientId,
      content: latest?.content ?? {
        company: '',
        requirements: '',
        scope: '',
        timeline: '',
        deliverables: [],
        terms: '',
        pricing: [],
      },
      aiMetadata: proposal.aiMetadata,
      sentAt: proposal.sentAt,
      acceptedAt: proposal.acceptedAt,
      versionCount: proposal.versions.length,
      createdAt: proposal.createdAt,
      updatedAt: proposal.updatedAt,
    };
  }

  private toContractDTO(contract: ContractRecord): ContractDTO {
    const nowMs = Date.now();
    const endMs = new Date(contract.endDate).getTime();
    const derivedStatus: ContractStatus =
      contract.status === 'active' && endMs < nowMs ? 'expired' : contract.status;
    const approved = contract.approvals.some((a) => a.approved);
    return {
      id: contract.id,
      clientId: contract.clientId,
      title: contract.title,
      startDate: contract.startDate,
      endDate: contract.endDate,
      value: contract.value,
      currency: contract.currency,
      status: derivedStatus,
      renewal: contract.renewal,
      autoRenew: contract.autoRenew,
      currentVersion: contract.currentVersion,
      approvalCount: contract.approvals.length,
      approved,
      expiresInDays: endMs >= nowMs ? Math.ceil((endMs - nowMs) / DAY_MS) : null,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
    };
  }

  private toQuotationDTO(quotation: QuotationRecord): QuotationDTO {
    return {
      id: quotation.id,
      title: quotation.title,
      status: quotation.status,
      leadId: quotation.leadId,
      clientId: quotation.clientId,
      packages: quotation.packages,
      discount: quotation.discount,
      taxRate: quotation.taxRate,
      recurring: quotation.recurring,
      currency: quotation.currency,
      subtotal: quotation.subtotal,
      total: quotation.total,
      sentAt: quotation.sentAt,
      createdAt: quotation.createdAt,
      updatedAt: quotation.updatedAt,
    };
  }

  private computeQuotationTotals(quotation: QuotationRecord): { subtotal: number; total: number } {
    const subtotal = quotation.packages.reduce((sum, p) => sum + p.price * (p.qty ?? 1), 0);
    const taxable = Math.max(0, subtotal - quotation.discount);
    const total = taxable * (1 + quotation.taxRate / 100);
    return { subtotal: round2(subtotal), total: round2(total) };
  }

  private async toPaymentDTO(payment: PaymentRecord, userId: string): Promise<PaymentDTO> {
    const [clients] = await Promise.all([this.safeArray(this.contentAgency.listClients(userId))]);
    const client = clients.find((c) => c.id === payment.clientId);
    return {
      id: payment.id,
      invoiceId: payment.invoiceId,
      clientId: payment.clientId,
      invoiceNumber: this.invoiceNumber(payment.invoiceId),
      clientName: client?.company ?? 'Unknown client',
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      receivedAt: payment.receivedAt,
      note: payment.note,
      createdAt: payment.createdAt,
    };
  }

  private toDocumentDTO(document: DocumentRecord): DocumentDTO {
    return {
      id: document.id,
      clientId: document.clientId,
      projectId: document.projectId,
      contractId: document.contractId,
      name: document.name,
      kind: document.kind,
      mime: document.mime,
      size: document.size,
      metadata: document.metadata,
      currentVersion: document.currentVersion,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  private toNotificationDTO(notification: OpsNotificationRecord): OpsNotificationDTO {
    return {
      id: notification.id,
      audience: notification.audience,
      clientId: notification.clientId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      entityId: notification.entityId,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    };
  }

  private buildProposalDocument(proposal: ProposalRecord): string {
    const latest = proposal.versions[proposal.versions.length - 1];
    const c = latest?.content ?? {
      company: '',
      requirements: '',
      scope: '',
      timeline: '',
      deliverables: [] as string[],
      terms: '',
      pricing: [],
    };
    if (c.document) return c.document;
    const lines = [
      `# ${proposal.title}`,
      '',
      '## Company & Context',
      c.company,
      '',
      '## Requirements',
      c.requirements,
      '',
      '## Scope of Work',
      c.scope,
      '',
      '## Timeline',
      c.timeline,
      '',
      '## Deliverables',
      ...(c.deliverables.length > 0 ? c.deliverables.map((d) => `- ${d}`) : ['- TBD']),
      '',
      '## Pricing',
      ...(c.pricing.length > 0
        ? c.pricing.map(
            (p) => `- ${p.label}${p.description ? ` (${p.description})` : ''}: ${p.amount}`,
          )
        : ['- TBD']),
      '',
      '## Terms & Conditions',
      c.terms || 'Standard terms apply.',
      '',
    ];
    return lines.join('\n');
  }

  private invoiceNumber(invoiceId: string): string {
    return `INV-${new Date().getFullYear()}-${invoiceId.slice(0, 6).toUpperCase()}`;
  }

  private lastMonths(count: number): string[] {
    const months: string[] = [];
    const nowDate = new Date();
    for (let i = count - 1; i >= 0; i -= 1) {
      const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
  }

  /** Await a list-returning ContentAgencyResult and unwrap it defensively. */
  private async safeArray<T>(promise: Promise<ContentAgencyResult<T[]>>): Promise<T[]> {
    try {
      const result = await promise;
      return result.success && Array.isArray(result.data) ? result.data : [];
    } catch {
      return [];
    }
  }

  private async notifyAgency(
    userId: string,
    input: {
      type: OpsNotificationRecord['type'];
      title: string;
      message: string;
      entityId?: string;
      clientId?: string;
    },
  ): Promise<void> {
    await this.repo.saveNotification({
      id: uid('notif'),
      userId,
      audience: 'agency',
      clientId: input.clientId,
      type: input.type,
      title: input.title,
      message: input.message,
      entityId: input.entityId,
      isRead: false,
      createdAt: now(),
    });
  }

  private async notifyClient(
    clientId: string | undefined,
    agencyUserId: string,
    input: {
      type: OpsNotificationRecord['type'];
      title: string;
      message: string;
      entityId?: string;
    },
  ): Promise<void> {
    await this.repo.saveNotification({
      id: uid('notif'),
      userId: agencyUserId,
      audience: 'client',
      clientId,
      type: input.type,
      title: input.title,
      message: input.message,
      entityId: input.entityId,
      isRead: false,
      createdAt: now(),
    });
  }

  /**
   * Materialise derived notifications (approval pending, invoice due,
   * contract expiring, project completed) from the current AC-001 state.
   * Idempotent: a (type, entityId) pair is only created once per audience.
   */
  private async ensureDerivedNotifications(userId: string): Promise<void> {
    const [content, invoices, projects, contracts, portalAccess] = await Promise.all([
      this.safeArray(this.contentAgency.listContent(userId)),
      this.safeArray(this.contentAgency.listInvoices(userId)),
      this.safeArray(this.contentAgency.listProjects(userId)),
      this.repo.listContracts(userId),
      this.repo.listPortalAccess(userId),
    ]);
    const [agencyExisting, clientExisting] = await Promise.all([
      this.repo.listNotifications(userId, 'agency'),
      this.repo.listNotifications(userId, 'client'),
    ]);
    const agencyKeys = new Set(agencyExisting.map((n) => `${n.type}:${n.entityId ?? ''}`));
    const clientKeys = new Set(clientExisting.map((n) => `${n.type}:${n.entityId ?? ''}`));
    const nowMs = Date.now();
    const timestamp = now();
    const pending: Promise<void>[] = [];

    const create = (n: OpsNotificationRecord): void => {
      pending.push(this.repo.saveNotification(n));
    };

    // Content awaiting client approval (portal access exists for the client).
    for (const item of content) {
      if (item.status === 'review' && portalAccess.some((a) => a.clientId === item.clientId)) {
        const key = `approval_pending:${item.id}`;
        if (!agencyKeys.has(key)) {
          create({
            id: uid('notif'),
            userId,
            audience: 'agency',
            clientId: item.clientId,
            type: 'approval_pending',
            title: 'Content awaiting client approval',
            message: `"${item.title}" is ready for client review.`,
            entityId: item.id,
            isRead: false,
            createdAt: timestamp,
          });
        }
      }
    }

    // Invoices due within 7 days (or overdue) — client audience.
    for (const invoice of invoices) {
      const inv = invoice as { id: string; status?: string; dueDate?: string | null };
      if (inv.status === 'paid' || !inv.dueDate) continue;
      const dueMs = new Date(inv.dueDate).getTime();
      if (dueMs > nowMs + 7 * DAY_MS) continue;
      const key = `invoice_due:${inv.id}`;
      if (!clientKeys.has(key)) {
        create({
          id: uid('notif'),
          userId,
          audience: 'client',
          clientId: invoice.clientId,
          type: 'invoice_due',
          title: 'Invoice due soon',
          message: `Invoice ${this.invoiceNumber(inv.id)} is due ${inv.dueDate}.`,
          entityId: inv.id,
          isRead: false,
          createdAt: timestamp,
        });
      }
    }

    // Active contracts expiring within 30 days — agency audience.
    for (const contract of contracts) {
      if (contract.status !== 'active') continue;
      const endMs = new Date(contract.endDate).getTime();
      if (endMs < nowMs || endMs > nowMs + 30 * DAY_MS) continue;
      const key = `contract_expiring:${contract.id}`;
      if (!agencyKeys.has(key)) {
        create({
          id: uid('notif'),
          userId,
          audience: 'agency',
          clientId: contract.clientId,
          type: 'contract_expiring',
          title: 'Contract expiring',
          message: `Contract "${contract.title}" expires ${contract.endDate}.`,
          entityId: contract.id,
          isRead: false,
          createdAt: timestamp,
        });
      }
    }

    // Recently completed projects — agency audience.
    for (const project of projects) {
      if (project.status !== 'completed') continue;
      const key = `project_completed:${project.id}`;
      if (!agencyKeys.has(key)) {
        create({
          id: uid('notif'),
          userId,
          audience: 'agency',
          clientId: project.clientId,
          type: 'project_completed',
          title: 'Project completed',
          message: `Project "${project.name}" has been completed.`,
          entityId: project.id,
          isRead: false,
          createdAt: timestamp,
        });
      }
    }

    if (pending.length > 0) await Promise.all(pending);
  }

  private async resolvePortalSession(token: string): Promise<
    ClientOpsResult<{
      clientId: string;
      agencyUserId: string;
      company: string;
      email: string;
      lastLoginAt: string | null;
    }>
  > {
    if (!token || token.trim().length < 16)
      return { success: false, error: 'Invalid portal token' };
    const access = await this.repo.findPortalAccessByTokenHash(await sha256Hex(token.trim()));
    if (!access) return { success: false, error: 'Invalid portal token' };
    if (!access.enabled) return { success: false, error: 'Portal access has been revoked' };
    const client = await this.contentAgency.getClient(access.userId, access.clientId);
    if (!client.success || !client.data)
      return { success: false, error: 'Linked client not found' };
    const updated: PortalAccessRecord = { ...access, lastLoginAt: now() };
    await this.repo.savePortalAccess(updated);
    return {
      success: true,
      data: {
        clientId: access.clientId,
        agencyUserId: access.userId,
        company: (client.data as { company?: string }).company ?? 'Client',
        email: access.email,
        lastLoginAt: updated.lastLoginAt,
      },
    };
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

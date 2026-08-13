// ──────────────────────────────────────────────────────────────────
// VedMoulya — Client Operations DTOs
// EPIC-003 / SPRINT AC-002 — Client Operations & Revenue Engine
// DTOs and input contracts for CRM, proposals, contracts, quotations,
// payments, documents, client portal, notifications and analytics.
// ──────────────────────────────────────────────────────────────────

import type {
  LeadStatus,
  InteractionType,
  ProposalPricingLine,
  ProposalContentRecord,
  ProposalStatus,
  ContractStatus,
  QuotationStatus,
  DocumentKind,
  OpsNotificationType,
} from '@vedmoulya/domain';
import type {
  ProjectDTO,
  ContentItemDTO,
  InvoiceDTO,
  DeliveryExportDTO,
} from './ContentAgencyDTO.js';

// Re-exported so callers can type portal payloads without reaching into the
// AC-001 DTO module directly.
export type {
  ProjectDTO,
  ContentItemDTO,
  InvoiceDTO,
  DeliveryExportDTO,
} from './ContentAgencyDTO.js';

// ── CRM — Leads (Module 1) ────────────────────────────────────────────────

export interface LeadDTO {
  id: string;
  company: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  industry: string;
  source: string;
  status: LeadStatus;
  archived: boolean;
  value: number;
  currency: string;
  healthScore: number;
  nextFollowUp: string | null;
  notes: string;
  clientId: string | null;
  openTasks: number;
  createdAt: string;
  updatedAt: string;
}

export interface LeadInteractionDTO {
  id: string;
  type: InteractionType;
  summary: string;
  createdAt: string;
}

export interface LeadTaskDTO {
  id: string;
  title: string;
  dueAt: string | null;
  completed: boolean;
  createdAt: string;
}

export interface LeadContactDTO {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isPrimary: boolean;
  createdAt: string;
}

export interface LeadDetailDTO extends LeadDTO {
  interactions: LeadInteractionDTO[];
  tasks: LeadTaskDTO[];
  contacts: LeadContactDTO[];
}

export interface CreateLeadInput {
  company: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  industry?: string;
  source?: string;
  status?: LeadStatus;
  value?: number;
  currency?: string;
  nextFollowUp?: string | null;
  notes?: string;
}

export type UpdateLeadInput = Partial<CreateLeadInput>;

export interface AddInteractionInput {
  type: InteractionType;
  summary: string;
}

export interface AddTaskInput {
  title: string;
  dueAt?: string | null;
}

export interface AddContactInput {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  isPrimary?: boolean;
}

// ── Proposals (Module 2) ──────────────────────────────────────────────────

export interface ProposalDTO {
  id: string;
  title: string;
  status: ProposalStatus;
  leadId?: string;
  clientId?: string;
  content: ProposalContentRecord;
  aiMetadata?: Record<string, unknown> | null;
  sentAt?: string;
  acceptedAt?: string;
  versionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalVersionDTO {
  version: number;
  content: ProposalContentRecord;
  note?: string;
  createdAt: string;
}

export interface ProposalDetailDTO extends ProposalDTO {
  versions: ProposalVersionDTO[];
}

export interface CreateProposalInput {
  title: string;
  leadId?: string;
  clientId?: string;
  content: ProposalContentRecord;
}

export interface UpdateProposalInput {
  title?: string;
  content?: Partial<ProposalContentRecord>;
}

export interface GenerateProposalInput {
  title: string;
  leadId?: string;
  clientId?: string;
  company: string;
  industry?: string;
  requirements: string;
  scope?: string;
  timeline?: string;
  deliverables?: string[];
  goals?: string[];
  brandVoice?: string;
  pricing?: ProposalPricingLine[];
}

export interface ProposalExportDTO {
  proposalId: string;
  title: string;
  format: 'markdown' | 'html' | 'pdf' | 'docx';
  filename: string;
  data: string;
  supported: boolean;
}

// ── Contracts (Module 3) ──────────────────────────────────────────────────

export interface ContractVersionDTO {
  version: number;
  content: string;
  note?: string;
  createdAt: string;
}

export interface ContractDTO {
  id: string;
  clientId: string;
  title: string;
  startDate: string;
  endDate: string;
  value: number;
  currency: string;
  status: ContractStatus;
  renewal: boolean;
  autoRenew: boolean;
  currentVersion: number;
  approvalCount: number;
  approved: boolean;
  expiresInDays: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractDetailDTO extends ContractDTO {
  versions: ContractVersionDTO[];
  approvals: Array<{ id: string; approved: boolean; comment: string; by: string; at: string }>;
}

export interface CreateContractInput {
  clientId: string;
  title: string;
  startDate: string;
  endDate: string;
  value: number;
  currency?: string;
  renewal?: boolean;
  autoRenew?: boolean;
  content?: string;
}

export interface UpdateContractInput {
  title?: string;
  startDate?: string;
  endDate?: string;
  value?: number;
  content?: string;
  note?: string;
}

export interface ContractApprovalInput {
  approved: boolean;
  comment?: string;
  by: string;
}

export interface RenewContractInput {
  startDate: string;
  endDate: string;
  value?: number;
  note?: string;
}

// ── Quotations (Module 4) ─────────────────────────────────────────────────

export interface QuotationDTO {
  id: string;
  title: string;
  status: QuotationStatus;
  leadId?: string;
  clientId?: string;
  packages: Array<{ name: string; description?: string; price: number; qty?: number }>;
  discount: number;
  taxRate: number;
  recurring: boolean;
  currency: string;
  subtotal: number;
  total: number;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuotationInput {
  title: string;
  leadId?: string;
  clientId?: string;
  packages: Array<{ name: string; description?: string; price: number; qty?: number }>;
  discount?: number;
  taxRate?: number;
  recurring?: boolean;
  currency?: string;
}

export type UpdateQuotationInput = Partial<CreateQuotationInput>;

// ── Payments & Revenue (Modules 5 & 6) ────────────────────────────────────

export interface PaymentDTO {
  id: string;
  invoiceId: string;
  clientId: string;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  currency: string;
  method: string;
  receivedAt: string;
  note: string;
  createdAt: string;
}

export interface AddPaymentInput {
  invoiceId: string;
  amount: number;
  currency?: string;
  method?: string;
  receivedAt?: string;
  note?: string;
}

export interface RevenueOverviewDTO {
  currency: string;
  paidTotal: number;
  outstanding: number;
  overdueCount: number;
  paidCount: number;
  pendingCount: number;
  annualRevenue: number;
  monthlyRevenue: Array<{ month: string; amount: number }>;
  cashflow: Array<{ month: string; received: number; outstanding: number }>;
}

// ── Documents (Module 8) ──────────────────────────────────────────────────

export interface DocumentDTO {
  id: string;
  clientId: string;
  projectId?: string;
  contractId?: string;
  name: string;
  kind: DocumentKind;
  mime: string;
  size: number;
  metadata: Record<string, unknown>;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentDetailDTO extends DocumentDTO {
  storageKey: string;
  versions: Array<{ version: number; size: number; note?: string; createdAt: string }>;
}

export interface UploadDocumentInput {
  clientId: string;
  projectId?: string;
  contractId?: string;
  name: string;
  kind: DocumentKind;
  mime: string;
  contentBase64: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateDocumentInput {
  contentBase64?: string;
  mime?: string;
  note?: string;
  name?: string;
}

// ── Client Portal (Module 7) ──────────────────────────────────────────────

export interface PortalAccessDTO {
  id: string;
  clientId: string;
  email: string;
  enabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CreatePortalAccessInput {
  clientId: string;
  email: string;
}

export interface CreatePortalAccessResult {
  access: PortalAccessDTO;
  /** One-time display token — the client uses it to sign in. */
  rawToken: string;
}

export interface PortalSessionDTO {
  clientId: string;
  company: string;
  email: string;
  lastLoginAt: string | null;
}

export interface PortalDashboardDTO {
  session: PortalSessionDTO;
  projects: ProjectDTO[];
  contentStats: { total: number; awaitingApproval: number; published: number };
  content: ContentItemDTO[];
  invoices: InvoiceDTO[];
  notifications: OpsNotificationDTO[];
}

export interface PortalContentPayload {
  content: ContentItemDTO;
  deliverable: DeliveryExportDTO | null;
}

// ── Notifications (Module 9) ──────────────────────────────────────────────

export interface OpsNotificationDTO {
  id: string;
  audience: 'agency' | 'client';
  clientId?: string;
  type: OpsNotificationType;
  title: string;
  message: string;
  entityId?: string;
  isRead: boolean;
  createdAt: string;
}

// ── Business Analytics (Module 10) ────────────────────────────────────────

export interface BusinessAnalyticsDTO {
  revenue: {
    total: number;
    monthly: Array<{ month: string; amount: number }>;
  };
  clients: { total: number; newThisMonth: number };
  projects: { total: number; active: number; completed: number };
  winRate: number;
  approvalTimeDays: number;
  aiUsage: { requests: number; tokens: number; cost: number };
  contentGenerated: number;
  avgDeliveryDays: number;
}

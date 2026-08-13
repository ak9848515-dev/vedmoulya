// ──────────────────────────────────────────────────────────────────
// VedMoulya — Client Operations Domain Types
// EPIC-003 / SPRINT AC-002 — Client Operations & Revenue Engine
// Records for: CRM (leads), proposals, contracts, quotations,
// payments, documents, client portal access, and operations
// notifications. The AC-001 content-agency types remain the source
// of truth for clients/brands/projects/content/invoices.
// ──────────────────────────────────────────────────────────────────

// ── CRM — Leads (Module 1) ─────────────────────────────────────────────────

export type LeadStatus = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

export interface LeadRecord {
  id: string;
  userId: string;
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
  /** Linked AC-001 client id — populated automatically when a lead is won. */
  clientId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type InteractionType = 'call' | 'email' | 'meeting' | 'note' | 'proposal' | 'other';

export interface LeadInteractionRecord {
  id: string;
  leadId: string;
  userId: string;
  type: InteractionType;
  summary: string;
  createdAt: string;
}

export interface LeadTaskRecord {
  id: string;
  leadId: string;
  userId: string;
  title: string;
  dueAt: string | null;
  completed: boolean;
  createdAt: string;
}

export interface LeadContactRecord {
  id: string;
  leadId: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isPrimary: boolean;
  createdAt: string;
}

// ── Proposals (Module 2) ───────────────────────────────────────────────────

export type ProposalStatus = 'draft' | 'sent' | 'accepted' | 'rejected';

export interface ProposalPricingLine {
  label: string;
  description?: string;
  amount: number;
}

export interface ProposalContentRecord {
  company: string;
  requirements: string;
  scope: string;
  timeline: string;
  deliverables: string[];
  terms: string;
  pricing: ProposalPricingLine[];
  notes?: string;
  /** Full proposal document (AI-generated or manually authored, Markdown). */
  document?: string;
}

export interface ProposalVersionRecord {
  version: number;
  content: ProposalContentRecord;
  createdAt: string;
  note?: string;
}

export interface ProposalRecord {
  id: string;
  userId: string;
  leadId?: string;
  clientId?: string;
  title: string;
  status: ProposalStatus;
  currentVersion: number;
  versions: ProposalVersionRecord[];
  aiMetadata?: Record<string, unknown> | null;
  sentAt?: string;
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Contracts (Module 3) ───────────────────────────────────────────────────

export type ContractStatus = 'draft' | 'active' | 'expired' | 'terminated';

export interface ContractVersionRecord {
  version: number;
  content: string;
  createdAt: string;
  note?: string;
}

export interface ContractApprovalRecord {
  id: string;
  approved: boolean;
  comment: string;
  by: string;
  at: string;
}

export interface ContractRecord {
  id: string;
  userId: string;
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
  versions: ContractVersionRecord[];
  approvals: ContractApprovalRecord[];
  createdAt: string;
  updatedAt: string;
}

// ── Quotations (Module 4) ──────────────────────────────────────────────────

export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected';

export interface QuotationPackageRecord {
  name: string;
  description?: string;
  price: number;
  qty?: number;
}

export interface QuotationRecord {
  id: string;
  userId: string;
  leadId?: string;
  clientId?: string;
  title: string;
  status: QuotationStatus;
  packages: QuotationPackageRecord[];
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

// ── Payments (Module 6) ────────────────────────────────────────────────────

export interface PaymentRecord {
  id: string;
  userId: string;
  invoiceId: string;
  clientId: string;
  amount: number;
  currency: string;
  method: string;
  receivedAt: string;
  note: string;
  createdAt: string;
}

// ── Documents (Module 8) ───────────────────────────────────────────────────

export type DocumentKind =
  'brand_guidelines' | 'logo' | 'reference' | 'research' | 'contract' | 'image' | 'other';

export interface DocumentVersionRecord {
  version: number;
  storageKey: string;
  size: number;
  createdAt: string;
  note?: string;
}

export interface DocumentRecord {
  id: string;
  userId: string;
  clientId: string;
  projectId?: string;
  contractId?: string;
  name: string;
  kind: DocumentKind;
  mime: string;
  size: number;
  /** MVP storage: a data-URL payload (size-capped). Upgradable to object storage. */
  storageKey: string;
  metadata: Record<string, unknown>;
  currentVersion: number;
  versions: DocumentVersionRecord[];
  createdAt: string;
  updatedAt: string;
}

// ── Client Portal Access (Module 7) ────────────────────────────────────────

export interface PortalAccessRecord {
  id: string;
  userId: string;
  clientId: string;
  email: string;
  tokenHash: string;
  enabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

// ── Operations Notifications (Module 9) ────────────────────────────────────

export type OpsNotificationType =
  | 'proposal_sent'
  | 'approval_pending'
  | 'invoice_due'
  | 'project_completed'
  | 'client_comment'
  | 'contract_expiring';

export type OpsNotificationAudience = 'agency' | 'client';

export interface OpsNotificationRecord {
  id: string;
  userId: string;
  audience: OpsNotificationAudience;
  clientId?: string;
  type: OpsNotificationType;
  title: string;
  message: string;
  entityId?: string;
  isRead: boolean;
  createdAt: string;
}

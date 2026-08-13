// ──────────────────────────────────────────────────────────────────
// VedMoulya — Content Agency DTOs
// EPIC-003 / SPRINT AC-001 — AI Content Agency Foundation
// DTOs mirror the @vedmoulya/domain records 1:1 (they are JSON-serializable),
// plus the input DTOs consumed by the tRPC surface and the view models.
// ──────────────────────────────────────────────────────────────────

import type {
  ClientRecord,
  BrandRecord,
  ProjectRecord,
  ContentItemRecord,
  InvoiceRecord,
  ContentType,
  ContentStatus,
  WorkflowStage,
} from '@vedmoulya/domain';

// ── Read models (alias the domain records) ─────────────────────────────────

export type ClientDTO = ClientRecord;
export type BrandDTO = BrandRecord;
export type ProjectDTO = ProjectRecord;
export type ContentItemDTO = ContentItemRecord;
export type InvoiceDTO = InvoiceRecord;

export type { ContentType, ContentStatus, WorkflowStage };

// ── Input DTOs ─────────────────────────────────────────────────────────────

export interface CreateClientInput {
  company: string;
  industry?: string;
  brandVoice?: string;
  targetAudience?: string;
  products?: string[];
  services?: string[];
  goals?: string[];
  website?: string;
  socialLinks?: Record<string, string>;
  aiMemory?: string;
  documents?: Array<{ name: string; type: string }>;
}

export type UpdateClientInput = Partial<CreateClientInput>;

export interface UpsertBrandInput {
  id?: string;
  clientId?: string | null;
  name: string;
  tone?: string;
  writingStyle?: string;
  vocabulary?: string[];
  doRules?: string[];
  dontRules?: string[];
  ctaStyle?: string;
  competitors?: string[];
  keywords?: string[];
  colorPalette?: string[];
  mission?: string;
  vision?: string;
}

export interface CreateProjectInput {
  clientId: string;
  brandId?: string | null;
  name: string;
  description?: string;
  status?: ProjectRecord['status'];
  startDate?: string;
  endDate?: string | null;
}

export type UpdateProjectInput = Partial<Omit<CreateProjectInput, 'clientId'>>;

export interface GenerateContentInput {
  clientId: string;
  brandId?: string | null;
  projectId?: string | null;
  contentType: ContentType;
  title: string;
  brief: string;
  goals?: string[];
  targetAudience?: string;
  qualityTier?: 'premium' | 'standard' | 'economy';
}

export interface CreateDraftInput {
  clientId: string;
  brandId?: string | null;
  projectId?: string | null;
  contentType: ContentType;
  title: string;
  brief: string;
  content?: string;
}

export interface ReviewInput {
  stage: WorkflowStage;
  reviewer: string;
  comment: string;
  decision: 'comment' | 'accepted' | 'rejected';
  score?: number | null;
}

export interface RegenerateInput {
  feedback: string;
  qualityTier?: 'premium' | 'standard' | 'economy';
}

export interface CreateInvoiceInput {
  clientId: string;
  projectId?: string | null;
  description?: string;
  amount: number;
  currency?: string;
  status?: InvoiceRecord['status'];
  issuedAt?: string;
  dueDate?: string | null;
}

// ── View models ────────────────────────────────────────────────────────────

export interface CalendarEntryDTO {
  contentId: string;
  title: string;
  contentType: ContentType;
  status: ContentStatus;
  workflowStage: WorkflowStage;
  scheduledFor: string;
  clientId: string;
  clientName: string;
}

export interface ContentAgencyDashboardDTO {
  analytics: ContentAgencyAnalyticsDTO;
  upcomingContent: CalendarEntryDTO[];
  recentContent: ContentItemDTO[];
  activeClients: number;
  activeProjects: number;
}

export interface ContentAgencyAnalyticsDTO {
  contentCreated: number;
  clients: number;
  projects: number;
  revenue: number;
  timeSavedMinutes: number;
  aiUsage: {
    generations: number;
    tokens: number;
    cost: number;
    avgQualityScore: number;
  };
  byStatus: Record<string, number>;
  byContentType: Record<string, number>;
  byClient: Array<{ clientId: string; clientName: string; contentCount: number }>;
}

export type DeliveryFormat = 'markdown' | 'html' | 'pdf' | 'docx';

export interface DeliveryExportDTO {
  contentId: string;
  title: string;
  format: DeliveryFormat;
  filename: string;
  /** Payload: markdown/html text, or a base64 data URL for PDF. */
  data: string;
  /** DOCX + Google Docs are roadmap items (AC-001 notes). */
  supported: boolean;
}

export interface ContentAgencyResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ──────────────────────────────────────────────────────────────────
// VedMoulya — Content Agency Domain Records
// EPIC-003 / SPRINT AC-001 — AI Content Agency Foundation
// Persistable record shapes shared by the repository contract, the
// Postgres implementation and the in-memory test implementation.
// These are plain JSON-serializable records (no class semantics) so
// they map 1:1 to Drizzle table rows.
// ──────────────────────────────────────────────────────────────────

// ── Content Type & Workflow ───────────────────────────────────────────────

export type ContentType =
  | 'blog'
  | 'linkedin'
  | 'twitter'
  | 'instagram'
  | 'facebook'
  | 'email'
  | 'website_copy'
  | 'landing_page'
  | 'ad_copy'
  | 'product_description'
  | 'case_study'
  | 'script';

export type ContentStatus = 'draft' | 'review' | 'approved' | 'scheduled' | 'published';

export type WorkflowStage =
  | 'brief'
  | 'research'
  | 'outline'
  | 'draft'
  | 'review'
  | 'improve'
  | 'seo'
  | 'grammar'
  | 'brand_alignment'
  | 'approval'
  | 'delivery';

export type ReviewDecision = 'comment' | 'accepted' | 'rejected';

// ── Records ───────────────────────────────────────────────────────────────

export interface ClientRecord {
  id: string;
  userId: string;
  company: string;
  industry: string;
  brandVoice: string;
  targetAudience: string;
  products: string[];
  services: string[];
  goals: string[];
  website: string;
  socialLinks: Record<string, string>;
  aiMemory: string;
  documents: Array<{ name: string; type: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface BrandRecord {
  id: string;
  userId: string;
  clientId: string | null;
  name: string;
  tone: string;
  writingStyle: string;
  vocabulary: string[];
  doRules: string[];
  dontRules: string[];
  ctaStyle: string;
  competitors: string[];
  keywords: string[];
  colorPalette: string[];
  mission: string;
  vision: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRecord {
  id: string;
  userId: string;
  clientId: string;
  brandId: string | null;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  startDate: string;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One draft of a content item — the version history. */
export interface ContentVersionRecord {
  id: string;
  content: string;
  length: number;
  generatedBy: 'ai' | 'human';
  feedback: string | null;
  createdAt: string;
}

/** A review pass: brand alignment, grammar, SEO, or human approval. */
export interface ContentReviewRecord {
  id: string;
  stage: WorkflowStage;
  reviewer: string;
  comment: string;
  decision: ReviewDecision;
  score: number | null;
  createdAt: string;
}

/** Full AI traceability for every generated asset (AC-001 requirement). */
export interface ContentAIMetadata {
  capability: string;
  prompt: {
    system: string;
    user: string;
    sections: string[];
  };
  provider: string;
  model: string;
  qualityScore: number;
  traceId: string;
  tokenUsage: { input: number; output: number; total: number };
  cost: number;
  latencyMs: number;
  researchNotes: string;
  researchTraceId: string | null;
  passes: Array<{ stage: WorkflowStage; score: number; traceId: string | null }>;
}

export interface ContentItemRecord {
  id: string;
  userId: string;
  clientId: string;
  brandId: string | null;
  projectId: string | null;
  contentType: ContentType;
  title: string;
  status: ContentStatus;
  workflowStage: WorkflowStage;
  brief: string;
  targetAudience: string;
  goals: string[];
  versions: ContentVersionRecord[];
  reviews: ContentReviewRecord[];
  aiMetadata: ContentAIMetadata | null;
  scheduledFor: string | null;
  publishedUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceRecord {
  id: string;
  userId: string;
  clientId: string;
  projectId: string | null;
  description: string;
  amount: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid';
  issuedAt: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

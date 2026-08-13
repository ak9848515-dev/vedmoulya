// ──────────────────────────────────────────────────────────────────
// VedMoulya — Content Agency Application Service
// EPIC-003 / SPRINT AC-001 — AI Content Agency Foundation
//
// Facade over the ContentAgencyRepository (persistence) and the
// ContentAgencyAIService (enterprise AI pipeline routed exclusively
// through the shared AI Orchestrator). Every generation is persisted
// as a traceable asset: prompt, provider, model, versions, quality
// score and review history — reusable across future business modules.
// ──────────────────────────────────────────────────────────────────

import type {
  ContentAgencyRepository,
  ClientRecord,
  BrandRecord,
  ProjectRecord,
  ContentItemRecord,
  ContentVersionRecord,
  ContentReviewRecord,
  InvoiceRecord,
  ContentStatus,
  WorkflowStage,
} from '@vedmoulya/domain';

import { ContentAgencyAIService } from './ContentAgencyAIService.js';
import type { GenerationContext } from './ContentAgencyAIService.js';
import type {
  CreateClientInput,
  UpdateClientInput,
  UpsertBrandInput,
  CreateProjectInput,
  UpdateProjectInput,
  GenerateContentInput,
  CreateDraftInput,
  ReviewInput,
  RegenerateInput,
  CreateInvoiceInput,
  CalendarEntryDTO,
  ContentAgencyDashboardDTO,
  ContentAgencyAnalyticsDTO,
  DeliveryExportDTO,
} from './ContentAgencyDTO.js';

export interface ContentAgencyResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const uid = (prefix: string): string => `${prefix}_${crypto.randomUUID().slice(0, 12)}`;
const now = (): string => new Date().toISOString();

// Workflow stages by content status (mirrors the AC-001 AI workflow).
const STATUS_TO_STAGE: Record<ContentStatus, WorkflowStage> = {
  draft: 'draft',
  review: 'review',
  approved: 'approval',
  scheduled: 'approval',
  published: 'delivery',
};

export class ContentAgencyApplicationService {
  private readonly repo: ContentAgencyRepository;
  private readonly ai: ContentAgencyAIService;

  constructor(repo: ContentAgencyRepository, ai: ContentAgencyAIService) {
    this.repo = repo;
    this.ai = ai;
  }

  // ── Clients ─────────────────────────────────────────────────────────────

  async createClient(
    userId: string,
    input: CreateClientInput,
  ): Promise<ContentAgencyResult<ClientRecord>> {
    if (!input.company.trim()) return { success: false, error: 'Company name is required' };
    const ts = now();
    const client: ClientRecord = {
      id: uid('cli'),
      userId,
      company: input.company.trim(),
      industry: input.industry ?? '',
      brandVoice: input.brandVoice ?? '',
      targetAudience: input.targetAudience ?? '',
      products: input.products ?? [],
      services: input.services ?? [],
      goals: input.goals ?? [],
      website: input.website ?? '',
      socialLinks: input.socialLinks ?? {},
      aiMemory: input.aiMemory ?? '',
      documents: input.documents ?? [],
      createdAt: ts,
      updatedAt: ts,
    };
    await this.repo.saveClient(client);
    return { success: true, data: client };
  }

  async listClients(userId: string): Promise<ContentAgencyResult<ClientRecord[]>> {
    return { success: true, data: await this.repo.listClients(userId) };
  }

  async getClient(userId: string, clientId: string): Promise<ContentAgencyResult<ClientRecord>> {
    const client = await this.repo.findClientById(clientId, userId);
    if (!client) return { success: false, error: 'Client not found' };
    return { success: true, data: client };
  }

  async updateClient(
    userId: string,
    clientId: string,
    updates: UpdateClientInput,
  ): Promise<ContentAgencyResult<ClientRecord>> {
    const existing = await this.repo.findClientById(clientId, userId);
    if (!existing) return { success: false, error: 'Client not found' };
    const client: ClientRecord = {
      ...existing,
      ...updates,
      id: existing.id,
      userId: existing.userId,
      createdAt: existing.createdAt,
      updatedAt: now(),
    };
    await this.repo.saveClient(client);
    return { success: true, data: client };
  }

  async deleteClient(userId: string, clientId: string): Promise<ContentAgencyResult<void>> {
    const existing = await this.repo.findClientById(clientId, userId);
    if (!existing) return { success: false, error: 'Client not found' };
    await this.repo.deleteClient(clientId, userId);
    return { success: true };
  }

  // ── Brands ──────────────────────────────────────────────────────────────

  async upsertBrand(
    userId: string,
    input: UpsertBrandInput,
  ): Promise<ContentAgencyResult<BrandRecord>> {
    if (!input.name.trim()) return { success: false, error: 'Brand name is required' };
    const ts = now();
    const existing = input.id ? await this.repo.findBrandById(input.id, userId) : null;
    // Updates preserve untouched fields (partial upsert semantics).
    const brand: BrandRecord = {
      id: existing?.id ?? uid('brd'),
      userId,
      clientId: input.clientId !== undefined ? input.clientId : (existing?.clientId ?? null),
      name: input.name.trim(),
      tone: input.tone ?? existing?.tone ?? '',
      writingStyle: input.writingStyle ?? existing?.writingStyle ?? '',
      vocabulary: input.vocabulary ?? existing?.vocabulary ?? [],
      doRules: input.doRules ?? existing?.doRules ?? [],
      dontRules: input.dontRules ?? existing?.dontRules ?? [],
      ctaStyle: input.ctaStyle ?? existing?.ctaStyle ?? '',
      competitors: input.competitors ?? existing?.competitors ?? [],
      keywords: input.keywords ?? existing?.keywords ?? [],
      colorPalette: input.colorPalette ?? existing?.colorPalette ?? [],
      mission: input.mission ?? existing?.mission ?? '',
      vision: input.vision ?? existing?.vision ?? '',
      createdAt: existing?.createdAt ?? ts,
      updatedAt: ts,
    };
    await this.repo.saveBrand(brand);
    return { success: true, data: brand };
  }

  async listBrands(userId: string): Promise<ContentAgencyResult<BrandRecord[]>> {
    return { success: true, data: await this.repo.listBrands(userId) };
  }

  async getBrand(userId: string, brandId: string): Promise<ContentAgencyResult<BrandRecord>> {
    const brand = await this.repo.findBrandById(brandId, userId);
    if (!brand) return { success: false, error: 'Brand not found' };
    return { success: true, data: brand };
  }

  async deleteBrand(userId: string, brandId: string): Promise<ContentAgencyResult<void>> {
    const existing = await this.repo.findBrandById(brandId, userId);
    if (!existing) return { success: false, error: 'Brand not found' };
    await this.repo.deleteBrand(brandId, userId);
    return { success: true };
  }

  // ── Projects ────────────────────────────────────────────────────────────

  async createProject(
    userId: string,
    input: CreateProjectInput,
  ): Promise<ContentAgencyResult<ProjectRecord>> {
    if (!input.name.trim()) return { success: false, error: 'Project name is required' };
    const client = await this.repo.findClientById(input.clientId, userId);
    if (!client) return { success: false, error: 'Client not found' };
    const ts = now();
    const project: ProjectRecord = {
      id: uid('prj'),
      userId,
      clientId: input.clientId,
      brandId: input.brandId ?? null,
      name: input.name.trim(),
      description: input.description ?? '',
      status: input.status ?? 'active',
      startDate: input.startDate ?? ts,
      endDate: input.endDate ?? null,
      createdAt: ts,
      updatedAt: ts,
    };
    await this.repo.saveProject(project);
    return { success: true, data: project };
  }

  async listProjects(userId: string): Promise<ContentAgencyResult<ProjectRecord[]>> {
    return { success: true, data: await this.repo.listProjects(userId) };
  }

  async getProject(userId: string, projectId: string): Promise<ContentAgencyResult<ProjectRecord>> {
    const project = await this.repo.findProjectById(projectId, userId);
    if (!project) return { success: false, error: 'Project not found' };
    return { success: true, data: project };
  }

  async updateProject(
    userId: string,
    projectId: string,
    updates: UpdateProjectInput,
  ): Promise<ContentAgencyResult<ProjectRecord>> {
    const existing = await this.repo.findProjectById(projectId, userId);
    if (!existing) return { success: false, error: 'Project not found' };
    const project: ProjectRecord = {
      ...existing,
      ...updates,
      id: existing.id,
      userId: existing.userId,
      clientId: existing.clientId,
      createdAt: existing.createdAt,
      updatedAt: now(),
    };
    await this.repo.saveProject(project);
    return { success: true, data: project };
  }

  async deleteProject(userId: string, projectId: string): Promise<ContentAgencyResult<void>> {
    const existing = await this.repo.findProjectById(projectId, userId);
    if (!existing) return { success: false, error: 'Project not found' };
    await this.repo.deleteProject(projectId, userId);
    return { success: true };
  }

  // ── Content Generation (enterprise AI pipeline) ─────────────────────────

  async generateContent(
    userId: string,
    input: GenerateContentInput,
  ): Promise<ContentAgencyResult<ContentItemRecord>> {
    const client = await this.repo.findClientById(input.clientId, userId);
    if (!client) return { success: false, error: 'Client not found' };
    const brand = input.brandId ? await this.repo.findBrandById(input.brandId, userId) : null;

    const ctx: GenerationContext = {
      client,
      brand,
      contentType: input.contentType,
      title: input.title,
      brief: input.brief,
      goals: input.goals ?? client.goals,
      targetAudience: input.targetAudience ?? client.targetAudience,
    };

    const ts = now();
    const contentId = uid('ctn');
    const ai = this.ai.withQualityTier(input.qualityTier);

    try {
      const result = await ai.generate(userId, ctx);
      const version: ContentVersionRecord = {
        id: uid('ver'),
        content: result.content,
        length: result.content.length,
        generatedBy: 'ai',
        feedback: null,
        createdAt: ts,
      };
      const item: ContentItemRecord = {
        id: contentId,
        userId,
        clientId: input.clientId,
        brandId: input.brandId ?? null,
        projectId: input.projectId ?? null,
        contentType: input.contentType,
        title: input.title,
        status: 'draft',
        workflowStage: 'draft',
        brief: input.brief,
        targetAudience: ctx.targetAudience,
        goals: ctx.goals,
        versions: [version],
        reviews: [],
        aiMetadata: result.aiMetadata,
        scheduledFor: null,
        publishedUrl: null,
        createdAt: ts,
        updatedAt: ts,
      };
      await this.repo.saveContent(item);
      return { success: true, data: item };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Content generation failed. Check AI provider availability.',
      };
    }
  }

  /** Manual draft (human-authored) — still captured as a versioned asset. */
  async createDraft(
    userId: string,
    input: CreateDraftInput,
  ): Promise<ContentAgencyResult<ContentItemRecord>> {
    const client = await this.repo.findClientById(input.clientId, userId);
    if (!client) return { success: false, error: 'Client not found' };
    const ts = now();
    const version: ContentVersionRecord = {
      id: uid('ver'),
      content: input.content ?? '',
      length: input.content?.length ?? 0,
      generatedBy: 'human',
      feedback: null,
      createdAt: ts,
    };
    const item: ContentItemRecord = {
      id: uid('ctn'),
      userId,
      clientId: input.clientId,
      brandId: input.brandId ?? null,
      projectId: input.projectId ?? null,
      contentType: input.contentType,
      title: input.title,
      status: 'draft',
      workflowStage: 'draft',
      brief: input.brief,
      targetAudience: client.targetAudience,
      goals: client.goals,
      versions: [version],
      reviews: [],
      aiMetadata: null,
      scheduledFor: null,
      publishedUrl: null,
      createdAt: ts,
      updatedAt: ts,
    };
    await this.repo.saveContent(item);
    return { success: true, data: item };
  }

  // ── Content Workflow ────────────────────────────────────────────────────

  async listContent(userId: string): Promise<ContentAgencyResult<ContentItemRecord[]>> {
    return { success: true, data: await this.repo.listContent(userId) };
  }

  async getContent(
    userId: string,
    contentId: string,
  ): Promise<ContentAgencyResult<ContentItemRecord>> {
    const item = await this.repo.findContentById(contentId, userId);
    if (!item) return { success: false, error: 'Content item not found' };
    return { success: true, data: item };
  }

  /** Move a content item to the next workflow status (draft → review → approved → scheduled → published). */
  async transitionStatus(
    userId: string,
    contentId: string,
    to: ContentStatus,
  ): Promise<ContentAgencyResult<ContentItemRecord>> {
    const item = await this.repo.findContentById(contentId, userId);
    if (!item) return { success: false, error: 'Content item not found' };
    if (item.status === 'published') {
      return { success: false, error: 'Published content cannot transition' };
    }
    const updated: ContentItemRecord = {
      ...item,
      status: to,
      // STATUS_TO_STAGE is a closed literal-key map and `to` is a validated
      // ContentStatus — no untrusted keys reach this lookup.
      // eslint-disable-next-line security/detect-object-injection
      workflowStage: STATUS_TO_STAGE[to],
      updatedAt: now(),
    };
    await this.repo.saveContent(updated);
    return { success: true, data: updated };
  }

  async scheduleContent(
    userId: string,
    contentId: string,
    scheduledFor: string,
  ): Promise<ContentAgencyResult<ContentItemRecord>> {
    const item = await this.repo.findContentById(contentId, userId);
    if (!item) return { success: false, error: 'Content item not found' };
    const updated: ContentItemRecord = {
      ...item,
      scheduledFor,
      status: 'scheduled',
      workflowStage: 'approval',
      updatedAt: now(),
    };
    await this.repo.saveContent(updated);
    return { success: true, data: updated };
  }

  async publishContent(
    userId: string,
    contentId: string,
    publishedUrl?: string,
  ): Promise<ContentAgencyResult<ContentItemRecord>> {
    const item = await this.repo.findContentById(contentId, userId);
    if (!item) return { success: false, error: 'Content item not found' };
    const updated: ContentItemRecord = {
      ...item,
      status: 'published',
      workflowStage: 'delivery',
      publishedUrl: publishedUrl ?? item.publishedUrl,
      scheduledFor: item.scheduledFor ?? now(),
      updatedAt: now(),
    };
    await this.repo.saveContent(updated);
    return { success: true, data: updated };
  }

  // ── Review & Approval ───────────────────────────────────────────────────

  /** Add a review pass (brand/grammar/seo) or a human review decision. */
  async addReview(
    userId: string,
    contentId: string,
    input: ReviewInput,
  ): Promise<ContentAgencyResult<ContentItemRecord>> {
    const item = await this.repo.findContentById(contentId, userId);
    if (!item) return { success: false, error: 'Content item not found' };
    const review: ContentReviewRecord = {
      id: uid('rev'),
      stage: input.stage,
      reviewer: input.reviewer,
      comment: input.comment,
      decision: input.decision,
      score: input.score ?? null,
      createdAt: now(),
    };
    let updated: ContentItemRecord = {
      ...item,
      reviews: [...item.reviews, review],
      updatedAt: now(),
    };
    if (input.decision === 'accepted') {
      updated = {
        ...updated,
        status: 'approved',
        workflowStage: 'approval',
      };
    } else if (input.decision === 'rejected') {
      updated = {
        ...updated,
        status: 'review',
        workflowStage: 'review',
      };
    } else {
      // Comment only — return to review so the team can act on it.
      updated = {
        ...updated,
        status: item.status === 'approved' ? 'review' : item.status,
        workflowStage: 'review',
      };
    }
    await this.repo.saveContent(updated);
    return { success: true, data: updated };
  }

  /** Regenerate with human feedback — produces a new version, keeps history. */
  async regenerateContent(
    userId: string,
    contentId: string,
    input: RegenerateInput,
  ): Promise<ContentAgencyResult<ContentItemRecord>> {
    const item = await this.repo.findContentById(contentId, userId);
    if (!item) return { success: false, error: 'Content item not found' };
    if (!item.aiMetadata)
      return { success: false, error: 'Only AI-generated content can be regenerated' };
    const client = await this.repo.findClientById(item.clientId, userId);
    if (!client) return { success: false, error: 'Client not found' };
    const brand = item.brandId ? await this.repo.findBrandById(item.brandId, userId) : null;

    const ctx: GenerationContext = {
      client,
      brand,
      contentType: item.contentType,
      title: item.title,
      brief: item.brief,
      goals: item.goals,
      targetAudience: item.targetAudience,
    };

    try {
      const ai = this.ai.withQualityTier(input.qualityTier);
      const result = await ai.regenerate(userId, ctx, item.aiMetadata, input.feedback);
      const version: ContentVersionRecord = {
        id: uid('ver'),
        content: result.content,
        length: result.content.length,
        generatedBy: 'ai',
        feedback: input.feedback,
        createdAt: now(),
      };
      const updated: ContentItemRecord = {
        ...item,
        versions: [...item.versions, version],
        aiMetadata: result.aiMetadata,
        status: 'review',
        workflowStage: 'review',
        updatedAt: now(),
      };
      await this.repo.saveContent(updated);
      return { success: true, data: updated };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Regeneration failed',
      };
    }
  }

  // ── Content Calendar ────────────────────────────────────────────────────

  async getCalendar(
    userId: string,
    range: 'month' | 'week' | 'day',
    anchor?: string,
  ): Promise<ContentAgencyResult<CalendarEntryDTO[]>> {
    const all = await this.repo.listContent(userId);
    const clients = await this.repo.listClients(userId);
    const clientName = new Map(clients.map((c) => [c.id, c.company]));
    // Parse date-only anchors at local noon so day/month boundaries don't
    // shift across timezones (UTC-midnight parsing can land on the prior day).
    const anchorDate = anchor ? new Date(`${anchor}T12:00:00`) : new Date();

    const entries: CalendarEntryDTO[] = all
      .filter((item) => item.scheduledFor !== null)
      .map(
        (item) =>
          ({
            contentId: item.id,
            title: item.title,
            contentType: item.contentType,
            status: item.status,
            workflowStage: item.workflowStage,
            scheduledFor: item.scheduledFor,
            clientId: item.clientId,
            clientName: clientName.get(item.clientId) ?? 'Unknown client',
          }) as CalendarEntryDTO,
      )
      .filter((e) => {
        const d = new Date(e.scheduledFor);
        return range === 'day'
          ? d.toDateString() === anchorDate.toDateString()
          : range === 'week'
            ? this.sameWeek(d, anchorDate)
            : d.getMonth() === anchorDate.getMonth() &&
              d.getFullYear() === anchorDate.getFullYear();
      })
      .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));

    return { success: true, data: entries };
  }

  // ── Invoices ────────────────────────────────────────────────────────────

  async createInvoice(
    userId: string,
    input: CreateInvoiceInput,
  ): Promise<ContentAgencyResult<InvoiceRecord>> {
    const client = await this.repo.findClientById(input.clientId, userId);
    if (!client) return { success: false, error: 'Client not found' };
    if (input.amount < 0) return { success: false, error: 'Amount cannot be negative' };
    const ts = now();
    const invoice: InvoiceRecord = {
      id: uid('inv'),
      userId,
      clientId: input.clientId,
      projectId: input.projectId ?? null,
      description: input.description ?? '',
      amount: input.amount,
      currency: input.currency ?? 'USD',
      status: input.status ?? 'draft',
      issuedAt: input.issuedAt ?? ts,
      dueDate: input.dueDate ?? null,
      createdAt: ts,
      updatedAt: ts,
    };
    await this.repo.saveInvoice(invoice);
    return { success: true, data: invoice };
  }

  async listInvoices(userId: string): Promise<ContentAgencyResult<InvoiceRecord[]>> {
    return { success: true, data: await this.repo.listInvoices(userId) };
  }

  async getInvoice(userId: string, invoiceId: string): Promise<ContentAgencyResult<InvoiceRecord>> {
    const invoice = await this.repo.findInvoiceById(invoiceId, userId);
    if (!invoice) return { success: false, error: 'Invoice not found' };
    return { success: true, data: invoice };
  }

  async updateInvoiceStatus(
    userId: string,
    invoiceId: string,
    status: InvoiceRecord['status'],
  ): Promise<ContentAgencyResult<InvoiceRecord>> {
    const invoice = await this.repo.findInvoiceById(invoiceId, userId);
    if (!invoice) return { success: false, error: 'Invoice not found' };
    const updated: InvoiceRecord = { ...invoice, status, updatedAt: now() };
    await this.repo.saveInvoice(updated);
    return { success: true, data: updated };
  }

  async deleteInvoice(userId: string, invoiceId: string): Promise<ContentAgencyResult<void>> {
    const existing = await this.repo.findInvoiceById(invoiceId, userId);
    if (!existing) return { success: false, error: 'Invoice not found' };
    await this.repo.deleteInvoice(invoiceId, userId);
    return { success: true };
  }

  // ── Analytics ───────────────────────────────────────────────────────────

  async getAnalytics(userId: string): Promise<ContentAgencyResult<ContentAgencyAnalyticsDTO>> {
    const [content, clients, projects, invoices] = await Promise.all([
      this.repo.listContent(userId),
      this.repo.listClients(userId),
      this.repo.listProjects(userId),
      this.repo.listInvoices(userId),
    ]);

    const aiItems = content.filter((c) => c.aiMetadata !== null);
    const generations = aiItems.reduce(
      (s, c) => s + Math.max(1, c.versions.filter((v) => v.generatedBy === 'ai').length),
      0,
    );
    const tokens = aiItems.reduce((s, c) => s + (c.aiMetadata?.tokenUsage.total ?? 0), 0);
    const cost = aiItems.reduce((s, c) => s + (c.aiMetadata?.cost ?? 0), 0);
    const avgQuality = aiItems.length
      ? aiItems.reduce((s, c) => s + (c.aiMetadata?.qualityScore ?? 0), 0) / aiItems.length
      : 0;
    const revenue = invoices.filter((i) => i.status !== 'draft').reduce((s, i) => s + i.amount, 0);

    const byStatus: Record<string, number> = {};
    for (const c of content) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    const byContentType: Record<string, number> = {};
    for (const c of content) byContentType[c.contentType] = (byContentType[c.contentType] ?? 0) + 1;

    const clientCounts = new Map<string, number>();
    for (const c of content) clientCounts.set(c.clientId, (clientCounts.get(c.clientId) ?? 0) + 1);
    const byClient = clients
      .map((cl) => ({
        clientId: cl.id,
        clientName: cl.company,
        contentCount: clientCounts.get(cl.id) ?? 0,
      }))
      .sort((a, b) => b.contentCount - a.contentCount)
      .slice(0, 5);

    return {
      success: true,
      data: {
        contentCreated: content.length,
        clients: clients.length,
        projects: projects.length,
        revenue: Math.round(revenue * 100) / 100,
        timeSavedMinutes: generations * 45,
        aiUsage: {
          generations,
          tokens,
          cost: Math.round(cost * 10000) / 10000,
          avgQualityScore: Math.round(avgQuality * 10) / 10,
        },
        byStatus,
        byContentType,
        byClient,
      },
    };
  }

  // ── Dashboard ───────────────────────────────────────────────────────────

  async getDashboard(userId: string): Promise<ContentAgencyResult<ContentAgencyDashboardDTO>> {
    const analytics = await this.getAnalytics(userId);
    if (!analytics.success || !analytics.data) return { success: false, error: analytics.error };
    const [content, clients, projects] = await Promise.all([
      this.repo.listContent(userId),
      this.repo.listClients(userId),
      this.repo.listProjects(userId),
    ]);
    const clientName = new Map(clients.map((c) => [c.id, c.company]));
    const ts = Date.now();

    const upcoming = content
      .filter((c) => c.scheduledFor !== null && new Date(c.scheduledFor).getTime() >= ts)
      .map(
        (c) =>
          ({
            contentId: c.id,
            title: c.title,
            contentType: c.contentType,
            status: c.status,
            workflowStage: c.workflowStage,
            scheduledFor: c.scheduledFor,
            clientId: c.clientId,
            clientName: clientName.get(c.clientId) ?? 'Unknown client',
          }) as CalendarEntryDTO,
      )
      .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
      .slice(0, 6);

    const recent = [...content].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);

    return {
      success: true,
      data: {
        analytics: analytics.data,
        upcomingContent: upcoming,
        recentContent: recent,
        activeClients: clients.filter(
          (c) => c.updatedAt >= new Date(Date.now() - 30 * 86400000).toISOString(),
        ).length,
        activeProjects: projects.filter((p) => p.status === 'active').length,
      },
    };
  }

  // ── Delivery / Export ───────────────────────────────────────────────────

  async exportContent(
    userId: string,
    contentId: string,
    format: 'markdown' | 'html' | 'pdf' | 'docx',
  ): Promise<ContentAgencyResult<DeliveryExportDTO>> {
    const item = await this.repo.findContentById(contentId, userId);
    if (!item) return { success: false, error: 'Content item not found' };
    const latest = item.versions[item.versions.length - 1];
    if (!latest) return { success: false, error: 'No content version available' };
    const slug =
      item.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'content';

    switch (format) {
      case 'markdown':
        return {
          success: true,
          data: {
            contentId: item.id,
            title: item.title,
            format,
            filename: `${slug}.md`,
            data: `# ${item.title}\n\n${latest.content}\n`,
            supported: true,
          },
        };
      case 'html': {
        const html = `<h1>${this.escapeHtml(item.title)}</h1>\n${this.markdownToHtml(latest.content)}`;
        return {
          success: true,
          data: {
            contentId: item.id,
            title: item.title,
            format,
            filename: `${slug}.html`,
            data: html,
            supported: true,
          },
        };
      }
      case 'pdf':
      case 'docx':
        // Roadmap: DOCX + Google Docs export (AC-001 notes). PDF requires a
        // server-side renderer; expose the markdown so the client can print.
        return {
          success: true,
          data: {
            contentId: item.id,
            title: item.title,
            format,
            filename: `${slug}.${format === 'pdf' ? 'pdf' : 'docx'}`,
            data: `# ${item.title}\n\n${latest.content}\n`,
            supported: false,
          },
        };
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private sameWeek(a: Date, b: Date): boolean {
    const day = (d: Date): number => {
      const date = new Date(d);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
      return date.getTime();
    };
    return day(a) === day(b);
  }

  private escapeHtml(value: string): string {
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

  private markdownToHtml(markdown: string): string {
    return markdown
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        if (/^#{1,6}\s/.test(trimmed)) {
          const level = trimmed.match(/^#+/)?.[0].length ?? 1;
          return `<h${level}>${this.escapeHtml(trimmed.replace(/^#+\s/, ''))}</h${level}>`;
        }
        if (/^[-*]\s/.test(trimmed))
          return `<li>${this.escapeHtml(trimmed.replace(/^[-*]\s/, ''))}</li>`;
        if (trimmed === '') return '';
        return `<p>${this.escapeHtml(trimmed)}</p>`;
      })
      .join('\n');
  }
}

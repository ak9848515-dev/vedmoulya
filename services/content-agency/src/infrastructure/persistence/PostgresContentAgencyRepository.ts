// ──────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Content Agency Repository
// Production persistence for the Content Agency bounded context
// EPIC-003 / SPRINT AC-001 — AI Content Agency Foundation
// ──────────────────────────────────────────────────────────────────

import { eq } from 'drizzle-orm';
import type { ContentAgencyRepository } from '@vedmoulya/domain';
import type {
  ClientRecord,
  BrandRecord,
  ProjectRecord,
  ContentItemRecord,
  InvoiceRecord,
} from '@vedmoulya/domain';
import { getDatabase } from './DatabaseConnection.js';
import {
  contentAgencyClients,
  contentAgencyBrands,
  contentAgencyProjects,
  contentAgencyContent,
  contentAgencyInvoices,
} from '../../schema/content-agency.js';

// Typed drizzle select rows — the mappers consume these instead of
// `Record<string, unknown>` so field nullability is exact and no
// stringification is needed at the call sites.
type ClientRow = typeof contentAgencyClients.$inferSelect;
type BrandRow = typeof contentAgencyBrands.$inferSelect;
type ProjectRow = typeof contentAgencyProjects.$inferSelect;
type ContentRow = typeof contentAgencyContent.$inferSelect;
type InvoiceRow = typeof contentAgencyInvoices.$inferSelect;

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

export class PostgresContentAgencyRepository implements ContentAgencyRepository {
  // ── Clients ─────────────────────────────────────────────────────────────

  async listClients(userId: string): Promise<ClientRecord[]> {
    const rows = await getDatabase()
      .select()
      .from(contentAgencyClients)
      .where(eq(contentAgencyClients.userId, userId))
      .orderBy(contentAgencyClients.createdAt);
    return rows.map((row) => this.mapClient(row));
  }

  async findClientById(id: string, userId: string): Promise<ClientRecord | null> {
    const row = await getDatabase()
      .select()
      .from(contentAgencyClients)
      .where(eq(contentAgencyClients.id, id))
      .limit(1);
    const first = row[0];
    if (!first || first.userId !== userId) return null;
    return this.mapClient(first);
  }

  async saveClient(client: ClientRecord): Promise<void> {
    const db = getDatabase();
    await db
      .insert(contentAgencyClients)
      .values({
        id: client.id,
        userId: client.userId,
        company: client.company,
        industry: client.industry,
        brandVoice: client.brandVoice,
        targetAudience: client.targetAudience,
        products: encode(client.products),
        services: encode(client.services),
        goals: encode(client.goals),
        website: client.website,
        socialLinks: encode(client.socialLinks),
        aiMemory: client.aiMemory,
        documents: encode(client.documents),
        createdAt: new Date(client.createdAt),
        updatedAt: new Date(client.updatedAt),
      })
      .onConflictDoUpdate({
        target: contentAgencyClients.id,
        set: {
          company: client.company,
          industry: client.industry,
          brandVoice: client.brandVoice,
          targetAudience: client.targetAudience,
          products: encode(client.products),
          services: encode(client.services),
          goals: encode(client.goals),
          website: client.website,
          socialLinks: encode(client.socialLinks),
          aiMemory: client.aiMemory,
          documents: encode(client.documents),
          updatedAt: new Date(client.updatedAt),
        },
      });
  }

  async deleteClient(id: string, userId: string): Promise<void> {
    const db = getDatabase();
    const rows = await db
      .select()
      .from(contentAgencyClients)
      .where(eq(contentAgencyClients.id, id))
      .limit(1);
    const first = rows[0];
    if (first && first.userId === userId) {
      await db.delete(contentAgencyClients).where(eq(contentAgencyClients.id, id));
    }
  }

  private mapClient(row: ClientRow): ClientRecord {
    return {
      id: row.id,
      userId: row.userId,
      company: row.company,
      industry: row.industry ?? '',
      brandVoice: row.brandVoice ?? '',
      targetAudience: row.targetAudience ?? '',
      products: decode<string[]>(row.products, []),
      services: decode<string[]>(row.services, []),
      goals: decode<string[]>(row.goals, []),
      website: row.website ?? '',
      socialLinks: decode<Record<string, string>>(row.socialLinks, {}),
      aiMemory: row.aiMemory ?? '',
      documents: decode<Array<{ name: string; type: string }>>(row.documents, []),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // ── Brands ──────────────────────────────────────────────────────────────

  async listBrands(userId: string): Promise<BrandRecord[]> {
    const rows = await getDatabase()
      .select()
      .from(contentAgencyBrands)
      .where(eq(contentAgencyBrands.userId, userId))
      .orderBy(contentAgencyBrands.createdAt);
    return rows.map((row) => this.mapBrand(row));
  }

  async findBrandById(id: string, userId: string): Promise<BrandRecord | null> {
    const row = await getDatabase()
      .select()
      .from(contentAgencyBrands)
      .where(eq(contentAgencyBrands.id, id))
      .limit(1);
    const first = row[0];
    if (!first || first.userId !== userId) return null;
    return this.mapBrand(first);
  }

  async saveBrand(brand: BrandRecord): Promise<void> {
    const db = getDatabase();
    await db
      .insert(contentAgencyBrands)
      .values({
        id: brand.id,
        userId: brand.userId,
        clientId: brand.clientId,
        name: brand.name,
        tone: brand.tone,
        writingStyle: brand.writingStyle,
        vocabulary: encode(brand.vocabulary),
        doRules: encode(brand.doRules),
        dontRules: encode(brand.dontRules),
        ctaStyle: brand.ctaStyle,
        competitors: encode(brand.competitors),
        keywords: encode(brand.keywords),
        colorPalette: encode(brand.colorPalette),
        mission: brand.mission,
        vision: brand.vision,
        createdAt: new Date(brand.createdAt),
        updatedAt: new Date(brand.updatedAt),
      })
      .onConflictDoUpdate({
        target: contentAgencyBrands.id,
        set: {
          clientId: brand.clientId,
          name: brand.name,
          tone: brand.tone,
          writingStyle: brand.writingStyle,
          vocabulary: encode(brand.vocabulary),
          doRules: encode(brand.doRules),
          dontRules: encode(brand.dontRules),
          ctaStyle: brand.ctaStyle,
          competitors: encode(brand.competitors),
          keywords: encode(brand.keywords),
          colorPalette: encode(brand.colorPalette),
          mission: brand.mission,
          vision: brand.vision,
          updatedAt: new Date(brand.updatedAt),
        },
      });
  }

  async deleteBrand(id: string, userId: string): Promise<void> {
    const db = getDatabase();
    const rows = await db
      .select()
      .from(contentAgencyBrands)
      .where(eq(contentAgencyBrands.id, id))
      .limit(1);
    const first = rows[0];
    if (first && first.userId === userId) {
      await db.delete(contentAgencyBrands).where(eq(contentAgencyBrands.id, id));
    }
  }

  private mapBrand(row: BrandRow): BrandRecord {
    return {
      id: row.id,
      userId: row.userId,
      clientId: row.clientId,
      name: row.name,
      tone: row.tone ?? '',
      writingStyle: row.writingStyle ?? '',
      vocabulary: decode<string[]>(row.vocabulary, []),
      doRules: decode<string[]>(row.doRules, []),
      dontRules: decode<string[]>(row.dontRules, []),
      ctaStyle: row.ctaStyle ?? '',
      competitors: decode<string[]>(row.competitors, []),
      keywords: decode<string[]>(row.keywords, []),
      colorPalette: decode<string[]>(row.colorPalette, []),
      mission: row.mission ?? '',
      vision: row.vision ?? '',
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // ── Projects ────────────────────────────────────────────────────────────

  async listProjects(userId: string): Promise<ProjectRecord[]> {
    const rows = await getDatabase()
      .select()
      .from(contentAgencyProjects)
      .where(eq(contentAgencyProjects.userId, userId))
      .orderBy(contentAgencyProjects.createdAt);
    return rows.map((row) => this.mapProject(row));
  }

  async findProjectById(id: string, userId: string): Promise<ProjectRecord | null> {
    const row = await getDatabase()
      .select()
      .from(contentAgencyProjects)
      .where(eq(contentAgencyProjects.id, id))
      .limit(1);
    const first = row[0];
    if (!first || first.userId !== userId) return null;
    return this.mapProject(first);
  }

  async saveProject(project: ProjectRecord): Promise<void> {
    const db = getDatabase();
    await db
      .insert(contentAgencyProjects)
      .values({
        id: project.id,
        userId: project.userId,
        clientId: project.clientId,
        brandId: project.brandId,
        name: project.name,
        description: project.description,
        status: project.status,
        startDate: project.startDate,
        endDate: project.endDate,
        createdAt: new Date(project.createdAt),
        updatedAt: new Date(project.updatedAt),
      })
      .onConflictDoUpdate({
        target: contentAgencyProjects.id,
        set: {
          clientId: project.clientId,
          brandId: project.brandId,
          name: project.name,
          description: project.description,
          status: project.status,
          startDate: project.startDate,
          endDate: project.endDate,
          updatedAt: new Date(project.updatedAt),
        },
      });
  }

  async deleteProject(id: string, userId: string): Promise<void> {
    const db = getDatabase();
    const rows = await db
      .select()
      .from(contentAgencyProjects)
      .where(eq(contentAgencyProjects.id, id))
      .limit(1);
    const first = rows[0];
    if (first && first.userId === userId) {
      await db.delete(contentAgencyProjects).where(eq(contentAgencyProjects.id, id));
    }
  }

  private mapProject(row: ProjectRow): ProjectRecord {
    return {
      id: row.id,
      userId: row.userId,
      clientId: row.clientId,
      brandId: row.brandId,
      name: row.name,
      description: row.description ?? '',
      status: row.status as ProjectRecord['status'],
      startDate: row.startDate ?? '',
      endDate: row.endDate,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // ── Content Items ───────────────────────────────────────────────────────

  async listContent(userId: string): Promise<ContentItemRecord[]> {
    const rows = await getDatabase()
      .select()
      .from(contentAgencyContent)
      .where(eq(contentAgencyContent.userId, userId))
      .orderBy(contentAgencyContent.createdAt);
    return rows.map((row) => this.mapContent(row));
  }

  async findContentById(id: string, userId: string): Promise<ContentItemRecord | null> {
    const row = await getDatabase()
      .select()
      .from(contentAgencyContent)
      .where(eq(contentAgencyContent.id, id))
      .limit(1);
    const first = row[0];
    if (!first || first.userId !== userId) return null;
    return this.mapContent(first);
  }

  async saveContent(content: ContentItemRecord): Promise<void> {
    const db = getDatabase();
    await db
      .insert(contentAgencyContent)
      .values({
        id: content.id,
        userId: content.userId,
        clientId: content.clientId,
        brandId: content.brandId,
        projectId: content.projectId,
        contentType: content.contentType,
        title: content.title,
        status: content.status,
        workflowStage: content.workflowStage,
        brief: content.brief,
        targetAudience: content.targetAudience,
        goals: encode(content.goals),
        versions: encode(content.versions),
        reviews: encode(content.reviews),
        aiMetadata: content.aiMetadata ? encode(content.aiMetadata) : null,
        scheduledFor: content.scheduledFor,
        publishedUrl: content.publishedUrl,
        createdAt: new Date(content.createdAt),
        updatedAt: new Date(content.updatedAt),
      })
      .onConflictDoUpdate({
        target: contentAgencyContent.id,
        set: {
          clientId: content.clientId,
          brandId: content.brandId,
          projectId: content.projectId,
          contentType: content.contentType,
          title: content.title,
          status: content.status,
          workflowStage: content.workflowStage,
          brief: content.brief,
          targetAudience: content.targetAudience,
          goals: encode(content.goals),
          versions: encode(content.versions),
          reviews: encode(content.reviews),
          aiMetadata: content.aiMetadata ? encode(content.aiMetadata) : null,
          scheduledFor: content.scheduledFor,
          publishedUrl: content.publishedUrl,
          updatedAt: new Date(content.updatedAt),
        },
      });
  }

  async deleteContent(id: string, userId: string): Promise<void> {
    const db = getDatabase();
    const rows = await db
      .select()
      .from(contentAgencyContent)
      .where(eq(contentAgencyContent.id, id))
      .limit(1);
    const first = rows[0];
    if (first && first.userId === userId) {
      await db.delete(contentAgencyContent).where(eq(contentAgencyContent.id, id));
    }
  }

  private mapContent(row: ContentRow): ContentItemRecord {
    return {
      id: row.id,
      userId: row.userId,
      clientId: row.clientId,
      brandId: row.brandId,
      projectId: row.projectId,
      contentType: row.contentType as ContentItemRecord['contentType'],
      title: row.title,
      status: row.status as ContentItemRecord['status'],
      workflowStage: row.workflowStage as ContentItemRecord['workflowStage'],
      brief: row.brief ?? '',
      targetAudience: row.targetAudience ?? '',
      goals: decode<string[]>(row.goals, []),
      versions: decode<ContentItemRecord['versions']>(row.versions, []),
      reviews: decode<ContentItemRecord['reviews']>(row.reviews, []),
      aiMetadata: row.aiMetadata
        ? decode<ContentItemRecord['aiMetadata']>(row.aiMetadata, null)
        : null,
      scheduledFor: row.scheduledFor,
      publishedUrl: row.publishedUrl,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // ── Invoices ────────────────────────────────────────────────────────────

  async listInvoices(userId: string): Promise<InvoiceRecord[]> {
    const rows = await getDatabase()
      .select()
      .from(contentAgencyInvoices)
      .where(eq(contentAgencyInvoices.userId, userId))
      .orderBy(contentAgencyInvoices.createdAt);
    return rows.map((row) => this.mapInvoice(row));
  }

  async findInvoiceById(id: string, userId: string): Promise<InvoiceRecord | null> {
    const row = await getDatabase()
      .select()
      .from(contentAgencyInvoices)
      .where(eq(contentAgencyInvoices.id, id))
      .limit(1);
    const first = row[0];
    if (!first || first.userId !== userId) return null;
    return this.mapInvoice(first);
  }

  async saveInvoice(invoice: InvoiceRecord): Promise<void> {
    const db = getDatabase();
    await db
      .insert(contentAgencyInvoices)
      .values({
        id: invoice.id,
        userId: invoice.userId,
        clientId: invoice.clientId,
        projectId: invoice.projectId,
        description: invoice.description,
        amount: invoice.amount,
        currency: invoice.currency,
        status: invoice.status,
        issuedAt: invoice.issuedAt,
        dueDate: invoice.dueDate,
        createdAt: new Date(invoice.createdAt),
        updatedAt: new Date(invoice.updatedAt),
      })
      .onConflictDoUpdate({
        target: contentAgencyInvoices.id,
        set: {
          clientId: invoice.clientId,
          projectId: invoice.projectId,
          description: invoice.description,
          amount: invoice.amount,
          currency: invoice.currency,
          status: invoice.status,
          issuedAt: invoice.issuedAt,
          dueDate: invoice.dueDate,
          updatedAt: new Date(invoice.updatedAt),
        },
      });
  }

  async deleteInvoice(id: string, userId: string): Promise<void> {
    const db = getDatabase();
    const rows = await db
      .select()
      .from(contentAgencyInvoices)
      .where(eq(contentAgencyInvoices.id, id))
      .limit(1);
    const first = rows[0];
    if (first && first.userId === userId) {
      await db.delete(contentAgencyInvoices).where(eq(contentAgencyInvoices.id, id));
    }
  }

  private mapInvoice(row: InvoiceRow): InvoiceRecord {
    return {
      id: row.id,
      userId: row.userId,
      clientId: row.clientId,
      projectId: row.projectId,
      description: row.description ?? '',
      amount: row.amount ?? 0,
      currency: row.currency ?? 'USD',
      status: row.status as InvoiceRecord['status'],
      issuedAt: row.issuedAt ?? '',
      dueDate: row.dueDate,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

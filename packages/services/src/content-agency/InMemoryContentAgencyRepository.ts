// ──────────────────────────────────────────────────────────────────
// VedMoulya — In-Memory Content Agency Repository
// EPIC-003 / SPRINT AC-001 — AI Content Agency Foundation
// Map-backed implementation of the ContentAgencyRepository contract.
// Used by unit tests and dev; the production path uses
// PostgresContentAgencyRepository (same interface).
// ──────────────────────────────────────────────────────────────────

import type { ContentAgencyRepository } from '@vedmoulya/domain';
import type {
  ClientRecord,
  BrandRecord,
  ProjectRecord,
  ContentItemRecord,
  InvoiceRecord,
} from '@vedmoulya/domain';

export class InMemoryContentAgencyRepository implements ContentAgencyRepository {
  private readonly clients = new Map<string, ClientRecord>();
  private readonly brands = new Map<string, BrandRecord>();
  private readonly projects = new Map<string, ProjectRecord>();
  private readonly content = new Map<string, ContentItemRecord>();
  private readonly invoices = new Map<string, InvoiceRecord>();

  // ── Clients ─────────────────────────────────────────────────────────────

  async listClients(userId: string): Promise<ClientRecord[]> {
    return [...this.clients.values()].filter((c) => c.userId === userId);
  }

  async findClientById(id: string, userId: string): Promise<ClientRecord | null> {
    const client = this.clients.get(id);
    return client && client.userId === userId ? client : null;
  }

  async saveClient(client: ClientRecord): Promise<void> {
    this.clients.set(client.id, { ...client });
  }

  async deleteClient(id: string, userId: string): Promise<void> {
    const existing = await this.findClientById(id, userId);
    if (existing) this.clients.delete(id);
  }

  // ── Brands ──────────────────────────────────────────────────────────────

  async listBrands(userId: string): Promise<BrandRecord[]> {
    return [...this.brands.values()].filter((b) => b.userId === userId);
  }

  async findBrandById(id: string, userId: string): Promise<BrandRecord | null> {
    const brand = this.brands.get(id);
    return brand && brand.userId === userId ? brand : null;
  }

  async saveBrand(brand: BrandRecord): Promise<void> {
    this.brands.set(brand.id, { ...brand });
  }

  async deleteBrand(id: string, userId: string): Promise<void> {
    const existing = await this.findBrandById(id, userId);
    if (existing) this.brands.delete(id);
  }

  // ── Projects ────────────────────────────────────────────────────────────

  async listProjects(userId: string): Promise<ProjectRecord[]> {
    return [...this.projects.values()].filter((p) => p.userId === userId);
  }

  async findProjectById(id: string, userId: string): Promise<ProjectRecord | null> {
    const project = this.projects.get(id);
    return project && project.userId === userId ? project : null;
  }

  async saveProject(project: ProjectRecord): Promise<void> {
    this.projects.set(project.id, { ...project });
  }

  async deleteProject(id: string, userId: string): Promise<void> {
    const existing = await this.findProjectById(id, userId);
    if (existing) this.projects.delete(id);
  }

  // ── Content Items ───────────────────────────────────────────────────────

  async listContent(userId: string): Promise<ContentItemRecord[]> {
    return [...this.content.values()].filter((c) => c.userId === userId);
  }

  async findContentById(id: string, userId: string): Promise<ContentItemRecord | null> {
    const item = this.content.get(id);
    return item && item.userId === userId ? item : null;
  }

  async saveContent(content: ContentItemRecord): Promise<void> {
    this.content.set(content.id, {
      ...content,
      versions: content.versions.map((v) => ({ ...v })),
      reviews: content.reviews.map((r) => ({ ...r })),
      aiMetadata: content.aiMetadata ? { ...content.aiMetadata } : null,
    });
  }

  async deleteContent(id: string, userId: string): Promise<void> {
    const existing = await this.findContentById(id, userId);
    if (existing) this.content.delete(id);
  }

  // ── Invoices ────────────────────────────────────────────────────────────

  async listInvoices(userId: string): Promise<InvoiceRecord[]> {
    return [...this.invoices.values()].filter((i) => i.userId === userId);
  }

  async findInvoiceById(id: string, userId: string): Promise<InvoiceRecord | null> {
    const invoice = this.invoices.get(id);
    return invoice && invoice.userId === userId ? invoice : null;
  }

  async saveInvoice(invoice: InvoiceRecord): Promise<void> {
    this.invoices.set(invoice.id, { ...invoice });
  }

  async deleteInvoice(id: string, userId: string): Promise<void> {
    const existing = await this.findInvoiceById(id, userId);
    if (existing) this.invoices.delete(id);
  }
}

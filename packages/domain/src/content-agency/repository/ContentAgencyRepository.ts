// ──────────────────────────────────────────────────────────────────
// VedMoulya — Content Agency Repository Interface
// EPIC-003 / SPRINT AC-001 — AI Content Agency Foundation
// Contract for Content Agency persistence. Implemented by
// PostgresContentAgencyRepository (production) and
// InMemoryContentAgencyRepository (tests / dev).
// ──────────────────────────────────────────────────────────────────

import type {
  ClientRecord,
  BrandRecord,
  ProjectRecord,
  ContentItemRecord,
  InvoiceRecord,
} from '../types.js';

export interface ContentAgencyRepository {
  // ── Clients ─────────────────────────────────────────────────────────────
  listClients(userId: string): Promise<ClientRecord[]>;
  findClientById(id: string, userId: string): Promise<ClientRecord | null>;
  saveClient(client: ClientRecord): Promise<void>;
  deleteClient(id: string, userId: string): Promise<void>;

  // ── Brands ──────────────────────────────────────────────────────────────
  listBrands(userId: string): Promise<BrandRecord[]>;
  findBrandById(id: string, userId: string): Promise<BrandRecord | null>;
  saveBrand(brand: BrandRecord): Promise<void>;
  deleteBrand(id: string, userId: string): Promise<void>;

  // ── Projects ────────────────────────────────────────────────────────────
  listProjects(userId: string): Promise<ProjectRecord[]>;
  findProjectById(id: string, userId: string): Promise<ProjectRecord | null>;
  saveProject(project: ProjectRecord): Promise<void>;
  deleteProject(id: string, userId: string): Promise<void>;

  // ── Content Items ───────────────────────────────────────────────────────
  listContent(userId: string): Promise<ContentItemRecord[]>;
  findContentById(id: string, userId: string): Promise<ContentItemRecord | null>;
  saveContent(content: ContentItemRecord): Promise<void>;
  deleteContent(id: string, userId: string): Promise<void>;

  // ── Invoices ────────────────────────────────────────────────────────────
  listInvoices(userId: string): Promise<InvoiceRecord[]>;
  findInvoiceById(id: string, userId: string): Promise<InvoiceRecord | null>;
  saveInvoice(invoice: InvoiceRecord): Promise<void>;
  deleteInvoice(id: string, userId: string): Promise<void>;
}

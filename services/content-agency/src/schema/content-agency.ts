// ──────────────────────────────────────────────────────────────────
// VedMoulya — Content Agency Database Schema
// Drizzle ORM schema for the Content Agency tables
// EPIC-003 / SPRINT AC-001 — AI Content Agency Foundation
// Nested structures (products, social links, versions, reviews, AI
// metadata, documents) are stored as jsonb — the domain records map
// 1:1 to rows.
// ──────────────────────────────────────────────────────────────────

import {
  pgTable,
  varchar,
  text,
  timestamp,
  integer,
  doublePrecision,
  jsonb,
  index,
  boolean,
} from 'drizzle-orm/pg-core';

// ── Clients ───────────────────────────────────────────────────────────────

export const contentAgencyClients = pgTable(
  'content_agency_clients',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    company: varchar('company', { length: 200 }).notNull(),
    industry: varchar('industry', { length: 120 }).default(''),
    brandVoice: text('brand_voice').default(''),
    targetAudience: text('target_audience').default(''),
    products: jsonb('products').default([]),
    services: jsonb('services').default([]),
    goals: jsonb('goals').default([]),
    website: varchar('website', { length: 500 }).default(''),
    socialLinks: jsonb('social_links').default({}),
    aiMemory: text('ai_memory').default(''),
    documents: jsonb('documents').default([]),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('cac_user_idx').on(table.userId)],
);

// ── Brand Profiles ────────────────────────────────────────────────────────

export const contentAgencyBrands = pgTable(
  'content_agency_brands',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    clientId: varchar('client_id', { length: 64 }),
    name: varchar('name', { length: 200 }).notNull(),
    tone: text('tone').default(''),
    writingStyle: text('writing_style').default(''),
    vocabulary: jsonb('vocabulary').default([]),
    doRules: jsonb('do_rules').default([]),
    dontRules: jsonb('dont_rules').default([]),
    ctaStyle: text('cta_style').default(''),
    competitors: jsonb('competitors').default([]),
    keywords: jsonb('keywords').default([]),
    colorPalette: jsonb('color_palette').default([]),
    mission: text('mission').default(''),
    vision: text('vision').default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('cab_user_idx').on(table.userId)],
);

// ── Projects ──────────────────────────────────────────────────────────────

export const contentAgencyProjects = pgTable(
  'content_agency_projects',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    clientId: varchar('client_id', { length: 64 }).notNull(),
    brandId: varchar('brand_id', { length: 64 }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description').default(''),
    status: varchar('status', { length: 24 }).default('active').notNull(),
    startDate: varchar('start_date', { length: 32 }).default(''),
    endDate: varchar('end_date', { length: 32 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('cap_user_idx').on(table.userId)],
);

// ── Content Items ─────────────────────────────────────────────────────────

export const contentAgencyContent = pgTable(
  'content_agency_content',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    clientId: varchar('client_id', { length: 64 }).notNull(),
    brandId: varchar('brand_id', { length: 64 }),
    projectId: varchar('project_id', { length: 64 }),
    contentType: varchar('content_type', { length: 32 }).notNull(),
    title: varchar('title', { length: 300 }).notNull(),
    status: varchar('status', { length: 24 }).default('draft').notNull(),
    workflowStage: varchar('workflow_stage', { length: 32 }).default('brief').notNull(),
    brief: text('brief').default(''),
    targetAudience: text('target_audience').default(''),
    goals: jsonb('goals').default([]),
    versions: jsonb('versions').default([]),
    reviews: jsonb('reviews').default([]),
    aiMetadata: jsonb('ai_metadata'),
    scheduledFor: varchar('scheduled_for', { length: 32 }),
    publishedUrl: varchar('published_url', { length: 500 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('cacontent_user_idx').on(table.userId)],
);

// ── Invoices ──────────────────────────────────────────────────────────────

export const contentAgencyInvoices = pgTable(
  'content_agency_invoices',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    clientId: varchar('client_id', { length: 64 }).notNull(),
    projectId: varchar('project_id', { length: 64 }),
    description: varchar('description', { length: 500 }).default(''),
    amount: doublePrecision('amount').default(0),
    currency: varchar('currency', { length: 8 }).default('USD'),
    status: varchar('status', { length: 16 }).default('draft').notNull(),
    issuedAt: varchar('issued_at', { length: 32 }).default(''),
    dueDate: varchar('due_date', { length: 32 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('cai_user_idx').on(table.userId)],
);

// ── Client Operations (EPIC-003 / SPRINT AC-002) ────────────────────────────

export const clientOpsLeads = pgTable(
  'client_ops_leads',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    company: varchar('company', { length: 200 }).notNull(),
    contactName: varchar('contact_name', { length: 200 }).default(''),
    contactEmail: varchar('contact_email', { length: 320 }).default(''),
    contactPhone: varchar('contact_phone', { length: 60 }).default(''),
    industry: varchar('industry', { length: 120 }).default(''),
    source: varchar('source', { length: 60 }).default(''),
    status: varchar('status', { length: 20 }).default('lead').notNull(),
    archived: boolean('archived').default(false).notNull(),
    value: doublePrecision('value').default(0),
    currency: varchar('currency', { length: 8 }).default('USD'),
    healthScore: doublePrecision('health_score').default(50),
    nextFollowUp: varchar('next_follow_up', { length: 32 }),
    notes: text('notes').default(''),
    clientId: varchar('client_id', { length: 64 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('col_user_idx').on(table.userId)],
);

export const clientOpsLeadInteractions = pgTable(
  'client_ops_lead_interactions',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    leadId: varchar('lead_id', { length: 64 }).notNull(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    type: varchar('type', { length: 20 }).notNull(),
    summary: text('summary').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('coli_lead_idx').on(table.leadId)],
);

export const clientOpsLeadTasks = pgTable(
  'client_ops_lead_tasks',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    leadId: varchar('lead_id', { length: 64 }).notNull(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    title: varchar('title', { length: 300 }).notNull(),
    dueAt: varchar('due_at', { length: 32 }),
    completed: boolean('completed').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('colt_lead_idx').on(table.leadId)],
);

export const clientOpsLeadContacts = pgTable(
  'client_ops_lead_contacts',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    leadId: varchar('lead_id', { length: 64 }).notNull(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    email: varchar('email', { length: 320 }).default(''),
    phone: varchar('phone', { length: 60 }).default(''),
    role: varchar('role', { length: 120 }).default(''),
    isPrimary: boolean('is_primary').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('colc_lead_idx').on(table.leadId)],
);

export const clientOpsProposals = pgTable(
  'client_ops_proposals',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    title: varchar('title', { length: 300 }).notNull(),
    status: varchar('status', { length: 20 }).default('draft').notNull(),
    leadId: varchar('lead_id', { length: 64 }),
    clientId: varchar('client_id', { length: 64 }),
    currentVersion: integer('current_version').default(1).notNull(),
    versions: jsonb('versions').default([]),
    aiMetadata: jsonb('ai_metadata'),
    sentAt: varchar('sent_at', { length: 32 }),
    acceptedAt: varchar('accepted_at', { length: 32 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('cop_user_idx').on(table.userId)],
);

export const clientOpsContracts = pgTable(
  'client_ops_contracts',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    clientId: varchar('client_id', { length: 64 }).notNull(),
    title: varchar('title', { length: 300 }).notNull(),
    startDate: varchar('start_date', { length: 32 }).notNull(),
    endDate: varchar('end_date', { length: 32 }).notNull(),
    value: doublePrecision('value').default(0),
    currency: varchar('currency', { length: 8 }).default('USD'),
    status: varchar('status', { length: 20 }).default('draft').notNull(),
    renewal: boolean('renewal').default(false).notNull(),
    autoRenew: boolean('auto_renew').default(false).notNull(),
    currentVersion: integer('current_version').default(1).notNull(),
    versions: jsonb('versions').default([]),
    approvals: jsonb('approvals').default([]),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('coc_user_idx').on(table.userId)],
);

export const clientOpsQuotations = pgTable(
  'client_ops_quotations',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    title: varchar('title', { length: 300 }).notNull(),
    status: varchar('status', { length: 20 }).default('draft').notNull(),
    leadId: varchar('lead_id', { length: 64 }),
    clientId: varchar('client_id', { length: 64 }),
    packages: jsonb('packages').default([]),
    discount: doublePrecision('discount').default(0),
    taxRate: doublePrecision('tax_rate').default(0),
    recurring: boolean('recurring').default(false).notNull(),
    currency: varchar('currency', { length: 8 }).default('USD'),
    subtotal: doublePrecision('subtotal').default(0),
    total: doublePrecision('total').default(0),
    sentAt: varchar('sent_at', { length: 32 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('coq_user_idx').on(table.userId)],
);

export const clientOpsPayments = pgTable(
  'client_ops_payments',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    invoiceId: varchar('invoice_id', { length: 64 }).notNull(),
    clientId: varchar('client_id', { length: 64 }).notNull(),
    amount: doublePrecision('amount').default(0).notNull(),
    currency: varchar('currency', { length: 8 }).default('USD'),
    method: varchar('method', { length: 60 }).default('bank_transfer'),
    receivedAt: varchar('received_at', { length: 32 }).notNull(),
    note: text('note').default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('cpay_user_idx').on(table.userId)],
);

export const clientOpsDocuments = pgTable(
  'client_ops_documents',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    clientId: varchar('client_id', { length: 64 }).notNull(),
    projectId: varchar('project_id', { length: 64 }),
    contractId: varchar('contract_id', { length: 64 }),
    name: varchar('name', { length: 300 }).notNull(),
    kind: varchar('kind', { length: 40 }).default('other').notNull(),
    mime: varchar('mime', { length: 120 }).default(''),
    size: integer('size').default(0),
    storageKey: text('storage_key').default(''),
    metadata: jsonb('metadata').default({}),
    currentVersion: integer('current_version').default(1).notNull(),
    versions: jsonb('versions').default([]),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('codoc_user_idx').on(table.userId)],
);

export const clientOpsPortalAccess = pgTable(
  'client_ops_portal_access',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    clientId: varchar('client_id', { length: 64 }).notNull(),
    email: varchar('email', { length: 320 }).notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    lastLoginAt: varchar('last_login_at', { length: 32 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('copa_user_idx').on(table.userId)],
);

export const clientOpsNotifications = pgTable(
  'client_ops_notifications',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    audience: varchar('audience', { length: 12 }).notNull(),
    clientId: varchar('client_id', { length: 64 }),
    type: varchar('type', { length: 30 }).notNull(),
    title: varchar('title', { length: 300 }).notNull(),
    message: text('message').notNull(),
    entityId: varchar('entity_id', { length: 64 }),
    isRead: boolean('is_read').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('con_user_idx').on(table.userId)],
);

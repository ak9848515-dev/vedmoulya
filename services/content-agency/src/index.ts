// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/content-agency
// AI Content Agency Service — Domain Infrastructure
// EPIC-003 / SPRINT AC-001 — AI Content Agency Foundation
// ──────────────────────────────────────────────────────────────────

export const serviceName = 'content-agency' as const;

// ── Schema ─────────────────────────────────────────────────────────────────
export {
  contentAgencyClients,
  contentAgencyBrands,
  contentAgencyProjects,
  contentAgencyContent,
  contentAgencyInvoices,
  clientOpsLeads,
  clientOpsLeadInteractions,
  clientOpsLeadTasks,
  clientOpsLeadContacts,
  clientOpsProposals,
  clientOpsContracts,
  clientOpsQuotations,
  clientOpsPayments,
  clientOpsDocuments,
  clientOpsPortalAccess,
  clientOpsNotifications,
} from './schema/content-agency.js';
export type {
  ContentAgencyClientRow,
  ContentAgencyBrandRow,
  ContentAgencyProjectRow,
  ContentAgencyContentRow,
  ContentAgencyInvoiceRow,
  ClientOpsLeadRow,
  NewClientOpsLeadRow,
  ClientOpsInteractionRow,
  ClientOpsTaskRow,
  ClientOpsContactRow,
  ClientOpsProposalRow,
  NewClientOpsProposalRow,
  ClientOpsContractRow,
  NewClientOpsContractRow,
  ClientOpsQuotationRow,
  NewClientOpsQuotationRow,
  ClientOpsPaymentRow,
  NewClientOpsPaymentRow,
  ClientOpsDocumentRow,
  NewClientOpsDocumentRow,
  ClientOpsPortalAccessRow,
  NewClientOpsPortalAccessRow,
  ClientOpsNotificationRow,
  NewClientOpsNotificationRow,
} from './schema/types.js';

// ── Infrastructure — Persistence ───────────────────────────────────────────
export { PostgresContentAgencyRepository } from './infrastructure/persistence/PostgresContentAgencyRepository.js';
export { PostgresClientOpsRepository } from './infrastructure/persistence/PostgresClientOpsRepository.js';
export {
  initializeDatabase,
  closeDatabase,
  getDatabase,
  ensureContentAgencySchema,
  getDatabaseConfig,
  resolveContentAgencyDatabaseUrl,
  SHARED_DATABASE_OPT_IN,
} from './infrastructure/persistence/DatabaseConnection.js';

// ── Infrastructure — Migrations (MISSION 002) ──────────────────────────────
export {
  runContentAgencyMigrations,
  migrationChecksum,
  CONTENT_AGENCY_MIGRATIONS,
  MigrationDriftError,
} from './infrastructure/persistence/migrations/index.js';
export type {
  ContentAgencyMigration,
  MigrationReport,
  MigrationDatabase,
  RunMigrationsOptions,
} from './infrastructure/persistence/migrations/index.js';

// ── Infrastructure — Payments (MISSION 002) ────────────────────────────────
export { PostgresPaymentSettlement } from './infrastructure/payments/PostgresPaymentSettlement.js';

// ── Infrastructure — DI ────────────────────────────────────────────────────
export {
  registerContentAgencyServices,
  contentAgencyModule,
} from './infrastructure/di/ContentAgencyModule.js';

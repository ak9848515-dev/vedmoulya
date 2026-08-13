// ──────────────────────────────────────────────────────────────────
// VedMoulya — Content Agency Module Registration
// Registers all Content Agency infrastructure services with DI container
// EPIC-003 / SPRINT AC-001 — AI Content Agency Foundation
// ──────────────────────────────────────────────────────────────────

import { container, moduleRegistry } from '@vedmoulya/core';
import type { ModuleDefinition } from '@vedmoulya/core';
import type { ContentAgencyRepository, ClientOpsRepository } from '@vedmoulya/domain';
import { PostgresContentAgencyRepository } from '../persistence/PostgresContentAgencyRepository.js';
import { PostgresClientOpsRepository } from '../persistence/PostgresClientOpsRepository.js';
import { initializeDatabase, closeDatabase } from '../persistence/DatabaseConnection.js';

/** Register all Content Agency infrastructure services with the DI container */
export function registerContentAgencyServices(): void {
  // Database
  container.register('content-agency.db', async () => {
    await initializeDatabase();
    return {};
  });

  // Repository
  container.register<ContentAgencyRepository>('content-agency.repository', () => {
    return new PostgresContentAgencyRepository();
  });

  // Client Operations repository (EPIC-003 / AC-002)
  container.register<ClientOpsRepository>('content-agency.client-ops.repository', () => {
    return new PostgresClientOpsRepository();
  });
}

/** Define the content-agency module for the module registry */
export const contentAgencyModule: ModuleDefinition = {
  name: 'content-agency',
  description:
    'AI Content Agency — clients, brands, projects, content pipeline, calendar, invoices, CRM, proposals, contracts, quotations, payments, portal, documents',
  version: '2.0.0',
  dependencies: ['core'],
  register: () => {
    registerContentAgencyServices();
  },
  initialize: async () => {
    await initializeDatabase();
  },
  shutdown: async () => {
    await closeDatabase();
  },
};

/** Self-register the module */
moduleRegistry.register(contentAgencyModule);

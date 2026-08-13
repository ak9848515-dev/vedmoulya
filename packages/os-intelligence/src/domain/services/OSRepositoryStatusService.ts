// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Repository Status
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// Reports the persistence readiness of every engine: the production
// Postgres repository class and the JSONB table each engine writes,
// derived from the OS engine catalog (the same tables seeded by
// `npm run seed:ei` and created by each repository's ensureTable()).
// ──────────────────────────────────────────────────────────────────

import type { OSRepositoryStatus } from '../../types/os-types.js';
import { OS_ENGINE_SPECS } from '../../catalog/os-catalog.js';

export class OSRepositoryStatusService {
  /** Build the repository readiness report (pure — catalog metadata). */
  build(): OSRepositoryStatus[] {
    return OS_ENGINE_SPECS.map((spec) => ({
      engine: spec.engine,
      repository: spec.repository,
      table: spec.table,
      persisted: true,
      status: 'ready',
    }));
  }
}

// ──────────────────────────────────────────────────────────────────
// 0001 — Content agency / client-ops baseline (16 tables)
//
// This is the EXISTING bootstrap, adopted into the ledger unchanged. Every
// statement is `CREATE … IF NOT EXISTS`, so on a database that already has
// these tables it is a no-op that simply records version 1.
//
// Adopting rather than rewriting the baseline matters: the 16 tables are the
// revenue-recording surface, and regenerating their DDL would risk drifting
// from `schema/content-agency.ts` on live data.
// ──────────────────────────────────────────────────────────────────

import { CONTENT_AGENCY_SCHEMA_STATEMENTS } from '../contentAgencySchema.js';
import type { ContentAgencyMigration } from './types.js';

export const migration0001: ContentAgencyMigration = {
  version: 1,
  name: 'content_agency_baseline',
  statements: CONTENT_AGENCY_SCHEMA_STATEMENTS,
};

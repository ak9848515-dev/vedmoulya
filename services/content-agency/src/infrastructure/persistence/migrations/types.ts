// ──────────────────────────────────────────────────────────────────
// VedMoulya — Content Agency Migration Types
// MISSION 002 (2026-10-26).
//
// Before this existed the whole "migration strategy" was one idempotent
// `CREATE TABLE IF NOT EXISTS` bootstrap: no ordering, no ledger, no way to
// tell a fresh database from a half-migrated one. These types describe the
// smallest mechanism that fixes that without a new dependency:
//
//   • every migration has a monotonic integer VERSION and a NAME;
//   • its statements run inside ONE transaction together with the ledger row,
//     so a migration is either fully applied and recorded, or not applied;
//   • the ledger stores a CHECKSUM of the statements, so an edited migration
//     that was already applied is detected as drift instead of silently
//     diverging from the database.
//
// There are deliberately no destructive DOWN scripts. Recovery is
// forward-correction (see the runner's documentation).
// ──────────────────────────────────────────────────────────────────

import type { SQL } from 'drizzle-orm';

export interface ContentAgencyMigration {
  /** Strictly increasing. Never renumber a migration that has shipped. */
  version: number;
  name: string;
  /** DDL/DML applied in order inside a single transaction. */
  statements: SQL[];
}

export interface MigrationReport {
  /** Versions applied by THIS run, in order. */
  applied: number[];
  /** Versions that were already in the ledger and checksum-matched. */
  skipped: number[];
  /** Ledger rows whose checksum no longer matches the code (drift). */
  drifted: Array<{ version: number; name: string }>;
  alreadyCurrent: boolean;
}

export class MigrationDriftError extends Error {
  constructor(readonly drifted: Array<{ version: number; name: string }>) {
    super(
      `Content-agency migration drift: ${drifted
        .map((m) => `v${String(m.version)} ${m.name}`)
        .join(
          ', ',
        )} changed after being applied. Add a NEW forward migration instead of editing an applied one.`,
    );
    this.name = 'MigrationDriftError';
  }
}

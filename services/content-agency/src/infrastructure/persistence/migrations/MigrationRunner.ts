// ──────────────────────────────────────────────────────────────────
// VedMoulya — Content Agency Migration Runner
// MISSION 002 (2026-10-26).
//
// GUARANTEES
//   • ORDERED — migrations run by ascending version, always.
//   • ATOMIC — one transaction per migration, ledger row included. A failure
//     leaves the database exactly as it was and records nothing, so a re-run
//     retries the same version instead of skipping a half-applied one.
//   • REPEAT-SAFE — an applied version is skipped. Every statement is also
//     individually idempotent (`IF NOT EXISTS`, guarded DO blocks), so an
//     interrupted manual run cannot wedge the ledger.
//   • DRIFT DETECTED — the ledger stores a checksum per version; editing an
//     applied migration raises MigrationDriftError instead of silently
//     diverging from the database.
//   • SERIALIZED — a session-level advisory lock means two booting processes
//     cannot race the same migration list (CREATE … IF NOT EXISTS is not safe
//     against concurrent DDL; the identity store documents the same guard).
//
// RECOVERY / ROLLBACK POLICY
//   There are no DOWN scripts and the runner will not drop or truncate
//   anything. Recovery is forward-correction: ship version N+1 that fixes the
//   problem, keep the data, and never rewrite a migration that already ran.
//   A migration that fails is not recorded, so the fix is simply to correct
//   the code and boot again. Destructive changes would need the backfill and
//   the drop in separate, explicitly reviewed versions — none are present.
// ──────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type * as schema from '../../../schema/content-agency.js';
import { migration0001 } from './0001-content-agency-baseline.js';
import { migration0002 } from './0002-payment-integrity.js';
import { migration0003 } from './0003-payment-foreign-keys.js';
import { MigrationDriftError, type ContentAgencyMigration, type MigrationReport } from './types.js';

export type MigrationDatabase = ReturnType<typeof drizzle<typeof schema>>;

/** Ordered registry. Append only — never reorder or renumber. */
export const CONTENT_AGENCY_MIGRATIONS: readonly ContentAgencyMigration[] = [
  migration0001,
  migration0002,
  migration0003,
];

/** Arbitrary but fixed advisory-lock key ("vedmoulya:ca:migrate"). */
const MIGRATION_LOCK_KEY = 736_244_001;

const LEDGER_DDL = `CREATE TABLE IF NOT EXISTS content_agency_migrations (
  version integer PRIMARY KEY,
  name varchar(200) NOT NULL,
  checksum varchar(64) NOT NULL,
  applied_at timestamp NOT NULL DEFAULT now(),
  duration_ms integer NOT NULL DEFAULT 0
)`;

export interface RunMigrationsOptions {
  /** Override the registry (integration tests inject a failing migration). */
  migrations?: readonly ContentAgencyMigration[];
  /** Report drift instead of throwing. Off by default — silent drift is worse. */
  tolerateDrift?: boolean;
}

/**
 * Deterministic text of a drizzle SQL statement. All content-agency DDL is
 * parameterless template SQL, so the string chunks are the whole statement;
 * bound parameters (which would make a checksum unstable) are represented by a
 * placeholder and never occur in practice here.
 */
function statementText(statement: SQL): string {
  const chunks = (statement as unknown as { queryChunks?: unknown[] }).queryChunks ?? [];
  let text = '';
  for (const chunk of chunks) {
    const value = (chunk as { value?: unknown }).value;
    if (Array.isArray(value) && value.every((part) => typeof part === 'string')) {
      text += value.join('');
    } else if (typeof value === 'string') {
      text += value;
    } else {
      text += '?';
    }
  }
  return text;
}

export function migrationChecksum(migration: ContentAgencyMigration): string {
  const payload = migration.statements.map(statementText).join('\n;\n');
  return createHash('sha256')
    .update(`${String(migration.version)}:${migration.name}\n${payload}`)
    .digest('hex');
}

interface LedgerRow {
  version: number;
  name: string;
  checksum: string;
}

function rowsOf(result: unknown): LedgerRow[] {
  const rows = Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? []);
  return rows as LedgerRow[];
}

export async function runContentAgencyMigrations(
  db: MigrationDatabase,
  options: RunMigrationsOptions = {},
): Promise<MigrationReport> {
  const migrations = [...(options.migrations ?? CONTENT_AGENCY_MIGRATIONS)].sort(
    (a, b) => a.version - b.version,
  );
  const seen = new Set<number>();
  for (const migration of migrations) {
    if (!Number.isInteger(migration.version) || migration.version <= 0) {
      throw new Error(
        `Migration versions must be positive integers (got ${String(migration.version)}).`,
      );
    }
    if (seen.has(migration.version)) {
      throw new Error(`Duplicate migration version ${String(migration.version)}.`);
    }
    seen.add(migration.version);
  }

  await db.execute(rawStatement(LEDGER_DDL));
  // Session-level lock: held until the matching unlock (or the pool client is
  // released), so a second process waits instead of racing the ledger.
  await db.execute(rawStatement(`SELECT pg_advisory_lock(${String(MIGRATION_LOCK_KEY)})`));

  const report: MigrationReport = { applied: [], skipped: [], drifted: [], alreadyCurrent: true };
  try {
    const ledger = rowsOf(
      await db.execute(
        rawStatement(
          'SELECT version, name, checksum FROM content_agency_migrations ORDER BY version',
        ),
      ),
    );
    const applied = new Map<number, LedgerRow>();
    for (const row of ledger) applied.set(row.version, row);

    const pending: ContentAgencyMigration[] = [];
    for (const migration of migrations) {
      const recorded = applied.get(migration.version);
      if (!recorded) {
        pending.push(migration);
        continue;
      }
      if (recorded.checksum !== migrationChecksum(migration)) {
        report.drifted.push({ version: migration.version, name: migration.name });
      } else {
        report.skipped.push(migration.version);
      }
    }

    if (report.drifted.length > 0) {
      if (!options.tolerateDrift) throw new MigrationDriftError(report.drifted);
    }

    if (pending.length > 0) report.alreadyCurrent = false;
    for (const migration of pending) {
      const checksum = migrationChecksum(migration);
      const startedAt = Date.now();
      // One transaction per migration: DDL + ledger row commit together.
      await db.transaction(async (tx) => {
        for (const statement of migration.statements) {
          await tx.execute(statement);
        }
        await tx.execute(
          sql`INSERT INTO content_agency_migrations (version, name, checksum, duration_ms)
              VALUES (${migration.version}, ${migration.name}, ${checksum}, ${Math.max(0, Date.now() - startedAt)})`,
        );
      });
      report.applied.push(migration.version);
    }
    return report;
  } finally {
    await db.execute(rawStatement(`SELECT pg_advisory_unlock(${String(MIGRATION_LOCK_KEY)})`));
  }
}

/** Parameterless statement for internal, non-user-supplied text. */
function rawStatement(text: string): SQL {
  return sql.raw(text);
}

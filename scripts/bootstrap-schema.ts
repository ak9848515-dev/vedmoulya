// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — SCHEMA-01 · dedicated schema-bootstrap command
//
// WHY THIS EXISTS
// ---------------
// Every persistence store creates its own table with idempotent DDL, and the
// gateway currently runs that DDL on the first request of every process (see
// `apps/web/src/app/api/trpc/[trpc]/route.ts` → `hydratePersistence()`). In a
// serverless deployment that means ~77 DDL statements per cold start, each one
// emitting `NOTICE 42P07 … already exists, skipping`. This command runs the
// SAME idempotent creation ONCE per deployment, so a database can be
// provisioned deliberately instead of as a side effect of traffic.
//
// IT IS ADDITIVE — DELIBERATELY
// -----------------------------
// Request-time DDL stays ENABLED. Nothing here disables it; switching that off
// requires an approved migration/deployment plan (and the schema-drift check
// that would make it safe). Running this command on an already-provisioned
// database is a no-op: every statement is `CREATE … IF NOT EXISTS`.
//
// USAGE
//   npx tsx scripts/bootstrap-schema.ts --dry-run     # plan only, no I/O
//   npx tsx scripts/bootstrap-schema.ts               # create + report
//   npx tsx scripts/bootstrap-schema.ts --json        # machine-readable report
//
// SAFETY
//   • exits non-zero when any store fails (partial success is never "done");
//   • never prints a connection string or credential (redacted by core);
//   • refuses to run with NODE_ENV=test (the bundle's DDL set is empty there and
//     a "success" would be a lie).
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { redactConnectionStrings } from '@vedmoulya/core';
import { awaitAllEngineEnsureTables, createEISql } from '@vedmoulya/api';
import { ensureMissionTables } from '@vedmoulya/mission-runtime';
import { resolvePersistenceBundle } from '@vedmoulya/api';
import type { SchemaBootstrapReport } from '@vedmoulya/api';

/**
 * Load `.env.local` exactly like the other operator scripts do (the repository
 * has no dotenv dependency for scripts). An existing process environment always
 * WINS, so a CI/operator-provided value is never overridden. No value is ever
 * printed.
 */
function loadEnvLocal(): void {
  const file = path.resolve(process.cwd(), '.env.local');
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

interface SectionReport {
  section: string;
  ok: boolean;
  detail: string[];
  failed: Array<{ label: string; error: string }>;
}

function fail(label: string, error: unknown): { label: string; error: string } {
  const message = error instanceof Error ? error.message : String(error);
  return { label, error: redactConnectionStrings(message) };
}

async function bootstrapPersistence(dryRun: boolean): Promise<SectionReport> {
  // The Postgres bundle is what has a schema. `forcedEnv` selects it without
  // mutating NODE_ENV (and without the production config fail-fast, which is
  // the gateway's job, not a schema command's).
  const bundle = resolvePersistenceBundle({}, 'production');
  if (bundle.bootstrapSchema === undefined) {
    return {
      section: 'persistence',
      ok: false,
      detail: ['this bundle exposes no schema bootstrap (in-memory bundle)'],
      failed: [{ label: 'persistence', error: 'no bootstrapSchema on the bundle' }],
    };
  }
  const report: SchemaBootstrapReport = await bundle.bootstrapSchema({ dryRun });
  return {
    section: 'persistence',
    ok: report.failed.length === 0,
    detail: [
      `${report.dryRun ? 'planned' : 'applied'} ${String(
        report.dryRun ? report.planned.length : report.applied.length,
      )} of ${String(report.planned.length)} store schema(s)`,
    ],
    failed: report.failed,
  };
}

async function bootstrapEngine(dryRun: boolean): Promise<SectionReport> {
  if (dryRun) {
    return {
      section: 'engine',
      ok: true,
      detail: [
        'planned: engine repositories (identity, memory, decision, execution, knowledge, registries)',
      ],
      failed: [],
    };
  }
  try {
    await awaitAllEngineEnsureTables();
    return {
      section: 'engine',
      ok: true,
      detail: [
        'applied: every registered engine repository (failures are logged by the repository owner)',
      ],
      failed: [],
    };
  } catch (error) {
    return { section: 'engine', ok: false, detail: [], failed: [fail('engine', error)] };
  }
}

async function bootstrapMission(dryRun: boolean): Promise<SectionReport> {
  if (dryRun) {
    return {
      section: 'mission',
      ok: true,
      detail: [
        'planned: mission_controller_missions, mission_controller_checkpoints (workspace leases share the missions table)',
      ],
      failed: [],
    };
  }
  const sql = createEISql('vedmoulya-schema-bootstrap');
  try {
    await ensureMissionTables(sql);
    return {
      section: 'mission',
      ok: true,
      detail: ['applied: mission_controller_missions, mission_controller_checkpoints'],
      failed: [],
    };
  } catch (error) {
    return { section: 'mission', ok: false, detail: [], failed: [fail('mission', error)] };
  }
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');
  const asJson = args.has('--json');

  if (process.env.NODE_ENV === 'test') {
    console.error(
      'bootstrap-schema: refusing to run with NODE_ENV=test (the bundle DDL set is empty in tests, so success would be meaningless).',
    );
    process.exitCode = 2;
    return;
  }
  // Configuration (DATABASE_URL, AUTH_JWT_SECRET, pool sizes) is read lazily by
  // @vedmoulya/core; the command must work in a plain shell exactly like the
  // other operator scripts do.
  loadEnvLocal();

  const sections = [
    await bootstrapPersistence(dryRun),
    await bootstrapEngine(dryRun),
    await bootstrapMission(dryRun),
  ];

  const ok = sections.every((section) => section.ok);
  if (asJson) {
    console.log(JSON.stringify({ dryRun, ok, sections }, null, 2));
  } else {
    console.log(`schema bootstrap — ${dryRun ? 'DRY RUN (no database writes)' : 'APPLY'}`);
    for (const section of sections) {
      console.log(`${section.ok ? '✓' : '✗'} ${section.section}`);
      for (const line of section.detail) console.log(`    ${redactConnectionStrings(line)}`);
      for (const failure of section.failed) {
        console.log(`    ✗ ${failure.label}: ${failure.error}`);
      }
    }
    console.log(ok ? 'schema bootstrap: OK' : 'schema bootstrap: FAILED (see above)');
    console.log('request-time DDL remains ENABLED — this command is additive, not a replacement.');
  }
  process.exitCode = ok ? 0 : 1;
}

void main();

#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Environment loader for the startup script (EPIC-018/019)
//
//   npx tsx scripts/load-env.ts [--mode development|test|staging|production]
//
// Prints bash-safe `export KEY='value'` lines for the dotenv-format files that
// belong to the given mode, so `scripts/startup.sh` can eval them and share ONE
// environment with the preflight and the launched processes:
//
//   • development/test: root .env.local, then apps/web/.env.local (fallback)
//   • production/staging: root .env.local only — the platform environment
//     supplies the rest (never the web dev file)
//
// Precedence (same as the preflight/doctor loaders): a variable ALREADY set in
// the calling shell wins — files never override it. Only `export` lines are
// ever printed to stdout (safe to eval); warnings go to stderr. Secret values
// are never echoed beyond the export line the caller evals (and never printed
// by this script).
//
// EPIC-019: uses the repository's ONE authoritative environment-loading path
// — @vedmoulya/core loadEnvFilesSafe (built-in process.loadEnvFile, Node >=
// 20.12, no dotenv) — exactly like scripts/lib/probes.ts. No duplicated .env
// parsing strategy.
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFilesSafe } from '@vedmoulya/core';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

type LoaderMode = 'development' | 'test' | 'staging' | 'production';
const KNOWN_MODES: readonly LoaderMode[] = ['development', 'test', 'staging', 'production'];

function resolveMode(argv: readonly string[]): LoaderMode {
  const modeIndex = argv.indexOf('--mode');
  if (modeIndex >= 0 && argv[modeIndex + 1]) {
    const candidate = argv[modeIndex + 1] as LoaderMode;
    if ((KNOWN_MODES as readonly string[]).includes(candidate)) return candidate;
    console.error(`ERROR: unknown mode "${candidate}" (expected ${KNOWN_MODES.join(' | ')})`);
    process.exit(2);
  }
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'production' || nodeEnv === 'staging' || nodeEnv === 'test') return nodeEnv;
  return 'development';
}

/** Same file order as the preflight CLI — one authoritative env-file strategy. */
function envFilesFor(mode: LoaderMode): string[] {
  return mode === 'production' || mode === 'staging'
    ? [join(REPO_ROOT, '.env.local')]
    : [join(REPO_ROOT, '.env.local'), join(REPO_ROOT, 'apps', 'web', '.env.local')];
}

/** Single-quote a value for a bash `export KEY='...'` line (never interpolates). */
function bashQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function main(): void {
  const mode = resolveMode(process.argv.slice(2));
  const files = envFilesFor(mode).filter((file) => existsSync(file));

  // Snapshot the caller's environment so only keys actually loaded from the
  // files are emitted below (pre-existing shell vars are already present in
  // the caller — re-exporting them is a no-op).
  const before = new Set(Object.keys(process.env));
  const result = loadEnvFilesSafe(files);
  for (const error of result.errors) {
    console.error(`WARNING: ${error}`);
  }

  const loaded = Object.keys(process.env).filter((key) => !before.has(key));
  for (const key of loaded) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      console.error(`WARNING: skipping env key "${key}" (not a valid shell identifier).`);
      continue;
    }
    const value = process.env[key];
    if (value === undefined) continue;
    console.log(`export ${key}=${bashQuote(value)}`);
  }
}

main();

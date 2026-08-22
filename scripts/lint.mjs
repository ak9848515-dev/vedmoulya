#!/usr/bin/env node
/**
 * SPRINT-066 — Monorepo-aware ESLint runner (workspace-scoped, process-isolated).
 *
 * WHY THIS EXISTS
 * --------------
 * This monorepo exposes every workspace package as TypeScript SOURCE
 * (`"exports": "./src/index.ts"`). Any type-aware lint scope therefore
 * compiles the full transitive type graph of everything it imports. apps/web
 * and services/api both import nearly the entire repository, so a *single*
 * `eslint .` process must keep ~56 workspace programs plus the whole-repo
 * default program alive at once — measured at 2.1–2.2 GB peak, which exceeds
 * Node's default ~2 GB V8 heap (abort: "Ineffective mark-compacts near heap
 * limit", exit 134). See SPRINT-066 FINAL REPORT for measurements.
 *
 * FIX
 * ---
 * 1. Run ESLint once per workspace (plus one "root config/scripts" scope) so
 *    each Node process only holds the TypeScript graphs of THAT scope.
 * 2. Give each scoped process a modest, documented heap headroom
 *    (--max-old-space-size=4096). apps/web alone peaks at ~2.1 GB (measured),
 *    so Node's default ~2 GB cap can still crash that scope; 4 GB is the
 *    smallest comfortable ceiling and is far below typical dev hardware.
 *
 * Coverage guarantees:
 *   - `npm run lint` aggregates EVERY workspace and the root scope; no source
 *     directory is silently skipped.
 *   - File discovery stays with ESLint's flat config (ruleset unchanged).
 *
 * Usage:
 *   node scripts/lint.mjs                 # everything (workspaces + root)
 *   node scripts/lint.mjs --web           # only apps/web
 *   node scripts/lint.mjs --api           # only services/api
 *   node scripts/lint.mjs --services      # all services/*
 *   node scripts/lint.mjs --packages      # all packages/*
 *   node scripts/lint.mjs --root          # root configs + scripts + tooling
 *   node scripts/lint.mjs --fix           # pass --fix to every scope
 *   env LINT_CONCURRENCY=2 ...            # run up to N scopes in parallel (CI)
 */
import { spawn } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const eslintBin = path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js');
const HEAP_MB = process.env.LINT_HEAP_MB || '4096';

function listWorkspaces(topLevel) {
  const dir = path.join(root, topLevel);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(path.join(dir, e.name, 'tsconfig.json')))
    .map((e) => `${topLevel}/${e.name}`)
    .sort();
}

/** All lintable files outside apps|packages|services (root config/scripts/tooling). */
function rootScopeFiles() {
  const ext = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs']);
  const out = [];
  const IGN = new Set(['node_modules', '.git', '.next', '.storybook', 'dist', 'build', 'coverage', 'out', 'android', 'storybook-static', 'test-results', 'playwright-report']);
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (IGN.has(e.name)) continue;
      const fp = path.join(d, e.name);
      if (e.isDirectory()) {
        if (['scripts', 'tests', 'tooling'].includes(e.name) || d === root) walk(fp);
      } else if (ext.has(path.extname(e.name)) && !e.name.endsWith('.d.ts')) {
        const rel = path.relative(root, fp);
        if (!/^(apps|packages|services)[\\/]/.test(rel)) out.push(rel);
      }
    }
  };
  walk(root);
  return out.sort();
}

function runScope(scope, fix) {
  const t0 = Date.now();
  const cacheDir = path.join(root, 'node_modules', '.cache', 'eslint-lint');
  const cacheLocation = path.join(cacheDir, `${scope.label.replace(/[^a-z0-9_-]/gi, '_')}.json`);
  const cmdArgs = [eslintBin, ...scope.args, '--cache', '--cache-location', cacheLocation];
  if (fix) cmdArgs.push('--fix');
  const child = spawn(process.execPath, cmdArgs, {
    cwd: root,
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --max-old-space-size=${HEAP_MB}`.trim() },
  });
  return new Promise((resolve) => {
    child.on('close', (code) => {
      console.log(`${code === 0 ? 'PASS' : 'FAIL'} <${scope.label}> (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
      resolve(code !== 0);
    });
  });
}
async function main() {
  const flagNames = ['--web', '--api', '--services', '--packages', '--root'];
  const want = new Set(process.argv.slice(2).filter((a) => [...flagNames, '--fix'].includes(a)));
  const fix = want.has('--fix');
  const all = !flagNames.some((f) => want.has(f));

  const scopes = [];
  if (all || want.has('--web')) scopes.push({ label: 'apps/web', args: ['apps/web'] });
  if (want.has('--api')) scopes.push({ label: 'services/api', args: ['services/api'] });
  if (all || want.has('--packages')) scopes.push(...listWorkspaces('packages').map((w) => ({ label: w, args: [w] })));
  if (all || want.has('--services')) scopes.push(...listWorkspaces('services').map((w) => ({ label: w, args: [w] })));
  if (all || want.has('--root')) {
    const files = rootScopeFiles();
    if (files.length) scopes.push({ label: 'root', args: files });
  }

  const concurrency = Math.max(1, parseInt(process.env.LINT_CONCURRENCY || '1', 10) || 1);
  const started = Date.now();
  let failedScopes = 0;

  const queue = [...scopes];
  const worker = async () => {
    while (queue.length) {
      const scope = queue.shift();
      const isBad = await runScope(scope, fix);
      if (isBad) failedScopes += 1;
    }
  };
  const workers = Array.from({ length: Math.min(concurrency, scopes.length || 1) }, () => worker());
  await Promise.all(workers);

  console.log('\n--- lint summary ---');
  for (const s of scopes) console.log(`  ${s.label}`);
  console.log(`scopes=${scopes.length} failed=${failedScopes} wallTime=${((Date.now() - started) / 1000).toFixed(1)}s`);
  if (failedScopes > 0) {
    console.error('LINT FAILED: one or more scopes reported errors.');
    process.exit(1);
  }
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(2);
}
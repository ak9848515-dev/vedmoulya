// SPRINT-045 — table inventory v2: extract double-quoted identifiers used
// inside postgres.js tagged templates (`sql\`...\``) and CREATE TABLE /
// ensureTable statements, then report which are absent from the live DB.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const EXCL = /(node_modules|dist|coverage|\.next|tsbuildinfo|\.map$)/;
const TEXT = /\.(ts|tsx|mjs|js)$/;

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (EXCL.test(p)) continue;
    if (e.isDirectory()) walk(p, acc);
    else if (TEXT.test(e.name)) acc.push(p);
  }
  return acc;
}

const files = [
  ...walk(join(ROOT, 'services')),
  ...walk(join(ROOT, 'packages')),
  ...walk(join(ROOT, 'apps/web/src')),
  ...walk(join(ROOT, 'scripts')),
];

const tableNames = new Set();
for (const f of files) {
  let src;
  try {
    if (statSync(f).size > 512 * 1024) continue;
    src = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  // (a) quoted identifiers inside tagged template bodies: sql`... "name" ...`
  const templateRe = /(?:sql|postgres)\s*`([^`]{0,4000})`/gi;
  let m;
  while ((m = templateRe.exec(src))) {
    const body = m[1];
    for (const q of body.matchAll(/"([a-z][a-z0-9_]{2,})"/gi)) tableNames.add(q[1].toLowerCase());
    for (const q of body.matchAll(/\b(from|into|update|table)\s+([a-z][a-z0-9_]{2,})/gi)) tableNames.add(q[2].toLowerCase());
  }
  // (b) CREATE TABLE IF NOT EXISTS "name" / ensureTable('name') patterns
  for (const q of src.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([a-z][a-z0-9_]{2,})["`]?/gi)) {
    tableNames.add(q[1].toLowerCase());
  }
  for (const q of src.matchAll(/ensureTable\(\s*["'`]([a-z][a-z0-9_]{2,})["'`]/gi)) {
    tableNames.add(q[1].toLowerCase());
  }
}

const live = new Set(
  execSync(
    'docker exec vedmoulya-postgres psql -U vedmoulya -d vedmoulya -t -A -c "SELECT tablename FROM pg_tables WHERE schemaname=\'public\';"',
    { encoding: 'utf8' },
  )
    .split('\n')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

const missing = [...tableNames].filter((t) => !live.has(t)).sort();
console.log(`REFERENCED_TABLES=${tableNames.size}`);
console.log(`MISSING_FROM_LIVE_DB=${missing.length}`);
console.log('---MISSING---');
for (const t of missing) console.log(t);

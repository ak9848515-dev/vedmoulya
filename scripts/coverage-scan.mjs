#!/usr/bin/env node
// Reads a workspace coverage-final.json and prints per-file coverage (lowest first).
// Usage: node scripts/coverage-scan.mjs <workspace-dir>
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ws = process.argv[2];
if (!ws) {
  console.error('Usage: node scripts/coverage-scan.mjs <workspace-dir>');
  process.exit(1);
}
const p = join(ws, 'coverage', 'coverage-final.json');
if (!existsSync(p)) {
  console.log('no report at ' + p);
  process.exit(0);
}
const c = JSON.parse(readFileSync(p, 'utf8'));
const rows = [];
for (const [f, s] of Object.entries(c)) {
  if (!f.endsWith('.ts')) continue;
  const stmts = Object.keys(s.s ?? {}).length;
  const stmtsH = Object.values(s.s ?? {}).filter((v) => v > 0).length;
  const fn = Object.keys(s.f ?? {}).length;
  const fnH = Object.values(s.f ?? {}).filter((v) => v > 0).length;
  // v8 branch format: each branch is an array of execution counts.
  const branches = Object.values(s.b ?? {});
  const brH = branches.filter((counts) => counts.some((c2) => c2 > 0)).length;
  rows.push({
    f: f.split('/').slice(-4).join('/'),
    l: stmts ? (stmtsH / stmts) * 100 : 100,
    f2: fn ? (fnH / fn) * 100 : 100,
    b: branches.length ? (brH / branches.length) * 100 : 100,
  });
}
rows.sort((a, b) => a.l - b.l);
for (const r of rows) {
  console.log(
    `lines:${r.l.toFixed(0).padStart(3)}% fn:${r.f2.toFixed(0).padStart(3)}% br:${r.b.toFixed(0).padStart(3)}%  ${r.f}`,
  );
}

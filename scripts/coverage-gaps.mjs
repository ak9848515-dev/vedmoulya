#!/usr/bin/env node
// Prints overall coverage metrics per workspace and the smallest coverage files.
// Usage: node scripts/coverage-gaps.mjs <workspace-dir>
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ws = process.argv[2];
if (!ws) {
  console.error('Usage: node scripts/coverage-gaps.mjs <workspace-dir>');
  process.exit(1);
}
const p = join(ws, 'coverage', 'coverage-final.json');
if (!existsSync(p)) {
  console.log('no report at ' + p);
  process.exit(0);
}
const c = JSON.parse(readFileSync(p, 'utf8'));
let st = 0,
  stH = 0,
  fn = 0,
  fnH = 0,
  br = 0,
  brH = 0,
  ln = 0,
  lnH = 0;
const rows = [];
for (const [f, s] of Object.entries(c)) {
  if (!f.endsWith('.ts')) continue;
  const stmts = Object.keys(s.s ?? {});
  const funcs = Object.keys(s.f ?? {});
  const branches = Object.values(s.b ?? {});
  const stH0 = stmts.filter((k) => s.s[k] > 0).length;
  const fnH0 = funcs.filter((k) => s.f[k] > 0).length;
  const brH0 = branches.filter((counts) => counts.some((v) => v > 0)).length;
  st += stmts.length; stH += stH0; fn += funcs.length; fnH += fnH0; br += branches.length; brH += brH0;
  const lines = Object.keys(s.s ?? {});
  ln += lines.length; lnH += stH0;
  rows.push({
    f: f.split('/').slice(-4).join('/'),
    l: stmts.length ? (stH0 / stmts.length) * 100 : 100,
    f2: funcs.length ? (fnH0 / funcs.length) * 100 : 100,
    b: branches.length ? (brH0 / branches.length) * 100 : 100,
  });
}
const pct = (h, t) => (t ? ((h / t) * 100).toFixed(2) : '100.00');
console.log(
  `OVERALL ${ws}: statements ${pct(stH, st)}% functions ${pct(fnH, fn)}% branches ${pct(brH, br)}% lines ${pct(lnH, ln)}%`,
);
rows.sort((a, b) => a.l - b.l);
console.log('\nLOWEST LINE COVERAGE FILES:');
for (const r of rows.slice(0, 12)) {
  console.log(
    `  lines:${r.l.toFixed(0).padStart(3)}% fn:${r.f2.toFixed(0).padStart(3)}% br:${r.b.toFixed(0).padStart(3)}%  ${r.f}`,
  );
}

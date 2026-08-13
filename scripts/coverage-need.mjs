#!/usr/bin/env node
// Computes how many statements/branches/lines/functions are missing per workspace
// and what file they're in. Usage: node scripts/coverage-need.mjs <workspace-dir>
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ws = process.argv[2];
const p = join(ws, 'coverage', 'coverage-final.json');
if (!existsSync(p)) {
  console.log('no report at ' + p);
  process.exit(0);
}
const c = JSON.parse(readFileSync(p, 'utf8'));
let totalSt = 0, covSt = 0, totalBr = 0, covBr = 0, totalFn = 0, covFn = 0, totalLn = 0, covLn = 0;
const fileData = [];
for (const [f, s] of Object.entries(c)) {
  if (!f.endsWith('.ts')) continue;
  const stmts = Object.keys(s.s ?? {});
  const stH = stmts.filter((k) => s.s[k] > 0).length;
  const branches = Object.values(s.b ?? {});
  const brH = branches.filter((counts) => counts.some((v) => v > 0)).length;
  const funcs = Object.keys(s.f ?? {});
  const fnH = funcs.filter((k) => s.f[k] > 0).length;
  totalSt += stmts.length; covSt += stH;
  totalBr += branches.length; covBr += brH;
  totalFn += funcs.length; covFn += fnH;
  totalLn += stmts.length; covLn += stH;
  fileData.push({ f, totalSt, missingSt: stmts.length - stH, totalBr: branches.length, missingBr: branches.length - brH, totalFn: funcs.length, missingFn: funcs.length - fnH });
}
const fmt = (v) => v.toFixed(2);
console.log(`${ws}: stmts ${fmt(covSt)}/${totalSt} (${fmt((covSt / totalSt) * 100)}%) | br ${fmt(covBr)}/${totalBr} (${fmt((covBr / totalBr) * 100)}%) | fn ${fmt(covFn)}/${totalFn} (${fmt((covFn / totalFn) * 100)}%) | lines ${fmt(covLn)}/${totalLn} (${fmt((covLn / totalLn) * 100)}%)`);
console.log('\nFiles with most missing statements (need +5% stmts to reach 80):');
const target = (covSt + totalSt * 0.05) / totalSt;
fileData.sort((a, b) => b.missingSt - a.missingSt).slice(0, 15).forEach((d) => {
  console.log(`  missingSt:${String(d.missingSt).padStart(4)} br:${String(d.missingBr).padStart(4)} fn:${String(d.missingFn).padStart(4)}  ${d.f.split('/').slice(-4).join('/')}`);
});

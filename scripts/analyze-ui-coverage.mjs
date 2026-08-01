import fs from 'fs';
import path from 'path';

const covPath = path.resolve('packages/ui/coverage/coverage-final.json');
if (!fs.existsSync(covPath)) {
  console.error('coverage report not found:', covPath);
  process.exit(1);
}
const cov = JSON.parse(fs.readFileSync(covPath, 'utf8'));

const rows = [];
for (const [file, data] of Object.entries(cov)) {
  const norm = file.replace(/\\/g, '/');
  const rel = norm.replace(/^.*\/packages\/ui\/src\//, '');
  if (rel === norm) continue;
  const stmts = Object.keys(data.s ?? {});
  const covered = stmts.filter((k) => data.s[k] > 0).length;
  const funcs = Object.keys(data.f ?? {});
  const fCovered = funcs.filter((k) => data.f[k] > 0).length;
  const branches = Object.keys(data.b ?? {});
  let bTotal = 0;
  let bCovered = 0;
  for (const k of branches) {
    const hits = data.b[k];
    const paths = data.branchMap?.[k]?.locations?.length ?? (Array.isArray(hits) ? hits.length : 1);
    bTotal += paths;
    if (Array.isArray(hits)) bCovered += hits.filter((h) => h > 0).length;
    else if (hits > 0) bCovered += paths;
  }
  rows.push({
    rel,
    stmts: stmts.length,
    uncovered: stmts.length - covered,
    fnPct: funcs.length ? Math.round((fCovered / funcs.length) * 1000) / 10 : 100,
    funcs: funcs.length,
    fUncovered: funcs.length - fCovered,
    brPct: bTotal ? Math.round((bCovered / bTotal) * 1000) / 10 : 100,
  });
}

const totalSt = rows.reduce((a, r) => a + r.stmts, 0);
const totalUnc = rows.reduce((a, r) => a + r.uncovered, 0);
console.log(
  `TOTAL statements=${totalSt} uncovered=${totalUnc} (${Math.round(((totalSt - totalUnc) / totalSt) * 1000) / 10}%)`,
);
const sub = rows
  .sort((a, b) => b.uncovered - a.uncovered)
  .map(
    (r) =>
      `${String(r.uncovered).padStart(4)} unc ${String(r.fUncovered).padStart(3)} fn  ${String(r.brPct).padStart(5)}% br  ${r.rel}`,
  );
console.log(sub.join('\n'));

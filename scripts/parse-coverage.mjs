// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Coverage parser (per-workspace summary from aggregate JSON)
// Usage: node scripts/parse-coverage.mjs [path-to-coverage-final.json]
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

const path = process.argv[2] ?? './coverage/coverage-final.json';
const c = JSON.parse(readFileSync(path, 'utf8'));

const byWs = new Map();
const pct = (t, cov) => (t === 0 ? 'n/a' : `${Math.round((cov / t) * 1000) / 10}%`);

for (const file of Object.keys(c)) {
  const m = file.match(/[\\/](packages|services|apps)[\\/]([^\\/]+)/);
  const key = m ? `${m[1]}/${m[2]}` : '(root)';
  const s = c[file];
  let w = byWs.get(key);
  if (!w) {
    w = { st: 0, stC: 0, br: 0, brC: 0, fn: 0, fnC: 0 };
    byWs.set(key, w);
  }
  if (s.s) {
    w.st += Object.keys(s.s).length;
    w.stC += Object.values(s.s).filter((v) => v > 0).length;
  }
  if (s.f) {
    w.fn += Object.keys(s.f).length;
    w.fnC += Object.values(s.f).filter((v) => v > 0).length;
  }
  if (s.b) {
    for (const bv of Object.values(s.b)) {
      w.br += bv.length;
      w.brC += bv.filter((v) => v > 0).length;
    }
  }
}

const rows = [...byWs.entries()].sort((a, b) => a[0].localeCompare(b[0]));
for (const [k, w] of rows) {
  console.log(
    k.padEnd(28),
    `stmts=${pct(w.st, w.stC)} branch=${pct(w.br, w.brC)} funcs=${pct(w.fn, w.fnC)}`,
  );
}

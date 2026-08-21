// SPRINT-043 — dead-code discovery: files never imported by any other source file.
// Conservative: excludes entry points (index), routes, tests, and type declarations.
import fs from 'node:fs';
import path from 'node:path';

const files = [];
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    if (['node_modules', '.next', 'dist', '__tests__', 'coverage', '.git'].includes(f)) continue;
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(f)) files.push(p);
  }
}
for (const root of ['apps/web/src', 'packages', 'services']) walk(root);

// Map every module path -> its normalized no-extension path, and index basenames.
const norm = new Map();
const byBasename = new Map();
for (const f of files) {
  const n = f.split(path.sep).join('/').replace(/\.[jt]sx?$/, '');
  norm.set(f, n);
  const base = path.basename(n);
  if (!byBasename.has(base)) byBasename.set(base, new Set());
  byBasename.get(base).add(n);
}

// Single pass: for each file, resolve every import to concrete module paths.
const resolved = new Set();
const re = /from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  const dir = path.dirname(norm.get(f));
  let m;
  while ((m = re.exec(c))) {
    const spec = (m[1] || m[2] || '').trim();
    if (!spec) continue;
    let candidates = [];
    if (spec.startsWith('.')) {
      const base = path.posix.normalize(path.posix.join(dir, spec)).replace(/\.(ts|tsx|js|jsx)$/, '');
      candidates = [base, base + '/index'];
    } else {
      // bare @vedmoulya/... spec — match full path or basename
      const clean = spec.split(path.sep).join('/').replace(/\.(ts|tsx|js|jsx)$/, '');
      if (byBasename.has(path.basename(clean))) candidates.push(clean);
    }
    for (const cand of candidates) {
      if (norm.has(f) && norm.get(f) === cand) continue;
      const hit = [...norm.values()].find((n) => n === cand);
      if (hit) resolved.add(hit);
    }
  }
}

const candidates = [];
for (const f of files) {
  const n = norm.get(f); // forward-slash normalized
  const base = path.basename(n);
  const isIndex = base === 'index.ts' || base === 'index.tsx';
  const isTest = /\.(test|spec)\./.test(base);
  const isTypes = /\.d\.ts$/.test(base);
  const isRoute =
    n.includes('/app/') &&
    /page|layout|route|loading|error|not-found|template|head/.test(base);
  if (isIndex || isTest || isTypes || isRoute) continue;
  if (!resolved.has(n)) candidates.push(f);
}

console.log('Total files scanned:', files.length);
console.log('=== never-imported candidates (entry/routes/tests/types excluded) ===');
for (const c of candidates) console.log('  ' + c);

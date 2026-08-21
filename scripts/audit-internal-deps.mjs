// SPRINT-043E Phase B — internal-dependency audit (evidence gathering).
// For every workspace, list internal @vedmoulya/* deps whose name appears in
// NO text file of that workspace (src, tests, configs, README, scripts).
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const EXCL = /(node_modules|dist|coverage|\.next|tsbuildinfo|\.map$)/;
const TEXT = /\.(ts|tsx|mjs|js|jsx|json|css|md|yml|yaml|sh)$/;
const PKG_JSON = /package\.json$/;

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (EXCL.test(p)) continue;
    if (e.isDirectory()) walk(p, acc);
    else if (TEXT.test(e.name) && !PKG_JSON.test(e.name)) acc.push(p);
  }
  return acc;
}

const workspaces = [ROOT];
for (const sub of ['packages', 'services', 'apps']) {
  const base = join(ROOT, sub);
  if (!existsSync(base)) continue;
  for (const e of readdirSync(base, { withFileTypes: true })) {
    if (e.isDirectory() && existsSync(join(base, e.name, 'package.json'))) workspaces.push(join(base, e.name));
  }
}

for (const ws of workspaces) {
  const pkg = JSON.parse(readFileSync(join(ws, 'package.json'), 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const internal = Object.keys(deps).filter((d) => d.startsWith('@vedmoulya/'));
  if (internal.length === 0) continue;
  const files = walk(ws);
  const content = files
    .map((f) => {
      try {
        if (statSync(f).size > 512 * 1024) return '';
        return readFileSync(f, 'utf8');
      } catch {
        return '';
      }
    })
    .join('\n');
  for (const d of internal) {
    const escaped = d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const count = (content.match(new RegExp(escaped, 'g')) ?? []).length;
    if (count === 0) console.log(`UNUSED: ${pkg.name} -> ${d}`);
  }
}

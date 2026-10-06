#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Workspace Dependency-Cycle Gate (G1 · Architecture)
//
// Builds the internal @vedmoulya/* dependency graph from the REAL package.json
// manifests (apps/*, packages/*, services/*) and fails when any cycle exists.
// A cycle between workspaces is an architectural defect: it makes the build
// order ambiguous, defeats package layering, and turns an isolated change into
// a whole-graph rebuild.
//
// It is deterministic and self-contained — no network, no build, no external
// tooling. The graph is derived from manifests; source imports are not parsed,
// so a cycle introduced by an undeclared import is out of scope by design.
//
// Usage:
//   node scripts/check-dependency-cycles.mjs                  # full graph
//   node scripts/check-dependency-cycles.mjs --prod           # dependencies only
//   node scripts/check-dependency-cycles.mjs --json           # machine-readable
//   node scripts/check-dependency-cycles.mjs --root <dir>     # audit another root
//
// Exit: 0 acyclic · 1 cycle(s) found · 2 usage/IO error
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const PROD_ONLY = args.includes('--prod');
const AS_JSON = args.includes('--json');
const rootIndex = args.indexOf('--root');
const ROOT_ARG = rootIndex >= 0 ? args[rootIndex + 1] : undefined;

/** Runtime dependency fields (the architectural graph). */
const PROD_FIELDS = ['dependencies', 'optionalDependencies', 'peerDependencies'];
/** Additional fields considered unless --prod is passed. */
const DEV_FIELDS = ['devDependencies'];
const FIELDS = PROD_ONLY ? PROD_FIELDS : [...PROD_FIELDS, ...DEV_FIELDS];

const ROOT = resolve(ROOT_ARG ?? join(import.meta.dirname, '..'));
const SCOPE_DIRS = ['apps', 'packages', 'services'];

function readManifest(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    console.error(`ERROR  invalid package.json at ${path}: ${error.message}`);
    process.exit(2);
  }
}

// ── 1. Collect the workspaces ────────────────────────────────────────────────
/** @type {Map<string, { dir: string; deps: Map<string, string[]> }>} */
const workspaces = new Map();

for (const scope of SCOPE_DIRS) {
  const base = join(ROOT, scope);
  if (!existsSync(base)) continue;
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(base, entry.name);
    const manifestPath = join(dir, 'package.json');
    if (!existsSync(manifestPath)) continue;
    const pkg = readManifest(manifestPath);
    const name = typeof pkg.name === 'string' ? pkg.name : '';
    if (!name) {
      console.error(`ERROR  ${scope}/${entry.name}/package.json has no "name"`);
      process.exit(2);
    }
    const deps = new Map();
    for (const field of FIELDS) {
      const block = pkg[field];
      if (!block || typeof block !== 'object') continue;
      for (const [dep, version] of Object.entries(block)) {
        if (!dep.startsWith('@vedmoulya/')) continue;
        const kinds = deps.get(dep) ?? [];
        if (!kinds.includes(field)) kinds.push(field);
        deps.set(dep, kinds);
      }
    }
    workspaces.set(name, { dir: `${scope}/${entry.name}`, deps });
  }
}

// ── 2. Keep only edges that point at a real workspace ────────────────────────
// A @vedmoulya/* dependency that is not a workspace in this repo cannot form a
// cycle here; it is reported once as a warning instead of silently dropped.
const external = new Map();
const graph = new Map();
for (const [name, { deps }] of workspaces) {
  const known = [];
  for (const [dep, kinds] of deps) {
    if (workspaces.has(dep)) known.push([dep, kinds]);
    else external.set(`${name} -> ${dep}`, kinds);
  }
  graph.set(name, known);
}

// ── 3. Tarjan's strongly-connected components (deterministic order) ─────────
let index = 0;
const indices = new Map();
const lowlink = new Map();
const onStack = new Set();
const stack = [];
const components = [];

function strongConnect(node) {
  indices.set(node, index);
  lowlink.set(node, index);
  index += 1;
  stack.push(node);
  onStack.add(node);

  for (const [next] of graph.get(node) ?? []) {
    if (!indices.has(next)) {
      strongConnect(next);
      lowlink.set(node, Math.min(lowlink.get(node), lowlink.get(next)));
    } else if (onStack.has(next)) {
      lowlink.set(node, Math.min(lowlink.get(node), indices.get(next)));
    }
  }

  if (lowlink.get(node) === indices.get(node)) {
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== node);
    components.push(component);
  }
}

for (const name of [...graph.keys()].sort()) {
  if (!indices.has(name)) strongConnect(name);
}

// A component is a cycle when it has >1 member, or one member with a self-edge.
const cycles = components
  .filter((component) => {
    if (component.length > 1) return true;
    const only = component[0];
    return graph.get(only).some(([dep]) => dep === only);
  })
  .map((component) => component.sort())
  .sort((a, b) => a[0].localeCompare(b[0]));

// ── 4. A readable, deterministic cycle path per component ───────────────────
function cyclePath(component) {
  const members = new Set(component);
  const start = [...component].sort()[0];
  const path = [];
  const seen = new Set();

  const walk = (node) => {
    path.push(node);
    seen.add(node);
    const neighbours = (graph.get(node) ?? [])
      .map(([dep]) => dep)
      .filter((dep) => members.has(dep))
      .sort();
    for (const next of neighbours) {
      if (next === start) {
        path.push(start);
        return true;
      }
      if (!seen.has(next) && walk(next)) return true;
    }
    path.pop();
    seen.delete(node);
    return false;
  };

  walk(start);
  return path;
}

// ── 5. Report ────────────────────────────────────────────────────────────────
if (AS_JSON) {
  console.log(
    JSON.stringify(
      {
        workspaces: workspaces.size,
        edges: [...graph.values()].reduce((n, edges) => n + edges.length, 0),
        fields: FIELDS,
        cycles: cycles.map(cyclePath),
        external: [...external.keys()].sort(),
      },
      null,
      2,
    ),
  );
  process.exit(cycles.length > 0 ? 1 : 0);
}

const line = (s) => process.stdout.write(s + '\n');
line('DEPENDENCY CYCLE GATE');
line(`graph: ${workspaces.size} workspaces · fields: ${FIELDS.join(', ')}`);
line('');

if (cycles.length === 0) {
  line(`OK     no internal dependency cycles (${workspaces.size} workspaces scanned)`);
} else {
  for (const component of cycles) {
    line(`FAIL   cycle: ${cyclePath(component).join(' → ')}`);
  }
}

if (external.size > 0 && !PROD_ONLY) {
  line(`INFO   ${external.size} @vedmoulya/* dep(s) point outside this repo (not cycle-checked)`);
}

line('');
if (cycles.length > 0) {
  line(`DEPENDENCY CYCLES: FAILED (${cycles.length} cycle(s))`);
  process.exit(1);
}
line('DEPENDENCY CYCLES: OK');

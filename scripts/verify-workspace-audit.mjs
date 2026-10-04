#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Independent verifier for the VedMoulya workspace manifest audit.
//
// A REAL Node process (no VedMoulya runtime involved) that re-derives the
// audited facts from the actual package.json files in the authorized
// workspace and checks that the audit published by the Mission is factually
// correct. Exits 0 only when every published figure matches the filesystem.
//
// Usage: node scripts/verify-workspace-audit.mjs <workspaceRoot> [scopeCsv]
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2];
if (!root || !existsSync(root)) {
  console.error(`workspace root not found: ${root ?? '(missing argument)'}`);
  process.exit(2);
}

const packagesDir = join(root, 'packages');
// Audit SCOPE: the packages under audit. Optional 3rd argument = comma
// separated package dir names; defaults to every package in the workspace.
const scopeArg = process.argv[3];
const scopedDirs =
  scopeArg !== undefined && scopeArg !== ''
    ? scopeArg
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : readdirSync(packagesDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);

const manifests = scopedDirs
  .map((dir) => {
    const file = join(packagesDir, dir, 'package.json');
    if (!existsSync(file)) return null;
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return {
      dir,
      name: parsed.name,
      version: parsed.version,
      deps: Object.keys(parsed.dependencies ?? {}).length,
      gaps: [!parsed.name && 'missing name', !parsed.version && 'missing version'].filter(Boolean),
    };
  })
  .filter(Boolean);

const namesSorted = manifests.map((m) => m.name).sort((a, b) => a.localeCompare(b));
const totalDeps = manifests.reduce((sum, m) => sum + m.deps, 0);
const totalGaps = manifests.reduce((sum, m) => sum + m.gaps.length, 0);

const expected = {
  'packages-inventory.md': `Audited ${manifests.length} manifests: ${namesSorted.join(', ')}`,
  'dependency-audit.md': `Total runtime dependencies across audited manifests: ${totalDeps}`,
  'release-signoff.md': `Release audit complete: ${manifests.length} manifests audited, ${totalGaps} name or version gaps`,
};

let failures = 0;
for (const [file, want] of Object.entries(expected)) {
  const full = join(root, file);
  if (!existsSync(full)) {
    console.error(`MISSING ${file}`);
    failures += 1;
    continue;
  }
  const got = readFileSync(full, 'utf8');
  if (got !== want) {
    console.error(`MISMATCH ${file}\n  expected: ${want}\n  actual  : ${got}`);
    failures += 1;
  } else {
    console.log(`OK ${file}`);
  }
}

if (failures > 0) {
  console.error(`AUDIT VERIFICATION FAILED (${failures} mismatch(es))`);
  process.exit(1);
}
console.log(
  `AUDIT VERIFIED against ${manifests.length} real manifests (${totalDeps} deps, ${totalGaps} gaps)`,
);

#!/usr/bin/env node
// Runs the existing per-workspace coverage gate in bounded parallel batches.
// Each workspace still uses its own Vitest configuration and thresholds.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(join(fileURLToPath(new URL('.', import.meta.url)), '..'));
const concurrency = Math.max(
  1,
  Number.parseInt(process.env.COVERAGE_GATE_CONCURRENCY ?? '4', 10) || 4,
);

const workspaces = ['packages', 'services']
  .flatMap((scope) => {
    const scopeDir = join(root, scope);
    if (!existsSync(scopeDir)) return [];
    return readdirSync(scopeDir)
      .filter((name) => existsSync(join(scopeDir, name, 'vitest.config.ts')))
      .map((name) => `${scope}/${name}`);
  })
  .sort();

const batches = Array.from({ length: Math.min(concurrency, workspaces.length) }, () => []);
workspaces.forEach((workspace, index) => {
  batches[index % batches.length].push(workspace);
});

function runBatch(batch) {
  return new Promise((resolveBatch) => {
    const child = spawn(process.execPath, [join(root, 'scripts', 'coverage-gate.mjs')], {
      cwd: root,
      env: { ...process.env, COVERAGE_GATE_FILTER: batch.join(',') },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
    });

    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
    });
    child.on('close', (code) => {
      resolveBatch(code ?? 1);
    });
  });
}

const exitCodes = await Promise.all(batches.filter((batch) => batch.length > 0).map(runBatch));

if (exitCodes.some((code) => code !== 0)) {
  process.exit(1);
}

const merged = {};
for (const workspace of workspaces) {
  const file = join(root, workspace, 'coverage', 'coverage-final.json');
  if (!existsSync(file)) continue;
  Object.assign(merged, JSON.parse(readFileSync(file, 'utf8')));
}
const outputDir = join(root, 'coverage');
mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, 'coverage-final.json'), `${JSON.stringify(merged, null, 2)}\n`);
console.log(
  `\nCoverage gate completed for ${String(workspaces.length)} workspace(s) using ${String(batches.length)} concurrent batch(es).`,
);

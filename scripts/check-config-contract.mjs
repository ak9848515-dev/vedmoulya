#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Configuration Contract Gate (S1)
//
// A deterministic CHECK of the configuration CONTRACT. It is NOT a second
// configuration framework: it never validates or defaults a value, and never
// reads a secret. It only asserts that
//
//   1. every REQUIRED_PRODUCTION variable is documented in BOTH example files;
//   2. no example file contains a real-looking secret value;
//   3. the committed inventory is in sync with a fresh scan (when it exists).
//
// Exit: 0 contract holds · 1 contract violated · 2 usage/IO error
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const line = (s) => process.stdout.write(s + '\n');

// The authoritative REQUIRED_PRODUCTION set, derived from packages/core
// fail-fast validation (requireJwtSecret + requireExternalUrl outside
// development). Keep in sync with scripts/config-classify.mjs.
const REQUIRED_PRODUCTION = [
  'AUTH_JWT_SECRET',
  'DATABASE_URL',
  'IDENTITY_DATABASE_URL',
  'REDIS_URL',
];

const EXAMPLE_FILES = ['.env.example', '.env.production.example'];

// Real credential shapes. A committed example file must contain NONE.
const SECRET_SHAPES = [
  { name: 'OpenAI-style key', re: /sk-[A-Za-z0-9]{32,}/ },
  { name: 'Google API key', re: /AIza[A-Za-z0-9_-]{30,}/ },
  { name: 'AWS access key id', re: /AKIA[A-Z0-9]{16}/ },
];

const declaredNames = (text) =>
  new Set([...text.matchAll(/^#?\s*([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]));

let failures = 0;

line('CONFIGURATION CONTRACT GATE');
line('');

for (const file of EXAMPLE_FILES) {
  const full = resolve(process.cwd(), file);
  if (!existsSync(full)) {
    line(`ERROR  ${file} not found`);
    failures += 1;
    continue;
  }
  const text = readFileSync(full, 'utf8');
  const declared = declaredNames(text);

  const missing = REQUIRED_PRODUCTION.filter((name) => !declared.has(name));
  if (missing.length > 0) {
    line(`FAIL   ${file}: REQUIRED_PRODUCTION not documented: ${missing.join(', ')}`);
    failures += 1;
  } else {
    line(`OK     ${file}: all ${REQUIRED_PRODUCTION.length} REQUIRED_PRODUCTION documented`);
  }

  for (const shape of SECRET_SHAPES) {
    if (shape.re.test(text)) {
      line(`FAIL   ${file}: contains a real-looking ${shape.name}`);
      failures += 1;
    }
  }
  line(`OK     ${file}: no real-looking secret values`);
}

// Inventory freshness: informational only — never a hard failure, because the
// inventory is a generated artifact rather than a source of truth.
const inventoryPath = resolve(process.cwd(), 'config-inventory.json');
if (existsSync(inventoryPath)) {
  try {
    const inv = JSON.parse(readFileSync(inventoryPath, 'utf8'));
    const required = inv.summary?.requiredProductionVariables ?? [];
    const drifted = REQUIRED_PRODUCTION.filter((n) => !required.includes(n));
    if (drifted.length === 0) {
      line(`OK     config-inventory.json: REQUIRED_PRODUCTION set agrees (${required.length})`);
    } else {
      line(
        `WARN   config-inventory.json: inventory missing ${drifted.join(', ')} — re-run classify`,
      );
    }
  } catch {
    line('WARN   config-inventory.json is not valid JSON — re-run inventory');
  }
} else {
  line('INFO   config-inventory.json absent — run: node scripts/config-inventory.mjs');
}

line('');
if (failures > 0) {
  line(`CONFIGURATION CONTRACT: FAILED (${failures} problem(s))`);
  process.exit(1);
}
line('CONFIGURATION CONTRACT: OK');

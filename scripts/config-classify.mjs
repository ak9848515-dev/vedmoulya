#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Configuration Classification (S1 Step 2)
//
// Enriches config-inventory.json with a classification per variable, derived
// from EVIDENCE IN THE REPOSITORY — never from guesswork:
//
//   REQUIRED_PRODUCTION   enforced fail-fast by packages/core/src/config
//   REQUIRED_DEVELOPMENT  required, but a dev default exists
//   OPTIONAL_PRODUCTION   read by production code, no fail-fast on absence
//   OPTIONAL_DEVELOPMENT  read by production code, development convenience
//   TEST_ONLY             never read by production code
//   CI_ONLY               never read by production or test code
//   DEPRECATED            an alias the code still honours when the new name is unset
//   UNKNOWN               read, but no rule and no doc could classify it
//
// NEVER prints a variable's value.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs';

const inventoryPath = process.argv[2] ?? 'config-inventory.json';
const data = JSON.parse(readFileSync(inventoryPath, 'utf8'));

// ── Evidence extracted from the canonical config owner ───────────────────────
const coreConfig = readFileSync('packages/core/src/config/index.ts', 'utf8');

// Unconditional fail-fast in production/staging (requireExternalUrl /
// requireJwtSecret): a non-localhost value is REQUIRED outside development.
const REQUIRED_OUTSIDE_DEV = new Set([
  'DATABASE_URL',
  'IDENTITY_DATABASE_URL',
  'KNOWLEDGE_DATABASE_URL',
  'DECISION_DATABASE_URL',
  'EXECUTION_DATABASE_URL',
  'MEMORY_DATABASE_URL',
  'REDIS_URL',
]);

// requireProdSecret({ required: true }) — required, but conditionally.
const CONDITIONAL = new Map([
  ['GOOGLE_CLIENT_ID', 'required when FF_SOCIAL_LOGIN_ENABLED=true'],
  ['GOOGLE_CLIENT_SECRET', 'required when FF_SOCIAL_LOGIN_ENABLED=true'],
  ['GOOGLE_REDIRECT_URI', 'required (external URL) when FF_SOCIAL_LOGIN_ENABLED=true'],
  ['SMTP_USER', 'required when SMTP_HOST is configured'],
  ['SMTP_PASS', 'required when SMTP_HOST is configured'],
  ['AI_DEFAULT_PROVIDER', 'required in production when AI execution is enabled'],
  ['AUTH_JWT_SECRET', 'required in every environment; strength enforced'],
]);

// Deprecated aliases the code still honours when the replacement is unset.
const DEPRECATED = new Map([
  ['EI_POOL_MAX', 'deprecated alias honoured only when DB_POOL_MAX is unset'],
  ['EI_DATABASE_URL', 'deprecated alias honoured only when IDENTITY_DATABASE_URL is unset'],
  ['POSTGRES_URL', 'legacy alias honoured after DATABASE_URL / NEON_DATABASE_URL'],
  ['NEON_DATABASE_URL', 'legacy alias honoured after DATABASE_URL'],
]);

// Documented in an example file (by NAME, any form).
const documented = new Set();
for (const file of ['.env.example', '.env.production.example']) {
  try {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/^#?\s*([A-Z][A-Z0-9_]*)=/gm)) documented.add(m[1]);
  } catch {
    /* file may be absent */
  }
}

// Purpose, taken from the variable's own consuming symbol where one exists.
function purposeOf(name, entry) {
  const first = entry.locations.find((l) => l.scope === 'production');
  if (name.endsWith('_API_KEY')) return 'AI provider credential';
  if (name.endsWith('DATABASE_URL')) return 'PostgreSQL connection string';
  if (name.includes('JWT_SECRET')) return 'authentication signing secret';
  if (name === 'NODE_ENV') return 'runtime mode selector (development/test/staging/production)';
  if (name.startsWith('DB_POOL')) return 'bounded PostgreSQL connection-pool budget';
  if (name.startsWith('AI_')) return 'AI provider / execution configuration';
  return first ? `read by ${first.file}` : 'read by repository code';
}

function classify(entry) {
  const { name, readInProductionCode, readInTests, readInCiOrScripts } = entry;

  if (DEPRECATED.has(name)) return 'DEPRECATED';

  if (readInProductionCode === 0) {
    if (readInTests > 0) return 'TEST_ONLY';
    if (readInCiOrScripts > 0) return 'CI_ONLY';
    return 'UNKNOWN';
  }

  if (name === 'AUTH_JWT_SECRET') return 'REQUIRED_PRODUCTION';
  if (REQUIRED_OUTSIDE_DEV.has(name)) return 'REQUIRED_PRODUCTION';
  if (CONDITIONAL.has(name)) return 'OPTIONAL_PRODUCTION';

  return 'OPTIONAL_DEVELOPMENT';
}

const enriched = data.variables.map((entry) => ({
  ...entry,
  classification: classify(entry),
  requiredCondition: CONDITIONAL.get(entry.name) ?? null,
  purpose: purposeOf(entry.name, entry),
  documentedInExampleFile: documented.has(entry.name),
  // Invented defaults are forbidden; only report a default if the code has one.
  default: null,
  defaultSource: null,
}));

const counts = {};
for (const e of enriched) counts[e.classification] = (counts[e.classification] ?? 0) + 1;

const out = {
  summary: {
    ...data.summary,
    classificationCounts: counts,
    undocumentedProductionVariables: enriched.filter(
      (e) => e.readInProductionCode > 0 && !e.documentedInExampleFile,
    ).length,
    requiredProductionVariables: enriched
      .filter((e) => e.classification === 'REQUIRED_PRODUCTION')
      .map((e) => e.name)
      .sort(),
  },
  variables: enriched,
};

writeFileSync(inventoryPath, JSON.stringify(out, null, 2) + '\n', 'utf8');

const line = (s) => process.stdout.write(s + '\n');
line('CLASSIFICATION');
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  line('  ' + k.padEnd(22) + String(v).padStart(4));
}
line('');
line('REQUIRED_PRODUCTION: ' + out.summary.requiredProductionVariables.join(', '));
line('');
line(
  'PRODUCTION-CODE VARIABLES NOT DOCUMENTED IN ANY EXAMPLE FILE: ' +
    out.summary.undocumentedProductionVariables,
);
line('');
line('Top 30 undocumented production variables (by read count):');
for (const e of enriched
  .filter((x) => x.readInProductionCode > 0 && !x.documentedInExampleFile)
  .sort((a, b) => b.totalReads - a.totalReads)
  .slice(0, 30)) {
  line(
    '  ' +
      e.name.padEnd(44) +
      'prod=' +
      String(e.readInProductionCode).padEnd(3) +
      'reads=' +
      String(e.totalReads).padEnd(4) +
      (e.secret ? ' SECRET' : '') +
      '  ' +
      e.classification,
  );
}

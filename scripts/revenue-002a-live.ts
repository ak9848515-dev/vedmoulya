#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// REVENUE-002A — PRIVATE PRACTICE RUNNER (Sunrise Traders / Monthly Sales Analysis)
//
// A PRIVATE, LOCAL rehearsal of one real client-shaped job driven through the
// EXISTING Mission architecture. Nothing is invented: no new engine, no new
// loop, no new provider, no new verification system. The one authorized
// production change is the REVENUE-002A capability that lets a governed tool
// step consume a prior step's output ({outputOf:step-N}) plus a bounded
// read→aggregate→author→write plan template — see the template
// `packages/mission-runtime/src/adapters/DataReportTemplate.ts`.
//
//   CLIENT      : Sunrise Traders
//   TASK        : Monthly Sales Analysis
//   PROVIDER    : REAL local Ollama only (qwen2.5-coder:7b-instruct)
//   WORKSPACE   : _rev002a-live/  (disposable, isolated)
//   INPUT       : _rev002a-live/input/sales.csv          (40 deterministic rows)
//   ARTIFACT    : _rev002a-live/output/sunrise-traders-sales-report.md
//
// Pipeline (existing production composition; the Mission's own plan is the
// deterministic read→aggregate→author→write template):
//   1. Write the DETERMINISTIC practice dataset to the isolated workspace.
//   2. Independently analyse that CSV LOCALLY (no AI) and assert it matches the
//      pinned, published expectations for this dataset.
//   3. Create its OWN Mission through `ApiApplicationService`:
//        app.mission.createMission(...) → startAutonomousLoop(...) → poll getStatus(...)
//      (NOT the REVENUE-001 acceptance harness, and not its objective.)
//   4. Gate on Mission truth only: COMPLETED + a VERIFIED objective + artifact on disk.
//   5. Independently verify the produced Markdown against the locally computed
//      figures — deterministic string checks, never a model judging a model.
//   6. Read the durable AI usage ledger for THIS mission: provider/model/local/
//      status/tokens — cloud tokens and mock executions must be exactly zero.
//   7. Only then prepare a DRAFT delivery through the EXISTING
//      MissionClientOpsHandoffService + InMemoryClientOpsRepository
//      (pendingApproval=true). No submission, no client contact, no payment.
//
// Hermetic by construction: this runner strips remote-provider credentials, the
// hosted database URLs, OTLP export and the mock switch from its own process
// environment, so the run touches nothing but the local model and local disk.
// It never prints a secret, and it never mutates repository state.
//
// Usage (repo root):
//   npx tsx scripts/revenue-002a-live.ts
//
// PRODUCTION FILES CHANGED FOR REVENUE-002A (minimal, authorized):
//   packages/mission-runtime/src/adapters/DataReportTemplate.ts   (new template)
//   packages/mission-runtime/src/adapters/DataAggregateTool.ts     (new governed tool)
//   packages/mission-runtime/src/adapters/GovernedToolRegistry.ts  (register the tool)
//   packages/mission-runtime/src/composition/MissionRuntime.ts     (register the template)
//   packages/mission-runtime/src/index.ts                          (exports)
//   packages/agent-execution/src/...                               ({outputOf} in tool/verification args)
//   services/orchestrator/src/index.ts                             (optional AI_OLLAMA_TIMEOUT_MS)
//   services/api/src/services/MissionService.ts                    (grant the read-only aggregate tool)
// THIS RUNNER FILE itself is test/rehearsal tooling.
// ─────────────────────────────────────────────────────────────────────────────

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

// Type-only import: erased at runtime, so it cannot force application modules
// (and therefore environment-driven configuration) to load before hardening.
import type { ApiApplicationService } from '../services/api/src/services/ApiApplicationService.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE PRACTICE DATASET (deterministic, 40 records, 6 months)
//
// A fixed ledger is used instead of a generator so the job is reproducible
// byte-for-byte. Its aggregates are PINNED below and asserted before the
// Mission runs, so a corrupted or edited dataset fails loudly instead of
// silently changing what "verified" means.
// ─────────────────────────────────────────────────────────────────────────────

const DATASET_CSV = `date,product,region,quantity,unit_price,sales_amount
2025-08-01,Standing Desk Frame,Central,1,428,428
2025-08-07,Standing Desk Frame,Central,1,427,427
2025-08-08,Ergonomic Office Chair,Central,3,214,642
2025-08-08,Monitor Privacy Filter,South,3,23,69
2025-08-12,Standing Desk Frame,Central,1,425,425
2025-08-24,Monitor Privacy Filter,West,4,29,116
2025-08-28,Monitor Privacy Filter,South,2,24,48
2025-09-12,Ergonomic Office Chair,East,5,252,1260
2025-09-23,Ergonomic Office Chair,East,7,182,1274
2025-10-03,Monitor Arm Pivot,East,12,85,1020
2025-10-04,Cable Management Kit,Central,7,25,175
2025-10-04,Executive Desk Organizer,South,1,55,55
2025-10-07,Cable Management Kit,West,14,23,322
2025-10-08,Ergonomic Mouse Pad,North,6,39,234
2025-10-11,Cable Management Kit,South,5,23,115
2025-10-15,Executive Desk Organizer,South,2,36,72
2025-10-16,Ergonomic Mouse Pad,Central,3,30,90
2025-10-20,Cable Management Kit,South,4,27,108
2025-10-21,LED Desk Lamp,East,3,49,147
2025-11-05,Ergonomic Office Chair,South,9,204,1836
2025-11-05,Monitor Privacy Filter,Central,2,37,74
2025-11-08,Ergonomic Office Chair,South,7,260,1820
2025-11-11,Ergonomic Office Chair,South,8,232,1856
2025-11-17,Ergonomic Mouse Pad,North,3,34,102
2025-11-18,Monitor Privacy Filter,North,3,23,69
2025-11-23,Monitor Privacy Filter,North,2,31,62
2025-11-25,Ergonomic Mouse Pad,East,6,39,234
2025-12-06,Standing Desk Frame,North,1,403,403
2025-12-15,Executive Desk Organizer,East,13,45,585
2025-12-18,Monitor Arm Pivot,East,1,70,70
2025-12-20,Executive Desk Organizer,West,8,51,408
2025-12-21,Standing Desk Frame,North,1,480,480
2025-12-22,Monitor Arm Pivot,East,3,73,219
2025-12-23,Standing Desk Frame,North,2,387,774
2026-01-02,Standing Desk Frame,South,1,383,383
2026-01-08,Monitor Privacy Filter,Central,1,31,31
2026-01-09,LED Desk Lamp,South,8,53,424
2026-01-13,LED Desk Lamp,South,7,62,434
2026-01-20,LED Desk Lamp,South,8,52,416
2026-01-20,Monitor Privacy Filter,West,4,37,148
`;

/** The published figures this dataset MUST reproduce (the acceptance numbers). */
const EXPECTED = {
  recordCount: 40,
  totalSales: 17_855,
  months: [
    { month: '2025-08', total: 2_155 },
    { month: '2025-09', total: 2_534 },
    { month: '2025-10', total: 2_338 },
    { month: '2025-11', total: 6_053 },
    { month: '2025-12', total: 2_939 },
    { month: '2026-01', total: 1_836 },
  ],
  regions: [
    { region: 'South', total: 7_636 },
    { region: 'East', total: 4_809 },
    { region: 'Central', total: 2_292 },
    { region: 'North', total: 2_124 },
    { region: 'West', total: 994 },
  ],
  products: [
    { product: 'Ergonomic Office Chair', total: 8_688 },
    { product: 'Standing Desk Frame', total: 3_320 },
    { product: 'LED Desk Lamp', total: 1_421 },
    { product: 'Monitor Arm Pivot', total: 1_309 },
    { product: 'Executive Desk Organizer', total: 1_120 },
    { product: 'Cable Management Kit', total: 720 },
    { product: 'Ergonomic Mouse Pad', total: 660 },
    { product: 'Monitor Privacy Filter', total: 617 },
  ],
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 2. ENVIRONMENT — hermetic, local-model-only
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `.env.local` is parsed directly: the repository has no dotenv dependency for
 * scripts, and the existing process environment always wins.
 */
function loadEnvLocal(): void {
  const file = path.resolve(process.cwd(), '.env.local');
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

/**
 * Make this process hermetic and REAL:
 *   - keep AUTH_JWT_SECRET (the identity stack fail-fasts without it);
 *   - force the mock OFF and pin the local Ollama endpoint + model;
 *   - remove cloud AI credentials so the platform registrar can only route to
 *     the local model (the registrar registers cloud adapters first, so a
 *     configured cloud key would win the candidate list);
 *   - remove hosted database URLs so this rehearsal composes the documented
 *     in-memory dev/test stores instead of writing to a remote database;
 *   - remove OTLP export so nothing is shipped off-box.
 * Configuration only — no architecture, no code path and no service changes.
 */
function hardenForPrivatePractice(): void {
  loadEnvLocal();

  process.env.AI_ENABLE_MOCK = 'false';
  process.env.AI_OLLAMA_BASE_URL =
    process.env.AI_OLLAMA_BASE_URL?.trim() || 'http://127.0.0.1:11434';
  process.env.AI_OLLAMA_MODEL = OLLAMA_MODEL;
  // Local hardware here generates at roughly 2 tokens/second; the frozen
  // adapter default (120s) aborts a real report mid-generation and the run
  // then has no usage and no artifact. Widen ONLY this adapter bound for the
  // rehearsal (an explicit, operator-configured value — no code default change).
  process.env.AI_OLLAMA_TIMEOUT_MS = process.env.AI_OLLAMA_TIMEOUT_MS?.trim() || '300000';

  for (const key of [
    'AI_OPENAI_API_KEY',
    'AI_ANTHROPIC_API_KEY',
    'AI_GOOGLE_API_KEY',
    'AI_DEEPSEEK_API_KEY',
    'AI_OPENROUTER_API_KEY',
    'OPENAI_API_KEY',
    'AI_DEFAULT_PROVIDER',
    'DATABASE_URL',
    'DATABASE_URL_UNPOOLED',
    'POSTGRES_URL',
    'NEON_DATABASE_URL',
    'IDENTITY_DATABASE_URL',
    'EXECUTION_DATABASE_URL',
    'DECISION_DATABASE_URL',
    'KNOWLEDGE_DATABASE_URL',
    'MEMORY_DATABASE_URL',
    'OTEL_EXPORTER_OTLP_ENDPOINT',
  ]) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- live-harness env isolation: external/cloud endpoints must be absent for this LOCAL-provider proof.
    delete process.env[key];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. WORKSPACE
// ─────────────────────────────────────────────────────────────────────────────

const REPO_ROOT = process.cwd();
const WORKSPACE = path.resolve(REPO_ROOT, '_rev002a-live');
const INPUT_DIR = path.join(WORKSPACE, 'input');
const OUTPUT_DIR = path.join(WORKSPACE, 'output');
const INPUT_PATH = path.join(INPUT_DIR, 'sales.csv');
const REPORT_PATH = path.join(OUTPUT_DIR, 'sunrise-traders-sales-report.md');

const OWNER = 'revenue-002a-owner';
const CLIENT_NAME = 'Sunrise Traders';
const OLLAMA_MODEL = 'qwen2.5-coder:7b-instruct';
const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 30 * 60 * 1000;

function prepareWorkspace(): void {
  rmSync(WORKSPACE, { recursive: true, force: true });
  mkdirSync(INPUT_DIR, { recursive: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. INDEPENDENT LOCAL ANALYSIS (no AI anywhere in this section)
// ─────────────────────────────────────────────────────────────────────────────

interface SalesRecord {
  date: string;
  product: string;
  region: string;
  quantity: number;
  unit_price: number;
  sales_amount: number;
}

function parseSalesCsv(raw: string): SalesRecord[] {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const records: SalesRecord[] = [];
  for (const line of lines.slice(1)) {
    const parts = line.split(',');
    const [date, product, region, quantityRaw, unitPriceRaw, salesAmountRaw] = parts;
    if (
      date === undefined ||
      product === undefined ||
      region === undefined ||
      quantityRaw === undefined ||
      unitPriceRaw === undefined ||
      salesAmountRaw === undefined
    ) {
      continue;
    }
    const quantity = Number.parseInt(quantityRaw, 10);
    const unitPrice = Number.parseInt(unitPriceRaw, 10);
    const salesAmount = Number.parseInt(salesAmountRaw, 10);
    if (
      !Number.isFinite(quantity) ||
      !Number.isFinite(unitPrice) ||
      !Number.isFinite(salesAmount)
    ) {
      continue;
    }
    records.push({
      date: date.trim(),
      product: product.trim(),
      region: region.trim(),
      quantity,
      unit_price: unitPrice,
      sales_amount: salesAmount,
    });
  }
  return records;
}

interface Ranking {
  key: string;
  total: number;
  quantity: number;
}

interface Analysis {
  recordCount: number;
  totalSales: number;
  byProduct: Ranking[];
  byRegion: Ranking[];
  byMonth: Ranking[];
  integrityViolations: string[];
}

function analyzeSales(records: SalesRecord[]): Analysis {
  const group = (keyOf: (r: SalesRecord) => string): Ranking[] => {
    const map = new Map<string, { total: number; quantity: number }>();
    for (const r of records) {
      const key = keyOf(r);
      const entry = map.get(key) ?? { total: 0, quantity: 0 };
      entry.total += r.sales_amount;
      entry.quantity += r.quantity;
      map.set(key, entry);
    }
    return [...map.entries()]
      .map(([key, value]) => ({ key, total: value.total, quantity: value.quantity }))
      .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
  };

  return {
    recordCount: records.length,
    totalSales: records.reduce((sum, r) => sum + r.sales_amount, 0),
    byProduct: group((r) => r.product),
    byRegion: group((r) => r.region),
    byMonth: group((r) => r.date.slice(0, 7)).sort((a, b) => a.key.localeCompare(b.key)),
    integrityViolations: records
      .filter((r) => r.sales_amount !== r.quantity * r.unit_price)
      .map((r) => `${r.date} ${r.product} ${r.region}`),
  };
}

function money(value: number): string {
  return `$${value.toLocaleString('en-US')}`;
}

/** True when the report contains this exact figure, formatted either way. */
function containsFigure(text: string, value: number): boolean {
  const variants = [String(value), value.toLocaleString('en-US')];
  return variants.some((v) => text.includes(v));
}

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const;

function monthNames(month: string): string[] {
  const index = Number.parseInt(month.slice(5, 7), 10) - 1;
  const name = MONTH_NAMES[index] ?? '';
  return [month, name, name.slice(0, 3)];
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. INDEPENDENT REPORT VERIFICATION (deterministic, no model, no Mission trust)
// ─────────────────────────────────────────────────────────────────────────────

interface Check {
  label: string;
  ok: boolean;
  detail: string;
  /** Soft checks are reported but never fail the run (formatting heuristics). */
  soft?: boolean;
}

interface Verification {
  ok: boolean;
  errors: string[];
  checks: Check[];
}

function verifyReport(report: string, analysis: Analysis): Verification {
  const checks: Check[] = [];
  const errors: string[] = [];
  const lower = report.toLowerCase().replace(/\s+/g, ' ');
  const flat = lower.replace(/-/g, ' ');

  const required = (label: string, ok: boolean, detail: string): void => {
    checks.push({ label, ok, detail });
    if (!ok) errors.push(`${label} (${detail})`);
  };
  const soft = (label: string, ok: boolean, detail: string): void => {
    checks.push({ label, ok, detail, soft: true });
  };

  required('report non-empty', report.trim().length > 0, `${report.length} characters`);
  required('client named in report', flat.includes(CLIENT_NAME.toLowerCase()), CLIENT_NAME);

  const sections: Array<[string, string[]]> = [
    ['Executive Summary section', ['executive summary']],
    ['Total Sales section', ['total sales']],
    [
      'Top-Performing Products section',
      ['top performing products', 'top products', 'top-performing products'],
    ],
    [
      'Top-Performing Regions section',
      ['top performing regions', 'top regions', 'top-performing regions'],
    ],
    ['Monthly Sales Trend section', ['monthly sales trend', 'monthly trend', 'sales trend']],
    ['Recommendations section', ['recommendation']],
  ];
  for (const [label, needles] of sections) {
    required(
      label,
      needles.some((n) => flat.includes(n)),
      needles[0] ?? '(section)',
    );
  }

  // Grand total — computed locally from the CSV, not read from the Mission.
  required(
    'total sales figure present',
    containsFigure(report, analysis.totalSales),
    money(analysis.totalSales),
  );

  // Top products: the three the client cares about, name AND figure.
  for (const product of analysis.byProduct.slice(0, 3)) {
    required(`top product ranked: ${product.key}`, report.includes(product.key), product.key);
    required(
      `top product total: ${product.key}`,
      containsFigure(report, product.total),
      money(product.total),
    );
  }

  // Every region the client sells in, with its independently computed total.
  for (const region of analysis.byRegion) {
    required(`region present: ${region.key}`, report.includes(region.key), money(region.total));
    required(
      `region total: ${region.key}`,
      containsFigure(report, region.total),
      money(region.total),
    );
  }

  // Every month, named either as ISO (2025-08) or in words (August 2025).
  for (const month of analysis.byMonth) {
    const names = monthNames(month.key);
    required(
      `month present: ${month.key}`,
      names.some((n) => lower.includes(n)),
      `${month.key} / ${names[1]}`,
    );
    required(`month total: ${month.key}`, containsFigure(report, month.total), money(month.total));
  }

  // Three actionable recommendations, as list items in the recommendations part.
  const recIndex = lower.lastIndexOf('recommendation');
  const recTail = recIndex >= 0 ? report.slice(recIndex) : '';
  const recItems = recTail
    .split(/\r?\n/)
    .filter((line) => /^\s*(\d+[.)]|[-*+])\s+\S/.test(line)).length;
  required(
    'three actionable recommendations',
    recItems >= 3,
    `${recItems} list item(s) after the recommendations heading`,
  );

  // Ranking order (formatting heuristic — reported, never gating).
  const positions = analysis.byProduct.slice(0, 3).map((p) => report.indexOf(p.key));
  const [first, second, third] = positions;
  soft(
    'top products appear in descending order',
    first !== undefined &&
      second !== undefined &&
      third !== undefined &&
      first >= 0 &&
      second >= 0 &&
      third >= 0 &&
      first < second &&
      second < third,
    positions.join(' < '),
  );

  // The report must not merely echo the input file.
  soft(
    'report is not a copy of the CSV header',
    !report.trim().startsWith('date,product,region,quantity,unit_price,sales_amount'),
    'markdown deliverable',
  );

  return { ok: errors.length === 0, errors, checks };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. DIAGNOSTICS + EVIDENCE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function failureDiagnosis(input: {
  boundary: string;
  missionId: string;
  objectiveId: string;
  provider: string;
  model: string;
  workspace: string;
  expectedArtifact: string;
  actualArtifact: string;
  reason: string;
}): void {
  console.log('');
  console.log('=== FAILURE DIAGNOSIS ===');
  console.log(`failure boundary  : ${input.boundary}`);
  console.log(`mission ID        : ${input.missionId || '(none)'}`);
  console.log(`objective ID      : ${input.objectiveId || '(none)'}`);
  console.log(`provider          : ${input.provider || '(none)'}`);
  console.log(`model             : ${input.model || '(none)'}`);
  console.log(`workspace         : ${input.workspace}`);
  console.log(`expected artifact : ${input.expectedArtifact}`);
  console.log(`actual artifact   : ${input.actualArtifact}`);
  console.log(`failure reason    : ${input.reason}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. SELF-TEST OF THE ACCEPTANCE LOGIC (REVENUE_002A_SELFTEST=1)
//
// The independent verification above is the authority for this practice job, so
// it must be provably able to PASS a conforming report and FAIL a wrong or
// hollow one. This mode exercises it against three in-memory fixtures and never
// creates a Mission, never calls a provider and never writes a file.
// ─────────────────────────────────────────────────────────────────────────────

/** A report that conforms to the objective, built from the LOCAL analysis. */
function sampleConformingReport(analysis: Analysis): string {
  const lines: string[] = [
    `# ${CLIENT_NAME} - Monthly Sales Analysis`,
    '',
    '## Executive Summary',
    `Total sales for ${CLIENT_NAME} across ${analysis.recordCount} sales records were ` +
      `${money(analysis.totalSales)}.`,
    '',
    '## Total Sales',
    `Total sales: ${money(analysis.totalSales)} over ${analysis.recordCount} records.`,
    '',
    '## Top-Performing Products',
  ];
  for (const product of analysis.byProduct) {
    lines.push(`- ${product.key}: ${money(product.total)} (${product.quantity} units)`);
  }
  lines.push('', '## Top-Performing Regions');
  for (const region of analysis.byRegion) {
    lines.push(`- ${region.key}: ${money(region.total)}`);
  }
  lines.push('', '## Monthly Sales Trend');
  for (const month of analysis.byMonth) {
    lines.push(`- ${month.key}: ${money(month.total)}`);
  }
  lines.push('', '## Recommendations');
  const top = analysis.byProduct[0];
  const region = analysis.byRegion[0];
  const month = [...analysis.byMonth].sort((a, b) => b.total - a.total)[0];
  lines.push(
    `1. Protect the ${top?.key ?? 'top'} line: it contributes ${money(top?.total ?? 0)}.`,
    `2. Invest in ${region?.key ?? 'the leading'} region, worth ${money(region?.total ?? 0)}.`,
    `3. Plan inventory for ${month?.key ?? 'the peak month'} (${money(month?.total ?? 0)}).`,
  );
  return lines.join('\n') + '\n';
}

function selfTest(): number {
  const analysis = analyzeSales(parseSalesCsv(DATASET_CSV));
  const conforming = sampleConformingReport(analysis);
  const conformingResult = verifyReport(conforming, analysis);

  // EVERY occurrence must change: a tamper that leaves the correct figure
  // somewhere else in the document is not a tamper of the stated total.
  const wrongTotal = conforming.replaceAll(
    money(analysis.totalSales),
    money(analysis.totalSales + 1),
  );
  const wrongTotalResult = verifyReport(wrongTotal, analysis);

  const hollow =
    'these sections: # Sunrise Traders - Monthly Sales Analysis ## Executive Summary ' +
    '## Total Sales ## Top-Performing Products ## Top-Performing Regions ' +
    '## Monthly Sales Trend ## Recommendations Every sect';
  const hollowResult = verifyReport(hollow, analysis);

  console.log('REVENUE-002A — ACCEPTANCE SELF-TEST (no mission, no provider, no file)');
  console.log('');
  console.log(
    `conforming report           : ${conformingResult.ok ? 'PASS' : 'FAIL'} (expected PASS)`,
  );
  console.log(
    `tampered total              : ${wrongTotalResult.ok ? 'PASS' : 'FAIL'} (expected FAIL)`,
  );
  console.log(`hollow heading stub         : ${hollowResult.ok ? 'PASS' : 'FAIL'} (expected FAIL)`);
  console.log('');
  console.log('checks on the conforming report:');
  for (const check of conformingResult.checks) {
    console.log(`  [${check.ok ? 'OK' : 'FAIL'}] ${check.label}: ${check.detail}`);
  }
  if (wrongTotalResult.errors.length > 0) {
    console.log('');
    console.log('tampered report first error : ' + wrongTotalResult.errors[0]);
  }
  if (hollowResult.errors.length > 0) {
    console.log('hollow report error count   : ' + String(hollowResult.errors.length));
  }
  const ok = conformingResult.ok && !wrongTotalResult.ok && !hollowResult.ok;
  console.log('');
  console.log(`ACCEPTANCE LOGIC SELF-TEST: ${ok ? 'PASS' : 'FAIL'}`);
  return ok ? 0 : 1;
}

interface UsageSummary {
  events: number;
  providers: string[];
  models: string[];
  local: boolean;
  statuses: string[];
  totalTokens: number;
  cloudTokens: number;
  mockExecutions: number;
  ok: boolean;
  problems: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. RUNNER
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  if (process.env['REVENUE_002A_SELFTEST'] === '1') return selfTest();
  hardenForPrivatePractice();

  console.log('REVENUE-002A — PRIVATE PRACTICE RUNNER');
  console.log(`client            : ${CLIENT_NAME}`);
  console.log('task              : Monthly Sales Analysis');
  console.log('provider          : REAL local Ollama only (mock disabled, no cloud keys)');
  console.log(`model             : ${OLLAMA_MODEL}`);
  console.log(`workspace         : ${WORKSPACE}`);
  console.log(`mission store     : in-memory (private rehearsal; no remote database written)`);

  // ── 0. Local model must really be available before anything is claimed. ────
  const ollamaUrl = process.env.AI_OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
  let installedModels: string[] = [];
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(8_000) });
    const body = (await response.json()) as { models?: Array<{ name: string }> };
    installedModels = (body.models ?? []).map((m) => m.name);
  } catch (error) {
    console.log('');
    console.log('REFUSING TO RUN: the local model endpoint is not reachable.');
    console.log(`endpoint          : ${ollamaUrl}`);
    console.log(`reason            : ${error instanceof Error ? error.message : String(error)}`);
    console.log('A rehearsal on an unreachable model would not be a real run.');
    return 2;
  }
  if (!installedModels.includes(OLLAMA_MODEL)) {
    console.log('');
    console.log('REFUSING TO RUN: the required local model is not installed.');
    console.log(`required          : ${OLLAMA_MODEL}`);
    console.log(`installed         : ${installedModels.join(', ') || '(none)'}`);
    return 2;
  }
  console.log(`ollama            : reachable at ${ollamaUrl} (${installedModels.length} model(s))`);

  // ── 1. Dataset into the isolated workspace. ────────────────────────────────
  prepareWorkspace();
  writeFileSync(INPUT_PATH, DATASET_CSV, 'utf8');

  const records = parseSalesCsv(readFileSync(INPUT_PATH, 'utf8'));
  const analysis = analyzeSales(records);

  // ── 2. Dataset conformance against the published expectations. ─────────────
  console.log('');
  console.log('=== DATASET CONFORMANCE (computed locally, no AI) ===');
  const conformance: string[] = [];
  if (analysis.recordCount !== EXPECTED.recordCount) {
    conformance.push(`record count ${analysis.recordCount} != ${EXPECTED.recordCount}`);
  }
  if (analysis.totalSales !== EXPECTED.totalSales) {
    conformance.push(`total ${analysis.totalSales} != ${EXPECTED.totalSales}`);
  }
  for (const expected of EXPECTED.months) {
    const actual = analysis.byMonth.find((m) => m.key === expected.month)?.total ?? 0;
    if (actual !== expected.total) conformance.push(`month ${expected.month}: ${actual}`);
  }
  for (const expected of EXPECTED.regions) {
    const actual = analysis.byRegion.find((r) => r.key === expected.region)?.total ?? 0;
    if (actual !== expected.total) conformance.push(`region ${expected.region}: ${actual}`);
  }
  for (const expected of EXPECTED.products) {
    const actual = analysis.byProduct.find((p) => p.key === expected.product)?.total ?? 0;
    if (actual !== expected.total) conformance.push(`product ${expected.product}: ${actual}`);
  }
  for (const violation of analysis.integrityViolations) {
    conformance.push(`sales_amount != quantity * unit_price for ${violation}`);
  }

  console.log(`records           : ${analysis.recordCount}`);
  console.log(`total sales       : ${money(analysis.totalSales)}`);
  console.log('top products      :');
  for (const product of analysis.byProduct.slice(0, 5)) {
    console.log(`  - ${product.key}: ${money(product.total)} (${product.quantity} units)`);
  }
  console.log('regions           :');
  for (const region of analysis.byRegion) {
    console.log(`  - ${region.key}: ${money(region.total)}`);
  }
  console.log('months            :');
  for (const month of analysis.byMonth) {
    console.log(`  - ${month.key}: ${money(month.total)}`);
  }
  console.log(`published values  : ${conformance.length === 0 ? 'MATCH' : 'MISMATCH'}`);
  if (conformance.length > 0) {
    failureDiagnosis({
      boundary: 'dataset conformance',
      missionId: '',
      objectiveId: '',
      provider: 'n/a',
      model: 'n/a',
      workspace: WORKSPACE,
      expectedArtifact: REPORT_PATH,
      actualArtifact: `${INPUT_PATH} (mismatched)`,
      reason: conformance.join(' | '),
    });
    return 1;
  }

  // ── 3. Production composition, with a usage ledger we can read back. ───────
  const { ApiApplicationService: ApiApplicationServiceImpl } =
    await import('../services/api/src/services/ApiApplicationService.js');
  const { InMemoryAiUsageStore } =
    await import('../services/api/src/observability/AiUsageLedger.js');
  const { MissionClientOpsHandoffService } =
    await import('../services/api/src/services/MissionClientOpsHandoff.js');
  const { InMemoryClientOpsRepository } = await import('@vedmoulya/services');

  const usageStore = new InMemoryAiUsageStore();
  process.env.MISSION_WORKSPACE_ROOT = WORKSPACE;
  const app: ApiApplicationService = new ApiApplicationServiceImpl({ aiUsageStore: usageStore });

  // A natural client brief. Deliberately written the way a real client would ask,
  // with the SOURCE and the requested DELIVERABLE both stated but no invented
  // shortcut content: every figure has to come from the data.
  const objective =
    `Analyze the Sunrise Traders monthly sales data in input/sales.csv ` +
    `(${EXPECTED.recordCount} rows; columns date, product, region, quantity, unit_price, ` +
    'sales_amount). The client needs the monthly sales analysis as a Markdown report at ' +
    'output/sunrise-traders-sales-report.md: total sales, the top-performing products and ' +
    'their totals, the top-performing regions and their totals, the monthly sales trend, and ' +
    'three actionable business recommendations grounded in the figures. Every figure must ' +
    'come from input/sales.csv.';

  const mission = await app.mission.createMission(OWNER, {
    title: `${CLIENT_NAME} — Monthly Sales Analysis`,
    objective,
    workspace: WORKSPACE,
    initialObjectives: [objective],
    maxObjectives: 1,
    autonomyLevel: 'CONTROLLED_AUTONOMOUS',
  });

  console.log('');
  console.log('=== MISSION CREATED (own mission, not the REVENUE-001 harness) ===');
  console.log(`mission id        : ${mission.missionId}`);
  console.log(`title             : ${mission.title}`);
  console.log(`state             : ${mission.state}`);
  console.log(`workspace         : ${mission.workspace ?? '(runtime default)'}`);
  console.log(`autonomy          : ${mission.autonomyLevel}`);
  console.log(`objectives        : ${mission.objectives.length}`);

  if (mission.missionId.trim().length === 0) {
    failureDiagnosis({
      boundary: 'mission creation',
      missionId: '',
      objectiveId: '',
      provider: 'n/a',
      model: 'n/a',
      workspace: WORKSPACE,
      expectedArtifact: REPORT_PATH,
      actualArtifact: '(not created)',
      reason: 'createMission returned no missionId',
    });
    return 1;
  }

  // ── 4. Drive the REAL autonomous loop (Ollama + real workspace tools). ─────
  console.log('');
  console.log('=== MISSION STARTED (real autonomous loop) ===');
  await app.mission.startAutonomousLoop(OWNER, mission.missionId);

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let status = await app.mission.getStatus(OWNER, mission.missionId);
  let polls = 0;
  while (!['COMPLETED', 'FAILED', 'CANCELLED'].includes(status.state) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    status = await app.mission.getStatus(OWNER, mission.missionId);
    polls += 1;
    process.stdout.write(
      `\r  poll ${polls} state=${status.state} objectives=${status.budgetUsage.objectivesCompleted}/${status.objectives.length} ` +
        `tools=${status.budgetUsage.toolCallsExecuted} tokens=${status.budgetUsage.tokensConsumed}   `,
    );
  }
  console.log('');

  const objectiveView =
    status.objectives.find((o) => o.state === 'VERIFIED') ?? status.objectives[0];
  const objectiveId = objectiveView?.objectiveId ?? '';
  const provider = status.provider ?? '(none recorded)';
  const model = status.model ?? '(none recorded)';
  const missionWorkspace = status.workspace ?? WORKSPACE;

  console.log('');
  console.log('=== MISSION RUN (backend truth) ===');
  console.log(`final state            : ${status.state}`);
  console.log(`outcome                : ${status.outcome ?? '(none)'}`);
  console.log(`outcome reason         : ${status.outcomeReason ?? '(none)'}`);
  console.log(`provider               : ${provider}`);
  console.log(`model                  : ${model}`);
  console.log(`tool calls             : ${status.budgetUsage.toolCallsExecuted}`);
  console.log(`tokens                 : ${status.budgetUsage.tokensConsumed}`);
  console.log(`cost usd               : ${status.budgetUsage.costUsdConsumed}`);
  console.log(`attempts               : ${status.attempts ?? '(none)'}`);
  console.log(`revisions              : ${status.revisions ?? '(none)'}`);
  console.log(`objectives completed   : ${status.budgetUsage.objectivesCompleted}`);
  console.log(`objectives failed      : ${status.budgetUsage.objectivesFailed}`);
  console.log(`checkpoints            : ${status.checkpoints.length}`);
  for (const checkpoint of status.checkpoints) {
    console.log(`  checkpoint ${checkpoint.checkpointId} state=${checkpoint.state}`);
    for (const item of checkpoint.completedWork.slice(0, 8)) {
      console.log(`    completed: ${item.slice(0, 200)}`);
    }
    for (const item of checkpoint.failures.slice(0, 8)) {
      console.log(`    failure  : ${item.slice(0, 200)}`);
    }
  }

  if (!objectiveView) {
    failureDiagnosis({
      boundary: 'mission objective',
      missionId: mission.missionId,
      objectiveId,
      provider,
      model,
      workspace: missionWorkspace,
      expectedArtifact: REPORT_PATH,
      actualArtifact: existsSync(REPORT_PATH) ? REPORT_PATH : '(missing)',
      reason: 'the mission reported no objective',
    });
    return 1;
  }

  console.log('');
  console.log('=== OBJECTIVE STATUS ===');
  console.log(`objective id           : ${objectiveId}`);
  console.log(`objective state        : ${objectiveView.state}`);
  console.log(`objective title        : ${objectiveView.title}`);
  console.log(`verified at            : ${objectiveView.verifiedAt ?? '(never verified)'}`);
  console.log(`verification method    : ${objectiveView.verificationMethod ?? '(none)'}`);
  console.log(`failure reason         : ${objectiveView.failureReason ?? '(none)'}`);
  console.log(`evidence               : ${objectiveView.evidence.length} item(s)`);
  for (const item of objectiveView.evidence.slice(-5)) {
    console.log(`  - ${item.slice(0, 200)}`);
  }

  console.log('');
  console.log('=== LIFECYCLE EVENTS ===');
  for (const event of status.activity.slice(-25)) {
    console.log(`  ${event.kind.padEnd(22)} ${event.at}  ${event.message}`);
  }

  // The AI usage ledger is evidence in its own right: it is reported ALWAYS,
  // including on the failure paths below, so a run can never look like it did
  // real work (or no work) without the ledger saying so.
  const usage = await summarizeUsage(usageStore, mission.missionId);
  console.log('');
  console.log('=== AI USAGE LEDGER (this mission) ===');
  console.log(`events                 : ${usage.events}`);
  console.log(`provider(s)            : ${usage.providers.join(', ') || '(none)'}`);
  console.log(`model(s)               : ${usage.models.join(', ') || '(none)'}`);
  console.log(`local inference        : ${usage.local}`);
  console.log(`status(es)             : ${usage.statuses.join(', ') || '(none)'}`);
  console.log(`total tokens           : ${usage.totalTokens}`);
  console.log(`cloud tokens           : ${usage.cloudTokens}`);
  console.log(`mock executions        : ${usage.mockExecutions}`);
  console.log(`usage verdict          : ${usage.ok ? 'REAL LOCAL OLLAMA USAGE' : 'NOT PROVEN'}`);
  for (const problem of usage.problems) console.log(`  - ${problem}`);

  // ── 5. Mission gate: COMPLETED + VERIFIED objective + artifact on disk. ────
  const artifactExists = existsSync(REPORT_PATH);
  const artifactContent = artifactExists ? readFileSync(REPORT_PATH, 'utf8') : '';
  // VERIFIED is the only state the EXISTING delivery handoff admits, so it is
  // the only state this practice run accepts as proof of verified work.
  const objectiveVerified = objectiveView.state === 'VERIFIED';

  console.log('');
  console.log('=== ARTIFACT (read from disk, not from the model) ===');
  console.log(`path                   : ${REPORT_PATH}`);
  console.log(`exists                 : ${artifactExists}`);
  console.log(`bytes                  : ${Buffer.byteLength(artifactContent, 'utf8')}`);

  if (status.state !== 'COMPLETED' || !objectiveVerified || !artifactExists) {
    failureDiagnosis({
      boundary:
        status.state !== 'COMPLETED'
          ? 'mission completion'
          : !objectiveVerified
            ? 'objective verification'
            : 'artifact creation',
      missionId: mission.missionId,
      objectiveId,
      provider,
      model,
      workspace: missionWorkspace,
      expectedArtifact: REPORT_PATH,
      actualArtifact: artifactExists ? REPORT_PATH : '(missing)',
      reason:
        status.state !== 'COMPLETED'
          ? `mission did not complete: ${status.state} (${status.outcomeReason ?? 'no reason recorded'})`
          : !objectiveVerified
            ? `objective is ${objectiveView.state}: ${objectiveView.failureReason ?? 'no reason recorded'}`
            : 'the report file was not created in the workspace',
    });
    console.log('');
    console.log('workspace files        :');
    for (const file of listWorkspaceFiles(WORKSPACE)) console.log(`  - ${file}`);
    return 1;
  }

  // ── 6. Independent verification of the report. ────────────────────────────
  const verification = verifyReport(artifactContent, analysis);
  console.log('');
  console.log('=== INDEPENDENT VERIFICATION (deterministic, no model) ===');
  for (const check of verification.checks) {
    console.log(
      `  [${check.ok ? 'OK' : check.soft ? 'INFO' : 'FAIL'}] ${check.label}: ${check.detail}`,
    );
  }
  console.log('');
  console.log(`independent verification : ${verification.ok ? 'PASS' : 'FAIL'}`);
  for (const error of verification.errors) console.log(`  - ${error}`);

  if (!verification.ok) {
    failureDiagnosis({
      boundary: 'independent verification',
      missionId: mission.missionId,
      objectiveId,
      provider,
      model,
      workspace: missionWorkspace,
      expectedArtifact: REPORT_PATH,
      actualArtifact: REPORT_PATH,
      reason: `the produced report does not match the independently computed figures: ${verification.errors.join(' | ')}`,
    });
    return 1;
  }

  // ── 7. AI usage gate (the ledger was already printed above). ──────────────
  if (!usage.ok) {
    failureDiagnosis({
      boundary: 'AI usage evidence',
      missionId: mission.missionId,
      objectiveId,
      provider,
      model,
      workspace: missionWorkspace,
      expectedArtifact: REPORT_PATH,
      actualArtifact: REPORT_PATH,
      reason: `usage ledger does not prove real local Ollama execution: ${usage.problems.join(' | ')}`,
    });
    return 1;
  }

  // ── 8. Delivery DRAFT through the existing handoff boundary. ──────────────
  const clientOps = new InMemoryClientOpsRepository();
  const handoff = new MissionClientOpsHandoffService({
    missions: {
      get: async (requestedMissionId: string, userId: string) => {
        const view = await app.mission.getStatus(userId, requestedMissionId);
        return {
          missionId: view.missionId,
          userId: view.userId,
          title: view.title,
          objectives: view.objectives.map((o) => ({
            objectiveId: o.objectiveId,
            state: o.state,
            title: o.title,
            verifiedOutcome:
              o.verifiedAt === undefined
                ? null
                : {
                    outcome: o.title,
                    ...(o.verificationMethod !== undefined ? { method: o.verificationMethod } : {}),
                    evidence: o.evidence,
                    verifiedAt: o.verifiedAt,
                  },
          })),
        };
      },
    },
    clientOps,
  });

  const delivery = await handoff.handoffVerifiedOutcome({
    userId: OWNER,
    missionId: mission.missionId,
    objectiveId,
    clientId: 'client-rev002a-sunrise-traders',
    deliverableName: 'sunrise-traders-sales-report.md',
    deliverableContent: artifactContent,
    deliverableMime: 'text/markdown',
  });

  console.log('');
  console.log('=== DELIVERY DRAFT (prepared, never sent) ===');
  if (!delivery.ok) {
    failureDiagnosis({
      boundary: 'delivery handoff',
      missionId: mission.missionId,
      objectiveId,
      provider,
      model,
      workspace: missionWorkspace,
      expectedArtifact: REPORT_PATH,
      actualArtifact: REPORT_PATH,
      reason: `handoff rejected: ${delivery.reason} — ${delivery.message}`,
    });
    return 1;
  }

  const storedDocuments = await clientOps.listDocuments(OWNER);
  const stored = storedDocuments.find((d) => d.id === delivery.documentId);
  console.log(`draft document id      : ${delivery.documentId}`);
  console.log(`created this run       : ${delivery.created}`);
  console.log(`pending approval       : ${delivery.pendingApproval}`);
  console.log(`memory recorded        : ${String(delivery.memoryRecorded ?? false)}`);
  console.log(`documents for owner    : ${storedDocuments.length}`);
  console.log(`stored draft read back : ${stored !== undefined}`);
  if (stored !== undefined) {
    console.log(`stored name            : ${stored.name}`);
    console.log(`stored kind/mime       : ${stored.kind} / ${stored.mime}`);
    console.log(`stored size            : ${String(stored.size)} bytes`);
    console.log(
      `stored provenance      : ${String(stored.metadata.source)} (mission ${String(stored.metadata.missionId)})`,
    );
    console.log(`stored verification    : ${String(stored.metadata.verificationMethod)}`);
  }
  console.log('external submission performed : NO');
  console.log('client contacted              : NO');
  console.log('payment requested             : NO');

  const draftOk =
    delivery.pendingApproval &&
    stored !== undefined &&
    stored.metadata.source === 'mission-verified-handoff';

  if (!draftOk) {
    failureDiagnosis({
      boundary: 'delivery draft',
      missionId: mission.missionId,
      objectiveId,
      provider,
      model,
      workspace: missionWorkspace,
      expectedArtifact: REPORT_PATH,
      actualArtifact: REPORT_PATH,
      reason: 'the draft deliverable could not be read back from ClientOps',
    });
    return 1;
  }

  // ── 9. Verdict. ───────────────────────────────────────────────────────────
  console.log('');
  console.log('=== FINAL VERDICT ===');
  console.log(`mission id             : ${mission.missionId}`);
  console.log(`objective id           : ${objectiveId}`);
  console.log(`provider               : ${provider}`);
  console.log(`model                  : ${model}`);
  console.log(`tool calls             : ${status.budgetUsage.toolCallsExecuted}`);
  console.log(`tokens                 : ${status.budgetUsage.tokensConsumed}`);
  console.log(
    `artifact               : ${REPORT_PATH} (${Buffer.byteLength(artifactContent, 'utf8')} bytes)`,
  );
  console.log('independent verification: PASS');
  console.log(
    `delivery draft         : ${delivery.documentId} (pendingApproval=true, submitted=false)`,
  );
  console.log('production change      : minimal, authorized (see file header)');
  console.log('PRACTICE JOB PASSED');
  return 0;
}

interface UsageStoreLike {
  list(query: { userId: string; missionId?: string }): Promise<
    Array<{
      provider: string;
      model: string;
      local: boolean;
      status: string;
      totalTokens: number;
      missionId?: string;
      objectiveId?: string;
      source: string;
    }>
  >;
}

async function summarizeUsage(store: UsageStoreLike, missionId: string): Promise<UsageSummary> {
  const query: { userId: string; missionId?: string } = { userId: OWNER, missionId };
  let events = await store.list(query);
  let scope = 'mission-scoped';
  if (events.length === 0) {
    events = await store.list({ userId: OWNER });
    scope = 'owner-scoped';
  }

  const providers = [...new Set(events.map((e) => e.provider))];
  const models = [...new Set(events.map((e) => e.model))];
  const statuses = [...new Set(events.map((e) => e.status))];
  const totalTokens = events.reduce((sum, e) => sum + e.totalTokens, 0);
  const cloudTokens = events.filter((e) => !e.local).reduce((sum, e) => sum + e.totalTokens, 0);
  const mockExecutions = events.filter((e) => e.provider === 'mock').length;
  const problems: string[] = [];

  if (events.length === 0) problems.push(`no usage event is recorded for this ${scope} run`);
  if (events.length > 0 && providers.length > 0 && !providers.every((p) => p === 'ollama')) {
    problems.push(`non-Ollama provider recorded: ${providers.join(', ')}`);
  }
  if (events.length > 0 && !models.some((m) => m.includes('qwen'))) {
    problems.push(`the recorded model is not the pinned local model: ${models.join(', ')}`);
  }
  if (events.length > 0 && !events.every((e) => e.local)) {
    problems.push('a usage event is not marked local');
  }
  if (events.length > 0 && !statuses.includes('success')) {
    problems.push(`no successful execution recorded: ${statuses.join(', ')}`);
  }
  if (totalTokens <= 0) problems.push('no tokens were consumed');
  if (cloudTokens !== 0) problems.push(`cloud tokens recorded: ${cloudTokens}`);
  if (mockExecutions !== 0) problems.push(`mock executions recorded: ${mockExecutions}`);

  if (events.length > 0) {
    console.log('usage evidence (safe identity fields only):');
    for (const event of events.slice(0, 10)) {
      console.log(
        `  ${JSON.stringify({
          provider: event.provider,
          model: event.model,
          local: event.local,
          status: event.status,
          totalTokens: event.totalTokens,
          source: event.source,
          missionId: event.missionId ?? null,
          objectiveId: event.objectiveId ?? null,
        })}`,
      );
    }
    if (events.length > 10) console.log(`  … ${events.length - 10} more event(s)`);
  }

  return {
    events: events.length,
    providers,
    models,
    local: events.length > 0 && events.every((e) => e.local),
    statuses,
    totalTokens,
    cloudTokens,
    mockExecutions,
    ok: problems.length === 0,
    problems,
  };
}

function listWorkspaceFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth > 4) return;
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full, depth + 1);
      else out.push(path.relative(root, full));
    }
  };
  if (existsSync(root)) walk(root, 0);
  return out;
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((error: unknown) => {
    console.error(
      'REVENUE-002A RUNNER ERROR:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  });

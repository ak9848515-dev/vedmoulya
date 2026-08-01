#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Load Test Harness (Node, zero deps)
// PH-002 — Enterprise Operations & Reliability (T5 Load Testing)
//
// Usage:
//   node scripts/load-test.mjs                                      # health defaults
//   node scripts/load-test.mjs --scenario all --token <jwt> --user-id <id>
//   node scripts/load-test.mjs --url http://localhost:3000 --users 50 --duration 20
//
// Scenarios (map to real tRPC procedures on the API gateway):
//   health    — /api/trpc/health.live|ready|check|version        (public)
//   auth      — /api/trpc/identity.getProfile                    (requires --token)
//   dashboard — /api/trpc/dashboard.getDashboard                 (requires --token)
//   search    — /api/trpc/search.global                          (requires --token)
//   lifeos    — /api/trpc/lifeOS.getSnapshot                     (requires --token)
//   ai        — configurable AI endpoint(s) via --ai-path; defaults to lifeOS
//               snapshot as the closest AI-driven path exposed by the gateway
//   all       — every scenario above
//
// IMPORTANT: authenticated procedures enforce an IDOR guard — the input userId
// must match the session user of the token. Pass --user-id matching the token's
// subject, otherwise those requests are rejected (expected 403/401).
//
// NOTE: query inputs are encoded in the tRPC v11 *batched* HTTP GET form
// (?input={"0":{"json":{...}}}). If the deployment runs non-batched tRPC, use
// --paths with the equivalent ?input={"json":{...}} URLs instead.
//
// Reports latency percentiles, throughput (req/s), error rate, and process
// memory/CPU.
// ─────────────────────────────────────────────────────────────────────────────

import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// tRPC v11 HTTP GET input encoding for a single batched query input.
function trpcPath(procedure, input) {
  if (input === undefined) return `/api/trpc/${procedure}`;
  const encoded = encodeURIComponent(JSON.stringify({ 0: { json: input } }));
  return `/api/trpc/${procedure}?input=${encoded}`;
}

function parseArgs(argv) {
  const args = {
    url: 'http://localhost:3000',
    users: 25,
    duration: 10,
    paths: [],
    scenario: 'health',
    token: undefined,
    userId: 'load-test-user',
    aiPath: undefined,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--url':
        args.url = argv[++i] ?? args.url;
        break;
      case '--users':
        args.users = Number(argv[++i] ?? args.users);
        break;
      case '--duration':
        args.duration = Number(argv[++i] ?? args.duration);
        break;
      case '--paths':
        args.paths = (argv[++i] ?? '').split(',').filter(Boolean);
        break;
      case '--scenario':
        args.scenario = argv[++i] ?? args.scenario;
        break;
      case '--token':
        args.token = argv[++i];
        break;
      case '--user-id':
        args.userId = argv[++i] ?? args.userId;
        break;
      case '--ai-path':
        args.aiPath = argv[++i];
        break;
      case '--output':
        args.output = argv[++i];
        break;
      case '--help':
        console.log(
          'Usage: node scripts/load-test.mjs [--url URL] [--users N] [--duration SEC] ' +
            '[--scenario health|auth|dashboard|search|lifeos|ai|all] [--paths a,b] ' +
            '[--token JWT] [--user-id ID] [--ai-path /api/trpc/...] [--output FILE]',
        );
        process.exit(0);
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const baseUrl = args.url.replace(/\/$/, '');

const VALID_SCENARIOS = ['health', 'auth', 'dashboard', 'search', 'lifeos', 'ai', 'all'];

function buildScenarioPaths() {
  if (args.paths.length > 0) return args.paths;
  if (!VALID_SCENARIOS.includes(args.scenario)) {
    console.error(`Unknown scenario "${args.scenario}". Valid: ${VALID_SCENARIOS.join(', ')}`);
    process.exit(1);
  }
  const withUser = (proc) => trpcPath(proc, { userId: args.userId });
  const scenarios = {
    health: [
      '/api/trpc/health.live',
      '/api/trpc/health.ready',
      '/api/trpc/health.check',
      '/api/trpc/health.version',
    ],
    auth: [withUser('identity.getProfile')],
    dashboard: [withUser('dashboard.getDashboard')],
    search: [trpcPath('search.global', { query: 'testing', maxResults: 10 })],
    lifeos: [withUser('lifeOS.getSnapshot')],
    ai: args.aiPath ? [args.aiPath] : [withUser('lifeOS.getSnapshot')],
  };
  // Build `all` after the literal to avoid a TDZ self-reference.
  scenarios.all = [
    ...scenarios.health,
    ...scenarios.auth,
    ...scenarios.dashboard,
    ...scenarios.search,
    ...scenarios.lifeos,
  ];
  return scenarios[args.scenario];
}

const paths = buildScenarioPaths();

// Authenticated scenarios need a session JWT; warn once so results are honest.
if (args.scenario !== 'health' && !args.token) {
  console.warn(
    `NOTE: scenario "${args.scenario}" requires authenticated endpoints. ` +
      'Pass --token <jwt> for valid responses; otherwise errors are expected.',
  );
}

const latencies = [];
let errors = 0;
let requests = 0;

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx] ?? 0;
}

async function hit(path) {
  const start = performance.now();
  try {
    const headers = {};
    if (args.token) headers.authorization = `Bearer ${args.token}`;
    const res = await fetch(`${baseUrl}${path}`, {
      headers,
      signal: AbortSignal.timeout(30_000),
    });
    const elapsed = performance.now() - start;
    latencies.push(elapsed);
    requests++;
    if (!res.ok) errors++;
  } catch {
    const elapsed = performance.now() - start;
    latencies.push(elapsed);
    requests++;
    errors++;
  }
}

async function main() {
  console.log(
    `Load test: ${baseUrl} | users=${args.users} | duration=${args.duration}s | scenario=${args.scenario}`,
  );
  console.log(`Paths (${paths.length}): ${paths.join(', ')}`);
  console.log('Running…');

  const startAll = performance.now();
  let elapsed = 0;
  let tick = 0;
  const memoryStart = process.memoryUsage().rss;
  const cpuStart = process.cpuUsage();

  while (elapsed < args.duration * 1000) {
    const batch = Array.from({ length: args.users }, async () => {
      const path = paths[tick % paths.length] ?? paths[0];
      tick++;
      await hit(path);
    });
    await Promise.all(batch);
    elapsed = performance.now() - startAll;
    // Brief yield to avoid starving the event loop.
    await new Promise((r) => setTimeout(r, 25));
  }

  const durationSec = elapsed / 1000;
  const sorted = [...latencies].sort((a, b) => a - b);
  const cpuDelta = process.cpuUsage(cpuStart);
  const cpuSeconds = (cpuDelta.user + cpuDelta.system) / 1e6;

  const report = {
    timestamp: new Date().toISOString(),
    config: {
      url: baseUrl,
      users: args.users,
      durationSec: args.duration,
      scenario: args.scenario,
      paths,
    },
    totals: {
      requests,
      errors,
      errorRatePct: requests === 0 ? 0 : Math.round((errors / requests) * 1000) / 10,
      throughputReqPerSec: Math.round((requests / durationSec) * 10) / 10,
    },
    latencyMs: {
      min: sorted[0] ?? 0,
      p50: Math.round(percentile(sorted, 0.5) * 10) / 10,
      p95: Math.round(percentile(sorted, 0.95) * 10) / 10,
      p99: Math.round(percentile(sorted, 0.99) * 10) / 10,
      max: sorted[sorted.length - 1] ?? 0,
      avg: Math.round((latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1)) * 10) / 10,
    },
    process: {
      rssDeltaMb: Math.round(((process.memoryUsage().rss - memoryStart) / 1024 / 1024) * 10) / 10,
      cpuSeconds,
    },
  };

  console.log(JSON.stringify(report, null, 2));

  if (args.output) {
    const outputPath = join(__dirname, '..', args.output);
    writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
    console.log(`Report written to ${outputPath}`);
  }
}

main().catch((/** @type {unknown} */ err) => {
  console.error('Load test failed:', err);
  process.exit(1);
});

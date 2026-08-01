// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — k6 Load Test
// PH-002 — Enterprise Operations & Reliability (T5 Load Testing)
//
// Run with:
//   k6 run -e BASE_URL=http://localhost:3000 -e SCENARIO=all \
//     -e TOKEN=<jwt> -e USER_ID=<id> scripts/load/k6-load-test.js
//
// Scenarios: health | auth | dashboard | search | lifeos | ai | all
// Authenticated scenarios require a valid session JWT via TOKEN, and the input
// userId must match the token's subject (the gateway enforces an IDOR guard).
// Query inputs use the tRPC v11 batched HTTP GET encoding; for non-batched
// deployments adjust trpcPath() to ?input={"json":{...}}.
// ─────────────────────────────────────────────────────────────────────────────

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SCENARIO = __ENV.SCENARIO || 'health';
const TOKEN = __ENV.TOKEN || '';
const USER_ID = __ENV.USER_ID || 'load-test-user';

// tRPC v11 HTTP GET input encoding for a single batched query input.
function trpcPath(procedure, input) {
  if (input === undefined) return `/api/trpc/${procedure}`;
  const encoded = encodeURIComponent(JSON.stringify({ 0: { json: input } }));
  return `/api/trpc/${procedure}?input=${encoded}`;
}

const withUser = (procedure) => trpcPath(procedure, { userId: USER_ID });

const SCENARIOS = {
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
  ai: [withUser('lifeOS.getSnapshot')],
  all: null, // built below
};

let paths;
if (SCENARIO === 'all') {
  paths = [
    ...SCENARIOS.health,
    ...SCENARIOS.auth,
    ...SCENARIOS.dashboard,
    ...SCENARIOS.search,
    ...SCENARIOS.lifeos,
  ];
} else if (SCENARIOS[SCENARIO]) {
  paths = SCENARIOS[SCENARIO];
} else {
  throw new Error(`Unknown scenario "${SCENARIO}". Valid: ${Object.keys(SCENARIOS).join(', ')}`);
}

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const path = paths[__ITER % paths.length];
  const params = TOKEN ? { headers: { authorization: `Bearer ${TOKEN}` } } : {};
  const res = http.get(`${BASE_URL}${path}`, params);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(0.2);
}

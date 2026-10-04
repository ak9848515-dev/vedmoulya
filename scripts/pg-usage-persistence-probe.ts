import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

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
loadEnvLocal();

const { databaseManager } = await import('../packages/core/src/database/DatabaseManager.js');
const { PostgresAiUsageStore } =
  await import('../services/api/src/observability/AiUsageLedgerStore.js');
const { AiUsageRecorder } = await import('../services/api/src/observability/AiUsageRecorder.js');

function line(s = ''): void {
  console.log(s);
}

const MISSION_ID = process.env.PROBE_MISSION_ID ?? 'mission_murvpe86_1';
const OBJECTIVE_ID = process.env.PROBE_OBJECTIVE_ID ?? 'obj_murvpe86_2';
const OWNER = 'live-mission-acceptance-owner';
const RUN_TAG = `closure-${Date.now().toString(36)}`;
const EVENT_ID = `closure-probe:${RUN_TAG}:ollama:qwen2.5-coder:7b-instruct`;
const EXECUTION_ID = `closure-exec-${RUN_TAG}`;

function freshStore(): InstanceType<typeof PostgresAiUsageStore> {
  const sql = databaseManager.getPool({ applicationName: 'closure-usage-probe' });
  return new PostgresAiUsageStore(sql as never);
}

const probe = {
  eventId: EVENT_ID,
  userId: OWNER,
  providerFamily: 'ollama',
  provider: 'ollama',
  model: 'qwen2.5-coder:7b-instruct',
  executionId: EXECUTION_ID,
  missionId: MISSION_ID,
  objectiveId: OBJECTIVE_ID,
  source: 'MISSION' as const,
  inputTokens: 95,
  outputTokens: 98,
  totalTokens: 193,
  costUsd: 0,
  costUnknown: false,
  currency: 'USD',
  timestamp: Date.now(),
  status: 'success' as const,
  cached: false,
  retry: false,
  local: true,
};

function safe(e: Record<string, unknown>): string {
  return JSON.stringify({
    eventId: e.eventId,
    source: e.source,
    missionId: e.missionId ?? null,
    objectiveId: e.objectiveId ?? null,
    userId: e.userId,
    provider: e.provider,
    model: e.model,
    local: e.local,
    inputTokens: e.inputTokens,
    outputTokens: e.outputTokens,
    totalTokens: e.totalTokens,
    status: e.status,
  });
}

// Phase 1 — ensureTable via existing path + record via AiUsageRecorder.
const storeA = freshStore();
await storeA.ensureTable();
const recorderA = new AiUsageRecorder(storeA);
const first = await recorderA.record({ ...probe });
line(`phase1-record-first: ${first}`);
const listedA = await storeA.list({ userId: OWNER, executionId: EXECUTION_ID });
line(`phase1-list-count: ${listedA.length}`);
if (listedA[0]) line(`phase1-event: ${safe(listedA[0] as unknown as Record<string, unknown>)}`);

// Phase 2 — RESTART boundary: brand-new store instance, same database.
const storeB = freshStore();
const listedB = await storeB.list({ userId: OWNER, executionId: EXECUTION_ID });
line(`phase2-fresh-list-count: ${listedB.length}`);
if (listedB[0]) line(`phase2-event: ${safe(listedB[0] as unknown as Record<string, unknown>)}`);
const same =
  listedB[0] !== undefined &&
  (listedB[0] as { eventId: string }).eventId === EVENT_ID &&
  (listedB[0] as { missionId?: string }).missionId === MISSION_ID &&
  (listedB[0] as { objectiveId?: string }).objectiveId === OBJECTIVE_ID &&
  (listedB[0] as { totalTokens: number }).totalTokens === 193;
line(`phase2-restart-match: ${same}`);

// Phase 3 — idempotency on the fresh instance.
const recorderB = new AiUsageRecorder(storeB);
const second = await recorderB.record({ ...probe });
const listedC = await storeB.list({ userId: OWNER, executionId: EXECUTION_ID });
line(`phase3-record-duplicate-inserted: ${second}`);
line(`phase3-list-count-after-duplicate: ${listedC.length}`);
line(`phase3-idempotent: ${!second && listedC.length === 1}`);

// Phase 4 — isolation on durable store.
const other = await storeB.list({ userId: 'someone-else' });
line(`phase4-other-owner-count: ${other.length}`);

const pass =
  first && listedA.length === 1 && same && !second && listedC.length === 1 && other.length === 0;
line(pass ? 'PG USAGE PERSISTENCE PROBE: PASS' : 'PG USAGE PERSISTENCE PROBE: FAIL');
process.exit(pass ? 0 : 1);

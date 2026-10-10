#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// REVENUE-001 — one bounded REAL mission on the REAL Ollama provider.
// Wrapper: guarantees an ISOLATED writable workspace + REAL provider env,
// then delegates to the EXISTING live-mission-acceptance harness
// (ApiApplicationService → MissionService → MissionRuntime → OllamaProvider).
// NOTHING new is invented: no engine, no loop, no provider, no architecture.
// Usage (repo root):  npx tsx scripts/revenue-001-live.ts
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

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

// REAL provider only: never the mock.
process.env.AI_ENABLE_MOCK = 'false';
process.env.AI_OLLAMA_BASE_URL = process.env.AI_OLLAMA_BASE_URL?.trim() || 'http://127.0.0.1:11434';
process.env.AI_OLLAMA_MODEL = 'qwen2.5-coder:7b-instruct';
// REVENUE-001 — OLLAMA-ONLY ROUTING. The platform registrar registers cloud
// adapters in a fixed order (google first), so a configured cloud key won the
// routing candidate list and every attempt burned a 60s timeout on a reachable-
// but-unselected Ollama. This run is a LOCAL-provider proof, so cloud families
// are not registered here: configuration only, no code change, no mock.
for (const key of [
  'AI_OPENAI_API_KEY',
  'AI_ANTHROPIC_API_KEY',
  'AI_GOOGLE_API_KEY',
  'AI_DEEPSEEK_API_KEY',
  'AI_OPENROUTER_API_KEY',
  'OPENAI_API_KEY',
]) {
  delete process.env[key];
}

// ISOLATED writable workspace (never the repo root).
const workspace = path.resolve(process.cwd(), '_rev001-live');
rmSync(workspace, { recursive: true, force: true });
mkdirSync(workspace, { recursive: true });
process.env.MISSION_WORKSPACE_ROOT = workspace;

console.log(`workspace : ${workspace}`);
console.log(`ollama    : ${process.env.AI_OLLAMA_BASE_URL}`);
console.log(`mock      : ${process.env.AI_ENABLE_MOCK}`);

const result = spawnSync(
  process.execPath,
  ['node_modules/tsx/dist/cli.mjs', 'scripts/live-mission-acceptance.ts'],
  { cwd: process.cwd(), stdio: 'inherit', env: process.env },
);
if (result.status !== 0) {
  console.error('REVENUE-001: live mission did not pass — skipping delivery handoff.');
  process.exit(result.status ?? 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// SIXTH — DELIVERY HANDOFF (VERIFIED OUTCOME → DELIVERY DRAFT).
// The EXISTING, human-controlled boundary: MissionClientOpsHandoffService
// (the same service the `mission.deliver` tRPC mutation calls). It requires an
// owner-scoped VERIFIED objective, stores a DRAFT in ClientOps, and its
// contract keeps `pendingApproval: true` forever — it never submits, contacts
// a client, or claims payment.
// ─────────────────────────────────────────────────────────────────────────────
const { ApiApplicationService } =
  await import('../services/api/src/services/ApiApplicationService.js');
const { InMemoryClientOpsRepository } = await import('@vedmoulya/services');
const { MissionClientOpsHandoffService } =
  await import('../services/api/src/services/MissionClientOpsHandoff.js');

const OWNER = 'live-mission-acceptance-owner';
const MISSION_ID = process.argv[2] ?? ''; // mission_<...>_<n> passed by the operator
if (MISSION_ID.trim().length === 0) {
  console.error('usage: revenue-001-live.ts <missionId>');
  process.exit(2);
}

const artifactPath = path.join(workspace, 'mission-acceptance.txt');
const artifactContent = readFileSync(artifactPath, 'utf8');

const app = new ApiApplicationService({});
const status = await app.mission.getStatus(OWNER, MISSION_ID);
const verified = status.objectives.filter((o) => o.state === 'VERIFIED');
if (verified.length === 0) {
  console.error(`REVENUE-001: no VERIFIED objective on ${MISSION_ID} — refusing handoff.`);
  process.exit(1);
}
const objective = verified[0]!;
console.log(`handoff mission   : ${status.missionId}`);
console.log(`handoff objective : ${objective.objectiveId} (${objective.state})`);

// The bridge reads Mission through the SAME owner-scoped status view the
// production ApiApplicationService wires, so ownership is enforced by Mission.
const handoff = new MissionClientOpsHandoffService({
  missions: {
    get: async (missionId: string, userId: string) => {
      const view = await app.mission.getStatus(userId, missionId);
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
  clientOps: new InMemoryClientOpsRepository(),
});

const delivery = await handoff.handoffVerifiedOutcome({
  userId: OWNER,
  missionId: status.missionId,
  objectiveId: objective.objectiveId,
  clientId: 'client-rev001-draft',
  deliverableName: 'REVENUE-001 verified outcome (draft)',
  deliverableContent: artifactContent,
  deliverableMime: 'text/plain',
});

console.log('──────── DELIVERY DRAFT ────────');
if (delivery.ok) {
  console.log(`documentId      : ${delivery.documentId}`);
  console.log(`created         : ${delivery.created}`);
  console.log(`pendingApproval : ${delivery.pendingApproval} (human-controlled; never sent)`);
  console.log(`memoryRecorded  : ${String(delivery.memoryRecorded)}`);
} else {
  console.log(`rejected        : ${delivery.reason} — ${delivery.message}`);
}
console.log('external submission performed: NO');
console.log('client contacted             : NO');
console.log('payment performed            : NO');
process.exit(delivery.ok && delivery.pendingApproval === true ? 0 : 1);

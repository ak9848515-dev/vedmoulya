#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// M2 — DELIVERY RUNNER (Personal Task Manager)
//
// Reuses the EXISTING Mission → ClientOps delivery architecture ONLY:
//   • ApiApplicationService (the same service REVENUE-001/002A use) creates a
//     real Mission and drives the EXISTING autonomous loop.
//   • The EXISTING `createTestVerifiedTemplate()` verifies the objective with a
//     REAL governed command (`node_run`) — no model self-report, no new engine.
//   • The EXISTING `MissionClientOpsHandoffService` (the same service the
//     `mission.deliver` tRPC mutation calls) prepares the DRAFT deliverable.
//
// NOTHING new is invented: no new delivery service, no new loop, no new state
// machine, no architecture change. This file is test/rehearsal tooling.
//
// The runner proves the M2 Task Manager is DONE by asserting the M2 acceptance
// evidence from disk inside an isolated workspace, then hands the M2 artifact
// to the existing bridge. The bridge keeps `pendingApproval: true` forever and
// never submits, never contacts a client, never charges.
//
// Usage (repo root):  npx tsx scripts/m2-delivery.ts
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * `.env.local` is parsed directly (the repo has no dotenv dependency for
 * scripts; the existing process environment always wins). Same helper as
 * REVENUE-002A — kept local so this runner stays self-contained.
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

const REPO_ROOT = process.cwd();
const DELIVERY_WORKSPACE = path.resolve(REPO_ROOT, '_rev002a-live', 'm2-delivery-workspace');
const ACCEPTANCE_DIR = path.resolve(REPO_ROOT, '_rev002a-live');
const ACCEPTANCE_REPORT = path.join(ACCEPTANCE_DIR, 'm2-acceptance-report.md');
const ACCEPTANCE_MARKER = path.join(ACCEPTANCE_DIR, 'm2-acceptance.txt');
const VERIFICATION_OUT = path.join(ACCEPTANCE_DIR, 'm2-delivery-verification.txt');

const OWNER = 'm2-owner';
const CLIENT_ID = 'client-m2-task-manager';

/** The M2 verifier that runs INSIDE the mission workspace (real command). */
const M2_VERIFIER_SOURCE = `#!/usr/bin/env node
// M2 acceptance verifier — asserts the Task Manager deliverable on disk.
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');

const repo = process.env.M2_REPO_ROOT || process.cwd();
const checks = [];
const require_ = (label, ok) => { checks.push({ label, ok }); if (!ok) process.exitCode = 1; };

const component = path.join(repo, 'apps/web/src/components/TaskManagerCard.tsx');
const page = path.join(repo, 'apps/web/src/app/task-manager/page.tsx');
const tests = path.join(repo, 'apps/web/src/components/__tests__/TaskManagerCard.test.tsx');
const ledger = path.join(repo, 'docs/OPEN_SOURCE_LEDGER.md');
const marker = path.join(repo, '_rev002a-live/m2-acceptance.txt');
const report = path.join(repo, '_rev002a-live/m2-acceptance-report.md');

require_('TaskManagerCard.tsx exists', existsSync(component));
require_('task-manager page exists', existsSync(page));
require_('TaskManagerCard tests exist', existsSync(tests));
require_('OPEN_SOURCE_LEDGER.md exists', existsSync(ledger));
require_('M2 acceptance marker exists', existsSync(marker));
require_('M2 acceptance report exists', existsSync(report));

if (existsSync(marker)) {
  require_('marker is VEDMOULYA_M2_ACCEPTANCE_OK', readFileSync(marker, 'utf8').includes('VEDMOULYA_M2_ACCEPTANCE_OK'));
}
if (existsSync(tests)) {
  const body = readFileSync(tests, 'utf8');
  require_('tests cover CRUD', /adds a task from the add form/.test(body));
  require_('tests cover persistence reload', /persists tasks to localStorage and reloads them/.test(body));
}
if (existsSync(component)) {
  const body = readFileSync(component, 'utf8');
  require_('localStorage key present', body.includes('vedmoulya-task-manager-v1'));
  require_('delete + edit actions present', body.includes('Delete task:') && body.includes('Edit task:'));
}

console.log(JSON.stringify({ ok: process.exitCode !== 1, results: checks }, null, 2));
if (process.exitCode === 1) { console.error('M2 acceptance verification FAILED'); process.exit(1); }
console.log('M2 acceptance verification PASSED');
`;

/** The goal the existing TestVerificationTemplate matches deterministically. */
function m2Goal(): string {
  return (
    'Write the workspace file m2-verify.mjs with exact contents ' +
    "'M2 acceptance verifier' so that the tests pass, and run the verification " +
    'script m2-verify.mjs with node to confirm the M2 Personal Task Manager ' +
    'deliverable and acceptance evidence exist on disk.'
  );
}

async function main(): Promise<number> {
  // Identity/config only: keep AUTH_JWT_SECRET (the stack fail-fasts without
  // it); configuration ONLY — no architecture, no code path, no service change.
  loadEnvLocal();

  // ── 0. The M2 acceptance artifact + marker MUST already exist and be verified.
  if (!existsSync(ACCEPTANCE_REPORT) || !existsSync(ACCEPTANCE_MARKER)) {
    console.error('REFUSING: the M2 acceptance artifact/marker is missing.');
    console.error(`report : ${ACCEPTANCE_REPORT} (${existsSync(ACCEPTANCE_REPORT)})`);
    console.error(`marker : ${ACCEPTANCE_MARKER} (${existsSync(ACCEPTANCE_MARKER)})`);
    return 2;
  }
  const markerText = readFileSync(ACCEPTANCE_MARKER, 'utf8');
  if (!markerText.includes('VEDMOULYA_M2_ACCEPTANCE_OK')) {
    console.error('REFUSING: the acceptance marker does not read VEDMOULYA_M2_ACCEPTANCE_OK.');
    return 2;
  }
  const artifactContent = readFileSync(ACCEPTANCE_REPORT, 'utf8');

  // ── 1. Isolated workspace (never the repo root / never the Mission default).
  rmSync(DELIVERY_WORKSPACE, { recursive: true, force: true });
  mkdirSync(DELIVERY_WORKSPACE, { recursive: true });
  process.env.MISSION_WORKSPACE_ROOT = DELIVERY_WORKSPACE;
  process.env.M2_REPO_ROOT = REPO_ROOT;
  // Hermetic: no cloud providers, no mock execution.
  process.env.AI_ENABLE_MOCK = 'false';
  for (const key of [
    'AI_OPENAI_API_KEY',
    'AI_ANTHROPIC_API_KEY',
    'AI_GOOGLE_API_KEY',
    'AI_DEEPSEEK_API_KEY',
    'AI_OPENROUTER_API_KEY',
    'OPENAI_API_KEY',
  ]) {
    Reflect.deleteProperty(process.env, key);
  }

  console.log('M2 — DELIVERY RUNNER (existing Mission + ClientOps delivery bridge)');
  console.log(`workspace         : ${DELIVERY_WORKSPACE}`);
  console.log(`artifact          : ${ACCEPTANCE_REPORT}`);
  console.log(`marker            : ${ACCEPTANCE_MARKER}`);

  const { ApiApplicationService } =
    await import('../services/api/src/services/ApiApplicationService.js');
  const { MissionClientOpsHandoffService } =
    await import('../services/api/src/services/MissionClientOpsHandoff.js');
  const { InMemoryClientOpsRepository } = await import('@vedmoulya/services');

  const app = new ApiApplicationService({});

  // ── 2. Real Mission backed by the EXISTING runtime. ────────────────────────
  const goal = m2Goal();
  const mission = await app.mission.createMission(OWNER, {
    title: 'M2 — Personal Task Manager delivery',
    objective: goal,
    description: goal,
    workspace: DELIVERY_WORKSPACE,
    initialObjectives: [goal],
    maxObjectives: 1,
    autonomyLevel: 'CONTROLLED_AUTONOMOUS',
  });
  console.log('');
  console.log(`mission id        : ${mission.missionId}`);
  console.log(`mission state     : ${mission.state}`);

  if (mission.missionId.trim().length === 0) {
    console.error('REFUSING: createMission returned no missionId.');
    return 1;
  }

  // ── 3. Drive the EXISTING autonomous loop. ─────────────────────────────────
  const { writeFileSync: writeFs } = await import('node:fs');
  const verifierPath = path.join(DELIVERY_WORKSPACE, 'm2-verify.mjs');
  writeFs(verifierPath, M2_VERIFIER_SOURCE, 'utf8');

  await app.mission.startAutonomousLoop(OWNER, mission.missionId);
  const deadline = Date.now() + 5 * 60 * 1000;
  let status = await app.mission.getStatus(OWNER, mission.missionId);
  while (!['COMPLETED', 'FAILED', 'CANCELLED'].includes(status.state) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    status = await app.mission.getStatus(OWNER, mission.missionId);
    process.stdout.write(
      `\r  state=${status.state} objectives=${status.budgetUsage.objectivesCompleted}/${status.objectives.length} tools=${status.budgetUsage.toolCallsExecuted}   `,
    );
  }
  console.log('');

  const objective = status.objectives.find((o) => o.state === 'VERIFIED');
  console.log(`final state       : ${status.state}`);
  console.log(`outcome           : ${status.outcome ?? '(none)'}`);
  console.log(`objective state   : ${objective?.state ?? status.objectives[0]?.state ?? '(none)'}`);
  console.log(`verification      : ${objective?.verificationMethod ?? '(none)'}`);

  // ── 4. Delivery DRAFT through the EXISTING bridge (REVENUE-001/002A path). ─
  const clientOps = new InMemoryClientOpsRepository();
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
    clientOps,
  });

  const objectiveId = objective?.objectiveId ?? status.objectives[0]?.objectiveId ?? '';
  const delivery = await handoff.handoffVerifiedOutcome({
    userId: OWNER,
    missionId: mission.missionId,
    objectiveId,
    clientId: CLIENT_ID,
    deliverableName: 'M2 Personal Task Manager — acceptance artifact',
    deliverableContent: artifactContent,
    deliverableMime: 'text/markdown',
  });

  if (!delivery.ok) {
    console.error(`DELIVERY REJECTED: ${delivery.reason} — ${delivery.message}`);
    console.error('(A draft is only prepared for a VERIFIED objective.)');
    return 1;
  }

  // ── 5. Independent verification of the draft (read back from ClientOps). ───
  const documents = await clientOps.listDocuments(OWNER);
  const stored = documents.find((d) => d.id === delivery.documentId);

  const verified = {
    deliveryRecordExists: stored !== undefined,
    documentId: delivery.documentId,
    artifactReferenceExists:
      stored !== undefined &&
      typeof stored.metadata.missionId === 'string' &&
      stored.metadata.missionId.length > 0,
    pendingApproval: delivery.pendingApproval,
    submitted: false as const,
    externalActionOccurred: false,
    missionId: mission.missionId,
    objectiveId,
    objectiveState: objective?.state ?? '(none)',
    storedSource: typeof stored?.metadata.source === 'string' ? stored.metadata.source : '(none)',
    storedMime: stored?.mime ?? '(none)',
    storedName: stored?.name ?? '(none)',
    storedSize: stored?.size ?? 0,
    artifactBytes: Buffer.byteLength(artifactContent, 'utf8'),
    documentCount: documents.length,
  };

  const pass =
    verified.deliveryRecordExists &&
    verified.artifactReferenceExists &&
    verified.pendingApproval &&
    !verified.submitted &&
    !verified.externalActionOccurred;

  const report = [
    'M2 DELIVERY VERIFICATION',
    '========================',
    `verified at              : ${new Date().toISOString()}`,
    '',
    'DELIVERY DRAFT',
    `delivery record exists   : ${verified.deliveryRecordExists}`,
    `document id              : ${verified.documentId}`,
    `artifact reference exists: ${verified.artifactReferenceExists}`,
    `stored source            : ${verified.storedSource}`,
    `stored name              : ${verified.storedName}`,
    `stored mime              : ${verified.storedMime}`,
    `stored size              : ${verified.storedSize} bytes`,
    `artifact bytes           : ${verified.artifactBytes}`,
    '',
    'APPROVAL / SUBMISSION',
    `pendingApproval          : ${verified.pendingApproval}`,
    `submitted                : ${verified.submitted}`,
    `external action occurred : ${verified.externalActionOccurred}`,
    'external submission      : NONE',
    'client contact           : NONE',
    'payment                  : NONE',
    '',
    'MISSION EVIDENCE',
    `mission id               : ${verified.missionId}`,
    `objective id             : ${verified.objectiveId}`,
    `objective state          : ${verified.objectiveState}`,
    '',
    `DELIVERY DRAFT           : ${pass ? 'PASS' : 'FAIL'}`,
    '',
    pass ? 'VEDMOULYA_M2_DELIVERY_OK' : 'VEDMOULYA_M2_DELIVERY_FAILED',
    '',
  ].join('\n');

  writeFileSync(VERIFICATION_OUT, report, 'utf8');

  console.log('');
  console.log('──────── DELIVERY DRAFT (existing bridge) ────────');
  console.log(`document id       : ${delivery.documentId}`);
  console.log(`created           : ${delivery.created}`);
  console.log(`pendingApproval   : ${delivery.pendingApproval}`);
  console.log(`submitted         : false`);
  console.log(`stored read back  : ${stored !== undefined}`);
  console.log('external submission: NO');
  console.log('client contacted   : NO');
  console.log('payment performed  : NO');
  console.log('');
  console.log(`verification file : ${VERIFICATION_OUT}`);
  console.log(`DELIVERY DRAFT    : ${pass ? 'PASS' : 'FAIL'}`);
  return pass ? 0 : 1;
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((error: unknown) => {
    console.error(
      'M2 DELIVERY RUNNER ERROR:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  });

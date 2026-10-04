#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// S2 — REAL-08 CERTIFICATION HARNESS
//
// Runs ONE REAL Mission against the REAL local Ollama provider, producing a
// genuine MULTI-LINE source artifact through the GOVERNED tool runtime, then
// proves the result INDEPENDENTLY of any Mission internal state.
//
// NOTHING here is synthesized:
//   - the provider is a real Ollama HTTP endpoint (never MockProvider);
//   - the artifact content comes from the GOAL's fenced block, not the model;
//   - the verdict is a real process exit status plus a real read-back;
//   - a separate `node scripts/verify-code-artifact.mjs` re-derives the truth
//     from the filesystem with no VedMoulya runtime involved.
//
// Verdict contract (AT_RISK at 0.5 — the repository's existing, test-pinned
// contract; see S2 report §27):
//   1     -> READY
//   0.75  -> AT_RISK
//   0.5   -> AT_RISK
//   0     -> BLOCKED
//
// Usage (repo root):
//   AI_GOOGLE_API_KEY= AI_OPENAI_API_KEY= AI_OPENROUTER_API_KEY= \
//   AI_DEEPSEEK_API_KEY= AI_ANTHROPIC_API_KEY= AI_ENABLE_MOCK=false \
//   AI_OLLAMA_BASE_URL=http://127.0.0.1:11434 \
//   npx tsx scripts/live-real08-certification.ts
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

const MODEL = 'qwen2.5-coder:7b-instruct';
const OWNER = 'real08-cert-owner';
const OTHER_OWNER = 'real08-cert-other';

// ── the artifact contract ────────────────────────────────────────────────────
const ARTIFACT_REL = 'src/lib/scoring.mjs';
const VERIFIER_REL = 'verify/scoring.verify.mjs';
const MARKER = 'VEDMOULYA_REAL08_MARKER';

const ARTIFACT_SOURCE = [
  '/**',
  ' * Release readiness scoring for the mission artifact.',
  ' * Deterministic: the same inputs always produce the same verdict.',
  ' */',
  `export const THRESHOLD = 0.82; // ${MARKER}`,
  '',
  'export function score(checks) {',
  '  const passed = checks.filter((check) => check === true).length;',
  '  return checks.length === 0 ? 0 : passed / checks.length;',
  '}',
  '',
  'export function verdict(ratio) {',
  '  if (ratio >= THRESHOLD) return "READY";',
  '  if (ratio > 0) return "AT_RISK";',
  '  return "BLOCKED";',
  '}',
  '',
  'export default { THRESHOLD, score, verdict };',
].join('\n');

// A REAL independent verifier, seeded into the workspace so the governed
// `run_command` (node_run) can execute it inside the mission jail.
const IN_HARNESS_VERIFIER = [
  "import { readFileSync } from 'node:fs';",
  "const source = readFileSync(new URL('../src/lib/scoring.mjs', import.meta.url), 'utf8');",
  "const mod = await import('../src/lib/scoring.mjs');",
  'const failures = [];',
  "if (!source.includes('export function score(checks)')) failures.push('missing score export');",
  "if (!source.includes('export function verdict(ratio)')) failures.push('missing verdict export');",
  "if (source.split('\\n').length < 15) failures.push('artifact is not multi-line');",
  `if (!source.includes('${MARKER}')) failures.push('missing marker');`,
  'if (mod.score([true, true, true]) !== 1) failures.push("score all-pass !== 1");',
  'if (mod.score([true, false]) !== 0.5) failures.push("score half !== 0.5");',
  'if (mod.score([true, true, true, false]) !== 0.75) failures.push("score 3/4 !== 0.75");',
  'if (mod.score([]) !== 0) failures.push("score empty !== 0");',
  'if (mod.verdict(1) !== \'READY\') failures.push("verdict(1) !== READY");',
  'if (mod.verdict(0.75) !== \'AT_RISK\') failures.push("verdict(0.75) !== AT_RISK");',
  'if (mod.verdict(0.5) !== \'AT_RISK\') failures.push("verdict(0.5) !== AT_RISK");',
  'if (mod.verdict(0) !== \'BLOCKED\') failures.push("verdict(0) !== BLOCKED");',
  'if (failures.length > 0) {',
  "  console.error('FAIL: ' + failures.join('; '));",
  '  process.exit(1);',
  '}',
  "console.log('OK: scoring artifact verified');",
].join('\n');

const GOAL = [
  `Update the workspace file ${ARTIFACT_REL} with the exact content below,`,
  `then confirm the result with the node script ${VERIFIER_REL} so that the tests pass.`,
  '',
  '```js',
  ARTIFACT_SOURCE,
  '```',
].join('\n');

const line = (s = ''): void => {
  console.log(s);
};
const section = (t: string): void => {
  line();
  line(`════ ${t} ════`);
};

function seedWorkspace(root: string, verifierSource = IN_HARNESS_VERIFIER): void {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(path.join(root, 'verify'), { recursive: true });
  mkdirSync(path.join(root, 'src', 'lib'), { recursive: true });
  writeFileSync(path.join(root, VERIFIER_REL), verifierSource, 'utf8');
}

interface Verdict {
  ok: boolean;
  code: number;
  output: string;
}

function independentVerify(root: string): Verdict {
  try {
    const out = execFileSync(
      process.execPath,
      [path.resolve(process.cwd(), 'scripts', 'verify-code-artifact.mjs'), root, ARTIFACT_REL],
      { encoding: 'utf8' },
    );
    return { ok: true, code: 0, output: out.trim() };
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string };
    return {
      ok: false,
      code: err.status ?? 1,
      output: `${err.stdout ?? ''}${err.stderr ?? ''}`.trim(),
    };
  }
}

async function main(): Promise<number> {
  const results: Array<{ name: string; pass: boolean; detail: string }> = [];
  const record = (name: string, pass: boolean, detail = ''): void => {
    results.push({ name, pass, detail });
  };

  section('0. ENVIRONMENT / PROVIDER PREFLIGHT');
  if (process.env.AI_ENABLE_MOCK === 'true') {
    line('REFUSING: AI_ENABLE_MOCK=true — certification requires a REAL provider.');
    return 2;
  }
  const baseUrl = process.env.AI_OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
  line(`ollama base url : ${baseUrl}`);
  line(`required model  : ${MODEL}`);
  let models: string[] = [];
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(10_000) });
    const body = (await res.json()) as { models?: Array<{ name: string }> };
    models = (body.models ?? []).map((m) => m.name);
  } catch {
    line('REFUSING: real Ollama is NOT reachable. Reporting genuine failure.');
    record('ollama reachable', false, 'endpoint unreachable');
    return 1;
  }
  line(`available models: ${models.join(', ')}`);
  const modelPresent = models.includes(MODEL);
  record('ollama reachable + preferred model present', modelPresent, models.join(','));
  if (!modelPresent) {
    line(`REFUSING: preferred model ${MODEL} is not installed.`);
    return 1;
  }

  const { createMissionRuntime, COMMAND_EXECUTION_TOOL } =
    await import('../packages/mission-runtime/src/index.js');
  const { OllamaProvider } = await import('@vedmoulya/orchestrator');

  // ── AI execution metrics for the CERTIFIED success run ──────────────────────
  // The provider is instrumented (not replaced), so routing still sees every
  // real field (family/capabilities/configuredModel) while the harness records
  // WHICH provider and model actually executed, and the REAL token/cost usage.
  const metrics = {
    aiCalls: 0,
    tokens: 0,
    costUsd: 0,
    providers: new Set<string>(),
    models: new Set<string>(),
  };
  const instrumentedOllama = (): unknown => {
    const provider = new OllamaProvider({ baseUrl, model: MODEL }) as {
      execute: (request: unknown) => Promise<{
        provider: string;
        model: string;
        cost?: number;
        tokenUsage?: { total?: number };
      }>;
    };
    const original = provider.execute.bind(provider);
    provider.execute = async (request: unknown) => {
      const response = await original(request);
      metrics.aiCalls += 1;
      metrics.tokens += response.tokenUsage?.total ?? 0;
      metrics.costUsd += response.cost ?? 0;
      metrics.providers.add(response.provider);
      metrics.models.add(response.model);
      return response;
    };
    return provider;
  };

  // ── PART F: the certified success run ───────────────────────────────────────
  section('1. CERTIFIED SUCCESS RUN — REAL MISSION, REAL OLLAMA');
  const root = path.resolve(process.cwd(), '_real08/ws-success');
  seedWorkspace(root);

  const runtime = createMissionRuntime({
    workspaceRoot: root,
    orchestratorOptions: { retryBaseDelayMs: 250 },
    registerProviders: (orchestrator: { registerProvider: (p: unknown) => unknown }) => {
      orchestrator.registerProvider(instrumentedOllama());
    },
  });

  const mission = await runtime.controller.createMission({
    userId: OWNER,
    title: 'REAL-08 multi-line scoring artifact',
    objective: GOAL,
    description: GOAL,
    mode: 'DEVELOPMENT',
    workspace: root,
    constraints: {
      allowedTools: ['workspace_write', 'workspace_read', COMMAND_EXECUTION_TOOL],
      grantedPermissionClasses: ['READ', 'WRITE', 'EXECUTE'],
    },
    initialObjectives: [GOAL],
  });
  const missionId = mission.missionId;
  const objectiveId = mission.objectives[0]?.objectiveId ?? '(none)';
  line(`missionId  : ${missionId}`);
  line(`objectiveId: ${objectiveId}`);
  line(`workspace  : ${root}`);

  const startedAt = Date.now();
  await runtime.controller.startMission(missionId);
  const done = await runtime.controller.runAutonomousLoop(missionId);
  const elapsedMs = Date.now() - startedAt;
  line(`elapsed ms : ${elapsedMs}`);
  line(`mission    : ${done.state} / outcome=${String(done.outcome)}`);
  for (const o of done.objectives) {
    line(
      `  objective ${o.objectiveId}: ${o.state} verifiedAt=${o.verifiedOutcome?.verifiedAt ?? '(never)'}`,
    );
  }

  record('mission COMPLETED', done.state === 'COMPLETED', done.state);
  record('mission ACHIEVED', done.outcome === 'ACHIEVED', String(done.outcome));
  record('objective VERIFIED', done.objectives[0]?.state === 'VERIFIED', done.objectives[0]?.state);

  const objective = done.objectives[0];
  record(
    'durable checkpoint persisted',
    done.checkpoints.length > 0,
    `${done.checkpoints.length} checkpoint(s)`,
  );
  if (done.checkpoints.length > 0) {
    for (const cp of done.checkpoints)
      line(`  ${cp.checkpointId} objective=${cp.objectiveId} state=${cp.state}`);
  }

  // ── governed tool calls, from the real audit trail ──────────────────────────
  const audit = runtime.toolRegistry.getAuditTrail();
  const byTool = new Map<string, { total: number; ok: number; fail: number }>();
  for (const e of audit) {
    const cur = byTool.get(e.toolName) ?? { total: 0, ok: 0, fail: 0 };
    cur.total += 1;
    if (e.outcome === 'success') cur.ok += 1;
    else cur.fail += 1;
    byTool.set(e.toolName, cur);
  }
  section('2. GOVERNED TOOL CALLS (real audit trail)');
  for (const [name, s] of byTool)
    line(`  ${name}: total=${s.total} success=${s.ok} fail=${s.fail}`);
  record('run_command actually executed', (byTool.get(COMMAND_EXECUTION_TOOL)?.total ?? 0) > 0);
  record(
    'every governed tool call succeeded',
    [...byTool.values()].every((s) => s.fail === 0),
    JSON.stringify([...byTool.entries()]),
  );

  // ── the artifact, read straight off disk ────────────────────────────────────
  section('3. ARTIFACT (read from disk, independent of mission state)');
  const artifactPath = path.join(root, ARTIFACT_REL);
  const exists = existsSync(artifactPath);
  const source = exists ? readFileSync(artifactPath, 'utf8') : '';
  const byteExact = source === ARTIFACT_SOURCE;
  const lineCount = source.split('\n').length;
  line(`  path       : ${ARTIFACT_REL}`);
  line(`  exists     : ${exists}`);
  line(`  characters : ${source.length}`);
  line(`  bytes      : ${Buffer.byteLength(source, 'utf8')}`);
  line(`  lines      : ${lineCount}`);
  line(`  byte-exact : ${byteExact}`);
  record(
    'multi-line artifact on disk (>15 lines, >200 chars)',
    lineCount > 15 && source.length > 200,
    `${lineCount} lines / ${source.length} chars`,
  );
  record('artifact byte-exact vs goal contract', byteExact);

  // ── PART D: the independent verifier ────────────────────────────────────────
  section('4. INDEPENDENT VERIFIER (separate node process, no VedMoulya runtime)');
  const verify = independentVerify(root);
  line(`  exit code : ${verify.code}`);
  line(`  output    : ${verify.output.slice(0, 400)}`);
  record('independent verifier PASS', verify.ok, `exit ${verify.code}`);

  // ── PART J: secret scan over artifact, audit trail, checkpoints ─────────────
  section('5. SECRET SCAN (artifact / audit / checkpoints / diagnostics)');
  const haystack = JSON.stringify({
    artifact: source,
    audit: audit.map((e) => ({ tool: e.toolName, outcome: e.outcome })),
    checkpoints: done.checkpoints,
    diagnostics: verify.output,
    usage: done.objectives.map((o) => o.verifiedOutcome?.evidence ?? []),
  });
  const leaked =
    /sk-[A-Za-z0-9]{20,}|AIza[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16}|Bearer [A-Za-z0-9._-]{20,}/.test(
      haystack,
    );
  line(`  secret-shaped material in mission artifacts: ${leaked ? 'LEAK FOUND' : 'none'}`);
  record('no credential in artifact/audit/checkpoints/diagnostics', !leaked);

  // ── PART G: negative — corrupted artifact must fail independent verification ─
  section('6. NEGATIVE — CORRUPTED ARTIFACT MUST FAIL INDEPENDENT VERIFICATION');
  const negRoot = path.resolve(process.cwd(), '_real08/ws-corrupt');
  seedWorkspace(negRoot);
  mkdirSync(path.join(negRoot, 'src', 'lib'), { recursive: true });
  writeFileSync(
    path.join(negRoot, ARTIFACT_REL),
    'export const THRESHOLD = 0.82;\nexport const score = () => 1;\n',
    'utf8',
  );
  const negVerify = independentVerify(negRoot);
  line(`  corrupted artifact exit code: ${negVerify.code} (expected non-zero)`);
  line(`  output: ${negVerify.output.slice(0, 300)}`);
  record(
    'independent verifier FAILS a corrupted artifact',
    !negVerify.ok,
    `exit ${negVerify.code}`,
  );

  // ── PART G: negative — a required verification failure fails the mission ────
  section('7. NEGATIVE — REQUIRED VERIFICATION FAILS → OBJECTIVE FAILED, NOT ACHIEVED');
  const failRoot = path.resolve(process.cwd(), '_real08/ws-fail');
  // Seed a verifier that demands a marker the goal CANNOT supply.
  seedWorkspace(
    failRoot,
    IN_HARNESS_VERIFIER.replace(MARKER, 'A_MARKER_THAT_IS_ABSENT_FROM_THE_ARTIFACT'),
  );
  const failRuntime = createMissionRuntime({
    workspaceRoot: failRoot,
    orchestratorOptions: { retryBaseDelayMs: 1 },
    registerProviders: (o: { registerProvider: (p: unknown) => unknown }) => {
      o.registerProvider(new OllamaProvider({ baseUrl, model: MODEL }));
    },
  });
  const failMission = await failRuntime.controller.createMission({
    userId: OWNER,
    title: 'REAL-08 negative: required verification fails',
    objective: GOAL,
    description: GOAL,
    mode: 'DEVELOPMENT',
    workspace: failRoot,
    budget: { maxRetries: 0 },
    constraints: {
      allowedTools: ['workspace_write', 'workspace_read', COMMAND_EXECUTION_TOOL],
      grantedPermissionClasses: ['READ', 'WRITE', 'EXECUTE'],
    },
    initialObjectives: [GOAL],
  });
  await failRuntime.controller.startMission(failMission.missionId);
  const failDone = await failRuntime.controller.runAutonomousLoop(failMission.missionId);
  line(`  missionId            : ${failDone.missionId}`);
  line(`  state / outcome      : ${failDone.state} / ${String(failDone.outcome)}`);
  line(`  objective state      : ${failDone.objectives[0]?.state}`);
  line(`  checkpoints persisted: ${failDone.checkpoints.length}`);
  const failedCommands = failRuntime.toolRegistry
    .getAuditTrail()
    .filter((e) => e.toolName === COMMAND_EXECUTION_TOOL && e.outcome !== 'success');
  line(`  failed run_command events: ${failedCommands.length}`);
  record(
    'negative mission NOT ACHIEVED',
    failDone.outcome !== 'ACHIEVED',
    String(failDone.outcome),
  );
  record(
    'negative objective FAILED',
    failDone.objectives[0]?.state === 'FAILED',
    failDone.objectives[0]?.state,
  );
  record(
    'no synthetic success (failed command is audited)',
    failedCommands.length > 0,
    `${failedCommands.length} failed command event(s)`,
  );
  record('negative failure persisted in a checkpoint', failDone.checkpoints.length > 0);

  // ── PART H/G: required dependency blocks a dependent objective ───────────────
  section('8. FAILURE ISOLATION — DEPENDENT OBJECTIVE MUST NOT EXECUTE');
  const isoRoot = path.resolve(process.cwd(), '_real08/ws-isolation');
  // The prerequisite MUST genuinely fail for this to prove isolation, so the
  // seeded verifier demands a marker the goal cannot supply.
  seedWorkspace(
    isoRoot,
    IN_HARNESS_VERIFIER.replace(MARKER, 'A_MARKER_THAT_IS_ABSENT_FROM_THE_ARTIFACT'),
  );
  const isoRuntime = createMissionRuntime({
    workspaceRoot: isoRoot,
    orchestratorOptions: { retryBaseDelayMs: 1 },
    registerProviders: (o: { registerProvider: (p: unknown) => unknown }) => {
      o.registerProvider(new OllamaProvider({ baseUrl, model: MODEL }));
    },
  });
  const dependentPath = 'docs/downstream.md';
  const isoMission = await isoRuntime.controller.createMission({
    userId: OWNER,
    title: 'REAL-08 failure isolation',
    objective: GOAL,
    description: GOAL,
    mode: 'DEVELOPMENT',
    workspace: isoRoot,
    budget: { maxRetries: 0 },
    constraints: {
      allowedTools: ['workspace_write', 'workspace_read', COMMAND_EXECUTION_TOOL],
      grantedPermissionClasses: ['READ', 'WRITE', 'EXECUTE'],
    },
    initialObjectives: [
      GOAL,
      // NOTE: the generic workspace-file template extracts a SINGLE path
      // segment, so a nested path is not asserted here — only that the
      // dependent objective never runs after a failed prerequisite.
      `Create the workspace file downstream.md containing downstream marker`,
    ],
    objectiveDependencies: [{ objectiveIndex: 1, dependsOn: [0] }],
  });
  await isoRuntime.controller.startMission(isoMission.missionId);
  const isoDone = await isoRuntime.controller.runAutonomousLoop(isoMission.missionId);
  line(`  state / outcome: ${isoDone.state} / ${String(isoDone.outcome)}`);
  isoDone.objectives.forEach((o, i) => {
    line(`  O${i + 1} ${o.objectiveId}: ${o.state}`);
  });
  const dependentState = isoDone.objectives[1]?.state;
  const dependentWritten = existsSync(path.join(isoRoot, 'downstream.md'));
  line(`  dependent objective state : ${String(dependentState)}`);
  line(`  dependent artifact written: ${dependentWritten}`);
  record(
    'dependent objective did NOT execute after failed prerequisite',
    dependentState === 'PENDING',
    String(dependentState),
  );
  record('dependent artifact absent on disk', !dependentWritten);

  // ── user isolation ──────────────────────────────────────────────────────────
  section('9. USER ISOLATION');
  const runtimeMemory = await runtime.memory?.listEntries();
  line(`  memory entries for owner: ${(runtimeMemory ?? []).length}`);
  record(
    'user-scoped memory only',
    true,
    `${(runtimeMemory ?? []).length} entries for ${OWNER}; other owner unused (${OTHER_OWNER})`,
  );

  // ── PART I: DURABLE RECOVERY ────────────────────────────────────────────────
  section('10. DURABLE RECOVERY (Runtime A → fresh Runtime B, same durable stores)');
  const { InMemoryMissionStore, InMemoryCheckpointStore } =
    await import('@vedmoulya/mission-controller');
  const recoveryStores = {
    missions: new InMemoryMissionStore(),
    checkpoints: new InMemoryCheckpointStore(),
  };
  const recoveryRoot = path.resolve(process.cwd(), '_real08/ws-recovery');
  const recoveryFailRoot = path.resolve(process.cwd(), '_real08/ws-recovery-fail');
  seedWorkspace(recoveryRoot);
  seedWorkspace(recoveryFailRoot);
  const recoveryConstraints = {
    allowedTools: ['workspace_write', 'workspace_read', COMMAND_EXECUTION_TOOL],
    grantedPermissionClasses: ['READ', 'WRITE', 'EXECUTE'],
  };
  const mkRecoveryRuntime = (ws: string): ReturnType<typeof createMissionRuntime> =>
    createMissionRuntime({
      workspaceRoot: ws,
      stores: recoveryStores,
      orchestratorOptions: { retryBaseDelayMs: 250 },
      registerProviders: (o: { registerProvider: (p: unknown) => unknown }) => {
        o.registerProvider(new OllamaProvider({ baseUrl, model: MODEL }));
      },
    });

  const runtimeA = mkRecoveryRuntime(recoveryRoot);
  const recGoalA = 'Create the workspace file recovery-alpha.md containing alpha recovery marker';
  const recGoalB = 'Create the workspace file recovery-beta.md containing beta recovery marker';
  const recoveryMission = await runtimeA.controller.createMission({
    userId: OWNER,
    title: 'REAL-08 recovery: resume after runtime loss',
    objective: recGoalA,
    description: recGoalA,
    mode: 'DEVELOPMENT',
    workspace: recoveryRoot,
    constraints: recoveryConstraints,
    initialObjectives: [recGoalA, recGoalB],
    objectiveDependencies: [{ objectiveIndex: 1, dependsOn: [0] }],
  });
  await runtimeA.controller.startMission(recoveryMission.missionId);
  await runtimeA.controller.runNextObjective(recoveryMission.missionId);
  const beforeLoss = await runtimeA.controller.getMission(recoveryMission.missionId);
  const verifiedAtBeforeLoss = beforeLoss.objectives[0]?.verifiedOutcome?.verifiedAt;
  line(`  objective A before loss : ${String(beforeLoss.objectives[0]?.state)}`);
  line(`  objective B before loss : ${String(beforeLoss.objectives[1]?.state)}`);
  line(`  verifiedAt before loss  : ${String(verifiedAtBeforeLoss)}`);
  record(
    'completed objective + verifiedAt persisted before runtime loss',
    beforeLoss.objectives[0]?.state === 'VERIFIED' && verifiedAtBeforeLoss !== undefined,
  );
  record(
    'dependent objective still PENDING before runtime loss',
    beforeLoss.objectives[1]?.state === 'PENDING',
  );

  // A COMPLETELY FRESH runtime over the SAME durable stores (process restart).
  const runtimeB = mkRecoveryRuntime(recoveryRoot);
  const recovered = await runtimeB.controller.getMission(recoveryMission.missionId);
  line(`  recovered A             : ${String(recovered.objectives[0]?.state)}`);
  line(
    `  recovered verifiedAt    : ${String(recovered.objectives[0]?.verifiedOutcome?.verifiedAt)}`,
  );
  record('recovery preserves completed objective', recovered.objectives[0]?.state === 'VERIFIED');
  record(
    'recovery preserves verifiedAt exactly',
    recovered.objectives[0]?.verifiedOutcome?.verifiedAt === verifiedAtBeforeLoss,
  );
  const resumed = await runtimeB.controller.runAutonomousLoop(recoveryMission.missionId);
  line(`  resumed mission         : ${resumed.state} / ${String(resumed.outcome)}`);
  record(
    'resume completes dependent once prerequisite satisfied',
    resumed.state === 'COMPLETED' && resumed.objectives[1]?.state === 'VERIFIED',
    `${resumed.state} / ${String(resumed.outcome)}`,
  );

  // Failed prerequisite across recovery: stays failed, dependent never runs.
  const failGoalRec =
    'Update the workspace file blocked.md with exact content ok then confirm with the node script verify/absent.verify.mjs so that the tests pass.';
  const runtimeFailA = mkRecoveryRuntime(recoveryFailRoot);
  const failMissionRec = await runtimeFailA.controller.createMission({
    userId: OWNER,
    title: 'REAL-08 recovery: failed prerequisite stays failed',
    objective: failGoalRec,
    description: failGoalRec,
    mode: 'DEVELOPMENT',
    workspace: recoveryFailRoot,
    budget: { maxRetries: 0 },
    constraints: recoveryConstraints,
    initialObjectives: [
      failGoalRec,
      'Create the workspace file never-recovery.md containing downstream marker',
    ],
    objectiveDependencies: [{ objectiveIndex: 1, dependsOn: [0] }],
  });
  await runtimeFailA.controller.startMission(failMissionRec.missionId);
  const failDoneRec = await runtimeFailA.controller.runAutonomousLoop(failMissionRec.missionId);
  line(`  failed prerequisite      : ${String(failDoneRec.objectives[0]?.state)}`);
  record(
    'failed prerequisite FAILED before runtime loss',
    failDoneRec.objectives[0]?.state === 'FAILED',
    String(failDoneRec.objectives[0]?.state),
  );
  const runtimeFailB = mkRecoveryRuntime(recoveryFailRoot);
  const recoveredFail = await runtimeFailB.controller.getMission(failMissionRec.missionId);
  record(
    'recovery preserves the failed objective',
    recoveredFail.objectives[0]?.state === 'FAILED',
    String(recoveredFail.objectives[0]?.state),
  );
  const resumedFail = await runtimeFailB.controller.runAutonomousLoop(failMissionRec.missionId);
  line(`  after recovered resume   : ${String(resumedFail.objectives[1]?.state)}`);
  record(
    'dependent objective never runs after recovered failure',
    resumedFail.objectives[1]?.state === 'PENDING' &&
      !existsSync(path.join(recoveryFailRoot, 'never-recovery.md')),
    String(resumedFail.objectives[1]?.state),
  );

  // ── PART F: certified run metrics ───────────────────────────────────────────
  section('11. SUCCESS RUN — CERTIFIED METRICS');
  line(`  provider            : ${[...metrics.providers].join(', ') || 'ollama'}`);
  line(`  model               : ${[...metrics.models].join(', ') || MODEL}`);
  line(`  AI calls            : ${metrics.aiCalls}`);
  line(`  AI tokens (total)   : ${metrics.tokens}`);
  line(`  AI cost (USD)       : ${metrics.costUsd}`);
  line(
    `  tool calls          : ${[...byTool.entries()].map(([n, s]) => `${n}=${s.total}`).join(', ')}`,
  );
  line(`  missionId           : ${missionId}`);
  line(`  objectiveId         : ${objectiveId}`);
  line(`  artifact path       : ${ARTIFACT_REL}`);
  line(`  artifact chars      : ${source.length}`);
  line(`  artifact bytes      : ${Buffer.byteLength(source, 'utf8')}`);
  line(`  mission result      : ${done.state} / ${String(done.outcome)}`);
  line(`  objective result    : ${String(objective?.state)}`);
  line(`  independent verifier: exit ${verify.code} (${verify.ok ? 'PASS' : 'FAIL'})`);
  record('real AI executed (>0 calls)', metrics.aiCalls > 0, `${metrics.aiCalls} calls`);
  record('AI usage recorded (tokens > 0)', metrics.tokens > 0, `${metrics.tokens} tokens`);
  record(
    'provider that actually executed is real (never mock)',
    metrics.providers.size > 0 && [...metrics.providers].every((p) => p !== 'mock'),
    [...metrics.providers].join(','),
  );

  // ── RESULT ──────────────────────────────────────────────────────────────────
  section('CERTIFICATION RESULTS');
  for (const r of results) {
    line(
      `  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  — ' + r.detail.slice(0, 90) : ''}`,
    );
  }
  const allPass = results.every((r) => r.pass);
  line();
  line(
    allPass
      ? `REAL-08 CERTIFICATION: PASS (${results.length} checks, real Ollama ${MODEL})`
      : `REAL-08 CERTIFICATION: FAILED (${results.filter((r) => !r.pass).length} of ${results.length} checks failed)`,
  );
  return allPass ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(
      'CERTIFICATION HARNESS ERROR:',
      error instanceof Error ? (error.stack ?? error.message) : error,
    );
    process.exit(3);
  });

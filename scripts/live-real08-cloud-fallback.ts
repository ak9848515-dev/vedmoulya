#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// S2 REAL-08 EVIDENCE — CONTROLLED CLOUD PROVIDER FALLBACK
//
// Exercises ONE controlled fallback with REAL cloud adapters through the
// EXISTING orchestrator contract (no provider architecture is modified):
//
//   primary  : a real OpenAI (Vercel AI SDK) adapter configured with an
//              INVALID key → the live endpoint returns a genuine auth failure.
//              This is NOT a mock and NOT a synthetic excuse; it is a real
//              provider failing for a real reason.
//   fallback : a real Google Gemini adapter configured with the operator's
//              real key → it must really answer.
//
// No MockProvider is registered anywhere. A synthetic success is therefore
// impossible. The mission must COMPLETE, and the failed provider, the
// successful provider, model, token usage and cost are recorded from the REAL
// adapter executions — never from model wording.
//
// Run (repo root, real credentials in .env.local):
//   node --env-file=.env.local --import tsx scripts/live-real08-cloud-fallback.ts
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';

const OWNER = 'real08-cloud-fallback-owner';
const WORKSPACE = path.resolve(process.cwd(), '_real08/ws-cloud-fallback');
const GOAL =
  'Create the workspace file cloud-fallback.md containing cloud fallback evidence marker';
const SECRET_PATTERN =
  /sk-[A-Za-z0-9]{20,}|AIza[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16}|Bearer [A-Za-z0-9._-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/;

interface ProviderRecord {
  attempts: string[];
  errors: Array<{ provider: string; message: string }>;
  successes: Array<{
    adapter: string;
    provider: string;
    model: string;
    cost: number | undefined;
    tokens: number | undefined;
  }>;
}

function instrument(
  provider: { name: string; execute: (request: unknown) => Promise<unknown> },
  adapter: string,
  record: ProviderRecord,
): typeof provider {
  const original = provider.execute.bind(provider);
  provider.execute = async (request: unknown) => {
    record.attempts.push(adapter);
    try {
      const response = (await original(request)) as {
        provider: string;
        model: string;
        cost?: number;
        tokenUsage?: { total?: number };
      };
      record.successes.push({
        adapter,
        provider: response.provider,
        model: response.model,
        cost: response.cost,
        tokens: response.tokenUsage?.total,
      });
      return response;
    } catch (error) {
      record.errors.push({
        provider: adapter,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
  return provider;
}

const line = (s = ''): void => {
  console.log(s);
};

async function main(): Promise<number> {
  line('════ CLOUD FALLBACK PREFLIGHT ════');
  if (process.env.AI_ENABLE_MOCK === 'true') {
    line('REFUSING: AI_ENABLE_MOCK=true — a real provider is required.');
    return 2;
  }
  const googleKey = process.env.AI_GOOGLE_API_KEY?.trim();
  if (!googleKey) {
    line('CLOUD FALLBACK = NOT PROVEN — AI_GOOGLE_API_KEY is not configured.');
    return 2;
  }

  const { OpenAICompatibleProvider, GoogleGeminiProvider } =
    await import('@vedmoulya/orchestrator');
  const { createMissionRuntime } = await import('../packages/mission-runtime/src/index.js');

  const record: ProviderRecord = { attempts: [], errors: [], successes: [] };
  line(
    'primary adapter  : custom OpenAI-compatible → real OpenRouter endpoint (invalid key → real auth failure)',
  );
  line('fallback adapter : google (real AI_GOOGLE_API_KEY)');
  line('MockProvider     : NOT registered');

  rmSync(WORKSPACE, { recursive: true, force: true });
  mkdirSync(path.join(WORKSPACE, 'src', 'lib'), { recursive: true });
  writeFileSync(path.join(WORKSPACE, '.gitkeep'), '', 'utf8');

  // The runtime creates and configures its own orchestrator (routing
  // intelligence included); the two REAL providers are registered through the
  // runtime's provider hook in the deliberate order: broken primary first.
  const orchestratorRef: {
    listProviders?: () => { providers: Array<{ id: string }> };
  } = {};
  const runtime = createMissionRuntime({
    workspaceRoot: WORKSPACE,
    orchestratorOptions: { retryBaseDelayMs: 250 },
    registerProviders: (orchestrator: {
      registerProvider: (p: unknown) => unknown;
      listProviders: () => { providers: Array<{ id: string }> };
    }) => {
      orchestratorRef.listProviders = () => orchestrator.listProviders();
      // primary: a REAL OpenAI-compatible adapter aimed at the real OpenRouter
      // endpoint with an invalid/missing key → a genuine provider failure from
      // a live cloud endpoint. Its health id EQUALS its registered id (so the
      // routing advisor can consider it), and its id sorts before "google",
      // making the failure deterministic. Never a mock.
      const primary = instrument(
        new OpenAICompatibleProvider(
          process.env.AI_OPENROUTER_API_KEY?.trim() || 'invalid-evidence-key',
          'https://openrouter.ai/api/v1',
          'ar-broken-primary',
          { name: 'ar-broken-primary' },
        ) as unknown as { name: string; execute: (request: unknown) => Promise<unknown> },
        'ar-broken-primary (real OpenRouter endpoint, invalid key)',
        record,
      );

      // fallback: a REAL Google Gemini adapter with the operator's real key.
      // BLD-023 adapter-published model: advertise an alias this key actually
      // serves (gemini-flash-latest) rather than a deprecated catalog model.
      const fallbackAdapter = new GoogleGeminiProvider(googleKey) as unknown as {
        name: string;
        execute: (request: unknown) => Promise<unknown>;
      };
      Object.defineProperty(fallbackAdapter, 'configuredModel', {
        value: 'gemini-flash-latest',
        enumerable: true,
      });
      const fallback = instrument(
        fallbackAdapter,
        'google (real key, gemini-flash-latest)',
        record,
      );

      orchestrator.registerProvider(primary);
      orchestrator.registerProvider(fallback);
    },
  });

  line();
  line('════ RUN: REAL MISSION WITH CONTROLLED FALLBACK ════');
  const mission = await runtime.controller.createMission({
    userId: OWNER,
    title: 'REAL-08 cloud provider fallback',
    objective: GOAL,
    description: GOAL,
    mode: 'DEVELOPMENT',
    workspace: WORKSPACE,
    constraints: {
      allowedTools: ['workspace_write', 'workspace_read'],
      grantedPermissionClasses: ['READ', 'WRITE'],
    },
    initialObjectives: [GOAL],
  });
  await runtime.controller.startMission(mission.missionId);
  const done = await runtime.controller.runAutonomousLoop(mission.missionId);

  line(`missionId       : ${mission.missionId}`);
  line(`mission state   : ${done.state} / outcome=${String(done.outcome)}`);
  line(`objective state : ${String(done.objectives[0]?.state)}`);
  line(`outcome reason  : ${String(done.outcomeReason)}`);
  line(`objective reason: ${String(done.objectives[0]?.failureReason)}`);
  line(`tokens consumed : ${done.budgetUsage.tokensConsumed}`);
  line(`cost consumed   : ${done.budgetUsage.costUsdConsumed}`);
  line();
  line(
    `registered provider ids: ${(orchestratorRef.listProviders?.().providers ?? []).map((p) => p.id).join(', ')}`,
  );
  line('provider attempts (in order):');
  record.attempts.forEach((a, i) => {
    line(`  ${i + 1}. ${a}`);
  });
  line('failed executions:');
  record.errors.forEach((e) => {
    line(`  - ${e.provider}: ${e.message.slice(0, 120)}`);
  });
  line('successful executions:');
  record.successes.forEach((s) => {
    line(
      `  - ${s.adapter} → provider=${s.provider} model=${s.model} tokens=${String(s.tokens)} cost=${String(s.cost)}`,
    );
  });

  const failedFirst = record.errors.some((e) => e.provider.includes('ar-broken-primary'));
  const succeededFallback = record.successes.some((s) => s.provider === 'google');
  const mockUsed = record.attempts.some((a) => a.includes('mock'));
  const artifact = path.join(WORKSPACE, 'cloud-fallback.md');

  // Secret scan over the real mission evidence and the recorded output.
  const haystack = JSON.stringify({
    record,
    objectives: done.objectives.map((o) => o.verifiedOutcome?.evidence ?? []),
  });
  const leaked = SECRET_PATTERN.test(haystack);

  const checks: Array<[string, boolean, string]> = [
    ['first provider genuinely failed', failedFirst, record.errors[0]?.message ?? '(none)'],
    [
      'fallback provider genuinely succeeded',
      succeededFallback,
      [...record.successes].map((s) => s.provider).join(','),
    ],
    ['no MockProvider executed', !mockUsed, record.attempts.join(' → ')],
    ['mission COMPLETED', done.state === 'COMPLETED', done.state],
    ['mission ACHIEVED', done.outcome === 'ACHIEVED', String(done.outcome)],
    ['artifact written', existsSync(artifact), 'cloud-fallback.md'],
    [
      'usage identity recorded (tokens > 0)',
      done.budgetUsage.tokensConsumed > 0,
      String(done.budgetUsage.tokensConsumed),
    ],
    [
      'provider attribution recorded',
      succeededFallback,
      record.successes.map((s) => `${s.provider}/${s.model}`).join(','),
    ],
    ['no secret-shaped material in evidence', !leaked, leaked ? 'LEAK' : 'none'],
  ];

  line();
  line('════ CLOUD FALLBACK CHECKS ════');
  for (const [name, pass, detail] of checks) {
    line(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail.slice(0, 100) : ''}`);
  }
  const allPass = checks.every(([, pass]) => pass);
  line();
  line(allPass ? 'CLOUD FALLBACK = PROVEN' : 'CLOUD FALLBACK = NOT PROVEN');
  return allPass ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(
      'CLOUD FALLBACK HARNESS ERROR:',
      error instanceof Error ? (error.stack ?? error.message) : error,
    );
    process.exit(3);
  });

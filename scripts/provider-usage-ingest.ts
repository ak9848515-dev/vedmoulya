// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Provider Usage & Billing Ingestion Job (operator CLI)
//
// Probes the REAL usage/billing endpoints of every CONFIGURED provider account
// and writes the results into the SAME registry health snapshot the AI
// Providers UI reads (quotaUsedPercent via recordHealthSample). Designed to be
// run on a schedule (cron / CI) by an operator.
//
// HONESTY (same contract as the ingestor service):
//   • quota percentages are written ONLY when the provider reports a real
//     bounded quota (OpenAI hard USD limit, OpenRouter credit limit);
//   • prepaid-balance-only providers (DeepSeek) get a plain "checked" sample;
//   • providers with no usage/billing endpoint (Gemini API keys, Anthropic)
//     are reported as NO_PROBE and their quota stays "Usage unavailable";
//   • probe failures are reported and never degrade provider health.
//
// Requirements (operator):
//   export AI_OPENAI_API_KEY=sk-...    (probed via dashboard/billing)
//   export AI_DEEPSEEK_API_KEY=sk-...  (probed via /user/balance)
//   Persistence: run with NODE_ENV=production or staging + DATABASE_URL so the
//   samples land in the Postgres provider registry the gateway reads. Without
//   a strict NODE_ENV the registry factory uses its deterministic in-memory
//   seed (dev/test) — fine for local exercise, not for production writes.
//
// Run:   npm run provider:usage:ingest
// Result: JSON summary (exit 0). Individual probe failures exit 0 too — an
//         honest "no data" is not a job failure.
// ─────────────────────────────────────────────────────────────────────────────

import { ProviderApplicationService } from '@vedmoulya/providers';
import { ProviderUsageIngestor } from '../services/api/src/services/ProviderUsageIngestor.js';
import { createProductionProviderRepository } from '../services/api/src/infrastructure/ProductionRepositories.js';

function section(title: string): void {
  console.log('');
  console.log(`── ${title} ${'─'.repeat(Math.max(0, 64 - title.length))}`);
}

async function main(): Promise<void> {
  console.log('VedMoulya — Provider Usage & Billing Ingestion');
  const env = process.env;
  const strict = env.NODE_ENV === 'production' || env.NODE_ENV === 'staging';
  console.log(
    `Mode: ${strict ? 'strict (' + (env.NODE_ENV ?? '') + ') — Postgres registry' : 'development/test — in-memory registry (samples do NOT persist across processes; use NODE_ENV=production + DATABASE_URL for real writes)'}`,
  );

  const repository = createProductionProviderRepository();
  const providers = new ProviderApplicationService(repository);
  const ingestor = new ProviderUsageIngestor({ providers });

  section('Ingesting provider usage/billing');
  const report = await ingestor.run(env);

  for (const entry of report.entries) {
    console.log(`  ${entry.family.padEnd(12)} → ${entry.outcome.padEnd(16)} ${entry.detail}`);
  }

  section('RESULT');
  console.log(
    JSON.stringify(
      {
        at: report.at,
        entries: report.entries.map((e) => ({
          family: e.family,
          outcome: e.outcome,
          detail: e.detail,
        })),
        quotaSamplesWritten: report.quotaSamplesWritten,
        checkedSamplesWritten: report.checkedSamplesWritten,
      },
      null,
      2,
    ),
  );
  console.log('');
  if (report.quotaSamplesWritten === 0 && report.checkedSamplesWritten === 0) {
    console.log(
      'ℹ No samples written — configure provider keys (AI_OPENAI_API_KEY / AI_DEEPSEEK_API_KEY) to ingest. ' +
        'Providers without real usage/billing endpoints (Gemini, Anthropic) stay honestly unavailable.',
    );
  }
}

main().catch((error: unknown) => {
  console.error('✗ Provider usage ingestion FAILED:');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

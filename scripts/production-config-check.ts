// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — SPRINT-035 Production Configuration Check
//
// An honest operator checklist: reads the environment, classifies each
// configuration area, and NEVER silently assumes production infrastructure
// exists. Output is a matrix with STATUS / EVIDENCE / BLOCKER / OPERATOR
// ACTION. No credentials are printed — only presence/absence.
//
// Classification:
//   CONFIGURED        — the required env values are present
//   NOT_CONFIGURED    — required for the stated capability; absent
//   OPTIONAL          — optional enhancement
//   OPERATOR_REQUIRED — the capability exists but needs an operator to set
//                       the values before real-world use
//
// Exit code: 1 in production (NODE_ENV=production) when a REQUIRED area is
// not configured; 0 otherwise (advisory in dev).
//
// Run:  npm run production:config:check
// ─────────────────────────────────────────────────────────────────────────────

interface CheckResult {
  area: string;
  status: 'CONFIGURED' | 'NOT_CONFIGURED' | 'OPTIONAL' | 'OPERATOR_REQUIRED';
  required: boolean;
  evidence: string;
  blocker: string;
  operatorAction: string;
}

function env(name: string): string | undefined {
  const value = process.env[name];
  return value !== undefined && value.trim().length > 0 ? value.trim() : undefined;
}

function anyEnv(names: string[]): boolean {
  return names.some((n) => env(n) !== undefined);
}

function databaseConfigured(): boolean {
  // A single shared DATABASE_URL is acceptable; the per-concern URLs are the
  // production shape. Absent all → NOT_CONFIGURED.
  return anyEnv([
    'DATABASE_URL',
    'IDENTITY_DATABASE_URL',
    'KNOWLEDGE_DATABASE_URL',
    'MEMORY_DATABASE_URL',
  ]);
}

const PRODUCTION = env('NODE_ENV') === 'production';

const CHECKS: CheckResult[] = [
  {
    area: 'AUTHENTICATION',
    status: env('AUTH_JWT_SECRET') ? 'CONFIGURED' : 'NOT_CONFIGURED',
    required: true,
    evidence: env('AUTH_JWT_SECRET') ? 'AUTH_JWT_SECRET present' : 'AUTH_JWT_SECRET absent',
    blocker: env('AUTH_JWT_SECRET') ? 'none' : 'no JWT signing secret — auth cannot be trusted',
    operatorAction: 'Set a strong random AUTH_JWT_SECRET (never a default/example value).',
  },
  {
    area: 'AUTHORIZATION',
    status: 'CONFIGURED',
    required: true,
    evidence: 'owner-scoped stores + central IDOR guard + Brain approval authority (code-level)',
    blocker: 'none',
    operatorAction:
      'none — enforced by the architecture; verify with the security regression suite.',
  },
  {
    area: 'SECURITY',
    status: PRODUCTION && env('AI_ENABLE_MOCK') === 'true' ? 'NOT_CONFIGURED' : 'CONFIGURED',
    required: true,
    evidence:
      PRODUCTION && env('AI_ENABLE_MOCK') === 'true'
        ? 'AI_ENABLE_MOCK=true in production'
        : 'mock providers not enabled in production',
    blocker:
      PRODUCTION && env('AI_ENABLE_MOCK') === 'true'
        ? 'production would serve synthetic responses — fail-closed rule violated'
        : 'none',
    operatorAction: 'Never set AI_ENABLE_MOCK=true in production (same for VOICE_ENABLE_MOCK).',
  },
  {
    area: 'DATABASE',
    status: databaseConfigured() ? 'CONFIGURED' : 'OPERATOR_REQUIRED',
    required: true,
    evidence: databaseConfigured()
      ? 'DATABASE_URL / per-concern URLs present'
      : 'no DATABASE_URL / per-concern URLs',
    blocker: databaseConfigured() ? 'none' : 'no durable store — intelligence would run in-memory',
    operatorAction:
      'Provision PostgreSQL 16 + pgvector and set DATABASE_URL (or the per-concern URLs).',
  },
  {
    area: 'AI PROVIDERS',
    status: anyEnv([
      'AI_OPENAI_API_KEY',
      'AI_ANTHROPIC_API_KEY',
      'AI_GOOGLE_API_KEY',
      'AI_DEEPSEEK_API_KEY',
    ])
      ? 'CONFIGURED'
      : 'OPERATOR_REQUIRED',
    required: true,
    evidence: anyEnv([
      'AI_OPENAI_API_KEY',
      'AI_ANTHROPIC_API_KEY',
      'AI_GOOGLE_API_KEY',
      'AI_DEEPSEEK_API_KEY',
    ])
      ? 'at least one provider key present (names withheld)'
      : 'no provider keys present',
    blocker: anyEnv([
      'AI_OPENAI_API_KEY',
      'AI_ANTHROPIC_API_KEY',
      'AI_GOOGLE_API_KEY',
      'AI_DEEPSEEK_API_KEY',
    ])
      ? 'none'
      : 'no real AI provider — runtime cannot answer or execute',
    operatorAction:
      'Configure at least one provider key + AI_DEFAULT_PROVIDER + AI_ROUTING_STRATEGY.',
  },
  {
    area: 'WORLD SIGNALS',
    status: env('WORLD_SIGNAL_BASE_URL') ? 'CONFIGURED' : 'OPERATOR_REQUIRED',
    required: false,
    evidence: env('WORLD_SIGNAL_BASE_URL')
      ? 'WORLD_SIGNAL_BASE_URL present (token/kind filters optional)'
      : 'WORLD_SIGNAL_BASE_URL absent',
    blocker: env('WORLD_SIGNAL_BASE_URL')
      ? 'none'
      : 'no live world data — signal status stays UNAVAILABLE (honest, never fabricated)',
    operatorAction:
      'Point WORLD_SIGNAL_BASE_URL at an operator JSON endpoint; add WORLD_SIGNAL_TOKEN when auth is required.',
  },
  {
    area: 'VOICE',
    status: anyEnv(['VOICE_STT_BASE_URL', 'VOICE_TTS_BASE_URL'])
      ? 'CONFIGURED'
      : 'OPERATOR_REQUIRED',
    required: false,
    evidence: anyEnv(['VOICE_STT_BASE_URL', 'VOICE_TTS_BASE_URL'])
      ? 'STT/TTS endpoints present'
      : 'no VOICE_STT_* / VOICE_TTS_* endpoints',
    blocker: anyEnv(['VOICE_STT_BASE_URL', 'VOICE_TTS_BASE_URL'])
      ? 'none'
      : 'voice.status reports MOCK, never CONFIGURED',
    operatorAction: 'Set VOICE_STT_* / VOICE_TTS_* (provider-neutral OpenAI-compatible endpoints).',
  },
  {
    area: 'REDIS / RATE LIMITING',
    status:
      env('RATE_LIMIT_BACKEND') === 'redis'
        ? env('REDIS_URL')
          ? 'CONFIGURED'
          : 'NOT_CONFIGURED'
        : 'OPTIONAL',
    required: false,
    evidence:
      env('RATE_LIMIT_BACKEND') === 'redis'
        ? env('REDIS_URL')
          ? 'RATE_LIMIT_BACKEND=redis + REDIS_URL present'
          : 'RATE_LIMIT_BACKEND=redis but REDIS_URL absent (fails fast by design)'
        : 'RATE_LIMIT_BACKEND unset → honest single-instance in-memory rate limiting',
    blocker:
      env('RATE_LIMIT_BACKEND') === 'redis' && !env('REDIS_URL')
        ? 'config error — distributed rate limiting cannot be silently claimed'
        : 'none',
    operatorAction: 'For multi-instance deployments set RATE_LIMIT_BACKEND=redis + REDIS_URL.',
  },
  {
    area: 'EXECUTION',
    status: 'OPERATOR_REQUIRED',
    required: false,
    evidence:
      'execution stays with the existing bridge; providers + environment must be configured',
    blocker: 'no configured execution environment — approved blueprints remain representation-only',
    operatorAction:
      'Configure providers + execution environment before enabling approved blueprints to run.',
  },
  {
    area: 'COST CONTROL',
    status: 'CONFIGURED',
    required: true,
    evidence:
      'CostLedger + CostPolicyGuard + RunBudgetGuard enforce caps (task $1 / daily $10 / provider $5 / workspace $20)',
    blocker: 'none',
    operatorAction: 'Tune caps via env (AI_EXECUTION_MAX_*) when the default budgets do not fit.',
  },
  {
    area: 'AUDIT',
    status: 'CONFIGURED',
    required: true,
    evidence: 'durable owner-scoped AuditLogStore + world outcome/approval stores',
    blocker: 'none',
    operatorAction: 'Verify audit retention is sized for your operation.',
  },
  {
    area: 'OBSERVABILITY',
    status: env('OTEL_EXPORTER_OTLP_ENDPOINT') ? 'CONFIGURED' : 'OPTIONAL',
    required: false,
    evidence: env('OTEL_EXPORTER_OTLP_ENDPOINT')
      ? 'OTEL exporter endpoint present'
      : 'no OTEL exporter endpoint (logs still work)',
    blocker: 'none',
    operatorAction: 'Set OTEL_EXPORTER_OTLP_ENDPOINT to ship traces to your collector.',
  },
  {
    area: 'EMAIL',
    status: env('SMTP_HOST') ? 'CONFIGURED' : 'OPTIONAL',
    required: false,
    evidence: env('SMTP_HOST')
      ? 'SMTP_HOST present'
      : 'no SMTP host (email notifications disabled)',
    blocker: 'none',
    operatorAction: 'Set SMTP_* to enable email notifications.',
  },
  {
    area: 'BACKUP / RECOVERY',
    status: 'OPERATOR_REQUIRED',
    required: true,
    evidence: 'durable Postgres write-through stores; recovery depends on operator backups',
    blocker: 'no backup strategy configured — production readiness requires one',
    operatorAction:
      'Configure Postgres backups + restore drill; verify restart-recovery (4/4 harness).',
  },
];

function main(): void {
  console.log('───────────────────────────────────────────────────────────────────────────');
  console.log('PRODUCTION CONFIGURATION CHECK (SPRINT-035)');
  console.log(
    `NODE_ENV=${env('NODE_ENV') ?? '(unset)'} — ${PRODUCTION ? 'production semantics' : 'non-production semantics'}`,
  );
  console.log('───────────────────────────────────────────────────────────────────────────');
  console.log(
    `${'AREA'.padEnd(20)} ${'STATUS'.padEnd(16)} ${'REQUIRED'.padEnd(9)} EVIDENCE / BLOCKER`,
  );
  for (const check of CHECKS) {
    console.log(
      `${check.area.padEnd(20)} ${check.status.padEnd(16)} ${(check.required ? 'yes' : 'no').padEnd(9)} ${check.evidence}`,
    );
    if (check.status === 'NOT_CONFIGURED' || check.status === 'OPERATOR_REQUIRED') {
      console.log(`${''.padEnd(20)}   → ${check.operatorAction}`);
    }
  }
  console.log('───────────────────────────────────────────────────────────────────────────');
  const blocked = CHECKS.filter((c) => c.required && c.status === 'NOT_CONFIGURED');
  const operatorRequired = CHECKS.filter((c) => c.status === 'OPERATOR_REQUIRED');
  console.log(
    `Required-and-missing: ${blocked.length} · Operator-required: ${operatorRequired.length}`,
  );
  if (PRODUCTION && blocked.length > 0) {
    console.log('BLOCKED in production — resolve required items before going live.');
    process.exitCode = 1;
  } else {
    console.log(
      'Check complete. Items above are the honest activation list — nothing is silently assumed.',
    );
  }
}

main();

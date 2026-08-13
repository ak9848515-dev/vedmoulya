// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — PreflightEngine Tests (EPIC-018)
// Deterministic scenarios: valid dev, valid prod, missing JWT, missing AI,
// missing DB, unavailable Docker, missing build, provider fallback, config
// evaluation, secret-leak guards, env-file loading, failure UX.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PreflightEngine, loadEnvFileSafe, loadEnvFilesSafe } from '../preflight.js';
import type { PreflightEnvironment, PreflightMode } from '../preflight.js';

function makeEnvironment(
  overrides: Partial<PreflightEnvironment> & { mode?: PreflightMode } = {},
): PreflightEnvironment {
  return {
    mode: 'development',
    env: {},
    evaluateConfig: () => ({ ok: true }),
    dockerAvailable: () => true,
    productionBuildExists: () => true,
    ...overrides,
  };
}

function run(env: PreflightEnvironment) {
  return new PreflightEngine({ environment: env }).run();
}

function findCheck(report: ReturnType<typeof run>, id: string) {
  const check = report.checks.find((c) => c.id === id);
  if (!check) throw new Error(`missing check ${id}`);
  return check;
}

describe('PreflightEngine — development mode', () => {
  it('valid development environment is READY (in-memory convention, mock AI)', () => {
    const report = run(
      makeEnvironment({
        mode: 'development',
        env: { AUTH_JWT_SECRET: 'x'.repeat(48), NODE_ENV: 'development' },
        dockerAvailable: () => false,
        productionBuildExists: () => false,
      }),
    );
    expect(report.ready).toBe(true);
    expect(report.blocked).toBe(false);
    // Optional gaps are surfaced but never block development.
    expect(findCheck(report, 'docker').status).toBe('NOT_CONFIGURED');
    expect(findCheck(report, 'docker').required).toBe(false);
    expect(findCheck(report, 'database').status).toBe('NOT_CONFIGURED');
    expect(findCheck(report, 'production-build').status).toBe('READY'); // n/a in dev
    expect(findCheck(report, 'ai-configuration').status).toBe('NOT_CONFIGURED');
    expect(findCheck(report, 'provider-registry').status).toBe('READY'); // mock registered
  });

  it('missing AUTH_JWT_SECRET blocks development with an actionable message', () => {
    const report = run(makeEnvironment({ mode: 'development', env: {} }));
    expect(report.ready).toBe(false);
    expect(report.blocked).toBe(true);
    const auth = findCheck(report, 'authentication');
    expect(auth.status).toBe('MISCONFIGURED');
    expect(auth.required).toBe(true);
    expect(auth.howToFix).toContain('crypto').and.toContain('randomBytes');
  });

  it('a failing config evaluation is reported as MISCONFIGURED with the original error', () => {
    const report = run(
      makeEnvironment({
        mode: 'development',
        env: {},
        evaluateConfig: () => ({
          ok: false,
          error: 'EnvironmentError: AUTH_JWT_SECRET is required',
        }),
      }),
    );
    const envCheck = findCheck(report, 'environment');
    expect(envCheck.status).toBe('MISCONFIGURED');
    expect(envCheck.detail).toContain('AUTH_JWT_SECRET');
    expect(report.blocked).toBe(true);
  });
});

describe('PreflightEngine — production mode', () => {
  it('valid production environment is READY', () => {
    const report = run(
      makeEnvironment({
        mode: 'production',
        env: {
          AUTH_JWT_SECRET: 'x'.repeat(48),
          AI_OPENAI_API_KEY: 'sk-prod-abcdefghijklmnopqrstuvwxyz123456789',
          IDENTITY_DATABASE_URL: 'postgres://u:p@db.prod.internal:5432/vm',
          REDIS_URL: 'redis://u:p@redis.prod.internal:6379',
        },
        dockerAvailable: () => true,
        productionBuildExists: () => true,
      }),
    );
    expect(report.ready).toBe(true);
    expect(findCheck(report, 'ai-configuration').status).toBe('READY');
    expect(findCheck(report, 'database').status).toBe('READY');
    expect(findCheck(report, 'production-build').status).toBe('READY');
  });

  it('missing AI key blocks production (no silent mock) and provides the fix', () => {
    const report = run(
      makeEnvironment({
        mode: 'production',
        env: {
          AUTH_JWT_SECRET: 'x'.repeat(48),
          IDENTITY_DATABASE_URL: 'postgres://u:p@db.prod.internal:5432/vm',
          REDIS_URL: 'redis://u:p@redis.prod.internal:6379',
        },
        dockerAvailable: () => true,
        productionBuildExists: () => true,
      }),
    );
    expect(report.blocked).toBe(true);
    const ai = findCheck(report, 'ai-configuration');
    expect(ai.status).toBe('MISCONFIGURED');
    expect(ai.required).toBe(true);
    expect(ai.howToFix).toContain('AI_OPENAI_API_KEY');
    expect(findCheck(report, 'provider-registry').status).toBe('BLOCKED');
  });

  it('AI_DEEPSEEK_API_KEY is accepted as a real production provider (READY, AI_DEFAULT_PROVIDER=deepseek)', () => {
    const report = run(
      makeEnvironment({
        mode: 'production',
        env: {
          AUTH_JWT_SECRET: 'x'.repeat(48),
          AI_DEEPSEEK_API_KEY: 'sk-ds-prod-abcdefghijklmnopqrstuvwxyz',
          IDENTITY_DATABASE_URL: 'postgres://u:p@db.prod.internal:5432/vm',
          REDIS_URL: 'redis://u:p@redis.prod.internal:6379',
        },
        dockerAvailable: () => true,
        productionBuildExists: () => true,
      }),
    );
    expect(findCheck(report, 'ai-configuration').status).toBe('READY');
    expect(findCheck(report, 'provider-registry').status).toBe('READY');
    expect(report.ready).toBe(true);
  });

  it('AI_ENABLE_MOCK=true is accepted as an explicit production opt-in (DEGRADED, not blocked)', () => {
    const report = run(
      makeEnvironment({
        mode: 'production',
        env: {
          AUTH_JWT_SECRET: 'x'.repeat(48),
          AI_ENABLE_MOCK: 'true',
          IDENTITY_DATABASE_URL: 'postgres://u:p@db.prod.internal:5432/vm',
          REDIS_URL: 'redis://u:p@redis.prod.internal:6379',
        },
        dockerAvailable: () => true,
        productionBuildExists: () => true,
      }),
    );
    expect(findCheck(report, 'ai-configuration').status).toBe('DEGRADED');
    expect(findCheck(report, 'provider-registry').status).toBe('READY');
    expect(report.ready).toBe(true);
  });

  it('missing database URL blocks production and distinguishes MISCONFIGURED from DEPENDENCY_UNAVAILABLE', () => {
    const report = run(
      makeEnvironment({
        mode: 'production',
        env: {
          AUTH_JWT_SECRET: 'x'.repeat(48),
          AI_OPENAI_API_KEY: 'sk-prod-abcdefghijklmnopqrstuvwxyz123456789',
          REDIS_URL: 'redis://u:p@redis.prod.internal:6379',
        },
        dockerAvailable: () => true,
        productionBuildExists: () => true,
      }),
    );
    expect(findCheck(report, 'database').status).toBe('MISCONFIGURED');
    expect(report.blocked).toBe(true);
  });

  it('loopback database URL is rejected in production (fail-fast preserved)', () => {
    const report = run(
      makeEnvironment({
        mode: 'production',
        env: {
          AUTH_JWT_SECRET: 'x'.repeat(48),
          AI_OPENAI_API_KEY: 'sk-prod-abcdefghijklmnopqrstuvwxyz123456789',
          IDENTITY_DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/vm',
          REDIS_URL: 'redis://u:p@redis.prod.internal:6379',
        },
        dockerAvailable: () => true,
        productionBuildExists: () => true,
      }),
    );
    expect(findCheck(report, 'database').status).toBe('MISCONFIGURED');
    expect(findCheck(report, 'database').why).toMatch(/localhost|loopback/i);
  });

  it('unavailable Docker marks stores DEPENDENCY_UNAVAILABLE and blocks production', () => {
    const report = run(
      makeEnvironment({
        mode: 'production',
        env: {
          AUTH_JWT_SECRET: 'x'.repeat(48),
          AI_OPENAI_API_KEY: 'sk-prod-abcdefghijklmnopqrstuvwxyz123456789',
          IDENTITY_DATABASE_URL: 'postgres://u:p@db.prod.internal:5432/vm',
          REDIS_URL: 'redis://u:p@redis.prod.internal:6379',
        },
        dockerAvailable: () => false,
        productionBuildExists: () => true,
      }),
    );
    expect(findCheck(report, 'docker').status).toBe('DEPENDENCY_UNAVAILABLE');
    expect(findCheck(report, 'database').status).toBe('DEPENDENCY_UNAVAILABLE');
    expect(findCheck(report, 'redis').status).toBe('DEPENDENCY_UNAVAILABLE');
    expect(findCheck(report, 'docker').howToFix).toContain('Docker');
    expect(report.blocked).toBe(true);
  });

  it('missing production build is BLOCKED (distinct from misconfiguration)', () => {
    const report = run(
      makeEnvironment({
        mode: 'production',
        env: {
          AUTH_JWT_SECRET: 'x'.repeat(48),
          AI_OPENAI_API_KEY: 'sk-prod-abcdefghijklmnopqrstuvwxyz123456789',
          IDENTITY_DATABASE_URL: 'postgres://u:p@db.prod.internal:5432/vm',
          REDIS_URL: 'redis://u:p@redis.prod.internal:6379',
        },
        dockerAvailable: () => true,
        productionBuildExists: () => false,
      }),
    );
    const build = findCheck(report, 'production-build');
    expect(build.status).toBe('BLOCKED');
    expect(build.howToFix).toContain('npm run build -w apps/web');
    expect(report.blocked).toBe(true);
  });
});

describe('PreflightEngine — required flags per mode (from the actual report)', () => {
  it('development requires only environment + authentication', () => {
    const report = run(
      makeEnvironment({
        mode: 'development',
        env: { AUTH_JWT_SECRET: 'x'.repeat(48) },
        dockerAvailable: () => true,
        productionBuildExists: () => true,
      }),
    );
    const required = report.checks
      .filter((c) => c.required)
      .map((c) => c.id)
      .sort();
    expect(required).toEqual(['authentication', 'environment']);
  });

  it('production requires every startup dependency including docker', () => {
    const report = run(
      makeEnvironment({
        mode: 'production',
        env: {
          AUTH_JWT_SECRET: 'x'.repeat(48),
          AI_OPENAI_API_KEY: 'sk-prod-abcdefghijklmnopqrstuvwxyz123456789',
          IDENTITY_DATABASE_URL: 'postgres://u:p@db.prod.internal:5432/vm',
          REDIS_URL: 'redis://u:p@redis.prod.internal:6379',
        },
        dockerAvailable: () => true,
        productionBuildExists: () => true,
      }),
    );
    for (const id of [
      'environment',
      'authentication',
      'database',
      'redis',
      'ai-configuration',
      'provider-registry',
      'production-build',
      'docker',
    ]) {
      expect(findCheck(report, id).required).toBe(true);
    }
  });

  it('missing DeepSeek key with AI_DEFAULT_PROVIDER=deepseek blocks production (no silent mock)', () => {
    const report = run(
      makeEnvironment({
        mode: 'production',
        env: {
          AUTH_JWT_SECRET: 'x'.repeat(48),
          IDENTITY_DATABASE_URL: 'postgres://u:p@db.prod.internal:5432/vm',
          REDIS_URL: 'redis://u:p@redis.prod.internal:6379',
        },
        dockerAvailable: () => true,
        productionBuildExists: () => true,
      }),
    );
    expect(report.blocked).toBe(true);
    expect(findCheck(report, 'ai-configuration').status).toBe('MISCONFIGURED');
    expect(findCheck(report, 'ai-configuration').howToFix).toContain('AI_DEEPSEEK_API_KEY');
    expect(findCheck(report, 'provider-registry').status).toBe('BLOCKED');
  });
});

describe('PreflightEngine — service reachability probe', () => {
  const prodEnv = {
    AUTH_JWT_SECRET: 'x'.repeat(48),
    AI_OPENAI_API_KEY: 'sk-prod-abcdefghijklmnopqrstuvwxyz123456789',
    IDENTITY_DATABASE_URL: 'postgres://u:p@db.prod.internal:5432/vm',
    REDIS_URL: 'redis://u:p@redis.prod.internal:6379',
  };

  it('unreachable store blocks production (DEPENDENCY_UNAVAILABLE)', () => {
    const report = run(
      makeEnvironment({
        mode: 'production',
        env: prodEnv,
        dockerAvailable: () => true,
        productionBuildExists: () => true,
        serviceReachable: (kind) => kind === 'redis', // database unreachable
      }),
    );
    const db = findCheck(report, 'database');
    expect(db.status).toBe('DEPENDENCY_UNAVAILABLE');
    expect(db.detail).toMatch(/not reachable/);
    expect(report.blocked).toBe(true);
  });

  it('reachable stores keep production READY', () => {
    const report = run(
      makeEnvironment({
        mode: 'production',
        env: prodEnv,
        dockerAvailable: () => true,
        productionBuildExists: () => true,
        serviceReachable: () => true,
      }),
    );
    expect(findCheck(report, 'database').status).toBe('READY');
    expect(findCheck(report, 'redis').status).toBe('READY');
    expect(report.ready).toBe(true);
  });

  it('unreachable store never blocks development (soft NOT_CONFIGURED)', () => {
    const report = run(
      makeEnvironment({
        mode: 'development',
        env: {
          AUTH_JWT_SECRET: 'x'.repeat(48),
          IDENTITY_DATABASE_URL: 'postgres://u:p@localhost:5432/vm',
        },
        dockerAvailable: () => true,
        productionBuildExists: () => false,
        serviceReachable: () => false,
      }),
    );
    expect(findCheck(report, 'database').status).toBe('NOT_CONFIGURED');
    expect(report.ready).toBe(true);
  });
});

describe('PreflightEngine — --skip-docker softening (startup continues DEGRADED)', () => {
  const prodEnv = {
    AUTH_JWT_SECRET: 'x'.repeat(48),
    AI_OPENAI_API_KEY: 'sk-prod-abcdefghijklmnopqrstuvwxyz123456789',
    IDENTITY_DATABASE_URL: 'postgres://u:p@db.prod.internal:5432/vm',
    REDIS_URL: 'redis://u:p@redis.prod.internal:6379',
  };

  function runSoftened(overrides: Partial<PreflightEnvironment> = {}) {
    return new PreflightEngine({
      environment: makeEnvironment({
        mode: 'production',
        env: prodEnv,
        dockerAvailable: () => false,
        productionBuildExists: () => true,
        ...overrides,
      }),
      softenInfrastructure: true,
    }).run();
  }

  it('docker unavailable + --skip-docker → DEGRADED warnings, never blocks', () => {
    const report = runSoftened();
    expect(report.ready).toBe(true);
    expect(report.blocked).toBe(false);
    for (const id of ['docker', 'database', 'redis'] as const) {
      const check = findCheck(report, id);
      expect(check.status).toBe('DEGRADED');
      expect(check.required).toBe(false);
    }
  });

  it('--skip-docker softens REACHABILITY only — build, AI key and store-URL checks stay hard', () => {
    const report = new PreflightEngine({
      environment: makeEnvironment({
        mode: 'production',
        env: { AUTH_JWT_SECRET: 'x'.repeat(48) },
        dockerAvailable: () => false,
        productionBuildExists: () => false,
      }),
      softenInfrastructure: true,
    }).run();
    expect(report.blocked).toBe(true);
    expect(findCheck(report, 'production-build').status).toBe('BLOCKED');
    expect(findCheck(report, 'ai-configuration').status).toBe('MISCONFIGURED');
    expect(findCheck(report, 'database').status).toBe('MISCONFIGURED');
    // Softened infra checks are never required — they must not add blockers.
    expect(findCheck(report, 'docker').required).toBe(false);
  });

  it('--skip-docker with Docker up and reachable stores stays READY', () => {
    const report = runSoftened({
      dockerAvailable: () => true,
      serviceReachable: () => true,
    });
    expect(report.ready).toBe(true);
    expect(findCheck(report, 'docker').status).toBe('READY');
    expect(findCheck(report, 'database').status).toBe('READY');
    expect(findCheck(report, 'redis').status).toBe('READY');
  });

  it('without --skip-docker the strict Docker posture is preserved (regression guard)', () => {
    const report = run(
      makeEnvironment({
        mode: 'production',
        env: prodEnv,
        dockerAvailable: () => false,
        productionBuildExists: () => true,
      }),
    );
    expect(findCheck(report, 'docker').status).toBe('DEPENDENCY_UNAVAILABLE');
    expect(findCheck(report, 'docker').required).toBe(true);
    expect(findCheck(report, 'database').status).toBe('DEPENDENCY_UNAVAILABLE');
    expect(report.blocked).toBe(true);
  });
});

describe('PreflightEngine — security (no secret leakage)', () => {
  it('report output never contains environment values', () => {
    const env = makeEnvironment({
      mode: 'production',
      env: {
        AUTH_JWT_SECRET: 'this-is-a-very-secret-jwt-value-abcdefghijklmnop',
        AI_OPENAI_API_KEY: 'sk-test-1234567890',
        IDENTITY_DATABASE_URL: 'postgres://user:supersecretdbpass@db.prod.internal:5432/vm',
        REDIS_URL: 'redis://redisuser:supersecretredispass@redis.prod.internal:6379',
      },
      dockerAvailable: () => true,
      productionBuildExists: () => true,
    });
    const serialized = JSON.stringify(run(env));
    for (const secret of [
      'this-is-a-very-secret-jwt-value-abcdefghijklmnop',
      'sk-test-1234567890',
      'supersecretdbpass',
      'supersecretredispass',
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });
});

describe('loadEnvFileSafe / loadEnvFilesSafe', () => {
  it('skips missing files without error', () => {
    const result = loadEnvFileSafe(join(tmpdir(), `missing-${Date.now()}.env`));
    expect(result.ok).toBe(true);
  });

  it('loads an existing file into process.env and returns no errors', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vm-preflight-'));
    const file = join(dir, 'test.env');
    const key = `VM_PREFLIGHT_TEST_${Date.now()}`;
    writeFileSync(file, `${key}=loaded-value\n`);
    try {
      const before = process.env[key];
      const result = loadEnvFilesSafe([file]);
      expect(result.ok).toBe(true);
      expect(process.env[key]).toBe('loaded-value');
      if (before === undefined) delete process.env[key];
      else process.env[key] = before;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('PreflightEngine — EPIC-019 provider truth scenarios', () => {
  function prodOr(extra: Record<string, string | undefined>) {
    return {
      AUTH_JWT_SECRET: 'x'.repeat(48),
      IDENTITY_DATABASE_URL: 'postgres://u:p@db.prod.internal:5432/vm',
      REDIS_URL: 'redis://u:p@redis.prod.internal:6379',
      ...extra,
    };
  }

  it('AI_DEFAULT_PROVIDER=anthropic blocks production (catalog-only family)', () => {
    const report = run(
      makeEnvironment({
        mode: 'production',
        env: prodOr({
          AI_DEFAULT_PROVIDER: 'anthropic',
          AI_ANTHROPIC_API_KEY: 'sk-ant-abcdefghijklmnopqrstuvwxyz1234567890',
        }),
        dockerAvailable: () => true,
        productionBuildExists: () => true,
      }),
    );
    const ai = findCheck(report, 'ai-configuration');
    expect(ai.status).toBe('MISCONFIGURED');
    expect(ai.detail).toMatch(/catalog/i);
    expect(ai.howToFix).toContain('AI_DEFAULT_PROVIDER=openai');
    expect(report.blocked).toBe(true);
  });

  it('AI_DEFAULT_PROVIDER=mock blocks production (never silent)', () => {
    const report = run(
      makeEnvironment({
        mode: 'production',
        env: prodOr({ AI_DEFAULT_PROVIDER: 'mock', AI_ENABLE_MOCK: 'true' }),
        dockerAvailable: () => true,
        productionBuildExists: () => true,
      }),
    );
    expect(findCheck(report, 'ai-configuration').status).toBe('MISCONFIGURED');
    expect(report.blocked).toBe(true);
  });

  it('an anthropic key ALONE never satisfies production AI (catalog only)', () => {
    const report = run(
      makeEnvironment({
        mode: 'production',
        env: prodOr({ AI_ANTHROPIC_API_KEY: 'sk-ant-abcdefghijklmnopqrstuvwxyz1234567890' }),
        dockerAvailable: () => true,
        productionBuildExists: () => true,
      }),
    );
    expect(findCheck(report, 'ai-configuration').status).toBe('MISCONFIGURED');
    expect(findCheck(report, 'provider-registry').status).toBe('BLOCKED');
    expect(report.blocked).toBe(true);
  });

  it('configured DeepSeek as the declared default is READY in production', () => {
    const report = run(
      makeEnvironment({
        mode: 'production',
        env: prodOr({
          AI_DEFAULT_PROVIDER: 'deepseek',
          AI_DEEPSEEK_API_KEY: 'sk-ds-abcdefghijklmnopqrstuvwxyz123456789',
        }),
        dockerAvailable: () => true,
        productionBuildExists: () => true,
      }),
    );
    expect(findCheck(report, 'ai-configuration').status).toBe('READY');
    expect(findCheck(report, 'provider-registry').status).toBe('READY');
    expect(report.ready).toBe(true);
  });

  it('production with NO real provider and NO mock opt-in stays blocked (no silent mock)', () => {
    const report = run(
      makeEnvironment({
        mode: 'production',
        env: prodOr({}),
        dockerAvailable: () => true,
        productionBuildExists: () => true,
      }),
    );
    expect(findCheck(report, 'ai-configuration').status).toBe('MISCONFIGURED');
    expect(findCheck(report, 'provider-registry').status).toBe('BLOCKED');
    expect(report.blocked).toBe(true);
  });
});

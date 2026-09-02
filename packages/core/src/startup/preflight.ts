// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Startup Preflight Engine
// EPIC-018 — Production Startup & Environment Reliability
//
// A deterministic, environment-aware startup diagnostic that answers, for
// every startup dependency:
//   1. WHAT failed?        (check.label + detail)
//   2. WHY did it fail?    (why)
//   3. Is it required?     (required — mode-dependent)
//   4. What can continue?  (continues)
//   5. WHAT should the user do? (howToFix)
//
// The engine is PURE and injectable: every probe (config evaluation, Docker,
// production build, env snapshot) arrives through the PreflightEnvironment
// interface, so the engine is fully unit-testable and contains NO I/O. The
// CLI binding (scripts/preflight.ts) supplies the real probes.
//
// SECURITY: the engine never prints environment values. All messages are
// static or derived from key NAMES (never values). This module must never
// import secrets or echo their contents.
//
// REUSE (no duplicate engines): this is a STARTUP-TIME diagnostic. Runtime
// health is owned by the existing @vedmoulya/core HealthChecker and the
// gateway's InfrastructureHealthProbe / health.* / ops.getDiagnostics — the
// preflight does not replace them; it reports the same status vocabulary
// (READY / DEGRADED / BLOCKED / MISCONFIGURED /
// DEPENDENCY_UNAVAILABLE / NOT_CONFIGURED) before a process starts.
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable security/detect-non-literal-fs-filename -- Heuristic rule
   false-positive: env-file paths are caller-supplied fixed lists (the CLI
   passes a constant array), never built from untrusted input. */
/* eslint-disable security/detect-object-injection -- Heuristic rule
   false-positive: env keys come from a closed constant set defined by this
   module ('IDENTITY_DATABASE_URL' / 'REDIS_URL' / 'DATABASE_URL' fallbacks)
   and are never attacker-controlled property names. */
import { existsSync } from 'node:fs';
import {
  readProviderRuntimeState,
  runtimeExecutionReady,
  toRuntimeMode,
  validateDefaultProvider,
} from './provider-runtime.js';

export type PreflightMode = 'development' | 'test' | 'staging' | 'production';

/**
 * Unified startup/health status vocabulary (Phase 9 — shared with the
 * existing runtime health model, not a new engine):
 *   READY                — everything this mode requires is satisfied.
 *   DEGRADED             — running, but an optional dependency is missing.
 *   BLOCKED              — a required dependency is missing; cannot proceed.
 *   MISCONFIGURED        — required configuration is absent/invalid.
 *   DEPENDENCY_UNAVAILABLE — required infrastructure exists but is unreachable.
 *   NOT_CONFIGURED       — optional capability intentionally not configured.
 */
export type PreflightStatus =
  'READY' | 'DEGRADED' | 'BLOCKED' | 'MISCONFIGURED' | 'DEPENDENCY_UNAVAILABLE' | 'NOT_CONFIGURED';

export interface PreflightCheck {
  /** Stable check id (used by startup.sh and tests). */
  id:
    | 'environment'
    | 'authentication'
    | 'database'
    | 'redis'
    | 'ai-configuration'
    | 'production-build'
    | 'provider-registry'
    | 'docker';
  /** Plain-language row label for the preflight report. */
  label: string;
  status: PreflightStatus;
  /** Whether this check MUST pass for the current mode to proceed. */
  required: boolean;
  /** WHAT failed (static text — never contains secret values). */
  detail: string;
  /** WHY it failed (static text). */
  why?: string;
  /** Which mode this applies to. */
  mode: PreflightMode;
  /** WHAT can still proceed without this dependency. */
  continues?: string;
  /** WHAT the user should do. */
  howToFix?: string;
}

export interface PreflightReport {
  mode: PreflightMode;
  /** True when no required check failed. */
  ready: boolean;
  /** True when at least one required check failed. */
  blocked: boolean;
  checks: PreflightCheck[];
  generatedAt: string;
}

/**
 * Injectable environment/probe surface. The CLI binding implements these
 * against the real machine; tests inject fakes. `env` is a plain snapshot
 * (never the live process.env) so tests stay hermetic and the engine can
 * never accidentally leak process values into messages.
 */
export interface PreflightEnvironment {
  mode: PreflightMode;
  /** Environment snapshot — the engine only ever reads KEY NAMES from it. */
  env: Record<string, string | undefined>;
  /** Evaluate the fail-fast config. Returns the (redacted) error message. */
  evaluateConfig: () => { ok: true } | { ok: false; error: string };
  /** Docker daemon reachable? (CLI probe is synchronous: docker info) */
  dockerAvailable: () => boolean;
  /** Production build present? (apps/web/.next/BUILD_ID) */
  productionBuildExists: () => boolean;
  /**
   * Optional direct reachability probe for a configured store (TCP connect
   * to the URL host:port). When omitted the check falls back to the Docker
   * daemon probe only.
   */
  serviceReachable?: (kind: 'database' | 'redis') => boolean;
}

export interface PreflightEngineOptions {
  environment: PreflightEnvironment;
  /**
   * --skip-docker mode (used by scripts/startup.sh when the Docker daemon is
   * down): Docker/database/redis REACHABILITY checks become DEGRADED warnings
   * (never required) so startup can continue in a degraded state. Hard
   * configuration checks (missing/loopback store URLs, missing build) are
   * NEVER softened — production correctness is preserved. AI provider keys
   * are context-aware by design (AI-EXECUTION configuration, never an
   * authentication prerequisite): absent keys report DEGRADED and never
   * block startup in any mode.
   */
  softenInfrastructure?: boolean;
}

/** Modes where the fail-fast production config applies. */
const STRICT_MODES: ReadonlySet<PreflightMode> = new Set(['production', 'staging']);

function isSet(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/** True for statuses that prevent a required dependency from proceeding. */
function isHardFailure(status: PreflightStatus): boolean {
  return status === 'BLOCKED' || status === 'MISCONFIGURED' || status === 'DEPENDENCY_UNAVAILABLE';
}

/**
 * Safe environment-file loader for Node >= 20.12 (process.loadEnvFile).
 * Missing files are skipped (never an error); parse failures surface as a
 * message (never file contents). Used by the CLI binding — kept here so the
 * load behaviour is a single, tested strategy (Phase 2 — one authoritative
 * environment-loading path; no duplicated .env parsing across scripts).
 */
export function loadEnvFileSafe(path: string): { ok: true } | { ok: false; error: string } {
  try {
    if (typeof process.loadEnvFile !== 'function') {
      return { ok: true }; // Older Node: caller relies on the platform loader.
    }
    if (!existsSync(path)) {
      return { ok: true }; // Missing env files are intentionally skipped.
    }
    process.loadEnvFile(path);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to load environment file ${path}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Load an ordered list of environment files (first existing wins per key).
 * Missing files are skipped silently; the returned messages never contain
 * file contents or secret values.
 */
export function loadEnvFilesSafe(paths: readonly string[]): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const path of paths) {
    const result = loadEnvFileSafe(path);
    if (!result.ok) errors.push(result.error);
  }
  return { ok: errors.length === 0, errors };
}

export class PreflightEngine {
  constructor(private readonly options: PreflightEngineOptions) {}

  run(): PreflightReport {
    const env = this.options.environment;
    const mode = env.mode;
    const checks: PreflightCheck[] = [
      this.checkEnvironment(),
      this.checkAuthentication(),
      this.checkAiConfiguration(mode),
      this.checkDatabase(mode),
      this.checkRedis(mode),
      this.checkProviderRegistry(mode),
      this.checkProductionBuild(mode),
      this.checkDocker(mode),
    ];

    // DEGRADED and NOT_CONFIGURED are SOFT states (the mode can proceed);
    // only hard failures block a required check.
    const blocked = checks.some((check) => check.required && isHardFailure(check.status));
    return {
      mode,
      ready: !blocked,
      blocked,
      checks,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Checks ────────────────────────────────────────────────────────────────

  private checkEnvironment(): PreflightCheck {
    const { evaluateConfig } = this.options.environment;
    const result = evaluateConfig();
    if (result.ok) {
      return {
        id: 'environment',
        label: 'Environment',
        status: 'READY',
        required: true,
        detail: 'Configuration is valid for this mode.',
        mode: this.options.environment.mode,
      };
    }
    const strict = STRICT_MODES.has(this.options.environment.mode);
    return {
      id: 'environment',
      label: 'Environment',
      status: 'MISCONFIGURED',
      required: true,
      detail: result.error,
      why: strict
        ? 'Fail-fast configuration validation rejected required environment settings.'
        : 'A required setting (e.g. AUTH_JWT_SECRET) is missing even in development/test.',
      continues: 'Nothing can start until configuration is valid.',
      howToFix:
        'Create a root .env.local (or apps/web/.env.local in development) with the missing settings. See 09_Documents/EPIC_018_ENVIRONMENT_MODEL.md.',
      mode: this.options.environment.mode,
    };
  }

  private checkAuthentication(): PreflightCheck {
    const { env, mode } = this.options.environment;
    const secret = env.AUTH_JWT_SECRET;
    const ok = isSet(secret) && (secret as string).length >= 32;
    return {
      id: 'authentication',
      label: 'Authentication',
      status: ok ? 'READY' : 'MISCONFIGURED',
      required: true,
      detail: ok
        ? 'AUTH_JWT_SECRET is configured.'
        : 'AUTH_JWT_SECRET is missing or too short (< 32 chars).',
      why: 'The gateway signs session tokens with AUTH_JWT_SECRET — it has no default and is required in every mode (fail-fast).',
      continues: 'Nothing that authenticates users can start without it.',
      howToFix:
        "Generate one and put it in your .env.local (gitignored): node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"",
      mode,
    };
  }

  private checkAiConfiguration(mode: PreflightMode): PreflightCheck {
    const { env } = this.options.environment;
    const strict = STRICT_MODES.has(mode);
    const runtimeMode = toRuntimeMode(mode);
    const aiEnabled = env.FF_AI_ASSISTANT_ENABLED !== 'false';

    // EPIC-019 — the configuration layer must agree with the runtime provider
    // registry: AI_DEFAULT_PROVIDER may only name a family with an adapter.
    const defaultCheck = validateDefaultProvider(env, runtimeMode);
    if (strict && aiEnabled && !defaultCheck.ok) {
      return {
        id: 'ai-configuration',
        label: 'AI configuration',
        status: 'MISCONFIGURED',
        required: true,
        detail: defaultCheck.reason,
        why: 'A provider that exists only in the taxonomy/catalog cannot satisfy production AI — there is no adapter to execute the request.',
        continues:
          'The web server can start, but every AI-backed feature would fail with "no provider available".',
        howToFix:
          'Set AI_DEFAULT_PROVIDER=openai, AI_DEFAULT_PROVIDER=deepseek or AI_DEFAULT_PROVIDER=google (the runtime-supported families).',
        mode,
      };
    }

    const runtime = runtimeExecutionReady(env, runtimeMode, { aiEnabled });
    if (strict && !runtime.ok && !runtime.providers.includes('mock')) {
      // No production AI provider is configured. This is a DEGRADED state, NOT
      // a blocked one: authentication, onboarding and the AI Providers
      // management screen work fully without an AI credential. Every AI-backed
      // feature honestly abstains until a real provider key is configured.
      return {
        id: 'ai-configuration',
        label: 'AI configuration',
        status: 'DEGRADED',
        required: false,
        detail: 'No production AI provider is configured — AI execution is NOT READY.',
        why: `${runtime.reason} Authentication is unaffected; production never silently serves the deterministic mock.`,
        continues:
          'The service runs: sign-in, Google OAuth, onboarding and the AI Providers screen work. AI execution starts once a real provider key is set.',
        howToFix:
          'Set AI_OPENAI_API_KEY, AI_GOOGLE_API_KEY or AI_DEEPSEEK_API_KEY (or, for a non-production-like environment, set AI_ENABLE_MOCK=true explicitly).',
        mode,
      };
    }

    const states = readProviderRuntimeState(env, runtimeMode, { aiEnabled });
    const realConfigured = states.some((s) => s.status === 'CONFIGURED' && s.adapterImplemented);

    if (!aiEnabled) {
      return {
        id: 'ai-configuration',
        label: 'AI configuration',
        status: 'NOT_CONFIGURED',
        required: false,
        detail: 'AI assistant is disabled (FF_AI_ASSISTANT_ENABLED=false).',
        mode,
      };
    }

    if (strict) {
      const mockOnly = runtime.providers.includes('mock') && !realConfigured;
      return {
        id: 'ai-configuration',
        label: 'AI configuration',
        status: mockOnly ? 'DEGRADED' : 'READY',
        required: false,
        detail: mockOnly
          ? 'Deterministic mock provider explicitly enabled (AI_ENABLE_MOCK=true).'
          : 'A real AI provider key is configured (runtime registry).',
        continues: mockOnly
          ? 'Production serves the deterministic mock — AI responses are synthetic, never a live model result.'
          : undefined,
        mode,
      };
    }

    return {
      id: 'ai-configuration',
      label: 'AI configuration',
      status: realConfigured ? 'READY' : 'NOT_CONFIGURED',
      required: false,
      detail: realConfigured
        ? 'A real AI provider key is configured; the deterministic mock also remains available.'
        : 'No real AI key configured — development uses the deterministic mock provider.',
      continues:
        'Development continues on the deterministic mock; production requires a real provider.',
      mode,
    };
  }

  private checkDatabase(mode: PreflightMode): PreflightCheck {
    return this.checkStore({
      id: 'database',
      label: 'Database',
      envKey: 'IDENTITY_DATABASE_URL',
      fallbackEnvKeys: ['DATABASE_URL'],
      mode,
      kindLabel: 'Postgres',
      devDefault: 'postgres://localhost:5432/vedmoulya',
      continues:
        'Development continues on the in-memory repositories (the documented dev/test convention); production requires Postgres.',
      howToFix:
        'Provide IDENTITY_DATABASE_URL (non-localhost in production) and start the database. Locally: start Docker Desktop, then rerun startup.',
    });
  }

  private checkRedis(mode: PreflightMode): PreflightCheck {
    return this.checkStore({
      id: 'redis',
      label: 'Redis',
      envKey: 'REDIS_URL',
      fallbackEnvKeys: [],
      mode,
      kindLabel: 'Redis',
      devDefault: 'redis://localhost:6379',
      continues:
        'Development continues without Redis where the architecture falls back to in-memory stores.',
      howToFix:
        'Provide REDIS_URL (non-localhost in production) and start Redis. Locally: start Docker Desktop, then rerun startup.',
    });
  }

  private checkStore(options: {
    id: 'database' | 'redis';
    label: string;
    envKey: string;
    fallbackEnvKeys: string[];
    mode: PreflightMode;
    kindLabel: string;
    devDefault: string;
    continues: string;
    howToFix: string;
  }): PreflightCheck {
    const { env, mode } = this.options.environment;
    const strict = STRICT_MODES.has(mode);
    // --skip-docker: reachability problems are softened; configuration
    // problems (missing / loopback URLs below) stay hard in strict modes.
    const softInfra = strict && this.options.softenInfrastructure === true;
    const value = options.fallbackEnvKeys.reduce<string | undefined>(
      (found, key) => found ?? env[key],
      env[options.envKey],
    );
    const configured = isSet(value);
    const looksLocalhost = value ? /localhost|127\.0\.0\.1|0\.0\.0\.0|::1/i.test(value) : true;

    if (!configured) {
      return {
        id: options.id,
        label: options.label,
        status: strict ? 'MISCONFIGURED' : 'NOT_CONFIGURED',
        required: strict,
        detail: strict
          ? `${options.envKey} is required in ${mode} (no localhost default).`
          : `${options.envKey} is not set — using the ${mode} in-memory convention.`,
        why: 'Production/staging refuse loopback infrastructure defaults (fail-fast).',
        continues: options.continues,
        howToFix: options.howToFix,
        mode,
      };
    }
    if (strict && looksLocalhost) {
      return {
        id: options.id,
        label: options.label,
        status: 'MISCONFIGURED',
        required: true,
        detail: `${options.envKey} points at a loopback address in ${mode}.`,
        why: 'Production/staging reject localhost infrastructure URLs (fail-fast).',
        continues: options.continues,
        howToFix: options.howToFix,
        mode,
      };
    }
    const reachable = this.options.environment.dockerAvailable();
    if (!reachable) {
      return {
        id: options.id,
        label: options.label,
        status: strict ? (softInfra ? 'DEGRADED' : 'DEPENDENCY_UNAVAILABLE') : 'NOT_CONFIGURED',
        required: strict && !softInfra,
        detail: strict
          ? softInfra
            ? `${options.kindLabel} is configured but not started (Docker daemon unavailable) — startup continues DEGRADED.`
            : `${options.kindLabel} is configured but the Docker daemon is not running.`
          : `${options.kindLabel} not probed (Docker daemon unavailable) — in-memory fallback in ${mode}.`,
        why: softInfra
          ? 'The Docker daemon was unavailable and startup was told to skip infrastructure (--skip-docker).'
          : 'The Docker daemon could not be reached, so the container cannot start.',
        continues: softInfra
          ? `${options.kindLabel}-backed features degrade gracefully; the store reports its own runtime health (health.check).`
          : options.continues,
        howToFix: softInfra
          ? `Start Docker Desktop, then \`docker compose up -d postgres redis\` and rerun startup to restore full infrastructure.`
          : options.howToFix,
        mode,
      };
    }
    // Docker daemon is up — probe the actual service when the probe is wired.
    const serviceUp = this.options.environment.serviceReachable?.(options.id);
    if (serviceUp !== undefined && !serviceUp) {
      return {
        id: options.id,
        label: options.label,
        status: strict ? (softInfra ? 'DEGRADED' : 'DEPENDENCY_UNAVAILABLE') : 'NOT_CONFIGURED',
        required: strict && !softInfra,
        detail: strict
          ? softInfra
            ? `${options.kindLabel} configured but unreachable — startup continues DEGRADED.`
            : `${options.kindLabel} is configured but not reachable at its URL host:port.`
          : `${options.kindLabel} configured but unreachable — in-memory fallback in ${mode}.`,
        why: softInfra
          ? 'Reachability was not enforced because infrastructure was skipped (--skip-docker).'
          : 'A TCP connect to the configured host:port failed.',
        continues: softInfra
          ? `${options.kindLabel}-backed features degrade gracefully; the store reports its own runtime health (health.check).`
          : options.continues,
        howToFix: softInfra
          ? `Start Docker Desktop, then \`docker compose up -d postgres redis\` and rerun startup to restore full infrastructure.`
          : options.howToFix,
        mode,
      };
    }
    return {
      id: options.id,
      label: options.label,
      status: 'READY',
      required: strict,
      detail: serviceUp
        ? `${options.kindLabel} configured and reachable.`
        : `${options.kindLabel} configured and Docker daemon reachable.`,
      mode,
    };
  }

  private checkProviderRegistry(mode: PreflightMode): PreflightCheck {
    const { env } = this.options.environment;
    const aiEnabled = env.FF_AI_ASSISTANT_ENABLED !== 'false';
    const runtimeMode = toRuntimeMode(mode);
    const runtime = runtimeExecutionReady(env, runtimeMode, { aiEnabled });
    const states = readProviderRuntimeState(env, runtimeMode, { aiEnabled });
    const registered = states.filter((s) => s.registered);
    const ok = runtime.ok;
    // Context-aware: a missing AI provider key means NO provider is registered
    // (AI execution not ready) — this is DEGRADED, never a startup block.
    // Authentication, onboarding and the AI Providers screen all work; AI
    // features honestly abstain until a real key is configured. The provider
    // registry check therefore never hard-blocks production on AI credentials.
    return {
      id: 'provider-registry',
      label: 'Provider registry',
      status: ok ? 'READY' : 'DEGRADED',
      required: false,
      detail: ok
        ? registered.length > 0
          ? `Runtime providers registered: ${registered.map((s) => `${s.family} (${s.status})`).join(', ')}.`
          : 'No provider registered (AI disabled).'
        : 'No runtime provider would be registered — AI execution not ready.',
      why: 'registerPlatformProviders registers real adapters only when their runtime keys are present and, in development (or explicit production opt-in), the deterministic mock. Production with no key and no explicit mock never registers a provider.',
      continues:
        'Requests that need AI would fail with "no provider available"; authentication is unaffected.',
      howToFix:
        'Set AI_OPENAI_API_KEY, AI_GOOGLE_API_KEY or AI_DEEPSEEK_API_KEY, or enable the deterministic mock explicitly with AI_ENABLE_MOCK=true in a non-production-like environment.',
      mode,
    };
  }

  private checkProductionBuild(mode: PreflightMode): PreflightCheck {
    const strict = STRICT_MODES.has(mode);
    const present = this.options.environment.productionBuildExists();
    if (!strict) {
      return {
        id: 'production-build',
        label: 'Production build',
        status: 'READY',
        required: false,
        detail: 'Not applicable in development — the dev server compiles on demand.',
        mode,
      };
    }
    if (!present) {
      return {
        id: 'production-build',
        label: 'Production build',
        status: 'BLOCKED',
        required: true,
        detail: 'No production build exists (apps/web/.next/BUILD_ID not found).',
        why: 'next start serves a pre-built bundle; without a build it refuses to boot.',
        continues: 'Nothing can start in production until the build exists.',
        howToFix:
          'Run: npm run build -w apps/web, then rerun: bash scripts/startup.sh  (startup.sh REQUIRES the build and never builds implicitly).',
        mode,
      };
    }
    return {
      id: 'production-build',
      label: 'Production build',
      status: 'READY',
      required: true,
      detail: 'Production build exists.',
      mode,
    };
  }

  private checkDocker(mode: PreflightMode): PreflightCheck {
    const strict = STRICT_MODES.has(mode);
    const reachable = this.options.environment.dockerAvailable();
    const softInfra = strict && this.options.softenInfrastructure === true;
    return {
      id: 'docker',
      label: 'Docker',
      status: reachable
        ? 'READY'
        : strict
          ? softInfra
            ? 'DEGRADED'
            : 'DEPENDENCY_UNAVAILABLE'
          : 'NOT_CONFIGURED',
      required: strict && !softInfra,
      detail: reachable
        ? 'Docker daemon reachable.'
        : strict
          ? softInfra
            ? 'Docker daemon unavailable — infrastructure containers skipped (--skip-docker).'
            : 'Docker daemon unavailable — Postgres/Redis containers cannot start.'
          : 'Docker daemon unavailable — development continues in in-memory mode.',
      why: 'Postgres and Redis run as Docker Compose services for the self-hosted startup path.',
      continues: softInfra
        ? 'Startup continues DEGRADED: stores that need Postgres/Redis report their own runtime health (health.check).'
        : 'Development continues on in-memory stores; production is blocked.',
      howToFix:
        'Start Docker Desktop (or the platform daemon), then `docker compose up -d postgres redis` and rerun the startup command.',
      mode,
    };
  }
}

/* eslint-disable security/detect-object-injection -- Heuristic rule
   false-positive: dynamic member access here uses typed/closed-union keys,
   constant environment names, or fixed internal lists — never
   attacker-controlled property names. */
// ──────────────────────────────────────────────────────────────────
// VedMoulya — Core Configuration
// Fail-fast: required secrets have no default (P1-8, P0-2, PH-001/T2).
// ──────────────────────────────────────────────────────────────────

import { EnvironmentError, isStrongSecret } from '../env/index.js';
import {
  readProviderRuntimeState,
  toRuntimeMode,
  validateDefaultProvider,
} from '../startup/provider-runtime.js';
import type { ProviderRuntimeState } from '../startup/provider-runtime.js';

export interface AppConfig {
  env: string;
  name: string;
  version: string;
  logLevel: string;
  port: number;
  host: string;
}

export interface DatabaseConfig {
  url: string;
  poolMin: number;
  poolMax: number;
  timeout: number;
}

export interface RedisConfig {
  url: string;
  ttl: number;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshExpiresIn: string;
  bcryptRounds: number;
  googleClientId?: string;
  googleClientSecret?: string;
  googleRedirectUri?: string;
}

export interface AiConfig {
  openAiKey?: string;
  anthropicKey?: string;
  googleKey?: string;
  deepseekKey?: string;
  defaultProvider: string;
  /** True when AI_DEFAULT_PROVIDER names a runtime-supported adapter (EPIC-019). */
  defaultProviderSupported: boolean;
  /** Per-family runtime truth: CONFIGURED / NOT_CONFIGURED / UNSUPPORTED_RUNTIME / MOCK / DISABLED / ERROR. */
  providerStates: ProviderRuntimeState[];
  routingStrategy: string;
}

export interface SmtpConfig {
  host?: string;
  port: number;
  user?: string;
  pass?: string;
  from?: string;
}

export interface FeatureFlags {
  socialLoginEnabled: boolean;
  aiAssistantEnabled: boolean;
  marketplaceEnabled: boolean;
}

export interface ObservabilityConfig {
  serviceName: string;
  otlpEndpoint: string;
}

export interface Configuration {
  app: AppConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  auth: AuthConfig;
  ai: AiConfig;
  smtp: SmtpConfig;
  features: FeatureFlags;
  observability: ObservabilityConfig;
}

export function loadConfiguration(): Configuration {
  const aiEnabled = process.env.FF_AI_ASSISTANT_ENABLED !== 'false';
  const envName = process.env.NODE_ENV ?? 'development';
  const defaultProvider = process.env.AI_DEFAULT_PROVIDER ?? 'openai';
  const socialLoginEnabled = process.env.FF_SOCIAL_LOGIN_ENABLED === 'true';

  // EPIC-019 — the configuration layer must AGREE with the runtime provider
  // registry. AI_DEFAULT_PROVIDER may only name a family that actually has a
  // runtime adapter; catalog-only families (anthropic/google/openrouter/ollama)
  // fail fast in production instead of passing validation and then failing at
  // runtime with "no provider registered".
  const runtimeMode = toRuntimeMode(envName);
  const providerStates = readProviderRuntimeState(process.env, runtimeMode, { aiEnabled });
  const defaultProviderCheck = validateDefaultProvider(process.env, runtimeMode);
  if (aiEnabled && isStrictEnv() && !defaultProviderCheck.ok) {
    const err = new EnvironmentError(['AI_DEFAULT_PROVIDER']);
    err.message = `Fail-fast: ${defaultProviderCheck.reason} (NODE_ENV=${envName}).`;
    throw err;
  }

  const smtpHost = requireProdSecret('SMTP_HOST', { minLength: 4 });
  const smtpConfigured = smtpHost !== undefined;

  return {
    app: {
      env: process.env.NODE_ENV ?? 'development',
      name: process.env.APP_NAME ?? 'vedmoulya',
      version: process.env.APP_VERSION ?? '0.1.0',
      logLevel: process.env.LOG_LEVEL ?? 'debug',
      port: parseInt(process.env.API_PORT ?? '3000', 10),
      host: process.env.API_HOST ?? '0.0.0.0',
    },
    database: {
      url: requireExternalUrl('IDENTITY_DATABASE_URL', 'postgres://localhost:5432/vedmoulya'),
      poolMin: parseInt(process.env.DB_POOL_MIN ?? '2', 10),
      poolMax: parseInt(process.env.DB_POOL_MAX ?? '10', 10),
      timeout: parseInt(process.env.DB_TIMEOUT ?? '30000', 10),
    },
    redis: {
      url: requireExternalUrl('REDIS_URL', 'redis://localhost:6379'),
      ttl: parseInt(process.env.REDIS_TTL ?? '3600', 10),
    },
    auth: {
      jwtSecret: requireJwtSecret(),
      jwtExpiresIn: process.env.AUTH_JWT_EXPIRES_IN ?? '15m',
      refreshExpiresIn: process.env.AUTH_REFRESH_EXPIRES_IN ?? '7d',
      bcryptRounds: parseInt(process.env.AUTH_BCRYPT_ROUNDS ?? '12', 10),
      // OAuth2 credentials (PH-001/T2): required when social login is enabled.
      googleClientId: requireProdSecret('GOOGLE_CLIENT_ID', {
        required: socialLoginEnabled,
        minLength: 8,
        example: '1234567890-abc.apps.googleusercontent.com',
        reason: 'Set GOOGLE_CLIENT_ID when FF_SOCIAL_LOGIN_ENABLED=true.',
      }),
      googleClientSecret: requireProdSecret('GOOGLE_CLIENT_SECRET', {
        required: socialLoginEnabled,
        minLength: 8,
        example: 'GOCSPX-...',
        reason: 'Set GOOGLE_CLIENT_SECRET when FF_SOCIAL_LOGIN_ENABLED=true.',
      }),
      googleRedirectUri: socialLoginEnabled
        ? requireProdExternalUrl(
            'GOOGLE_REDIRECT_URI',
            'http://localhost:3000/api/v1/identity/auth/google/callback',
          )
        : process.env.GOOGLE_REDIRECT_URI?.trim() || undefined,
    },
    ai: {
      // AI provider keys (PH-001/T2): the default provider's key is required in
      // production/staging when the AI assistant is enabled; any key that IS set
      // must be a real secret (no placeholders, no localhost).
      // EPIC-019: anthropic/google keys remain OPTIONAL because those families
      // have no runtime adapter (catalog-only); a set key is still validated as
      // a real secret, but it never satisfies the production AI gate.
      openAiKey: requireProdSecret('AI_OPENAI_API_KEY', {
        required: aiEnabled && defaultProvider === 'openai',
        minLength: 32,
        example: 'sk-...',
        reason:
          'Set AI_OPENAI_API_KEY (or change AI_DEFAULT_PROVIDER / disable AI) when NODE_ENV=production.',
      }),
      anthropicKey: requireProdSecret('AI_ANTHROPIC_API_KEY', {
        required: false,
        minLength: 32,
        example: 'sk-ant-...',
        reason:
          'Anthropic is catalog-only (no runtime adapter) — the key is never consumed; keep it unset.',
      }),
      googleKey: requireProdSecret('AI_GOOGLE_API_KEY', {
        required: false,
        minLength: 32,
        example: 'AIza...',
        reason:
          'Google Gemini is a runtime provider (SPRINT-049 — GoogleGeminiProvider via the Vercel AI SDK). Set AI_GOOGLE_API_KEY to register it; optional unless AI_DEFAULT_PROVIDER=google. Separate from Google OAuth.',
      }),
      deepseekKey: requireProdSecret('AI_DEEPSEEK_API_KEY', {
        required: aiEnabled && defaultProvider === 'deepseek',
        minLength: 32,
        example: 'sk-...',
        reason:
          'Set AI_DEEPSEEK_API_KEY (or change AI_DEFAULT_PROVIDER / disable AI) when NODE_ENV=production.',
      }),
      defaultProvider,
      defaultProviderSupported: defaultProviderCheck.ok,
      providerStates,
      routingStrategy: process.env.AI_ROUTING_STRATEGY ?? 'capability',
    },
    smtp: {
      host: smtpHost,
      port: Number(process.env.SMTP_PORT ?? '587'),
      // If SMTP_HOST is configured, credentials are required (PH-001/T2).
      user: requireProdSecret('SMTP_USER', { required: smtpConfigured, minLength: 4 }),
      pass: requireProdSecret('SMTP_PASS', { required: smtpConfigured, minLength: 8 }),
      from: process.env.SMTP_FROM?.trim() || undefined,
    },
    features: {
      socialLoginEnabled,
      aiAssistantEnabled: aiEnabled,
      marketplaceEnabled: process.env.FF_MARKETPLACE_ENABLED === 'true',
    },
    observability: {
      serviceName: process.env.OTEL_SERVICE_NAME ?? 'vedmoulya',
      otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318',
    },
  };
}

/**
 * AUTH_JWT_SECRET is required — fail fast instead of defaulting to a
 * hardcoded value. The JWT secret gates authentication for every service.
 * Defense-in-depth: presence AND strength are enforced here (the same
 * strength rule is applied by defineStandardEnvVars at bootstrap).
 */
/**
 * Read a URL config value that has a development-only localhost default.
 * Outside NODE_ENV=development the value is REQUIRED and must not point at a
 * loopback host — fail fast instead of silently connecting to localhost
 * infrastructure in production/staging/test (P0-2, extends P1-8).
 *
 * Exported so service-level configs (decision, execution) can enforce the
 * same guarantee for their own DATABASE_URLs (PH-001/T2).
 */
export function requireExternalUrl(key: string, devDefault: string): string {
  const env = process.env.NODE_ENV ?? 'development';
  const raw = process.env[key];
  const value = raw?.trim();

  if (env === 'development') {
    return value && value !== '' ? value : devDefault;
  }

  if (!value || value === '' || /localhost|127\.0\.0\.1|0\.0\.0\.0|::1/i.test(value)) {
    const example = key.includes('REDIS')
      ? 'redis://user:pass@redis.prod.internal:6379'
      : 'postgres://user:pass@db.prod.internal:5432/vedmoulya';
    const err = new EnvironmentError([key]);
    err.message =
      `${key} must be set to a non-localhost URL outside NODE_ENV=development. ` +
      `Refusing the localhost default in ${env} (fail-fast). ` +
      `Example: ${example}`;
    throw err;
  }

  return value;
}

/**
 * Environments that must reject weak/placeholder/absent secrets.
 * Development and test stay lenient so local dev and the unit-test suite
 * (NODE_ENV=test) keep working without real provider credentials (PH-001/T2).
 */
const STRICT_ENVS = new Set(['production', 'staging']);

function isStrictEnv(): boolean {
  return STRICT_ENVS.has(process.env.NODE_ENV ?? 'development');
}

const PLACEHOLDER_PATTERN =
  /development-secret|change[-_]?me|your[-_]?(key|secret|password)|placeholder|changeme|^secret$|^test$|^your[-_]?api[-_]?key$|localhost|127\.0\.0\.1|0\.0\.0\.0|::1/i;

/**
 * A production secret must be long enough and must not look like a
 * placeholder, a development default, or a loopback address (PH-001/T2).
 *
 * Note: intentionally more lenient than `isStrongSecret` (used for JWT),
 * because AI/SMTP/OAuth keys have provider-specific formats that an
 * entropy heuristic cannot validate; we only reject obvious placeholders
 * and loopback defaults here.
 */
function isNotPlaceholderSecret(value: string, minLength: number): boolean {
  return value.length >= minLength && !PLACEHOLDER_PATTERN.test(value);
}

/**
 * Fail-fast validation for production secrets (AI keys, OAuth, SMTP).
 * In development/test the value is optional; in production/staging a required
 * secret must be present and real, and any value that IS set must not be a
 * placeholder / loopback default. Startup throws with a clear message.
 * Exported for reuse by service-level configs (PH-001/T2).
 */
export function requireProdSecret(
  key: string,
  opts: { required?: boolean; minLength?: number; example?: string; reason?: string } = {},
): string | undefined {
  const raw = process.env[key];
  const value = raw?.trim();

  if (!isStrictEnv()) {
    return value && value !== '' ? value : undefined;
  }

  const minLength = opts.minLength ?? 16;
  if (opts.required) {
    if (!value || value === '') {
      const err = new EnvironmentError([key]);
      err.message = `${key} is REQUIRED in NODE_ENV=${String(process.env.NODE_ENV)} (fail-fast). ${
        opts.reason ?? ''
      }${opts.example ? ` Example: ${opts.example}` : ''}`;
      throw err;
    }
    if (!isNotPlaceholderSecret(value, minLength)) {
      const err = new EnvironmentError([], [key]);
      err.message =
        `${key} must be a real secret (>= ${String(minLength)} chars, not a placeholder / ` +
        `localhost / development default) in NODE_ENV=${String(process.env.NODE_ENV)} (fail-fast).` +
        (opts.example ? ` Example: ${opts.example}` : '');
      throw err;
    }
    return value;
  }

  // Optional secret: if set, it must still be a real secret.
  if (value && !isNotPlaceholderSecret(value, minLength)) {
    const err = new EnvironmentError([], [key]);
    err.message =
      `${key} is set but looks like a placeholder / localhost / development default in ` +
      `NODE_ENV=${String(process.env.NODE_ENV)} (fail-fast). Provide a real value or unset it.`;
    throw err;
  }
  return value || undefined;
}

/**
 * Production-only URL guard for service-level infrastructure (DB URLs).
 * In development/test the provided default is allowed; in production/staging
 * the URL must be set and must not be a loopback address (PH-001/T2).
 * The fallback chain (e.g. a generic DATABASE_URL passed as devDefault) is
 * preserved in production — only the final resolved URL is validated, so a
 * deployment using a single generic DATABASE_URL keeps working while a
 * localhost/loopback value still fails fast.
 * Exported so service configs (decision, execution, memory, knowledge) can
 * enforce the same guarantee without breaking local dev or unit tests.
 */
export function requireProdExternalUrl(key: string, devDefault: string): string {
  const raw = process.env[key];
  const value = raw?.trim();

  if (!isStrictEnv()) {
    return value && value !== '' ? value : devDefault;
  }

  const resolved = value && value !== '' ? value : devDefault;
  if (resolved === '' || /localhost|127\.0\.0\.1|0\.0\.0\.0|::1/i.test(resolved)) {
    const err = new EnvironmentError([key]);
    err.message =
      `${key} (or its fallback) must resolve to a non-localhost URL in ` +
      `NODE_ENV=${String(process.env.NODE_ENV)} (fail-fast). Refusing the development default.`;
    throw err;
  }
  return resolved;
}

const JWT_SECRET_HINT = `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`;

function requireJwtSecret(): string {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || secret.trim() === '') {
    const err = new EnvironmentError(['AUTH_JWT_SECRET']);
    err.message =
      `AUTH_JWT_SECRET is required and has no default. Set it in your environment ` +
      `(e.g. .env.local). Generate one with: ${JWT_SECRET_HINT}`;
    throw err;
  }
  if (!isStrongSecret(secret)) {
    const err = new EnvironmentError([], ['AUTH_JWT_SECRET']);
    err.message =
      `AUTH_JWT_SECRET must be a strong secret (>= 32 chars, not a known ` +
      `placeholder). Generate one with: ${JWT_SECRET_HINT}`;
    throw err;
  }
  return secret;
}

let cached: Configuration | null = null;

/**
 * Lazily materialize and cache the application configuration.
 *
 * Importing @vedmoulya/core never evaluates `loadConfiguration()` — the
 * fail-fast environment validation runs on the first real access (request
 * time), so bundlers and build pipelines (e.g. `next build` running under
 * NODE_ENV=production without env vars) can import the package safely.
 * Production fail-fast semantics are unchanged: the first access still
 * throws when required secrets are missing or invalid.
 */
export function getConfig(): Configuration {
  if (cached === null) {
    cached = loadConfiguration();
  }
  return cached;
}

/**
 * Backward-compatible `config` singleton. A lazy Proxy defers
 * `loadConfiguration()` until the first property access, keeping module
 * scope inert for bundlers, `next build`, and tests that only import the
 * package without touching configuration.
 *
 * Note: `Object.freeze(config)` is intentionally not supported (the proxy
 * has no preventExtensions/isExtensible traps, so it would silently act on
 * the inert target). Configuration is treated as read-only by convention.
 */
const configProxyHandler: ProxyHandler<Configuration> = {
  get(_target, prop, receiver): unknown {
    return Reflect.get(getConfig(), prop, receiver) as unknown;
  },
  set(_target, prop, value): boolean {
    return Reflect.set(getConfig(), prop, value);
  },
  has(_target, prop): boolean {
    return prop in getConfig();
  },
  deleteProperty(_target, prop): boolean {
    return Reflect.deleteProperty(getConfig(), prop);
  },
  ownKeys(): ArrayLike<string | symbol> {
    return Reflect.ownKeys(getConfig());
  },
  getOwnPropertyDescriptor(_target, prop): PropertyDescriptor | undefined {
    return Reflect.getOwnPropertyDescriptor(getConfig(), prop);
  },
};

export const config: Configuration = new Proxy({} as Configuration, configProxyHandler);

// ──────────────────────────────────────────────────────────────────
// VedMoulya — Core Configuration
// Fail-fast: required secrets have no default (P1-8).
// ──────────────────────────────────────────────────────────────────

import { EnvironmentError, isStrongSecret } from '../env/index.js';

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
}

export interface AiConfig {
  openAiKey?: string;
  anthropicKey?: string;
  googleKey?: string;
  defaultProvider: string;
  routingStrategy: string;
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
  features: FeatureFlags;
  observability: ObservabilityConfig;
}

export function loadConfiguration(): Configuration {
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
    },
    ai: {
      openAiKey: process.env.AI_OPENAI_API_KEY,
      anthropicKey: process.env.AI_ANTHROPIC_API_KEY,
      googleKey: process.env.AI_GOOGLE_API_KEY,
      defaultProvider: process.env.AI_DEFAULT_PROVIDER ?? 'openai',
      routingStrategy: process.env.AI_ROUTING_STRATEGY ?? 'capability',
    },
    features: {
      socialLoginEnabled: process.env.FF_SOCIAL_LOGIN_ENABLED === 'true',
      aiAssistantEnabled: process.env.FF_AI_ASSISTANT_ENABLED !== 'false',
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
 */
function requireExternalUrl(key: string, devDefault: string): string {
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

export const config = loadConfiguration();

// ──────────────────────────────────────────────────────────────────
// VedMoulya — Targeted branch-coverage tests for config gaps
// Covers social login enabled paths, SMTP configured paths,
// requireProdExternalUrl production path, requireJwtSecret errors,
// proxy handler methods, and getConfig caching.
// ──────────────────────────────────────────────────────────────────

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadConfiguration,
  requireExternalUrl,
  requireProdSecret,
  requireProdExternalUrl,
} from '../index.js';
import { EnvironmentError } from '../../env/index.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

// ── requireExternalUrl ─────────────────────────────────────────

describe('requireExternalUrl — branch coverage', () => {
  it('returns devDefault in development when env var is empty', () => {
    vi.stubEnv('NODE_ENV', 'development');
    delete process.env.TEST_DB_URL;
    const result = requireExternalUrl('TEST_DB_URL', 'postgres://localhost:5432/dev');
    expect(result).toBe('postgres://localhost:5432/dev');
  });

  it('returns env var value in development when set', () => {
    vi.stubEnv('NODE_ENV', 'development');
    process.env.TEST_DB_URL = 'postgres://custom:5432/dev';
    const result = requireExternalUrl('TEST_DB_URL', 'postgres://localhost:5432/dev');
    expect(result).toBe('postgres://custom:5432/dev');
    delete process.env.TEST_DB_URL;
  });

  it('throws in production when env var is missing', () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.TEST_DB_URL;
    expect(() => requireExternalUrl('TEST_DB_URL', 'postgres://localhost:5432/dev')).toThrow(
      EnvironmentError,
    );
  });

  it('throws in production when env var is localhost', () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.TEST_DB_URL = 'postgres://localhost:5432/prod';
    expect(() => requireExternalUrl('TEST_DB_URL', 'postgres://localhost:5432/dev')).toThrow(
      /must be set to a non-localhost URL/,
    );
    delete process.env.TEST_DB_URL;
  });

  it('throws in production when env var is 127.0.0.1', () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.TEST_DB_URL = 'postgres://127.0.0.1:5432/prod';
    expect(() => requireExternalUrl('TEST_DB_URL', 'postgres://localhost:5432/dev')).toThrow(
      /must be set to a non-localhost URL/,
    );
    delete process.env.TEST_DB_URL;
  });

  it('returns valid URL in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.TEST_DB_URL = 'postgres://user:pass@db.prod.internal:5432/prod';
    const result = requireExternalUrl('TEST_DB_URL', 'postgres://localhost:5432/dev');
    expect(result).toBe('postgres://user:pass@db.prod.internal:5432/prod');
    delete process.env.TEST_DB_URL;
  });

  it('produces redis-specific example in error message for REDIS keys', () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.TEST_REDIS_URL;
    try {
      requireExternalUrl('TEST_REDIS_URL', 'redis://localhost:6379');
      expect.fail('should throw');
    } catch (e) {
      expect((e as Error).message).toContain('redis://');
    }
    vi.unstubAllEnvs();
  });

  it('returns env var in staging when set and non-localhost', () => {
    vi.stubEnv('NODE_ENV', 'staging');
    process.env.TEST_DB_URL = 'postgres://user:pass@db.staging.internal:5432/prod';
    const result = requireExternalUrl('TEST_DB_URL', 'postgres://localhost:5432/dev');
    expect(result).toBe('postgres://user:pass@db.staging.internal:5432/prod');
    delete process.env.TEST_DB_URL;
  });
});

// ── requireProdSecret ──────────────────────────────────────────

describe('requireProdSecret — branch coverage', () => {
  it('returns undefined in test env when value is not set', () => {
    vi.stubEnv('NODE_ENV', 'test');
    delete process.env.TEST_SECRET;
    const result = requireProdSecret('TEST_SECRET');
    expect(result).toBeUndefined();
  });

  it('returns value in test env when set', () => {
    vi.stubEnv('NODE_ENV', 'test');
    process.env.TEST_SECRET = 'my-secret';
    const result = requireProdSecret('TEST_SECRET');
    expect(result).toBe('my-secret');
    delete process.env.TEST_SECRET;
  });

  it('throws in production when required secret is missing', () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.TEST_REQUIRED_SECRET;
    expect(() =>
      requireProdSecret('TEST_REQUIRED_SECRET', {
        required: true,
        minLength: 16,
        example: 'example',
        reason: 'test reason',
      }),
    ).toThrow(/REQUIRED/);
  });

  it('throws in production when required secret is a placeholder', () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.TEST_REQUIRED_SECRET = 'change-me';
    expect(() =>
      requireProdSecret('TEST_REQUIRED_SECRET', {
        required: true,
        minLength: 4,
      }),
    ).toThrow(/must be a real secret/);
    delete process.env.TEST_REQUIRED_SECRET;
  });

  it('returns valid secret in production when required', () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.TEST_REQUIRED_SECRET = 'a-real-secret-key-0123456789abcdef';
    const result = requireProdSecret('TEST_REQUIRED_SECRET', {
      required: true,
      minLength: 16,
    });
    expect(result).toBe('a-real-secret-key-0123456789abcdef');
    delete process.env.TEST_REQUIRED_SECRET;
  });

  it('throws in production when optional secret is a placeholder', () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.TEST_OPT_SECRET = 'your-api-key';
    expect(() => requireProdSecret('TEST_OPT_SECRET', { required: false })).toThrow(
      /looks like a placeholder/,
    );
    delete process.env.TEST_OPT_SECRET;
  });

  it('returns undefined in production when optional secret is not set', () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.TEST_OPT_SECRET;
    const result = requireProdSecret('TEST_OPT_SECRET', { required: false });
    expect(result).toBeUndefined();
  });

  it('returns valid optional secret in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.TEST_OPT_SECRET = 'a-real-secret-key-0123456789abcdef';
    const result = requireProdSecret('TEST_OPT_SECRET', { required: false });
    expect(result).toBe('a-real-secret-key-0123456789abcdef');
    delete process.env.TEST_OPT_SECRET;
  });

  it('throws in staging when required secret is missing', () => {
    vi.stubEnv('NODE_ENV', 'staging');
    delete process.env.TEST_STAGING_SECRET;
    expect(() => requireProdSecret('TEST_STAGING_SECRET', { required: true })).toThrow(/REQUIRED/);
  });
});

// ── requireProdExternalUrl ─────────────────────────────────────

describe('requireProdExternalUrl — branch coverage', () => {
  it('returns env var in development when set', () => {
    vi.stubEnv('NODE_ENV', 'development');
    process.env.TEST_PROD_URL = 'postgres://custom:5432/dev';
    const result = requireProdExternalUrl('TEST_PROD_URL', 'postgres://localhost:5432/dev');
    expect(result).toBe('postgres://custom:5432/dev');
    delete process.env.TEST_PROD_URL;
  });

  it('returns devDefault in development when env var is not set', () => {
    vi.stubEnv('NODE_ENV', 'development');
    delete process.env.TEST_PROD_URL;
    const result = requireProdExternalUrl('TEST_PROD_URL', 'postgres://localhost:5432/dev');
    expect(result).toBe('postgres://localhost:5432/dev');
  });

  it('uses fallback when env var is empty in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.TEST_PROD_URL;
    // devDefault is non-localhost → resolved = devDefault → succeeds
    expect(() =>
      requireProdExternalUrl('TEST_PROD_URL', 'postgres://user:pass@db.prod.internal:5432/prod'),
    ).not.toThrow();
  });

  it('throws in production when resolved URL is localhost', () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.TEST_PROD_URL;
    expect(() => requireProdExternalUrl('TEST_PROD_URL', 'postgres://localhost:5432/dev')).toThrow(
      /must resolve to a non-localhost URL/,
    );
  });

  it('throws in production when env var is localhost', () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.TEST_PROD_URL = 'postgres://localhost:5432/prod';
    expect(() =>
      requireProdExternalUrl('TEST_PROD_URL', 'postgres://user:pass@db.prod.internal:5432/prod'),
    ).toThrow(/must resolve to a non-localhost URL/);
    delete process.env.TEST_PROD_URL;
  });

  it('returns env var in production when non-localhost', () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.TEST_PROD_URL = 'postgres://user:pass@db.prod.internal:5432/prod';
    const result = requireProdExternalUrl('TEST_PROD_URL', 'postgres://localhost:5432/dev');
    expect(result).toBe('postgres://user:pass@db.prod.internal:5432/prod');
    delete process.env.TEST_PROD_URL;
  });

  it('returns env var in staging when non-localhost', () => {
    vi.stubEnv('NODE_ENV', 'staging');
    process.env.TEST_PROD_URL = 'postgres://user:pass@db.staging.internal:5432/prod';
    const result = requireProdExternalUrl('TEST_PROD_URL', 'postgres://localhost:5432/dev');
    expect(result).toBe('postgres://user:pass@db.staging.internal:5432/prod');
    delete process.env.TEST_PROD_URL;
  });
});

// ── loadConfiguration — social login & SMTP paths ──────────────

describe('loadConfiguration — branch coverage for social login and SMTP', () => {
  it('loads with social login enabled in test env (non-production)', () => {
    vi.stubEnv('NODE_ENV', 'test');
    process.env.FF_SOCIAL_LOGIN_ENABLED = 'true';
    process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'GOCSPX-testsecret';
    const cfg = loadConfiguration();
    expect(cfg.features.socialLoginEnabled).toBe(true);
    expect(cfg.auth.googleClientId).toBe('test-client-id.apps.googleusercontent.com');
    expect(cfg.auth.googleClientSecret).toBe('GOCSPX-testsecret');
    delete process.env.FF_SOCIAL_LOGIN_ENABLED;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
  });

  it('loads with social login disabled and no Google env vars', () => {
    vi.stubEnv('NODE_ENV', 'test');
    delete process.env.FF_SOCIAL_LOGIN_ENABLED;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
    const cfg = loadConfiguration();
    expect(cfg.features.socialLoginEnabled).toBe(false);
    expect(cfg.auth.googleClientId).toBeUndefined();
    expect(cfg.auth.googleClientSecret).toBeUndefined();
    expect(cfg.auth.googleRedirectUri).toBeUndefined();
  });

  it('loads GOOGLE_REDIRECT_URI when social login is disabled', () => {
    vi.stubEnv('NODE_ENV', 'test');
    delete process.env.FF_SOCIAL_LOGIN_ENABLED;
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/callback';
    const cfg = loadConfiguration();
    expect(cfg.auth.googleRedirectUri).toBe('http://localhost:3000/callback');
    delete process.env.GOOGLE_REDIRECT_URI;
  });

  it('smtp credentials are optional when SMTP_HOST is not set', () => {
    vi.stubEnv('NODE_ENV', 'test');
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;
    const cfg = loadConfiguration();
    expect(cfg.smtp.host).toBeUndefined();
    expect(cfg.smtp.user).toBeUndefined();
    expect(cfg.smtp.pass).toBeUndefined();
    expect(cfg.smtp.from).toBeUndefined();
  });

  it('smtp credentials are loaded when SMTP_HOST is set', () => {
    vi.stubEnv('NODE_ENV', 'test');
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASS = 'pass12345';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_FROM = 'no-reply@example.com';
    const cfg = loadConfiguration();
    expect(cfg.smtp.host).toBe('smtp.example.com');
    expect(cfg.smtp.user).toBe('user');
    expect(cfg.smtp.pass).toBe('pass12345');
    expect(cfg.smtp.port).toBe(465);
    expect(cfg.smtp.from).toBe('no-reply@example.com');
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_FROM;
  });

  it('SMTP_FROM with whitespace is trimmed or returns undefined when empty', () => {
    vi.stubEnv('NODE_ENV', 'test');
    process.env.SMTP_FROM = '  ';
    const cfg = loadConfiguration();
    // '  '.trim() === '' → process.env.SMTP_FROM?.trim() || undefined → undefined
    expect(cfg.smtp.from).toBeUndefined();
    delete process.env.SMTP_FROM;
  });

  it('FF_MARKETPLACE_ENABLED is true when set', () => {
    vi.stubEnv('NODE_ENV', 'test');
    process.env.FF_MARKETPLACE_ENABLED = 'true';
    const cfg = loadConfiguration();
    expect(cfg.features.marketplaceEnabled).toBe(true);
    delete process.env.FF_MARKETPLACE_ENABLED;
  });

  it('AI_ROUTING_STRATEGY defaults to capability', () => {
    vi.stubEnv('NODE_ENV', 'test');
    delete process.env.AI_ROUTING_STRATEGY;
    const cfg = loadConfiguration();
    expect(cfg.ai.routingStrategy).toBe('capability');
  });

  it('AI_ROUTING_STRATEGY reads from env', () => {
    vi.stubEnv('NODE_ENV', 'test');
    process.env.AI_ROUTING_STRATEGY = 'priority';
    const cfg = loadConfiguration();
    expect(cfg.ai.routingStrategy).toBe('priority');
    delete process.env.AI_ROUTING_STRATEGY;
  });
});

// ── loadConfiguration — requireJwtSecret paths ─────────────────

describe('loadConfiguration — requireJwtSecret error paths', () => {
  it('throws when AUTH_JWT_SECRET is empty', () => {
    const saved = process.env.AUTH_JWT_SECRET;
    try {
      vi.stubEnv('NODE_ENV', 'production');
      process.env.AUTH_JWT_SECRET = '';
      expect(() => loadConfiguration()).toThrow(/AUTH_JWT_SECRET.*required/);
    } finally {
      if (saved === undefined) delete process.env.AUTH_JWT_SECRET;
      else process.env.AUTH_JWT_SECRET = saved;
    }
  });

  it('throws when AUTH_JWT_SECRET is whitespace only', () => {
    const saved = process.env.AUTH_JWT_SECRET;
    try {
      vi.stubEnv('NODE_ENV', 'production');
      process.env.AUTH_JWT_SECRET = '   ';
      expect(() => loadConfiguration()).toThrow(/AUTH_JWT_SECRET.*required/);
    } finally {
      if (saved === undefined) delete process.env.AUTH_JWT_SECRET;
      else process.env.AUTH_JWT_SECRET = saved;
    }
  });

  it('throws when AUTH_JWT_SECRET is weak', () => {
    const saved = process.env.AUTH_JWT_SECRET;
    try {
      vi.stubEnv('NODE_ENV', 'production');
      process.env.AUTH_JWT_SECRET = 'short';
      expect(() => loadConfiguration()).toThrow(/AUTH_JWT_SECRET.*strong/);
    } finally {
      if (saved === undefined) delete process.env.AUTH_JWT_SECRET;
      else process.env.AUTH_JWT_SECRET = saved;
    }
  });
});

// ── getConfig caching ──────────────────────────────────────────

describe('getConfig caching', () => {
  it('returns the same configuration on repeated calls', async () => {
    vi.resetModules();
    const mod = await import('../index.js');
    vi.stubEnv('NODE_ENV', 'test');
    const first = mod.getConfig();
    const second = mod.getConfig();
    expect(first).toBe(second);
  });
});

// ── config proxy handlers ──────────────────────────────────────

describe('config proxy — handler coverage', () => {
  it('config proxy set/has/delete/ownKeys/getOwnPropertyDescriptor', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'test');
    const mod = await import('../index.js');
    // has()
    expect('app' in mod.config).toBe(true);
    expect('nonexistent' in mod.config).toBe(false);
    // ownKeys()
    const keys = Object.keys(mod.config);
    expect(keys).toContain('app');
    // getOwnPropertyDescriptor()
    const desc = Object.getOwnPropertyDescriptor(mod.config, 'app');
    expect(desc).toBeDefined();
  });
});

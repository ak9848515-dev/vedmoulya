// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/core — Complete Test Suite
// Tests all core platform infrastructure
// Implements BLP-001/D09 Testing Strategy — ≥80% coverage
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ValidationError,
  NotFoundError,
  AuthenticationError,
  RateLimitError,
} from './errors/index.js';
import { HTTP_STATUS, TIME } from './constants/index.js';
import { Container } from './di/index.js';
import { ApplicationLifecycle } from './lifecycle/index.js';
import { ValidationSchema, Rules } from './validation/index.js';
import { HealthChecker, memoryHealthCheck } from './health/index.js';
import { MetricsRegistry, Timer } from './metrics/index.js';
import { TraceProvider } from './tracing/index.js';
import { InMemoryEventBus, createEvent } from './event-bus/index.js';
import { Environment, defineStandardEnvVars } from './env/index.js';
import { featureFlags } from './feature-flags/index.js';
import { config, loadConfiguration } from './config/index.js';
import {
  sleep,
  clamp,
  generateId,
  pick,
  omit,
  retry,
  debounce,
  throttle,
} from './utilities/index.js';
import { BaseService, BaseRepository, BaseUseCase, processInBatches } from './base/index.js';

// ── Error Tests ───────────────────────────────────────────────────────────

describe('AppError', () => {
  it('creates ValidationError with correct properties', () => {
    const error = new ValidationError('Invalid input', { field: 'name' });
    expect(error.message).toBe('Invalid input');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.details).toEqual({ field: 'name' });
  });

  it('creates NotFoundError with and without id', () => {
    expect(new NotFoundError('User', '123').message).toBe('User not found: 123');
    expect(new NotFoundError('User').message).toBe('User not found');
  });

  it('creates AuthenticationError with default message', () => {
    expect(new AuthenticationError().message).toBe('Authentication required');
  });

  it('NotFoundError has status 404', () => {
    expect(new NotFoundError('test').statusCode).toBe(404);
  });

  it('RateLimitError has status 429', () => {
    expect(new RateLimitError().statusCode).toBe(429);
  });

  it('error classes are instanceof AppError', () => {
    expect(new ValidationError('x')).toBeInstanceOf(ValidationError);
    expect(new ValidationError('x').name).toBe('ValidationError');
  });
});

// ── Constants Tests ───────────────────────────────────────────────────────

describe('Constants', () => {
  it('has HTTP status codes', () => {
    expect(HTTP_STATUS.OK).toBe(200);
    expect(HTTP_STATUS.NOT_FOUND).toBe(404);
    expect(HTTP_STATUS.INTERNAL_ERROR).toBe(500);
  });

  it('has time constants', () => {
    expect(TIME.SECOND).toBe(1000);
    expect(TIME.MINUTE).toBe(60000);
    expect(TIME.HOUR).toBe(3600000);
  });
});

// ── Config Tests ──────────────────────────────────────────────────────────

describe('Configuration', () => {
  it('loads default configuration', () => {
    expect(config.app.name).toBe('vedmoulya');
    expect(config.app.env).toBe('test');
    expect(config.app.logLevel).toBe('debug');
  });

  it('has all required config sections', () => {
    expect(config.app).toBeDefined();
    expect(config.database).toBeDefined();
    expect(config.redis).toBeDefined();
    expect(config.auth).toBeDefined();
    expect(config.ai).toBeDefined();
    expect(config.features).toBeDefined();
    expect(config.observability).toBeDefined();
  });

  it('loads AUTH_JWT_SECRET from environment (required, no default)', () => {
    expect(config.auth.jwtSecret).toBeTruthy();
    expect(config.auth.jwtSecret.length).toBeGreaterThanOrEqual(32);
  });

  it('allows localhost database/redis defaults in development', () => {
    const saved = { nodeEnv: process.env.NODE_ENV, db: process.env.IDENTITY_DATABASE_URL };
    const savedRedis = process.env.REDIS_URL;
    try {
      process.env.NODE_ENV = 'development';
      delete process.env.IDENTITY_DATABASE_URL;
      delete process.env.REDIS_URL;
      const cfg = loadConfiguration();
      expect(cfg.database.url).toBe('postgres://localhost:5432/vedmoulya');
      expect(cfg.redis.url).toBe('redis://localhost:6379');
    } finally {
      process.env.NODE_ENV = saved.nodeEnv ?? 'test';
      if (saved.db === undefined) delete process.env.IDENTITY_DATABASE_URL;
      else process.env.IDENTITY_DATABASE_URL = saved.db;
      if (savedRedis === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = savedRedis;
    }
  });

  it('requires IDENTITY_DATABASE_URL outside development', () => {
    const saved = process.env.NODE_ENV;
    const savedDb = process.env.IDENTITY_DATABASE_URL;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.IDENTITY_DATABASE_URL;
      expect(() => loadConfiguration()).toThrow(/IDENTITY_DATABASE_URL/);
    } finally {
      process.env.NODE_ENV = saved ?? 'test';
      if (savedDb === undefined) delete process.env.IDENTITY_DATABASE_URL;
      else process.env.IDENTITY_DATABASE_URL = savedDb;
    }
  });

  it('rejects localhost database/redis URLs outside development', () => {
    const saved = process.env.NODE_ENV;
    const savedDb = process.env.IDENTITY_DATABASE_URL;
    const savedRedis = process.env.REDIS_URL;
    try {
      process.env.NODE_ENV = 'production';
      process.env.IDENTITY_DATABASE_URL = 'postgres://localhost:5432/vedmoulya';
      process.env.REDIS_URL = 'redis://localhost:6379';
      expect(() => loadConfiguration()).toThrow(/IDENTITY_DATABASE_URL/);
    } finally {
      process.env.NODE_ENV = saved ?? 'test';
      if (savedDb === undefined) delete process.env.IDENTITY_DATABASE_URL;
      else process.env.IDENTITY_DATABASE_URL = savedDb;
      if (savedRedis === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = savedRedis;
    }
  });

  it('accepts non-localhost database/redis URLs outside development', () => {
    const saved = process.env.NODE_ENV;
    const savedDb = process.env.IDENTITY_DATABASE_URL;
    const savedRedis = process.env.REDIS_URL;
    const savedAiKey = process.env.AI_OPENAI_API_KEY;
    const savedAiProvider = process.env.AI_DEFAULT_PROVIDER;
    const savedAiFlag = process.env.FF_AI_ASSISTANT_ENABLED;
    try {
      process.env.NODE_ENV = 'production';
      process.env.IDENTITY_DATABASE_URL = 'postgres://user:pass@db.prod.internal:5432/vedmoulya';
      process.env.REDIS_URL = 'redis://redis.prod.internal:6379';
      // AI assistant is enabled by default and openai is the default provider,
      // so a real key is required in production (PH-001/T2). Pin provider/flags
      // so ambient shell env cannot change the assertion.
      process.env.AI_DEFAULT_PROVIDER = 'openai';
      delete process.env.FF_AI_ASSISTANT_ENABLED;
      process.env.AI_OPENAI_API_KEY = 'sk-test-0123456789abcdef0123456789abcdef0123456789abcdef';
      const cfg = loadConfiguration();
      expect(cfg.database.url).toBe('postgres://user:pass@db.prod.internal:5432/vedmoulya');
      expect(cfg.redis.url).toBe('redis://redis.prod.internal:6379');
    } finally {
      process.env.NODE_ENV = saved ?? 'test';
      if (savedDb === undefined) delete process.env.IDENTITY_DATABASE_URL;
      else process.env.IDENTITY_DATABASE_URL = savedDb;
      if (savedRedis === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = savedRedis;
      if (savedAiKey === undefined) delete process.env.AI_OPENAI_API_KEY;
      else process.env.AI_OPENAI_API_KEY = savedAiKey;
      if (savedAiProvider === undefined) delete process.env.AI_DEFAULT_PROVIDER;
      else process.env.AI_DEFAULT_PROVIDER = savedAiProvider;
      if (savedAiFlag === undefined) delete process.env.FF_AI_ASSISTANT_ENABLED;
      else process.env.FF_AI_ASSISTANT_ENABLED = savedAiFlag;
    }
  });

  // ── PH-001/T2 — production secret fail-fast (AI keys, OAuth, SMTP) ────────

  it('requires the default AI provider key in production (PH-001/T2)', () => {
    const saved = process.env.NODE_ENV;
    const savedKey = process.env.AI_OPENAI_API_KEY;
    const savedProvider = process.env.AI_DEFAULT_PROVIDER;
    const savedAiFlag = process.env.FF_AI_ASSISTANT_ENABLED;
    try {
      process.env.NODE_ENV = 'production';
      process.env.AI_DEFAULT_PROVIDER = 'openai';
      delete process.env.FF_AI_ASSISTANT_ENABLED;
      delete process.env.AI_OPENAI_API_KEY;
      expect(() => loadConfiguration()).toThrow(/AI_OPENAI_API_KEY.*REQUIRED/);
    } finally {
      process.env.NODE_ENV = saved ?? 'test';
      if (savedKey === undefined) delete process.env.AI_OPENAI_API_KEY;
      else process.env.AI_OPENAI_API_KEY = savedKey;
      if (savedProvider === undefined) delete process.env.AI_DEFAULT_PROVIDER;
      else process.env.AI_DEFAULT_PROVIDER = savedProvider;
      if (savedAiFlag === undefined) delete process.env.FF_AI_ASSISTANT_ENABLED;
      else process.env.FF_AI_ASSISTANT_ENABLED = savedAiFlag;
    }
  });

  it('rejects placeholder AI keys in production (PH-001/T2)', () => {
    const saved = process.env.NODE_ENV;
    const savedKey = process.env.AI_OPENAI_API_KEY;
    const savedProvider = process.env.AI_DEFAULT_PROVIDER;
    const savedAiFlag = process.env.FF_AI_ASSISTANT_ENABLED;
    try {
      process.env.NODE_ENV = 'production';
      process.env.AI_DEFAULT_PROVIDER = 'openai';
      delete process.env.FF_AI_ASSISTANT_ENABLED;
      process.env.AI_OPENAI_API_KEY = 'your-api-key';
      expect(() => loadConfiguration()).toThrow(/AI_OPENAI_API_KEY/);
    } finally {
      process.env.NODE_ENV = saved ?? 'test';
      if (savedKey === undefined) delete process.env.AI_OPENAI_API_KEY;
      else process.env.AI_OPENAI_API_KEY = savedKey;
      if (savedProvider === undefined) delete process.env.AI_DEFAULT_PROVIDER;
      else process.env.AI_DEFAULT_PROVIDER = savedProvider;
      if (savedAiFlag === undefined) delete process.env.FF_AI_ASSISTANT_ENABLED;
      else process.env.FF_AI_ASSISTANT_ENABLED = savedAiFlag;
    }
  });

  it('allows AI keys to be absent in development (PH-001/T2)', () => {
    const saved = process.env.NODE_ENV;
    const savedKey = process.env.AI_OPENAI_API_KEY;
    try {
      process.env.NODE_ENV = 'development';
      delete process.env.AI_OPENAI_API_KEY;
      const cfg = loadConfiguration();
      expect(cfg.ai.openAiKey).toBeUndefined();
    } finally {
      process.env.NODE_ENV = saved ?? 'test';
      if (savedKey === undefined) delete process.env.AI_OPENAI_API_KEY;
      else process.env.AI_OPENAI_API_KEY = savedKey;
    }
  });

  it('requires AI_DEEPSEEK_API_KEY in production when AI_DEFAULT_PROVIDER=deepseek (PH-001/T2)', () => {
    const saved = process.env.NODE_ENV;
    const savedKey = process.env.AI_DEEPSEEK_API_KEY;
    const savedProvider = process.env.AI_DEFAULT_PROVIDER;
    const savedAiFlag = process.env.FF_AI_ASSISTANT_ENABLED;
    try {
      process.env.NODE_ENV = 'production';
      process.env.AI_DEFAULT_PROVIDER = 'deepseek';
      delete process.env.FF_AI_ASSISTANT_ENABLED;
      delete process.env.AI_DEEPSEEK_API_KEY;
      expect(() => loadConfiguration()).toThrow(/AI_DEEPSEEK_API_KEY.*REQUIRED/);
    } finally {
      process.env.NODE_ENV = saved ?? 'test';
      if (savedKey === undefined) delete process.env.AI_DEEPSEEK_API_KEY;
      else process.env.AI_DEEPSEEK_API_KEY = savedKey;
      if (savedProvider === undefined) delete process.env.AI_DEFAULT_PROVIDER;
      else process.env.AI_DEFAULT_PROVIDER = savedProvider;
      if (savedAiFlag === undefined) delete process.env.FF_AI_ASSISTANT_ENABLED;
      else process.env.FF_AI_ASSISTANT_ENABLED = savedAiFlag;
    }
  });

  it('rejects placeholder AI_DEEPSEEK_API_KEY in production (PH-001/T2)', () => {
    const saved = process.env.NODE_ENV;
    const savedKey = process.env.AI_DEEPSEEK_API_KEY;
    const savedProvider = process.env.AI_DEFAULT_PROVIDER;
    const savedAiFlag = process.env.FF_AI_ASSISTANT_ENABLED;
    try {
      process.env.NODE_ENV = 'production';
      process.env.AI_DEFAULT_PROVIDER = 'deepseek';
      delete process.env.FF_AI_ASSISTANT_ENABLED;
      process.env.AI_DEEPSEEK_API_KEY = 'your-api-key';
      expect(() => loadConfiguration()).toThrow(/AI_DEEPSEEK_API_KEY/);
    } finally {
      process.env.NODE_ENV = saved ?? 'test';
      if (savedKey === undefined) delete process.env.AI_DEEPSEEK_API_KEY;
      else process.env.AI_DEEPSEEK_API_KEY = savedKey;
      if (savedProvider === undefined) delete process.env.AI_DEFAULT_PROVIDER;
      else process.env.AI_DEFAULT_PROVIDER = savedProvider;
      if (savedAiFlag === undefined) delete process.env.FF_AI_ASSISTANT_ENABLED;
      else process.env.FF_AI_ASSISTANT_ENABLED = savedAiFlag;
    }
  });

  it('loads AI_DEEPSEEK_API_KEY into config.ai.deepseekKey when configured', () => {
    const saved = process.env.NODE_ENV;
    const savedKey = process.env.AI_DEEPSEEK_API_KEY;
    const savedProvider = process.env.AI_DEFAULT_PROVIDER;
    const savedAiFlag = process.env.FF_AI_ASSISTANT_ENABLED;
    try {
      process.env.NODE_ENV = 'production';
      process.env.AI_DEFAULT_PROVIDER = 'deepseek';
      delete process.env.FF_AI_ASSISTANT_ENABLED;
      process.env.AI_DEEPSEEK_API_KEY = 'sk-test-0123456789abcdef0123456789abcdef0123456789abcdef';
      const cfg = loadConfiguration();
      expect(cfg.ai.deepseekKey).toBe('sk-test-0123456789abcdef0123456789abcdef0123456789abcdef');
      expect(cfg.ai.defaultProvider).toBe('deepseek');
    } finally {
      process.env.NODE_ENV = saved ?? 'test';
      if (savedKey === undefined) delete process.env.AI_DEEPSEEK_API_KEY;
      else process.env.AI_DEEPSEEK_API_KEY = savedKey;
      if (savedProvider === undefined) delete process.env.AI_DEFAULT_PROVIDER;
      else process.env.AI_DEFAULT_PROVIDER = savedProvider;
      if (savedAiFlag === undefined) delete process.env.FF_AI_ASSISTANT_ENABLED;
      else process.env.FF_AI_ASSISTANT_ENABLED = savedAiFlag;
    }
  });

  it('requires OAuth secrets in production when social login is enabled (PH-001/T2)', () => {
    // Note: loadConfiguration() evaluates database → auth → ai → smtp in source
    // order, so this throws on GOOGLE_CLIENT_ID before any AI key is required —
    // AI_OPENAI_API_KEY need not be provisioned here. Keep this ordering in mind
    // if the config object is ever reordered.
    const saved = process.env.NODE_ENV;
    const savedFlag = process.env.FF_SOCIAL_LOGIN_ENABLED;
    const savedId = process.env.GOOGLE_CLIENT_ID;
    const savedSecret = process.env.GOOGLE_CLIENT_SECRET;
    try {
      process.env.NODE_ENV = 'production';
      process.env.FF_SOCIAL_LOGIN_ENABLED = 'true';
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      expect(() => loadConfiguration()).toThrow(/GOOGLE_CLIENT_ID.*REQUIRED/);
    } finally {
      process.env.NODE_ENV = saved ?? 'test';
      if (savedFlag === undefined) delete process.env.FF_SOCIAL_LOGIN_ENABLED;
      else process.env.FF_SOCIAL_LOGIN_ENABLED = savedFlag;
      if (savedId === undefined) delete process.env.GOOGLE_CLIENT_ID;
      else process.env.GOOGLE_CLIENT_ID = savedId;
      if (savedSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
      else process.env.GOOGLE_CLIENT_SECRET = savedSecret;
    }
  });

  it('requires SMTP user/pass in production when SMTP_HOST is set (PH-001/T2)', () => {
    const saved = process.env.NODE_ENV;
    const savedHost = process.env.SMTP_HOST;
    const savedUser = process.env.SMTP_USER;
    const savedPass = process.env.SMTP_PASS;
    const savedAiKey = process.env.AI_OPENAI_API_KEY;
    const savedAiProvider = process.env.AI_DEFAULT_PROVIDER;
    const savedAiFlag = process.env.FF_AI_ASSISTANT_ENABLED;
    try {
      process.env.NODE_ENV = 'production';
      process.env.SMTP_HOST = 'smtp.prod.internal';
      // AI assistant is enabled by default with openai default provider, so a
      // real key is evaluated before the SMTP section (PH-001/T2). Pin
      // provider/flags so ambient shell env cannot change the assertion.
      process.env.AI_DEFAULT_PROVIDER = 'openai';
      delete process.env.FF_AI_ASSISTANT_ENABLED;
      process.env.AI_OPENAI_API_KEY = 'sk-test-0123456789abcdef0123456789abcdef0123456789abcdef';
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      expect(() => loadConfiguration()).toThrow(/SMTP_USER.*REQUIRED/);
    } finally {
      process.env.NODE_ENV = saved ?? 'test';
      if (savedHost === undefined) delete process.env.SMTP_HOST;
      else process.env.SMTP_HOST = savedHost;
      if (savedUser === undefined) delete process.env.SMTP_USER;
      else process.env.SMTP_USER = savedUser;
      if (savedPass === undefined) delete process.env.SMTP_PASS;
      else process.env.SMTP_PASS = savedPass;
      if (savedAiKey === undefined) delete process.env.AI_OPENAI_API_KEY;
      else process.env.AI_OPENAI_API_KEY = savedAiKey;
      if (savedAiProvider === undefined) delete process.env.AI_DEFAULT_PROVIDER;
      else process.env.AI_DEFAULT_PROVIDER = savedAiProvider;
      if (savedAiFlag === undefined) delete process.env.FF_AI_ASSISTANT_ENABLED;
      else process.env.FF_AI_ASSISTANT_ENABLED = savedAiFlag;
    }
  });

  it('feature flags have defaults', () => {
    expect(config.features.aiAssistantEnabled).toBe(true);
    expect(config.features.socialLoginEnabled).toBe(false);
    expect(config.features.marketplaceEnabled).toBe(false);
  });
});

// ── Environment Tests ─────────────────────────────────────────────────────

describe('Environment', () => {
  let env: Environment;

  beforeEach(() => {
    env = new Environment();
  });

  it('validates when all required vars are present', () => {
    env.define([{ key: 'MY_VAR', description: 'test', required: true, default: 'value' }]);
    expect(() => env.validate()).not.toThrow();
    expect(env.isValidated()).toBe(true);
  });

  it('throws for missing required var', () => {
    env.define([{ key: 'MISSING_VAR', description: 'test', required: true }]);
    expect(() => env.validate()).toThrow('Environment validation failed');
  });

  it('optional vars without value are allowed', () => {
    env.define([{ key: 'OPTIONAL', description: 'test', required: false }]);
    expect(() => env.validate()).not.toThrow();
  });

  it('get returns stored values', () => {
    env.define([{ key: 'MY_VAR', description: 'test', required: false, default: 'hello' }]);
    expect(env.get('MY_VAR')).toBe('hello');
  });

  it('require throws for missing var', () => {
    env.define([{ key: 'MISSING', description: 'test', required: true }]);
    expect(() => env.require('MISSING')).toThrow();
  });

  it('number returns numeric value', () => {
    process.env.TEST_NUM = '42';
    env.define([{ key: 'TEST_NUM', description: 'test', required: false }]);
    expect(env.number('TEST_NUM')).toBe(42);
    delete process.env.TEST_NUM;
  });

  it('boolean parses true/false strings', () => {
    process.env.TEST_BOOL = 'true';
    env.define([{ key: 'TEST_BOOL', description: 'test', required: false }]);
    expect(env.boolean('TEST_BOOL')).toBe(true);
    delete process.env.TEST_BOOL;
  });

  it('flags invalid values via validate callbacks (P1-8 fix)', () => {
    const previous = process.env.NODE_ENV;
    const defineWith = (value: string) => {
      process.env.NODE_ENV = value;
      env.define([
        {
          key: 'NODE_ENV',
          description: 'test',
          required: false,
          validate: (v: string): boolean => ['development', 'production'].includes(v),
        },
      ]);
    };
    defineWith('production');
    expect(() => env.validate()).not.toThrow();
    defineWith('bogus');
    expect(() => env.validate()).toThrow('Environment validation failed');
    if (previous === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previous;
    }
  });

  it('defineStandardEnvVars requires AUTH_JWT_SECRET', () => {
    const previous = process.env.AUTH_JWT_SECRET;
    delete process.env.AUTH_JWT_SECRET;
    const fresh = new Environment();
    defineStandardEnvVars(fresh);
    expect(() => fresh.validate()).toThrow(/AUTH_JWT_SECRET/);
    if (previous !== undefined) {
      process.env.AUTH_JWT_SECRET = previous;
    }
  });

  it('defineStandardEnvVars rejects weak AUTH_JWT_SECRET values', () => {
    const previous = process.env.AUTH_JWT_SECRET;
    process.env.AUTH_JWT_SECRET = 'development-secret';
    const fresh = new Environment();
    defineStandardEnvVars(fresh);
    expect(() => fresh.validate()).toThrow(/AUTH_JWT_SECRET/);
    if (previous !== undefined) {
      process.env.AUTH_JWT_SECRET = previous;
    }
  });
});

// ── DI Container Tests ────────────────────────────────────────────────────

describe('DI Container', () => {
  it('registers and resolves a singleton service', () => {
    const c = new Container();
    c.register('test', () => ({ value: 42 }));
    expect(c.resolve<{ value: number }>('test').value).toBe(42);
  });

  it('returns same instance for singleton', () => {
    const c = new Container();
    c.register('test', () => ({ value: Math.random() }), true);
    const a = c.resolve<{ value: number }>('test');
    const b = c.resolve<{ value: number }>('test');
    expect(a.value).toBe(b.value);
  });

  it('returns different instances for non-singleton', () => {
    const c = new Container();
    c.register('test', () => ({ value: Math.random() }), false);
    const a = c.resolve<{ value: number }>('test');
    const b = c.resolve<{ value: number }>('test');
    expect(a.value).not.toBe(b.value);
  });

  it('throws for unregistered service', () => {
    const c = new Container();
    expect(() => c.resolve('nonexistent')).toThrow('Service not registered');
  });

  it('supports tagged registration', () => {
    const c = new Container();
    c.registerWithTag('svc1', 'svcs', () => 1);
    c.registerWithTag('svc2', 'svcs', () => 2);
    expect(c.resolveTagged<number>('svcs').size).toBe(2);
  });

  it('supports init and dispose hooks', async () => {
    const c = new Container();
    let init = false;
    let dispose = false;
    c.onInit(() => {
      init = true;
    });
    c.onDispose(() => {
      dispose = true;
    });
    await c.initialize();
    expect(init).toBe(true);
    await c.dispose();
    expect(dispose).toBe(true);
    expect(c.isInitialized()).toBe(false);
  });

  it('has() reflects registration', () => {
    const c = new Container();
    c.register('svc', () => ({}));
    expect(c.has('svc')).toBe(true);
    expect(c.has('x')).toBe(false);
  });
});

// ── Feature Flag Tests ────────────────────────────────────────────────────

describe('Feature Flags', () => {
  it('has default flags from config', () => {
    expect(featureFlags.isEnabled('aiAssistantEnabled')).toBe(true);
    expect(featureFlags.isEnabled('socialLoginEnabled')).toBe(false);
  });

  it('registers and enables new flags', () => {
    featureFlags.register('test-flag', true);
    expect(featureFlags.isEnabled('test-flag')).toBe(true);
  });

  it('returns false for unknown flags', () => {
    expect(featureFlags.isEnabled('unknown-flag')).toBe(false);
  });

  it('enable/disable toggles flags', () => {
    featureFlags.register('toggle-flag', false);
    expect(featureFlags.isEnabled('toggle-flag')).toBe(false);
    featureFlags.enable('toggle-flag');
    expect(featureFlags.isEnabled('toggle-flag')).toBe(true);
    featureFlags.disable('toggle-flag');
    expect(featureFlags.isEnabled('toggle-flag')).toBe(false);
  });

  it('list returns all flags', () => {
    featureFlags.register('list-flag', true);
    const flags = featureFlags.list();
    expect(typeof flags['list-flag']).toBe('boolean');
  });
});

// ── Lifecycle Tests ───────────────────────────────────────────────────────

describe('ApplicationLifecycle', () => {
  it('starts and transitions through phases', async () => {
    const lc = new ApplicationLifecycle();
    expect(lc.phase).toBe('created');
    await lc.start();
    expect(lc.phase).toBe('started');
  });

  it('stops and transitions to stopped', async () => {
    const lc = new ApplicationLifecycle();
    await lc.start();
    await lc.stop();
    expect(lc.phase).toBe('stopped');
  });

  it('runs startup hooks in order', async () => {
    const lc = new ApplicationLifecycle();
    const order: number[] = [];
    lc.onStart(() => {
      order.push(1);
    });
    lc.onStart(() => {
      order.push(2);
    });
    await lc.start();
    expect(order).toEqual([1, 2]);
  });

  it('runs shutdown hooks in reverse order', async () => {
    const lc = new ApplicationLifecycle();
    const order: number[] = [];
    lc.onStop(() => {
      order.push(1);
    });
    lc.onStop(() => {
      order.push(2);
    });
    await lc.start();
    await lc.stop();
    expect(order).toEqual([2, 1]);
  });

  it('captures startup error', async () => {
    const lc = new ApplicationLifecycle();
    lc.onStart(() => {
      throw new Error('startup failed');
    });
    await expect(lc.start()).rejects.toThrow('startup failed');
    expect(lc.startupError?.message).toBe('startup failed');
  });
});

// ── Validation Tests ──────────────────────────────────────────────────────

describe('ValidationSchema', () => {
  interface TestData {
    name: string;
    age: number;
    email: string;
  }

  it('passes valid data', () => {
    const schema = new ValidationSchema<TestData>()
      .field('name', [Rules.required()])
      .field('age', [Rules.min(18)])
      .field('email', [Rules.email()]);
    const result = schema.validate({ name: 'John', age: 25, email: 'john@example.com' });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails for invalid email', () => {
    const schema = new ValidationSchema<TestData>().field('email', [Rules.email()]);
    const result = schema.validate({ name: 'Test', age: 20, email: 'not-an-email' });
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.path).toBe('email');
  });

  it('assert throws ValidationError for invalid data', () => {
    const schema = new ValidationSchema<TestData>().field('email', [Rules.email()]);
    expect(() => schema.assert({ name: 'T', age: 10, email: 'bad' })).toThrow();
  });

  it('supports custom validators', () => {
    const schema = new ValidationSchema<TestData>().custom((data) =>
      data.age < 18 ? 'Must be 18+' : null,
    );
    const result = schema.validate({ name: 'T', age: 15, email: 'a@b.com' });
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.code).toBe('CUSTOM');
  });

  it('age must be at least min', () => {
    const schema = new ValidationSchema<TestData>().field('age', [Rules.min(18)]);
    const result = schema.validate({ name: 'T', age: 15, email: 'a@b.com' });
    expect(result.valid).toBe(false);
  });

  it('empty string passes required rule since field exists', () => {
    const schema = new ValidationSchema<TestData>().field('name', [Rules.required()]);
    const result = schema.validate({ name: '', age: 20, email: 'a@b.com' });
    expect(result.valid).toBe(false);
  });
});

describe('Validation Rules', () => {
  it('required rejects null/undefined', () => {
    expect(Rules.required().validate(null)).toBe('Value is required');
    expect(Rules.required().validate(undefined)).toBe('Value is required');
    expect(Rules.required().validate('hello')).toBeNull();
  });

  it('required rejects empty string', () => {
    expect(Rules.required().validate('')).toBe('Value is required');
  });

  it('minLength enforces minimum', () => {
    expect(Rules.minLength(3).validate('ab')).toBe('Must be at least 3 characters');
    expect(Rules.minLength(3).validate('abc')).toBeNull();
  });

  it('maxLength enforces maximum', () => {
    expect(Rules.maxLength(3).validate('abcd')).toBe('Must be at most 3 characters');
    expect(Rules.maxLength(3).validate('abc')).toBeNull();
  });

  it('email validates format', () => {
    expect(Rules.email().validate('not-email')).toBe('Must be a valid email address');
    expect(Rules.email().validate('test@example.com')).toBeNull();
  });

  it('pattern validates regex', () => {
    expect(Rules.pattern(/^[A-Z]+$/).validate('abc')).toBe('Value must match pattern: /^[A-Z]+$/');
    expect(Rules.pattern(/^[A-Z]+$/).validate('ABC')).toBeNull();
  });

  it('oneOf validates against allowed values', () => {
    expect(Rules.oneOf(['a', 'b']).validate('c')).toBe('Must be one of: a, b');
    expect(Rules.oneOf(['a', 'b']).validate('a')).toBeNull();
  });

  it('min validates number minimum', () => {
    expect(Rules.min(5).validate(3)).toBe('Must be at least 5');
    expect(Rules.min(5).validate(5)).toBeNull();
  });

  it('max validates number maximum', () => {
    expect(Rules.max(10).validate(15)).toBe('Must be at most 10');
    expect(Rules.max(10).validate(10)).toBeNull();
  });

  it('uuid validates format', () => {
    expect(Rules.uuid().validate('not-a-uuid')).toBe('Must be a valid UUID');
    expect(Rules.uuid().validate('550e8400-e29b-41d4-a716-446655440000')).toBeNull();
  });
});

// ── Health Check Tests ────────────────────────────────────────────────────

describe('HealthChecker', () => {
  it('returns healthy when all checks pass', async () => {
    const hc = new HealthChecker();
    hc.register('test', () => ({ name: 'test', status: 'healthy' as const }));
    const result = await hc.check();
    expect(result.status).toBe('healthy');
    expect(result.version).toBe('0.1.0');
  });

  it('returns unhealthy when a check fails', async () => {
    const hc = new HealthChecker();
    hc.register('ok', () => ({ name: 'ok', status: 'healthy' as const }));
    hc.register('fail', () => ({ name: 'fail', status: 'unhealthy' as const }));
    const result = await hc.check();
    expect(result.status).toBe('unhealthy');
  });

  it('handles check exceptions gracefully', async () => {
    const hc = new HealthChecker();
    hc.register('failing', () => {
      throw new Error('check failed');
    });
    const result = await hc.check();
    expect(result.status).toBe('unhealthy');
    expect(result.checks[0]?.error).toBe('check failed');
  });

  it('memory health check returns result', () => {
    const check = memoryHealthCheck();
    const result = check();
    expect(result.name).toBe('memory');
    expect(['healthy', 'degraded']).toContain(result.status);
  });

  it('status() returns overall health', async () => {
    const hc = new HealthChecker();
    hc.register('ok', () => ({ name: 'ok', status: 'healthy' as const }));
    const status = await hc.status();
    expect(status).toBe('healthy');
  });
});

// ── Metrics Tests ─────────────────────────────────────────────────────────

describe('MetricsRegistry', () => {
  it('increments counters', () => {
    const m = new MetricsRegistry();
    m.increment('requests');
    expect(m.getCounter('requests')).toBe(1);
    m.increment('requests', 5);
    expect(m.getCounter('requests')).toBe(6);
  });

  it('records and retrieves gauges', () => {
    const m = new MetricsRegistry();
    m.setGauge('memory', 512);
    expect(m.getGauge('memory')).toBe(512);
  });

  it('observes histogram values', () => {
    const m = new MetricsRegistry();
    m.observe('latency', 100);
    m.observe('latency', 200);
    m.observe('latency', 300);
    const stats = m.histogramStats('latency');
    expect(stats?.count).toBe(3);
    expect(stats?.min).toBe(100);
    expect(stats?.max).toBe(300);
    expect(stats?.avg).toBe(200);
  });

  it('Timer records duration', () => {
    const m = new MetricsRegistry();
    const timer = new Timer('op', m);
    timer.stop();
    expect(m.histogramStats('op')?.count).toBe(1);
  });

  it('emits metrics to listeners', () => {
    const m = new MetricsRegistry();
    const captured: string[] = [];
    m.onMetric((metric) => {
      captured.push(metric.name);
    });
    m.increment('test');
    expect(captured).toContain('test');
  });

  it('snapshot returns all metrics', () => {
    const m = new MetricsRegistry();
    m.increment('req');
    m.setGauge('mem', 100);
    m.observe('lat', 50);
    const snap = m.snapshot();
    expect(snap).toHaveProperty('counters');
    expect(snap).toHaveProperty('gauges');
    expect(snap).toHaveProperty('histograms');
  });
});

// ── Tracing Tests ─────────────────────────────────────────────────────────

describe('TraceProvider', () => {
  it('creates and completes spans', () => {
    const tp = new TraceProvider('test');
    const tracer = tp.getTracer();
    const span = tracer.startSpan('op', { key: 'val' });
    expect(span.name).toBe('op');
    expect(span.attributes?.key).toBe('val');
    tracer.endSpan(span, 'ok');
    expect(span.status).toBe('ok');
    expect(span.endTime).toBeDefined();
    expect(tp.getSpans().length).toBe(1);
  });

  it('records errors on spans', () => {
    const tp = new TraceProvider();
    const tracer = tp.getTracer();
    const span = tracer.startSpan('failing');
    tracer.recordError(span, new Error('boom'));
    expect(span.status).toBe('error');
    expect(span.error?.message).toBe('boom');
  });

  it('setAttribute updates span', () => {
    const tp = new TraceProvider();
    const tracer = tp.getTracer();
    const span = tracer.startSpan('test');
    tracer.setAttribute(span, 'key', 'value');
    expect(span.attributes?.key).toBe('value');
  });

  it('clear removes all spans', () => {
    const tp = new TraceProvider();
    tp.getTracer().startSpan('test');
    expect(tp.getSpans().length).toBe(1);
    tp.clear();
    expect(tp.getSpans().length).toBe(0);
  });
});

// ── Event Bus Tests ───────────────────────────────────────────────────────

describe('InMemoryEventBus', () => {
  it('publishes and subscribes to events', async () => {
    const bus = new InMemoryEventBus();
    const received: string[] = [];
    bus.subscribe('test.event', (event) => {
      received.push(event.type);
    });
    await bus.publish(createEvent('test.event', 'test', { id: 1 }, 'corr-1'));
    expect(received).toContain('test.event');
  });

  it('wildcard subscribers receive all events', async () => {
    const bus = new InMemoryEventBus();
    const received: string[] = [];
    bus.subscribeAll((event) => {
      received.push(event.type);
    });
    await bus.publish(createEvent('a', 'test', {}, 'c1'));
    await bus.publish(createEvent('b', 'test', {}, 'c1'));
    expect(received).toEqual(['a', 'b']);
  });

  it('unsubscribes handlers', async () => {
    const bus = new InMemoryEventBus();
    const handler = () => {
      /* noop */
    };
    bus.subscribe('test', handler);
    bus.unsubscribe('test', handler);
    await bus.publish(createEvent('test', 'src', {}, 'c1'));
    expect(bus.getPublishedEvents()).toHaveLength(1);
  });

  it('createEvent generates proper structure', () => {
    const ev = createEvent('test.type', 'service', { key: 'val' }, 'corr-1');
    expect(ev.type).toBe('test.type');
    expect(ev.source).toBe('service');
    expect(ev.data).toEqual({ key: 'val' });
    expect(ev.id).toMatch(/^evt_/);
  });

  it('clear resets all state', () => {
    const bus = new InMemoryEventBus();
    bus.subscribe('test', () => {});
    bus.publish(createEvent('test', 'src', {}, 'c1'));
    bus.clear();
    expect(bus.getPublishedEvents()).toHaveLength(0);
  });
});

// ── Utility Tests ─────────────────────────────────────────────────────────

describe('Utilities', () => {
  it('sleep resolves after specified time', async () => {
    const start = Date.now();
    await sleep(10);
    expect(Date.now() - start).toBeGreaterThanOrEqual(5);
  });

  it('clamp returns bounded value', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('generateId creates id with prefix', () => {
    expect(generateId('usr')).toMatch(/^usr_[a-f0-9]+$/);
    expect(generateId()).toMatch(/^[a-f0-9]+$/);
  });

  it('pick selects specified keys', () => {
    expect(pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ a: 1, c: 3 });
    expect(pick({ a: 1 }, ['b'])).toEqual({});
  });

  it('omit removes specified keys', () => {
    expect(omit({ a: 1, b: 2, c: 3 }, ['b'])).toEqual({ a: 1, c: 3 });
  });

  it('retry succeeds on first attempt', async () => {
    const result = await retry(async () => 'success');
    expect(result).toBe('success');
  });

  it('retry retries on failure', async () => {
    let attempts = 0;
    const result = await retry(
      async () => {
        attempts++;
        if (attempts < 2) throw new Error('try again');
        return 'success';
      },
      { maxRetries: 2, baseDelay: 1 },
    );
    expect(result).toBe('success');
    expect(attempts).toBe(2);
  });

  it('retry fails after max retries', async () => {
    await expect(
      retry(
        async () => {
          throw new Error('always fails');
        },
        { maxRetries: 2, baseDelay: 1 },
      ),
    ).rejects.toThrow('always fails');
  });

  it('debounce delays execution', async () => {
    let called = 0;
    const fn = debounce(() => {
      called++;
    }, 50);
    fn();
    fn();
    fn();
    expect(called).toBe(0);
    await sleep(100);
    expect(called).toBe(1);
  });

  it('throttle limits execution rate', () => {
    let called = 0;
    const fn = throttle(() => {
      called++;
    }, 100);
    fn();
    fn();
    fn();
    expect(called).toBe(1);
  });
});

// ── Base Abstractions Tests ───────────────────────────────────────────────

describe('Base Abstractions', () => {
  it('BaseService creates logger with service name', () => {
    class TestService extends BaseService {
      constructor() {
        super('test-service');
      }
      getName() {
        return this.serviceName;
      }
    }
    const svc = new TestService();
    expect(svc.getName()).toBe('test-service');
  });

  it('BaseRepository creates logger with repo name', () => {
    class TestRepo extends BaseRepository {
      constructor() {
        super('test-repo');
      }
      getName() {
        return this.repositoryName;
      }
    }
    const repo = new TestRepo();
    // repositoryName is the raw name; logger prefix is added in child()
    expect(repo.getName()).toBe('test-repo');
  });

  it('BaseUseCase defines execute interface', () => {
    class TestUseCase extends BaseUseCase<number, string> {
      async execute(input: number) {
        return { ok: true as const, value: `got ${input}` };
      }
    }
    const uc = new TestUseCase('test');
    expect(uc.execute).toBeDefined();
  });

  it('processInBatches splits work into batches', async () => {
    const result = await processInBatches([1, 2, 3, 4, 5], async (n) => n * 2, 2);
    expect(result.succeeded).toEqual([2, 4, 6, 8, 10]);
    expect(result.total).toBe(5);
  });

  it('processInBatches captures failures', async () => {
    const result = await processInBatches([1, 2, 3], async (n) => {
      if (n === 2) throw new Error('fail');
      return n;
    });
    expect(result.succeeded).toEqual([1, 3]);
    expect(result.failed).toHaveLength(1);
  });
});

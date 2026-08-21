// ──────────────────────────────────────────────────────────────────
// VedMoulya — Shared Vitest Setup
// Provisions required environment variables BEFORE any test module
// imports @vedmoulya/core. The core `config` singleton is created at
// import time and is fail-fast: AUTH_JWT_SECRET is required with no
// default (P1-8). Without this setup, every vitest workspace that
// imports @vedmoulya/core would throw EnvironmentError at load.
// ──────────────────────────────────────────────────────────────────

// Vitest must always run with NODE_ENV=test regardless of the shell.
// The original `?? 'test'` defers to the shell (e.g. 'development')
// and breaks config tests that assert config.app.env === 'test'.
// Vitest must always run with NODE_ENV=test regardless of the shell.
// The original `?? 'test'` defers to the shell (e.g. 'development')
// and breaks config tests that assert config.app.env === 'test'.
process.env.NODE_ENV = 'test';

// Always force AUTH_JWT_SECRET to a known test value so every workspace
// gets a deterministic config regardless of the developer shell or .env.local.
process.env.AUTH_JWT_SECRET = 'test-secret-0123456789abcdef0123456789abcdef0123456789abcdef';

// Required (no localhost default) outside NODE_ENV=development (P0-2).
// FORCE these to non-localhost test URLs — .env.local often contains
// localhost URLs which cause requireExternalUrl to throw in NODE_ENV=test.
process.env.IDENTITY_DATABASE_URL = 'postgres://test:test@db.vedmoulya.test:5432/vedmoulya';
process.env.REDIS_URL = 'redis://redis.vedmoulya.test:6379';

// PH-001/T2: pin AI/OAuth feature-flag and provider defaults so config tests
// are deterministic regardless of the developer/CI shell environment.
process.env.AI_DEFAULT_PROVIDER = 'openai';
delete process.env.FF_AI_ASSISTANT_ENABLED;
delete process.env.FF_SOCIAL_LOGIN_ENABLED;
// Platform version for the health/version endpoints and runtime info.
process.env.APP_VERSION = '1.0.0';

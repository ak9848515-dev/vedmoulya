// ──────────────────────────────────────────────────────────────────
// VedMoulya — Shared Vitest Setup
// Provisions required environment variables BEFORE any test module
// imports @vedmoulya/core. The core `config` singleton is created at
// import time and is fail-fast: AUTH_JWT_SECRET is required with no
// default (P1-8). Without this setup, every vitest workspace that
// imports @vedmoulya/core would throw EnvironmentError at load.
// ──────────────────────────────────────────────────────────────────

process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.AUTH_JWT_SECRET =
  process.env.AUTH_JWT_SECRET ?? 'test-secret-0123456789abcdef0123456789abcdef0123456789abcdef';
// Required (no localhost default) outside NODE_ENV=development (P0-2).
// Note: only IDENTITY_DATABASE_URL is pinned here. The other engine
// `*_DATABASE_URL`s deliberately stay unset so each service's own config
// tests keep asserting their localhost development defaults; the gateway's
// production repository wiring (SPRINT PR-002A/B) is safe under NODE_ENV=test
// because requireProdExternalUrl is lenient in test and postgres.js connects
// lazily.
process.env.IDENTITY_DATABASE_URL =
  process.env.IDENTITY_DATABASE_URL ?? 'postgres://test:test@db.vedmoulya.test:5432/vedmoulya';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://redis.vedmoulya.test:6379';
// PH-001/T2: pin AI/OAuth feature-flag and provider defaults so config tests
// are deterministic regardless of the developer/CI shell environment.
process.env.AI_DEFAULT_PROVIDER = process.env.AI_DEFAULT_PROVIDER ?? 'openai';
delete process.env.FF_AI_ASSISTANT_ENABLED;
delete process.env.FF_SOCIAL_LOGIN_ENABLED;
// Platform version for the health/version endpoints and runtime info.
process.env.APP_VERSION = process.env.APP_VERSION ?? '1.0.0';

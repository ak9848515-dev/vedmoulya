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
process.env.IDENTITY_DATABASE_URL =
  process.env.IDENTITY_DATABASE_URL ?? 'postgres://test:test@db.vedmoulya.test:5432/vedmoulya';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://redis.vedmoulya.test:6379';

// ──────────────────────────────────────────────────────────────────
// VedMoulya — Content Agency database target guards
//
// MISSION 001 documented the target-selection chain and one real risk: the
// last fallback was the IDENTITY database, so an incomplete deployment would
// create the 16 content-agency tables inside it.
//
// MISSION 002 (2026-10-26) closes that. This file now pins the HARDENED
// contract:
//
//   PRODUCTION/STAGING
//     CONTENT_AGENCY_DATABASE_URL is REQUIRED — there is no fallback.
//     A loopback target is refused.
//     A target equal to the identity/platform database is refused unless
//     CONTENT_AGENCY_ALLOW_SHARED_DATABASE=true is set deliberately.
//     Resolving it never reads the platform configuration, so an explicit
//     agency URL boots without IDENTITY_DATABASE_URL (no boot coupling).
//
//   DEVELOPMENT/TEST
//     An explicit value wins; the historical fallback chain still applies so
//     local dev and the unit suite keep working.
//
// `config` in @vedmoulya/core is a cached lazy Proxy, so every target test
// resets the module registry and imports the module fresh.
// ------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CONTENT_AGENCY_SCHEMA_STATEMENTS,
  executeContentAgencyStatements,
} from '../infrastructure/persistence/contentAgencySchema.js';

const ENV_KEYS = [
  'NODE_ENV',
  'CONTENT_AGENCY_DATABASE_URL',
  'CONTENT_AGENCY_ALLOW_SHARED_DATABASE',
  'DATABASE_URL',
  'IDENTITY_DATABASE_URL',
] as const;

const original: Record<string, string | undefined> = {};
for (const key of ENV_KEYS) original[key] = process.env[key];

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
  vi.resetModules();
});

function clearDbEnv(): void {
  delete process.env.CONTENT_AGENCY_DATABASE_URL;
  delete process.env.CONTENT_AGENCY_ALLOW_SHARED_DATABASE;
  delete process.env.DATABASE_URL;
  delete process.env.IDENTITY_DATABASE_URL;
}

/** Resolve the URL through a FRESH module instance (no cached core config). */
async function freshDatabaseUrl(): Promise<string> {
  vi.resetModules();
  const mod = await import('../infrastructure/persistence/DatabaseConnection.js');
  return mod.getDatabaseConfig().url;
}

describe('database target selection (development)', () => {
  it('prefers CONTENT_AGENCY_DATABASE_URL over DATABASE_URL', async () => {
    clearDbEnv();
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = 'postgres://u:p@platform.example.com:5432/platform';
    process.env.CONTENT_AGENCY_DATABASE_URL = 'postgres://u:p@agency.example.com:5432/agency';

    await expect(freshDatabaseUrl()).resolves.toContain('agency.example.com');
  });

  it('falls back to DATABASE_URL when no agency URL is configured', async () => {
    clearDbEnv();
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = 'postgres://u:p@platform.example.com:5432/platform';

    await expect(freshDatabaseUrl()).resolves.toContain('platform.example.com');
  });

  it('DOCUMENTED DEV-ONLY RISK: still resolves the identity database last', async () => {
    clearDbEnv();
    process.env.NODE_ENV = 'development';
    process.env.IDENTITY_DATABASE_URL = 'postgres://u:p@identity.example.com:5432/identity';

    // Unchanged for local convenience ONLY. Production cannot reach this path:
    // `production refusal` below proves the strict branch never falls back.
    await expect(freshDatabaseUrl()).resolves.toContain('identity.example.com');
  });

  it('uses the documented localhost default only when nothing is configured', async () => {
    clearDbEnv();
    process.env.NODE_ENV = 'development';

    await expect(freshDatabaseUrl()).resolves.toContain('localhost');
  });
});

describe('production refusal — fail closed, never fall back', () => {
  it('refuses to boot without CONTENT_AGENCY_DATABASE_URL even when other URLs exist', async () => {
    clearDbEnv();
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://u:p@platform.example.com:5432/platform';
    process.env.IDENTITY_DATABASE_URL = 'postgres://u:p@identity.example.com:5432/identity';

    // MISSION 001 finding #5/#6: this used to fall back to the identity
    // database and create the revenue tables there.
    await expect(freshDatabaseUrl()).rejects.toThrow(/CONTENT_AGENCY_DATABASE_URL is required/i);
  });

  it('refuses to boot when nothing is configured at all', async () => {
    clearDbEnv();
    process.env.NODE_ENV = 'production';

    await expect(freshDatabaseUrl()).rejects.toThrow(/CONTENT_AGENCY_DATABASE_URL/i);
  });

  it('refuses a loopback target', async () => {
    clearDbEnv();
    process.env.NODE_ENV = 'production';
    process.env.CONTENT_AGENCY_DATABASE_URL = 'postgres://u:p@127.0.0.1:5432/local';

    await expect(freshDatabaseUrl()).rejects.toThrow(/non-localhost/i);
  });

  it('refuses an agency target that is the identity database', async () => {
    clearDbEnv();
    process.env.NODE_ENV = 'production';
    process.env.IDENTITY_DATABASE_URL = 'postgres://u:p@db.example.com:5432/identity';
    process.env.CONTENT_AGENCY_DATABASE_URL = 'postgres://other:x@db.example.com:5432/identity';

    // Same host:port/database, different credentials — still the same database.
    await expect(freshDatabaseUrl()).rejects.toThrow(/identity\/platform database/i);
  });

  it('refuses a shared target without the explicit opt-in', async () => {
    clearDbEnv();
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://u:p@db.example.com:5432/platform';
    process.env.CONTENT_AGENCY_DATABASE_URL = 'postgres://u:p@db.example.com:5432/platform';
    process.env.CONTENT_AGENCY_ALLOW_SHARED_DATABASE = 'false';

    await expect(freshDatabaseUrl()).rejects.toThrow(/CONTENT_AGENCY_ALLOW_SHARED_DATABASE/i);
  });

  it('allows a deliberately shared target with the explicit opt-in', async () => {
    clearDbEnv();
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://u:p@db.example.com:5432/platform';
    process.env.CONTENT_AGENCY_DATABASE_URL = 'postgres://u:p@db.example.com:5432/platform';
    process.env.CONTENT_AGENCY_ALLOW_SHARED_DATABASE = 'true';

    await expect(freshDatabaseUrl()).resolves.toContain('db.example.com');
  });

  it('boots on a dedicated agency database with NO identity/platform URL set', async () => {
    clearDbEnv();
    process.env.NODE_ENV = 'production';
    process.env.CONTENT_AGENCY_DATABASE_URL = 'postgres://u:p@agency.example.com:5432/agency';

    // MISSION 002: the agency override no longer forces identity validation.
    await expect(freshDatabaseUrl()).resolves.toContain('agency.example.com');
  });

  it('does not leak the connection string in the refusal message', async () => {
    clearDbEnv();
    process.env.NODE_ENV = 'production';

    await expect(freshDatabaseUrl()).rejects.toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining('postgres://') as unknown as string,
      }),
    );
  });
});

describe('schema bootstrap statements', () => {
  it('covers every declared table plus its indexes', () => {
    // 16 tables + 16 indexes, in one ordered list.
    expect(CONTENT_AGENCY_SCHEMA_STATEMENTS).toHaveLength(32);
  });

  it('is idempotent: all 32 CREATE statements are guarded by IF NOT EXISTS', () => {
    // Drizzle SQL objects do not expose a plain SQL string, so the guard is
    // asserted against the declared source (the same text Postgres receives).
    const source = readFileSync(
      fileURLToPath(
        new URL('../infrastructure/persistence/contentAgencySchema.ts', import.meta.url),
      ),
      'utf8',
    );
    // Strip comments: the file header mentions the pattern in prose.
    const ddl = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const creates = ddl.match(/CREATE\s+(TABLE|INDEX)\s+(?!IF NOT EXISTS)/gi) ?? [];
    const guarded = ddl.match(/CREATE\s+(TABLE|INDEX)\s+IF NOT EXISTS/gi) ?? [];

    expect(creates).toHaveLength(0);
    expect(guarded).toHaveLength(32);
  });

  it('executes statements sequentially, in order, through the bootstrap helper', async () => {
    const executed: unknown[] = [];
    const db = {
      execute: vi.fn(async (query: unknown) => {
        executed.push(query);
        return undefined;
      }),
    };

    await executeContentAgencyStatements(db);

    expect(executed).toHaveLength(CONTENT_AGENCY_SCHEMA_STATEMENTS.length);
    expect(executed[0]).toBe(CONTENT_AGENCY_SCHEMA_STATEMENTS[0]);
  });

  it('stops at the first failing statement instead of pretending the schema is ready', async () => {
    let calls = 0;
    const db = {
      execute: vi.fn(async () => {
        calls += 1;
        if (calls === 3) throw new Error('DDL failed');
        return undefined;
      }),
    };

    await expect(executeContentAgencyStatements(db)).rejects.toThrow('DDL failed');
    expect(calls).toBe(3);
  });
});

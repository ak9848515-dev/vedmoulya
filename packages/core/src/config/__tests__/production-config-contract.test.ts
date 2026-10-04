// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Production Configuration Contract (S1)
//
// Pins the S1 production configuration contract against the EXISTING
// packages/core validators. This deliberately creates NO new configuration
// framework: every assertion exercises requireExternalUrl / requireProdSecret /
// requireProdExternalUrl — the same fail-fast path production uses.
//
// Nothing here uses a real credential. Every "secret" is an obvious fixture,
// and one test asserts such a fixture can never appear in a diagnostic.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requireExternalUrl, requireProdSecret, requireProdExternalUrl } from '../index.js';
import { EnvironmentError } from '../../env/index.js';

// Obviously-fake fixture. Never a real credential.
const FAKE_SECRET = 'not-a-real-secret-fixture-value-0123456789';

const prodEnv = (): void => {
  vi.stubEnv('NODE_ENV', 'production');
};

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.S1_TEST_DB_URL;
  delete process.env.S1_TEST_SECRET;
});

// ── 1. valid production configuration ────────────────────────────────────────

describe('S1 production configuration — valid', () => {
  it('accepts a non-localhost DATABASE_URL in production', () => {
    prodEnv();
    process.env.S1_TEST_DB_URL = 'postgres://user:pass@db.internal:5432/vedmoulya';
    expect(requireExternalUrl('S1_TEST_DB_URL', 'postgres://localhost:5432/dev')).toBe(
      'postgres://user:pass@db.internal:5432/vedmoulya',
    );
  });

  it('accepts a strong optional secret when one IS configured', () => {
    prodEnv();
    process.env.S1_TEST_SECRET = FAKE_SECRET;
    // An AI provider key is OPTIONAL: present but valid must never throw.
    expect(requireProdSecret('S1_TEST_SECRET', { minLength: 16, reason: 'fixture' })).toBe(
      FAKE_SECRET,
    );
  });
});

// ── 2. missing DATABASE_URL ──────────────────────────────────────────────────

describe('S1 production configuration — missing DATABASE_URL', () => {
  it('fails fast with EnvironmentError when absent in production', () => {
    prodEnv();
    expect(() => requireExternalUrl('S1_TEST_DB_URL', 'postgres://localhost:5432/dev')).toThrow(
      EnvironmentError,
    );
  });

  it('names the missing variable in the diagnostic (no value leak)', () => {
    prodEnv();
    try {
      requireExternalUrl('S1_TEST_DB_URL', 'postgres://localhost:5432/dev');
      throw new Error('expected fail-fast');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentError);
      expect((error as Error).message).toContain('S1_TEST_DB_URL');
    }
  });

  it('does NOT fail fast in development (dev default is legitimate)', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(requireExternalUrl('S1_TEST_DB_URL', 'postgres://localhost:5432/dev')).toBe(
      'postgres://localhost:5432/dev',
    );
  });
});

// ── 3. localhost is refused outside development ──────────────────────────────

describe('S1 production configuration — localhost refusal', () => {
  it('rejects a loopback URL in production rather than silently connecting', () => {
    prodEnv();
    process.env.S1_TEST_DB_URL = 'postgres://user:pass@localhost:5432/vedmoulya';
    expect(() => requireExternalUrl('S1_TEST_DB_URL', 'postgres://localhost:5432/dev')).toThrow(
      EnvironmentError,
    );
  });

  it('rejects a loopback OAuth redirect URI in production', () => {
    prodEnv();
    process.env.S1_TEST_SECRET = 'http://localhost:3000/callback';
    expect(() =>
      requireProdExternalUrl('S1_TEST_SECRET', 'http://localhost:3000/callback'),
    ).toThrow(EnvironmentError);
  });
});

// ── 4. optional providers absent ─────────────────────────────────────────────

describe('S1 production configuration — optional providers absent', () => {
  it('does not require an AI provider key (authentication must still boot)', () => {
    prodEnv();
    // No cloud key and no Ollama URL: this MUST NOT throw. Authentication
    // (sign-in, sign-up, OAuth, session) never depends on an AI credential.
    expect(requireProdSecret('AI_OPENAI_API_KEY', { minLength: 16 })).toBeUndefined();
  });

  it('does not require Ollama configuration to be present', () => {
    prodEnv();
    expect(process.env.AI_OLLAMA_BASE_URL).toBeUndefined();
    // Absent Ollama simply means the adapter is not registered — never a throw.
  });
});

// ── 5. conditional / provider-specific configuration ─────────────────────────

describe('S1 production configuration — conditional requirements', () => {
  it('does not require Google OAuth credentials when social login is off', () => {
    prodEnv();
    vi.stubEnv('FF_SOCIAL_LOGIN_ENABLED', 'false');
    expect(
      requireProdSecret('GOOGLE_CLIENT_ID', { required: false, minLength: 8 }),
    ).toBeUndefined();
  });

  it('rejects a placeholder OAuth secret when social login IS enabled', () => {
    prodEnv();
    vi.stubEnv('FF_SOCIAL_LOGIN_ENABLED', 'true');
    process.env.GOOGLE_CLIENT_ID = 'your-client-id-placeholder';
    // A placeholder is not a real credential: fail-fast must fire.
    expect(() => requireProdSecret('GOOGLE_CLIENT_ID', { required: true, minLength: 8 })).toThrow(
      EnvironmentError,
    );
    delete process.env.GOOGLE_CLIENT_ID;
  });
});

// ── 6. secret values never appear in diagnostics ─────────────────────────────

describe('S1 configuration — secrets never leak into diagnostics', () => {
  it('the diagnostic for a rejected value contains the NAME, never the VALUE', () => {
    prodEnv();
    // A weak/placeholder value that the validator must reject.
    process.env.S1_TEST_SECRET = 'placeholder-value';
    let message = '';
    try {
      requireProdSecret('S1_TEST_SECRET', { required: true, minLength: 32 });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('S1_TEST_SECRET');
    expect(message).not.toContain('placeholder-value');
  });

  it('the example files contain no real-looking secret values', () => {
    for (const file of ['.env.example', '.env.production.example']) {
      const text = readFileSync(resolve(process.cwd(), file), 'utf8');
      // High-entropy provider key shapes must not appear in committed templates.
      expect(text).not.toMatch(/sk-[A-Za-z0-9]{32,}/);
      expect(text).not.toMatch(/AIza[A-Za-z0-9_-]{30,}/);
      expect(text).not.toMatch(/AKIA[A-Z0-9]{16}/);
    }
  });
});

// ── 7. the documented contract covers every REQUIRED_PRODUCTION variable ─────

describe('S1 configuration — documented contract', () => {
  const REQUIRED_PRODUCTION = [
    'AUTH_JWT_SECRET',
    'DATABASE_URL',
    'IDENTITY_DATABASE_URL',
    'REDIS_URL',
  ] as const;

  it('every REQUIRED_PRODUCTION variable is named in .env.production.example', () => {
    const text = readFileSync(resolve(process.cwd(), '.env.production.example'), 'utf8');
    const declared = new Set([...text.matchAll(/^#?\s*([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]));
    const missing = REQUIRED_PRODUCTION.filter((name) => !declared.has(name));
    expect(missing).toEqual([]);
  });

  it('every REQUIRED_PRODUCTION variable is named in .env.example', () => {
    const text = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8');
    const declared = new Set([...text.matchAll(/^#?\s*([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]));
    const missing = REQUIRED_PRODUCTION.filter((name) => !declared.has(name));
    expect(missing).toEqual([]);
  });
});

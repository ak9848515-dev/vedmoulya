// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Canonical CORS origin policy tests (PROD-03)
//
// The policy is security-relevant: production/staging must never reflect an
// arbitrary Origin and must never accept a loopback allow-list.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { EnvironmentError } from '../../env/index.js';
import {
  CORS_ORIGIN_ENV,
  assertProductionCorsOrigin,
  describeCorsPolicy,
  hasConfiguredCorsOrigin,
  isLoopbackOrigin,
  parseCorsOrigins,
  resolveCorsOrigins,
} from '../cors.js';

const env = (values: Record<string, string | undefined>): NodeJS.ProcessEnv =>
  values as NodeJS.ProcessEnv;

/**
 * The resolver reads the allow-list through the LITERAL property name
 * `env.API_CORS_ORIGIN` (so there is no computed property access to lint
 * around). `CORS_ORIGIN_ENV` is still the exported source of truth for
 * operator-facing messages — this pins the two together, because a drift would
 * silently ignore whatever the operator configured.
 */
describe('CORS_ORIGIN_ENV — env key contract', () => {
  it('names the literal key the resolver actually reads', () => {
    expect(CORS_ORIGIN_ENV).toBe('API_CORS_ORIGIN');
  });

  it('is the key the drift guard protects (the literal read is observable)', () => {
    // Setting the literal key the resolver reads must change the policy. If the
    // resolver ever read a different key, this would stay 'permissive (*)'.
    expect(resolveCorsOrigins(env({ NODE_ENV: 'production', API_CORS_ORIGIN: '*' }))).toEqual([]);
    expect(
      resolveCorsOrigins(
        env({ NODE_ENV: 'production', API_CORS_ORIGIN: 'https://app.vedmoulya.com' }),
      ),
    ).toEqual(['https://app.vedmoulya.com']);
  });
});

describe('parseCorsOrigins', () => {
  it('returns an empty list for an absent value', () => {
    expect(parseCorsOrigins(undefined)).toEqual([]);
  });

  it('splits, trims and drops empty entries', () => {
    expect(parseCorsOrigins(' https://a.dev , ,https://b.dev, ')).toEqual([
      'https://a.dev',
      'https://b.dev',
    ]);
  });

  it('returns an empty list for a commas-only value', () => {
    expect(parseCorsOrigins(', ,')).toEqual([]);
  });
});

describe('isLoopbackOrigin', () => {
  it.each([
    ['http://localhost:3000', true],
    ['localhost', true],
    ['https://127.0.0.1:8080', true],
    ['http://0.0.0.0:3000', true],
    ['http://[::1]:3000', true],
    ['https://app.vedmoulya.com', false],
    ['https://a.dev', false],
    ['*', false],
  ])('%s → %s', (origin, expected) => {
    expect(isLoopbackOrigin(origin)).toBe(expected);
  });
});

describe('resolveCorsOrigins — development/test', () => {
  it('falls back to the permissive wildcard when unset', () => {
    expect(resolveCorsOrigins(env({ NODE_ENV: 'development' }))).toEqual(['*']);
  });

  it('keeps the wildcard when the value is commas only', () => {
    expect(resolveCorsOrigins(env({ NODE_ENV: 'test', API_CORS_ORIGIN: ', ,' }))).toEqual(['*']);
  });

  it('stays permissive when any entry is a wildcard (backward compatible)', () => {
    expect(
      resolveCorsOrigins(env({ NODE_ENV: 'development', API_CORS_ORIGIN: '*,https://a.dev' })),
    ).toEqual(['*']);
  });

  it('returns the configured allow-list', () => {
    expect(
      resolveCorsOrigins(
        env({ NODE_ENV: 'development', API_CORS_ORIGIN: 'https://a.dev, https://b.dev' }),
      ),
    ).toEqual(['https://a.dev', 'https://b.dev']);
  });

  it('allows loopback origins locally (Capacitor WebView + dev server)', () => {
    expect(
      resolveCorsOrigins(
        env({ NODE_ENV: 'development', API_CORS_ORIGIN: 'http://localhost:3000' }),
      ),
    ).toEqual(['http://localhost:3000']);
  });
});

describe('resolveCorsOrigins — production/staging', () => {
  it.each(['production', 'staging'])('denies cross-origin when %s has no allow-list', (mode) => {
    expect(resolveCorsOrigins(env({ NODE_ENV: mode }))).toEqual([]);
  });

  it('never treats a wildcard as a production policy', () => {
    expect(resolveCorsOrigins(env({ NODE_ENV: 'production', API_CORS_ORIGIN: '*' }))).toEqual([]);
  });

  it('drops loopback entries', () => {
    expect(
      resolveCorsOrigins(
        env({
          NODE_ENV: 'production',
          API_CORS_ORIGIN: 'http://localhost:3000,https://app.vedmoulya.com',
        }),
      ),
    ).toEqual(['https://app.vedmoulya.com']);
  });

  it('denies when every entry was a development origin', () => {
    expect(
      resolveCorsOrigins(env({ NODE_ENV: 'production', API_CORS_ORIGIN: 'http://localhost:3000' })),
    ).toEqual([]);
  });

  it('returns the explicit production allow-list', () => {
    expect(
      resolveCorsOrigins(
        env({ NODE_ENV: 'production', API_CORS_ORIGIN: 'https://app.vedmoulya.com' }),
      ),
    ).toEqual(['https://app.vedmoulya.com']);
  });
});

describe('assertProductionCorsOrigin — fail-fast guard', () => {
  it('accepts an unset value outside production (development fallback preserved)', () => {
    expect(() => assertProductionCorsOrigin(env({ NODE_ENV: 'development' }))).not.toThrow();
  });

  it('accepts loopback origins in development', () => {
    expect(() =>
      assertProductionCorsOrigin(
        env({ NODE_ENV: 'development', API_CORS_ORIGIN: 'http://localhost:3000' }),
      ),
    ).not.toThrow();
  });

  it('rejects a loopback allow-list in production', () => {
    expect(() =>
      assertProductionCorsOrigin(
        env({ NODE_ENV: 'production', API_CORS_ORIGIN: 'http://localhost:3000' }),
      ),
    ).toThrow(EnvironmentError);
  });

  it('rejects a loopback allow-list in staging with an actionable message', () => {
    try {
      assertProductionCorsOrigin(
        env({ NODE_ENV: 'staging', API_CORS_ORIGIN: 'https://127.0.0.1:3000' }),
      );
      throw new Error('expected assertProductionCorsOrigin to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentError);
      const message = (error as Error).message;
      expect(message).toContain('API_CORS_ORIGIN');
      expect(message).toContain('https://app.vedmoulya.com');
      // The rejected value itself is never echoed.
      expect(message).not.toContain('127.0.0.1:3000');
    }
  });

  it('does not fail-fast when production leaves the allow-list unset (runtime denies)', () => {
    expect(() => assertProductionCorsOrigin(env({ NODE_ENV: 'production' }))).not.toThrow();
  });

  it('accepts an explicit production origin', () => {
    expect(() =>
      assertProductionCorsOrigin(
        env({ NODE_ENV: 'production', API_CORS_ORIGIN: 'https://app.vedmoulya.com' }),
      ),
    ).not.toThrow();
  });
});

describe('describeCorsPolicy / hasConfiguredCorsOrigin', () => {
  it('describes a deny policy without leaking values', () => {
    const summary = describeCorsPolicy(
      env({ NODE_ENV: 'production', API_CORS_ORIGIN: 'localhost' }),
    );
    expect(summary).toBe('deny cross-origin (no allow-list configured)');
    expect(summary).not.toContain('localhost');
  });

  it('describes the permissive development policy', () => {
    expect(describeCorsPolicy(env({ NODE_ENV: 'development' }))).toBe('permissive (*)');
  });

  it('describes an allow-list by count only', () => {
    expect(
      describeCorsPolicy(
        env({ NODE_ENV: 'production', API_CORS_ORIGIN: 'https://a.dev,https://b.dev' }),
      ),
    ).toBe('allow-list (2 origins)');
  });

  it('reports whether a real (non-wildcard) origin is configured', () => {
    expect(hasConfiguredCorsOrigin(env({ API_CORS_ORIGIN: 'https://a.dev' }))).toBe(true);
    expect(hasConfiguredCorsOrigin(env({ API_CORS_ORIGIN: '*' }))).toBe(false);
    expect(hasConfiguredCorsOrigin(env({}))).toBe(false);
  });
});

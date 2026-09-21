// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — PROD-03: health endpoint error sanitization
//
// The health endpoints are unauthenticated. These tests pin the contract that
// no database error reachable from /health/live, /health/ready or /health/check
// can carry a connection string, credential, hostname or env var name.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { GENERIC_DB_ERROR, sanitizeDbError, sanitizeHealthError } from '../health-error.js';

const DSN_WITH_PASSWORD =
  'postgres://vedmoulya:s3cr3t-pass@db.prod.internal:5432/vedmoulya_identity';

describe('sanitizeDbError', () => {
  it('returns undefined for absent or blank input', () => {
    expect(sanitizeDbError(undefined)).toBeUndefined();
    expect(sanitizeDbError(null)).toBeUndefined();
    expect(sanitizeDbError('')).toBeUndefined();
    expect(sanitizeDbError('   ')).toBeUndefined();
  });

  it('never publishes a connection string, even when it is the whole message', () => {
    const out = sanitizeDbError(DSN_WITH_PASSWORD);
    expect(out).not.toContain('s3cr3t-pass');
    expect(out).not.toContain('db.prod.internal');
    expect(out).not.toContain('vedmoulya_identity');
    expect(out).toBe('Database connection unavailable');
  });

  it('never publishes a connection string embedded in a driver error', () => {
    const out = sanitizeDbError(`TypeError: Invalid URL\n  input: '${DSN_WITH_PASSWORD}'`);
    expect(out).not.toContain('s3cr3t-pass');
    expect(out).not.toContain('postgres://');
    expect(out).toBe('Database connection unavailable');
  });

  it('never publishes a password query parameter', () => {
    const out = sanitizeDbError('failed to connect to postgres://host/db?user=u&password=hunter2');
    expect(out).not.toContain('hunter2');
  });

  it('never publishes a credential-bearing Redis URL', () => {
    // The URL redaction layer runs first and collapses ANY credential-bearing
    // URL, Redis included.
    const out = sanitizeDbError('connect ECONNREFUSED redis://default:hunter2@redis.prod:6379');
    expect(out).not.toContain('hunter2');
    expect(out).not.toContain('redis.prod');
    expect(out).toBe('Database connection unavailable');
  });

  it('reports a credential-free Redis failure as missing infrastructure', () => {
    expect(sanitizeDbError('connect ECONNREFUSED redis://redis.prod:6379')).toBe(
      'Required infrastructure not configured',
    );
  });

  it('does not name environment variables', () => {
    for (const message of [
      'IDENTITY_DATABASE_URL is not set',
      'REDIS_URL is required outside NODE_ENV=development',
    ]) {
      const out = sanitizeDbError(message) as string;
      expect(out).not.toContain('IDENTITY_DATABASE_URL');
      expect(out).not.toContain('REDIS_URL');
      expect(out).not.toContain('NODE_ENV');
    }
  });

  it('keeps an actionable-but-generic category for common failures', () => {
    expect(sanitizeDbError('connect ECONNREFUSED 10.0.0.4:5432')).toBe('Database unreachable');
    expect(sanitizeDbError('getaddrinfo ENOTFOUND db')).toBe('Database unreachable');
    expect(sanitizeDbError('password authentication failed for user "vedmoulya"')).toBe(
      'Database authentication failed',
    );
    expect(sanitizeDbError('Database readiness probe timed out')).toBe(
      'Database readiness probe timed out',
    );
  });

  it('falls back to a generic message for anything unrecognized', () => {
    expect(sanitizeDbError('something entirely unexpected')).toBe(GENERIC_DB_ERROR);
  });

  it('stays credential-free when applied twice (re-sanitizing is safe)', () => {
    for (const raw of [
      DSN_WITH_PASSWORD,
      `TypeError: Invalid URL\n  input: '${DSN_WITH_PASSWORD}'`,
      'connect ECONNREFUSED redis://default:hunter2@redis.prod:6379',
      'unrecognized failure mentioning db.prod.internal:5432',
    ]) {
      const once = sanitizeDbError(raw) as string;
      const twice = sanitizeDbError(once) as string;
      for (const leak of [
        's3cr3t-pass',
        'hunter2',
        'postgres://',
        'redis://',
        'db.prod.internal',
      ]) {
        expect(once).not.toContain(leak);
        expect(twice).not.toContain(leak);
      }
    }
  });

  it('never echoes the user data it was given', () => {
    const out = sanitizeDbError('user alice@example.com has no access') as string;
    expect(out).not.toContain('alice@example.com');
  });
});

describe('sanitizeHealthError', () => {
  it('handles undefined and null', () => {
    expect(sanitizeHealthError(undefined)).toBeUndefined();
    expect(sanitizeHealthError(null)).toBeUndefined();
  });

  it('sanitizes a thrown Error message', () => {
    const out = sanitizeHealthError(new Error(DSN_WITH_PASSWORD));
    expect(out).not.toContain('s3cr3t-pass');
    expect(out).toBe('Database connection unavailable');
  });

  it('sanitizes a thrown string', () => {
    expect(sanitizeHealthError('connect ECONNREFUSED 127.0.0.1:5432')).toBe('Database unreachable');
  });

  it('reduces a non-Error throwable to the generic message instead of stringifying it', () => {
    // An exotic rejection object must not be able to smuggle a credential
    // through `String(value)`.
    expect(sanitizeHealthError({ input: DSN_WITH_PASSWORD })).toBe(GENERIC_DB_ERROR);
    expect(sanitizeHealthError({ input: DSN_WITH_PASSWORD })).not.toContain('s3cr3t-pass');
  });
});

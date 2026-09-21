// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Connection-URL safety tests (PROD-03)
//
// Regression guards for two live findings:
//   1. a quote-wrapped DATABASE_URL crashed pool creation (ERR_INVALID_URL)
//   2. the driver error printed the full DSN (password included) into the log
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { databaseManager } from '../index.js';
import {
  normalizeConnectionUrl,
  redactConnectionStrings,
  safeConnectionError,
} from '../connection-url.js';

const DSN = 'postgresql://neondb_owner:sup3rs3cret@db.prod.internal:5432/vedmoulya?sslmode=require';

describe('normalizeConnectionUrl', () => {
  it('returns an empty string for absent values', () => {
    expect(normalizeConnectionUrl(undefined)).toBe('');
    expect(normalizeConnectionUrl(null)).toBe('');
    expect(normalizeConnectionUrl('   ')).toBe('');
  });

  it('passes an unquoted value through unchanged', () => {
    expect(normalizeConnectionUrl(DSN)).toBe(DSN);
  });

  it('strips one matching pair of surrounding double quotes', () => {
    expect(normalizeConnectionUrl(`"${DSN}"`)).toBe(DSN);
  });

  it('strips surrounding single quotes and whitespace', () => {
    expect(normalizeConnectionUrl(`  '${DSN}'  `)).toBe(DSN);
  });

  it('keeps mismatched quotes (not a quoting wrapper)', () => {
    expect(normalizeConnectionUrl(`"${DSN}'`)).toBe(`"${DSN}'`);
  });

  it('leaves inner quotes of an unquoted value intact', () => {
    const value = 'postgres://u:p@host/db?options="-c%20x"';
    expect(normalizeConnectionUrl(value)).toBe(value);
  });
});

describe('redactConnectionStrings', () => {
  it('collapses a credential-bearing connection string', () => {
    const out = redactConnectionStrings(`failed to connect: ${DSN}`);
    expect(out).not.toContain('sup3rs3cret');
    expect(out).not.toContain('db.prod.internal');
    expect(out).toContain('[REDACTED_CONNECTION_STRING]');
  });

  it('collapses a credential-bearing URL inside a quoted error field', () => {
    const out = redactConnectionStrings(JSON.stringify({ input: DSN, code: 'ERR_INVALID_URL' }));
    expect(out).not.toContain('sup3rs3cret');
    expect(out).toContain('ERR_INVALID_URL');
  });

  it('redacts redis URLs with credentials too', () => {
    const out = redactConnectionStrings('redis://default:hunter2@redis.prod.internal:6379');
    expect(out).not.toContain('hunter2');
  });

  it('masks password query parameters', () => {
    const out = redactConnectionStrings('postgres://host/db?user=u&password=hunter2');
    expect(out).not.toContain('hunter2');
    expect(out).toContain('password=[REDACTED]');
  });

  it('keeps ordinary URLs readable for operators', () => {
    const text = 'deployed at https://app.vedmoulya.com and otlp http://collector:4318';
    expect(redactConnectionStrings(text)).toBe(text);
  });

  it('is a no-op for text without a scheme', () => {
    expect(redactConnectionStrings('plain log line')).toBe('plain log line');
  });
});

describe('safeConnectionError', () => {
  it('keeps a reason that carries no credentials', () => {
    expect(safeConnectionError(new TypeError('Invalid URL'))).toBe('Invalid URL');
  });

  it('withholds a message that is nothing but a DSN', () => {
    const error = Object.assign(new TypeError(DSN), { code: 'ERR_INVALID_URL', input: DSN });
    const reason = safeConnectionError(error);
    expect(reason).not.toContain('sup3rs3cret');
    expect(reason).toMatch(/withheld/);
  });

  it('handles non-Error values without throwing', () => {
    expect(safeConnectionError('connection refused')).toBe('connection refused');
    expect(safeConnectionError(undefined)).toBe('connection failed');
  });
});

describe('databaseManager.getPool — connection-string safety', () => {
  it('accepts a quote-wrapped URL instead of crashing on it', () => {
    const sql = databaseManager.getPool({
      url: `"postgres://user:secret@db.prod.internal:5432/vedmoulya"`,
      applicationName: 'prod03-quoted-url',
    });
    expect(typeof sql).toBe('function');
  });

  it('never includes the connection string in the error it throws', () => {
    let thrown: Error | undefined;
    try {
      databaseManager.getPool({
        url: 'postgres://user:sup3rs3cret@%zz:not-a-port/db',
        applicationName: 'prod03-invalid-url',
      });
      throw new Error('expected getPool to throw for an unparseable URL');
    } catch (error) {
      thrown = error as Error;
    }
    expect(thrown).toBeInstanceOf(Error);
    // The credential must never survive into the thrown message...
    expect(thrown?.message).not.toContain('sup3rs3cret');
    expect(thrown?.message).not.toContain('user:');
    // ...and the redacted REASON must still be reported so the misconfiguration
    // is diagnosable without the value.
    expect(thrown?.message).toMatch(/valid connection string/i);
    expect(thrown?.message).toMatch(/URI malformed|Invalid URL/i);
  });
});

// ──────────────────────────────────────────────────────────────────
// VedMoulya — Agent Execution Intelligence: Sanitization Tests
// Guarantees: API keys, tokens, passwords and OAuth secrets never reach
// traces; long opaque credential-like values are redacted; free text is
// length-bounded.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { safeSlice, sanitizeTraceText } from '../domain/sanitize.js';

describe('sanitizeTraceText', () => {
  it('redacts api keys, tokens, passwords and authorization headers', () => {
    const text = [
      'api_key=sk-live-abcdef',
      'API-KEY: AKIAIOSFODNN7EXAMPLE',
      'token: gh_abcdefghijklmnopqrstuvwxyz1234',
      'password=hunter2secret',
      'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature',
      'client_secret=super-secret-value',
    ].join(' | ');
    const cleaned = sanitizeTraceText(text);
    expect(cleaned).not.toContain('sk-live-abcdef');
    expect(cleaned).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(cleaned).not.toContain('gh_abcdefghijklmnopqrstuvwxyz1234');
    expect(cleaned).not.toContain('hunter2secret');
    expect(cleaned).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(cleaned).not.toContain('super-secret-value');
    expect(cleaned).toContain('[REDACTED]');
  });

  it('redacts extraSensitive markers supplied by the caller', () => {
    const liveKey = 'AIzaSyLiveSecretValue1234567890';
    const cleaned = sanitizeTraceText(`result contained ${liveKey} at the end`, {
      extraSensitive: [liveKey],
    });
    expect(cleaned).not.toContain(liveKey);
    expect(cleaned).toContain('[REDACTED]');
  });

  it('bounds length deterministically', () => {
    const long = 'a'.repeat(5_000);
    const cleaned = sanitizeTraceText(long, { maxLength: 100 });
    expect(cleaned.length).toBeLessThanOrEqual(101);
  });
});

describe('safeSlice', () => {
  it('sanitizes and slices output fed to later steps', () => {
    const output = `here is a report with token=abc123token and ${'more'.repeat(2_000)}`;
    const sliced = safeSlice(output, 500);
    expect(sliced).not.toContain('abc123token');
    expect(sliced.length).toBeLessThanOrEqual(501);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: VerificationToken
// SPRINT-045 — PRODUCTION EMAIL VERIFICATION
// Covers token generation (cryptographically strong), deterministic hashing
// (only the hash is stored), expiry, and link building.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  createVerificationToken,
  hashVerificationToken,
  buildVerificationLink,
  VERIFICATION_TOKEN_TTL_MS,
} from '../src/auth/VerificationToken.js';

describe('VerificationToken', () => {
  it('generates a strong raw token with a deterministic hash and 24h expiry', () => {
    const now = new Date('2026-08-18T00:00:00Z');
    const value = createVerificationToken(now);

    expect(value.token.length).toBeGreaterThanOrEqual(43); // 32 bytes → base64url
    expect(value.tokenHash).toBe(hashVerificationToken(value.token));
    expect(value.expiresAt.getTime()).toBe(now.getTime() + VERIFICATION_TOKEN_TTL_MS);
  });

  it('produces distinct tokens on every call', () => {
    const a = createVerificationToken();
    const b = createVerificationToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });

  it('never embeds the raw token in the hash (one-way)', () => {
    const value = createVerificationToken();
    expect(value.tokenHash).not.toContain(value.token);
  });

  it('builds a verification link against the app origin without double slashes', () => {
    const link = buildVerificationLink('https://app.vedmoulya.com/', 'tok-123');
    expect(link).toBe('https://app.vedmoulya.com/verify-email?token=tok-123');
  });

  it('URL-encodes token characters in the link', () => {
    const link = buildVerificationLink('http://localhost:3000', 'a/b+c?d');
    expect(link).toContain('token=a%2Fb%2Bc%3Fd');
  });
});

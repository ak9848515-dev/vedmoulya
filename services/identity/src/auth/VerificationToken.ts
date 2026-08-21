// ──────────────────────────────────────────────────────────────────
// VedMoulya — Email Verification Token
// Cryptographically strong, single-use verification tokens with hashed
// storage (SPRINT-045 — PRODUCTION EMAIL VERIFICATION).
// The raw token is shown ONLY in the emailed link and never stored or
// logged; the store persists only its SHA-256 hash.
// ──────────────────────────────────────────────────────────────────

import { createHash, randomBytes } from 'node:crypto';

export const VERIFICATION_TOKEN_BYTES = 32;
export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export interface VerificationTokenValue {
  /** Raw token — send this in the email link only. */
  token: string;
  /** SHA-256 hex digest of the token — this is what the store persists. */
  tokenHash: string;
  /** ISO timestamp after which the token is no longer valid. */
  expiresAt: Date;
}

/** Generate a fresh verification token (raw + hash + expiry). */
export function createVerificationToken(now: Date = new Date()): VerificationTokenValue {
  const token = randomBytes(VERIFICATION_TOKEN_BYTES).toString('base64url');
  return {
    token,
    tokenHash: hashVerificationToken(token),
    expiresAt: new Date(now.getTime() + VERIFICATION_TOKEN_TTL_MS),
  };
}

/** Deterministic SHA-256 hex hash of a raw token (lookup + comparison key). */
export function hashVerificationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Build the email verification link for a given app origin. */
export function buildVerificationLink(origin: string, token: string): string {
  const base = origin.replace(/\/+$/, '');
  return `${base}/verify-email?token=${encodeURIComponent(token)}`;
}

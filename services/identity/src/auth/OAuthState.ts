// ──────────────────────────────────────────────────────────────────
// VedMoulya — Google OAuth State (SERVER-SIDE CSRF CORRELATION)
//
// The OAuth `state` parameter is a CSRF token. The server mints it before
// sending the user to Google and MUST verify on the callback that the value
// it receives is one IT actually issued. A client-only comparison keeps the
// client honest but cannot stop a callback the server is asked to process
// with no server-issued state at all.
//
// This mirrors the EXISTING email-verification design (SPRINT-045): a
// cryptographically strong random value is handed to the browser, only its
// SHA-256 hash is persisted, and consumption is single-use + time-bounded.
// Nothing here is a second auth system — it is the ESTABLISHED
// hash-and-consume pattern with a lifecycle appropriate to a redirect.
// ──────────────────────────────────────────────────────────────────

import { createHash, randomBytes } from 'node:crypto';

/** 32 random bytes — the same strength as the email-verification token. */
export const OAUTH_STATE_BYTES = 32;

/** A redirect round-trip is seconds; 10 minutes is generous, and short
 *  enough that a leaked state is effectively useless by replay time. */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export interface OAuthStateValue {
  /** Raw state — only ever placed in the Google authorization URL. */
  state: string;
  /** SHA-256 hex digest of the raw state — this is what the store persists. */
  stateHash: string;
  /** Instant after which the state is no longer valid. */
  expiresAt: Date;
}

/** Mint a fresh, unpredictable OAuth state (raw + hash + expiry). */
export function createOAuthState(now: Date = new Date()): OAuthStateValue {
  const state = randomBytes(OAUTH_STATE_BYTES).toString('base64url');
  return {
    state,
    stateHash: hashOAuthState(state),
    expiresAt: new Date(now.getTime() + OAUTH_STATE_TTL_MS),
  };
}

/** Deterministic SHA-256 hex digest of a raw state (the lookup/consume key). */
export function hashOAuthState(state: string): string {
  return createHash('sha256').update(state).digest('hex');
}

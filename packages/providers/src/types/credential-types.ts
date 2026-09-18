// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider Credential Types
// PROVIDER-01 — Decisions 3 & 4 (credential security / resolution)
//
// A user's AI-provider credential is a SECRET. It is:
//   - encrypted at rest (never stored as plaintext),
//   - owned per-user (a record can only be read by its owner),
//   - never returned to the browser after persistence,
//   - never logged, never placed in a URL, never echoed in an error.
//
// The ONLY shape that ever reaches persistence is `SealedProviderCredential`
// (AES-256-GCM ciphertext + iv + auth tag). The plaintext exists transiently
// inside the server-side credential service and in the outbound provider
// request — nowhere else.
//
// Resolution follows a strict, explicit order, and the caller ALWAYS learns
// WHICH source supplied the secret:
//   1. the user's stored credential  → 'USER'
//   2. the platform/deployment credential → 'PLATFORM'
//   3. nothing available            → 'NONE'
// The two are never silently mixed.
// ──────────────────────────────────────────────────────────────────

/** Where the credential that would be used came from. Never a secret. */
export type ProviderCredentialSource = 'USER' | 'PLATFORM' | 'NONE';

/** Can this source actually authenticate a request? */
export function isUsableCredentialSource(source: ProviderCredentialSource): boolean {
  return source !== 'NONE';
}

/**
 * The at-rest form of a credential. Every field except `algorithm` and
 * `keyVersion` is base64 ciphertext material — there is no readable secret.
 */
export interface SealedProviderCredential {
  algorithm: 'aes-256-gcm';
  /** base64 — 12-byte initialisation vector (unique per seal). */
  iv: string;
  /** base64 — 16-byte GCM authentication tag. */
  authTag: string;
  /** base64 — the encrypted secret. */
  ciphertext: string;
  /** Cipher version; a rotation invalidates earlier versions. */
  keyVersion: number;
}

/**
 * Non-secret metadata about a stored credential, safe to hand to any
 * server-side caller (and, once a status projection exists, to the UI).
 */
export interface ProviderCredentialMetadata {
  userId: string;
  family: string;
  source: ProviderCredentialSource;
  keyVersion: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * The outcome of credential resolution. `secret` is present ONLY when a
 * source was found, and must never cross the server boundary.
 */
export interface ResolvedProviderCredential {
  source: ProviderCredentialSource;
  secret?: string;
}

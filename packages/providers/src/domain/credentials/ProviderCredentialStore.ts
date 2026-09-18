// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider Credential Store (Port)
// PROVIDER-01 — Decision 3
//
// Owner-scoped persistence for ENCRYPTED provider credentials. Every record is
// keyed by (userId, family) — there is no cross-user read surface, so owner
// isolation is structural rather than something callers must remember.
//
// The port only ever carries `SealedProviderCredential`: a store implementation
// can never see (or accidentally persist) a plaintext secret.
// ──────────────────────────────────────────────────────────────────

import type { SealedProviderCredential } from '../../types/credential-types.js';

export interface ProviderCredentialRecord {
  userId: string;
  family: string;
  sealed: SealedProviderCredential;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderCredentialStore {
  /** Create or replace the owner's sealed credential for one family. */
  put(record: ProviderCredentialRecord): Promise<void>;
  /** The owner's sealed credential, or null when none is stored. */
  get(userId: string, family: string): Promise<ProviderCredentialRecord | null>;
  /** Remove the owner's credential (idempotent). */
  remove(userId: string, family: string): Promise<void>;
  /** Families this owner has a stored credential for (no material). */
  listFamilies(userId: string): Promise<string[]>;
}

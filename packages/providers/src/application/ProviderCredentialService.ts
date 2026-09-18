// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider Credential Service
// PROVIDER-01 — Decisions 3 & 4
//
// The application layer that owns the credential lifecycle:
//
//   store()        — validate + encrypt + persist a user credential
//   resolve()      — user credential → platform credential → unavailable
//   delete()       — forget the user's credential
//   hasCredential()— existence only (no material)
//   rotate()       — replace with a new secret under a fresh IV
//
// SECURITY CONTRACT (enforced here, not by callers):
//   - plaintext never reaches the store (only the cipher's output does),
//   - a record that fails to decrypt (rotated deployment key / tampering) is
//     treated as ABSENT and resolution falls through — it never fabricates a
//     working credential and never surfaces the error to a browser,
//   - `secret` is returned only to the server-side caller that asked to
//     resolve, and the caller always learns the SOURCE.
// ──────────────────────────────────────────────────────────────────

import type {
  ProviderCredentialStore,
  ProviderCredentialRecord,
} from '../domain/credentials/ProviderCredentialStore.js';
import type { ProviderCredentialCipher } from '../domain/credentials/credential-cipher.js';
import type {
  ProviderCredentialMetadata,
  ResolvedProviderCredential,
} from '../types/credential-types.js';

export class ProviderCredentialService {
  constructor(
    private readonly credentials: ProviderCredentialStore,
    private readonly cipher: ProviderCredentialCipher,
  ) {}

  /** Encrypt and persist the owner's credential for one provider family. */
  async store(userId: string, family: string, secret: string): Promise<ProviderCredentialMetadata> {
    const trimmed = secret.trim();
    if (trimmed === '') {
      throw new Error('Provider credential must not be blank');
    }
    const existing = await this.credentials.get(userId, family);
    const now = new Date().toISOString();
    const createdAt = existing?.createdAt ?? now;
    const sealed = this.cipher.seal(trimmed);
    await this.credentials.put({ userId, family, sealed, createdAt, updatedAt: now });
    return {
      userId,
      family,
      source: 'USER',
      keyVersion: sealed.keyVersion,
      createdAt,
      updatedAt: now,
    };
  }

  /**
   * Replace an existing credential with a new secret. Semantically identical
   * to `store` (a fresh IV + auth tag), but named for the operator intent so
   * key rotation is explicit at the call site.
   */
  async rotate(
    userId: string,
    family: string,
    secret: string,
  ): Promise<ProviderCredentialMetadata> {
    return this.store(userId, family, secret);
  }

  /**
   * Resolve the credential to use for (owner, family), in the documented
   * order: the user's stored credential first, then the platform credential.
   * `platformSecret` is the deployment's own key for that family (or
   * undefined) — the service never reads the environment itself, so the
   * resolution order stays testable and the two sources are never mixed.
   */
  async resolve(
    userId: string,
    family: string,
    platformSecret?: string,
  ): Promise<ResolvedProviderCredential> {
    const record = await this.credentials.get(userId, family);
    if (record) {
      try {
        return { source: 'USER', secret: this.cipher.open(record.sealed) };
      } catch {
        // Undecryptable (rotated key / tampered record): treat as absent and
        // let the platform credential answer — never claim a user credential
        // we cannot actually use.
      }
    }
    const platform = platformSecret?.trim();
    if (platform !== undefined && platform !== '') {
      return { source: 'PLATFORM', secret: platform };
    }
    return { source: 'NONE' };
  }

  /** Whether the owner has a stored credential for this family (no material). */
  async hasCredential(userId: string, family: string): Promise<boolean> {
    return (await this.credentials.get(userId, family)) !== null;
  }

  /** Forget the owner's credential for one family. Idempotent. */
  async delete(userId: string, family: string): Promise<void> {
    await this.credentials.remove(userId, family);
  }

  /**
   * Non-secret metadata for the owner's credential — safe for status
   * projections. Never includes the secret, its length, or any fragment.
   */
  async metadata(userId: string, family: string): Promise<ProviderCredentialMetadata | null> {
    const record = await this.credentials.get(userId, family);
    return record ? toMetadata(record) : null;
  }

  /** Families the owner has a stored credential for (no material). */
  async listFamilies(userId: string): Promise<string[]> {
    return this.credentials.listFamilies(userId);
  }
}

function toMetadata(record: ProviderCredentialRecord): ProviderCredentialMetadata {
  return {
    userId: record.userId,
    family: record.family,
    source: 'USER',
    keyVersion: record.sealed.keyVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

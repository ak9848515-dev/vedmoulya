// ──────────────────────────────────────────────────────────────────
// VedMoulya — In-Memory Provider Credential Store
// PROVIDER-01 — Decision 3
//
// Map-backed owner-scoped store for tests, dev, and single-process
// deployments. Mirrors the InMemoryProviderPreferencesStore pattern.
//
// It records CIPHERTEXT ONLY (the caller seals before calling put), so even the
// in-memory double can be asserted against for "no plaintext at rest".
// ──────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/require-await -- In-memory store
   implements the Promise-returning port with a synchronous Map body. */

import type {
  ProviderCredentialRecord,
  ProviderCredentialStore,
} from '../domain/credentials/ProviderCredentialStore.js';

function recordKey(userId: string, family: string): string {
  // A delimiter that cannot appear in either id keeps the key unambiguous.
  return `${userId}\u0000${family}`;
}

function copy(record: ProviderCredentialRecord): ProviderCredentialRecord {
  return { ...record, sealed: { ...record.sealed } };
}

export class InMemoryProviderCredentialStore implements ProviderCredentialStore {
  private readonly store = new Map<string, ProviderCredentialRecord>();

  async put(record: ProviderCredentialRecord): Promise<void> {
    this.store.set(recordKey(record.userId, record.family), copy(record));
  }

  async get(userId: string, family: string): Promise<ProviderCredentialRecord | null> {
    const record = this.store.get(recordKey(userId, family));
    return record ? copy(record) : null;
  }

  async remove(userId: string, family: string): Promise<void> {
    this.store.delete(recordKey(userId, family));
  }

  async listFamilies(userId: string): Promise<string[]> {
    return [...this.store.values()]
      .filter((record) => record.userId === userId)
      .map((record) => record.family)
      .sort();
  }

  /** Owner-scoped enumeration for operator tooling/tests (never exposed over HTTP). */
  async listForOwner(userId: string): Promise<ProviderCredentialRecord[]> {
    return [...this.store.values()].filter((record) => record.userId === userId).map(copy);
  }
}

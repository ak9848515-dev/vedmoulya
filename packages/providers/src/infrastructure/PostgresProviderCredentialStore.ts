// ──────────────────────────────────────────────────────────────────
// VedMoulya — Postgres Provider Credential Store
// PROVIDER-01 — Decision 3 (encrypted at rest, per-user ownership)
//
// Postgres-backed implementation of the ProviderCredentialStore contract,
// following the same shape as PostgresProviderRepository (ensureTable +
// parameterized queries).
//
// The row holds ONLY sealed material — algorithm, iv, auth tag and ciphertext.
// There is no column a plaintext credential could be written to, so a bug in a
// caller cannot leak a secret into the database.
// ──────────────────────────────────────────────────────────────────

import type postgres from 'postgres';
import type {
  ProviderCredentialRecord,
  ProviderCredentialStore,
} from '../domain/credentials/ProviderCredentialStore.js';
import type { SealedProviderCredential } from '../types/credential-types.js';

interface ProviderCredentialRow {
  user_id: string;
  family: string;
  algorithm: string;
  iv: string;
  auth_tag: string;
  ciphertext: string;
  key_version: number;
  created_at: string | Date;
  updated_at: string | Date;
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export class PostgresProviderCredentialStore implements ProviderCredentialStore {
  private readonly sql: postgres.Sql;

  constructor(sql: postgres.Sql) {
    this.sql = sql;
  }

  /** Safe on every start (IF NOT EXISTS). In production this should be a migration. */
  async ensureTable(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS provider_credentials (
        user_id TEXT NOT NULL,
        family TEXT NOT NULL,
        algorithm TEXT NOT NULL,
        iv TEXT NOT NULL,
        auth_tag TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        key_version INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, family)
      )
    `;
  }

  async put(record: ProviderCredentialRecord): Promise<void> {
    const { sealed } = record;
    await this.sql`
      INSERT INTO provider_credentials (
        user_id, family, algorithm, iv, auth_tag, ciphertext, key_version,
        created_at, updated_at
      ) VALUES (
        ${record.userId}, ${record.family}, ${sealed.algorithm}, ${sealed.iv},
        ${sealed.authTag}, ${sealed.ciphertext}, ${sealed.keyVersion},
        ${record.createdAt}, ${record.updatedAt}
      )
      ON CONFLICT (user_id, family) DO UPDATE
      SET
        algorithm = EXCLUDED.algorithm,
        iv = EXCLUDED.iv,
        auth_tag = EXCLUDED.auth_tag,
        ciphertext = EXCLUDED.ciphertext,
        key_version = EXCLUDED.key_version,
        updated_at = EXCLUDED.updated_at
    `;
  }

  async get(userId: string, family: string): Promise<ProviderCredentialRecord | null> {
    const rows = await this.sql<ProviderCredentialRow[]>`
      SELECT * FROM provider_credentials WHERE user_id = ${userId} AND family = ${family}
    `;
    const row = rows[0];
    return row ? this.rowToRecord(row) : null;
  }

  async remove(userId: string, family: string): Promise<void> {
    await this.sql`
      DELETE FROM provider_credentials WHERE user_id = ${userId} AND family = ${family}
    `;
  }

  async listFamilies(userId: string): Promise<string[]> {
    const rows = await this.sql<{ family: string }[]>`
      SELECT family FROM provider_credentials WHERE user_id = ${userId} ORDER BY family
    `;
    return rows.map((row) => row.family);
  }

  private rowToRecord(row: ProviderCredentialRow): ProviderCredentialRecord {
    const sealed: SealedProviderCredential = {
      algorithm: 'aes-256-gcm',
      iv: row.iv,
      authTag: row.auth_tag,
      ciphertext: row.ciphertext,
      keyVersion: row.key_version,
    };
    return {
      userId: row.user_id,
      family: row.family,
      sealed,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    };
  }
}

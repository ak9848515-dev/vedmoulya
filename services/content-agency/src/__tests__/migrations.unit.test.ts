// ──────────────────────────────────────────────────────────────────
// VedMoulya — Migration registry guards (MISSION 002)
//
// These run without a database: they pin the invariants the runner relies on
// (ordering, unique versions, stable checksums) and the ordering rules that
// make a ledger trustworthy.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import {
  CONTENT_AGENCY_MIGRATIONS,
  migrationChecksum,
} from '../infrastructure/persistence/migrations/MigrationRunner.js';

describe('content-agency migration registry', () => {
  it('is ordered by strictly increasing version', () => {
    const versions = CONTENT_AGENCY_MIGRATIONS.map((m) => m.version);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(new Set(versions).size).toBe(versions.length);
    expect(versions[0]).toBe(1);
  });

  it('names every migration uniquely', () => {
    const names = CONTENT_AGENCY_MIGRATIONS.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('has a stable checksum per migration', () => {
    for (const migration of CONTENT_AGENCY_MIGRATIONS) {
      expect(migrationChecksum(migration)).toBe(migrationChecksum(migration));
      expect(migrationChecksum(migration)).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('changes the checksum when the statements change (drift detection works)', () => {
    const [first] = CONTENT_AGENCY_MIGRATIONS;
    if (!first) throw new Error('registry is empty');
    const changed = { ...first, statements: [...first.statements, sql`SELECT 1`] };
    expect(migrationChecksum(changed)).not.toBe(migrationChecksum(first));
  });

  it('never ships a destructive statement (no DROP/TRUNCATE/DELETE)', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    for (const file of ['0002-payment-integrity.ts', '0003-payment-foreign-keys.ts']) {
      const source = readFileSync(
        fileURLToPath(new URL(`../infrastructure/persistence/migrations/${file}`, import.meta.url)),
        'utf8',
      );
      const ddl = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(ddl).not.toMatch(/\bDROP\s+(TABLE|COLUMN|SCHEMA)\b/i);
      expect(ddl).not.toMatch(/\bTRUNCATE\b/i);
      expect(ddl).not.toMatch(/\bDELETE\s+FROM\b/i);
    }
  });
});

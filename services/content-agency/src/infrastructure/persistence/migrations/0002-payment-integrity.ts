// ──────────────────────────────────────────────────────────────────
// 0002 — Payment integrity: idempotency, evidence, integer money
//
// Adds, additively (no column is dropped or retyped):
//   • amount_minor (bigint) on invoices and payments — the authoritative
//     integer minor-unit amount; `amount` stays as the display mirror so no
//     existing reader breaks;
//   • payment status (recorded | verified) with a CHECK constraint;
//   • the idempotency key, its details fingerprint and the evidence columns;
//   • UNIQUE (user_id, idempotency_key) — the database-level guarantee that a
//     retried payment cannot be recorded twice;
//   • UNIQUE (user_id, evidence_reference) — the same receipt or processor
//     transaction can never back two payments;
//   • the invoice index settlement needs.
//
// Backfill is deliberately conservative: existing payments get their minor
// amount derived in SQL (`round((amount * 100)::numeric)`), and they keep
// status `recorded` because no evidence was ever captured for them. They are
// therefore readable and counted as *recorded* money, never as verified
// revenue.
// ──────────────────────────────────────────────────────────────────

import { sql } from 'drizzle-orm';
import type { ContentAgencyMigration } from './types.js';

export const migration0002: ContentAgencyMigration = {
  version: 2,
  name: 'payment_integrity',
  statements: [
    sql`ALTER TABLE content_agency_invoices ADD COLUMN IF NOT EXISTS amount_minor bigint`,

    sql`ALTER TABLE client_ops_payments ADD COLUMN IF NOT EXISTS amount_minor bigint`,
    sql`ALTER TABLE client_ops_payments ADD COLUMN IF NOT EXISTS status varchar(16) NOT NULL DEFAULT 'recorded'`,
    sql`ALTER TABLE client_ops_payments ADD COLUMN IF NOT EXISTS idempotency_key varchar(200)`,
    sql`ALTER TABLE client_ops_payments ADD COLUMN IF NOT EXISTS details_fingerprint varchar(64)`,
    sql`ALTER TABLE client_ops_payments ADD COLUMN IF NOT EXISTS evidence_kind varchar(32)`,
    sql`ALTER TABLE client_ops_payments ADD COLUMN IF NOT EXISTS evidence_reference varchar(200)`,
    sql`ALTER TABLE client_ops_payments ADD COLUMN IF NOT EXISTS evidence_reviewed_by varchar(120)`,
    sql`ALTER TABLE client_ops_payments ADD COLUMN IF NOT EXISTS evidence_reviewed_at timestamp`,
    sql`ALTER TABLE client_ops_payments ADD COLUMN IF NOT EXISTS verified_at timestamp`,

    // Backfill in SQL (never in JS floats). Idempotent: only NULL rows.
    sql`UPDATE content_agency_invoices SET amount_minor = round((amount * 100)::numeric)::bigint WHERE amount_minor IS NULL AND amount IS NOT NULL`,
    sql`UPDATE client_ops_payments SET amount_minor = round((amount * 100)::numeric)::bigint WHERE amount_minor IS NULL AND amount IS NOT NULL`,

    sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cpay_status_chk') THEN
          ALTER TABLE client_ops_payments
            ADD CONSTRAINT cpay_status_chk CHECK (status IN ('recorded', 'verified'));
        END IF;
      END $$;
    `,

    sql`CREATE INDEX IF NOT EXISTS cpay_invoice_idx ON client_ops_payments (invoice_id)`,
    // NULL keys never conflict in PostgreSQL, so legacy rows (key NULL) are
    // unaffected while every new payment is deduplicated.
    sql`CREATE UNIQUE INDEX IF NOT EXISTS cpay_user_idem_uq ON client_ops_payments (user_id, idempotency_key)`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS cpay_user_evref_uq ON client_ops_payments (user_id, evidence_reference)`,
  ],
};

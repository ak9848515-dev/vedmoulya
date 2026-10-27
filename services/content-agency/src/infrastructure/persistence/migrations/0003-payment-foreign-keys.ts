// ──────────────────────────────────────────────────────────────────
// 0003 — Referential integrity for payments
//
// The 16-table surface had no foreign keys at all, so a payment could
// reference an invoice that never existed. This adds exactly one FK —
// `client_ops_payments.invoice_id → content_agency_invoices(id)` — because
// that is the one relation the domain model actually guarantees: `addPayment`
// refuses to run unless the invoice is readable by the caller.
//
// It is added `NOT VALID`: PostgreSQL still enforces it for every new row,
// but rows written before the constraint existed do not abort an otherwise
// healthy migration. A second statement VALIDATEs it only when no orphan rows
// exist, so a clean database converges to a fully validated constraint and a
// database with historical orphans stays honest instead of failing to boot.
//
// No client_id FK is added. `createInvoice` does not verify that clientId
// refers to an existing client, so that relation is NOT guaranteed by the
// domain model today; adding the constraint would reject writes the product
// currently accepts. That is documented in the audit report as a follow-up
// that requires a domain-level validation change first.
// ──────────────────────────────────────────────────────────────────

import { sql } from 'drizzle-orm';
import type { ContentAgencyMigration } from './types.js';

export const migration0003: ContentAgencyMigration = {
  version: 3,
  name: 'payment_foreign_keys',
  statements: [
    sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cpay_invoice_fk') THEN
          ALTER TABLE client_ops_payments
            ADD CONSTRAINT cpay_invoice_fk
            FOREIGN KEY (invoice_id) REFERENCES content_agency_invoices(id)
            ON DELETE RESTRICT
            NOT VALID;
        END IF;
      END $$;
    `,
    sql`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'cpay_invoice_fk' AND NOT convalidated
        ) AND NOT EXISTS (
          SELECT 1
          FROM client_ops_payments p
          LEFT JOIN content_agency_invoices i ON i.id = p.invoice_id
          WHERE i.id IS NULL
          LIMIT 1
        ) THEN
          ALTER TABLE client_ops_payments VALIDATE CONSTRAINT cpay_invoice_fk;
        END IF;
      END $$;
    `,
  ],
};

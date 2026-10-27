// ──────────────────────────────────────────────────────────────────
// VedMoulya — Payment integrity against a REAL PostgreSQL server
// MISSION 002 (2026-10-26).
//
// These tests are INTEGRATION tests: they run the real Drizzle schema, the
// real `PostgresPaymentSettlement` (one `db.transaction` + `SELECT … FOR
// UPDATE`) and the real migration runner against a disposable PostgreSQL
// instance.
//
// SAFETY GATE — the suite is SKIPPED unless CONTENT_AGENCY_TEST_DATABASE_URL
// is set AND points at a loopback host AND its database name contains "test".
// It also DROPS the `public` schema between migration cases, so it can never
// be pointed at a real database by accident:
//
//   docker run -d --name vedmoulya-m002-pg -e POSTGRES_PASSWORD=pw \
//     -p 5433:5432 postgres:16-alpine
//   CONTENT_AGENCY_TEST_DATABASE_URL='postgres://postgres:pw@127.0.0.1:5433/m002_test' \
//     npx vitest run services/content-agency/src/__tests__/payment-integrity.postgres.test.ts
//
// Nothing here contacts Neon or any configured (non-test) database.
// ──────────────────────────────────────────────────────────────────

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from '../schema/content-agency.js';
import {
  closeDatabase,
  initializeDatabase,
} from '../infrastructure/persistence/DatabaseConnection.js';
import { PostgresPaymentSettlement } from '../infrastructure/payments/PostgresPaymentSettlement.js';
import {
  MigrationDriftError,
  runContentAgencyMigrations,
} from '../infrastructure/persistence/migrations/index.js';
import type { PaymentSettlementCommand, PaymentSettlementPort } from '@vedmoulya/domain';

const TEST_URL = (process.env.CONTENT_AGENCY_TEST_DATABASE_URL ?? '').trim();

function databaseName(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\//, '');
  } catch {
    return '';
  }
}

const SAFE =
  TEST_URL !== '' &&
  /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(new URL(TEST_URL).hostname) &&
  /test/i.test(databaseName(TEST_URL));

const describeIf = SAFE ? describe : describe.skip;

const OWNER = 'm002_owner';
const CLIENT = 'm002_client';

let client: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let settlement: PaymentSettlementPort;

let paymentSeq = 0;
function nextPaymentId(): string {
  paymentSeq += 1;
  return `pay_m002_${String(paymentSeq).padStart(4, '0')}`;
}

function command(overrides: Partial<PaymentSettlementCommand> = {}): PaymentSettlementCommand {
  const n = nextPaymentId();
  return {
    paymentId: n,
    userId: OWNER,
    invoiceId: 'inv_m002_1',
    clientId: CLIENT,
    amountMinor: 20_000,
    currency: 'USD',
    method: 'bank_transfer',
    receivedAt: '2026-10-26T10:00:00.000Z',
    note: '',
    createdAt: '2026-10-26T10:00:00.000Z',
    idempotencyKey: `key-${n}`,
    detailsFingerprint: `fp-${n}`,
    evidenceKind: 'processor_reference',
    evidenceReference: `TXN-${n}`,
    evidenceReviewedBy: 'operator-ana',
    evidenceReviewedAt: '2026-10-26T10:00:00.000Z',
    status: 'verified',
    ...overrides,
  };
}

async function rows<T>(query: ReturnType<typeof sql>): Promise<T[]> {
  const result = await db!.execute(query);
  return (Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? [])) as T[];
}

async function seedInvoice(id: string, amountMinor: number, status = 'sent'): Promise<void> {
  await db!
    .insert(schema.contentAgencyClients)
    .values({
      id: CLIENT,
      userId: OWNER,
      company: 'M002 Fixture Co',
    })
    .onConflictDoNothing();
  await db!.insert(schema.contentAgencyInvoices).values({
    id,
    userId: OWNER,
    clientId: CLIENT,
    description: 'm002 fixture',
    amount: amountMinor / 100,
    amountMinor,
    currency: 'USD',
    status,
    issuedAt: '2026-10-01',
  });
}

async function resetDatabase(): Promise<void> {
  await client!.unsafe('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
}

async function paymentCount(invoiceId: string): Promise<number> {
  const result = await rows<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM client_ops_payments WHERE invoice_id = ${invoiceId}`,
  );
  return Number(result[0]?.n ?? 0);
}

async function invoiceStatus(invoiceId: string): Promise<string> {
  const result = await rows<{ status: string }>(
    sql`SELECT status FROM content_agency_invoices WHERE id = ${invoiceId}`,
  );
  return String(result[0]?.status ?? '');
}

describeIf('PostgreSQL payment settlement (disposable database)', () => {
  beforeAll(async () => {
    client = postgres(TEST_URL, { max: 6, onnotice: () => undefined });
    db = drizzle(client, { schema });
    await resetDatabase();
    await initializeDatabase({
      url: TEST_URL,
      poolMin: 1,
      poolMax: 6,
      timeout: 30_000,
    });
    settlement = new PostgresPaymentSettlement();
  }, 60_000);

  afterAll(async () => {
    await closeDatabase();
    if (client) await client.end({ timeout: 5 });
  });

  // ── Idempotency ─────────────────────────────────────────────────────────

  it('records a sequential retry exactly once and returns the original payment', async () => {
    await seedInvoice('inv_m002_1', 50_000);
    const cmd = command({ idempotencyKey: 'retry-key-1' });

    const first = await settlement.settle(cmd);
    const second = await settlement.settle(cmd);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.outcome).toBe('inserted');
    expect(second.outcome).toBe('duplicate');
    expect(second.payment.id).toBe(first.payment.id);
    expect(await paymentCount('inv_m002_1')).toBe(1);
    expect(second.verifiedTotalMinor).toBe(20_000);
  });

  it('serializes concurrent retries with the same key into ONE row', async () => {
    await seedInvoice('inv_m002_2', 50_000);
    const cmd = command({ invoiceId: 'inv_m002_2', idempotencyKey: 'retry-key-concurrent' });

    const results = await Promise.all([settlement.settle(cmd), settlement.settle(cmd)]);

    expect(results.every((r) => r.ok)).toBe(true);
    expect(await paymentCount('inv_m002_2')).toBe(1);
    const ids = new Set(results.map((r) => (r.ok ? r.payment.id : 'ERR')));
    expect(ids.size).toBe(1);
  });

  it('rejects the same key with conflicting details and keeps one row', async () => {
    await seedInvoice('inv_m002_3', 90_000);
    const base = command({ invoiceId: 'inv_m002_3', idempotencyKey: 'conflict-key' });
    await settlement.settle(base);

    const conflicting = await settlement.settle({
      ...base,
      paymentId: nextPaymentId(),
      amountMinor: 30_000,
    });

    expect(conflicting.ok).toBe(false);
    if (!conflicting.ok) expect(conflicting.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(await paymentCount('inv_m002_3')).toBe(1);
  });

  it('rejects a second payment that reuses the same evidence reference', async () => {
    await seedInvoice('inv_m002_4', 90_000);
    const first = command({ invoiceId: 'inv_m002_4', idempotencyKey: 'ref-key-1' });
    await settlement.settle(first);

    const second = await settlement.settle({
      ...first,
      paymentId: nextPaymentId(),
      idempotencyKey: 'ref-key-2',
    });

    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(await paymentCount('inv_m002_4')).toBe(1);
  });

  // ── Settlement semantics ────────────────────────────────────────────────

  it('does not settle on a partial payment and settles when covered', async () => {
    await seedInvoice('inv_m002_5', 50_000);

    const partial = await settlement.settle(
      command({ invoiceId: 'inv_m002_5', amountMinor: 20_000 }),
    );
    expect(partial.ok).toBe(true);
    if (partial.ok) {
      expect(partial.settled).toBe(false);
      expect(partial.invoiceStatus).toBe('sent');
    }
    expect(await invoiceStatus('inv_m002_5')).toBe('sent');

    const covering = await settlement.settle(
      command({ invoiceId: 'inv_m002_5', amountMinor: 30_000 }),
    );
    expect(covering.ok).toBe(true);
    if (covering.ok) {
      expect(covering.settled).toBe(true);
      expect(covering.invoiceStatus).toBe('paid');
      expect(covering.verifiedTotalMinor).toBe(50_000);
    }
    expect(await invoiceStatus('inv_m002_5')).toBe('paid');
  });

  it('does not settle from an UNREVIEWED payment; verify() then settles', async () => {
    await seedInvoice('inv_m002_6', 10_000);
    const recorded = await settlement.settle(
      command({
        invoiceId: 'inv_m002_6',
        amountMinor: 10_000,
        status: 'recorded',
        evidenceReviewedBy: null,
        evidenceReviewedAt: null,
      }),
    );
    expect(recorded.ok).toBe(true);
    if (recorded.ok) {
      expect(recorded.settled).toBe(false);
      expect(recorded.verifiedTotalMinor).toBe(0);
      expect(recorded.recordedTotalMinor).toBe(10_000);
    }
    expect(await invoiceStatus('inv_m002_6')).toBe('sent');

    const verified = await settlement.verify({
      userId: OWNER,
      paymentId: recorded.ok ? recorded.payment.id : '',
      reviewerId: 'operator-ana',
      verifiedAt: '2026-10-26T11:00:00.000Z',
    });
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.invoiceStatus).toBe('paid');
    expect(await invoiceStatus('inv_m002_6')).toBe('paid');
  });

  it('rejects a currency mismatch', async () => {
    await seedInvoice('inv_m002_7', 10_000);
    const result = await settlement.settle(command({ invoiceId: 'inv_m002_7', currency: 'EUR' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('CURRENCY_MISMATCH');
    expect(await paymentCount('inv_m002_7')).toBe(0);
  });

  it('keeps the money exact for a coin-level split (0.10 + 0.20 on 0.30)', async () => {
    await seedInvoice('inv_m002_8', 30);
    await settlement.settle(command({ invoiceId: 'inv_m002_8', amountMinor: 10 }));
    const second = await settlement.settle(command({ invoiceId: 'inv_m002_8', amountMinor: 20 }));
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.verifiedTotalMinor).toBe(30);
      expect(second.settled).toBe(true);
    }
    expect(await invoiceStatus('inv_m002_8')).toBe('paid');
  });

  it('never creates two rows for concurrent DISTINCT payments and settles once', async () => {
    await seedInvoice('inv_m002_9', 50_000);
    const results = await Promise.all([
      settlement.settle(command({ invoiceId: 'inv_m002_9', amountMinor: 30_000 })),
      settlement.settle(command({ invoiceId: 'inv_m002_9', amountMinor: 30_000 })),
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(await paymentCount('inv_m002_9')).toBe(2);
    expect(await invoiceStatus('inv_m002_9')).toBe('paid');
  });

  // ── Atomicity ───────────────────────────────────────────────────────────

  it('rolls the payment INSERT back when the invoice UPDATE fails', async () => {
    await seedInvoice('inv_m002_10', 10_000);
    await db!.execute(sql`
      CREATE OR REPLACE FUNCTION m002_boom() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'injected invoice-update failure'; END;
      $$ LANGUAGE plpgsql
    `);
    await db!.execute(sql`
      CREATE TRIGGER m002_boom_trg
      BEFORE UPDATE ON content_agency_invoices
      FOR EACH ROW WHEN (NEW.status = 'paid')
      EXECUTE FUNCTION m002_boom()
    `);

    try {
      let thrown: unknown = null;
      try {
        await settlement.settle(command({ invoiceId: 'inv_m002_10', amountMinor: 10_000 }));
      } catch (error) {
        thrown = error;
      }
      // Drizzle wraps the driver error; the injected message is on the cause.
      const cause = (thrown as { cause?: { message?: string } } | null)?.cause;
      expect(`${String((thrown as Error | null)?.message ?? '')} ${cause?.message ?? ''}`).toMatch(
        /injected invoice-update failure/,
      );

      // The payment insert must have rolled back with the failed update.
      expect(await paymentCount('inv_m002_10')).toBe(0);
      expect(await invoiceStatus('inv_m002_10')).toBe('sent');
    } finally {
      await db!.execute(sql`DROP TRIGGER IF EXISTS m002_boom_trg ON content_agency_invoices`);
      await db!.execute(sql`DROP FUNCTION IF EXISTS m002_boom()`);
    }
  });

  // ── Migrations ──────────────────────────────────────────────────────────

  it('creates the schema from scratch, then is a no-op on the second run', async () => {
    await resetDatabase();

    const first = await runContentAgencyMigrations(db!);
    expect(first.applied).toEqual([1, 2, 3]);
    expect(first.skipped).toEqual([]);

    const tables = await rows<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM information_schema.tables
          WHERE table_schema = 'public'
            AND (table_name LIKE 'content_agency_%' OR table_name LIKE 'client_ops_%')`,
    );
    // 16 declared tables + the ledger.
    expect(Number(tables[0]?.n)).toBe(17);

    const columns = await rows<{ column_name: string }>(
      sql`SELECT column_name FROM information_schema.columns
          WHERE table_name = 'client_ops_payments'
            AND column_name IN ('amount_minor','idempotency_key','status','evidence_reference')`,
    );
    expect(columns.map((c) => c.column_name).sort()).toEqual([
      'amount_minor',
      'evidence_reference',
      'idempotency_key',
      'status',
    ]);

    const second = await runContentAgencyMigrations(db!);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual([1, 2, 3]);
    expect(second.alreadyCurrent).toBe(true);
  }, 60_000);

  it('detects drift when an applied migration changes', async () => {
    const drifted = [{ version: 1, name: 'content_agency_baseline', statements: [sql`SELECT 1`] }];
    await expect(runContentAgencyMigrations(db!, { migrations: drifted })).rejects.toBeInstanceOf(
      MigrationDriftError,
    );
  });

  it('recovers from a deliberately failed migration without recording it', async () => {
    const broken = {
      version: 999,
      name: 'broken_migration',
      statements: [
        sql`CREATE TABLE m002_half_applied (id integer PRIMARY KEY)`,
        sql`SELECT this_function_does_not_exist()`,
      ],
    };

    await expect(runContentAgencyMigrations(db!, { migrations: [broken] })).rejects.toThrow();

    // Nothing recorded, and the first statement rolled back with the failure.
    const ledger = await rows<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM content_agency_migrations WHERE version = 999`,
    );
    expect(Number(ledger[0]?.n)).toBe(0);
    const leftover = await rows<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'm002_half_applied'`,
    );
    expect(Number(leftover[0]?.n)).toBe(0);

    // A corrected forward migration applies cleanly on the next run.
    const fixed = {
      version: 999,
      name: 'broken_migration',
      statements: [sql`CREATE TABLE m002_half_applied (id integer PRIMARY KEY)`],
    };
    const recovered = await runContentAgencyMigrations(db!, { migrations: [fixed] });
    expect(recovered.applied).toEqual([999]);

    await db!.execute(sql`DROP TABLE IF EXISTS m002_half_applied`);
    await db!.execute(sql`DELETE FROM content_agency_migrations WHERE version = 999`);
  }, 60_000);

  it('enforces the invoice foreign key for new payments', async () => {
    const constraints = await rows<{ conname: string; convalidated: boolean }>(
      sql`SELECT conname, convalidated FROM pg_constraint WHERE conname = 'cpay_invoice_fk'`,
    );
    expect(constraints).toHaveLength(1);
    // Added NOT VALID, then validated on a clean database.
    expect(constraints[0]?.convalidated).toBe(true);

    await expect(
      db!.insert(schema.clientOpsPayments).values({
        id: 'pay_orphan',
        userId: OWNER,
        invoiceId: 'inv_does_not_exist',
        clientId: CLIENT,
        amount: 1,
        amountMinor: 100,
        currency: 'USD',
        method: 'bank_transfer',
        receivedAt: '2026-10-26T10:00:00.000Z',
      }),
    ).rejects.toThrow();
  });
});

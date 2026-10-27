# VEDMOULYA — MISSION 002: REVENUE SAFETY HARDENING

**Date:** 2026-10-26
**Scope:** Client Ops payment recording + invoice settlement + Content Agency migrations + database target isolation + `world.*` verified-payment gate
**Starting evidence:** `docs/audits/2026-10-26-revenue-loop-persistence-proof/REVENUE-LOOP-PERSISTENCE-PROOF.md` (Mission 001)
**Verdict:** all eight Mission 001 findings are closed in code and proven against a disposable PostgreSQL 16 instance. **No production database was contacted, no data was migrated, nothing was pushed or deployed.**

---

## 1. Confirmed findings (re-inspected before changing anything)

Every Mission 001 finding was re-verified against the current working tree (`HEAD b3a59359`) before any edit.

| #   | Mission 001 finding                                         | Re-confirmed                                                                                       | Status after Mission 002                                                                                                                    |
| --- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Duplicate `addPayment` calls double-count revenue           | Yes — `addPayment` inserted unconditionally; `listPaymentsByInvoice` was re-summed after the write | **Fixed** — DB-unique idempotency key + replay semantics                                                                                    |
| 2   | Payment evidence not mandatory in Client Ops                | Yes — only `amount > 0` was checked                                                                | **Fixed** — mandatory, method-appropriate, validated evidence                                                                               |
| 3   | Payment INSERT and invoice UPDATE not atomic                | Yes — two separate services/connections, no transaction                                            | **Fixed** — one `db.transaction` with `SELECT … FOR UPDATE`                                                                                 |
| 4   | Monetary amounts use `double precision`                     | Yes — invoice/payment `amount` were `double precision`, summed in JS                               | **Fixed for settlement** — `amount_minor BIGINT` is authoritative; JS never adds floats                                                     |
| 5   | Content Agency DB may fall back to the identity database    | Yes — fallback chain ended at `config.database.url` (`IDENTITY_DATABASE_URL`)                      | **Fixed in production** — fail-closed, dev-only fallback retained                                                                           |
| 6   | Production boot depended on platform/identity DB validation | Yes — the fallback argument was evaluated eagerly, materializing the whole `config` proxy          | **Fixed** — the strict branch never reads `config`; proven by test                                                                          |
| 7   | Tables have no foreign keys                                 | Yes — zero FKs across all 16 tables                                                                | **Partially fixed** — `client_ops_payments.invoice_id → content_agency_invoices(id)` added; client FKs deliberately deferred (reason in §4) |
| 8   | No migration ledger / scripted rollback                     | Yes — one idempotent `CREATE TABLE IF NOT EXISTS` bootstrap, no ordering, no ledger                | **Fixed** — ordered, checksummed, ledgered, serialized migrations; forward-only recovery documented                                         |

Additional gap found and closed during this mission:

| #   | Finding                                                                                                                   | Evidence                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 9   | `world.advanceProspect → VERIFIED_PAYMENT` accepted any non-empty string as proof (`"paid"`, `"ok"`, `"done"` all passed) | `WorldModelService.advanceProspect` only trimmed and length-checked; now assessed by `assessVerifiedPaymentEvidence`       |
| 10  | `getRevenueOverview.paidTotal` counted _every_ recorded payment as received revenue                                       | Now counts **verified** payments only, with `recordedTotal`, `unverifiedTotal` and `reconciliationDrift` exposed alongside |

---

## 2. Task 1 — Payment idempotency

**Contract** (`packages/services/src/content-agency/ClientOpsDTO.ts`):

```ts
AddPaymentInput {
  invoiceId, amount, currency?, method?, receivedAt?, note?,
  idempotencyKey?: string,              // stable; a retry MUST reuse it
  evidence: PaymentEvidence             // now mandatory
}
```

- **Key resolution** (`packages/domain/src/content-agency/payments.ts`, `resolveIdempotencyKey`): an explicit key always wins. Without one, the key is derived from the validated evidence (`<kind>:<normalised reference>`), so the same receipt or processor transaction can never be recorded twice even if the caller forgets the key.
- **Database-level uniqueness**: `CREATE UNIQUE INDEX cpay_user_idem_uq ON client_ops_payments (user_id, idempotency_key)` plus `cpay_user_evref_uq ON client_ops_payments (user_id, evidence_reference)`. Legacy rows keep `NULL` keys — `NULL` never conflicts in PostgreSQL, so pre-existing data cannot block the migration.
- **Retry semantics**: an identical retry returns the **original** payment (`outcome: 'duplicate'`, DTO flag `duplicate: true`); nothing is written. A retry is resolved _before_ invoice-state checks, so a retry still succeeds after the invoice has settled.
- **Conflicting payload**: same key, different invoice/amount/currency/method/receipt date → `IDEMPOTENCY_CONFLICT` (`409`-class), original payment returned in `payment`.
- **Concurrency**: the settlement transaction takes `SELECT … FOR UPDATE` on the invoice row first, so requests for one invoice serialize; a genuine cross-invoice race is caught by the unique indexes and translated to a duplicate/conflict after the transaction aborts (no partial write).
- **No invented processor identifiers**: `AddPaymentInput` has no field that claims a processor transaction was created. Evidence is _recorded_, never fabricated; when no processor is configured the operator uses `kind: 'manual_receipt'` with a receipt number and an explicit reviewer.

## 3. Task 2 — Evidence and status semantics

**Separated states**

| Concept           | Where it lives                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| Payment recorded  | `client_ops_payments` row with `status = 'recorded'`                                                           |
| Evidence reviewed | `evidence_reviewed_by` / `evidence_reviewed_at`                                                                |
| Payment verified  | `status = 'verified'`, `verified_at` (monotonic: `recorded → verified`, no reverse)                            |
| Invoice settled   | `content_agency_invoices.status = 'paid'`, set **only** from `SUM(verified)` inside the settlement transaction |
| Revenue verified  | `world.recordVerifiedPayment` / `VERIFIED_PAYMENT` (unchanged gate, now stricter input)                        |

**Rules**

- Evidence is required (`PAYMENT_EVIDENCE_REQUIRED`) and must be plausible: 6–200 chars, `[A-Za-z0-9 ._:/#-]`, not a placeholder (`test`, `n/a`, `xxx`, `txn`, `paid`, …), not a repeated run, and not an echo of the payload (invoice id, client id, amount, currency, method, date). `arbitrary non-empty text` is rejected.
- Evidence kind must match the method: manual methods (`cash`, `cheque`, `manual`, `other`) require `manual_receipt` **plus** `reviewedBy`; processor methods require `processor_reference`. Mismatches are rejected rather than silently accepted.
- A manual receipt is only evidence once an operator attests it; a processor reference without an attestation is stored as `recorded`.
- **Only verified payments settle an invoice and count as revenue.** `reviewPayment` promotes `recorded → verified`, refuses double verification and anonymous reviewers (`n/a`, `test`…).
- `world.*`: the existing `VERIFIED_PAYMENT` evidence gate is preserved and tightened — text must state an amount _and_ identify how the money arrived (reference token or named rail). The four `OpportunityDiscovery` fixtures that used `'Payment 1'`/`'Payment.'` as shortcuts were replaced with realistic evidence, not with weaker assertions.
- **Consumer impact is loud, not silent**: a client that omits `evidence` now gets an explicit error; the tRPC boundary (`clientOpsPaymentInput`) requires it, and both web screens were updated to collect it. `paidTotal` changed semantics (verified only) and is documented in §7.

## 4. Task 3 — Atomic persistence

`PaymentSettlementPort` (`packages/domain/src/content-agency/payment-settlement.ts`) is the single unit of work. Production injects `PostgresPaymentSettlement` (`services/content-agency/src/infrastructure/payments/PostgresPaymentSettlement.ts`), which runs **one** `db.transaction`:

1. `SELECT … FOR UPDATE` the invoice (owner-scoped) — serializes settlement per invoice.
2. Resolve the idempotency key → original payment or conflict.
3. Reject a reused evidence reference, wrong currency, or an already-settled invoice.
4. `INSERT` the payment (unique indexes are the real guarantee).
5. `SUM(verified)` / `SUM(all)` recomputed **from persisted rows** in SQL (`amount_minor`, integers).
6. `UPDATE content_agency_invoices SET status='paid'` only when the recomputed verified total covers `amount_minor`.

Both directions of rollback were proven (§8): the invoice update failing rolls the payment insert back, and the invoice status cannot be set by an unverified/rejected payment.

`ClientOperationsApplicationService` **refuses to construct** without an atomic port when `NODE_ENV` is `production`/`staging`; Development/test fall back to `SequentialPaymentSettlement`, which is explicitly labelled a single-threaded test double (and reports failure instead of pretending settlement succeeded when it cannot roll back). Two unit tests pin the constructor guard.

**Not done / deliberately deferred:** no foreign key on `client_ops_payments.client_id` or `content_agency_invoices.client_id`. `createInvoice`/`saveInvoice` never verify that `clientId` refers to an existing client, so that relation is _not_ guaranteed by the domain model today; adding the constraint would reject writes the product currently accepts. Closing it needs a domain-level validation change first — recorded as a follow-up, not silently skipped.

## 5. Task 4 — Currency and monetary precision

**Representation chosen: integer minor units with explicit currency.**

- New authoritative columns: `content_agency_invoices.amount_minor BIGINT`, `client_ops_payments.amount_minor BIGINT`. The legacy `double precision` `amount` columns are **kept as display mirrors** so no existing reader, DTO or report breaks; nothing settles from them.
- `toMinorUnits` rejects non-finite/negative values, values beyond ±1e14 minor units, and any amount with more than two decimals (`10.005` → rejected rather than silently rounded). Rounding is therefore never implicit.
- Settlement totals are produced by PostgreSQL (`SUM(amount_minor)`), never by JS float addition. `fromMinorUnits` converts only at the DTO/display boundary.
- Currency is normalised (`normalizeCurrency`) and must be a 3-letter code; a payment whose currency differs from its invoice is rejected (`CURRENCY_MISMATCH`) before any write.
- Backfill for existing rows runs **in SQL**: `round((amount * 100)::numeric)::bigint` — no JS float step. Idempotent (`WHERE amount_minor IS NULL`).
- **No production data migration was executed.** The backfill ships as migration `0002`; it has only ever run against disposable databases.

**Scale policy:** 2 decimals for every currency in the current product. Currencies with 0 or 3 decimals (JPY, KWD…) are out of scope and would need a per-currency scale table before being accepted; today an invoice in such a currency would settle at 2 dp.

## 6. Task 5 — Database-target isolation

`services/content-agency/src/infrastructure/persistence/DatabaseConnection.ts` — `resolveContentAgencyDatabaseUrl()`:

- **Production/staging** (`isStrictEnvironment()` from `@vedmoulya/core`):
  - `CONTENT_AGENCY_DATABASE_URL` is **required** — no fallback to `DATABASE_URL`, `IDENTITY_DATABASE_URL` or `config.database.url`.
  - A loopback target is refused.
  - A target whose `host:port/database` equals the identity/platform target is refused unless `CONTENT_AGENCY_ALLOW_SHARED_DATABASE=true` is set deliberately.
  - The strict branch **never touches `config`** (whose lazy proxy materializes the whole platform configuration), so an explicit agency URL boots without `IDENTITY_DATABASE_URL`. This closes Mission 001 finding #6.
- **Development/test**: explicit value wins; the historical `DATABASE_URL → config.database.url (IDENTITY_DATABASE_URL) → localhost` chain is retained so local dev and the unit suite keep working. The remaining dev-only identity fallback is documented in a test named `DOCUMENTED DEV-ONLY RISK`.
- **Redaction**: diagnostics never interpolate a URL, host, user or database name. `connectionTarget()` is used only for equality checks. A test asserts the refusal message contains no `postgres://`.
- Boot now runs `runContentAgencyMigrations(db)` instead of the raw DDL list.

## 7. Task 6 — Migration discipline & referential integrity

New mechanism (`services/content-agency/src/infrastructure/persistence/migrations/`):

| Piece       | Behaviour                                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registry    | `0001 content_agency_baseline` (the existing 16 `CREATE … IF NOT EXISTS` statements, adopted unchanged), `0002 payment_integrity`, `0003 payment_foreign_keys`      |
| Ledger      | `content_agency_migrations (version PK, name, checksum, applied_at, duration_ms)`                                                                                   |
| Atomicity   | one transaction per migration, ledger row inserted **inside it** — a failure leaves neither DDL nor a ledger row                                                    |
| Idempotency | applied versions are skipped; every statement is also individually `IF NOT EXISTS`/guarded `DO $$`                                                                  |
| Drift       | checksum per version; editing an applied migration raises `MigrationDriftError` instead of diverging silently                                                       |
| Concurrency | session-level advisory lock (`pg_advisory_lock`) around the whole run                                                                                               |
| Recovery    | **forward-only.** No DOWN scripts, no `DROP`/`TRUNCATE`/`DELETE` in any migration (pinned by a test). A failed migration simply re-runs after the code is corrected |
| FK          | `cpay_invoice_fk` added `NOT VALID` (enforced for new rows, existing data cannot block boot), then `VALIDATE`d when no orphans exist                                |
| Indexes     | `cpay_invoice_idx`, `cpay_user_idem_uq` (unique), `cpay_user_evref_uq` (unique), `cpay_status_chk` check constraint                                                 |

**Prod-safety note:** `0002` runs `ALTER TABLE … ADD COLUMN` and a backfill `UPDATE` on `client_ops_payments`. On a large production table that takes table locks; the operator should schedule it (or split the backfill) before the first production boot. It has **not** been executed anywhere except disposable databases.

## 8. Task 7 — Verification

### Unit / in-memory integration (real services, in-memory repositories)

| Suite                                                              | Tests | Result   |
| ------------------------------------------------------------------ | ----- | -------- |
| `packages/services/.../RevenueLoopGuards.test.ts`                  | 27    | **pass** |
| `packages/services/.../ClientOperationsApplicationService.test.ts` | 23    | **pass** |
| `services/content-agency/src/__tests__/database-config.test.ts`    | 16    | **pass** |
| `services/content-agency/src/__tests__/migrations.unit.test.ts`    | 5     | **pass** |

Coverage added: sequential retry, explicit key, conflicting key, duplicate evidence reference, missing/placeholder/payload-echoing evidence, manual-method mismatch, unreviewed manual receipt, currency mismatch, sub-cent precision, partial coverage, one-cent short, 0.10 + 0.20 → 0.30, `recorded → verified` transition, double verification, anonymous reviewer, reconciliation drift, failure injection on the payment write and on the invoice update, production constructor guard (both directions).

### Integration with disposable PostgreSQL 16

`services/content-agency/src/__tests__/payment-integrity.postgres.test.ts` — **14/14 pass** against `postgres:16-alpine` (PostgreSQL 16.15) in a throwaway loopback-only container:

```
✓ records a sequential retry exactly once and returns the original payment
✓ serializes concurrent retries with the same key into ONE row
✓ rejects the same key with conflicting details and keeps one row
✓ rejects a second payment that reuses the same evidence reference
✓ does not settle on a partial payment and settles when covered
✓ does not settle from an UNREVIEWED payment; verify() then settles
✓ rejects a currency mismatch
✓ keeps the money exact for a coin-level split (0.10 + 0.20 on 0.30)
✓ never creates two rows for concurrent DISTINCT payments and settles once
✓ rolls the payment INSERT back when the invoice UPDATE fails
✓ creates the schema from scratch, then is a no-op on the second run
✓ detects drift when an applied migration changes
✓ recovers from a deliberately failed migration without recording it
✓ enforces the invoice foreign key for new payments
```

The atomicity test injects a real failure with a `BEFORE UPDATE … WHEN (NEW.status = 'paid')` trigger that raises, then asserts **0 payment rows and the invoice still `sent`**. The migration-recovery test injects a failing second statement, asserts the first statement rolled back and nothing was recorded, then applies the corrected migration and asserts it lands.

The suite is **skipped** unless `CONTENT_AGENCY_TEST_DATABASE_URL` points at a loopback host whose database name contains `test`; it drops the `public` schema between migration cases. It cannot be aimed at a real database by accident.

### Related workspace tests

| Scope                                                                                                                                     | Result                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `packages/services/src/content-agency` + `services/content-agency` + API client-ops/reconciliation + `packages/world-model/src/__tests__` | **510 passed, 14 skipped** (the skipped 14 are the Postgres suite without a URL) |
| `apps/web` business suites + `services/api/.../router-registry.test.ts` + `packages/domain`                                               | **829 passed**                                                                   |

### Typecheck & lint

- `npx tsc -b` (whole repo) → **exit 0**; `tsc --noEmit -p services/api` and `-p apps/web` → **0 errors**.
- `npm run lint:web` → 1 scope, **0 failed**.
- `npm run lint:api` → 1 scope, **0 failed**.
- `npm run lint:services` → 8 scopes, **0 failed**.
- `npm run lint:packages` → 48 scopes, **0 failed**.
- `npm run lint` (all scopes + root) → **4 failed**: the three above are clean; the remaining failure is the **root** scope only, on six untracked Mission-001 probe scripts (`_audit-boot-gate.mts`, `_audit-clientops-probe.mts`, `_audit-identity.mts`, `_audit-life.mts`, `_audit-revenue-chain.mts`, `_rev-loop-persistence-proof.mts`). ESLint reports `not found by the project service` because `.mts` files are in neither a tsconfig project nor `allowDefaultProject`. **Pre-existing, unrelated to this mission, and left untouched** per the "preserve untracked files" constraint — the fix is to move them under `scripts/` or add `*.mts` to the lint project config.

### Not performed (by design)

- **Live production checks: none.** No request was made to a production API, no production database connection was opened, no real payment was recorded.
- No Neon connection, no migration against Neon, no data export.

## 9. Remaining risks (honest list)

1. **`paidTotal` semantics changed** from "all recorded payments" to "verified payments only". The web revenue screens were updated and expose `unverifiedTotal`, but any external consumer of `getRevenueOverview` that treated `paidTotal` as "cash entered" must now also read `recordedTotal`. This is the intended fix for finding #10 and is documented in the DTO.
2. **Operator attestation is self-asserted.** `reviewedBy` is whatever the caller sends (the web client sends the signed-in user id). Nothing cryptographically ties a reviewer to a human; it is an audit trail, not a signature. Processor references are also entered manually — no webhook/reconciliation against a processor exists yet.
3. **`world.*` evidence is free text.** The assessment rejects generic/placeholder text and requires an amount plus a rail/reference, but it cannot verify a bank statement. Client Ops is the stricter, structured path.
4. **Client-level foreign keys are absent** (§4). Invoice/payment rows can still reference a `client_id` that does not exist.
5. **Currency scale is fixed at 2 decimals** (§5). Zero- and three-decimal currencies are not modelled.
6. **Migration `0002` takes locks** on payment/invoice tables during the backfill; scheduling is an operator decision (§7).
7. **`amount` and `amount_minor` can drift** if a writer bypasses the repositories (`savePayment`/`saveInvoice` keep them in sync; raw SQL would not). Settlement reads `amount_minor` only, so drift affects display, not correctness.
8. **The sequential settlement double is not atomic.** It is only reachable in development/test, guarded by the production constructor check.

## 10. Database-target safeguards (summary)

| Guard             | Behaviour                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| Explicit prod URL | `CONTENT_AGENCY_DATABASE_URL` required in production/staging; no fallback                                  |
| Identity routing  | Refused unless `CONTENT_AGENCY_ALLOW_SHARED_DATABASE=true`                                                 |
| Loopback in prod  | Refused                                                                                                    |
| Diagnostics       | No URL/host/user/database name is ever logged or thrown                                                    |
| Config coupling   | Strict branch never reads the lazy `config` proxy                                                          |
| Test-DB guard     | Integration suite requires loopback host + `test` in the database name; drops only its own `public` schema |
| Migration guard   | Advisory lock, checksummed ledger, forward-only, no destructive statements                                 |

## 11. Git state

- Branch `main`, `HEAD b3a59359` — **unchanged**. No commit, no push, no merge, no tag, no deploy, no publish.
- All pre-existing working-tree modifications and untracked files from earlier work are preserved untouched (business/career/learning/marketplace pages, mission controller/runtime, Mission-001 audit scripts and reports).
- Files added by this mission (untracked, reviewable):
  - `packages/domain/src/content-agency/payments.ts`
  - `packages/domain/src/content-agency/payment-settlement.ts`
  - `packages/services/src/content-agency/SequentialPaymentSettlement.ts`
  - `packages/services/src/content-agency/__tests__/RevenueLoopGuards.test.ts` (rewritten)
  - `packages/world-model/src/domain/PaymentEvidenceAssessment.ts`
  - `services/content-agency/src/infrastructure/payments/`
  - `services/content-agency/src/infrastructure/persistence/migrations/`
  - `services/content-agency/src/__tests__/{database-config,migrations.unit,payment-integrity.postgres}.test.ts`
  - this report
- Modified: `ClientOperationsApplicationService.ts`, `ClientOpsDTO.ts`, `InMemoryClientOpsRepository.ts`, `ClientOpsRepository.ts`, `ops-types.ts`, domain/content-agency `index.ts`, `services/index.ts`, world `WorldModelService.ts`, `OpportunityDiscovery.test.ts`, `DatabaseConnection.ts`, `PostgresClientOpsRepository.ts`, `PostgresContentAgencyRepository.ts`, `schema/content-agency.ts`, `ContentAgencyModule.ts`, `services/content-agency/src/index.ts`, `ProductionRepositories.ts`, `ApiApplicationService.ts`, `ClientOpsRouter.ts`, `RouterRegistry.ts`, `packages/core` config exports, `apps/web` invoices + payments pages, `apps/web/src/lib/api-client.ts`, `ClientOperationsApplicationService.test.ts`.

## 12. Explicit confirmations

- **Neon was not contacted.** No request, query, migration or schema read reached the Neon database configured in `.env.local`. Every database operation in this mission targeted a throwaway loopback container created and destroyed for it (`vedmoulya-m002-pg`, removed at the end — `docker ps -a` shows no such container).
- **No production data migration was performed.** Migrations `0002`/`0003` have only run against disposable databases.
- **No push, merge, deploy, publish or release occurred.** `git log` HEAD is unchanged.
- **No money was spent, no client was contacted, and no simulated payment was labelled a real receipt.**
- **No credentials, connection strings or payment-sensitive data appear in this report** — only hosts/database names that are illustrative test fixtures.

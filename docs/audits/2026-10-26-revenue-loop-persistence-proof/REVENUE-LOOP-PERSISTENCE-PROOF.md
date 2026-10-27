# Revenue Loop Persistence Proof — MISSION 001 (2026-10-26)

**Classification: `VERIFIED AGAINST ISOLATED TEST DATABASE`**

Scope of that claim: the real Content Agency + Client Ops application services
wrote to / read from a real PostgreSQL 16 server through the real Drizzle
schema and the real `PostgresContentAgencyRepository` /
`PostgresClientOpsRepository`, in a **throwaway loopback-only container created
for this mission and destroyed after it**. The invoice → partial payment →
covering payment → `paid` → revenue-overview loop was exercised at the
service/repository/database layer and re-read from a **second process**.

Not claimed: production readiness, the Neon database, the tRPC/HTTP hop against
this database, or any external/real-money event.

---

## 1. What was re-checked first (previous audit's findings)

| Prior finding                                                                | Status at this HEAD             | Evidence                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 16 Content Agency / Client Ops DDL statements exist only in the working tree | **CONFIRMED**                   | `services/content-agency/src/infrastructure/persistence/contentAgencySchema.ts` (untracked), 16 `CREATE TABLE` + 16 `CREATE INDEX`, wired by `DatabaseConnection.ts`                                           |
| `DATABASE_URL` absent from `.env.local`                                      | **WRONG — CORRECTED**           | Full key inventory: `DATABASE_URL` **is** set and resolves to a **remote Neon** host (`DATABASE_URL_UNPOOLED` present too). The earlier check was truncated by `head -40`. The prior audit has been annotated. |
| `IDENTITY_DATABASE_URL` present                                              | **CONFIRMED**                   | `.env.local`; also injected by `tests/vitest.setup.ts:25`                                                                                                                                                      |
| Local AI mock mode enabled                                                   | **CONFIRMED**                   | `AI_ENABLE_MOCK` set in `.env.local`; irrelevant to this proof — every AI port was a **throwing stub** in the proof script, so no model output could contribute                                                |
| "`IDENTITY_DATABASE_URL` is not interchangeable with `DATABASE_URL`"         | **WRONG IN EFFECT — CORRECTED** | `packages/core/src/config/index.ts:132` resolves `config.database.url` **from `IDENTITY_DATABASE_URL`**, and `getDatabaseConfig()` uses `config.database.url` as its final fallback. Pinned by a test (§6).    |
| Marketplace / Life findings                                                  | out of scope for this mission   | unchanged                                                                                                                                                                                                      |

---

## 2. Complete implementation trace (API → service → repository → database)

### Invoice creation

```
apps/web/src/app/content-agency/invoices/…            (UI)
  → api-client.ts  clientOps.createInvoice / contentAgency.createInvoice
    → RouterRegistry.ts  clientOps.* / contentAgency.* procedures (owner-scoped input)
      → ContentAgencyApplicationService.createInvoice(userId, input)        packages/services/src/content-agency/ContentAgencyApplicationService.ts:581
        → PostgresContentAgencyRepository.saveInvoice                        services/content-agency/src/infrastructure/persistence/PostgresContentAgencyRepository.ts:461
          → drizzle → content_agency_invoices                                 schema/content-agency.ts:122
```

`createInvoice` refuses a negative amount and requires the client to exist
(`findClientById(input.clientId, userId)`) — a cross-user client id cannot be
used.

### Payment recording and the `paid` transition

```
clientOps.addPayment (standardProcedure, RouterRegistry.ts:3277)
  → ClientOperationsApplicationService.addPayment                            ClientOperationsApplicationService.ts:1029
      1. contentAgency.getInvoice(userId, invoiceId)        → 404 as an error envelope when absent
      2. amount <= 0                                        → "Payment amount must be positive"
      3. repo.savePayment(payment)                          → INSERT client_ops_payments
      4. repo.listPaymentsByInvoice(invoiceId, userId)      → SUM of recorded payments
      5. if SUM >= invoice.amount → contentAgency.updateInvoiceStatus('paid')
                                    else → invoice keeps its status
```

`PostgresClientOpsRepository.savePayment` uses
`insert … onConflictDoUpdate(target: id)`; each `addPayment` call mints a new
`pay_<uuid>` id, so **the conflict target can never fire on a duplicate
submission** (see §7 finding 3).

`PostgresClientOpsRepository.listPaymentsByInvoice` selects by `invoice_id` and
filters `user_id` in JavaScript rather than in the `WHERE` clause
(repository line 525-546) — correct today because invoice ids are unique, but
the owner predicate is not pushed into SQL.

### Revenue overview

```
clientOps.getRevenueOverview (standardProcedure)
  → ClientOperationsApplicationService.getRevenueOverview                    :1064
      invoices = contentAgency.listInvoices(userId)     → content_agency_invoices
      payments = repo.listPayments(userId)              → client_ops_payments
      paidTotal    = Σ payments.amount
      outstanding  = Σ amount of every invoice whose status !== 'paid'
      overdueCount = pending invoices with dueDate < now
      paidCount / pendingCount = invoice status split
      monthlyRevenue / cashflow = last 6 months derived from the same rows
```

There is **no caching, no in-memory mirror and no fallback repository** on this
path: the only store is Postgres via `getDatabase()`.

### Database selection and bootstrap

`DatabaseConnection.getDatabaseConfig()` (`services/content-agency/src/infrastructure/persistence/DatabaseConnection.ts`):

```
requireProdExternalUrl(
  'CONTENT_AGENCY_DATABASE_URL',
  process.env.DATABASE_URL || config.database.url,   // config.database.url = requireExternalUrl('IDENTITY_DATABASE_URL', 'postgres://localhost:5432/vedmoulya')
)
```

`initializeDatabase()` borrows the shared `DatabaseManager` pool, then runs
`executeContentAgencyStatements()` once per process (`ddlPromise` guard). This
is the **only** migration mechanism — there is no `.sql` runner, no migration
ledger, no `drizzle-kit migrate` invocation anywhere in the repo.

---

## 3. Schema readiness (the 16 tables)

Verified by executing the bootstrap against a fresh database (§5) and by
reading the DDL:

| #   | Table                          | Owning module  |
| --- | ------------------------------ | -------------- |
| 1   | `content_agency_clients`       | Content Agency |
| 2   | `content_agency_brands`        | Content Agency |
| 3   | `content_agency_projects`      | Content Agency |
| 4   | `content_agency_content`       | Content Agency |
| 5   | `content_agency_invoices`      | Content Agency |
| 6   | `client_ops_leads`             | Client Ops     |
| 7   | `client_ops_lead_interactions` | Client Ops     |
| 8   | `client_ops_lead_tasks`        | Client Ops     |
| 9   | `client_ops_lead_contacts`     | Client Ops     |
| 10  | `client_ops_proposals`         | Client Ops     |
| 11  | `client_ops_contracts`         | Client Ops     |
| 12  | `client_ops_quotations`        | Client Ops     |
| 13  | `client_ops_payments`          | Client Ops     |
| 14  | `client_ops_documents`         | Client Ops     |
| 15  | `client_ops_portal_access`     | Client Ops     |
| 16  | `client_ops_notifications`     | Client Ops     |

Observed after bootstrap on the fresh database: **16 tables**, **32 indexes**
(16 primary keys + 16 declared indexes) — `pg_indexes` count confirmed.

| Property                              | Result                                                                                                                                                               | Evidence                                           |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Idempotency                           | ✅ every statement is `CREATE TABLE/INDEX IF NOT EXISTS`; a second process re-ran the bootstrap and Postgres returned only `NOTICE 42P07 … already exists, skipping` | §5 verify run                                      |
| Ordering                              | tables before their indexes; executed sequentially in one ordered array                                                                                              | `executeContentAgencyStatements` + test            |
| Failure behaviour                     | the loop aborts on the first failing statement and re-throws (no "schema ready" claim on partial DDL)                                                                | unit test                                          |
| Currency precision                    | `double precision` for `amount`, summed and compared in JS as `totalPaid >= amount`                                                                                  | no failing case found; see §7 finding 5            |
| Foreign keys                          | **none declared** — `client_id`, `lead_id`, `invoice_id`, `project_id` are plain `varchar(64)`                                                                       | referential integrity is application-enforced only |
| Unique constraints / idempotency keys | primary keys only; **no unique key on payment identity**                                                                                                             | §7 finding 3                                       |
| Transaction boundaries                | **none** — the payment INSERT and the invoice status UPDATE are two independent statements                                                                           | §7 finding 6                                       |
| Rollback / recovery                   | **not scripted** — additive `IF NOT EXISTS` DDL only; a rollback is a manual `DROP TABLE`                                                                            | limitation, not verified                           |

---

## 4. Database target verification (and why the configured DB was not used)

| Check                                  | Result                                                                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.env.local` `DATABASE_URL` host class | **remote Neon** → treated as shared/production; **no DDL or writes executed against it**                                                                                                         |
| Local Postgres service                 | not running (`127.0.0.1:5432` closed; no `vedmoulya-postgres` container)                                                                                                                         |
| Docker availability                    | present (unrelated container running)                                                                                                                                                            |
| Action taken                           | created **one throwaway container**: `postgres:16-alpine`, name `vedmoulya-m001-pg`, bound to `127.0.0.1:55432` only, `--tmpfs` data dir (no volume, nothing persisted), removed after the proof |
| Isolation guard in the proof script    | refuses to run unless the target host is `localhost`/`127.0.0.1`/`::1`                                                                                                                           |
| Credential handling                    | container-only dev credentials; connection string passed via env and **never printed**; `AUTH_JWT_SECRET` generated per process with `crypto.randomBytes`                                        |
| Production refusal                     | verified by test: production + localhost target → `EnvironmentError` (fail-fast)                                                                                                                 |

**No migration was executed against the Neon database, and no authorization to
do so was assumed.**

---

## 5. Commands executed and results

All commands run from `D:\VedMoulya`, `NODE_ENV=development`, target
`127.0.0.1:55432` (throwaway container).

| #   | Command                                                                                                                             | Result                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | `docker run -d --name vedmoulya-m001-pg … postgres:16-alpine` (loopback, tmpfs)                                                     | container started                                                          |
| 2   | `npx tsx _rev-loop-persistence-proof.mts --write`                                                                                   | **PASS** — schema created, 3 invoices, 5 payments, all assertions held     |
| 3   | `npx tsx _rev-loop-persistence-proof.mts --verify`                                                                                  | **PASS** — fresh process: `paid` / `sent` / 2 payments / identical revenue |
| 4   | `psql` cross-check of tables, indexes, invoice and payment rows                                                                     | 16 tables, 32 indexes, rows as expected (§5.2)                             |
| 5   | `npx tsx _rev-loop-persistence-proof.mts --cleanup`                                                                                 | deleted 5 payments, 3 invoices, 1 client; **0 residual rows**              |
| 6   | `docker rm -f vedmoulya-m001-pg`                                                                                                    | container removed                                                          |
| 7   | `npx vitest run packages/services/src/content-agency services/content-agency services/api/src/__tests__/client-ops-routers.test.ts` | **182/182 pass** (8 files)                                                 |
| 8   | `npx vitest run packages/services/src/content-agency/__tests__/RevenueLoopGuards.test.ts`                                           | **14/14 pass**                                                             |
| 9   | `npx vitest run services/content-agency/src/__tests__/database-config.test.ts`                                                      | **12/12 pass**                                                             |

### 5.1 Fresh-process proof output (`--verify`)

```json
{
  "phase": "verify (fresh process)",
  "invoiceStatus": "paid",
  "partialInvoiceStatus": "sent",
  "paymentsForCoveredInvoice": 2,
  "revenue": { "paidTotal": 1634.56, "outstanding": 500, "paidCount": 2, "pendingCount": 1 }
}
```

### 5.2 Row-level evidence captured before cleanup

```
        id        | status | amount  | currency
------------------+--------+---------+----------
 inv_4565fb00-26e | paid   | 1234.56 | USD      ← 34.56 + 1200.00 recorded
 inv_d5b43df1-f5b | sent   |     500 | USD      ← only 200.00 recorded (partial)
 inv_49d3e130-ae6 | paid   |     100 | USD      ← TWO 100.00 payments (duplicate probe)

        id        |    invoice_id    | amount |    method
------------------+------------------+--------+--------------
 pay_3db93b9e-63d | inv_4565fb00-26e |  34.56 | bank_transfer
 pay_0c8a87c7-379 | inv_d5b43df1-f5b |    200 | bank_transfer
 pay_d4c1b3ec-7a8 | inv_4565fb00-26e |   1200 | bank_transfer
 pay_ce769e27-18b | inv_49d3e130-ae6 |    100 | bank_transfer
 pay_a0c7db69-300 | inv_49d3e130-ae6 |    100 | bank_transfer
```

---

## 6. State transitions actually observed

| Step                       | Invoice status         | Payments on invoice | Note                                       |
| -------------------------- | ---------------------- | ------------------- | ------------------------------------------ |
| create invoice 1234.56     | `sent`                 | 0                   | created via `contentAgency.createInvoice`  |
| add 34.56                  | **`sent`** (unchanged) | 34.56               | partial payment did **not** settle         |
| add 1200.00                | **`paid`**             | 1234.56             | settled exactly at coverage                |
| create invoice 500         | `sent`                 | 0                   |                                            |
| add 200                    | `sent`                 | 200                 | still partial                              |
| create invoice 100         | `sent`                 | 0                   |                                            |
| add 100 (first)            | `paid`                 | 100                 |                                            |
| add 100 (duplicate)        | `paid`                 | **200**             | **double-counted** — no idempotency        |
| zero-amount payment        | —                      | —                   | refused: "Payment amount must be positive" |
| payment on unknown invoice | —                      | —                   | refused: "Invoice not found"               |

---

## 7. Findings (new, evidence-backed)

1. **`IDENTITY_DATABASE_URL` is an implicit Content Agency fallback.**
   `packages/core/src/config/index.ts:132` sets `config.database.url` from
   `IDENTITY_DATABASE_URL`, and `getDatabaseConfig()` uses that as its last
   fallback. A deployment that sets only the identity URL would create all 16
   `content_agency_*` / `client_ops_*` tables **inside the identity database**.
   _Pinned by test_ `DOCUMENTED RISK: resolves the IDENTITY database…`.
   Severity: **high** (data-plane mixing), no production impact proven — it
   depends on deployment env. Recommended operator decision: set
   `CONTENT_AGENCY_DATABASE_URL` explicitly in every environment.

2. **Boot coupling: the agency override does not stand alone in production.**
   `getDatabaseConfig()` evaluates its fallback argument eagerly, so the full
   platform configuration (including `IDENTITY_DATABASE_URL`) must validate even
   when `CONTENT_AGENCY_DATABASE_URL` is set. _Pinned by test_ `BOOT COUPLING…`.

3. **No idempotency on payments.** Two identical `addPayment` calls create two
   `client_ops_payments` rows and double-count revenue (100 → `paidTotal` 200).
   There is no idempotency key in `AddPaymentInput` and `savePayment`'s
   conflict target is a freshly generated id. _Verified live and pinned by
   test._ Requires an API-contract decision, not a silent change.

4. **No payment-evidence requirement.** `addPayment` accepts a payment with no
   note, reference or receipt. This is weaker than the `world` module, where
   `prospectAdvance → VERIFIED_PAYMENT` refuses to advance without real payment
   evidence text. _Verified live and pinned by test._

5. **Currency is `double precision`, compared with `>=`.** The realistic split
   (34.56 + 1200.00 = 1234.56) and the coin split (0.10 + 0.20 on 0.30) both
   settled correctly, but there is **no rounding/epsilon guard**, so a value at
   a binary-fraction boundary could in principle leave a fully-paid invoice
   `sent`. Severity: **low** (no failing case found); the honest fix is
   `numeric` + integer minor units, which is a schema change.

6. **No transaction across "record payment" and "mark invoice paid".** The two
   writes are independent. A crash between them leaves money recorded on a
   `sent` invoice; the service then returns
   `"Payment recorded but invoice could not be marked paid"` rather than a false
   success (unit-tested). Recovery is manual today.

7. **No foreign keys.** `client_ops_payments.invoice_id` is a plain `varchar`
   with no FK, so a deleted invoice would orphan payments. No delete path exists
   for invoices today, so this is latent rather than active.

8. **No migration runner / ledger / down-migrations.**
   `CREATE … IF NOT EXISTS` on process start is the whole strategy. It is
   idempotent (verified) but offers no version history and no scripted rollback.
   Column changes to an existing deployment would need a hand-written `ALTER`.

---

## 8. Verification boundary (what this proves and what it does not)

| Layer                                                    | Verified how                                                               | Status                |
| -------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------- |
| Application service logic                                | real services over real repositories                                       | ✅ unit + isolated DB |
| Repository → Drizzle → Postgres                          | real writes/reads, second process re-read, direct `psql` cross-check       | ✅ isolated DB        |
| Revenue aggregation (`paidTotal`, `outstanding`, counts) | reconciled against raw rows and re-read in a fresh process                 | ✅ isolated DB        |
| API routing (tRPC procedure → service)                   | pre-existing router tests with a mocked service (**not** a live HTTP call) | ⚠️ not live           |
| The configured Neon database                             | not contacted                                                              | ❌ unverified         |
| Production deployment                                    | not contacted                                                              | ❌ unverified         |
| Real payments / money                                    | none                                                                       | ❌ untouched          |

---

## 9. Remaining blockers and required operator decisions

1. **Decide the target environment for applying the 16 DDL statements.** Applying
   them to the Neon database is a schema mutation on a shared resource: it needs
   explicit authorization plus the backup/rollback plan that does not yet exist
   in the repo.
2. **Set `CONTENT_AGENCY_DATABASE_URL` explicitly** in every environment to
   remove the identity-database fallback risk (finding 1).
3. **Decide whether payments need an idempotency key** (finding 3) and whether
   payment evidence should be mandatory (finding 4) — both are contract changes.
4. **Decide the currency representation** (`double precision` → `numeric` or
   integer minor units) before real invoices exist (finding 5).

---

## 10. Changed files and Git state

| File                                                                                                | Change                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_rev-loop-persistence-proof.mts` **(new, untracked)**                                              | Loopback-only proof script: write / verify (fresh process) / cleanup phases, with AI ports stubbed to reject                                                                                                                                                                            |
| `packages/services/src/content-agency/__tests__/RevenueLoopGuards.test.ts` **(new)**                | 14 tests over the real service chain: persistence, partial vs covering, one-cent shortfall, coin split, owner scoping, zero/negative, unknown invoice, duplicate double-count (pinned gap), missing evidence (pinned gap), write failure, status-update failure, revenue reconciliation |
| `services/content-agency/src/__tests__/database-config.test.ts` **(new)**                           | 12 tests: target precedence, identity-fallback risk, localhost default, production fail-fast, boot coupling, 16-table/32-index inventory, `IF NOT EXISTS` guards, sequential execution, abort-on-first-failure                                                                          |
| `docs/audits/2026-10-26-revenue-loop-persistence-proof/REVENUE-LOOP-PERSISTENCE-PROOF.md` **(new)** | This report                                                                                                                                                                                                                                                                             |
| `docs/audits/2026-10-26-life-module-genuineness-wiring/LIFE-MODULE-GENUINENESS-AND-WIRING-AUDIT.md` | Corrected the wrong `DATABASE_URL`-absent claim                                                                                                                                                                                                                                         |

Git: branch `main`, HEAD `b3a59359` (unchanged). Everything pre-existing in the
working tree is preserved (mission-controller/mission-runtime/ProductionRepositories/
MissionService/content-agency edits and the earlier marketplace/audit work).
**No commit, no push, no merge, no deploy, no publish.** The only external
artifact created was the throwaway local container, which was removed.

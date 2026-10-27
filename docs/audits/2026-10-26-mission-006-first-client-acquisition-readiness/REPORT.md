# VEDMOULYA — MISSION 006: FIRST CLIENT ACQUISITION READINESS

**Date:** 2026-10-26
**Repository:** `D:\VedMoulya`
**Branch:** `main`
**HEAD at start and end:** `b3a593590c2c6f00371bfc30cc02b8e22cb76996`
**External actions:** none — no push, merge, deploy, publish, message, prospect contact or spend. Neon/production not contacted.
**Baseline:** `docs/audits/2026-10-26-mission-005-first-paying-client/REPORT.md`

> Nothing in this mission produced or implies a client, prospect, payment,
> testimonial, demand signal or revenue. Every price is a **proposal**. The work
> done here is preparation to make an honest first offer — not evidence that anyone
> will buy it.

---

## 1. What changed since Mission 005

Mission 005 left the pilot package written but with three open problems this
mission was asked to close:

1. Four prices in the repository ($1,500 pilot, $2,300 starter, $3,000/month,
   $4,400 month-1) with no comparison to tell a prospect which is which.
2. A sample runner that proved the export-DTO bug was fixed but did not prove the
   PDF/DOCX path fails honestly, and shipped an "AI fee memo" that no offer sells.
3. The 14 PostgreSQL payment-integrity tests had not been re-run in-tree; their
   result was only _reported_ from Missions 002B/004.

All three are addressed below.

---

## 2. Step 1 — Offer ambiguity resolved

New document: [`docs/pilot/OFFER-COMPARISON.md`](../pilot/OFFER-COMPARISON.md).

| Offer | Source | Price | Unit | Buyer |
|---|---|---|
| **A — Revenue Integrity Pilot** | pilot package §7 | USD 1,500 (500 + 1,000) | fixed | Content freelancer / fractional CMO / 1–5 person studio, 3+ billable clients |
| B — Starter "Launch" | `SERVICE_PACKAGES.md` | USD 2,300 | fixed | Same segment buying a content programme |
| C — Growth retainer | `SERVICE_PACKAGES.md` | USD 3,000/month | recurring, 3-month min | Established studio outsourcing content |
| D — Month 1 in the proposal template | `PROPOSAL_TEMPLATE.md` | USD 4,400 (3,000 + 1,400 setup) | fixed | Same buyer as C at signing |

**The real difference is scope class, not price level.** A sells a capability +
habit (one article, one invoice, one verified payment, an operating one-pager); B/C/D
sell content volume with no ledger component. Only A is backed by a product workflow
exercised end to end.

**Unclear differences flagged for operator review (not silently reconciled):**

| #   | Ambiguity                                                                                         |
| --- | ------------------------------------------------------------------------------------------------- |
| U1  | B's article length/editing standard undefined (A states 600–1,200 w edited)                       |
| U2  | B has no payment terms, support window or cancellation clause                                     |
| U3  | D's $1,400 setup matches neither B's $2,300 starter nor C (no setup line)                         |
| U4  | C has a 3-month minimum; D's quote is presented as "month 1"                                      |
| U5  | "Publishing … (or agency add-on)" in B is unpriced and undeliverable — the product cannot publish |
| U6  | C's "monthly performance review + iteration" has no reporting artifact in the product             |
| U7  | B/C/D never mention the ledger capability that A's price partly pays for                          |

`docs/business/*` was deliberately **left unchanged** — those documents may be in
use elsewhere and reconciling them silently would be worse than flagging them.

**Recommended first offer: A, at USD 1,500.** Rationale (full text in §3 of the
comparison): it is the only offer with evidence behind every deliverable; it is the
only one whose differentiator is demonstrable in five minutes; it is the smallest
honest promise (one article, six hours); and it produces the reference that B/C/D
cannot be sold without. B/C/D should not appear in a first conversation.

**Open price decisions for the owner** (comparison §4): P1 opening number
(1,500 / 900 / 2,500), P2 deposit split, P3 whether the pilot credits toward a
retainer, P4 currency and collection channel, P5 whether B/C/D stay on any price list.

---

## 3. Step 2 — Sample deliverable verified

Run: `npx tsx scripts/pilot-sample-deliverable.ts --no-ai` → **exit 0**.

| Check                                                 | Method                                                                                                                                                                                       | Result                                                                                                                                                                                                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Export payload is real content, not `[object Object]` | Read `sample-authored-article.md` / `.html`; scanned every file in the directory                                                                                                             | **Pass** — article Markdown and HTML contain the article text. The only `[object Object]` string in the directory is inside the honest memo explaining the old bug.                                                                                      |
| Empty AI output is not represented as success         | Code path: empty or < 40-char body → `FAILED (provider returned… )`, no file written                                                                                                         | **Pass** (exercised by inspection; no provider available to force a real empty response)                                                                                                                                                                 |
| Markdown export truthful and usable                   | `supported=true`; text begins `# <title>` then the article                                                                                                                                   | **Pass** — opens as valid Markdown                                                                                                                                                                                                                       |
| HTML export truthful and usable                       | `supported=true`; `<h1>`, `<h2>`, `<p>` tags from the service's own converter                                                                                                                | **Pass**                                                                                                                                                                                                                                                 |
| Unsupported PDF fails clearly                         | **New probe added**: the run now calls `exportContent(…, 'pdf')` and asserts `supported === false`, then refuses to write any `.pdf` file. Logged in the ledger trace.                       | **Pass** — `what-empty-miles-actually-cost-a-regional-fleet.pdf supported=false (Markdown bytes, NOT written)`; if a future change ever returns `supported=true`, the run fails with "pdf export claims supported=true — sample expectations are stale". |
| Sample data never enters a real client workspace      | In-memory repositories only; the process deletes `DATABASE_URL`, `CONTENT_AGENCY_DATABASE_URL`, `REDIS_URL`, etc. before importing services; new `SAMPLE-RUN.txt` stamp records this per run | **Pass**                                                                                                                                                                                                                                                 |
| Clearly labelled as a demonstration                   | Every file opens with `SAMPLE OUTPUT — NOT A CLIENT DELIVERABLE`; ledger trace states the payment "proves nothing about money"; new `SAMPLE-RUN.txt` states "NOT A CLIENT ENGAGEMENT"        | **Pass**                                                                                                                                                                                                                                                 |

**Legitimate changes made to the runner (additive only):**

1. PDF probe + hard failure on `supported=true` (above).
2. The "AI fee memo" section previously prompted the model to invent an internal
   fee memo — a document this offer does not sell, and pricing is stated by a human.
   It is now an **AI-drafted service summary** (scope + exclusions, no prices), writes
   to `sample-ai-summary.md`, and is rejected if the body is < 40 characters.
3. `SAMPLE-RUN.txt` written on every run: timestamp, AI mode, persistence statement,
   and the "not a client engagement" notice.
4. A `typeof memoBody !== 'string'` guard where the export payload is read, so the
   DTO-vs-payload bug cannot silently return.

Lint and typecheck of the runner: `npx eslint` → exit 0; `npx tsc --noEmit --strict …` → exit 0.

**Not verified:** a live AI run. No provider was reachable and `--local` (Ollama)
was not attempted. The package therefore contains **no model-generated deliverable**;
the AI path is wired and tested at the service layer, but not demonstrated here.

---

## 4. Step 3 — First-client package

All under `docs/pilot/`:

| Document                                                                               | Contents                                                                                                                                                                   |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`README.md`](../pilot/README.md)                                                      | Index: what to send vs. keep internal, pre-flight checklist, what is honestly missing                                                                                      |
| [`ONE-PAGE-OFFER.md`](../pilot/ONE-PAGE-OFFER.md)                                      | Target customer, problem, 8 deliverables, price, three sessions, exclusions, client responsibilities, verification rule, 7 acceptance criteria                             |
| [`MISSION-005-FIRST-PAYING-CLIENT.md`](../pilot/MISSION-005-FIRST-PAYING-CLIENT.md) §3 | Three-session onboarding agenda (updated §11 links)                                                                                                                        |
| [`sample-deliverable/`](../pilot/sample-deliverable/)                                  | Article MD + HTML, ledger trace, honest memo placeholder, `SAMPLE-RUN.txt`                                                                                                 |
| [`ACQUISITION-WORKFLOW.md`](../pilot/ACQUISITION-WORKFLOW.md) §2                       | Discovery-call questionnaire and structure                                                                                                                                 |
| [`PROPOSAL-AND-SOW.md`](../pilot/PROPOSAL-AND-SOW.md)                                  | Proposal + statement of work template: scope, schedule, exclusions, responsibilities, price, acceptance, revisions, cancellation, data, failure modes, signature block     |
| [`DELIVERY-TERMS.md`](../pilot/DELIVERY-TERMS.md)                                      | Timeline, binary acceptance checklist, revision/change scope, cancellation & no-show matrix, manual payment and receipt-verification procedure, automation-vs-manual table |
| [`CLIENT-DATA-HANDLING.md`](../pilot/CLIENT-DATA-HANDLING.md)                          | Data inventory, AI routing decision, six approval gates, deletion vs. append-only payments, disclosed gaps, client-facing summary                                          |
| [`COMMERCIAL-ACTION-PLAN.md`](../pilot/COMMERCIAL-ACTION-PLAN.md)                      | Ten-prospect tracker, three discovery calls, objection table, tailored-proposal step, agreement step, delivery + payment step                                              |

Every prospect-specific fact is a `[bracket]`. No price is presented as published.
The "what the service automates" table (`DELIVERY-TERMS.md` §6) lists sending,
verification, writing, publishing, PDF/DOCX and prospecting all as **manual**.

---

## 5. Step 4 — Minimum technical readiness

### In-memory tests

| Command                                                                                     | Result                                                                           |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `npx vitest run packages/services/src/content-agency services/content-agency/src/__tests__` | **104 passed**, 14 skipped (Postgres file skips without its URL), 8 files passed |
| `npm run typecheck` (`tsc -b && tsc --noEmit -p services/api`)                              | **exit 0**                                                                       |
| `npx vitest run …/migrations.unit.test.ts …/database-config.test.ts`                        | **21 passed** (Mission 005 baseline, unchanged)                                  |

### Disposable PostgreSQL integration tests — **RUN THIS MISSION**

| Step                      | Command                                                                                                                                                                            | Result                                |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Start disposable instance | `docker run -d --rm --name vedmoulya-m006-pg -e POSTGRES_PASSWORD=pw -p 5434:5432 postgres:16-alpine`                                                                              | started                               |
| Create test database      | `docker exec vedmoulya-m006-pg psql -U postgres -c "CREATE DATABASE m006_test;"`                                                                                                   | `CREATE DATABASE`                     |
| Run the suite             | `$env:CONTENT_AGENCY_TEST_DATABASE_URL='postgres://postgres:pw@127.0.0.1:5434/m006_test'; npx vitest run services/content-agency/src/__tests__/payment-integrity.postgres.test.ts` | **14 passed** (7.7 s)                 |
| Stop and remove           | `docker stop vedmoulya-m006-pg` (`--rm`)                                                                                                                                           | container gone (`docker ps -a` empty) |

The suite's own safety gate requires a loopback host **and** "test" in the database
name (`payment-integrity.postgres.test.ts:49-54`); both were satisfied. This is now
**observed**, not merely reported: idempotent replay, concurrent duplicates, conflict
detection, currency mismatch, coin-level split, rollback atomicity, migration drift,
failed-migration recovery and the invoice FK all pass against real PostgreSQL.

### Production checks

**Not performed, by design.** No deployment was made, `CONTENT_AGENCY_DATABASE_URL`
was never set, and no non-loopback database was contacted. The production boot guard
is covered only by unit tests (`database-config.test.ts`).

---

## 6. Step 5 — Commercial action plan (prepared, not executed)

[`docs/pilot/COMMERCIAL-ACTION-PLAN.md`](../pilot/COMMERCIAL-ACTION-PLAN.md):

1. **Identify 10 prospects** — sources restricted to existing relationships, inbound
   enquiries, participating communities, and explicit referrals. A ten-row tracker
   with a lawful-basis column, plus qualification against the seven hard criteria.
2. **Hold three discovery conversations** — the 30-minute structure, with the exact
   frame sentence and the price question ("is that a yes, a no, or a not-now?").
3. **Record genuine objections** — verbatim table plus an honest answer for each
   common objection ("can't ChatGPT do this?", "why so much for one article?",
   "is this AI-powered?", "send me a PDF").
4. **Prepare one tailored proposal** — copy the SOW, fill §1 from the call notes,
   owner approves, operator sends by hand, log the interaction.
5. **Agree scope, delivery, payment** — written acceptance quoted, dates held,
   `negotiation → won` on acceptance (accepted ≠ paid), AI routing decided.
6. **Deliver and record payment only after evidence** — readiness checks, three
   sessions, record → confirm zero → named human verifies → `reviewPayment`.

**No outreach was performed.** Prospecting and proposal writing are explicitly
labelled as non-revenue.

---

## 7. Step 6 — Report

### Final recommended offer

**Revenue Integrity Pilot — USD 1,500 (proposed, unvalidated): USD 500 on written
acceptance + USD 1,000 on Day-14 acceptance criteria.**

| Included                                                                                   | Excluded                                                     |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Client, brand profile, project setup                                                       | Publishing / distribution                                    |
| One 600–1,200-word human-authored article, reviewed, approved, exported as Markdown + HTML | Payment collection, card processing, tax advice              |
| One invoice (`sent`) with the client's real amount and due date                            | More articles, monthly production, social/email content      |
| One payment recorded with its real bank/processor reference, verified by a named human     | PDF / DOCX files                                             |
| Live idempotent-retry demonstration (one row)                                              | Hosted account, SLA, uptime guarantee                        |
| Written operating one-pager for month 2                                                    | Strategy, brand identity, SEO audits, competitor research    |
| Session summaries + 30 days of email support                                               | Data migration beyond one client + one invoice; legal review |

### Unresolved price decisions (none can be closed without a real buyer)

P1 opening number · P2 deposit split · P3 pilot-to-retainer credit · P4 currency and
collection channel · P5 future of B/C/D. Recorded in `OFFER-COMPARISON.md` §4.

### Current technical limitations

1. No production deployment; `CONTENT_AGENCY_DATABASE_URL` must point at a dedicated
   non-loopback database or production refuses to boot (unit-tested only).
2. Payment verification is human and self-attested; no processor webhook or bank feed.
3. Evidence is a reference **string**; no receipt document is stored.
4. Payment rows are append-only with **no delete path** — demos must use a throwaway workspace.
5. `exportContent('pdf'|'docx')` returns Markdown bytes with `supported: false`;
   the sample run now proves this and refuses to write such a file.
6. No live AI run in this package; AI drafting is wired and service-tested but not
   demonstrated.
7. The product sends nothing — proposals, invoices and reminders are manual.

### Required operator decisions

| #   | Decision                                                                                |
| --- | --------------------------------------------------------------------------------------- |
| O1  | Confirm USD 1,500 (or choose 900 / 2,500) after P1 reasoning                            |
| O2  | Approve the exact text of `ONE-PAGE-OFFER.md` and `PROPOSAL-AND-SOW.md` before any send |
| O3  | AI routing: local model or cloud provider; which model                                  |
| O4  | How B/C/D are labelled, corrected or withdrawn (U1–U7)                                  |
| O5  | Payment channel the first client will use                                               |
| O6  | Which existing relationship is prospect #1 (no contact made)                            |

### Git state

- **Branch** `main`, **HEAD** `b3a593590c2c6f00371bfc30cc02b8e22cb76996` — unchanged.
- **No commits, pushes, merges, tags, deployments or messages.**
- Working tree was already dirty at mission start (60 paths from Missions 002B/004/005);
  all preserved. Nothing was reset, discarded or reverted.

Files created or modified by Mission 006:

| File                                                                              | Change                                                                                                                                                             |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/pilot/OFFER-COMPARISON.md`                                                  | **New** — four offers compared, 7 ambiguities flagged, recommendation, open price decisions                                                                        |
| `docs/pilot/ONE-PAGE-OFFER.md`                                                    | **New** — one-page service offer (client-facing, approval-gated)                                                                                                   |
| `docs/pilot/PROPOSAL-AND-SOW.md`                                                  | **New** — proposal + statement of work template                                                                                                                    |
| `docs/pilot/DELIVERY-TERMS.md`                                                    | **New** — timeline, acceptance, revisions, cancellation, manual payment verification, automation table                                                             |
| `docs/pilot/CLIENT-DATA-HANDLING.md`                                              | **New** — data inventory, AI routing, approval gates, deletion, disclosed gaps                                                                                     |
| `docs/pilot/COMMERCIAL-ACTION-PLAN.md`                                            | **New** — 10 prospects → 3 calls → objections → proposal → agreement → delivery                                                                                    |
| `docs/pilot/README.md`                                                            | **New** — index, pre-flight checklist, honest gaps                                                                                                                 |
| `docs/pilot/ACQUISITION-WORKFLOW.md`                                              | Proposal template marked superseded by the SOW; `docs/business` warning now points at the comparison and says "do not send"                                        |
| `docs/pilot/MISSION-005-FIRST-PAYING-CLIENT.md`                                   | §11 related documents extended; sample list gains `SAMPLE-RUN.txt` and the PDF-probe note                                                                          |
| `scripts/pilot-sample-deliverable.ts`                                             | PDF probe + hard failure; AI memo → AI service summary (no invented pricing); 40-char body guard; string-type guard; `SAMPLE-RUN.txt`; renamed project description |
| `docs/pilot/sample-deliverable/*`                                                 | Regenerated this run (article MD/HTML, ledger trace, `SAMPLE-RUN.txt`)                                                                                             |
| `docs/audits/2026-10-26-mission-006-first-client-acquisition-readiness/REPORT.md` | This report                                                                                                                                                        |

### Confirmation

- No external messages were sent; no prospect was contacted.
- No database was mutated — the only database touched was a disposable Docker
  PostgreSQL created and destroyed within this mission, on loopback port 5434.
- No deployment, publish, push or merge occurred; nothing was committed.
- No customer data, testimonial, payment evidence or revenue was fabricated.

---

## 8. Verdict

The service is **ready to make the first real offer**, with four conditions:

1. The owner approves the offer text and fixes a price (P1–P4).
2. The pilot workspace passes the readiness checks the week of the engagement.
3. No AI-written deliverable, PDF/DOCX file, hosted account, SLA, publishing or
   payment collection is promised — none of those exist.
4. No revenue is reported until a payment is `verified`, quoted from
   `getRevenueOverview().paidTotal`.

It is not ready to promise B/C/D. It is not evidence of demand. The first honest
step is one approved message to one named person.

# Delivery terms — timeline, acceptance, revisions, cancellation, payment verification

**Status:** operating procedure · **Date:** 2026-10-26 · **Owner:** founder/operator
**Companions:** [`PROPOSAL-AND-SOW.md`](./PROPOSAL-AND-SOW.md) · [`CLIENT-DATA-HANDLING.md`](./CLIENT-DATA-HANDLING.md) · [`ACQUISITION-WORKFLOW.md`](./ACQUISITION-WORKFLOW.md)

> These terms are **proposed**, not legally reviewed. They describe what the
> operator will actually do. Nothing here has been agreed with a client, because
> no client exists. A lawyer should read them before they bind anyone.

---

## 1. Delivery timeline

| When       | What happens                                                                                                                                         | Done when                                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Day −3** | Scope confirmed in writing; operator readiness checklist (§9 of the pilot package) passes; three calendar holds accepted by the client               | Client has replied in writing and accepted the invites                                                                                              |
| **Day 0**  | **Session 1 (2 h)**: client + brand profile + project; one article captured, reviewed, approved, exported (MD + HTML); first invoice raised (`sent`) | Client sees the article and invoice in their own workspace and says the numbers are right                                                           |
| **Day 1**  | Files delivered by the operator; client confirms they open                                                                                           | Client confirms in writing                                                                                                                          |
| **Day 7**  | **Session 2 (2 h)**: one real payment recorded with its reference; recorded vs verified shown live; idempotent retry shown live                      | A payment row exists with a real reference and is `verified` by a named reviewer — **or** the "real payment" item is explicitly deferred in writing |
| **Day 14** | **Session 3 (2 h)**: client runs the loop unaided on a second client/month; operating one-pager written and signed off                               | Client completes the loop unaided within 30 minutes                                                                                                 |
| **Day 15** | Pilot review call (30 min): what worked, what did not, next step decided                                                                             | A written next-step decision exists (retainer / not now / no)                                                                                       |
| **Day 44** | Support window closes                                                                                                                                | Recorded in the close-out note                                                                                                                      |

**Slips.** Dates may move. What cannot move is the state each session must reach
before the next one starts. A move is recorded in the deal record with the reason.

---

## 2. Acceptance checklist (binary, Day 14)

Every line is yes/no. "Mostly" is a no.

- [ ] Client's own client record and one invoice exist in **their** workspace, with the amount **they** stated.
- [ ] One article was captured, reviewed, approved and exported; the exported file opens and reads correctly.
- [ ] One payment row exists with a real, independently sourced evidence reference, promoted from `recorded` to `verified` by a named reviewer.
- [ ] The revenue view never showed an unreviewed payment as received revenue — demonstrated live.
- [ ] A duplicate submission with the same idempotency key produced **one** ledger row — demonstrated live.
- [ ] The client completed the month-2 loop unaided, within 30 minutes.
- [ ] The operating one-pager was reviewed and accepted by the client in writing.

**If a criterion is not met**, the close-out records it as `MISSED` with a one-line
reason. It is never relabelled. The balance is then either (a) invoiced because all
criteria were met, or (b) renegotiated in writing against the reduced scope — never
invoiced silently.

---

## 3. Revision and change scope

| Item                               | Included                                                              | Not included                                                                    |
| ---------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Article revisions during Session 1 | Editing to the agreed brief, reviewed and approved in-session         | Rewriting the brief, changing the topic, or a different audience after approval |
| Article revisions after Session 1  | **One** additional revision round, within 5 business days of delivery | Further rounds; new research; SEO rewrites; tone changes across the whole piece |
| Deliverable additions              | none                                                                  | More articles, social posts, email campaigns, PDF/Word exports, extra clients   |
| Session rescheduling               | moving a session with ≥ 48 h notice                                   | no-shows without notice (see §4)                                                |
| Process changes                    | written amendment to the SOW                                          | verbal or in-app "yes"                                                          |

A change request is accepted only as a written amendment that states the new
price and/or date. The operating one-pager is the client's to change — it is text,
not software.

---

## 4. Cancellation, rescheduling and no-shows

| Situation                                                           | Position (proposed)                                                                                                     |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Client cancels in writing **before** Session 1, ≥ 48 h notice       | Deposit refunded in full within 10 business days                                                                        |
| Client cancels **before** Session 1, < 48 h notice                  | Deposit refunded in full; the operator may decline a reschedule                                                         |
| Client cancels **after** Session 1 has started                      | Deposit is non-refundable — work has begun; balance not owed unless acceptance criteria were met                        |
| Client cancels **between sessions**                                 | Work stops at the next session boundary. Anything already delivered stays delivered; nothing further is owed either way |
| Operator cancels for any reason                                     | Deposit refunded in full; any completed deliverable is handed over at no charge                                         |
| Client **no-shows** a session                                       | One reschedule within 7 days at no cost; a second no-show ends the engagement with the deposit non-refundable           |
| Operator no-shows                                                   | Session rescheduled at the client's convenience; the schedule and acceptance date move accordingly                      |
| Client misses a required input (payment reference, invoice details) | The dependent acceptance criterion stays open — it is not waived, and the balance is not due while it is open           |
| Support window                                                      | 30 days from Session 3; questions outside it are answered or declined politely                                          |

**Not offered:** refunds for dissatisfaction after delivery, performance guarantees,
or revenue promises of any kind. The pilot's promise is a working loop and an
honest ledger — not an income outcome.

---

## 5. Manual payment and receipt-verification procedure

The product **records and verifies** a payment. It does **not** collect money.
Invoicing the client and receiving the transfer happen outside the product. The
rule is: **recorded ≠ received.**

### 5.1 Before money moves

- [ ] Scope confirmed in writing; acceptance criteria attached.
- [ ] Dates held **before** the invoice is requested.
- [ ] Invoice created with the real amount, currency and due date; marked `sent`.
- [ ] Sent to the client **manually** by the operator (the product sends nothing).

### 5.2 When money appears in the account

- [ ] Confirm it is visible in the real bank/processor account — not a verbal claim, not a screenshot alone.
- [ ] Copy the transfer reference / transaction id **exactly** as shown, including hyphens and casing.
- [ ] If the reference is not visible yet, the payment has not arrived — wait. Do not record "pending" money.

### 5.3 Recording it

- [ ] `addPayment` with: invoice id, exact amount, currency, method, `evidence.kind = processor_reference`, `evidence.reference = <exact reference>`, and a stable `idempotencyKey` (e.g. `<processor>-<txn-id>`).
- [ ] Response status is `recorded`.
- [ ] Revenue view still shows **0 received** for that amount. That is correct — confirm it, do not "fix" it.
- [ ] Re-submitting the same key returns the same payment id (one row).

### 5.4 Verifying it

- [ ] A **named human** has compared the reference against the source account.
- [ ] `reviewPayment` called with that person's identity.
- [ ] Status becomes `verified`; the revenue view's paid total includes it.
- [ ] Invoice flips to `paid` **only** if the verified total covers the amount.
- [ ] Any discrepancy (partial, wrong currency, duplicate) is written into the record — not hand-edited in a database.

### 5.5 Reporting

- [ ] Only `verified` amounts are quoted as revenue.
- [ ] Unverified amounts are quoted as "recorded, awaiting verification".
- [ ] Accepted-but-unpaid pilots are "accepted, unpaid" — never revenue.
- [ ] The weekly review in [`OUTCOME-TRACKING.md`](./OUTCOME-TRACKING.md) §3 is filled from these numbers, not from memory.

### 5.6 Known limits of this procedure — disclose if asked

- Reviewer identity is self-declared (audit trail, not a signature).
- Evidence is a reference **string**; no receipt document is stored.
- No processor webhook or bank feed exists — a human compares.
- Payment rows cannot be deleted. Never create sample payments in a client's real
  workspace; use a throwaway workspace for demos.

---

## 6. What the product automates, and what it does not

| Step                                                    | Automated?                           | Detail                                           |
| ------------------------------------------------------- | ------------------------------------ | ------------------------------------------------ |
| Creating client / brand / project records               | yes                                  | in-app                                           |
| Capturing, versioning, reviewing, approving an article  | yes                                  | in-app                                           |
| Exporting Markdown / HTML                               | yes                                  | in-app                                           |
| Raising an invoice and changing its status              | partial                              | status only — **sending is manual**              |
| Recording a payment and rejecting duplicate submissions | yes                                  | idempotency enforced                             |
| Verifying a payment                                     | **no** — a human decides and attests | `reviewPayment` records the human's decision     |
| Sending any message (proposal, invoice, reminder)       | **no**                               | nothing is emailed by the product                |
| Writing or fact-checking the article                    | **no**                               | human-authored; AI output is an unverified draft |
| Publishing to the client's channels                     | **no**                               | files are exported, not posted                   |
| PDF / Word export                                       | **no**                               | returns `supported: false`                       |
| Prospecting, qualification, pricing                     | **no**                               | manual                                           |

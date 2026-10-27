# VedMoulya — The Revenue Integrity Pilot

**Status:** ready to offer · **Version:** 1.0 · **Date:** 2026-10-26
**Produced by:** MISSION 005 (first paying client) · **Author:** agent, for owner review

> **Read this first.** No client, payment, testimonial, demand signal or revenue is
> represented anywhere in this package. Placeholders in square brackets
> (`[Prospect Name]`, `[Date]`, `[Your Price]`) are facts only the operator can
> supply. Prices below are **proposals under validation**, not tested prices.
> Nothing in this package authorises outreach: every outbound message needs the
> owner's explicit approval before it is sent (see
> [`ACQUISITION-WORKFLOW.md`](./ACQUISITION-WORKFLOW.md) §0).

---

## 1. What we are actually selling

We are not selling "an AI agency". We are selling **one job, done by a named
human, using a revenue ledger that refuses to over-count money.**

The pilot installs and demonstrates a small, real capability:

> A content freelancer / micro-agency can create a client, raise an invoice,
> record the payment with a receipt reference, mark the receipt as reviewed, and
> get a revenue figure that only counts money a human has actually verified —
> with a ledger that cannot double-count a retried entry.

That capability exists in the application today and is covered by tests
(`../audits/2026-10-26-mission-005-first-paying-client/REPORT.md` §2 records
exactly what was verified in this mission — read that section before quoting
anything here to a prospect). **Demo script:** the pilot is delivered by
repeating the sequence in
[`sample-deliverable/sample-ledger-trace.md`](./sample-deliverable/sample-ledger-trace.md)
(client → brand → project → article → invoice → recorded → replay → verified →
revenue), which is the same call order the sample runner executes. The pilot sells
the _installation, the operating
habit, and a live demonstration_ of it — plus editorial work by a human, which
is the part a client actually pays for.

### What is genuinely deliverable today

| Capability                                                                                             | State                                                                 | Where                                               |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | --------------------------------------------------- |
| Client, brand profile, project records                                                                 | Working (service + UI)                                                | `/content-agency/clients`, `/brands`, `/projects`   |
| Content item captured, versioned, reviewed, approved, exported (Markdown/HTML)                         | Working (service + UI)                                                | `/content-agency/generator`, `/review`, `/delivery` |
| AI draft generation through a real provider                                                            | Working **when a provider key is configured**; fails loudly otherwise | `ContentAgencyAIService`                            |
| CRM pipeline lead → qualified → proposal → negotiation → won/lost                                      | Working (service + UI)                                                | `/content-agency/ops/crm`                           |
| Proposal drafting, versioning, export to Markdown/HTML                                                 | Working (service + UI)                                                | `/content-agency/ops/proposals`                     |
| Invoice creation and status (`draft` → `sent` → `paid`)                                                | Working (service + UI)                                                | `/content-agency/invoices`                          |
| Payment recorded with mandatory evidence, idempotent replay, review/verify gate, verified-only revenue | Working; PostgreSQL-backed, atomic (reported Mission 002B)            | `/content-agency/ops/payments`                      |
| Client portal (token login, approve/comment, invoices)                                                 | Working (service + UI)                                                | `/content-agency/ops/portal`                        |

### What still requires a human (every time)

| Step                                            | Why a human is required                                                                                              |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Discovery, qualification, pricing               | No automation exists or is claimed                                                                                   |
| **Sending** the proposal, quote or invoice      | `sendProposal` only changes status and writes an in-app notification; **nothing is emailed**. The operator sends it. |
| Writing the article                             | The demo article is human-authored; AI output is a draft to be reviewed                                              |
| Editing and fact-checking AI output             | The model's claims are not verified by the product                                                                   |
| Confirming the money arrived                    | Evidence is typed in by a human; there is no processor webhook, bank feed or reconciliation                          |
| Attesting the reviewer                          | `reviewedBy` is a self-declared identity — an audit trail, not a signature                                           |
| Publishing to the client's channels             | The product exports files; it does not post                                                                          |
| Access provisioning, backups, incident response | Operator runbooks, not product features                                                                              |

### Not demonstrated / not sold

- No autonomous prospecting, cold-emailing or publishing.
- No payment processor integration (no Stripe checkout, no webhooks).
- No PDF/DOCX rendering (`exportContent` returns `supported: false` for those).
- No hosted multi-tenant setup: a production deployment requires the operator to
  run the service with `CONTENT_AGENCY_DATABASE_URL` configured. **Do not promise
  a hosted SaaS account.**
- No receipts on file: evidence is a reference string, not a stored document.

---

## 2. Target customer and problem

**Target customer:** an independent content marketer, fractional CMO, or 1–5
person content studio who (a) already bills clients for written content, (b)
already uses AI tools informally, and (c) has lost track of which invoice was
actually paid at least once.

**Trigger:** they are invoicing 3+ clients a month and reconciling payments from
a spreadsheet, a bank app and a WhatsApp thread.

**Problem (stated in their words, not ours):**

- "I don't know how much I actually made this month."
- "I thought I'd been paid for that one — the client says they did."
- "I rewrote the same invoice twice and panicked about double-billing."

**What we do not know and must not assume:** whether they will pay. That is the
point of the pilot price being labelled _unvalidated_.

**Explicitly out of scope as a customer:** anyone needing a hosted product,
automated publishing, payment collection from their own customers, or content
strategy from scratch.

Full qualification criteria: [`ACQUISITION-WORKFLOW.md`](./ACQUISITION-WORKFLOW.md) §1.

---

## 3. The three sessions

Two hours each, one week apart, live over a call with screen sharing. The
operator (a named person) does the work in the session; the client watches,
asks, and makes decisions.

### Session 1 — "Your numbers, on the record" (Day 0–2)

|                    |                                                                                                                                                                                                                                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**           | The client's real (or first-sample) client and invoice exist in the system, and one article is captured end-to-end.                                                                                                                                                                                                               |
| **Activities**     | Confirm scope in writing. Create the client record and brand profile from a 20-minute intake. Create the engagement project. Capture one article — either human-authored, or drafted with the AI pipeline and then edited live. Approve it through the review step and export Markdown + HTML. Create the first invoice (`sent`). |
| **Client decides** | Which client, which article, which price.                                                                                                                                                                                                                                                                                         |
| **Output**         | Live demo of every step; exported article files; invoice number.                                                                                                                                                                                                                                                                  |
| **Exit criterion** | Client sees the article and invoice in their own workspace and says the numbers are right.                                                                                                                                                                                                                                        |

### Session 2 — "Money on the record" (Day 7)

|                    |                                                                                                                                                                                                                                                                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**           | One real payment recorded, with evidence, and the difference between _recorded_ and _verified_ made visible.                                                                                                                                                                                                                                                |
| **Activities**     | Record a payment against the invoice with the bank/processor reference. Show the revenue view: the amount appears as **recorded**, not as received. Submit an identical retry with the same idempotency key — one row, not two. Review the evidence as the operator, then show the revenue view move to **verified** (and the invoice settle when covered). |
| **Precondition**   | A real payment has actually arrived (see §7). If none has, the session uses a clearly labelled sample entry and the "real payment" milestone stays open.                                                                                                                                                                                                    |
| **Output**         | Ledger trace for the payment, before/after revenue figures, idempotency demonstration.                                                                                                                                                                                                                                                                      |
| **Exit criterion** | Client can explain, in their own words, why an unreviewed payment is not revenue.                                                                                                                                                                                                                                                                           |

### Session 3 — "Handover and the next invoice" (Day 14)

|                    |                                                                                                                                                                                                                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**           | The client (or their assistant) can run the loop without us.                                                                                                                                                                                                                              |
| **Activities**     | The client performs Session 1's client+invoice and Session 2's payment+review unaided, on a second client or the next month. Operator observes and corrects. Write down the operating checklist together (§4, "Included", item 4). Review what broke. Agree whether a retainer is wanted. |
| **Output**         | Completed handover checklist signed off; a written "how we run this" one-pager; next-step decision recorded.                                                                                                                                                                              |
| **Exit criterion** | The client completes the loop unaided within 30 minutes.                                                                                                                                                                                                                                  |

---

## 4. Deliverables and exclusions

### Included

1. **Setup** — client, brand profile, one project, in the client's workspace.
2. **One article** (600–1,200 words), edited and approved, exported as Markdown and HTML. Authored by a human; AI, if used, only as a drafting assistant under human editing.
3. **One invoice** and **one payment ledger entry** with review/verification walkthrough.
4. **A written operating one-pager** — the exact steps the client repeats each month.
5. **A recorded or written session summary** for each of the three sessions.
6. **30 days of email support** for questions about the pilot workflow, answered by a named person within two business days.

### Excluded (say this out loud during the call)

- More than one article; ongoing monthly production; social posts, email campaigns, landing pages.
- Publishing, scheduling or distribution to any channel.
- Payment collection from the client's customers, payment processing, or tax advice.
- A hosted/SaaS account, uptime commitment, SLA, or 24/7 support.
- Content strategy, brand identity design, SEO audits, or competitor research beyond what the article needs.
- Data migration from existing tools beyond one client and one invoice.
- Legal review of contracts.

### Sample deliverable

- [`sample-deliverable/sample-authored-article.md`](./sample-deliverable/sample-authored-article.md) — exported from a real content item through `exportContent` (Markdown payload).
- [`sample-deliverable/sample-authored-article.html`](./sample-deliverable/sample-authored-article.html) — the same item exported as HTML.
- [`sample-deliverable/sample-ledger-trace.md`](./sample-deliverable/sample-ledger-trace.md) — invoice → recorded payment → idempotent retry → verification → revenue, produced by the application services.
- [`sample-deliverable/sample-fee-memo.md`](./sample-deliverable/sample-fee-memo.md) — **not** model output in the shipped package: the last `--local` run's memo was corrupted by an export-DTO bug that is now fixed, and the file was regenerated with `--no-ai`. It says so instead of pretending. Regenerate with `--local` before showing AI drafting to a prospect.
- [`sample-deliverable/SAMPLE-RUN.txt`](./sample-deliverable/SAMPLE-RUN.txt) — a stamp written by each run: timestamp, AI mode, persistence (in-memory, no database contacted), and the reminder that nothing here is a client engagement.

The run also **probes** PDF export and records `supported=false` in the ledger
run log. No `.pdf`/`.docx` file is ever written — the service returns Markdown
bytes under those filenames (`ContentAgencyApplicationService.ts:786-800`).

Every file carries a SAMPLE banner. Regenerate with
`npx tsx scripts/pilot-sample-deliverable.ts --local` (see §10).

---

## 5. Client responsibilities and required access

### Client must provide

| Item                                                  | When  | Why                                               |
| ----------------------------------------------------- | ----- | ------------------------------------------------- |
| A named owner who attends all three sessions          | Day 0 | Decisions cannot be delegated mid-pilot           |
| One client and one article brief (500 words max)      | Day 0 | The pilot's raw material                          |
| The real invoice details (amount, currency, due date) | Day 0 | The ledger must hold their real number            |
| The real payment reference once money arrives         | Day 7 | Evidence must be a true reference, never invented |
| Access to their VedMoulya account (sign-in)           | Day 0 | Sessions happen in _their_ workspace              |
| A channel to receive files (email/Drive)              | Day 0 | Export is a file, not a publication               |
| Any brand guidelines they want honoured               | Day 0 | Brand profile rules are only as good as the input |

### Operator must provide

| Item                                                                                                        | Why                                        |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| A named human who writes/edits the article and answers support mail                                         | The service is human-delivered             |
| A prior review of every AI-drafted statement before it leaves the building                                  | Model output is unverified by the product  |
| A written scope confirmation before Session 1                                                               | Prevents scope creep                       |
| A production deployment check before Session 1 (database URL configured, migrations applied, sign-in works) | The pilot runs on a live instance — see §9 |

### Access we will **not** ask for

Bank logins, email passwords, social account passwords, card numbers, or any
client-customer personal data. A payment _reference_ is sufficient.

---

## 6. Timeline and acceptance criteria

```text
Day -3  Scope confirmed in writing; pilot instance checked; dates held
Day 0   Session 1 (2h) — client + invoice + article captured and exported
Day 1   Files sent; client confirms numbers
Day 7   Session 2 (2h) — payment recorded and verified (or explicitly deferred)
Day 14  Session 3 (2h) — client runs the loop unaided; one-pager signed off
Day 15  Pilot review call (30 min) — what worked, what didn't, next step
Day 44  Support window closes
```

Slips are allowed; the _state_ of each session is what matters, not the date.

### Acceptance criteria (binary, checked at Day 14)

- [ ] The client's own client record and one invoice exist in their workspace, with the amount they stated.
- [ ] One article was captured, reviewed, approved and exported — the exported file opens and reads correctly.
- [ ] One payment row exists with a real, independently sourced evidence reference, and was promoted from **recorded** to **verified** by a named reviewer.
- [ ] The revenue view never showed an unreviewed payment as received revenue (demonstrated live).
- [ ] A duplicate submission with the same idempotency key produced **one** ledger row (demonstrated live).
- [ ] The client completed the Month-2 loop unaided, within 30 minutes.
- [ ] The operating one-pager was reviewed and accepted by the client in writing.

Any unmet criterion is recorded as such in the pilot close-out — the pilot is
not "passed" by relabelling a miss.

---

## 7. Price and payment milestones — **UNVALIDATED**

> **These numbers are a proposal, not evidence of willingness to pay.** They have
> not been tested with a prospect. Treat the first three discovery calls as price
> research, and change the number without apology if the signal says so.

| Milestone | Trigger                                         | Amount (proposed) |
| --------- | ----------------------------------------------- | ----------------- |
| Deposit   | Scope confirmed in writing, Session 1 scheduled | **USD 500**       |
| Balance   | All acceptance criteria in §6 met (Day 14)      | **USD 1,000**     |
| **Total** | **USD 1,500**                                   |

Rationale to state plainly: 6 hours of live sessions + editing + handover ≈ 12–14
operator hours. USD 1,500 is ~USD 110–125/hour, at the low end of a specialist
consulting rate, because the first engagement is also _our_ validation run.

Alternatives to test with prospects (record which one they react to):

| Variant                                 | Price                  | When to offer                                       |
| --------------------------------------- | ---------------------- | --------------------------------------------------- |
| Fixed fee (default)                     | USD 1,500              | Standard                                            |
| Lower, refund-on-retainer               | USD 900                | Prospect hesitates on price but likes the outcome   |
| Priced against their lost-invoice story | `[their number]` × 0.5 | Prospect quantifies their own loss above USD 3,000  |
| Not offered yet                         | —                      | Retainer; do not sell before the pilot is delivered |

**Payment mechanics (honest limits):**

- The product records and verifies a payment; **it does not collect money**.
  Invoicing the client and receiving the transfer happen outside the product.
- Once money arrives, it is recorded in Client Ops with the real transfer
  reference and reviewed by the operator. Only then does it count as revenue.
- Until that happens, the deal is an **accepted pilot**, not revenue. Report it as such.

---

## 8. Privacy, data handling and human review

### Data the pilot touches

| Data                                         | Where it lives           | Sent to AI provider?                                     |
| -------------------------------------------- | ------------------------ | -------------------------------------------------------- |
| Client company, brand profile, article brief | Pilot workspace database | Only the brief/brand context needed for a draft          |
| Article text                                 | Pilot workspace database | Yes, if AI drafting is used (to the configured provider) |
| Invoice amount, due date                     | Pilot workspace database | No                                                       |
| Payment reference string                     | Pilot workspace database | No                                                       |
| Client's end-customer personal data          | **Not collected**        | No                                                       |

- **No payment card data** is ever entered. Only a reference.
- **No client-customer personal data** is required. If an article needs a
  customer example, the client supplies it in an anonymised form.
- AI provider routing is configured by the operator. On this machine the local
  Ollama model can be used so that no text leaves the machine at all; a cloud
  provider can be selected deliberately. **Say which one is being used** before
  the first draft.
- Files are exported and handed over by the operator; there is no automatic
  publication or sharing.

### Human review expectations

1. Every AI-drafted sentence is read by a human before it is shown to the client.
2. No statistic, customer name or claim is published that the client has not
   supplied and confirmed.
3. A payment is only marked **verified** by a named human who has seen the
   reference; the product cannot and does not verify money by itself.
4. Deletion on request: clients, projects, brands, content items and invoices can
   be deleted by the operator (`deleteClient`, `deleteInvoice`, …). **Payment rows
   have no delete path** in the product — they are an append-only audit trail.
   Because of that, do not create sample payment rows inside a client's real
   workspace; use a throwaway workspace for demonstrations. Agree in writing what
   happens to the pilot workspace at close-out.

### Honest gaps to disclose if asked

- Reviewer identity is self-declared (audit trail, not a signature).
- Evidence is a reference string, not an uploaded receipt.
- There is no processor reconciliation; a human does it.

---

## 9. Before the first session — operator readiness

Run these yourself; do not ask the client to.

1. **Instance**: production/staging boots with `CONTENT_AGENCY_DATABASE_URL` set
   to a dedicated database (a loopback or identity-shared target is refused).
2. **Migrations**: content-agency migrations run at boot; confirm they are at
   head and the ledger shows no drift.
3. **Sign-in**: the client can sign in and reach `/content-agency`.
4. **AI**: decide local vs cloud provider; confirm a draft generates, and record
   which model produced it.
5. **Payment path**: confirm a test payment on a throwaway invoice behaves as
   described (recorded → verified → settled), then delete the throwaway data.
6. **Backup**: know how you would restore the pilot database; the runbook is
   `docs/runbooks/backup-restore-runbook.md`.

If any of these fail, the pilot is **not** deliverable that week — say so rather
than improvising in front of the client.

---

## 10. Reproducing the sample

```powershell
# ledger + article only, no model call
npx tsx scripts/pilot-sample-deliverable.ts --no-ai

# full sample: memo generated by the local model only (no cloud keys used)
npx tsx scripts/pilot-sample-deliverable.ts --local

# full sample: configured provider chain (cloud keys from your environment)
npx tsx scripts/pilot-sample-deliverable.ts
```

Output lands in `docs/pilot/sample-deliverable/`. The run uses in-memory
repositories and deletes all database URLs from its own process, so it cannot
reach Neon or production.

---

## 11. Related documents

- [`ACQUISITION-WORKFLOW.md`](./ACQUISITION-WORKFLOW.md) — qualification, discovery, outreach, proposal, follow-up, delivery and payment checklists.
- [`ONE-PAGE-OFFER.md`](./ONE-PAGE-OFFER.md) — the single page to put in front of a prospect.
- [`OFFER-COMPARISON.md`](./OFFER-COMPARISON.md) — how the USD 1,500 pilot differs from the `docs/business/*` prices ($2,300 / $3,000 / $4,400), plus the open price decisions.
- [`PROPOSAL-AND-SOW.md`](./PROPOSAL-AND-SOW.md) — proposal + statement of work template for this offer.
- [`DELIVERY-TERMS.md`](./DELIVERY-TERMS.md) — timeline, acceptance checklist, revisions, cancellation, and the manual payment/verification procedure.
- [`CLIENT-DATA-HANDLING.md`](./CLIENT-DATA-HANDLING.md) — data touched, AI routing decision, approval gates, deletion and the append-only payment trail.
- [`COMMERCIAL-ACTION-PLAN.md`](./COMMERCIAL-ACTION-PLAN.md) — 10 prospects → 3 discovery calls → 1 proposal → agreement → delivery.
- [`OUTCOME-TRACKING.md`](./OUTCOME-TRACKING.md) — how prospects, opportunities, invoices and payments are tracked, and what may be called revenue.
- [`../audits/2026-10-26-mission-005-first-paying-client/REPORT.md`](../audits/2026-10-26-mission-005-first-paying-client/REPORT.md) — the evidence behind every claim in this package.
- [`../audits/2026-10-26-mission-006-first-client-acquisition-readiness/REPORT.md`](../audits/2026-10-26-mission-006-first-client-acquisition-readiness/REPORT.md) — Mission 006: offer comparison, sample verification, PostgreSQL test re-run.

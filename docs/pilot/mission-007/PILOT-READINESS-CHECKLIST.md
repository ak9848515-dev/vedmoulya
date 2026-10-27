# Pilot readiness checklist — before you accept a pilot

**Status:** checklist, not yet run against any client · **Created:** 2026-10-26 · **Owner:** founder/operator
**Use for:** every prospective pilot, before you say yes.

> **Read this before you accept, not after you accept.** Almost every one of these
> items can still be fixed the day before Session 1. Almost none can be fixed in
> front of the client, mid-session, without damaging trust.
>
> A pilot that fails this checklist is **not deliverable this week.** Say so. An
> honest postponement is cheap; an improvised session is not.

---

## Gate 0 — Can this client be piloted at all?

- [ ] The person on the call can **decide and pay** (or has already introduced the person who can, by name).
- [ ] They meet all seven hard criteria (`../ACQUISITION-WORKFLOW.md` §1) — verified in conversation, not assumed.
- [ ] They have a **real client** and a **real invoice** to use, or have explicitly accepted a clearly-labelled sample.
- [ ] A real payment is **plausible** inside the 3-week window (they invoice monthly, they expect to be paid).
- [ ] They are **not** asking for anything excluded: hosting, SLA, publishing, PDFs, payment collection, autonomous operation, more than one article.
- [ ] No procurement process longer than 3 weeks.

**Any box unticked → do not accept yet.** Record the reason and the next date.

---

## Gate 1 — Scope agreed in writing

- [ ] The one-pager ([`../ONE-PAGE-OFFER.md`](../ONE-PAGE-OFFER.md)) was sent and they replied to it.
- [ ] The proposal/SOW ([`../PROPOSAL-AND-SOW.md`](../PROPOSAL-AND-SOW.md)) has **every bracket replaced** — no `[ ]` left in the client-facing text.
- [ ] Scope is exactly: 1 client · 1 brand profile · 1 project · 1 article (600–1,200 w) · 1 invoice · 1 recorded+verified payment · 1 operating one-pager · 3 session summaries · 30 days email support.
- [ ] Nothing was added verbally on a call that is missing from the SOW.
- [ ] The client's written acceptance is **quoted in the deal record**.

## Gate 2 — Customer access and inputs

- [ ] A **named owner** will attend all three sessions — name written down.
- [ ] They can sign in to their workspace (tested, or scheduled to be tested).
- [ ] The article brief (≤ 500 words) is in hand.
- [ ] The real invoice details are in hand: amount, currency, due date.
- [ ] A channel exists to deliver the exported files (email or Drive link).
- [ ] Brand guidelines, if any, are in hand.
- [ ] Calendar: three holds accepted by the client, with dates.

## Gate 3 — Data permissions and AI routing

- [ ] The client has chosen **AI drafting: yes or no**.
- [ ] If yes: the provider (local or cloud) and model are agreed **before** the first draft, and written into the session summary.
- [ ] They understand their article text goes to that provider only if AI is used.
- [ ] They have confirmed **no** customer personal data, card data, or bank credentials will be shared.
- [ ] The data-handling summary ([`../CLIENT-DATA-HANDLING.md`](../CLIENT-DATA-HANDLING.md) §7) was shared.
- [ ] Written agreement on what happens to the workspace at close-out (deleted / returned / retained).

## Gate 4 — Deliverables and limitations confirmed with the client

Say these **out loud** in Session 1, not only in the document:

- [ ] The article is **written and edited by a human**. AI may draft; no AI text is delivered unreviewed.
- [ ] Export is **Markdown and HTML only**. No PDF, no Word.
- [ ] The product **records and verifies** a payment; it does **not** collect money.
- [ ] A **recorded** payment is not proof of receipt until a named human has compared the reference against the real account.
- [ ] Proposals, invoices, emails and publishing are **manual**. The product sends nothing.
- [ ] There is **no hosted service, no uptime guarantee, no SLA**.
- [ ] No business outcome, savings, ranking or growth is promised.

## Gate 5 — Acceptance criteria and revisions

- [ ] The seven Day-14 criteria are attached to the SOW, verbatim.
- [ ] The client has read them and knows what "missed" means.
- [ ] Revision limit confirmed: **one** additional revision round after Session 1, within 5 business days.
- [ ] Scope-change rule confirmed: written amendment only; no verbal additions.
- [ ] Cancellation/no-show terms (SOW §9 / `../DELIVERY-TERMS.md` §4) sent and acknowledged.

## Gate 6 — Payment terms

- [ ] Price confirmed in writing: **USD 1,500** = 500 deposit + 1,000 on acceptance (or the variant the owner authorised).
- [ ] Deposit invoice created with the real amount, currency and due date.
- [ ] The client knows how to pay (bank details / processor) — outside the product.
- [ ] The client knows the balance is invoiced only after all seven criteria are met.
- [ ] Deal record quotes the acceptance; status is `negotiation` → `won` **on acceptance, not on payment**.

## Gate 7 — Manual verification responsibility

- [ ] A **named human** (the operator) will compare the payment reference against the bank/processor account. That name is in the plan.
- [ ] The client understands the operator — not the software — decides when money is "verified".
- [ ] Evidence format agreed: `evidence.kind = processor_reference`, `evidence.reference = <exact reference>`.
- [ ] Idempotency key convention agreed: `<processor>-<txn-id>`.
- [ ] Everyone knows: payment rows **cannot be deleted**; demo rows go in a throwaway workspace.
- [ ] Everyone knows: revenue is quoted **only** from verified payments.

## Gate 8 — Operator environment

- [ ] `CONTENT_AGENCY_DATABASE_URL` set to a dedicated non-loopback database (production refuses to boot otherwise — unit-tested only, so verify by booting).
- [ ] Migrations at head; ledger shows no drift.
- [ ] Client sign-in works end to end.
- [ ] The AI provider (if used) generates a draft and the model name is recorded.
- [ ] A dry run of the whole loop on a throwaway workspace: client → article → export → invoice → record → replay (one row) → verify → revenue moves.
- [ ] Backup/restore understood: `docs/runbooks/backup-restore-runbook.md`.
- [ ] A throwaway workspace exists for session demos.

## Gate 9 — Go / no-go decision (the day before Session 1)

| Check                                                                        | Pass? |
| ---------------------------------------------------------------------------- | ----- |
| All eight gates above complete                                               | `[ ]` |
| Nothing excluded was promised verbally                                       | `[ ]` |
| The operator can deliver the article without a provider they have not tested | `[ ]` |
| Dates confirmed with the client today                                        | `[ ]` |

**If any is "no": postpone in writing today**, with a new date and what must be true
for that date. Do not improvise in front of the client.

---

## Post-acceptance, pre-session record

```text
Client:                 [ ]                     Owner attending: [ ]
Dates held:              S1 [ ]  S2 [ ]  S3 [ ]  Support ends: [ ]
AI routing:              [none | local <model> | cloud <provider/model>]
Deposit invoice:         [ ] USD [500]  due [ ]
Scope acknowledged:      [ ] yes, in writing, quote: "[ ]"
Data close-out agreed:   [deleted | returned | retained]
Throwaway workspace:     [ ] created, not the client's
Verification owner:      [name] will compare references
```

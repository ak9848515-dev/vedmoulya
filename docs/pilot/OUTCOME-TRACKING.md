# Outcome tracking — prospects, deals, invoices, money

**Status:** operating procedure · **Date:** 2026-10-26 · **Owner:** founder/operator
**Companions:** [`MISSION-005-FIRST-PAYING-CLIENT.md`](./MISSION-005-FIRST-PAYING-CLIENT.md) · [`ACQUISITION-WORKFLOW.md`](./ACQUISITION-WORKFLOW.md)

> This document defines one thing: **what may be called what.** It exists so that a
> prospect is never reported as a client, an accepted pilot is never reported as
> revenue, and a typed-in reference is never reported as money in the bank.

At the time of writing, **no prospect, no conversation, no proposal, no acceptance,
no invoice, no payment and no revenue exist.** Every row below is empty on purpose.

---

## 1. The state ladder

Each rung is a stricter claim than the one below it. You may only move up when the
evidence column is satisfied — not when you expect it to be satisfied later.

| # | State | Where it lives | Evidence required to enter | May be called |
|---|---|---|
| 1 | **Prospect** | Lead (`createLead`, status `lead`) | You have identified a named person and recorded they fit §1 of the acquisition workflow | "a prospect" |
| 2 | **Conversation** | Lead + `addInteraction` | A reply or a call actually happened; the note contains their words | "a conversation" |
| 3 | **Qualified opportunity** | Lead, status `qualified` | All hard criteria met and soft total ≥ 5 (ACQUISITION-WORKFLOW §1) | "a qualified opportunity" |
| 4 | **Proposal** | Proposal record + lead status `proposal` | Written, personalised proposal sent manually by the operator | "a proposal sent" |
| 5 | **Accepted pilot** | Lead status `negotiation` → `won`; client record auto-provisions on `won` | Written acceptance ("accepted" by email is enough) + dates held | "an accepted pilot, unpaid" |
| 6 | **Invoice issued** | Invoice, status `sent` | Real amount, currency, due date; sent manually | "invoiced, not paid" |
| 7 | **Payment recorded** | Payment row, status `recorded` | Exact amount, method, idempotency key, and a real reference the operator saw in a bank/processor account | "recorded, awaiting verification" |
| 8 | **Payment verified** | Payment row, status `verified` | A **named human** compared the reference against the source account, then `reviewPayment` | "received" — and only now does it enter revenue |
| 9 | **Delivered work** | Session checklists (§6 of the acquisition workflow) + acceptance criteria | All seven Day-14 criteria checked, misses recorded as misses | "delivered" |

### Rules that follow from the ladder

- A `won` lead is **an accepted pilot**, not income. Nothing about `won` proves money.
- A `recorded` payment is **a claim awaiting review**, not income.
- Revenue = sum of `verified` payments only. `getRevenueOverview().paidTotal` is the
  only runtime number that may be quoted as revenue; `recordedTotal` and
  `unverifiedTotal` must be quoted separately, by those names.
- "Delivered" is never inferred from "invoiced". The client's acceptance of the
  one-pager and their unaided Month-2 run are what make it delivered.
- Losing a deal is a state too: mark it `lost` with a one-line reason. An
  unclosed lead older than 14 days is stale, not pending.

---

## 2. Where each rung is recorded

| Rung                                | Product surface                       | Field                                                                            |
| ----------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------- |
| Prospect / conversation / qualified | `/content-agency/ops/crm`             | `lead.status`, `source`, `nextFollowUp`, interactions, tasks                     |
| Proposal                            | `/content-agency/ops/proposals` + CRM | proposal record (versions, exported Markdown/HTML), lead status `proposal`       |
| Accepted pilot                      | CRM                                   | `moveLead(…, 'won')` — auto-provisions the AC-001 client                         |
| Invoice                             | `/content-agency/invoices`            | `status`: `draft` → `sent` → `paid`                                              |
| Recorded payment                    | `/content-agency/ops/payments`        | `addPayment` → `status: 'recorded'`, `idempotencyKey`, `evidence.kind/reference` |
| Verified payment                    | `/content-agency/ops/payments`        | `reviewPayment` → `status: 'verified'`, `evidenceReviewedBy`, `verifiedAt`       |
| Delivered work                      | Session checklists                    | Monthly operating one-pager; acceptance-criteria list                            |

> **Sending is manual.** `sendProposal` and invoice status changes are in-app state
> only — nothing is emailed by the product. Record in the interaction note that you
> personally sent it, and when.

---

## 3. Weekly operating review (15 minutes, one person)

Fill this in every week. If a number is zero, write zero.

| Metric                                | Source                                                                    | This week    |
| ------------------------------------- | ------------------------------------------------------------------------- | ------------ |
| Prospects added                       | lead count, status `lead`                                                 | 0            |
| Conversations held                    | leads with a `call`/`email`/`meeting` interaction                         | 0            |
| Qualified opportunities               | leads, status `qualified`                                                 | 0            |
| Proposals sent                        | leads, status `proposal`                                                  | 0            |
| Accepted pilots (unpaid)              | leads, status `won`, with `getRevenueOverview().paidTotal` still USD 0.00 | 0            |
| Invoices issued                       | invoices, status `sent`                                                   | 0            |
| Payments recorded (unverified)        | `getRevenueOverview().recordedTotal`                                      | USD 0.00     |
| Payments verified                     | `getRevenueOverview().paidTotal`                                          | USD 0.00     |
| **Revenue** (verified only, as above) | `paidTotal`                                                               | **USD 0.00** |
| Pilots delivered                      | acceptance criteria all checked                                           | 0            |
| Deals lost                            | leads, status `lost`                                                      | 0            |

Nothing in this table may be filled from memory, a spreadsheet, or a Stripe/WhatsApp
message. If it is not in the product with the required evidence, it is zero.

---

## 4. Deal record (copy one per prospect)

```text
CONTACT
  Company:            [ ]           Contact: [ ]        Role: [ ]
  Channel:            [email | DM | referral | inbound]
  Source:             [how you found them / who referred them]
  Lawful basis:       [existing relationship | inbound enquiry | public business contact]

QUALIFICATION  (ACQUISITION-WORKFLOW §1)
  Hard criteria met:  [ ] all seven
  Soft score:         [0–10]        Band: [qualified | conversation only | disqualified]
  Disqualifier noted: [none | verbatim quote asking for …]

CONVERSATION
  Discovery call date:        [YYYY-MM-DD]
  Their quantified pain:      "[their words, their number]"
  Their words about the demo: "[their reaction]"
  Outcome of call:            [proposal | follow-up date | no]

PIPELINE
  Proposal sent:      [YYYY-MM-DD, manual]   Version: [v1 / v2]
  Follow-ups sent:    [0–2, max two]
  Decision:           [accepted | no | not now — revisit YYYY-MM-DD | lost]
  Acceptance quote:   "[their written acceptance]"

DELIVERY
  Deposit invoice:    [number] USD [500]     Status: [draft | sent | paid]
  Deposit payment:    [payment id] ref [……] Status: [recorded | verified]
  Session 1:          [date] [completed / slipped]
  Session 2:          [date] [completed / deferred — reason]
  Session 3:          [date] [completed / slipped]
  Acceptance criteria: [7 of 7 | N of 7 — which missed and why]
  Balance invoice:    [number] USD [1000]    Status: [draft | sent | paid]
  Delivered:          [yes / no — basis]

CLOSE-OUT
  Support ends:       [YYYY-MM-DD]
  Data disposition:   [client data deleted / returned / retained, agreed in writing]
  What broke:         [recorded honestly, not polished]
```

---

## 5. What may be said publicly

| Claim                            | Allowed once                                                                | Never                                                      |
| -------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| "We ran a pilot with one client" | A pilot is delivered **and** the client consented in writing to being named | Before consent, or with a client who asked not to be named |
| "It saved them $X"               | The client stated the number themselves, in writing                         | Derived, estimated, or rounded-up numbers                  |
| "We have N clients"              | N verified client records with delivered work                               | Leads, conversations or pilot prospects counted as clients |
| "USD X in revenue"               | Sum of `verified` payments, quoted with the period                          | Recorded-but-unverified amounts folded in                  |
| A testimonial                    | Explicit written permission, quote approved by the person                   | "Happy to be a reference" as substitute for approval       |

---

## 6. Known limitations of the tracking itself

1. **`reviewedBy` is self-declared.** The product records who typed it; it does not
   authenticate the person. Two humans on one operator account are indistinguishable
   in the audit trail.
2. **Evidence is a string.** There is no uploaded receipt and no processor webhook,
   so verification is only as good as the human comparator.
3. **No payment delete path.** Payment rows are append-only. Do not create sample
   payment rows inside a real client's workspace — use a throwaway workspace.
4. **Lead → client is a one-way auto-provision.** Moving a lead to `won` creates a
   client record; moving it back does not remove it. Record mistakes instead of
   trying to erase history.

# Client data handling and approval requirements

**Status:** operating procedure · **Date:** 2026-10-26 · **Owner:** founder/operator
**Companions:** [`DELIVERY-TERMS.md`](./DELIVERY-TERMS.md) · [`MISSION-005-FIRST-PAYING-CLIENT.md`](./MISSION-005-FIRST-PAYING-CLIENT.md) §8

> Describes what the pilot does with a client's data, based on how the product
> actually behaves in this working tree. Where the product cannot guarantee
> something, it says so. Nothing here has been reviewed by a lawyer.

---

## 1. What data the pilot touches

| Data | Where it lives | Goes to an AI provider? | Retention |
|---|---|
| Client company, industry, goals, website | Pilot workspace database | Only if AI drafting is used (brief + brand context) | Until the client record is deleted |
| Brand profile (voice, do/don't rules, keywords) | Pilot workspace database | Same as above | Until deleted |
| Article brief and article text | Pilot workspace database | **Yes, if AI drafting is used** — to the configured provider | Until the content item is deleted |
| Invoice amount, currency, due date | Pilot workspace database | No | Until the invoice is deleted |
| Payment record + reference string | Pilot workspace database | No | **Permanent — append-only** |
| Reviewer name (`reviewedBy`) | Payment row | No | Permanent |
| Client's end-customer personal data | **Not collected** | No | — |
| Card numbers, bank credentials | **Never requested or entered** | No | — |

## 2. Decisions the client makes before Session 1

- [ ] **AI drafting: yes or no.** If no, the article is written entirely by a human and no text is sent to any provider.
- [ ] **If yes, which provider.** On the operator's machine a **local model** can be used so that no text leaves the machine; a cloud provider can be selected deliberately. The provider and model are written into the session summary **before the first draft**.
- [ ] **Which client and which article** are in scope (this is the only content the pilot touches).
- [ ] **What happens to the workspace at close-out** — deleted, returned, or retained.

## 3. What is never done

- No card data, bank credentials, email/social passwords, or client-customer personal
  records are collected, stored, or requested.
- No article, invoice, or payment record is published anywhere.
- No testimonial, case study, client name, or logo is used publicly without the
  client's **explicit written permission** for that specific wording.
- No sample or demonstration payment is created inside a client's real workspace.
  Demos use a throwaway workspace (`docs/audits` reports and `scripts/pilot-sample-deliverable.ts`
  use in-memory repositories for exactly this reason).
- No data is copied to a third party beyond the AI provider the client approved.

## 4. Human approval gates

| Gate | Who approves | What they are approving | Recorded as |
|---|---|
| G1 — Scope | Client, in writing | The SOW, price, dates | Deal record + written acceptance |
| G2 — AI routing | Client | Local or cloud provider; model name | Session 1 summary |
| G3 — Article | Client | The article text, before export | Review decision in the content workflow |
| G4 — Invoice | Operator, then client | Amount, currency, due date | Invoice status `sent` |
| G5 — Payment proof | A **named human** | That the reference matches the real account | `reviewPayment` → `verified` |
| G6 — Public reference | Client, separately and specifically | The exact quote/name to be used | Written permission kept with the deal record |

A gate that has not been passed is **open**, not "probably fine". Open gates are
listed in the close-out note.

## 5. Deletion and the append-only payment trail

| Record type                                   | Delete path in the product       | Implication                                                                     |
| --------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------- |
| Client, brand, project, content item, invoice | Yes (operator actions)           | Deletable on request                                                            |
| **Payment rows**                              | **No** — append-only audit trail | A wrong or sample payment cannot be deleted; it must be explained in the record |

Because of that:

1. Never record a real or sample payment in a workspace that will later be handed
   to a client without the client knowing it is there.
2. Demos happen in a throwaway workspace that is **deleted whole**, never cleaned
   row-by-row.
3. At close-out, confirm in writing whether the workspace is deleted, exported to
   the client, or retained — and record the answer.

## 6. Honest gaps to disclose if the client asks

- `reviewedBy` is self-declared text; the product does not authenticate the reviewer.
- Evidence is a reference **string**; no receipt image or PDF is stored.
- There is no processor integration, webhook or bank feed — reconciliation is manual.
- The signing-in client uses a shared workspace environment operated by the
  operator; this is not a multi-tenant hosted service.
- Backups and restore are operator runbooks (`docs/runbooks/backup-restore-runbook.md`),
  not product features.

## 7. Client-facing summary (copy into the proposal if desired)

> Your article text and brand notes stay in the pilot workspace. If we use AI
> drafting, you choose the provider first — and a local model can keep the text on
> this machine. We never ask for bank logins, card numbers or your customers'
> personal data; a payment _reference_ is all we need to verify money. Payment
> records are permanent by design, so no demo payment is ever entered into your
> real workspace. At the end of the pilot we agree in writing what happens to the
> workspace.

# Acquisition Workflow — checklist and templates

**Status:** prepared, not executed · **Date:** 2026-10-26 · **Owner:** founder/operator
**Companions:** [`MISSION-005-FIRST-PAYING-CLIENT.md`](./MISSION-005-FIRST-PAYING-CLIENT.md) · [`OUTCOME-TRACKING.md`](./OUTCOME-TRACKING.md)

> Everything here is **manual**. There is no scraper, no auto-sender, no LinkedIn
> automation and no CRM bot. Nothing leaves this machine until the owner approves
> the exact text and the exact recipient.

---

## 0. Approval gate (non-negotiable)

Before any message is sent, the owner must be able to answer "yes" to all six:

- [ ] I have read the **final** text, not a draft.
- [ ] The recipient is a real named person/business I have a lawful basis to contact (existing relationship, inbound enquiry, public business contact, or platform-permitted outreach).
- [ ] No fact in the message is invented (no "we've helped X", no fake case study, no fake availability scarcity).
- [ ] The price stated matches the current price in the pilot package, and it is labelled as a proposal if it is stated at all.
- [ ] The message names a real human who will do the work.
- [ ] I can deliver within the stated window without a production deployment I have not tested.

If any box is unticked, the message does not go out. Record the approval — with a
timestamp, the recipient and the exact text sent — in the prospect record used by
the follow-up schedule (see §5, record-update column), alongside the `source` and
`nextFollowUp` fields created on Day 0.

---

## 1. Prospect qualification checklist

Score honestly. A prospect who fails a **hard** criterion is not a prospect, no
matter how friendly the conversation was.

### Hard criteria (all must be true)

- [ ] They bill clients for content today (freelance writer, content lead, fractional CMO, 1–5 person studio).
- [ ] They invoice at least ~3 clients in a typical month.
- [ ] They personally control the invoicing decision (or can introduce the person who does).
- [ ] They can attend three 2-hour sessions in a 3-week window.
- [ ] They are reachable through a channel where relevant outreach is acceptable.
- [ ] No procurement process longer than 3 weeks is required.
- [ ] They are not a competitor building the same product, and not asking us to white-label it as a SaaS.

### Soft signals (score 0–2 each; record the score)

| Signal | 0 | 1 | 2 |
|---|---|
| Reconciliation pain | "We're fine" | "It's annoying" | Has a specific lost/duplicated invoice story |
| AI comfort | Avoids AI | Uses chat tools | Already drafts with AI, edits manually |
| Volume | < 3 invoices/mo | 3–10 | 10+ |
| Decision speed | Unknown | Process unclear | Can say yes personally |
| Budget | No budget mentioned | "Depends" | Has paid for tools/consulting before |

- **Qualified** = all hard criteria + soft total ≥ **5**.
- **Conversation only** = hard criteria met, soft total 3–4. Keep warm; do not send a proposal.
- **Disqualify** = any hard criterion fails. Say why in the record, and thank them.

### Disqualifiers to write down verbatim

Asks for: hosted SaaS with SLA · automated publishing · payment collection ·
free pilot "to test" · content at scale on day 1 · a case-study testimonial
before any work exists.

---

## 2. Discovery-call guide (30 minutes)

Aim: leave with a decision — **proposal**, **follow-up date**, or **no**. Not "great chat".

### Before the call (5 min)

- [ ] Read their public content; note one specific piece in their own words.
- [ ] Know the pilot price and the two exclusion sentences by heart.
- [ ] Have the sample article open in a second window (not a slide deck).
- [ ] Have a blank record ready to fill during the call.

### Structure

| Time  | Section              | What you actually do                                                                                                                                                                        |
| ----- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–2   | Frame                | "This is 30 minutes: I want to understand how you handle invoices and payments, tell you what we do, and we'll both decide whether a 3-week pilot makes sense. If it doesn't, I'll say so." |
| 2–10  | Their month          | "Walk me through last month, invoice by invoice. Where does the money actually get tracked?" Listen. Do not pitch.                                                                          |
| 10–15 | The pain, quantified | "Have you ever had a payment you thought had landed but hadn't?" "What would it be worth to never guess?" **Write their number down.**                                                      |
| 15–22 | The demo (5 min max) | Show the sample article, then the ledger trace: recorded → verified. Say "the number does not move until a human checks the receipt."                                                       |
| 22–27 | Fit and price        | State the three sessions and the price as a proposal. Watch the reaction; ask "is that a yes, a no, or a not-now?"                                                                          |
| 27–30 | Next step            | Book Session 1 or agree a dated follow-up. Send the scope by email — **manually**, after approval.                                                                                          |

### Questions that earn their keep

1. "Which invoice are you least sure was paid?"
2. "Who else touches the invoice before it goes out?"
3. "If the number were wrong last month, how would you find out?"
4. "What would make you say no to this in three weeks?"
5. "Who else would need to agree before we start?"

### Never say

"Autonomous", "AI runs it for you", "hands-off", "we'll handle your publishing",
"guaranteed rankings", "we have clients who…" (unless they exist and consented),
"it's basically free".

### After the call (same day)

- [ ] Record the outcome in Client Ops as a deal record — the template is §4 of
      [`OUTCOME-TRACKING.md`](./OUTCOME-TRACKING.md), and the state ladder it uses is §1.
- [ ] Log one interaction note with their own words and their quantified pain.
- [ ] Set the next follow-up date.
- [ ] If they said yes: send scope + deposit request **after approval**.

---

## 3. Personalised outreach template

Rules: ≤ 120 words, one specific reference to their work, one clear ask, no
attachments, no links unless the recipient asked for them. Replace every
bracket. Delete this template's guidance lines before sending.

```text
Subject: [Specific thing they published] → one question about invoicing

Hi [First name],

I read [specific piece, e.g. "your post on onboarding emails for B2B SaaS"] —
[one concrete sentence showing you actually read it, e.g. "the part about
cutting step 3 is the opposite of what most people do"].

Quick question: when a client pays you, how do you confirm it landed before you
count it as income? I'm asking because I'm running a short pilot that puts the
invoice, the receipt reference and a human review in one ledger — the revenue
figure only moves after someone checks the receipt.

Three sessions over three weeks, one article and one invoice set up in your
workspace. Happy to show you the 5-minute walkthrough if that's useful.

[Your name] · [what you do in one line] · [link to ONE sample, optional]
```

**Variants**

- **Warm contact:** open with "we spoke at [event] / you replied to [thread]".
- **Referral:** "「[Referrer]」suggested I ask you about…" — only if true and permitted.
- **Inbound enquiry:** skip the hook; answer their question in the first line.

**Follow-up 1 (day 3–4):**

```text
Subject: Re: [original subject]

Hi [First name] — one thing I forgot: I can show the ledger in 5 minutes
without you preparing anything. If invoice reconciliation is already solved on
your side, just say so and I'll stop here.
```

**Follow-up 2 (day 8–10):**

```text
Subject: Re: [original subject]

Hi [First name] — closing the loop. If the timing is wrong rather than the idea,
tell me roughly when to come back and I'll put a note in my calendar. Otherwise
I'll assume it's a no and won't follow up again.
```

Two follow-ups maximum. Then stop and mark the record `lost` with a reason.

---

## 4. Proposal template (manual, personalised)

> **Superseded for the pilot** by [`PROPOSAL-AND-SOW.md`](./PROPOSAL-AND-SOW.md),
> which adds the statement-of-work clauses (scope changes, revisions, cancellation,
> data handling) that this shorter template lacks. Use this one only as a quick
> sketch; the SOW document is what a client should actually receive.

Send as plain text or a single Markdown/HTML file exported from the proposal
module. Never send the AI-generated proposal text unedited.

```text
PILOT PROPOSAL — [Client name]
Prepared for: [Name, role] · Date: [date] · Valid until: [date + 14 days]
Prepared by: [Your name] — [email] — [phone]

1. What you told me
   [Two or three sentences in their words, including their quantified pain.]

2. The outcome you're buying
   By [day 14], you will be able to answer "how much did I actually get paid
   this month?" from one place, and you will be able to prove any figure on
   that list against a receipt reference.

3. What we do (three sessions)
   Session 1 — [date, 2h]: client, brand profile, one article captured,
                reviewed and exported; first invoice raised.
   Session 2 — [date, 2h]: one real payment recorded with its reference,
                reviewed and verified; duplicate-entry protection shown live.
   Session 3 — [date, 2h]: you run the loop unaided; operating one-pager
                written together and signed off.

4. What you receive
   - One article, 600–1,200 words, edited and approved; Markdown + HTML export.
   - One invoice and one verified payment entry in your workspace.
   - A one-page operating checklist for month two.
   - Session summaries and 30 days of email support ([hours]).

5. Not included
   - Publishing or distribution anywhere.
   - Payment collection from your customers or tax advice.
   - More than one article, or monthly production.
   - A hosted account with uptime guarantees.
   - Adobe PDF or Word (.docx) files — the article is delivered as Markdown + HTML.

6. What you provide
   - [Named owner] attending all three sessions.
   - One client + brief, the real invoice details, and the real payment
     reference when it arrives.
   - Sign-in access to your workspace.

7. Price and payment — proposal, open to discussion
   Total: USD [1,500]
   - USD [500] on written acceptance (books the dates).
   - USD [1,000] when the Day-14 acceptance criteria are met.
   Note: this price is a proposal for this pilot; it is not a published rate.

8. What "accepted" means
   All of these, checked together on Day 14 — copied verbatim from
   MISSION-005-FIRST-PAYING-CLIENT.md §6 "Acceptance criteria":
   - [ ] The client's own client record and one invoice exist in their workspace, with the amount they stated.
   - [ ] One article was captured, reviewed, approved and exported — the exported file opens and reads correctly.
   - [ ] One payment row exists with a real, independently sourced evidence reference, and was promoted from recorded to verified by a named reviewer.
   - [ ] The revenue view never showed an unreviewed payment as received revenue (demonstrated live).
   - [ ] A duplicate submission with the same idempotency key produced one ledger row (demonstrated live).
   - [ ] The client completed the Month-2 loop unaided, within 30 minutes.
   - [ ] The operating one-pager was reviewed and accepted by the client in writing.

9. What could go wrong (and what we'll do)
   - A session slips → dates move; price does not.
   - The article needs a rewrite → one additional revision round included.
   - No real payment has arrived by Day 7 → Session 2 runs with a clearly
     labelled sample; the "real payment" item stays open and the balance is
     not due until it closes.

10. To accept
    Reply "accepted" to this email and I'll send the deposit invoice and the
    three calendar holds.
```

---

## 5. Follow-up schedule

| When | Action | Channel | Record update |
|---|---|
| Day 0 | Outreach sent | Email/DM | lead created, `source`, `nextFollowUp` set |
| Day 3–4 | Follow-up 1 | Same thread | interaction `email` |
| Day 8–10 | Follow-up 2 (final) | Same thread | interaction `email` |
| Day 14 | Mark `lost` with reason, or keep if they asked to be revisited | — | status + notes |
| Discovery call | Within 24h: scope + proposal | Email | interaction `call` + `proposal`, status `proposal` |
| Proposal day 3 | "Any questions on §7?" | Email | interaction |
| Proposal day 7 | Decision ask: yes / no / not-now | Email or call | interaction |
| Proposal day 14 | Expires; re-qualify before re-sending | Email | status `lost` or re-`qualified` |
| Acceptance | Deposit request + calendar holds within 24h | Email | status `negotiation`; `won` once written acceptance is quoted (an accepted pilot is **not** revenue) — ladder in `OUTCOME-TRACKING.md` §1 |
| Session −1 day | Reminder + pre-read (sample article) | Email | task |
| Each session | Summary within 24h | Email | interaction |
| Day 14 | Acceptance review + balance decision | Call | task, notes |
| Day 21 | Ask for a reference **only if** the client volunteers satisfaction | Email | notes |

Follow-up is capped: two unanswered follow-ups, then stop. No re-sending the
same text from a different address.

**Channel honesty:** every row above is a _manual_ action outside the product.
`sendProposal` and invoice status changes are in-app state only — nothing is
emailed. After sending anything by hand, log the interaction row so the record
and reality match.

---

## 6. Pilot delivery checklist

Copy this into the record for each engagement.

**Before Day 0**

- [ ] Written scope accepted; deposit request approved and sent.
- [ ] Deposit received and **recorded with its real reference** in Client Ops.
- [ ] Deposit **reviewed/verified** by a named reviewer (only then is it revenue).
- [ ] Calendar holds accepted by the client.
- [ ] Instance readiness checks in MISSION-005-FIRST-PAYING-CLIENT.md §9 (operator readiness) all pass.
- [ ] AI provider decision recorded (local or cloud; which model).
- [ ] Throwaway workspace prepared for any sample/demo data.

**Session 1**

- [ ] Client + brand profile created from intake.
- [ ] Project created.
- [ ] Article captured (human-authored or AI-drafted + edited).
- [ ] Review pass recorded; approved.
- [ ] Markdown + HTML exported; files sent.
- [ ] First invoice created (`sent`) with the client's real amount and due date.
- [ ] Summary sent within 24h.

**Session 2**

- [ ] Real payment reference obtained (or deferral agreed in writing).
- [ ] Payment recorded with evidence; status `recorded`.
- [ ] Revenue view shows the amount as **unverified**, not received — screenshot/recorded.
- [ ] Identical retry with same idempotency key → one row shown live.
- [ ] Evidence reviewed by a named human → `verified`.
- [ ] Invoice settles only when verified total covers it.
- [ ] Summary sent within 24h.

**Session 3**

- [ ] Client performs client+invoice unaided.
- [ ] Client performs payment+review unaided (throwaway data).
- [ ] Operating one-pager completed and accepted in writing.
- [ ] Acceptance criteria reviewed line by line; misses recorded as misses.
- [ ] Next-step decision recorded (retainer / not now / no).

**Close-out**

- [ ] Balance invoiced only after all acceptance criteria are met.
- [ ] Support window end date recorded.
- [ ] What broke recorded in the audit trail (not polished away).
- [ ] Any client-provided data deleted or returned as agreed.

---

## 7. Payment and acceptance checklist

Use this for **every** money event. The rule is simple: **recorded ≠ received.**

### Accepting the pilot

- [ ] Acceptance is in writing (email reply is enough; quote it in the record).
- [ ] Dates held before the deposit is requested.
- [ ] Invoice created for the deposit with a real amount, currency and due date.
- [ ] Sent to the client **manually** by the operator.

### Receiving money (outside the product)

- [ ] Money is visible in a real account (bank/processor) — not a verbal claim.
- [ ] The transfer reference / transaction id is captured **exactly** as shown.
- [ ] Do not accept a screenshot as the sole evidence for a large amount without matching it to the account.

### Recording it

- [ ] `addPayment` called with the invoice id, exact amount, currency, method, the real reference as `evidence.kind = processor_reference`, and a stable `idempotencyKey` (e.g. `<processor>-<txn-id>`).
- [ ] Response status is `recorded`.
- [ ] Revenue view still shows **0 received** for that amount. Confirm; this is correct.
- [ ] Re-submitting the same key returns the same payment id (one row).

### Verifying it

- [ ] A **named human** has compared the reference against the source account.
- [ ] `reviewPayment` called with that person's identity.
- [ ] Status becomes `verified`; revenue view's paid total includes it.
- [ ] Invoice status flips to `paid` **only** if verified total covers the amount.
- [ ] Any discrepancy (partial, wrong currency, duplicate) is written into the record rather than adjusted by hand in the database.

### Reporting

- [ ] Only **verified** amounts are quoted as revenue.
- [ ] Unverified amounts are quoted separately as "recorded, awaiting verification".
- [ ] Accepted-but-unpaid pilots are called "accepted, unpaid" — never revenue.
- [ ] No testimonial or case study is published without the client's explicit written permission.

### Anomalies — stop and record

| Symptom                       | Meaning                             | Correct response                                                                 |
| ----------------------------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| `IDEMPOTENCY_CONFLICT`        | Same key, different money/details   | Do not retry blindly; find the real payment                                      |
| Second row for one transfer   | Key was not reused                  | Recovery needs a DB action by a human; do not delete silently                    |
| `CURRENCY_MISMATCH`           | Payment currency ≠ invoice currency | Record in the invoice's currency or raise a new invoice                          |
| Partial payment               | Verified total < invoice amount     | Leave invoice `sent`; record the remainder as a separate payment when it arrives |
| Money claimed but not visible | Not money yet                       | Keep status `recorded`; escalate to the client in writing                        |

---

## 8. Templates that already exist in the repository

These predate this mission and remain valid starting points; the templates above
supersede them for the pilot because they match what the product can actually do.

- `docs/business/PROPOSAL_TEMPLATE.md`
- `docs/business/INVOICE_TEMPLATE.md`
- `docs/business/CONTRACT_TEMPLATE.md`
- `docs/business/SERVICE_PACKAGES.md` (package pricing — **not** the pilot price)

**Price consistency warning.** `docs/business/SERVICE_PACKAGES.md` quotes
$2,300 / $3,000 per month / $6,500 per month and `PROPOSAL_TEMPLATE.md` quotes
$4,400 for month 1. Those are **different offers** with a different scope
(ongoing content production, strategy, social posts) than the USD 1,500 three-session
pilot. Never let a prospect see both without saying which is which, and never
quote a package price as "the pilot price" or the reverse. The pilot's number
lives in `MISSION-005-FIRST-PAYING-CLIENT.md` §7 only.

**Do not send these files to a prospect.** Use
[`ONE-PAGE-OFFER.md`](./ONE-PAGE-OFFER.md) and [`PROPOSAL-AND-SOW.md`](./PROPOSAL-AND-SOW.md)
instead. The full scope-by-scope comparison, and the seven unresolved differences
(undefined article lengths, a $1,400 setup that matches nothing else, a 3-month
minimum that the month-1 quote hides), are recorded in
[`OFFER-COMPARISON.md`](./OFFER-COMPARISON.md) §2.

# Discovery script — 15 minutes, one conversation at a time

**Status:** script only · **Created:** 2026-10-26 · **Owner:** founder/operator
**Purpose:** find out whether the prospect has a real, recurring, costly problem
the pilot addresses — and whether they would pay for it. **Not** to pitch.

> **The goal of this call is information, not agreement.** A call that ends with
> "that sounds great!" and no concrete facts from them is a failed call. A call that
> ends with "no, I track this carefully" is a successful call — you saved three weeks.
>
> **Nothing on this call is a sale.** Interest is not acceptance. Nothing said here
> may be recorded as a proposal, an acceptance, or revenue.

---

## Before you dial (2 minutes)

- [ ] You have a lawful basis to talk to this person, recorded in [`PROSPECT-TRACKER.md`](./PROSPECT-TRACKER.md).
- [ ] You know which of their public pieces you read, and one specific sentence from it.
- [ ] The one-pager is open in a second window — but **you will not share it before minute 10**.
- [ ] You know the price you are testing: **USD 1,500, 500 deposit / 1,000 on acceptance** — a proposal, not a rate.
- [ ] A blank note is ready. You will write **their words**, not your summary.
- [ ] The demo sample is open: [`../sample-deliverable/sample-ledger-trace.md`](../sample-deliverable/sample-ledger-trace.md).

---

## Minute 0–1 · Frame (say it close to verbatim)

> "Thanks for the 15 minutes. I'm trying to understand how people who bill several
> clients keep track of what's actually been paid — and I'll show you a small thing
> I've built at the end. If it's not relevant to you I'll say so and we can stop
> early. Can I ask you a few questions first?"

Why this works: it tells them they are not being sold to for the first ten minutes,
and it gives them permission to end it.

---

## Minute 1–5 · Their current process

Ask, then **shut up and write**. Do not fill silences.

1. "Walk me through last month. You invoice a few clients — what actually happens
   from sending an invoice to knowing you've been paid?"
2. "Where does that live? A tool, a spreadsheet, a bank app, a message thread?"
3. "What do you open first when you want to know how much you made this month?"

**Write down:** the tools they name, the order they describe, and any word they
repeat. **Do not suggest a better process yet.**

---

## Minute 5–9 · The pain — real, recurring, costly?

4. "Has there ever been a payment you thought had landed that hadn't?" → **If yes:
   "what happened next?"** Get the story, with the amount if they offer it.
5. "How often does something like that happen — once a year, monthly?"
6. "What did it cost you? Time, a late payment, an awkward message to a client, a
   duplicate invoice?"

| Signal      | Weak                       | Real                                                         |
| ----------- | -------------------------- | ------------------------------------------------------------ |
| Story       | "Happened once, years ago" | A specific month and a specific client                       |
| Frequency   | Never / once               | "Most months", "twice this year"                             |
| Consequence | "I just emailed them"      | Lost income, an embarrassing correction, a re-issued invoice |
| Cost        | None stated                | **A number they said out loud**                              |

**If all four are weak:** stop the pain section. Say so. Offer the end of the call
politely. Do not pitch anyway — a polite no now is worth more than a pilot that
fails in month 2.

---

## Minute 9–11 · Existing alternatives and decision-making

7. "What have you tried? A spreadsheet, an accountant, a tool, a VA?"
8. "Why didn't that solve it?" (Listen for: too much upkeep, not trusted, nobody updates it.)
9. "If you wanted to change how you track payments, who else would need to agree —
   a partner, a bookkeeper, anyone?"

Write the decision-maker's name. **If they cannot decide, the pilot cannot start**
and you should say that out loud.

---

## Minute 11–14 · Demo, then the price question

**Demo (90 seconds, no slides):**

> "Here's the thing I built. I record the payment with the reference from the bank.
> Watch the revenue number — it does **not** move. Now a named person checks the
> reference against the account and marks it verified. _Now_ it moves. And if I
> submit the same payment twice, it still says one row — the ledger can't
> double-count."

Then ask the price question **before** describing the package:

10. "Three sessions, one article, one invoice and one payment set up this way —
    I'm proposing **USD 1,500**, split 500 to book the dates and 1,000 when it's
    delivered and checked. **Is that a yes, a no, or a not-now?**"

Then — and this matters more than their answer:

11. "What number were you expecting before I said that?"
12. "What would have to be true for that to be an easy yes?"

**Do not defend the price on this call.** Write down the reaction, the number they
named, and the reason. Defend it in the proposal, if there is one.

---

## Minute 14–15 · Close with a dated decision

End on one of these three. No "let me think about it" left open.

| Outcome              | Say                                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wants to proceed** | "I'll send a one-page scope by email for you to approve — nothing is booked until you reply in writing. Is `[date]` realistic for the first session?" |
| **Wants to think**   | "Fair. What's the one thing you'd want answered before deciding? I'll put it in writing by `[date]` and we'll talk on `[date]`."                      |
| **Not a fit**        | "That's genuinely useful — it means this isn't your problem. I won't keep emailing you."                                                              |

**Never** say: "I'll send you something", "let me know", "keep you posted".

---

## After the call (same day, 10 minutes)

- [ ] Record the outcome in Client Ops as a lead + interaction. Status is at most
      `qualified`; **never** `proposal` or `won` without a written exchange.
- [ ] Paste the verbatim pain quote and any price reaction into [`OBJECTION-LOG.md`](./OBJECTION-LOG.md)
      if there was one — even if it is "no objection, said yes immediately".
- [ ] Update the row in [`PROSPECT-TRACKER.md`](./PROSPECT-TRACKER.md) with the next dated action.
- [ ] If a price number was named, add it to [`PRICE-VALIDATION.md`](./PRICE-VALIDATION.md) §4.
- [ ] Do not count anything as revenue. It is not.

---

## The six things you must never do on this call

1. Claim AI writes the article. It does not — a human writes it; AI can draft only if verified and approved.
2. Claim the product collects or reconciles payments. It records what a human verifies.
3. Offer PDF or Word files. Only Markdown and HTML are real.
4. Offer a hosted account, SLA or uptime commitment. There is none.
5. Promise savings, rankings, growth or any business outcome. None has been measured.
6. Say "we have clients who…". There are none.

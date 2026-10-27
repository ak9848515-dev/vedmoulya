# Weekly review — honest progress, one page per week

**Status:** template · **Created:** 2026-10-26 · **Owner:** founder/operator
**Uses:** the state ladder in [`../OUTCOME-TRACKING.md`](../OUTCOME-TRACKING.md) §1 and §3

> Filled in from the product and from written records — never from memory, a
> spreadsheet, or a chat thread. **If a number is zero, write zero.**
>
> The distinctions below are the whole point of this page. Each arrow is a claim
> that requires evidence:
>
> **prospect ≠ conversation ≠ qualification ≠ interest ≠ acceptance ≠ payment ≠ verified revenue ≠ delivery**

---

## Weeks so far

| Week | Dates      | Prospect slots filled | Conversations | Qualified | Proposals sent | Accepted | Verified revenue | Delivered |
| ---- | ---------- | --------------------- | ------------- | --------- | -------------- | -------- | ---------------- | --------- |
| Seed | 2026-10-26 | 0                     | 0             | 0         | 0              | 0        | USD 0.00         | 0         |
| W1   | `[ ]`      | 0                     | 0             | 0         | 0              | 0        | USD 0.00         | 0         |
| W2   | `[ ]`      | 0                     | 0             | 0         | 0              | 0        | USD 0.00         | 0         |

The seed row is the state of the repository on 2026-10-26: **nothing exists yet.**

---

## Copy this block each week

```text
WEEK:             [YYYY-Www]   (week starting [YYYY-MM-DD])
FILLED BY:        [name]
SOURCE CHECKED:   Client Ops CRM · invoices · payments · deal records · PROSPECT-TRACKER

── THE LADDER (nothing may be inferred upward) ─────────────────────────────
1  Prospects identified          : [n]    evidence: PROSPECT-TRACKER rows with name + lawful basis
2  Conversations held            : [n]    evidence: interaction `call|meeting` with their words
3  Qualified opportunities       : [n]    evidence: all 7 hard criteria + soft ≥ 5
4  Proposals sent                : [n]    evidence: written proposal + send logged
5  Accepted pilots (unpaid)      : [n]    evidence: written acceptance quoted
6  Invoices issued               : [n]    evidence: invoice status `sent`
7  Payments recorded (unverified): [n]    evidence: payment row `recorded` + real reference
8  Payments verified             : [n]    evidence: `reviewPayment` by a named human
9  Delivered                     : [n]    evidence: all 7 Day-14 criteria checked

── MONEY (quote by these names only) ──────────────────────────────────────
Revenue (verified only)      : USD [0.00]   from getRevenueOverview().paidTotal
Recorded, awaiting review    : USD [0.00]   from recordedTotal
Unverified total             : USD [0.00]   from unverifiedTotal
Accepted but unpaid          : [n]          never counted as revenue

── PRICE VALIDATION ───────────────────────────────────────────────────────
Calls where price was named  : [n]
Reactions recorded           : [n]   (see PRICE-VALIDATION §4)
Numbers they named           : [list, or "none"]
Deposits received            : [n]
Pattern emerging?            : [no pattern yet | supports 1500 | suggests lower | suggests trust barrier]

── OBJECTIONS ─────────────────────────────────────────────────────────────
Logged this week             : [n]   categories: [ ]
Most frequent category       : [ ]
Any change made as a result? : [none | describe]

── WHAT ACTUALLY HAPPENED (three sentences, no adjectives) ────────────────
[ ]
[ ]
[ ]

── WHAT I WILL DO NEXT WEEK (dated, one owner) ────────────────────────────
1. [action] — by [date]
2. [action] — by [date]
3. [action] — by [date]

── WHAT I AM TEMPTED TO CLAIM BUT CANNOT ──────────────────────────────────
[ e.g. "two people seemed interested" → interest is not acceptance ]
```

---

## The seven ways this page normally lies

| Temptation                                            | What it would hide              | Correct entry                   |
| ----------------------------------------------------- | ------------------------------- | ------------------------------- |
| Counting an uncontacted name as a prospect            | That you have not started       | Prospect, `identified` only     |
| Counting a reply as a qualification                   | That they may not fit           | Conversation                    |
| Counting "sounds great" as acceptance                 | That nothing is agreed          | Interest — not a rung           |
| Marking `won` before payment                          | That no money exists            | Accepted pilot (unpaid)         |
| Quoting `recordedTotal` as revenue                    | That nobody verified the money  | Recorded, awaiting verification |
| Calling an invoiced pilot "delivered"                 | That the criteria are unchecked | Invoiced, not delivered         |
| Reporting a price as "validated" after one compliment | That no one paid                | Untested                        |

---

## Monthly check (once per month, 5 minutes)

- [ ] Every rung above has evidence recorded where `OUTCOME-TRACKING.md` §2 says it lives.
- [ ] No row in [`PROSPECT-TRACKER.md`](./PROSPECT-TRACKER.md) is older than 14 days without a next action — close or mark `lost`.
- [ ] Every objection in [`OBJECTION-LOG.md`](./OBJECTION-LOG.md) has a category and an answer.
- [ ] Price decision P1/P2 (opening number, deposit split) has either been tested or is still explicitly **untested**.
- [ ] Nothing excluded was promised in any conversation (re-read your own notes).
- [ ] Zero contradictions between this page and `getRevenueOverview()`.

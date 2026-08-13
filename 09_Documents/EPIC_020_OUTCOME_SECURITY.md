# EPIC-020 — Outcome & Revenue Layer Security

**Security · 2026-08-12**

## 1. No new security boundary

The Outcome & Revenue layer introduces **no new attack surface**. Every capability it exposes reuses the existing gateway seams:

| Concern                  | Mechanism (existing)                                                            |
| ------------------------ | ------------------------------------------------------------------------------- |
| Authentication           | JWT `baseProcedure` + auth middleware                                           |
| Authorization / IDOR     | `assertUserIdMatchesSession` on every procedure; owner-scoped service reads     |
| Rate limits              | `standardProcedure` / `heavyProcedure` tiers                                    |
| Provider secrets         | never rendered in UI/logs; key names only                                       |
| GitHub tokens            | separate least-privilege OAuth (EPIC-015)                                       |
| Spending / subscriptions | `BrainPolicyEngine` approval gates — no silent spend                            |
| Untrusted repositories   | EPIC-015 security classification; BLOCKED/SUSPICIOUS never become opportunities |

## 2. New data (owner-scoped by construction)

- `brain.dailyPriorities` — reads only the session user's tasks/opportunities/events; foreign `userId` is refused at the gateway (tested).
- `Opportunity.risk` / `approvalRequirement` — derived from the existing security classification; **never invented**.
- `OutcomeEvaluation.satisfaction` — explicit user feedback; never inferred silently.

## 3. Honesty guarantees (mission §7, verified by benchmark)

- A repository is never claimed safe without evidence — `TRUSTED_WITH_REVIEW` → MEDIUM risk + review requirement; `UNKNOWN` stays UNKNOWN.
- An API is never claimed free without evidence; a model's capacity is never claimed without evidence.
- Discovery ≠ adoption — screened events surface with their security classification; nothing is installed/subscribed/executed without approval.

## 4. Verification

- IDOR tests cover every new procedure (`dailyPriorities` foreign-user refusal).
- No secrets in UI/logs (existing leak-tested startup/doctor tooling covers the estate).
- No fabricated cost/revenue/token claims — enforced by the outcome benchmark invariants (13b).

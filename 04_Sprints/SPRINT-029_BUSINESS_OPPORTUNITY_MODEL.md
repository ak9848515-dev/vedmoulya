# SPRINT-029 — Business Opportunity Model

> **Sprint:** SPRINT-029 — Proactive Intelligence & Automation Fabric
> **Date:** 2026-08-13/14
> **Status:** IMPLEMENTED + TESTED (research/score only — never executes, never commits)

---

## 1. Pipeline (PHASE 7)

```
DISCOVER → RESEARCH → SCORE → BUSINESS CASE → COST/REVENUE ESTIMATE → RISK
        → MVP PLAN → USER APPROVAL → EXECUTION
```

The proactive layer performs the **first seven steps only**. It NEVER spends money,
registers a company, creates contracts, publishes commercially, creates external
accounts or makes commitments. Execution happens only after the existing approval
authority approves — and only through the existing execution bridge.

## 2. The assessment (`domain/BusinessOpportunityAssessor.ts`)

`BusinessOpportunityAssessment`:

| Field                                | Honesty contract                                                                                                                                                      |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `score` (0..1)                       | evidence-based: capability fit (0.6) + recent related work (≤0.2) + relevant market signals (≤0.2). **0 when no evidence exists** — never a fake "great opportunity". |
| `businessCase`                       | evidence lines + cost/revenue basis notes; "No evidence yet — research before any commitment." when empty                                                             |
| `estimatedCost` / `estimatedRevenue` | present ONLY when evidence exists; otherwise UNKNOWN — never fabricated numbers                                                                                       |
| `riskLevel`                          | MEDIUM when required capabilities are missing from the owner's available set, else LOW                                                                                |
| `mvpPlan`                            | research → map capabilities → draft MVP → explicit user approval → execute via the existing bridge                                                                    |
| `authorizationRequired`              | **always true** (typed as `true`)                                                                                                                                     |
| `status`                             | RESEARCHED → APPROVED/REJECTED (approval by the existing authority)                                                                                                   |

## 3. Evidence sources (all existing)

- **Capability fit** — marketplace capability view for the owner (evidence-backed
  feasibility: what % of required capabilities the owner can already serve).
- **Related work** — the owner's Brain task history within 90 days (evidence they work
  in this area).
- **Market signals** — AI-world discovery signals with relevance ≥ 0.5 (currently an
  honest empty input by default; the interface is ready for the AI-world surface).
- **Category** — deterministic keyword classification (Content creation / SaaS / digital
  product / Consulting / services / Marketplace / commerce / Other).

## 4. Revenue categories SPRINT-029 can represent

AI automation services · AI consulting · app building · website building · YouTube ·
advertising · AI training · enterprise AI solutions · SaaS · digital products · workflow
automation — all as **candidate assessments** (research + score), never as commitments.

## 5. Gateway surface

`proactive.assessBusiness(userId, { title, description, requiredCapabilities })` —
authenticated, rate-limited, owner-checked, zod-bounded (title ≤ 200, description ≤
1000, ≤ 20 capabilities). Returns the assessment; **no execution, no spending, no
external side effects**.

## 6. Verification

- `BusinessOpportunityAssessor.test.ts` 6/6: evidence-based scoring, no-evidence → 0,
  cost/revenue UNKNOWN honesty, authorizationRequired always true, category mapping,
  MVP plan.
- `ProactiveRouter.test.ts`: `assessBusiness` returns RESEARCHED +
  `authorizationRequired: true` through the real tRPC pipeline.
- The UI (ProactivePanel) surfaces business assessments with value/cost evidence chips
  and the "Approval" posture — WHAT / WHY / VALUE / RISK / COST / ACTION.

## 7. Honest limitations

- Market-signal inputs default to empty (the AI-world bridge input is not yet wired in
  the gateway capability port) — scores therefore lean on capability fit + related work
  today. Wiring live market signals = FUTURE (SPRINT-030+).
- Revenue/cost figures remain UNKNOWN by design until real evidence exists — no
  fabricated business cases.

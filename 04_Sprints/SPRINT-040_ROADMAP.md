# SPRINT-040 — Founder Evidence Loop + Local Runtime Verification

**Status:** 🟢 COMPLETE (2026-08-16) — **NEW ENGINES CREATED: 0**
**Type:** VERIFICATION + DEFECT-FIX SPRINT (no new engines, no architecture redesign)

---

## Objective

Build and verify the **first end-to-end operational path** over the existing frozen
VedMoulya estate — without creating an engine, redesigning the architecture, or
fabricating users, customers, observations, revenue, market data, payments or evidence:

1. Local Docker runtime
2. Identity registration/login
3. Founder observation entry
4. Provenance validation
5. Evidence persistence
6. Opportunity/evidence scoring
7. Customer-discovery preparation
8. Next-best-action recommendation
9. Verified-payment progression
10. Founder decision boundary

The founder remains the ultimate authority.

---

## Plan

| Phase                    | Scope                                                                                              | Outcome                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 1 — Baseline audit       | Repo state, SPRINT-038/039 docs, evidence loop, identity, Docker config                            | Baseline report (no duplicate functionality) |
| 2 — Local runtime        | Docker estate (postgres/redis/network), web↔Postgres, identity DB config                           | Runtime reachable + honest gaps              |
| 3 — Authentication       | `POST /api/v1/identity/auth/sign-up` + sign-in/session/sign-out via the existing Identity Service  | Registration + session lifecycle verified    |
| 4 — Founder observation  | SPRINT-039 `world.observationRecord` with LOCAL TEST data                                          | Provenance mandatory; honest states          |
| 5 — Evidence loop        | observation → evidence quality → scoring → calibration                                             | Explainable, bounded, honest                 |
| 6 — Customer discovery   | SPRINT-039 `world.prospectRegister` / `prospectAdvance` (LOCAL TEST)                               | Bounded lifecycle; discovery ≠ validation    |
| 7 — Revenue validation   | verified_payment → REVENUE_VERIFIED → REPEAT_REVENUE → REPEATABLE_BUSINESS                         | Payment-only revenue ladder verified         |
| 8 — Next best action     | Deterministic recommendations incl. STOP                                                           | No automatic execution/spending/contact      |
| 9 — Command Center       | Radar + SPRINT-039 drill-downs; honest empty datasets                                              | Presentation-only; VOICE ≠ AUTHORIZATION     |
| 10 — Testing             | world-model/identity/api/web suites, typecheck, scoped lint, next build, benchmarks, coverage gate | No regressions; gates not weakened           |
| 11 — Docker verification | `docker ps`, localhost:3000 + /login, auth against local DB                                        | Containers + pages + auth verified           |
| 12 — Documentation       | 8 deliverables + canonical docs sync                                                               | Audit trail complete                         |

---

## Strict architectural rules (observed)

- **NEW ENGINES CREATED: 0** — no OpportunityEngine / RevenueEngine / MarketEngine /
  StartupEngine / BusinessEngine / SuperBrain / AgentFactory or equivalent.
- Composition only: Brain, World Model, Intelligence Fabric, CostLedger, Founder
  Evidence Loop, Identity, Persistence, Approval Authority, Command Center.
- The system observes, reasons, recommends and records. **The founder decides.**
- All local test data explicitly marked **LOCAL TEST** / **LOCAL TEST DATA** — never
  promoted into real founder evidence.

---

## Execution summary

- **Defects found:** 3 genuine local-runtime defects + 1 dev-environment artifact
  (see `SPRINT-040_BASELINE_AUDIT.md` §Defects).
- **Fixes applied (minimal):** identity `users`-table bootstrap (`ensureTable()`,
  estate convention), `IDENTITY_DATABASE_URL` in `.env.local`, dev/test-only
  auto-verify on sign-up (production safeguards unchanged), `.next` cache clear.
- **Verification result:** every phase green — auth lifecycle, evidence loop,
  revenue ladder, Command Center, Docker runtime, full test suite, benchmarks.

---

## Deliverables

`04_Sprints/SPRINT-040_{ROADMAP,BASELINE_AUDIT,RUNTIME_VERIFICATION,AUTH_VERIFICATION,EVIDENCE_LOOP_TEST,DOCKER_VERIFICATION,TEST_REPORT,COMPLETION_REPORT}.md`
(8) + canonical docs sync (CHANGELOG, MASTER_ROADMAP, 04_Sprints/README,
PROJECT_STATUS, CURRENT_ARCHITECTURE_STATE, task_progress, README).

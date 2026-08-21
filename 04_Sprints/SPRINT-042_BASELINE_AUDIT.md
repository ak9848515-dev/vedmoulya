# SPRINT-042 — BASELINE AUDIT

**Status:** Baseline established (pre-implementation)
**NEW ENGINES CREATED: 0**
**Date:** 2026-08-16

---

## 1. What already existed (verified, not assumed)

### Gateway procedures (services/api/src/routers/WorldRouter.ts + RouterRegistry)

| Procedure                 | Input (zod)                                                                                                           | Purpose                                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `world.problemRegister`   | userId, problemStatement, optional fields, `evidence[]` (source/observedAt/reference/text/**confidence**), provenance | Register a problem with evidence (evidence REQUIRED — no fabricated problems)                                        |
| `world.problemList`       | userId                                                                                                                | Owner-scoped problem list                                                                                            |
| `world.observationRecord` | userId, problemId, sourceType/sourceReference/observedStatement, **provenance (source + observedAt REQUIRED)**        | Record a founder observation (provenance REQUIRED)                                                                   |
| `world.prospectRegister`  | userId, problemId, prospectReference, customerSegment, problemDiscussed, **provenance**                               | Register a prospect (CONTACTED default)                                                                              |
| `world.prospectAdvance`   | userId, problemId, prospectReference, `to`, verifiedPaymentText?                                                      | Bounded state-machine transition; `VERIFIED_PAYMENT` REQUIRES real payment evidence text (PAYMENT_EVIDENCE_REQUIRED) |
| `world.prospectsList`     | userId, problemId?                                                                                                    | Owner-scoped prospect list                                                                                           |

### Auth/authorization (verified)

- All `world.*` procedures use `standardProcedure` → `createAuthMiddleware`:
  JWT required (`isAuthenticated`) + **central IDOR guard** (`assertUserIdMatchesSession`
  reads raw input and rejects a `userId` that does not match the session).
- Rate tiers: standard 100 req/min per user (in-memory fixed window, honest
  `distributed:false`). Verified live: exceeding the window returns 429 with a
  clear message; the UI surfaces it as an honest error.

### Read models (verified)

- `world.commandCenter` (TODAY/PORTFOLIO/INTELLIGENCE/AUTOMATION/APPROVALS)
- `world.opportunityRadar` (stage counts, WHAT/WHY/EVIDENCE/SCORES/LEVEL/
  REVENUE-STATE/NEXT-ACTION/STOP — presentation-only)
- `world.opportunityDrilldownView` (evidence/prospects/next-action drill-down)

### UI mounting (verified)

- Command Center lives inside the AI Companion drawer (`AppShell` header
  toggle → drawer → "Founder command center" → INTELLIGENCE tab).
- The INTELLIGENCE tab renders the Opportunity Radar with per-item expandable
  drill-downs. **No mutation surface existed.**

## 2. What was missing (the gap this sprint closes)

- No web UI to register a problem / observation / prospect / advance / payment.
- Entry required direct gateway API calls (curl/Postman) — not founder-usable.

## 3. Boundary conditions confirmed pre-implementation

- Provenance is mandatory in `observationRecord` and `prospectRegister`
  (PROVENANCE_REQUIRED / refused otherwise).
- Evidence `confidence` enum is `VERIFIED | ESTIMATED | UNKNOWN` — the UI must
  never self-claim VERIFIED (backend downgrades).
- `VERIFIED_PAYMENT` transition requires real payment-evidence text
  (SPRINT-041 D1 fix — never fabricated).
- The bounded prospect chain (display-only in UI; backend authoritative):
  CONTACTED → CONVERSATION → PROBLEM_CONFIRMED → SOLUTION_INTEREST →
  WTP_SIGNAL → PAYMENT_REQUESTED → VERIFIED_PAYMENT (+ LOST at most states).
- Empty datasets must render honest EMPTY state — no demo seeding.

## 4. Design decision (documented)

The gateway does NOT expose "valid transitions" as a first-class procedure, so
the UI derives display-only transition controls from the known bounded chain
(`PROSPECT_NEXT` constant, mirroring the domain). **The backend remains the
authority**: an illegal jump is rejected with `INVALID_TRANSITION` regardless
of what the UI offers, and backend rejection messages are surfaced verbatim.

## 5. Baseline test/build state (pre-implementation, from SPRINT-041B)

- web **276/276** · identity **295/295** · api **1010/1010** · domain PASS
- typecheck **0** · lint **0 errors · 0 warnings**
- `next build` **PASS** (58/58 pages)

# SPRINT-042 — TEST REPORT

**NEW ENGINES CREATED: 0**
**Date:** 2026-08-16

---

## 1. Unit / component tests

### apps/web — `EvidenceEntryPanel.test.tsx` (15 tests)

Entry point, honest empty state, problem registration (evidence REQUIRED),
observation (provenance REQUIRED, no VERIFIED self-claim, valid call shape),
prospect creation (provenance, discoveryStatus not sendable), advance
(only valid next states, payment evidence REQUIRED, real payment evidence
call shape), **+2 live-defect regressions**:

- `refreshes BOTH the problem selector and the prospect list after a save`
  (D1 — fails against pre-fix code)
- `does not refetch the problem list in a loop while the drawer stays open`
  (D2 — fails against pre-fix code)

### apps/web — `CommandCenter.test.tsx` (updated)

Add Evidence entry point renders inside the INTELLIGENCE tab; existing
Command Center tests remain green.

## 2. Full suites

| Suite             | Result                       |
| ----------------- | ---------------------------- |
| apps/web          | **292/292 PASS**             |
| packages/domain   | PASS                         |
| services/identity | 295/295 (untouched, green)   |
| services/api      | 1010/1010 (untouched, green) |

## 3. Typecheck

`tsc -b` + `tsc --noEmit -p services/api` → **0 errors**

## 4. Lint

Scoped eslint on the two touched components → **0 errors · 0 warnings**

## 5. Build

`next build` (dev stopped, `.next` cleared first per the SPRINT-040 rule)
→ **PASS — Compiled successfully in 47s, 58/58 static pages**

## 6. Real-Chrome verification (Playwright, fresh LOCAL TEST accounts)

| #   | Scenario                                                                          | Result |
| --- | --------------------------------------------------------------------------------- | ------ |
| S6  | honest EMPTY state + Add Evidence entry point                                     | PASS   |
| S2  | observation without provenance → rejected, no record                              | PASS   |
| S1  | observation with provenance → recorded                                            | PASS   |
| S3a | prospect created (CONTACTED default)                                              | PASS   |
| S3b | valid transition CONTACTED → CONVERSATION                                         | PASS   |
| S4  | illegal jump CONVERSATION → VERIFIED_PAYMENT → backend rejects INVALID_TRANSITION | PASS   |
| S5a | valid chain advanced to PAYMENT_REQUESTED                                         | PASS   |
| S5b | payment-evidence field only for VERIFIED_PAYMENT                                  | PASS   |
| S5c | verified payment without evidence refused                                         | PASS   |
| S5d | verified payment recorded with real LOCAL TEST evidence                           | PASS   |
| S7  | radar shows the problem after evidence entry                                      | PASS   |
| S8  | records persist after reload                                                      | PASS   |
| S9  | cross-user mutation rejected (403 FORBIDDEN)                                      | PASS   |

**Final: 19–20/20 PASS, 0 fail** (check count varies by whether the fresh
account needed first-login profile setup in a given run; all scenario checks
pass consistently).

## 7. Honest notes

- Verification used only clearly-marked LOCAL TEST data; no fabricated
  customers, payments, or revenue.
- Rate limiting was observed working correctly (429 on burst) and the fix to
  the UI refetch loop (D2) removed the UI-induced burst; the limiter itself
  was never weakened.

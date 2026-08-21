# SPRINT-040 — Evidence Loop Test (Phases 4–8)

**Result:** 🟢 VERIFIED — the complete founder evidence loop was exercised live
through the gateway (`world.*`, authenticated) with **LOCAL TEST** data only.
Every honesty boundary held. The SPRINT-039 implementation needed **zero code
changes** — it was exercised as-built.

All payloads are explicitly marked `LOCAL TEST` / `LOCAL TEST DATA` and tied to a
fictional scenario (`local-test-run-<ts>` references). None of it is real market
evidence and it can never be promoted into real founder evidence.

---

## Phase 4 — Founder observation (provenance MANDATORY)

| Step                                                                  | Result                                                                                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `world.problemRegister` with evidence (LOCAL TEST)                    | ✅ problem created, `status: OBSERVED`, `revenueState: NO_EVIDENCE`, `confidence: ESTIMATED` (derived, never fabricated) |
| `world.problemRegister` without evidence                              | ✅ **refused** (zod `evidence` required)                                                                                 |
| `world.observationRecord` without `provenance`                        | ✅ **refused** (zod `provenance` required)                                                                               |
| `world.observationRecord` with provenance, `claimedState: "VERIFIED"` | ✅ accepted but **downgraded to `evidenceState: "OBSERVED"`** — VERIFIED cannot be self-claimed                          |

Evidence sanitization + honest default states are applied at the domain boundary
(sanitizer strips markup/control chars; the state is derived, never trusted from
the caller).

## Phase 5 — Evidence loop (scoring / calibration)

| Step                                      | Result                                                                                                                                                                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `world.evidenceQualityView`               | ✅ 8 dimensions returned; `overall: UNKNOWN` (insufficient evidence — honest, never fake precision)                                                                                                                                                                 |
| `world.factorCalibrate` (customerPain +1) | ✅ **`delta: 0`** — reason: _"Factor is UNKNOWN — no fabricated value; UNKNOWN never becomes zero."_ Bounded calibration refuses to move an UNKNOWN factor. Every adjustment carries its evidence trail (`evidenceRefs`); conflicts stay visible (`conflicts: []`). |

## Phase 6 — Customer discovery (bounded lifecycle)

| Step                                                                                                              | Result                                                                                               |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `world.prospectRegister` (LOCAL TEST prospect, provenance-required)                                               | ✅ `discoveryStatus: CONTACTED`                                                                      |
| Invalid jump `CONTACTED → VERIFIED_PAYMENT`                                                                       | ✅ **refused** `INVALID_TRANSITION` — _"conversation ≠ customer, interest ≠ revenue, WTP ≠ payment"_ |
| Bounded chain `CONTACTED → CONVERSATION → PROBLEM_CONFIRMED → SOLUTION_INTEREST → WTP_SIGNAL → PAYMENT_REQUESTED` | ✅ each transition accepted (no idea→business jump)                                                  |

## Phase 7 — Revenue validation (verified-payment ONLY)

| Step                                                                         | Result                                                                                        |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `prospectAdvance → VERIFIED_PAYMENT` with `verifiedPaymentText` (LOCAL TEST) | ✅ prospect `VERIFIED_PAYMENT`; problem `revenueState: REVENUE_VERIFIED` (1 verified payment) |
| 2nd verified payment (2nd LOCAL TEST prospect walked to VERIFIED_PAYMENT)    | ✅ `REPEAT_REVENUE`                                                                           |
| 3rd verified payment (3rd LOCAL TEST prospect)                               | ✅ `REPEATABLE_BUSINESS`                                                                      |

Only a `verified_payment` record reaches the revenue ladder. Interest, WTP
signals and payment requests were exercised along the chain and did **not**
advance revenue state.

## Phase 8 — Next best action (deterministic, no execution)

| Step                       | Result                                                                                                                                                                                                                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `world.nextBestActionView` | ✅ `action: TALK_TO_CUSTOMERS` with `why` (_"Evidence quality is insufficient — the cheapest experiment is more customer conversations (NO_COST)"_), `expectedLearning`, `risk: LOW`, `nextDecision` (_"If 3+ independent confirmations → VERIFY_PROBLEM; else STOP"_), `capitalMode: NO_COST`, `advisory: true` |

The recommendation is evidence-quality-gated (not score-gated) and the **STOP**
branch is explicit. No automatic execution, spending, customer contact, or
promotion to memory anywhere in the loop.

## Command Center / drill-downs (Phase 9)

| Step                             | Result                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `world.opportunityDrilldownView` | ✅ sections: problem, observations, prospects, experiments, nextBestAction, revenueState, verifiedPaymentCount, advisory |
| `world.opportunityRadar`         | ✅ entries with status/revenueState/evidenceCount/hasVerifiedPayment + `counts` (newProblems 1, validated 0, …)          |
| `world.commandCenter`            | ✅ sections: today, portfolio, intelligence, automation, approvals (presentation-only)                                   |
| Empty datasets                   | ✅ `observationsList` returned `[]` before entry (honest EMPTY, never fabricated "live")                                 |

Voice remains presentation-only (read-only `CommandCenterQuestionRouter` —
VOICE ≠ AUTHORIZATION preserved; no UI control grants authorization by
recommendation).

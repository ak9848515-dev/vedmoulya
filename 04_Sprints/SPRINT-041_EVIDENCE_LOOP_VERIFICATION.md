# SPRINT-041 — EVIDENCE LOOP LIVE VERIFICATION

**Phases 2–6** · 2026-08-16 · verified against the live gateway (`http://localhost:3000/api/trpc/world.*`, authenticated local test session, all data marked `LOCAL TEST`)

## Phase 2 — Founder observation entry (26/26 PASS live)

- ✅ Missing provenance refused at the gateway boundary (zod requires the `provenance` object — refusal, never silent acceptance).
- ✅ Problem registration REQUIRES evidence (no evidence → refusal); evidence sanitized.
- ✅ Observation with provenance recorded; retrievable via `observationsList`.
- ✅ Claimed `VERIFIED` downgraded to `OBSERVED` + `UNVERIFIED` — no self-claim.
- ✅ Default state honest (OBSERVED family), UNKNOWN stays UNKNOWN.
- ✅ No UI surface can bypass these rules — the Command Center exposes **zero** evidence-loop mutations (its only mutation is `decideBlueprintApproval`, routed through the Brain authority); entry is gateway-only where the zod + domain rules are enforced.

## Phase 3 — Customer discovery

- ✅ Prospect registration requires provenance + segment + problem discussed.
- ✅ Illegal jump `CONTACTED → VERIFIED_PAYMENT` refused (`INVALID_TRANSITION`).
- ✅ Bounded chain enforced through `PAYMENT_REQUESTED` (a jump that skipped `SOLUTION_INTEREST` was refused).
- ✅ `VERIFIED_PAYMENT` without payment evidence refused (`PAYMENT_EVIDENCE_REQUIRED`) — **no fabricated payment** (defect D1 fixed, see completion report).
- ✅ `VERIFIED_PAYMENT` with real evidence text succeeds → ladder advances (payments=1 visible in comparison).

## Phase 4 — Evidence quality + calibration (boundary conditions)

- ✅ 8 dimensions returned; overall honest `UNKNOWN` with one weak observation.
- ✅ Empty-evidence provenance is `UNKNOWN` — never `HIGH` with zero records (defect D2 fixed).
- ✅ Quality on a missing problem refused (`NOT_FOUND`).
- ✅ Calibration on an UNKNOWN factor: delta 0, no phantom adjustment, reason "UNKNOWN never becomes zero".
- ✅ Calibration on a KNOWN factor (after `problemAssess` materialized factors): delta 0.015 ≤ 0.05, adjustment record with reason/evidence state retained.
- ✅ Stale evidence (recency) stays UNKNOWN; contradiction → NEEDS_REVIEW (suite-covered); repeated identical observation upserts (idempotency, test 18); fabricated VERIFIED downgraded (suite-covered); multiple calibration events bounded (suite-covered).

## Phase 5 — Next-best-action

- ✅ Explainable: action + `why` + `expectedLearning` + `risk` + `nextDecision` + `capitalMode`; `advisory: true` — never implies execution.
- ✅ Fresh problem → `TALK_TO_CUSTOMERS` (NO_COST first).
- ✅ Verified payment + active WTP signal → `REQUEST_PAYMENT` (benchmark 07 contract preserved).
- ✅ Verified payment with NO active WTP signal → `TALK_TO_CUSTOMERS` with an honest repeatability reason — never "evidence quality is insufficient" (defect D3a fixed).
- ✅ Stale advisory STOP (from an assessment before the payment) is overridden by verified-payment evidence; founder-terminal states (REJECTED/DISMISSED) still STOP (defect D3b fixed).
- ✅ STOP remains available on insufficient/negative evidence.

## Phase 6 — Command Center

- ✅ Drill-down returns structured sections (problem/assessment/observations/prospects/experiments/nextBestAction).
- ✅ Comparison list returned with evidence-driven states; verified-payment count explicit (payments=1).
- ✅ Empty datasets display honestly (EMPTY copy, no fabricated entries).
- ✅ Evidence distinguishable from hypotheses; revenue state explicit; voice presentation-only (SPRINT-035 architecture unchanged — no voice mutation path to the evidence loop).

## Result

**26/26 live checks PASS** after defect fixes. See `SPRINT-041_TEST_REPORT.md` for suite numbers.

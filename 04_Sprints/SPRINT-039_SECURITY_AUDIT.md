# SPRINT-039 — SECURITY AUDIT

**Founder Evidence Loop security review from source** · 2026-08-15

## Threat model

The evidence loop ingests founder-entered observations and prospect records
(untrusted text), stores them owner-scoped, and feeds deterministic advisories.
It must not: leak across owners, accept injection, trust claimed evidence, or
gain any authorization/spend/execute surface.

## Controls (verified)

| Control                  | Implementation                                                                                                                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner isolation          | Observations/prospects stored owner-scoped; ids embed the owner; every `world.*` procedure behind the central IDOR guard; cross-owner reads return nothing (tested)                                                   |
| Injection / sanitization | `sanitizeEvidenceText` strips markup/scripts/control chars at the boundary; lengths bounded (statement/source/context/segment/frequency/severity/WTP strings); evidence list capped (≤10/prospect, ≤20/problem)       |
| Provenance MANDATORY     | `PROVENANCE_REQUIRED` refusal for observations and prospect records without a source — no anonymous claims                                                                                                            |
| No fake verification     | claimed `VERIFIED` downgraded to `OBSERVED`; `HYPOTHESIS` is the default for unverifiable claims; AI text can never become verified evidence                                                                          |
| No fabricated revenue    | ONLY a `verified_payment` evidence record reaches `REVENUE_VERIFIED`; WTP/interest never do (structural + tested)                                                                                                     |
| Bounded calibration      | `CALIBRATION_DELTA_MAX` 0.05 per event; UNKNOWN never becomes zero; conflicts surfaced, never resolved silently                                                                                                       |
| No new authority         | No approve/spend/execute surface on observations/prospects/evidence (structural test: `world.opportunityNextBestAction` et al. are read-only advisories; spending/execution stays on the frozen approval-gated paths) |
| No PII dumps             | Prospect ledger stores prospectReference + segments, not PII collections (NOT a CRM, tested)                                                                                                                          |
| Rate limiting / auth     | All `world.*` procedures authenticated + rate-tiered + zod-schema-validated (gateway)                                                                                                                                 |
| Voice safety             | Voice questions route through the read-only `CommandCenterQuestionRouter` — VOICE ≠ AUTHORIZATION preserved                                                                                                           |

## Regression evidence

- `FounderEvidenceLoop.test.ts` (30): provenance refusal, claimed-VERIFIED
  downgrade, owner isolation, bounded transitions, injection sanitization,
  verified-payment-only, structural no-authority guarantee.
- `EvidenceCalibrationBenchmark.test.ts`: injection-sanitized, provenance-
  required, no-fabricated-verification, owner-isolation scenarios.
- `services/api` full suite green (50 files, 1010 tests) — gateway IDOR/rate/
  zod regression intact.

## Residual

No new residual risk identified. Operator-configured live world-signal sources
remain OPERATOR-REQUIRED (unchanged); the evidence loop ships EMPTY by design —
no fabricated data to protect or leak.

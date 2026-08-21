# SPRINT-039 — EVIDENCE MODEL

**Founder observations · evidence states · normalization · quality** · 2026-08-15

## FounderObservation (Part A/B)

A bounded owner-scoped evidence record. Every observation REQUIRES:

- `sourceType` — customer_conversation · site_visit · workflow_observation ·
  secondary_research · experiment · founder_knowledge · other
- `sourceReference` — who/what it is about (e.g. "5 clinic owners")
- `observedStatement` — sanitized at the boundary (markup/scripts/control chars
  stripped, bounded length)
- `provenance` — **MANDATORY** (`{ source, reference?, observedAt }`). A record
  without provenance is deterministically refused (`PROVENANCE_REQUIRED`).

Optional structured fields keep the record evidence-oriented: context,
affectedCustomerSegment, frequency, severity, currentWorkaround,
statedWillingnessToPay (WTP EVIDENCE — never revenue), statedBudget, objection,
nextAction.

## Evidence states — deterministic normalization (Part D)

`normalizeObservationState` derives the state from WHO said it + WHAT was said:

| Trigger                                                  | State                           |
| -------------------------------------------------------- | ------------------------------- |
| "I think / I believe / maybe / I assume / I guess"       | HYPOTHESIS                      |
| "told me / said / reported / mentioned / complained"     | REPORTED_BY_CUSTOMER            |
| "I saw / I observed / I visited / during the visit"      | FOUNDER_OBSERVED                |
| "documented / record shows / invoice / the data shows"   | DOCUMENTED                      |
| "agreed to pay / will pay / would pay"                   | REPORTED_BY_CUSTOMER            |
| sourceType customer_conversation (no marker)             | REPORTED_BY_CUSTOMER            |
| sourceType site_visit / workflow_observation (no marker) | FOUNDER_OBSERVED                |
| anything else                                            | HYPOTHESIS (the honest default) |

**Claimed states are not trusted at face value:** a founder may tag an
observation, but a claimed `VERIFIED` is downgraded to `OBSERVED` — VERIFIED
requires a real cross-check. `UNKNOWN`/`CONFLICTING` are never auto-upgraded.
AI text can never become verified evidence; external signals stay untrusted.

## Evidence quality — deterministic 8 dimensions (Part F)

`evidenceQuality` returns per-dimension states + an overall:
provenance · directness · recency · independence · repetition · specificity ·
contradiction · verification. Overall: `NEEDS_REVIEW` (conflict) → `HIGH` →
`UNKNOWN` → `MODERATE` (≥3) → `LOW`. No fake precision — quality is `UNKNOWN`
until real evidence exists; stale evidence never inflates recency; contradictory
evidence yields `NEEDS_REVIEW`, never auto-resolution.

## Evidence strength

`evidenceStrength` over an observation set: 1+ VERIFIED + ≥2 total → STRONG ·
≥3 customer/founder → STRONG · 2 customer or 1 verified → MODERATE · ≥1 → WEAK ·
0 → UNKNOWN.

## Storage

Owner-scoped, bounded FIFO, stable-key idempotent (`observationId` embeds the
owner), in-memory + Postgres `world_observations` in the shared persistence
bundle. Evidence capped per record; observations bounded per owner.

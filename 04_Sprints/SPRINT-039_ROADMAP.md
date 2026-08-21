# SPRINT-039 — ROADMAP

**VedMoulya Founder Evidence Loop** · 2026-08-15

## Mission

Close the last loop between the founder's REAL observations and the system's
advisory opportunity scoring: observations with mandatory provenance become
bounded evidence records, customer-discovery conversations become an
evidence-oriented prospect ledger (discovery ≠ validation, WTP ≠ payment),
evidence calibrates the existing SPRINT-038 factors only within strict bounds,
and every advisory (evidence quality · next best action · opportunity
comparison · drill-down) is explainable and honest — UNKNOWN stays UNKNOWN and
the system CAN say STOP.

## Non-negotiable architecture rule

**NEW ENGINES CREATED: 0.** No EvidenceEngine, ObservationEngine, ProspectEngine,
CalibrationEngine, NextActionEngine or ComparisonEngine. Everything COMPOSES the
frozen estate (Brain · World Model · Intelligence Fabric · CostLedger · approval
authority · Command Center · Voice · persistence):

| Capability                    | Existing authority composed                                   |
| ----------------------------- | ------------------------------------------------------------- |
| Founder observation records   | World Model owner-scoped stores (bounded FIFO)                |
| Evidence-state normalization  | Deterministic classification — never auto-verification        |
| Evidence calibration          | EXISTING SPRINT-038 factors, bounded Δ ≤ 0.05/event           |
| Evidence quality              | Deterministic 8-dimension composite (honest UNKNOWN)          |
| Customer discovery ledger     | Bounded status chain (NOT a CRM, no PII dumps)                |
| Verified-payment-only revenue | EXISTING SPRINT-038 verified_payment path                     |
| Next best action              | Explainable advisory over existing assessments (STOP allowed) |
| Opportunity comparison        | Evidence-driven states over existing problems/prospects       |
| Drill-down                    | Presentation-only read model (existing Command Center)        |
| Voice presentation            | Read-only CommandCenterQuestionRouter (VOICE ≠ AUTHORIZATION) |
| Persistence                   | In-memory + Postgres `world_observations` / `world_prospects` |

## Sprint phases

1. **Forensic recon** — map the observation/prospect/evidence estate (SPRINT-038
   problems · OpportunityDiscovery · WorldModelService · WorldRouter ·
   CommandCenter · Voice Command Center question router).
2. **Domain + types** — `FounderEvidenceLoop` + `FounderObservation`,
   `CustomerDiscoveryRecord`, evidence-state normalization, bounded prospect
   chain, evidence quality, bounded calibration, next-best-action, comparison,
   drill-down types.
3. **Stores** — owner-scoped observations + prospects (in-memory + Postgres +
   shared persistence bundle), stable-key idempotency, bounded retention.
4. **Service** — WorldModelService observation/prospect/quality/calibration/
   next-action/comparison/drill-down methods.
5. **Gateway** — `world.*` +10 procedures (auth + rate tier + central IDOR +
   zod).
6. **Command Center** — opportunity drill-downs (evidence/prospects/experiments/
   provider economics/next action) + voice read-only presentation.
7. **Tests + benchmarks** — service + domain + security regression; 20
   evidence-calibration + 10 customer-discovery deterministic scenarios + vitest
   gates.
8. **Verification** — full suites, typechecks, lint, build, benchmarks chain,
   coverage gate, production-config-check.
9. **Documentation** — 13 deliverables + canonical sync.

## Acceptance highlights

- Provenance MANDATORY — an observation without a source is refused
- Evidence states explicit (OBSERVED/REPORTED_BY_CUSTOMER/FOUNDER_OBSERVED/
  DOCUMENTED/VERIFIED/HYPOTHESIS/UNKNOWN/CONFLICTING); a claimed VERIFIED is
  downgraded, never trusted at face value
- Calibration bounded (Δ ≤ 0.05 per event); UNKNOWN never becomes zero
- Conflicting evidence visible — NEEDS_REVIEW, never silently resolved
- Discovery ≠ validation; WTP ≠ payment; only VERIFIED_PAYMENT advances revenue
- Next best action is explainable (WHY/EVIDENCE/COST/LEARNING/RISK/NEXT
  DECISION) and CAN say STOP
- Comparison is evidence-driven — a high score alone is never STRONG_EVIDENCE
- Owner isolation + security regression pass
- evidence:benchmark 20/20 + discovery:benchmark 10/10 wired into the
  benchmarks chain + vitest gates
- NEW ENGINES CREATED: 0

## Honest status

- **EMPTY datasets** — no fabricated observations, prospects, customers or
  revenue. Real founder observation entry is ready now.
- **OPERATOR-REQUIRED** — live world-signal sources, real provider execution.
- **FUTURE** — per the completion report (next-sprint recommendations).

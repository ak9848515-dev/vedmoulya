# SPRINT-038 — ROADMAP

**VedMoulya Opportunity Discovery & Revenue Validation** · 2026-08-15

## Mission

Make VedMoulya practical rather than theoretical — a system that can take a REAL
business problem, determine from EVIDENCE whether it is worth spending the
founder's time and money to solve, design the cheapest realistic validation
experiment, measure the result, and distinguish genuine revenue evidence from
assumptions.

## Non-negotiable architecture rule

**NEW ENGINES CREATED: 0.** No OpportunityEngine, RevenueEngine, MarketEngine,
StartupEngine, BusinessEngine, SuperBrain or AgentFactory. Every capability in
this sprint COMPOSES the frozen estate:

| Capability                       | Existing authority composed                                  |
| -------------------------------- | ------------------------------------------------------------ |
| Practical problem representation | World Model domain (owner-scoped stores)                     |
| Evidence / provenance            | World Model evidence philosophy (no fabricated facts)        |
| Three advisory scores            | Deterministic weighted composites (documented weights)       |
| Problem levels 0–4               | Evidence-driven classification (explainable)                 |
| Bounded lifecycle                | State-machine transitions (no idea→business jump)            |
| Zero/low-cost experiment planner | NO_COST → LOW_COST → CAPITAL_REQUIRED (approval-gated spend) |
| Customer discovery               | PREPARATION only — never a fabricated interview result       |
| Revenue validation               | VERIFIED payment is the ONLY revenue-verification path       |
| Provider economics               | EXISTING Intelligence Fabric (existing providers preferred)  |
| Capability-gap notification      | Founder notification — NO automatic paid-provider adoption   |
| Business Candidate               | Advisory — requires verified payment + WTP evidence          |
| Opportunity Radar                | Presentation-only read model in the existing Command Center  |

## Sprint phases

1. **Forensic recon** — map the problem/opportunity/evidence estate (WorldModelService,
   OpportunityEconomics, OutcomeEvidence, BlueprintApprovalFactory, WorldRouter,
   CommandCenter, provider catalog).
2. **Domain + types** — `BusinessProblem`, `ProblemEvidence`, three scores,
   levels, lifecycle, revenue states, experiment plan, radar view.
3. **Stores** — owner-scoped problems store (in-memory + Postgres + persistence
   bundle), stable-key idempotency, bounded retention.
4. **Service** — WorldModelService problem/evidence/assessment/experiment/
   revenue/provider-economics/radar methods.
5. **Gateway** — `world.*` procedures (auth + rate tier + IDOR + zod).
6. **Command Center** — Opportunity Radar section (INTELLIGENCE tab).
7. **Tests + benchmark** — 24 service tests + 11 domain branch tests + 20
   deterministic benchmark scenarios + vitest gate.
8. **Verification** — full suites, typechecks, lint, build, benchmarks,
   coverage gate.
9. **Documentation** — 12 deliverables + canonical sync.

## Acceptance highlights

- Evidence REQUIRED (a problem without evidence is refused)
- UNKNOWN economics never become zero
- Verified payment is the only revenue-verification path
- Cheap experiment preferred over expensive
- Provider economics reuse the Intelligence Fabric
- Capability gap → founder notification, no auto adoption
- The system CAN say STOP ("do not build this")
- Owner isolation + security regression pass
- opportunity:benchmark ≥ 10 deterministic scenarios (20 shipped)
- NEW ENGINES CREATED: 0

## Honest status

- **EMPTY datasets** — the implementation ships with no fabricated customers,
  revenue or market data. Real observation entry is ready immediately after
  this sprint (operator/user-driven).
- **OPERATOR-REQUIRED** — live world-signal sources, real provider execution.
- **FUTURE** — SPRINT-039 (outcome/score calibration benchmark, voice
  presentation of the radar, drill-downs) per the completion report.

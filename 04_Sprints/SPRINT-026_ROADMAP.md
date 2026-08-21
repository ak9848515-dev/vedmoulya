# SPRINT-026 — Roadmap

> **Sprint:** SPRINT-026 — Voice Intelligence + Complete-System Architecture Audit
> **Scope:** Phase 15 (Sprint Roadmap)
> **Date:** 2026-08-13
> **Method:** minimum number of sprints to reach A (integrity), B (voice), C (automation), D (proactive), E (production readiness), F (UX excellence) — derived from the audit findings, not an arbitrary count.

---

## 0. Roadmap derivation (from findings, not preference)

| Destination               | Driven by                                                                                                     | Sprint(s)                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| A. Architecture integrity | R-1 (rate limit), R-2 (audit), S-1 (dead service), DB-2 (sql.json follow-up), Q-5/Q-6 (large files, optional) | S1                              |
| B. Voice assistant        | V-1…V-7 (STT/TTS ports, conversation store, voice safety)                                                     | S1 foundation + S2 product      |
| C. Automation             | AutomationBoundaryEngine exists; needs surfaces + A/B/C/D UI                                                  | S3                              |
| D. Proactive assistance   | dailyPriorities + scheduler + notifications exist; needs digest composition                                   | S3                              |
| E. Production readiness   | DB-3 (in-memory inventory), R-3 (session hardening), operator steps, multi-replica                            | S4                              |
| F. UX excellence          | UX-1/2 (dead/misleading), UX-3 (nav overload), one conversation shell                                         | S1 fixes + S2 shell + S4 polish |

**Total: 4 sprints to a major release.**

---

## SPRINT-027 — S1: INTEGRITY + SPEECH FOUNDATION

| Field                           | Content                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NAME**                        | ARCHITECTURE INTEGRITY + SPEECH RUNTIME FOUNDATION                                                                                                                                                                                                                                                                                                                                                |
| **OBJECTIVE**                   | Close the P1 operational gaps and lay the speech foundation voice requires — no product features                                                                                                                                                                                                                                                                                                  |
| **PROBLEM SOLVED**              | Multi-instance safety (rate-limit/audit), dead surfaces, speech runtime absence                                                                                                                                                                                                                                                                                                                   |
| **FILES/AREAS LIKELY AFFECTED** | `services/api/src/middleware/{rate-limit,audit}.ts`, `services/notifications` (delete/archive), `services/api/src/infrastructure/PersistenceStores.ts`, `services/orchestrator/src/providers/` (new Speech adapters), new `SpeechToTextPort`/`TextToSpeechPort` contracts, `packages/core` (speech registry status), `AICompanion` (fix dead Mic + label), frozen EI repos `sql.json()` follow-up |
| **EXISTING ENGINES REUSED**     | WriteThroughDocumentStore (audit store + conversation store), provider runtime registry, ProviderAdapter discipline                                                                                                                                                                                                                                                                               |
| **NEW COMPONENTS (justified)**  | `SpeechToTextPort`/`TextToSpeechPort` + one STT adapter + one TTS adapter (only genuinely new interfaces; mock + 1 real each, catalog-honest)                                                                                                                                                                                                                                                     |
| **ACCEPTANCE**                  | Redis-backed rate limiter with same tier env contract; durable audit store (owner-scoped, restart-surviving); speech adapters registered as CONFIGURED/UNSUPPORTED honestly; speech candidate selection unit-tested                                                                                                                                                                               |
| **SECURITY CRITERIA**           | No secret in speech logs; audit store holds metadata only; transcripts owner-scoped; rate limiter covers unauthenticated buckets                                                                                                                                                                                                                                                                  |
| **UX CRITERIA**                 | Dead Mic removed or enabled-with-reason; Phoenix label corrected; no new controls without behavior                                                                                                                                                                                                                                                                                                |
| **TEST CRITERIA**               | Limiter multi-instance semantics tests; audit durability + restart test; STT/TTS adapter deterministic tests; candidate-selection-with-speech tests; existing suites untouched (regression)                                                                                                                                                                                                       |
| **DoD**                         | Typecheck 0, lint 0, new tests green, full regression green, docs synced                                                                                                                                                                                                                                                                                                                          |

## SPRINT-028 — S2: VOICE ASSISTANT (PRODUCT)

| Field                           | Content                                                                                                                                                           |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NAME**                        | VOICE INTELLIGENCE — INTERACTION LAYER                                                                                                                            |
| **OBJECTIVE**                   | Voice as an interface into the Brain pipeline: push-to-talk, transcript, streaming, interruption, voice confirmation of sensitive actions                         |
| **PROBLEM SOLVED**              | "Talk to my Life OS hands-free" without weakening a single guard                                                                                                  |
| **FILES/AREAS LIKELY AFFECTED** | new `voice.*` gateway procedures, conversation store, AICompanion voice UI (Mic live), `ai.stream` reuse, Brain intent-to-task bridge, TTS response               |
| **EXISTING ENGINES REUSED**     | Brain pipeline, IntentInterpreter/ProblemUnderstandingService, ApprovalEngine/BrainPolicyEngine, BrainBudgetGuard, StepVerifier, outcome verdicts                 |
| **NEW COMPONENTS (justified)**  | conversation store (artifact), voice session/confirm procedures (thin) — **no new intelligence/approval/budget engine**                                           |
| **ACCEPTANCE**                  | Utterance→task journey; sensitive action readback + non-voice confirm; interruption/cancel; transcript persists; multilingual locale detected (catalog)           |
| **SECURITY CRITERIA**           | voice ≠ authorization (regression: "voice approve" without gesture denied); PIN/on-screen confirm recorded in decision store; transcripts never feed FACT signals |
| **UX CRITERIA**                 | one conversation shell (chat+voice+task hand-off); verdict vocabulary shared; accessibility preserved                                                             |
| **TEST CRITERIA**               | voice safety negative suite; STT/TTS roundtrip hermetic; browser journey (voice mock); existing suites regression                                                 |
| **DoD**                         | as S1 + voice benchmark wired into CI + voice safety suite green                                                                                                  |

## SPRINT-029 — S3: PROACTIVE + AUTOMATION

| Field                           | Content                                                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **NAME**                        | PROACTIVE ASSISTANT + TRUSTWORTHY AUTOMATION                                                                                                                                                     |
| **OBJECTIVE**                   | "What needs my attention" digest + user-facing automation catalogue (B/C classes first) composed from existing engines                                                                           |
| **PROBLEM SOLVED**              | Daily focus + eliminating repetitive work without an autonomous-agent engine                                                                                                                     |
| **FILES/AREAS LIKELY AFFECTED** | `brain.dailyPriorities`/`discoverIntelligence` composition service, scheduler user-cadence mapping, notification digest surface, A/B/C/D classification UI, automation run + verification wiring |
| **EXISTING ENGINES REUSED**     | OutcomePriorityEngine, OpportunityIntelligence, scheduler, NotificationGate, AutomationBoundaryEngine, Brain executor, StepVerifier                                                              |
| **NEW COMPONENTS (justified)**  | digest composer + automation-run orchestration (thin composition) — **no new engine**                                                                                                            |
| **ACCEPTANCE**                  | digest reads priorities+opportunities+events; "remind me weekday" maps to scheduler; automation runs B/C with verification + verdicts; draft-not-send default                                    |
| **SECURITY CRITERIA**           | C-class approval unchanged; A/B only reversible/verifiable; no income promises; noise gated                                                                                                      |
| **UX CRITERIA**                 | configurable cadence; pause; plain-language verdicts; classification visible per automation                                                                                                      |
| **TEST CRITERIA**               | digest composition tests; scheduler mapping tests; automation journey tests; notification dedup under cadence                                                                                    |
| **DoD**                         | as S1 + proactive/automation benchmarks wired into CI                                                                                                                                            |

## SPRINT-030 — S4: PRODUCTION READINESS + UX EXCELLENCE

| Field                           | Content                                                                                                                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NAME**                        | PRODUCTION READINESS + UX POLISH                                                                                                                                                   |
| **OBJECTIVE**                   | Close the operator-step inventory, session hardening, nav/UX overload, and GA gate                                                                                                 |
| **PROBLEM SOLVED**              | Anything left before a major release: remaining in-memory stores, session revocation, nav consolidation, marketing truth                                                           |
| **FILES/AREAS LIKELY AFFECTED** | persistence wiring for remaining stores, `auth-store` (httpOnly cookie option / rotation), `AppShell` nav groups + route consolidation, README/PROJECT_STATUS/CHANGELOG final sync |
| **EXISTING ENGINES REUSED**     | everything                                                                                                                                                                         |
| **NEW COMPONENTS (justified)**  | none unless the in-memory inventory demands one store table                                                                                                                        |
| **ACCEPTANCE**                  | operator-step inventory closed or explicitly documented as operator-configured; nav overload reduced (groups, not more links); GA smoke + deploy rehearsal                         |
| **SECURITY CRITERIA**           | R-1/R-2 verified under multi-instance rehearsal; session hardening shipped                                                                                                         |
| **UX CRITERIA**                 | one nav model; one AI shell; no dead controls; a11y gate green (make blocking)                                                                                                     |
| **TEST CRITERIA**               | full suite + all benchmarks + browser journeys + deployment rehearsal                                                                                                              |
| **DoD**                         | all gates green; production certification report; version bump                                                                                                                     |

---

## 1. Sequencing rationale

- **S1 before S2:** speech adapters + honest controls + operational fixes give voice a clean, safe base; the P1 rate-limit/audit gaps are pre-existing and must not ship into a voice sprint.
- **S2 before S3:** voice is the interaction layer; proactive/automation reuse the same conversation shell and verdict vocabulary.
- **S3 before S4:** proactive/automation add the last user-visible surfaces before production polish.
- **S4 last:** production readiness is a verification + hardening sprint, not a feature sprint.
- **No sprint invents a new engine**; every sprint reuses the frozen estate and documents what it consumed.

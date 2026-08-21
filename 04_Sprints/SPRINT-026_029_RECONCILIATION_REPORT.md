# SPRINT-026 → 029 — Reconciliation Report

> **Purpose:** one chronological truth for the four-sprint arc that took VedMoulya from
> a post-v1.0 platform to a **voice-capable, proactively intelligent** operating system.
> Every claim below was re-verified against the working tree on 2026-08-14
> (full suite 8 540 passed | 1 skipped · 671 files; typecheck 0; lint 0; coverage
> 42/42; `next build` PASS; benchmarks chain EXIT 0).
>
> Statuses used: IMPLEMENTED · TESTED · MOCKED · OPERATOR-REQUIRED · PARTIAL · FUTURE.
> Historical sprint reports are preserved unmodified as records; this document is the
> reconciliation authority where a historical claim and verified code diverge.

---

## SPRINT-026 — Voice Intelligence + Complete-System Architecture Audit (2026-08-13)

**PLANNED:** full 16-phase repository audit with every conclusion traceable to code,
tests or identified external research; architecture decisions for voice and
proactive/automation; 4-sprint roadmap; NO product features.

**IMPLEMENTED:** all 16 phases (forensic inventory, flow integrity, provider
orchestration, voice architecture + safety model, proactive/automation, UX, code
quality, DB/persistence, security, testing, market research, capability map,
architectural decision, roadmap). 10 deliverables in `04_Sprints/SPRINT-026_*`.

**TESTED:** spot-checked core suites 251/251 PASS (brain + execution-bridge +
capability-marketplace), typecheck 0. (Verified: those suites are green in the current
full run.)

**VERIFIED FINDINGS (re-checked against source):**

- R-1: in-memory rate limiting (P1) — **confirmed then**; **closed in SPRINT-027**.
- R-2: in-memory gateway audit (P1) — **confirmed then**; **closed in SPRINT-027**.
- S-1: dead `services/notifications` (P2) — **confirmed** (zero references);
  **deleted in SPRINT-027**.
- UX-1/UX-2: dead Mic control + "Powered by Phoenix AI" label — **confirmed**;
  **removed in SPRINT-027**.
- DB-2: frozen pre-022 `sql.json()` latent pattern — **already fixed repo-wide in
  practice** (verified in SPRINT-027; the frozen docs remain historical).
- Verdict: system coherent — Brain pipeline, quality-first provider selection,
  fail-closed approval/budget/verification, honest verdicts, durable owner-scoped
  persistence and zero-new-engines learning all **match the implementation**.

**DECISIONS (carried forward, verified delivered):**

- Voice = interaction layer over the existing Brain (delivered SPRINT-027/028).
- Proactive/automation = composition of existing engines only, no autonomous-agent
  engine (delivered SPRINT-029).
- Roadmap: SPRINT-027 (integrity + speech foundation) → SPRINT-028 (voice assistant) →
  SPRINT-029 (proactive + automation) → SPRINT-030 (production readiness).

## SPRINT-027 — Platform Integrity & Speech Foundation (2026-08-13)

**PLANNED:** close R-1 (rate limiting) + R-2 (audit), delete dead service, remove dead
Mic + Phoenix branding, add narrow speech seams + conversation store with
VOICE ≠ AUTHORIZATION, fix the pre-existing `next build` P1, zero new engines.

**IMPLEMENTED + TESTED (verified):**

| Claim                                                                          | Verified                                                           |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Async RateLimiter port (in-memory honest default)                              | ✅ `rate-limit.ts` + `RateLimiter.test.ts` 12/12                   |
| Redis backend, loud once-only degradation, fail-fast config errors             | ✅ tests pass (degradation logged, bounded fallback)               |
| Durable + owner-scoped `AuditLogStore`                                         | ✅ `AuditLogStore.test.ts` green                                   |
| `packages/voice`: `SpeechToTextPort`/`TextToSpeechPort` + mock adapters        | ✅ (MOCK kind; production refusal unless `VOICE_ENABLE_MOCK=true`) |
| `VoiceIntentGate` VOICE ≠ AUTHORIZATION (reuses `SENSITIVE_ACTIONS`)           | ✅ 19/19 tests                                                     |
| Owner-scoped bounded conversation store (in-memory + Postgres)                 | ✅ 8/8 + 5/5 tests                                                 |
| `SpeechApplicationService` + 8 `voice.*` procedures (auth + rate limit + IDOR) | ✅ VoiceRouter tests green                                         |
| Dead `services/notifications` deleted                                          | ✅ git shows deletions; zero refs                                  |
| Mic removed + Phoenix → VedMoulya branding                                     | ✅ only a historical comment remains                               |
| `next build` P1 fixed                                                          | ✅ `next build` PASS (re-verified)                                 |

**MOCKED:** STT/TTS mock adapters (deterministic, honest `voice.status` = MOCK).

**OPERATOR-REQUIRED:** real STT/TTS endpoints; Redis for multi-instance rate limiting;
Postgres for durable audit/conversation stores (auto-created).

**PARTIAL:** gateway branch coverage 63.18% vs 80% gate — pre-existing baseline
(62.14%), scoped to SPRINT-030. Voice UX deferred to SPRINT-028 by design.

## SPRINT-028 — VedMoulya Voice Assistant (2026-08-13)

**PLANNED:** turn the foundation into a usable voice assistant: real STT/TTS adapters,
Voice → Brain bridge, VOICE ≠ AUTHORIZATION enforced + proven, owner-scoped
conversation turns, honest `voice.status`, unified voice UX.

**IMPLEMENTED + TESTED (verified):**

| Claim                                                                                                                             | Verified                                  |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `RuntimeSpeechToTextAdapter` / `RuntimeTextToSpeechAdapter` (provider-neutral HTTP, bounded, AbortSignal, timeouts, `kind: REAL`) | ✅ 26/26 tests                            |
| `VoiceAssistantService` (ANSWER → `ai.stream` Q&A runtime; ACTION → `brain.createTask`)                                           | ✅ 25/25 tests                            |
| `voice.status` live probe (CONFIGURED only when a REAL adapter answers; UNAVAILABLE/ERROR/MOCK)                                   | ✅ in `VoiceRouter` + tests               |
| `voice.confirmSensitive` = ONLY approval path → existing Brain `approve`; no voice-only shortcut                                  | ✅ structural + behavioral tests          |
| Owner-scoped conversation turns; no promotion into facts/preferences/outcomes/learning                                            | ✅ structural tests                       |
| `VoicePanel` UX (9 states, mic, transcript, playback, cancel, retry, permission recovery, a11y, mobile)                           | ✅ 14/14 tests                            |
| Full suite 8 467 passed                                                                                                           | 1 skipped (662 files) at SPRINT-028 close | ✅ re-verified superset (8 540) |

**MOCKED:** mocks never masquerade (`voice.status` = MOCK never CONFIGURED).

**OPERATOR-REQUIRED:** real STT/TTS credentials (`VOICE_STT_*` / `VOICE_TTS_*`).

**PARTIAL/FUTURE:** streaming STT deferred; tRPC wire-level AbortSignal for
cancellation (client-side enforcement today).

## SPRINT-029 — Proactive Intelligence & Automation Fabric (2026-08-13/14)

**PLANNED:** proactive intelligence (recommendations from existing Brain/marketplace
surfaces), automation discovery (A/B/C/D reusing existing vocabularies), business
opportunity pipeline (research/score only), no-spam daily briefing, gateway
`proactive.*` (auth + rate limit + IDOR) + owner-scoped store, unified UX, full
verification, canonical docs + deliverables + reconciliation, zero new engines.

**IMPLEMENTED + TESTED (verified):**

| Claim                                                                                                                                                                                     | Verified                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `packages/proactive` — types, contracts (narrow ports), domain, application, infrastructure                                                                                               | ✅ 59/59 tests (7 files)                                                                             |
| `ProactiveIntelligenceService` composition (rides `discoverIntelligence`/`dailyPriorities`/`listOpportunities`/`listTasks`; idempotent stable keys; dismissed never resurrected; bounded) | ✅ 22/22 tests                                                                                       |
| `ActionClassPolicy` A/B/C/D (composes `SENSITIVE_ACTIONS`; no self-authorization)                                                                                                         | ✅ 7/7 tests + router refusal                                                                        |
| `AutomationDiscovery` (≥2 occurrence floor, full workflow representation, advisory boundary)                                                                                              | ✅ 7/7 tests                                                                                         |
| `BusinessOpportunityAssessor` (evidence-based score, UNKNOWN honesty, always `authorizationRequired`)                                                                                     | ✅ 6/6 tests                                                                                         |
| `DailyBriefingAssembler` (no-spam `hasContent:false`)                                                                                                                                     | ✅ 7/7 tests                                                                                         |
| Owner-scoped store (in-memory + Postgres, `PRIMARY KEY (owner, key)`)                                                                                                                     | ✅ 5/5 + 5/5 tests                                                                                   |
| Gateway `proactive.*` 6 procedures (auth + rate limit + IDOR + zod)                                                                                                                       | ✅ 9/9 router tests                                                                                  |
| `ProactivePanel` in AICompanion (WHAT/WHY/VALUE/RISK/COST/ACTION, approval posture, a11y)                                                                                                 | ✅ 5/5 tests                                                                                         |
| Full verification                                                                                                                                                                         | ✅ 8 540/1 skip (671 files) · typecheck 0 · lint 0 · coverage 42/42 · build PASS · benchmarks EXIT 0 |
| Canonical docs + 9 deliverables + reconciliation                                                                                                                                          | ✅ this sprint                                                                                       |

**MOCKED:** none (the layer is deterministic; platform mocks unchanged).

**OPERATOR-REQUIRED:** live provider/discovery execution (platform-wide posture).

**FUTURE:** background proactive cadence (`ProactiveSchedulerPort.onCadence` prepared,
driver not productized); outcome-memory evidence via a Brain port (honest empty
today); multi-provider workflow decomposition proposals; live market signals.

**PARTIAL:** outcome-memory LEARNING_OPPORTUNITY evidence (empty port → no fabricated
recommendations — honesty over volume).

---

## Cross-sprint truth table

| Capability                       | 026         | 027        | 028     | 029         | Current status                             |
| -------------------------------- | ----------- | ---------- | ------- | ----------- | ------------------------------------------ |
| Architecture audit (16 phases)   | ✅          | —          | —       | —           | IMPLEMENTED (historical record)            |
| Async rate limiting (R-1)        | 🔴 finding  | ✅         | ✅      | ✅          | IMPLEMENTED + TESTED (Redis = operator)    |
| Durable owner-scoped audit (R-2) | 🔴 finding  | ✅         | ✅      | ✅          | IMPLEMENTED + TESTED (Postgres = operator) |
| Dead service/branding hygiene    | 🔴 finding  | ✅         | —       | —           | IMPLEMENTED                                |
| Speech seams + mock adapters     | 🔴 missing  | ✅         | ✅      | ✅          | IMPLEMENTED (mocks honest)                 |
| VOICE ≠ AUTHORIZATION            | 🔴 decision | ✅         | ✅      | ✅          | IMPLEMENTED + TESTED (structural)          |
| Real STT/TTS + voice assistant   | 🔴 missing  | 🔴 missing | ✅      | ✅          | IMPLEMENTED (credentials operator)         |
| Voice UX                         | 🔴 missing  | 🔴 missing | ✅      | ✅          | IMPLEMENTED + TESTED                       |
| Proactive recommendations        | 🔴 decision | —          | —       | ✅          | IMPLEMENTED + TESTED (cadence FUTURE)      |
| Automation A/B/C/D discovery     | 🔴 decision | —          | —       | ✅          | IMPLEMENTED + TESTED (execution FUTURE)    |
| Business opportunity pipeline    | 🔴 decision | —          | —       | ✅          | IMPLEMENTED + TESTED (research only)       |
| No-spam daily briefing           | 🔴 decision | —          | —       | ✅          | IMPLEMENTED + TESTED                       |
| Gateway namespace + IDOR         | —           | voice.*    | voice.* | proactive.* | IMPLEMENTED + TESTED                       |

## Divergences recorded (historical claim vs current verified state)

1. **SPRINT-026's DB-2** ("frozen pre-022 EI repos carry latent sql.json() pattern") —
   by SPRINT-027 the pattern was **already fixed repo-wide**; the frozen docs still
   describe the old pattern (historical). Verified: no `JSON.stringify(x)::jsonb`
   double-encoding remains in active stores.
2. **SPRINT-028's "full suite 8 467"** — superseded by 8 540 (SPRINT-029 added 73
   tests); both claims were true at their time.
3. **Gateway branch coverage** — 63.18% at SPRINT-027/028 and unchanged by SPRINT-029
   (63.18%): the port-adapter gap is real, pre-existing and scoped to SPRINT-030.
4. **Proactive outcome-memory evidence** — the SPRINT-029 model includes
   LEARNING_OPPORTUNITY, but the Brain port reports empty (the Brain application
   service does not expose outcome memory directly). Recorded as PARTIAL/honest, not
   as a fabricated feature.

## Conclusion

The four-sprint arc is **coherent and verified**: every SPRINT-026 finding was either
closed (R-1, R-2, S-1, UX-1/2, DB-2-in-practice) or is a documented operator/future
step; the voice assistant is real, safe and tested; the proactive layer is a genuine
composition layer (no engine duplication, no self-authorization, evidence-only) with a
green full-suite state. **No historical report was rewritten to look more successful**
— divergences are recorded here instead.

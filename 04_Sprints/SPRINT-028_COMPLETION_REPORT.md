# SPRINT-028 — Completion Report

> **Sprint:** SPRINT-028 — VedMoulya Voice Assistant
> **Date:** 2026-08-13
> **Verdict:** 🟢 **COMPLETE — production voice-assistant experience over the existing Brain, zero new engines**

---

## 1. Executive Verdict

SPRINT-028 turned the SPRINT-027 speech foundation into a **complete, usable voice
assistant** while preserving every architectural boundary the sprint demanded: the
Brain remains the sole governing intelligence authority, voice is an **interface**, and
**VOICE ≠ AUTHORIZATION** is enforced end-to-end and proven by tests.

Delivered: **real runtime-backed STT/TTS adapters** (provider-neutral, OpenAI-compatible
HTTP, bounded payloads, AbortSignal, timeouts, normalized errors, honest `voice.status`
CONFIGURED/UNAVAILABLE/MOCK/ERROR via a live probe), a **Voice → Brain bridge**
(`voice.handleUtterance` → STT → existing intent interpretation → ANSWER intents reuse
the exact `ai.stream` Q&A runtime, ACTION intents become real `brain.createTask` tasks),
the **non-voice confirmation path** for sensitive actions (approval only through the
existing Brain approval authority), owner-scoped conversation turns with **no promotion
path** into facts/preferences/outcomes/learning, and a **unified voice UX** in the
AICompanion (full state machine, mic control, transcript, playback, cancel, retry,
permission-denied recovery, keyboard/aria accessibility, mobile-friendly).

Full suite **8 467 passed | 1 skipped (662 files)**, typecheck **0**, lint **0**,
coverage gate **41/41**, `next build` **PASS**. Honest status: real STT/TTS provider
credentials remain **OPERATOR-REQUIRED** (`voice.status` reports `MOCK`, never
`CONFIGURED`, until an operator configures a provider endpoint).

---

## 2. Baseline

- **Git:** `5bba63c` (`feat(sprint-025): continuous learning, outcome memory & adaptive improvement`) — the SPRINT-027 work was present as an uncommitted working tree.
- **Before this sprint:** `packages/voice` had ports + mock adapters + intent gate + conversation store + `SpeechApplicationService` (SPRINT-027). No real adapters, no Brain bridge, no voice UX.
- **Full suite before:** 8 242 passed (658 files) at the start of the coverage-gate work; the SPRINT-028 additions sit on top of the fully green 41/41 coverage gate.

## 3. Architecture Changes

- **`RuntimeSpeechToTextAdapter` / `RuntimeTextToSpeechAdapter`** (new) — provider-neutral
  real adapters speaking the SPRINT-027 `SpeechToTextPort` / `TextToSpeechPort` contracts.
  OpenAI-compatible HTTP endpoints (`VOICE_STT_BASE_URL`/`VOICE_STT_MODEL`/`VOICE_STT_API_KEY`,
  `VOICE_TTS_*`), bounded input/output, `AbortSignal` support, timeout handling, normalized
  errors, deterministic `kind: 'REAL'`.
- **`VoiceAssistantService`** (new) — the **only** composition seam between speech and the
  Brain: transcribe → intent classification (reuses the Brain's `IntentInterpreter` +
  `SENSITIVE_ACTIONS` via the existing `VoiceIntentGate`) → ANSWER goes to the **same AI
  Q&A runtime the text companion uses** (`ai.stream`), ACTION goes to **`brain.createTask`**
  (then plan) → TTS synthesis is additive (a TTS failure is never a task failure).
- **Gateway wiring** — `VoiceBridgePorts.ts` (Brain task port + AI answer port over the
  real services), `ApiApplicationService` resolves REAL adapters when env-configured,
  `RouterRegistry` registers the new procedures, `VoiceRouter` gains `handleUtterance`,
  `confirmSensitive`, `rejectSensitive` (all authenticated + rate-limited + owner-checked).
- **`voice.status` truth** — `SpeechApplicationService.probeSpeechStatus()` live-probes a
  configured REAL adapter: `CONFIGURED` only when the probe answers, `UNAVAILABLE` when
  configured but down, `ERROR` on probe failure, `MOCK` for mocks — **never fabricated**.
- **No new engine anywhere.** No voice engine, no agent engine, no memory/decision/
  scheduler/approval/provider-selection/execution engine. Brain, budget, approval,
  provider selection, execution bridge, verification, learning, scheduler and
  notification authorities are unchanged.

## 4. Files Changed

- `packages/voice/src/types/voice-types.ts` — status union extended (`UNAVAILABLE`/`ERROR`),
  `VoiceTurnResult` states, `BrainTaskPort` (createTask/plan/approve/reject), `VoiceAnswerPort`.
- `packages/voice/src/index.ts` — exports for the new adapters/service.
- `packages/voice/src/application/SpeechApplicationService.ts` — live probe + production
  mock refusal + status honesty.
- `packages/voice/src/application/VoiceAssistantService.ts` — **new** (voice → Brain bridge).
- `packages/voice/src/infrastructure/RuntimeSpeechToTextAdapter.ts` — **new** (real STT).
- `packages/voice/src/infrastructure/RuntimeTextToSpeechAdapter.ts` — **new** (real TTS).
- `services/api/src/infrastructure/VoiceBridgePorts.ts` — **new** (Brain + AI ports).
- `services/api/src/routers/VoiceRouter.ts` — new assistant procedures + live status.
- `services/api/src/services/ApiApplicationService.ts` — REAL adapter + assistant wiring,
  env-driven (`VOICE_STT_*` / `VOICE_TTS_*` / `VOICE_ENABLE_MOCK`).
- `services/api/src/services/RouterRegistry.ts` — 3 new procedures registered.
- `apps/web/src/components/AICompanion.tsx` — unified voice toggle + panel integration.
- `apps/web/src/components/VoicePanel.tsx` — **new** (the voice UX).
- `.env.example` — voice knobs documented.

## 5. Files Added

- `packages/voice/src/infrastructure/RuntimeSpeechToTextAdapter.ts`
- `packages/voice/src/infrastructure/RuntimeTextToSpeechAdapter.ts`
- `packages/voice/src/application/VoiceAssistantService.ts`
- `packages/voice/src/__tests__/RuntimeSpeechAdapters.test.ts`
- `packages/voice/src/__tests__/VoiceAssistantService.test.ts`
- `services/api/src/infrastructure/VoiceBridgePorts.ts`
- `services/api/src/__tests__/VoiceAssistantRouter.test.ts`
- `apps/web/src/components/VoicePanel.tsx`
- `apps/web/src/components/__tests__/VoicePanel.test.tsx`
- `04_Sprints/SPRINT-028_COMPLETION_REPORT.md`

## 6. Files Deleted

None. (SPRINT-027 already deleted `services/notifications`.)

## 7. STT Implementation

`RuntimeSpeechToTextAdapter` — implements `SpeechToTextPort.transcribe`:

- POSTs bounded audio (`MAX_AUDIO_BYTES` guard; router pre-decodes with a base64 length
  bound so oversized payloads never allocate) to `VOICE_STT_BASE_URL` `/audio/transcriptions`.
- `AbortSignal` propagated to the fetch; caller abort → normalized `CANCELLED` (never a
  provider error).
- Timeout via `AbortSignal.timeout()` composed with the caller signal.
- Provider HTTP failures mapped to normalized `PROVIDER_FAILED`; empty/oversized/
  invalid transcripts → `INVALID_INPUT`; non-HTTP/network errors → normalized `UNKNOWN`-ish
  failure codes. No raw provider error text or keys reach the UI.
- Deterministic `kind: 'REAL'`; production accepts it; `voice.status` probes it live.

## 8. TTS Implementation

`RuntimeTextToSpeechAdapter` — implements `TextToSpeechPort.synthesize`:

- POSTs bounded text (`MAX_TTS_TEXT_LENGTH`) to `VOICE_TTS_BASE_URL` `/audio/speech`,
  receives an audio buffer, returns `{ audio, format }` (base64 over the wire in the router).
- `AbortSignal` + timeout handling, normalized errors, `kind: 'REAL'`.
- **TTS failure is never a task failure**: the assistant returns the text response with
  `ttsFailed: true`; the UI shows the textual answer and explains speech failed.

## 9. Voice → Brain Flow

```
audio → voice.handleUtterance (auth + rate limit + owner check + payload bound)
  → SpeechToTextPort.transcribe
  → VoiceIntentGate (existing Brain IntentInterpreter + SENSITIVE_ACTIONS)
      ANSWER  → VoiceAnswerPort.ask → the SAME ai.stream Q&A runtime as the text companion
      ACTION  → BrainTaskPort.createTask (real brain.createTask) → plan when possible
      SENSITIVE → state WAITING_FOR_APPROVAL — nothing executes
  → assistant reply text (+ TTS audio when configured and available)
  → user + assistant turns persisted owner-scoped in the conversation store
```

The voice layer **translates modality only** (audio → normalized user request). The Brain
owns all intelligence: understand, plan, approve, execute, verify, learn. No voice-specific
decision logic exists.

## 10. Authorization Safety (VOICE ≠ AUTHORIZATION)

- A transcript can express intent; it can **never** grant approval. `VoiceIntentGate` and
  `VoiceAssistantService` contain **no** voice-only approval shortcut (structural test
  asserts no `approve`/`grantApproval`/`authorizeFromTranscript` method exists).
- Sensitive actions (`delete`, `send`, `publish`, … via the existing `SENSITIVE_ACTIONS`)
  route to `WAITING_FOR_APPROVAL`. The ONLY approval path is `voice.confirmSensitive`,
  which requires an explicit **non-voice** on-screen button click and then calls the
  **existing Brain `approve`** authority (decision recorded by the Brain's decision store).
  `rejectSensitive` mirrors it — nothing executes.
- "yes" / "do it" / "go ahead" in a transcript never authorize anything (tested).

## 11. Conversation Persistence

- Every voice turn (user + assistant) is persisted owner-scoped in the SPRINT-027
  conversation store (in-memory + Postgres), bounded (`MAX_TURNS_PER_CONVERSATION`,
  oldest-evicted), per-owner isolated.
- **No promotion path** exists: conversation content is an interaction artifact and cannot
  become a user fact, preference, outcome, Digital Twin belief or learning signal
  (structural + behavioral tests). Only existing explicit pathways promote information.
- Conversation is required for `confirmSensitive`/`rejectSensitive` (a missing
  conversation is refused — owner isolation + no dangling approval).

## 12. Provider Integration

- Real adapters are **provider-neutral** (env-configured endpoints, OpenAI-compatible
  audio APIs) — no vendor hard-coded into the architecture; the SPRINT-027 port contracts
  are preserved untouched.
- Credentials live **server-side only** (`VOICE_STT_API_KEY` / `VOICE_TTS_API_KEY`); no
  keys reach the browser.
- Mock adapters stay deterministic and **never masquerade**: refused in production unless
  `VOICE_ENABLE_MOCK=true` (mirrors `AI_ENABLE_MOCK`); `voice.status` reports `MOCK`
  (never `CONFIGURED`) for mocks, `CONFIGURED` only when a REAL adapter passes a live
  probe, `UNAVAILABLE` when configured but down, `ERROR` on probe failure.

## 13. UI/UX

- **One coherent interaction model**: a single "Talk to VedMoulya" toggle in the
  AICompanion opens one `VoicePanel` — no competing mic widgets, no separate chat system,
  no Phoenix remnants. Uses the existing design tokens (slate/violet palette, existing
  icon set, `focus-visible` rings).
- Full state machine: `IDLE / LISTENING / TRANSCRIBING / THINKING / WAITING_FOR_APPROVAL /
RESPONDING / SPEAKING / ERROR / CANCELLED`, each visibly communicated (status line,
  live region announcements, recording seconds, spinner, mic color/icon, speaking state).
- Controls: mic button (large touch-friendly target, `aria-pressed`), recording indicator,
  cancel, transcript preview, response text, stop-audio, retry, dismiss; error states
  explain and recover.
- Response text **always stands**; TTS is additive with a visible "(I could not speak
  this aloud…)" fallback.
- CANCELLED is a transient ack; cancellation is client-side abort-aware and returns to
  IDLE without leaving dangling streams (unmount cleanup stops tracks, clears timers,
  aborts in-flight controllers, revokes object URLs).

## 14. Accessibility

- Keyboard: the mic/confirm/reject/cancel/retry controls are real `<button>`s with
  `aria-label`s and visible `focus-visible` rings; Enter/Space work natively.
- Screen readers: `aria-live="polite"` status region announces every state transition;
  sensitive-confirmation text and error messages are announced; mic state is `aria-pressed`.
- Microphone permission denial shows a useful explanation + recovery (retry / type
  instead) and never crashes.
- Voice is **not** the only way to operate the feature — the chat input remains.

## 15. Security

- All new procedures: authenticated (`standardProcedure`), rate-limited, owner-checked
  (gateway guard rejects cross-user `userId` — IDOR tested through the real tRPC pipeline).
- Payload validation: base64 pre-decode length bound + decoded size bound + empty check;
  bounded text for TTS; bounded recording duration client-side.
- No client-side secrets; provider credentials server-side only; no raw provider errors
  or sensitive transcripts logged.
- Sensitive actions require the existing non-voice approval; no transcript-based
  authorization; audit events continue to flow through the SPRINT-027 durable audit store.

## 16. Performance

- Recording capped client-side (`MAX_RECORDING_MS`); oversized/empty recordings rejected
  before upload; server-side payload bounds; TTS text length bound.
- Timeouts on STT/TTS; AbortSignal everywhere; duplicate playback prevented (existing
  audio paused before new playback); object URLs revoked on end/error; unmount cleanup
  prevents dangling streams/timers/recorders; bounded conversation retention.

## 17. Test Results

| Suite                  | Count                                    |
| ---------------------- | ---------------------------------------- |
| Full repository        | **8 467 passed / 1 skipped · 662 files** |
| Gateway (services/api) | **898 passed / 1 skipped · 43 files**    |
| Web (apps/web)         | **181/181 · 17 files**                   |
| Voice (packages/voice) | **107/107 · 6 files**                    |

New test coverage includes: STT success/failure/timeout/cancellation/oversized/invalid;
TTS success/failure/timeout/cancellation/oversized; voice→Brain (ANSWER→AI Q&A, ACTION→
createTask, sensitive→approval required); transcript cannot authorize; confirm/reject via
existing authority only; owner scoping + IDOR through the real router; conversation turns
persisted/bounded/no promotion; provider status honesty (MOCK never CONFIGURED, live probe
CONFIGURED/UNAVAILABLE/ERROR, production mock refusal); UI states, permission denied,
cancellation, retry, error, accessibility. **No existing test was weakened.**

## 18. Typecheck

- `npx tsc -b` (all workspaces): **exit 0**
- `npx tsc --noEmit -p services/api`: **exit 0**
- `packages/voice` `tsc --noEmit`: **exit 0**

## 19. Lint

- `npx eslint packages/voice/src services/api/src apps/web/src`: **0 errors** (web warnings
  were cleaned to 0; test files are excluded from lint by config).

## 20. Build

- `npx next build` (web): **PASS** — compiled successfully, 56/56 static pages.
- Coverage gate: **41/41 workspaces PASS** (≥80% branch; aggregate written to
  `coverage/coverage-final.json`).

## 21. Architecture Audit

1. **Duplicate engine?** No — zero new engines; voice composes ports + Brain.
2. **Voice bypass Brain?** No — ANSWER→AI runtime, ACTION→`brain.createTask`; no
   voice-specific decision logic.
3. **New authorization authority?** No — approval is the existing Brain `approve`, only
   reachable via the non-voice `confirmSensitive` button.
4. **New memory authority?** No — conversation store is interaction artifacts only.
5. **New provider-selection authority?** No — adapters are env-configured ports; Brain
   provider selection untouched.
6. **New execution authority?** No — execution stays in the Brain pipeline.
7. **Stores owner-scoped?** Yes — conversation store owner-scoped (tested); gateway
   owner-checks every procedure.
8. **Sensitive actions approval-protected?** Yes — VOICE ≠ AUTHORIZATION enforced + tested.
9. **Provider credentials secure?** Yes — server-side env only, never in client code.
10. **Status truthful?** Yes — live probe; MOCK never CONFIGURED; tested.
11. **Existing design system?** Yes — same tokens/components/icons as AICompanion.
12. **Dead components?** None added; the only removed control (dead Mic) was SPRINT-027.
13. **Dead routes?** None — all new procedures are registered + tested.
14. **Unused dependencies?** None — voice adapters use Node built-ins + fetch only.
15. **Performance regressions?** None — bounded payloads, timeouts, cleanup verified.
16. **Security regressions?** None — auth/rate-limit/owner/payload/credential invariants
    all tested.
17. **Existing tests preserved?** Yes — full suite green, nothing weakened.
18. **Production build green?** Yes — `next build` PASS.

## 22. Duplicate-Engine Audit

Explicitly **no** new: VoiceEngine, AI Agent Engine, Memory Engine, Decision Engine,
Scheduler, Approval Engine, Provider Selection Engine, Execution Engine, intent/security/
authorization logic. All reused: Brain `IntentInterpreter`, `SENSITIVE_ACTIONS`,
`brain.createTask`/`plan`/`approve`/`reject`, the `ai.stream` Q&A runtime, the SPRINT-027
speech ports + intent gate + conversation store, the gateway auth/rate-limit/owner guards.

## 23. Known Limitations

- Real STT/TTS require operator-configured provider endpoints (`VOICE_STT_*`/`VOICE_TTS_*`);
  without them `voice.status` reports `MOCK` (or `UNAVAILABLE`/`ERROR` for a configured-but-
  down REAL adapter) — never a fabricated `CONFIGURED`.
- tRPC mutations don't expose a wire-level AbortSignal, so cancellation is enforced
  client-side (the server-side turn completes; a cancelled client never sees it — safe).
- Speech is synchronous request/response (no live streaming STT in this sprint).
- The one skipped test is the honest env-gated Postgres restart-recovery suite (Docker
  degraded on this machine; verified 4/4 earlier against live PostgreSQL).

## 24. Operator Requirements

| Requirement                                     | Env / Config                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------- |
| Real STT provider (OpenAI-compatible audio API) | `VOICE_STT_BASE_URL`, `VOICE_STT_MODEL`, `VOICE_STT_API_KEY`              |
| Real TTS provider (OpenAI-compatible audio API) | `VOICE_TTS_BASE_URL`, `VOICE_TTS_MODEL`, `VOICE_TTS_API_KEY`              |
| Mock speech in a non-production-like env        | `VOICE_ENABLE_MOCK=true` (mirrors `AI_ENABLE_MOCK`)                       |
| Postgres conversation store                     | auto-created by the store on first use (same pattern as the other stores) |

## 25. Future Work

- **SPRINT-029 — proactive intelligence & automation** (composition of existing engines
  only; clean interfaces prepared, full product deferred by design).
- Streaming STT/TTS (transcription while speaking).
- Wire voice turns into deeper Brain workflows (task continuation, follow-ups on an
  existing task) — still through the same `brain.*` authorities.
- Operator-friendly provider registration UI for speech capabilities.

## 26. Acceptance-Gate Results

| Gate                                        | Result                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| Real STT adapter implemented                | ✅ `RuntimeSpeechToTextAdapter`                                         |
| Real TTS adapter implemented                | ✅ `RuntimeTextToSpeechAdapter`                                         |
| Provider abstraction preserved              | ✅ SPRINT-027 ports untouched                                           |
| Voice → Brain bridge implemented            | ✅ `VoiceAssistantService` (ANSWER→AI runtime, ACTION→createTask)       |
| Conversation turns persisted                | ✅ owner-scoped, bounded, Postgres path                                 |
| Sensitive actions require existing approval | ✅ `confirmSensitive` → Brain `approve`                                 |
| VOICE ≠ AUTHORIZATION proven by tests       | ✅ structural + behavioral                                              |
| Owner scoping proven                        | ✅                                                                      |
| IDOR tests pass                             | ✅ through the real tRPC pipeline                                       |
| Rate limiting enforced                      | ✅ standardProcedure + rate tiers                                       |
| No client-side secrets                      | ✅                                                                      |
| Voice UX complete                           | ✅ full state machine + controls                                        |
| Mobile responsive                           | ✅ large touch targets, responsive layout                               |
| Accessibility reviewed                      | ✅ keyboard, aria, live region, permission recovery                     |
| Failure states implemented                  | ✅ STT/TTS/Brain/network/permission, honest fallbacks                   |
| Cancellation implemented                    | ✅ client-side abort-aware + cleanup                                    |
| No false-success responses                  | ✅ honest verdicts preserved (UNKNOWN ≠ SUCCESS)                        |
| Existing Brain pipeline preserved           | ✅                                                                      |
| No duplicate engines                        | ✅                                                                      |
| No Phoenix branding                         | ✅                                                                      |
| Full test suite green                       | ✅ 8 467 passed / 1 skipped                                             |
| Typecheck green                             | ✅ 0                                                                    |
| Lint green                                  | ✅ 0                                                                    |
| Production build green                      | ✅ `next build` PASS                                                    |
| Security review green                       | ✅ §15 + §21                                                            |
| Documentation synchronized                  | ✅ README / PROJECT_STATUS / MASTER_ROADMAP / CHANGELOG / task_progress |
| Git working tree reviewed                   | ✅ no secrets/scratch files committed                                   |

---

## Sprint-rule compliance check

| Rule                                                                                                      | Status                                                 |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Brain remains the sole governing intelligence authority                                                   | ✅ unchanged                                           |
| No VoiceEngine / agent / memory / decision / scheduler / approval / provider-selection / execution engine | ✅ (structural + behavioral tests)                     |
| Voice is an interface, not an authorization mechanism                                                     | ✅ (VOICE ≠ AUTHORIZATION, proven)                     |
| Voice ultimately becomes an existing Brain task/request                                                   | ✅ (createTask / ai.stream Q&A)                        |
| No transcript-based authorization                                                                         | ✅                                                     |
| Conversation ≠ memory fact / preference / verified outcome                                                | ✅ (no promotion path)                                 |
| UNKNOWN stays UNKNOWN; FAILED never becomes SUCCESS                                                       | ✅ (honest verdicts + no-false-success wording)        |
| TTS failure never a task failure                                                                          | ✅ (text response stands; `ttsFailed` surfaced)        |
| No client-side secrets                                                                                    | ✅                                                     |
| No fabricated live-provider claims                                                                        | ✅ (`voice.status` live-probed, MOCK never CONFIGURED) |
| No duplicate engines / no new authority                                                                   | ✅                                                     |
| Composition over invention                                                                                | ✅                                                     |

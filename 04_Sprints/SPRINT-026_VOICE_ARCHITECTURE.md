# SPRINT-026 — Voice Architecture

> **Sprint:** SPRINT-026 — Voice Intelligence + Complete-System Architecture Audit
> **Scope:** Phase 3 (Voice Assistant Architecture) + Phase 4 (Voice Safety Model)
> **Date:** 2026-08-13
> **Verdict:** 🟢 **The estate already supports voice as an interaction layer. The only missing foundation is a speech runtime (STT/TTS adapters) + a conversation store. No new intelligence engine is required.**

---

## 1. WHAT SHOULD EXIST / WHAT ALREADY EXISTS / WHAT CAN BE REUSED / WHAT IS MISSING

### 1.1 What already exists (verified)

| Needed for voice                             | Exists today                                                                                                                          | Evidence                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Conversational streaming (text)              | `ai.stream` gateway procedure + `AICompanion` drawer (streams through the real runtime, stage labels, provider/model chip)            | `services/api/src/routers/AIRouter.ts`; `apps/web/src/components/AICompanion.tsx`                  |
| Task pipeline (the actual "assistant brain") | `brain.createTask → plan → selectResources → approve → execute → verify → evaluateOutcome → recordLearning`                           | `packages/brain/src/application/BrainApplicationService.ts`                                        |
| Intent understanding                         | `IntentInterpreter` (deterministic, UNKNOWN-safe) + `ProblemUnderstandingService` (`goals.understandProblem`) + LLM via `ai.complete` | `brain/src/domain/IntentInterpreter.ts`; `goals/src/application/`                                  |
| Conversation-appropriate Q&A                 | `ai.complete`/`ai.stream` with EI-003 context optimization                                                                            | `AIRouter.ts`                                                                                      |
| Context assembly                             | `BrainContextPort` (knowledge context) + `context-fabric` permission-gated retrieval                                                  | `brain-ports.ts`, `packages/context-fabric`                                                        |
| Memory for continuity                        | `BrainOutcomeMemory`, `PreferenceLedger`, `MemoryIntelligence` — owner-scoped                                                         | SPRINT-025 verified                                                                                |
| Voice capabilities in the catalog            | `TEXT_TO_SPEECH`, `SPEECH_TO_TEXT` are first-class `CapabilityId`s with keyword detection (`CapabilityGraph`) and role defaults       | `capability-marketplace/src/domain/CapabilityGraph.ts`; `brain/src/domain/ProviderRoleAssigner.ts` |
| Voice intent in the Brain pipeline           | TTS/STT steps decompose through `CapabilityDecomposer`                                                                                | `capability-marketplace/src/domain/CapabilityDecomposer.ts:84`                                     |
| Transcription security posture               | content is user data; no secrets ever stored; owner-scoped stores                                                                     | persistence security doc                                                                           |
| Push-to-talk UI hook                         | `Mic` icon exists in AICompanion — **but dead** (`onClick={() => {}}`)                                                                | `AICompanion.tsx:314`                                                                              |

### 1.2 What is genuinely MISSING (the complete list)

| #   | Missing piece                                                                                                                                        | Nature                                                                                           | Sprint          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------- |
| V-1 | **Speech runtime adapters** — STT + TTS. Catalog capabilities map to runtime `speech`, but NO production provider declares it (only `MockProvider`). | New narrow adapter seam (same discipline as `ProviderAdapter`)                                   | S1 (foundation) |
| V-2 | **SpeechToTextPort / TextToSpeechPort** interfaces                                                                                                   | New contracts                                                                                    | S1              |
| V-3 | **Conversation store** (per-user transcripts + turns, owner-scoped)                                                                                  | Interaction artifact persisted via `WriteThroughDocumentStore` pattern — **NOT a memory engine** | S1              |
| V-4 | **Voice command surface** — push-to-talk, streaming ASR, interruption/cancellation, transcript UI, voice-confirmation of sensitive actions           | Frontend + gateway procedures                                                                    | S2              |
| V-5 | **Voice → task bridge** — utterance → `brain.createTask` (typed input reuse; no new NLP)                                                             | Thin composition                                                                                 | S2              |
| V-6 | **TTS response surface** — spoken answer/plan/approval-readback                                                                                      | Reuses V-1                                                                                       | S2              |
| V-7 | **Multilingual support**                                                                                                                             | STT/TTS model choice (provider capability); catalog-level only today                             | S3              |

### 1.3 Reuse map (the anti-duplication contract)

| Voice need               | Reuses (never re-creates)                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| "Understand what I said" | `IntentInterpreter` + `ProblemUnderstandingService` + LLM (`ai.complete`)                                                                |
| "Do this task"           | `brain.createTask` full pipeline (plan/select/approve/execute/verify/learn)                                                              |
| "What's my status?"      | `brain.dailyPriorities` + `getStatus` + dashboard data via existing routers                                                              |
| "Remind me daily"        | `ai-world-scheduler` (schedules/jobs/cooldowns) via a small voice→scheduler mapping                                                      |
| "Tell me if X happens"   | ecosystem `NotificationGate` (relevance-gated) + `discoverIntelligence`                                                                  |
| "Send this email"        | capability plan + `ApprovalEngine`/`BrainPolicyEngine` — voice only _reads_ the plan and _captures_ confirmation; execution is unchanged |
| Conversation memory      | `BrainOutcomeMemory`/`PreferenceLedger`/`context-fabric` — transcripts are a store, not memory                                           |
| Budget/cost              | `BrainBudgetGuard` — voice tasks carry the same budgets                                                                                  |
| Provider choice          | `ProviderRoleAssigner` (quality-first) — STT/TTS are capabilities in the same graph                                                      |

---

## 2. Target Flow (with the existing pipeline inserted)

```
USER SPEECH
  → [S1] STT port (streaming ASR; push-to-talk on web, tap-to-talk on native)
  → [S1] Conversation store (append turn; owner-scoped)
  → [S2] Utterance handling — THREE INTENTS, ONE PIPELINE:

      a) QUESTION/ANSWER   → ai.stream (existing runtime) → TTS port → SPEECH
      b) ACTION/OUTCOME    → brain.createTask(input)      → existing pipeline
                             (plan → select → approve* → execute → verify → learn)
                             → status/plan → TTS port → SPEECH
      c) PROACTIVE QUERY   → brain.dailyPriorities / discoverIntelligence digest
                             → TTS port → SPEECH

  * APPROVAL for sensitive/irreversible actions is NEVER voice-authorised by default:
    the plan is read aloud, and confirmation requires an explicit, non-voice,
    replayable confirmation (on-screen tap or PIN) recorded in the decision store.
```

### 2.1 Streaming / interruption / cancellation

- **Streaming:** `ai.stream` already streams text; the TTS layer streams audio segments (V-1 adapter contract must support chunked synthesis).
- **Interruption/cancellation:** the conversation store + a per-user active-run handle (existing `cancel` on brain tasks + AbortController on `ai.stream`). Barge-in = cancel TTS + stop streaming; the run state machine is untouched.
- **Push-to-talk:** web `MediaRecorder` → chunked upload → STT port; native Capacitor plugin. This is the safest first step (no ambient listening).
- **Continuous conversation:** multiple turns in one session = the conversation store + context assembly; the Brain pipeline is invoked per action-intent.

### 2.2 Voice confirmation of sensitive actions

Follows **Phase 4** exactly:

```
UNDERSTAND → PLAN → READ PLAN ALOUD → REQUIRE APPROVAL (non-voice confirm + PIN/on-screen)
→ EXECUTE → VERIFY → REPORT (read verdict aloud)
```

Invariants (must be regression-tested):

1. `approvalRequired` is set by the same `BrainPolicyEngine` — voice cannot add or remove an approval.
2. A voice utterance NEVER satisfies `approvalGranted` unless the session is bound to an authenticated, confirmed user and an explicit confirm gesture is recorded (on-screen tap / PIN) with the decision record.
3. "Auto-confirm" is OFF by default and, when enabled, is limited to a user-defined allowlist of actions and requires re-confirmation after session changes.
4. Voice never carries budget-exemption power; `BrainBudgetGuard` applies unchanged.

---

## 3. Provider / model guidance for speech

- **STT candidates (2026):** streaming ASR providers with <300ms latency (e.g. Deepgram-class), Whisper-class local, or a Vercel-AI-SDK-compatible transcription path. All behind `SpeechToTextPort`.
- **TTS candidates:** neural TTS (ElevenLabs-class quality, or OpenAI/DeepSeek-compatible audio where offered), fallback to platform TTS (Web Speech API `speechSynthesis`) for zero-cost operation.
- **Selection:** STT/TTS become capabilities in the existing candidate graph — `ProviderRoleAssigner` picks quality-first with cost tiering, and the existing preference/experience signals apply. **No new selection engine.**
- **Multilingual:** capability-aware model choice; the transcript stores the detected locale; UI stays English-first (documented operator config for model lists).
- **Accessibility:** voice input/output are supplementary to the existing keyboard-driven UI; transcripts are always visible and selectable; TTS is never the only output for critical status (verdicts are shown in plain language per SPRINT-024).

---

## 4. Safety model (Phase 4) — voice must never become a security bypass

| Threat                                                  | Control (existing)                                                                                               | Control (voice-specific)                                                                                             |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| "Send this email" executes silently                     | `BrainPolicyEngine.checkAction` fail-closed on SENSITIVE_ACTIONS; `ApprovalEngine` gate; `ApprovalRuntime` pause | Voice readback of the plan + non-voice confirm; never voice-authorised by default                                    |
| Voice spoofing / replay                                 | Authenticated session (JWT) for every procedure                                                                  | Confirmation gesture bound to the live session; short voice windows; no ambient always-on in v1                      |
| Voice prompt-injection ("ignore previous instructions") | Existing prompt-injection handling in Evidence-First runtime; retrieved docs treated as untrusted                | Transcripts are user input, not system instructions; the system prompt is server-side, never voice-mutable           |
| Voice commands to other users' data                     | Owner-scoping at engine + `PRIMARY KEY (owner, key)` + gateway IDOR guard                                        | Voice session is bound to the authenticated userId; commands carry the same userId                                   |
| Voice-induced budget bypass                             | `BrainBudgetGuard` pre/during checks                                                                             | Voice tasks get identical budgets; estimates read aloud before execution                                             |
| Voice-authorised purchases                              | `purchase` in SENSITIVE_ACTIONS; approval journey tested (0 executions before approval)                          | Purchase confirmation requires PIN/on-screen confirm; readback includes amount (evidence)                            |
| Transcript privacy                                      | stores never hold secrets; owner-scoped                                                                          | Transcript store is user data; TTL/retention config; excluded from learning signals (no FACT from transcripts alone) |
| TTS of sensitive data                                   | —                                                                                                                | Redaction pass before synthesis (secrets/keys never synthesized); the same redaction used by logs                    |

---

## 5. Interface sketches (target, S2)

```
// New narrow ports (frozen-adapter discipline — business engines never import SDKs)
interface SpeechToTextPort {
  transcribe(audio: { format: string; data: ArrayBuffer }): Promise<{ text: string; locale?: string; confidence?: number }>;
  readonly capabilities: CapabilityId[]; // includes 'SPEECH_TO_TEXT'
}
interface TextToSpeechPort {
  synthesize(text: string, opts?: { voice?: string; stream?: boolean }): Promise<{ audio: string; format: string }> | AsyncIterable<{ audio: string }>;
  readonly capabilities: CapabilityId[]; // includes 'TEXT_TO_SPEECH'
}

// Gateway additions (thin, all behind auth + rate tiers + IDOR)
voice.startSession / voice.appendTurn / voice.cancelTurn / voice.confirmSensitive
```

The `SpeechToTextPort`/`TextToSpeechPort` are registered in the provider runtime registry
(`CONFIGURED / AVAILABLE / UNSUPPORTED_RUNTIME`), exactly like text providers — honest
availability, no fabrication.

---

## 6. Verdict

- **Reuse is overwhelming:** the Brain pipeline, intent interpreters, verification,
  approval, budget, memory, scheduler, notifications and provider selection all exist
  and are voice-ready. Voice is an **interface**, not an engine.
- **The only foundational gap is a speech runtime** (V-1/V-2) plus the conversation
  store (V-3) — both small, additive, and consistent with the frozen `ProviderAdapter`
  and `WriteThroughDocumentStore` patterns.
- **Implementation is a later sprint** (S1/S2 in the ROADMAP doc). This sprint ships
  the design + safety contract only, per Phase 16 of the mandate.

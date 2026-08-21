# SPRINT-035 — VOICE COMMAND CENTER

**Voice can PRESENT the Command Center. Voice can NEVER authorize.**
**Date:** 2026-08-15 · **No new voice engine — extension of the existing Voice Assistant**

## What was added

1. **`CommandCenterQuestionRouter`** (`packages/voice/src/domain/CommandCenterQuestionRouter.ts`)
   — deterministic phrase matching for presentation questions:
   - "What should I focus on today?" → `FOCUS_TODAY`
   - "What opportunities did VedMoulya find?" → `OPPORTUNITIES`
   - "What needs my approval?" → `PENDING_APPROVALS`
   - "Which business has the best verified margin?" → `BEST_MARGIN`
   - "What changed today?" → `WHAT_CHANGED`
   - "How much did this workflow cost?" → `WORKFLOW_COST`

2. **`CommandCenterPresentationPort`** (`packages/voice/src/types/voice-types.ts`) — a
   read-only port with NO side effects. Implemented in the gateway over the EXISTING
   world read models (`createCommandCenterPresentationPort` in `WorldBridgePorts.ts`).

3. **`VoiceAssistantService` wiring** — when the router matches a presentation question
   AND the presentation port is configured, the assistant answers with the port's text.
   Otherwise it falls back to the existing AI Q&A runtime (never a fake answer).

## VOICE ≠ AUTHORIZATION — preserved and proven

- The presentation port has **no side effects** — it cannot authorize, approve, spend or
  execute. It reads `founderBriefing`, `opportunityPipeline`, `listBlueprintApprovals`,
  `revenueRanking` and `commandCenter` and returns TEXT ONLY.
- The existing Brain approval path remains the **only** authority (`voice.confirmSensitive`
  → `brain.approve`). No voice-only shortcut exists — structural test asserts none does.
- A presentation question containing a sensitive action still routes through the
  intent gate; **the assistant blocks, never acts** ("keeps VOICE ≠ AUTHORIZATION: a
  sensitive action in a question still blocks").

## Honest answers (no fabricated "live")

- `FOCUS_TODAY` — no-spam: "Nothing urgent needs attention today" when the briefing has no content.
- `OPPORTUNITIES` — advisory scores, "never a promise"; empty pipeline answered honestly.
- `PENDING_APPROVALS` — lists waiting actions; **"voice cannot approve"** is stated.
- `BEST_MARGIN` — "no verified margin evidence yet — unknown margin is never treated as zero".
- `WHAT_CHANGED` — "Nothing significant changed today" when nothing changed.
- `WORKFLOW_COST` — measured cost only; per-workflow attribution refused ("I will not estimate it").

## Verification

- `CommandCenterQuestionRouter.test.ts` — 4 deterministic routing tests.
- `VoiceAssistantService.test.ts` — 29 tests including the VOICE ≠ AUTHORIZATION boundary
  and presentation questions (now 33 total voice tests incl. presentation).
- `WorldBridgePorts.test.ts` — 8 presentation answers + honest-empty cases + world-not-ready.
- Voice suite: **115 tests, 7 files — all passing.**

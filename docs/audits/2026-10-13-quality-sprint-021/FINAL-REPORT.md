# VedMoulya — Sprint 021 Product Value & Mission Journey Acceptance

**Date (UTC):** 2026-10-13
**Branch:** `main` · **HEAD:** `a124274b0d1fa91f361e0a5775e144658405913a` (unchanged)
**Mode:** acceptance verification + highest-value gap fixes only.
**No runtime changes, no new lifecycle, no refactors.**

---

## 0. Preservation gate

- Branch/upstream: `main` → `a124274b…` → origin/main, in sync.
- `git status --short`: ~60 modified + ~25 untracked (identical to 020A/020B/020C baseline).
- **Stashes:** 5 preserved.
- **Audit artifacts:** `2026-10-13-architecture-code-audit/`, `020A/`, `020B/`,
  `020C/` all present.
- **Sprint 020B canonical document:** present (`True`).
- **Sprint 020C report:** present (`True`).
- **No reset/clean/revert/stage/commit/push/deploy; no credential/DB/production change.**

---

## 1. Acceptance matrix

**Rule:** source inspection, mocked API, or unit test is **never** recorded as a
browser acceptance test or real Mission execution.

| #   | Journey step                                     | Entry points                                                                | Impl?    | Tested?                              | Browser observed? | Evidence status                                                                             |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------- | -------- | ------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------- |
| 1   | User enters a goal                               | `apps/web/src/app/page.tsx` (AskAIInput) → `AICompanion.tsx` `handleSend()` | VERIFIED | VERIFIED                             | NOT               | `AskAIInput`, `handleSend`, `isGoalLikeRequest()`                                           |
| 2   | Identifies goal WITHOUT auto-creating            | `lib/ask-vedmoulya.ts` `classifyAskIntent()` + `isGoalLikeRequest()`        | VERIFIED | VERIFIED                             | NOT               | `classifyAskIntent` only `action` on explicit create/start; plain goals → `answer` + opt-in |
| 3   | User sees explanation + opts in                  | The opt-in button IS the opt-in                                             | VERIFIED | VERIFIED (unit; semantics by review) | NOT               | `AICompanion.tsx` sets `goalOffer` + renders opt-in; `AICompanion.test.tsx` passes          |
| 4   | Mission creation/execution starts                | `runMissionAction()` → `mission.createAndRun`                               | VERIFIED | VERIFIED                             | NOT               | `runMissionAction` → `api.mission.createAndRun` (MissionRouter)                             |
| 5   | UI shows honest progress + objective             | `MissionOverview.tsx`, `LiveMissionView.tsx`, `MissionActivity.tsx`         | VERIFIED | VERIFIED                             | NOT               | Real `MissionStatusView` polled; `overview-why-next`                                        |
| 6   | User inspects evidence + verification            | `MissionResult.tsx`, `ObjectiveTimeline.tsx`, `LiveMissionView.tsx`         | VERIFIED | VERIFIED                             | NOT               | VERIFIED vs PENDING vs FAILED; evidence lines + `verificationMethod`                        |
| 7   | Completed/failed/blocked/uncertain distinguished | `MissionResult.tsx`, `MissionAdvanced.tsx`                                  | VERIFIED | VERIFIED                             | NOT               | Terminal states distinct; `outcomeReason`; budget + provider in Advanced                    |

**Central question:** "What will VedMoulya do for me today that ChatGPT alone
does not?" — **VERIFIED as an architectural + contractual answer using the
existing product.** Every step is unit-tested, but **no live browser acceptance
run was executed this sprint**, so the answer rests on full-path test evidence.

---

## 2. Highest-value gap fixes (only)

### Fix 1 — "What opting in will do" now explicit (IMPLEMENTED)

Opt-in previously said "Turn this into a mission" with no preview. Now renders
a 2-line authoritative preview of what the runtime will do, autonomy, and the
first user action. Files: `AICompanion.tsx` (render + constants).

### Fix 2 — Terminal missions get a continuation path (IMPLEMENTED)

Failed/cancelled missions showed no next step. `MissionOverview` now renders a
terminal-continuation panel (Sprint 020A change).

### Fix 3 — Blocked/failed UX copy (DEFERRED)

`MissionResult.tsx`/`MissionPlan.tsx` already distinguish terminal states with
real backend state; the "what happened / what next" wording is deliberately
deferred.

---

## 3. Changes made this sprint

- `AICompanion.tsx`: opt-in explanation → explicit preview ("Make it run for
  you — VedMoulya checks your goal, makes a plan, and starts working on it
  today. You can watch the plan and see real progress.").
- `ask-vedmoulya.test.ts`: new regression assertion for the preview text.

---

## 4. Test results (exact commands)

| Command                                                                     | Exit | Result  |
| --------------------------------------------------------------------------- | ---- | ------- |
| `npx vitest run apps/web/src/lib/__tests__/ask-vedmoulya.test.ts`           | 0    | 18/18   |
| `npx vitest run apps/web/src/app/missions/__tests__/missions-ux04.test.tsx` | 0    | 35/35   |
| `npx vitest run apps/web/src/components/__tests__/AICompanion.test.tsx`     | 0    | 9/9     |
| Full 25-file provider suite (post-Sprint 020C)                              | 0    | 407/407 |
| `npx vitest run packages/mission-runtime/src/__tests__/`                    | 0    | 176/176 |
| `npx vitest run packages/mission-controller/src/__tests__/`                 | 0    | 274/274 |
| `npm run typecheck`                                                         | 0    | green   |
| `npm run deps:cycles`                                                       | 0    | OK      |

**Known failures:** none in-scope. Pre-existing ESLint noise untouched.

---

## 5. Browser acceptance — observed vs not observed

**NOT observed (no browser taken this sprint):**

- E2E journey in a real browser (goal → opt-in → mission → progress → result).
- Any live provider call, actual mission execution, real checkpoint/verification.

**Observed (this sprint):**

- Source inspection + unit tests covering every step.
- Sprint 020A path unchanged and still green; Sprint 020B architecture verified
  against real source symbols.

---

## 6. Remaining limitations

1. **No browser acceptance recorded.** The central question is accepted on
   full-path+test evidence, but the sprint did not perform the live browser
   journey. A PR with a Playwright/motion-e2e run remains the required step.
2. **Blocked/failed UX copy** is correct; "what next" wording is deliberately
   deferred to a smaller future UX fix.
3. **No new intelligence lifecycle:** only the goal-entry explanation was
   strengthened; Sprint 020B architecture reused, not re-derived.

---

## 7. Closing

Sprint 021 is complete to the extent this sprint allows. The product's
differentiating value is demonstrably real through the existing product:
goal → honest plan → opt-in → execution → verified evidence → outcome →
learning → next action. What remains is the **browser acceptance run**, which
is a PR/QA deliverable, not a code deliverable.

Stop after Sprint 021.

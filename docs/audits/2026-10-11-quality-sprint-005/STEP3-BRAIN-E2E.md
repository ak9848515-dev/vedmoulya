# STEP 3 — Brain E2E failure: provider credit vs application defect

## 1. The observed failure (sprint 004, unchanged)

`apps/web/e2e/brain.spec.ts` (real Chrome journey: `run pipeline → honest terminal
state → decisions → approval gate`) failed at the AI step for a **non-code reason**:

```
[CareerAssembler] Module call failed: Failed after 3 attempts.
  Last error: AI_APICallError: You have no credits remaining.
  Add credits to continue using the API at https://platform.openai.com/settings/...
{"message":"AI provider failed after retries","provider":"openai","reason":"internal_error","attempts":1}
```

## 2. Classification

| Aspect                         | Finding                                                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Failure class                  | **Provider account / quota** (`openai`, no credits) — an external credit condition, not repository code                                                             |
| Application behaviour          | **Correct and honest** — the orchestrator retried, recorded the failure, and the system surfaced `AI provider failed after retries` instead of fabricating a result |
| Independent of app correctness | Confirmed: the Brain gateway's deterministic suites pass with no live provider (below)                                                                              |

## 3. Application correctness is independent of the live provider

Deterministic, offline-designed Brain suites (they inject explicit doubles and are
designed for non-live mode — **not** relabelled as live acceptance):

```
npx vitest run services/api/src/__tests__/BrainRouter.test.ts \
               services/api/src/__tests__/BrainDashboardService.test.ts
→ BrainDashboardService.test.ts (11 tests) passed
→ BrainRouter.test.ts         (20 tests) passed
   Test Files 2 passed (2) · Tests 31 passed (31)
```

This isolates **application correctness** (routing, decision records, dashboard read
models) from the **provider-credit** condition.

## 4. Live acceptance status

- **Cloud live-provider acceptance: not run** — no provider with valid credits is
  available (OpenAI out of credits; Anthropic/DeepSeek keys empty). Per the sprint
  instructions this stays a separate, explicitly-blocked item rather than being
  replaced with a mocked pass.
- **Local-Ollama browser journey: not run this sprint.** The browser route would
  require injecting a local-provider environment into the Next.js dev server and a
  reliable identity database; the mission-level local-provider acceptance
  (`STEP2-LOCAL-MISSION-ACCEPTANCE.md`) already proves the local provider path end
  to end, so this is recorded as remaining work rather than a claimed pass.

## 5. Conclusion

**D-08a remains provider-blocked, not code-blocked.** The repository behaves
correctly under provider failure (honest terminal state). The next attempt to close
D-08a should pin the browser journey to the local Ollama route (mirroring the
mission harness in Step 2), or fund a cloud key.

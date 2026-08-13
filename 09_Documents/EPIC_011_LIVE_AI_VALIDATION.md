# EPIC-011 — Live AI Runtime Validation (Phase 1)

## 1. Command

```bash
npm run ai:production:verify
# = npx tsx scripts/ai-production-verify.ts
```

Prerequisites: `OPENAI_API_KEY` (real), `AUTH_JWT_SECRET` (strong, same as gateway).
Optional: `OPENAI_PRODUCTION_MODEL` (default `gpt-4o-mini`).

## 2. What It Verifies (Phase 1 checklist)

| Check                          | How                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------- |
| Provider authentication        | real `orchestrate` call through the Vercel AI SDK                             |
| Model availability             | content served from the configured model                                      |
| Timeout / retry / fallback     | flaky + timeout provider probes through the runtime's bounded retry/fallback  |
| Structured output              | schema-validated JSON through the real provider path                          |
| Token accounting               | input/output tokens + cost reported per call                                  |
| Budget enforcement             | tight token budgets respected; infeasible budgets rejected                    |
| Provider routing               | `explainSelection` with reason + alternatives                                 |
| Evidence handling / abstention | `groundingRequired` without RAG never fabricates                              |
| Error normalization            | 5xx → retry → 429 → retry → recover; timeout → fallback                       |
| Streaming                      | full stage sequence emitted (thinking → context → select → stream → validate) |
| Telemetry                      | `AIMetrics` request/cache counters printed (never secrets)                    |

## 3. Results (2026-08-09)

### 3.1 Production defect found and fixed (real value of live validation)

The live run exposed a defect the hermetic suites could not:
**Vercel AI SDK v7 rejects `system`-role messages** (`System messages not allowed`
from the OpenAI v4 provider). Fix applied in
`services/orchestrator/src/providers/VercelAIProvider.ts`:

- System prompts are extracted from `messages` and passed through the top-level
  **`instructions`** option (the SDK-v7 contract) at all three call sites
  (text / structured / streaming).
- Regression tests added in `VercelAIProvider.test.ts` (13/13 pass) asserting
  the split (system → instructions, user/assistant stay in messages).

After the fix the same live call reached OpenAI's API correctly — the remaining
block is account billing, not the adapter.

### 3.2 Live verdict: LIVE VALIDATION BLOCKED (provider quota)

The key authenticates and the model negotiates, but the account has **zero
billing credits** (`insufficient_quota`). The script reports this honestly:

```
ℹ LIVE VALIDATION BLOCKED (provider quota) — the call reached the real provider
   and authentication/model negotiation succeeded, but the account has no
   billing credits. This is an OPERATOR step, not an implementation failure.
   Operator steps:
     1. Add credits / a payment method at https://platform.openai.com/settings/organization/billing
     2. Re-run:  npm run ai:production:verify
```

Exit code **3** = blocked (never a silent pass, never a fabricated failure).

## 4. Operator Steps to Achieve FULL Live Verification

1. `export OPENAI_API_KEY=sk-...` (an account WITH billing credits).
2. `export AUTH_JWT_SECRET=<strong secret>`.
3. `npm run ai:production:verify` → expect `✅ PRODUCTION AI VERIFICATION PASSED`.

## 5. Safety Rules (enforced by construction)

- Never prints API keys (only the 7-char prefix is logged).
- Never unbounded: every call carries `maxInputTokens` / `maxOutputTokens`.
- Never silently falls back to mocks: without a key the script exits 2; on
  quota it exits 3 — live evidence is never fabricated.

# SPRINT-049 — Google Gemini Runtime Provider

**Date:** 2026-08-19
**Sprint:** SPRINT-049 — Gemini Runtime Provider
**Status:** 🟢 GREEN — IMPLEMENTATION VERIFIED
**New Engines Created:** 0
**Source Files Modified:** 5 (3 existing + 2 new)

---

## 1. Executive Verdict

Google Gemini is now a **genuine runtime provider** in the VedMoulya AI platform. The adapter uses the Vercel AI SDK (`@ai-sdk/google`) following the exact same pattern as the existing DeepSeek adapter. When `AI_GOOGLE_API_KEY` is configured, Google transitions from `UNSUPPORTED_RUNTIME` → `NOT_CONFIGURED` (adapter exists, dormant) → `CONFIGURED` (registered, executable). Google OAuth remains identity-only — it was NOT modified and does NOT authorize Gemini access.

---

## 2. Baseline

**Before SPRINT-049:**

- Google existed in the provider catalog with models (gemini-2.5-pro, gemini-2.5-flash, text-embedding-004)
- Google had `adapter: null` in `PROVIDER_RUNTIME_DESCRIPTORS`
- Google was `UNSUPPORTED_RUNTIME` — no adapter existed
- Google was NOT registered in `registerPlatformProviders()`
- `AI_GOOGLE_API_KEY` was documented but never consumed
- The AI Providers UI correctly showed "Catalog only — no runtime adapter"
- Google OAuth only requested `openid email profile` (identity-only)

---

## 3. Audit Evidence

The read-only audit (SPRINT-048) proved the exact gap:

| Layer              | State                                                          |
| ------------------ | -------------------------------------------------------------- |
| Provider Catalog   | ✅ Google present with 3 models                                |
| Runtime Descriptor | ❌ `adapter: null`                                             |
| Runtime Adapters   | ❌ No Google adapter in `services/orchestrator/src/providers/` |
| Registration       | ❌ Not in `registerPlatformProviders()`                        |
| Env Key            | `AI_GOOGLE_API_KEY` documented, never consumed                 |
| UI                 | Correctly showed "Catalog only — no runtime adapter"           |
| Google OAuth       | `openid email profile` only — identity, not AI                 |

---

## 4. Root Cause

Google had no runtime adapter implementation. The entire pipeline from catalog to UI was architecturally correct — the gap was the missing `GoogleGeminiProvider` adapter class and its registration.

---

## 5. Architecture

The fix reuses the existing provider architecture with zero new engines:

```
AI_GOOGLE_API_KEY (env)
        ↓
resolveGoogleKey() (orchestrator/src/index.ts)
        ↓
GoogleGeminiProvider(apiKey) (new adapter)
        ↓
registerPlatformProviders() → orchestrator.registerProvider()
        ↓
AIOrchestrationService → AI Capability Router → AI Companion
```

---

## 6. Adapter

**New file:** `services/orchestrator/src/providers/GoogleGeminiProvider.ts`

- Implements `ProviderAdapter` interface (same as VercelAIProvider, DeepSeekProvider)
- Uses `@ai-sdk/google` (`createGoogleGenerativeAI`) — same Vercel AI SDK runtime
- Default model: `gemini-2.5-flash`
- Capabilities: reasoning, coding, vision, summarization, classification, translation, speech, image_understanding, general_conversation, content_generation
- Pricing: $1.25/M input, $10/M output (registry estimates from catalog)
- Timeout: 60s (configurable)
- Error normalization: 429 → rate limited, 5xx → api error, abort → timeout, 401/403 → auth failed
- Security: API key never exposed in output, metadata, logs, or error messages

---

## 7. Registration

**Modified file:** `services/orchestrator/src/index.ts`

- Added `resolveGoogleKey()` function (reads `AI_GOOGLE_API_KEY`)
- Added conditional Google registration in `registerPlatformProviders()`
- Pattern: same as DeepSeek — key present → register, absent → skip
- Exported `GoogleGeminiProvider` for external use

---

## 8. Runtime Registry

**Modified file:** `packages/core/src/startup/provider-runtime.ts`

Changed Google's descriptor:

```diff
- adapter: null
- canExecute: false
- defaultEligibleStrict: false
+ adapter: 'GoogleGeminiProvider (Vercel AI SDK, @ai-sdk/google, generativelanguage API)'
+ canExecute: true
+ defaultEligibleStrict: true
```

Google is now eligible as `AI_DEFAULT_PROVIDER` in production when configured.

---

## 9. Environment

**Modified file:** `.env.example`

Documented `AI_GOOGLE_API_KEY` with:

- Server-side credential (never exposed to browser)
- Separate from Google OAuth
- Obtained from Google AI Studio (https://aistudio.google.com/apikey)
- Must never be committed

---

## 10. Dependency Decision

`@ai-sdk/google` was NOT previously installed. Added as a production dependency to `services/orchestrator/package.json`:

- Package: `@ai-sdk/google@^4.0.45`
- This is the official Vercel AI SDK adapter for Google Gemini
- Compatible with the existing `ai@^7.0.56` runtime
- No other Gemini SDKs added

---

## 11. Authentication Boundary

**Google OAuth remains identity-only.** Verified by code:

- Scope: `openid email profile` (GoogleProvider.ts line 37)
- Access token used only for `googleapis.com/oauth2/v2/userinfo`
- No AI/Cloud/Gemini scopes requested
- No OAuth token used as Gemini API key
- `GoogleGeminiProvider` uses `AI_GOOGLE_API_KEY` — a SEPARATE credential

---

## 12. Security

| Check                       | Status                                                          |
| --------------------------- | --------------------------------------------------------------- |
| API key server-side only    | ✅ Key never reaches React/client                               |
| No key in logs              | ✅ `resolveGoogleKey()` returns trimmed value; never logged     |
| No key in error messages    | ✅ `normalizeError()` never includes key                        |
| No key in response metadata | ✅ `JSON.stringify(response)` verified in tests                 |
| No IDOR                     | ✅ Provider registration is environment-scoped, not user-scoped |
| No cross-user leakage       | ✅ Provider state is global (not per-user)                      |

---

## 13. Provider States

| Scenario                          | Before                | After                    |
| --------------------------------- | --------------------- | ------------------------ |
| No adapter, no key                | `UNSUPPORTED_RUNTIME` | N/A (adapter now exists) |
| Adapter present, no key           | N/A                   | `NOT_CONFIGURED`         |
| Adapter present + valid key       | N/A                   | `CONFIGURED`             |
| Adapter present + short key       | N/A                   | `ERROR`                  |
| Adapter present + key, production | N/A                   | `CONFIGURED`             |

---

## 14. Gemini Primary Policy

Google Gemini is now `defaultEligibleStrict: true` — it CAN be `AI_DEFAULT_PROVIDER` in production when `AI_GOOGLE_API_KEY` is configured. This is correct: the provider is genuinely executable. The user retains the ability to change the primary provider.

---

## 15. AI Router

No changes to the AI Capability Router. The router already supports any registered provider. When Google is `CONFIGURED` and registered, the existing routing logic can select it based on capability/quality/cost factors.

---

## 16. AI Companion

No changes required. The AI Companion derives its "AI Ready" badge from `runtimeStatus.data.providers.some(p => p.canExecute)`. When Google is `CONFIGURED`, `canExecute: true` is reported, and the badge correctly reflects readiness.

---

## 17. Ollama Relationship

Ollama is unchanged. It remains a local/private provider option. Google Gemini is a cloud provider — they are independent alternatives.

---

## 18. Tests

### A. GoogleGeminiProvider Unit Tests (20 tests)

- API key passed correctly to `createGoogleGenerativeAI`
- Model selection correct (gemini-2.5-flash default, custom override)
- Text generation through SDK with usage accounting
- System prompt → `instructions` option (not message role)
- Structured output via `Output.object`
- Streaming content and done events
- Error normalization: 429, 5xx, abort, 401, 403, non-Error
- Health checks (healthy/unhealthy)
- Pricing defaults and overrides
- API key never in output/metadata

### B. Provider Registration Tests (5 new tests)

- Google registers from `AI_GOOGLE_API_KEY` env var
- Google registers from config key
- Google does NOT register when no key
- All three providers register when all keys present
- Runtime registry contract: Google no longer asserted as NOT registered

### C. Runtime Registry Tests (4 new/updated tests)

- Adapter present + no key → `NOT_CONFIGURED` (not `UNSUPPORTED_RUNTIME`)
- Adapter present + key → `CONFIGURED` + `registered`
- Google valid as `AI_DEFAULT_PROVIDER` when configured
- Google WITHOUT key → `NOT_CONFIGURED` (adapter exists but dormant)

### D. Updated Existing Tests

- `index.test.ts`: Cleaned up `AI_GOOGLE_API_KEY` env in afterEach
- `index.test.ts`: Updated contract test to not assert Google as not-registered
- `provider-runtime.test.ts`: Google no longer in UNSUPPORTED_RUNTIME group
- `provider-runtime.test.ts`: Added NOT_CONFIGURED test for Google without key

---

## 19. Typechecks

| Scope                   | Status                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| Root `tsc -b`           | ✅ PASS (exit 0)                                                                               |
| `packages/core`         | ✅ PASS                                                                                        |
| `services/orchestrator` | ✅ PASS                                                                                        |
| `apps/web`              | ⚠️ 3 pre-existing errors (JourneyOverview.tsx, first-run-store.ts) — NOT caused by this sprint |

---

## 20. Lint

| File                      | Status                               |
| ------------------------- | ------------------------------------ |
| `GoogleGeminiProvider.ts` | ✅ PASS                              |
| `index.ts`                | ✅ PASS                              |
| `provider-runtime.ts`     | ✅ PASS (pre-existing modifications) |

---

## 21. Build

`next build` was not re-run because the web app had pre-existing typecheck errors unrelated to this sprint. The core typecheck passes for all modified packages.

---

## 22. Browser Verification

**NOT EXECUTED — OPERATOR REQUIRED.** No real `AI_GOOGLE_API_KEY` is configured in the local environment. The browser verification requires:

1. A real Google AI Studio API key
2. Docker runtime running
3. User login
4. Navigate to `/providers`
5. Verify Google shows "Runtime: configured" badge
6. Enable Google provider
7. Ask a question through AI Companion
8. Verify Gemini responds

---

## 23. Real Gemini Verification

**NOT EXECUTED — OPERATOR REQUIRED.** No real `AI_GOOGLE_API_KEY` is available. To verify:

1. Set `AI_GOOGLE_API_KEY=<real-key>` in `.env.local`
2. Restart the API server
3. Check `npm run doctor` shows Google as CONFIGURED
4. Test via AI Companion or API directly

---

## 24. Regression

| Suite                     | Tests                 | Status  |
| ------------------------- | --------------------- | ------- |
| `packages/core` (startup) | 63/63                 | ✅ PASS |
| `services/orchestrator`   | 95/95                 | ✅ PASS |
| `services/api`            | 1012/1012 (1 skipped) | ✅ PASS |
| `apps/web`                | 346/346               | ✅ PASS |

---

## 25. Performance

No performance impact. The Google adapter uses the same Vercel AI SDK runtime as OpenAI and DeepSeek. The `@ai-sdk/google` package adds minimal bundle size (lazy-loaded, server-side only).

---

## 26. UX

| State             | Badge                           | Switch   | Description             |
| ----------------- | ------------------------------- | -------- | ----------------------- |
| No key configured | "Runtime: no key" (amber)       | Disabled | "Setup required"        |
| Key configured    | "Runtime: configured" (green)   | Enabled  | "Connected"             |
| Invalid key       | "Runtime: invalid config" (red) | Disabled | "Authentication failed" |

The existing `RUNTIME_TRUTH_CONFIG` in the providers page already handles these states. No UI code changes were needed.

---

## 27. Remaining Operator Items

1. **Set `AI_GOOGLE_API_KEY`** — obtain from https://aistudio.google.com/apikey
2. **Add key to production env** — never commit to repository
3. **Set `AI_DEFAULT_PROVIDER=google`** (optional) — if Google should be the primary
4. **Run `npm run doctor`** — verify Google shows as CONFIGURED
5. **Browser verification** — test the full flow through AI Companion

---

## 28. Production Readiness

**CONDITIONAL:** Google Gemini is production-ready when `AI_GOOGLE_API_KEY` is configured with a valid key. The adapter follows all existing production safety patterns:

- Fail-closed on missing/invalid keys
- No silent mock fallback
- No fabricated connection
- Honest error messages
- Server-side key only

---

## 29. Private Founder Readiness

**NOT AFFECTED.** SPRINT-048's first-login flow (Ollama prompt, AI readiness badge) is preserved. Google Gemini becomes an additional provider option alongside OpenAI, DeepSeek, and Ollama.

---

## 30. Files Changed

| File                                                                         | Change   | Type          |
| ---------------------------------------------------------------------------- | -------- | ------------- |
| `services/orchestrator/src/providers/GoogleGeminiProvider.ts`                | NEW      | Adapter       |
| `services/orchestrator/src/providers/__tests__/GoogleGeminiProvider.test.ts` | NEW      | Tests         |
| `services/orchestrator/src/index.ts`                                         | Modified | Registration  |
| `services/orchestrator/package.json`                                         | Modified | Dependency    |
| `packages/core/src/startup/provider-runtime.ts`                              | Modified | Descriptor    |
| `.env.example`                                                               | Modified | Documentation |
| `services/orchestrator/src/__tests__/index.test.ts`                          | Modified | Tests         |
| `packages/core/src/startup/__tests__/provider-runtime.test.ts`               | Modified | Tests         |

---

## 31. Dependencies Changed

| Package          | Version   | Location                             |
| ---------------- | --------- | ------------------------------------ |
| `@ai-sdk/google` | `^4.0.45` | `services/orchestrator/package.json` |

---

## 32. Architecture Impact

**Minimal.** The fix adds ONE adapter class following the existing `ProviderAdapter` pattern. No new engines, no new routers, no new authentication mechanisms. The existing architecture (AI Capability Router, Provider Experience Service, AI Companion) works with Google out of the box once registered.

---

## 33. Data Honesty

- Google is NOT marked "Connected" unless `AI_GOOGLE_API_KEY` is configured
- Google is NOT claimed as "primary" unless genuinely configured
- Google OAuth is NOT conflated with Gemini authorization
- No fabricated connections, no fake status claims
- The system says exactly what it knows

---

## 34. NEW ENGINE STATEMENT

**NEW ENGINES CREATED: 0**

This sprint adds ONE adapter class (`GoogleGeminiProvider`) following the existing `ProviderAdapter` interface pattern. No new AI engines, no new routing engines, no new authentication engines, no new provider registries.

---

## 35. Final Verdict

```
GEMINI PROVIDER:  REGISTERED (when AI_GOOGLE_API_KEY is configured)
GEMINI UI:        VISIBLE with honest runtime state badges
GEMINI AUTH:      REQUIRES API KEY (AI_GOOGLE_API_KEY — separate from Google OAuth)
GOOGLE → GEMINI:  NOT CONNECTED via OAuth (architecturally independent systems)
                  CONNECTED via AI_GOOGLE_API_KEY (separate legitimate credential)
```

**SPRINT-049 is GREEN at the implementation + unit-verified layer.** Full runtime certification (Docker/DB/browser) is OPERATOR REQUIRED.

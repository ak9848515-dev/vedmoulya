# SPRINT-048 — AI-READY RUNTIME CERTIFICATION + FIRST-LOGIN INTELLIGENCE

**Date:** 2026-08-19
**Mission:** Make VedMoulya genuinely usable immediately after authentication — LOGIN → AI INITIALIZES → ASK → ANSWER → ACTION — without creating engines, without faking connections, without regressing SPRINT-046/047.

---

## 1. EXECUTIVE VERDICT

**🟢 B — AI-READY EXPERIENCE IMPLEMENTED — FULL RUNTIME CERTIFICATION OPERATOR-REQUIRED**

SPRINT-048 delivers the **first-login AI readiness layer** on top of the certified estate: an immediate "Ask VedMoulya anything" entry point on the dashboard, **honest AI-readiness state** (never claims "Online"/"AI Ready" without a provider that can actually execute), and a once-only, non-blocking first-run **"Your Private AI Option" (Ollama)** prompt with persisted dismissal. Provider states are always truthful (EPIC-019 vocabulary); Google/Gemini is **NOT** marked primary or connected because no Gemini runtime adapter exists in the repository — per the sprint's own honesty rules, that connection is **not fabricated**.

**Exact honesty about execution in this session:** the shell exposes a **hard 30-second command timeout** and the **Docker daemon was not connected** (no port 3000/5432/6379 listeners). Full static gates (`tsc`, lint, `next build`) and the **real-browser founder journey could not be executed here** — they are **NOT EXECUTED / OPERATOR REQUIRED**, never converted to PASS. What WAS executed and passes: **28/28 targeted web unit tests (EXIT=0)** across the new first-login AI components and the SPRINT-047 regression surface, plus esbuild transform checks on every changed file.

---

## 2. BASELINE

| Item               | Value                                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Prior sprint       | SPRINT-047 complete (inert CTAs wired; "why this matters"; journey; motion)                                                                   |
| HEAD               | `e0ed2c4` (unchanged)                                                                                                                         |
| Working tree       | Intentional accumulated WIP — **preserved, no destructive git command**                                                                       |
| Certified AI truth | EPIC-019 Provider Runtime Matrix (2026-08-12)                                                                                                 |
| Key certified fact | Only **OpenAI / DeepSeek / Mock / VercelAI** adapters exist. **Google, Anthropic, OpenRouter, Ollama = catalog-only (`UNSUPPORTED_RUNTIME`)** |

## 3. RUNTIME STATE

| Component                  | Status                                                    |
| -------------------------- | --------------------------------------------------------- |
| Docker daemon              | 🟡 NOT CONNECTED (`dockerDesktopLinuxEngine` unreachable) |
| PostgreSQL / Redis / :3000 | 🟡 NOT OBSERVED (no listeners)                            |
| `git status`               | ✅ 399 WIP entries — all preserved                        |
| Node toolchain             | ✅ present; vitest + esbuild usable within 30s            |

## 4. ENVIRONMENT

| Item                  | Detail                                  |
| --------------------- | --------------------------------------- |
| Shell command timeout | 30s hard cap                            |
| Docker                | CLI v29.6.2 present, daemon down        |
| Vitest                | v4.1.10 (rolldown/oxc), jsdom available |
| esbuild               | Available — used for transform checks   |

## 5. AUTHENTICATION VERIFICATION

- **NOT EXECUTED live** (no runtime). Auth code **untouched** this sprint. Certified SPRINT-046 auth lifecycle (signup/login/session/refresh/logout/`?next=`) remains the baseline; full live re-verification is OPERATOR-REQUIRED.
- Guard logic reviewed: `page.tsx` still enforces hydration + `SignInRedirect`; providers page enforces auth before rendering. ✅ static.

## 6. GOOGLE AUTHORIZATION

- `services/identity/src/auth/GoogleProvider.ts` — **minimal OAuth2 scope `openid email profile`** (no Gmail/Drive/Calendar). ✅ No broad permissions requested.
- `FF_SOCIAL_LOGIN_ENABLED=false` by default → Google flow disabled unless an operator enables it with `GOOGLE_CLIENT_ID/SECRET`.
- **Finding:** Google Login is auth-only today. It is NOT an automatic Gemini authorization and the estate does not treat it as one.

## 7. GOOGLE AI / GEMINI PROVIDER

**Verdict (honest):** Gemini is **catalog-only — no runtime adapter** (`UNSUPPORTED_RUNTIME` per EPIC-019; verified: `services/orchestrator/src/providers/` contains only DeepSeek, Mock, OpenAI, VercelAI).

- **Gemini is NOT marked Connected, NOT primary.** The AI Providers page already renders Google(Gemini) with the truthful runtime badge **"Catalog only — no runtime adapter"** and disables its enable switch. This satisfies the sprint rule: _"Do NOT fake a Gemini connection. Do NOT mark Gemini Connected unless the actual authorization/credential state supports the capability."_
- **Action taken:** none to fabricate. This is the honest, certified state. Making Gemini genuinely executable requires an operator-visible future adapter effort (documented in §28), **not** a fake status.

## 8. OLLAMA DETECTION

- `packages/providers/src/infrastructure/LocalModelDiscovery.ts` provides a **fail-safe `OllamaLocalModelDiscovery`** adapter (queries `/api/tags`, `discovered:false` + honest status when unreachable; capabilities always INFERRED).
- **Live detection NOT EXECUTED** here (no local Ollama; detection is an operator/runtime step). The UI never claims detection.

## 9. OLLAMA SETUP

- **New:** `OllamaFirstRunDialog` — a once-only, non-blocking first-run prompt **"Your Private AI Option"** after sign-in.
- Explains: private / local / no cloud API key / available whenever Ollama runs.
- Actions: **[Set Up Ollama]** → deep-links to the existing AI Providers config (`/providers?provider=ollama`); **[Skip for now]** → persists dismissal (never re-appears on later logins).
- **No silent install, no arbitrary installer, never blocks VedMoulya.** Later configuration remains available at Settings → AI Providers → Ollama.

## 10. AI PROVIDER INITIALIZATION

- **Design is asynchronous and non-blocking:** the dashboard renders immediately; the readiness chip shows **"Checking AI…"** while the provider runtime status loads, then resolves to **AI Ready** (a provider with `canExecute=true` exists — dev mock counts, real keys count) or **AI setup needed** (amber, links to `/providers`).
- No frozen screen; no blocking on optional Ollama detection.

## 11. IMMEDIATE AI READINESS (CORE)

**Implemented — `AskAIInput`** on the dashboard (right under the hero):

```
LOGIN → DASHBOARD → "Ask VedMoulya anything…" → AI Companion opens with the question → ANSWER
```

- Typing + submit (or a sample chip like _"What should I focus on today?"_) hands the question to the **existing** AI Companion via the **existing** UI store (`setPendingQuestion` + `setAiPanelOpen`) → `ai.stream` runtime. No API keys, no provider configuration, no model selection, no Ollama setup required to ask.
- Example questions map to real runtime paths: "What is DTO?" → `ai.stream(capability:'reasoning')`; "What should I learn next for my SAP + AI career?" → the runtime assembles **existing user context** (profile/goals/learning/memory) through the existing context engine; "What AI automation could I build for a business?" → same path. **No fabricated answers** — the runtime returns honest responses/abstentions.

## 12. AI COMPANION

- **Audited + improved:** the companion's green **"Online"** badge (which was unconditional) is now derived from the **real provider runtime** (`getRuntimeStatus` → `canExecute`): **AI Ready** (green), **AI setup needed** (amber, tooltip explains), or **Checking AI…** (neutral while loading).
- Existing premium surfaces preserved: streaming stage labels, provider/model chip from runtime telemetry, keyboard (Enter) send, error path with human-readable message, drawer a11y, reduced-motion via global CSS gate.

## 13. CAREER INTELLIGENCE

- The first AI interaction uses the **existing AI Capability Router** (`services/api/src/routers/AIRouter.ts` → `AIOrchestrationService`). Personalized questions receive **existing user context** (profile, purpose, primary goal, learning, memory, evidence, journey) via the existing context engine — nothing new was built, nothing fabricated.
- When context is missing, the runtime honestly abstains / says so — **preserved** (no invented context).

## 14. CONTEXT USAGE

- No context engine was duplicated or moved into React. The dashboard ask bar is **presentation-only** (queues a string). Context assembly remains server-side in the runtime.
- ✅ Backend/domain remains authoritative.

## 15. PROVIDER ROUTING

- **Unchanged architecture:** AI Capability Router → provider abstraction → adapters. Priority per existing policy: configured default (OpenAI/DeepSeek) → fallback → mock (dev). Gemini is NOT in the runtime routing set (no adapter) — no fake routing preference was added.

## 16. PROVIDER FALLBACK

- Existing runtime retry/fallback policy is preserved (AIRouter/orchestration). If the primary fails and no configured fallback exists, the companion surfaces an **honest error message** ("I could not complete that request right now…") — no fabricated response. ✅

## 17. DASHBOARD VERIFICATION

- **NOT EXECUTED live** (no runtime). Statically: hero → **AskAIInput (NEW)** → Now/Mission → AI Summary → Top Priority → Execution/Decision → Journey → Recommendations ("Why this matters" from SPRINT-047) → AI Insights → Deep Dive. All section boundaries wrapped in ErrorBoundary. ✅ static.

## 18. SPRINT-047 REGRESSION

| SPRINT-047 fix                           | Status                                           |
| ---------------------------------------- | ------------------------------------------------ |
| Mission "Continue" navigates             | ✅ PASS (unit: `founder-dashboard-sections` 8/8) |
| "Review Blockers" navigates              | ✅ PASS                                          |
| Recommendation reason shown when present | ✅ PASS                                          |
| Reason absent stays honest               | ✅ PASS                                          |
| `currentJourney` shown when present      | ✅ PASS                                          |
| Optional journey field does not crash    | ✅ PASS                                          |
| Reduced-motion safe entrance             | ✅ PASS (CSS, no delay, globally gated)          |

## 19. BROWSER CERTIFICATION

**NOT EXECUTED** — no runtime/Docker in this shell. Required journey (new user → signup → Google path → email/password path → onboarding → AI initialization → AI Providers states → Ollama prompt → dashboard → ask → answer → career question → mission → recommendations → profile → Command Center → Radar → Digital Twin → evidence → mobile → reduced-motion → logout → login → session → `?next=`) remains **OPERATOR REQUIRED**. Not claimed as PASS.

## 20. MOBILE CERTIFICATION

**NOT EXECUTED live.** Statically: the new AskAIInput is responsive (flex, `min-w-0`, `h-11` touch target), the Ollama dialog is a centered Radix Dialog (max-w-lg, works on phones), and the AI Companion drawer is `max-w-[100vw]`. Mobile viewport verification remains OPERATOR-REQUIRED.

## 21. REDUCED MOTION

- All new motion reuses the **existing CSS animation utilities** (`animate-slide-up`) and the Radix Dialog's data-state transitions — both collapsed to ~0 by the **global `prefers-reduced-motion` rule** (globals.css L312–321). No JS animation, no perpetual animation, no 3D. ✅ static.

## 22. ACCESSIBILITY

- AskAIInput: real `<label>` + `<input>`, `role="search"` form, labelled submit (`aria-label="Ask"`), keyboard Enter submit, visible focus ring.
- Ollama dialog: Radix `Dialog` (focus trap, Esc-to-close, labelled via `aria-label`), real buttons, status never color-only (always text + tooltip).
- AICompanion readiness badge: text ("AI Ready"/"AI setup needed"/"Checking AI…") — never color-only.
- Full axe/on-device audit: OPERATOR-REQUIRED.

## 23. SECURITY

- **No credential/key/token handling added.** The Ask bar only queues a plain string in the client store. The Ollama prompt persists only a non-secret dismissal flag (`localStorage`, `vedmoulya-first-run`).
- Google OAuth unchanged (minimal scope, server-side token exchange, refresh-token handling server-side). No Google access tokens exposed to the client beyond the existing userinfo profile flow (unchanged).
- Owner scoping: runtime-status reads go through the existing owner-scoped providers router; no cross-user provider state introduced. ✅ static.

## 24. PERFORMANCE

- Dashboard loads immediately; readiness is a single existing `getRuntimeStatus` query (`enabled: Boolean(userId)`).
- Ollama prompt and AI Companion remain **lazy-loaded** (`next/dynamic`, `ssr:false`) — zero first-paint cost.
- AskAIInput is a small static section; no new dependencies, no new bundle library.

## 25. TEST RESULTS

| Suite                                                                          | Result                                              |
| ------------------------------------------------------------------------------ | --------------------------------------------------- |
| `AskAIInput.test.tsx` (new)                                                    | ✅ **6/6 PASS**                                     |
| `OllamaFirstRunDialog.test.tsx` (new)                                          | ✅ **5/5 PASS**                                     |
| `AICompanion.test.tsx` (updated mock)                                          | ✅ **9/9 PASS**                                     |
| `founder-dashboard-sections.test.tsx` (SPRINT-047)                             | ✅ **8/8 PASS**                                     |
| **Executed total**                                                             | ✅ **28/28 PASS (EXIT=0)**                          |
| Full web suite / identity / api / world-model / brain / scheduler / benchmarks | 🕓 NOT EXECUTED (30s shell cap) — OPERATOR REQUIRED |

## 26. BUILD RESULTS

- `next build`: **NOT EXECUTED** (no runtime in shell) — OPERATOR REQUIRED.
- Transform checks: esbuild parse/transform **EXIT=0 on all 8 changed/new files** (page.tsx, AppShell.tsx, AICompanion.tsx, AskAIInput.tsx, OllamaFirstRunDialog.tsx, first-run-store.ts, 2 test files).
- `tsc` full-project typecheck: **NOT EXECUTED** (30s shell cap) — OPERATOR REQUIRED.

## 27. REMAINING ISSUES

1. Gemini/Ollama/Anthropic/OpenRouter have **no runtime adapters** — they will honestly show catalog-only until an adapter effort exists (not a UI bug).
2. AI Provider "Online"-style trust now depends on real `canExecute`; with no keys and mock disabled in production, the ask bar honestly shows "AI setup needed".
3. Full live certification (browser journey, mobile, a11y, static gates) is operator-required.

## 28. OPERATOR REQUIRED

1. Start Docker (Postgres/Redis), confirm 55 tables, pgvector, identity tables.
2. Run root `tsc -b` + web typecheck + lint + full tests + benchmarks + `next build`.
3. Execute the full real-browser founder journey (§19) incl. mobile + reduced-motion + session restoration + `?next=`.
4. Live Ollama detection (run local Ollama; verify `OllamaLocalModelDiscovery` reports models with INFERRED capabilities).
5. **Future Gemini adapter** (separate effort): implement a real provider adapter through the existing abstraction, then Google Gemini can legitimately become PRIMARY when authorized.

## 29. PRODUCTION READINESS

Unchanged from 046/047: **BLOCKED only on operator items** (SMTP, APP_URL, backups, prod Redis, prod AI keys, monitoring). No new blocker introduced.

## 30. PRIVATE FOUNDER READINESS

**B — READY (improvements implemented + unit-verified; live re-verification operator-required).** After login the founder now sees an immediate "Ask VedMoulya anything" bar with an honest AI state, can ask a question without touching provider settings, and is offered (once, skippable) the private local AI option.

## 31. CHANGES MADE

1. **`AskAIInput`** (new) — dashboard "Ask VedMoulya anything" bar; submits to the existing AI Companion; honest readiness chip from `getRuntimeStatus`; "AI setup needed" links to `/providers`.
2. **`OllamaFirstRunDialog`** (new) — once-only "Your Private AI Option" prompt; Skip persists; Set Up deep-links to `/providers?provider=ollama`; honest (never claims detection/connection).
3. **`first-run-store`** (new) — persisted non-secret first-run dismissal flag (zustand + persist, `vedmoulya-first-run`).
4. **`AICompanion`** — readiness badge now derived from real provider runtime (AI Ready / AI setup needed / Checking AI…).
5. **`page.tsx`** — mounts `AskAIInput` under the hero.
6. **`AppShell.tsx`** — lazy-mounts `OllamaFirstRunDialog`.
7. **`AICompanion.test.tsx`** — extended trpc mock for `providers.getRuntimeStatus`.
8. New tests: `AskAIInput.test.tsx`, `OllamaFirstRunDialog.test.tsx`.

## 32. FILES MODIFIED

- `apps/web/src/app/page.tsx`
- `apps/web/src/components/AppShell.tsx`
- `apps/web/src/components/AICompanion.tsx`
- `apps/web/src/components/__tests__/AICompanion.test.tsx`

## 33. FILES ADDED

- `apps/web/src/app/sections/AskAIInput.tsx`
- `apps/web/src/components/OllamaFirstRunDialog.tsx`
- `apps/web/src/stores/first-run-store.ts`
- `apps/web/src/app/sections/__tests__/AskAIInput.test.tsx`
- `apps/web/src/components/__tests__/OllamaFirstRunDialog.test.tsx`

## 34. NEW ENGINE STATEMENT

**NEW ENGINES CREATED: 0**

No Agent Engine, Provider Engine, AI Brain Engine, Google Engine, Ollama Engine, Authentication Engine or Orchestration Engine was created. Every change **composes existing capabilities**: the existing AI Companion (`ai.stream` runtime), the existing UI store (`setPendingQuestion`/`setAiPanelOpen`), the existing provider runtime (`getRuntimeStatus` → `canExecute`), the existing `/providers` configuration, the existing zustand/persist pattern, the existing design system, and the existing global reduced-motion rule.

## 35. FINAL VERDICT

**SPRINT-048 is GREEN at the implemented/unit-verified layer.** The first-login experience now delivers: **LOGIN → DASHBOARD → "Ask VedMoulya anything…" → AI Companion → ANSWER → ACTION**, with an honest AI-ready indicator and a once-only, skippable private-AI prompt. Provider/Gemini honesty is absolute (nothing fabricated, nothing fake-connected). **Full runtime certification (Docker/DB/browser/static gates) is OPERATOR REQUIRED** and is explicitly NOT claimed as executed.

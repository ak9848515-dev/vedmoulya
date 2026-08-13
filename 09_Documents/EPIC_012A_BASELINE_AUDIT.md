# EPIC-012A — Baseline Audit (Source-First)

> **Status:** ✅ COMPLETE — verified against source (2026-08-10).
> Every classification below was checked against the **actual implementation**, not
> prior reports. File paths are the evidence. Requirements are classified:
> `EXISTS` · `EXISTS BUT NEEDS REFINEMENT` · `PARTIAL` · `MISSING` · `DUPLICATE` · `NOT REQUIRED`.

---

## 0. Audit scope

| Area                               | Primary source                                                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Global design system               | `apps/web/src/app/globals.css`, `packages/ui`, `apps/web/src/components/AppShell.tsx`                                   |
| Experience package                 | `packages/experience` (QualityEvaluator, VisualCriticEngine, AICritiquePort)                                            |
| ApplicationWorkspace / Builder     | `apps/web/src/app/applications/{page,workspace,builder}.tsx`, `packages/app-factory`                                    |
| Dashboard                          | `apps/web/src/app/page.tsx`, `apps/web/src/app/sections/*`                                                              |
| AI Providers screen                | `apps/web/src/app/providers/*`                                                                                          |
| Provider Configuration             | `services/api/src/routers/ProvidersRouter.ts` (no dedicated screen — see P6)                                            |
| ProviderRoutingAdvisor / AI-SELECT | `packages/services/src/ai/runtime/ProviderRoutingAdvisor.ts`                                                            |
| ModelSelectionIntelligence         | `packages/services/src/ai/runtime/ModelSelectionIntelligence.ts`                                                        |
| TokenOptimization                  | `packages/services/src/ai/runtime/ContextOptimizer.ts` + `TokenOptimizationResult.ts`                                   |
| AI Runtime                         | `packages/services/src/ai/AIOrchestrationService.ts`, `services/orchestrator/src/providers/*`                           |
| RAG                                | `packages/rag`                                                                                                          |
| LoopEngine                         | `packages/loop-engine`                                                                                                  |
| Observability / control plane      | `packages/core/src/tracing/*`, `services/api/src/observability/*`, `services/api/src/services/OpsApplicationService.ts` |
| Provider catalog / model metadata  | `packages/providers/src/catalog/provider-catalog.ts`, `packages/providers/src/types/*`                                  |
| Token/cost telemetry               | `packages/services/src/ai/AIMetrics.ts`, `services/api/src/observability/CostLedger.ts`                                 |

---

## 1. Requirement classification

### Phase 1 — Global Premium UX Refinement → **PARTIAL**

- **EXISTS:** A single design-token system (`globals.css` `@theme` + `packages/ui`) drives every screen: brand palette, neutral warm scale, typography tokens (Satoshi/Inter), spacing scale, semantic colors, glass utility, dark-mode via class variant. The AppShell provides one sidebar/topbar/breadcrumb layout for all sections.
- **NEEDS REFINEMENT:** The `/providers` screen is an **enterprise registry** (stats-card strip, filter toolbar, 3 tabs, dense cards) — exactly the "admin console / collection of unrelated cards" feel the epic forbids. Several screens still use hard-coded slate hex values outside tokens (`workspace.tsx`, `page.tsx` applications) rather than the design tokens.
- **NOT REQUIRED:** creating a second design system (forbidden by the epic).

### Phase 2 — Information Density → **PARTIAL**

- **EXISTS:** Some progressive disclosure exists (e.g. application workspace tabs; "Details" in loop UI is partially collapsible).
- **MISSING:** No consistent "Primary / Secondary / Advanced / Diagnostics" disclosure pattern. The providers screen shows _everything_ (health bars, capability matrices, latency, uptime) on the first screen. No "View more / Why? / Advanced / Diagnostics" affordances.

### Phase 3 — Three-Second Test → **PARTIAL**

- **EXISTS:** Dashboard and main module pages are mostly scannable.
- **NEEDS REFINEMENT:** The `/providers` screen fails the test (where am I / what matters / what can I do are buried under registry chrome). The providers page needs the primary action (enable/disable, configure) visible immediately.

### Phase 4 — AI Providers Redesign → **MISSING**

- **MISSING:** No premium consolidated **AI Usage indicator** (`✦ AI Usage 184K / 1M tokens · $12.40 · 82% free`) and no simple provider list with `Provider → Model → Availability → [ON/OFF]`.
- The current screen is the registry marketplace (verified above) — a discovery catalog, not a user's AI configuration surface.
- The provider/model metadata exists (`provider-catalog.ts`, `ProviderDTO.models`) — the UI must consume it, not hardcode.

### Phase 5 — Provider Enable/Disable → **PARTIAL**

- **EXISTS (operator-only):** `ops.disableProvider/enableProvider` (`services/api/src/services/OpsApplicationService.ts:394-398`) gated by `OperatorGate` (`OPS_OPERATOR_IDS`; empty = deny-all). Audited. NOT suitable for regular users.
- **MISSING (user-facing):** no **owner-scoped per-user** provider enable/disable persisted preference consumed by the routing engine. No UI switch on the providers screen.
- **Architecture decision (this sprint):** implement a per-user `ProviderPreferences` (owner-scoped store) layered over the global registry; the user switch NEVER touches the global registry or the operator gate.

### Phase 6 — Provider Configuration → **MISSING**

- **MISSING:** no dedicated configuration experience (page or sheet) per provider. Clicking a provider currently does nothing on the marketplace grid.
- Data needed by the config screen (connection status, models, capabilities, pricing, limits, health, intelligence profile) **exists server-side** (`getProvider`, `getIntelligenceProfile`, `getAvailabilityTier`, `getFleetHealth`, `discoverLocalModels`).

### Phase 7 — Provider Intelligence Layer → **EXISTS**

- `ProviderIntelligenceService` (`packages/providers/src/domain/services/ProviderIntelligenceService.ts`) auto-derives a `ProviderIntelligenceProfile` on demand with per-property provenance (`VERIFIED | PROVIDER_DECLARED | MEASURED | INFERRED | UNKNOWN`) — nothing fabricated.
- Exposed via `providers.getIntelligenceProfile` (`ProvidersRouter.ts`).

### Phase 8 — Model Resource Types → **EXISTS**

- `ModelResourceClassifier` (`packages/providers/src/domain/services/ModelResourceClassifier.ts`) classifies `LOCAL / FREE_HOSTED / FREE_API_QUOTA / USER_PAID_API / AGGREGATOR / OPEN_MODEL / CUSTOM_ENDPOINT / ENTERPRISE`.
- Correctly separates **open weights** (orthogonal) from **free inference**; "free model" ≠ "unlimited free inference" (free tier + nonzero price ⇒ `FREE_API_QUOTA`).

### Phase 9 — Free Resource Intelligence → **PARTIAL**

- **EXISTS:** classification covers free tiers, quota semantics, aggregators, open models, custom endpoints, and **local runtime discovery** (`LocalModelDiscovery.ts` — Ollama / LM Studio / OpenAI-compatible, fail-safe, `discovered:false` + honest status when unreachable).
- **PARTIAL:** no _live catalogue adapters_ for OpenRouter free variants / HF inference endpoints (no credentials on this machine — would be an operator step). Registry/catalog facts are the honest data source; volatile info carries `retrievedAt` where discovery runs.

### Phase 10 — Local Model Intelligence → **EXISTS**

- `OllamaLocalModelDiscovery` + `OpenAICompatibleModelDiscovery` + hermetic `InMemoryLocalModelDiscovery` (`packages/providers/src/infrastructure/LocalModelDiscovery.ts`). Model size parsed (bytes/"4.7GB"), quantization surfaced, capabilities INFERRED (never claimed verified), never auto-downloads.

### Phase 11 — Hardware-Aware Model Selection → **EXISTS**

- `HardwareCompatibilityService` (`packages/providers/src/domain/services/HardwareCompatibilityService.ts`) classifies `SAFE / POSSIBLE_SLOW / NOT_RECOMMENDED / UNSUPPORTED / UNKNOWN` with reasons; storage gate, VRAM fast path, CPU RAM fit; never recommends solely because free; `UNKNOWN` when hardware absent.

### Phase 12 — Model Selection Intelligence → **EXISTS**

- `ModelSelectionIntelligence` (`packages/services/src/ai/runtime/ModelSelectionIntelligence.ts`) is a **thin layer over the frozen `ProviderRoutingAdvisor`** (no duplicate routing). Hard requirements (precision ≥80 for high; evidence ≥60; context fit) applied BEFORE scoring — "a free model that cannot satisfy the task is NOT eligible". Reuses AI-SELECT, ProviderRoutingAdvisor, AI Runtime, TokenOptimization (ContextOptimizer), EvidenceEvaluator, LoopEngine (specialist port).

### Phase 13 — User Preference → **PARTIAL**

- **EXISTS (logic):** `userPreference` honored; conflict → explanation + options ("This model cannot reliably satisfy this task because…", Use anyway / Recommended / Cancel). Never silently replaced.
- **MISSING (persistence):** no owner-scoped persisted preferred provider/model; no gateway exposure of the conflict/options flow to the UI.

### Phase 14 — Cost Policy → **PARTIAL**

- **EXISTS (logic):** `BudgetPolicy = never_paid | ask_before_paid | allow_within_budget`, **default ask_before_paid**; `never_paid` blocks paid selection; `ask_before_paid` sets `requiresPaidApproval` (never silently incurs paid usage).
- **MISSING (persistence + budgets):** no persisted per-user policy; **daily / monthly / per-request budgets** (numbers) not represented.

### Phase 15 — Smart Upgrade/Downgrade → **EXISTS**

- `recommendUpgradeDowngrade` in `ModelSelectionIntelligence`: downgrade for simple tasks (quality > 70, standard precision), upgrade for high-precision/complex tasks; **never downgrades an explicit user selection silently**.

### Phase 16 — "Why This Model?" → **PARTIAL**

- **EXISTS (logic):** `whySummary` (user-facing list: accuracy met / context sufficient / evidence satisfied / cost) + the frozen advisor's full `ProviderSelectionExplanation` (candidates considered/rejected, reasons, fallback) for Diagnostics.
- **MISSING (exposure):** not exposed through the gateway to the UI; `ai.explainSelection` uses only the frozen advisor (no budget/preference layer).

### Phase 17 — Token Experience → **PARTIAL**

- **EXISTS (data):** `AIMetrics` (in-process counters) + EPIC-012 `CostLedger` (per-user totals/byProvider/byApplication/byUser, cache hits, anomalies) + `ops.costLedger`.
- **MISSING (presentation):** no premium aggregate "AI Usage" view (tokens / budget / cost / % free) and no detailed usage screen in the UI.

### Phase 18 — Application Builder UX → **EXISTS BUT NEEDS REFINEMENT**

- **EXISTS:** builder + workspace with UNDERSTAND→SPECIFY→ARCHITECT→PLAN→BUILD→TEST→REVIEW→REFINE→DEPLOY stages; approval gates; economics.
- **NEEDS REFINEMENT:** leaks internal terminology (`REPAIR_LIMIT_REACHED`, `terminationReason`, mono-font gate IDs, "validate → critique → refine…"). No human-readable "What AI is doing / What you need to do" stage presentation.

### Phase 19 — AI Working Experience → **PARTIAL**

- **PARTIAL:** loading labels like "Building — generate → validate → critique → refine…" expose internals. No `Understanding ✓ / Planning ✓ / Building ● / Checking ○ / Ready ○` stage strip.

### Phase 20 — Trust & Accuracy UX → **PARTIAL**

- **EXISTS (engine):** Evidence-First architecture (`EvidenceEvaluator`, experience `ApplicationQualityEvaluation`, requirements provenance). Abstention is a first-class runtime concept.
- **PARTIAL (UI):** requirements UI shows provenance badges; but no consistent "Verified / High confidence / Limited evidence / Needs review / Unable to verify" language across product surfaces, and no "VedMoulya couldn't verify this reliably" empty/abstention state pattern.

### Phase 21 — Error Experience → **PARTIAL**

- **PARTIAL:** some friendly errors exist; but technical strings reach the UI in several places (loop termination reasons, `NotFoundError('Provider'…)`-style messages, raw mutation errors). No consistent "what happened → what VedMoulya can do → [Continue] [View providers] → Diagnostics" pattern.

### Phase 22 — Consistency Audit → **NOT REQUIRED as a code item** (ongoing gate)

- Audited during this sprint's implementation: typography, spacing, buttons, inputs, cards, navigation, icons, status indicators, loading/empty/error states, dark mode, responsive, animations. No screen may introduce its own visual language — the design tokens are the single source.

### Phase 23 — Visual Quality → **EXISTS (engine) / PARTIAL (product UI)**

- The experience package evaluates _generated applications_ (FUNCTIONAL/UX/VISUAL/ACCESSIBILITY/SECURITY/PERFORMANCE/AI/RAG/DATA/ARCHITECTURE; critical failures override scores). This sprint applies the same _principles_ to the product UI via the consistency audit + browser validation; the product UI itself is not fed through the critic (out of scope — the critic targets generated apps).

### Phase 24 — Browser Journeys → **MISSING**

- No Playwright journey covers: provider add, enable/disable, model selection, provider configuration, token usage, application creation/build, AI execution, error/fallback, deployment. New flows in this sprint must be covered.

### Phase 25 — Responsive → **PARTIAL**

- Mobile shell exists (bottom tab bar, safe-area insets, slide-up, pull-to-refresh, `MobileTabBar`, `OfflineBanner`). New providers screens must compose for desktop/tablet/mobile (not merely shrink).

### Phase 26 — Security → **EXISTS** (to be re-verified for new surfaces)

- Provider credentials: never exposed in DTOs/UI (registry holds metadata only; keys live in the runtime env).
- IDOR: gateway `assertUserIdMatchesSession` middleware + owner-scoped stores.
- Operator controls: `OperatorGate` deny-all default + `AuditTrail`.
- New per-user preferences must be owner-scoped (each user only reads/writes their own record); usage data owner-scoped (CostLedger filters by userId).

### Phase 27 — Performance → **PARTIAL**

- Lazy-loaded heavy views (`next/dynamic` in providers/applications), 50 kB bundle budget discipline, request deduplication via React Query (single `useProviderMarketplace` etc.).
- New screens must follow: cached metadata, background refresh, lazy detail views, no new blocking chains.

### Phase 28 — Testing → **PARTIAL**

- **EXISTS:** `packages/providers` tests (intelligence, classifier, hardware, health, discovery, capability matrix), `ModelSelectionIntelligence.test.ts`, `ProviderRoutingAdvisor.test.ts`, gateway router tests, IDOR tests.
- **MISSING:** provider preference persistence/owner isolation tests, gateway procedure tests for preferences/usage/selection exposure, credential-isolation assertions on the new view models.

### Phase 29 — Do Not Break Existing Architecture → **CONSTRAINT (accepted)**

- Verified: no duplicate routing (ModelSelectionIntelligence wraps ProviderRoutingAdvisor), no duplicate telemetry (reuses AIMetrics/CostLedger), no duplicate design system, no hardcoded catalogue, no runtime rewrite. This sprint extends, never rebuilds.

### Phase 30 — Documentation → **MISSING**

- This audit + `EPIC_012A_UX_REFINEMENT.md`, `EPIC_012A_PROVIDER_INTELLIGENCE.md`, `EPIC_012A_MODEL_SELECTION.md`, `EPIC_012A_COMPLETION_REPORT.md` + roadmap/changelog/readme/task_progress sync.

---

## 2. Gap summary (what this sprint actually builds)

| #   | Gap                                                                                                                         | Where it lands                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| G1  | Owner-scoped per-user provider preferences (enabled set, preferred model, budget policy, daily/monthly/per-request budgets) | `@vedmoulya/providers` (new `ProviderPreferencesStore`/`ProviderPreferencesService` + request-context seam) |
| G2  | Routing engine respects user-disabled providers immediately                                                                 | gateway request-context → `ProviderApplicationService.listByCapability` filter                              |
| G3  | "Why this model?" + paid-approval + preference-conflict exposed to the UI                                                   | gateway `providers.explainModelSelection` (ModelSelectionIntelligence + user prefs)                         |
| G4  | Aggregate AI usage view model (tokens/budget/cost/% free, by provider)                                                      | gateway `ProviderExperienceService` (registry + preferences + CostLedger)                                   |
| G5  | AI Providers screen redesign (usage indicator, provider list, inline ON/OFF, model select)                                  | `apps/web/src/app/providers/page.tsx`                                                                       |
| G6  | Provider configuration screen (progressive disclosure)                                                                      | `apps/web/src/app/providers/[id]/page.tsx`                                                                  |
| G7  | AI Usage & Economics view + Settings AI preferences tab                                                                     | `apps/web` (providers usage view + settings tab)                                                            |
| G8  | Human-readable builder stages + friendly error experience                                                                   | `apps/web/src/app/applications/*`                                                                           |
| G9  | Tests for all new backend + gateway surfaces; existing tests retained                                                       | `packages/providers`, `services/api`                                                                        |
| G10 | EPIC-012A docs + roadmap/changelog/readme/task_progress sync                                                                | `09_Documents/`                                                                                             |

## 3. Honest verification note

All classifications are from **source inspection on 2026-08-10**. No live provider
catalogue access, no Postgres, no Docker on this machine — live discovery/health
remain operator steps and are reported as such (never fabricated).

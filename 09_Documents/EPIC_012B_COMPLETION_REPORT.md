# EPIC-012B — AI Provider Intelligence & Model Discovery

**Verdict: 🟢 GREEN — IMPLEMENTATION VERIFIED** (live provider-API discovery is an operator step; unknown metadata stays UNKNOWN — never fabricated)

**Date:** 2026-08-10

---

## 1. Mission

Make VedMoulya intelligent about every configured AI provider and its models:

> DISCOVER → VERIFY → UNDERSTAND → CLASSIFY → RANK → ROUTE → MEASURE → LEARN

As an **incremental layer over the frozen EPIC-012A intelligence** — no routing engine rebuilt, no duplicate telemetry/design system, no hardcoded model catalogue, no credential exposure. EPIC-012A's `ProviderIntelligenceService`, `ModelResourceClassifier`, `HardwareCompatibilityService`, `LocalModelDiscovery`, `ModelSelectionIntelligence` and `ProviderRoutingAdvisor` were all **verified from source and preserved unchanged in contract**.

## 2. What was already there (verified, not rebuilt)

| Capability                                                                                                                | Source                                                    | Status |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------ |
| Auto-derived profile with provenance                                                                                      | `ProviderIntelligenceService.buildProfile`                | EXISTS |
| Resource classification (LOCAL/FREE_HOSTED/FREE_API_QUOTA/USER_PAID_API/AGGREGATOR/OPEN_MODEL/CUSTOM_ENDPOINT/ENTERPRISE) | `ModelResourceClassifier`                                 | EXISTS |
| Hardware-aware local fit                                                                                                  | `HardwareCompatibilityService`                            | EXISTS |
| Local runtime discovery (Ollama / LM Studio / OpenAI-compatible), fail-safe                                               | `LocalModelDiscovery` adapters                            | EXISTS |
| Budget policy, user-preference respect, smart upgrade/downgrade, "Why this model?"                                        | `ModelSelectionIntelligence`                              | EXISTS |
| Explainable provider/model routing                                                                                        | `ProviderRoutingAdvisor`                                  | EXISTS |
| Owner-scoped preferences + enabled-provider routing filter                                                                | `ProviderPreferencesStore` / `ProviderApplicationService` | EXISTS |

**Gap (EPIC-012B):** no refresh mechanism, no staleness tracking, no profile caching, no per-model lifecycle/deprecation status, no hosted provider-metadata discovery port, and routing candidates re-derived free/local from cost heuristics instead of the intelligence layer.

## 3. What was implemented

### 3.1 Safe refresh (`packages/providers`)

- **`ProviderIntelligenceRefreshService`** — `refresh(provider, previousContext?)`:
  - re-derives the profile through the frozen `ProviderIntelligenceService`;
  - runs the **provider-metadata discovery port** (fail-safe — a throwing/unavailable discovery **never fails the provider**; it stays Connected with PARTIALLY_VERIFIED intelligence and UNKNOWN fields);
  - computes the safe delta (`addedModels` / `removedModels` / `preservedModels`);
  - reports an honest verification state: **FULLY_VERIFIED** (live metadata confirmed) / **PARTIALLY_VERIFIED** (registry-declared facts, unknowns stay UNKNOWN) / **UNVERIFIED** (no known facts).
- **`staleness(profile, maxAgeMs)`** — age vs refresh policy (default 24h, injectable clock); a never-verified profile is always stale.
- **Persistent model-lifecycle ledger `knownModels`** — every model id ever seen with its verdict (`active` / `unavailable` / `deprecated`). A model that disappears upstream is marked `unavailable` (or keeps `deprecated`) and the fact **survives across refreshes** — routing keeps excluding it. A returning model becomes `active` again. User preferences are **structurally untouched** by refresh.

### 3.2 Cache + staleness (`packages/providers`)

- **`ProviderIntelligenceStore`** port + **bounded FIFO `InMemoryProviderIntelligenceStore`** (max 500, evicts oldest; keyed by providerId — owner isolation is structural, no cross-user surface).
- **`ProviderApplicationService.getIntelligenceStatus(id, maxAgeMs?)`** — **cache-first**: serves cached intelligence when fresh (the UI never re-derives on every render), re-derives + re-caches when missing/stale.
- **`refreshProviderIntelligence(id)`** — explicit safe refresh (mutation); provider deletion clears its cached intelligence.

### 3.3 Model lifecycle (`packages/providers`)

- `ModelIntelligence.lifecycleStatus` (`ModelLifecycleStatus` = active / preview / deprecated / unavailable / unknown). Present models are `active` with **INFERRED** provenance from catalog presence — never claimed as provider-verified; UNKNOWN when not stated.

### 3.4 Routing extension (no duplicate routing) (`packages/services` + `services/api`)

- `ProviderCandidateIntelligence` gains **optional** intelligence facts: `resourceType`, `freeToUse`, `unavailableModelIds` — backward compatible (deterministic fallback preserved).
- `RuntimePorts.createProviderIntelligencePort` populates them from the **same registry classification** the intelligence layer uses (`classifyResource`) + the cached **lifecycle ledger** (`knownModels`).
- `ProviderRoutingAdvisor.pickModel` **never selects unavailable/deprecated models**.
- `ModelSelectionIntelligence` uses the intelligence facts: **FREE MUST NOT BEAT QUALITY** — a free model that cannot satisfy the task is NOT eligible; a paid model does not win simply because it is paid; `FREE_API_QUOTA` shows quota-aware copy ("Free within your available quota.").
- Explicit user selections remain respected; smart upgrade/downgrade and "Why this model?" are unchanged.

### 3.5 Gateway (`services/api`)

- `providers.getIntelligenceStatus` (query) + `providers.refreshIntelligence` (mutation) — auth + rate limits + zod + the standard **IDOR guard**; wired through `ApiApplicationService` (bounded in-memory store shared with the routing ports).
- Cleared pre-existing lint debt on touched files (`exp!` non-null assertions, redundant casts, unused imports).

### 3.6 UI (`apps/web`)

- Provider rows on the main AI Providers screen open a **dedicated configuration view** (click the provider name — the model selector + enable switch stay on the main screen, exactly as before): connection status · selected model · **Model intelligence card** (verification state, "Verified X ago · Update available" staleness, one-click **Update intelligence**) · models with capability chips + lifecycle dots (Active / Preview / Deprecated / Unavailable — never colour-only) + context + pricing · Usage & quota · Pricing & limits · Advanced diagnostics (provenance, coverage, refresh policy) — progressive disclosure throughout. Error state with Retry (no raw stack traces).
- Enabled state defaults to ON (matches the main screen); detail view cannot disagree with the experience view.

## 4. Security

- **Credentials never travel through intelligence records** — test-verified (no `sk-…` / `api-key` / `bearer` patterns in serialized profiles). The registry stores no secrets; discovery receives no secrets.
- **Owner isolation structural** — the intelligence cache is keyed by providerId (platform catalog), preferences/usage stay owner-scoped.
- **IDOR test-verified** on both new procedures (foreign userId → FORBIDDEN).
- Failed discovery degrades gracefully — never a provider failure, never a fabricated verification claim.

## 5. Tests & quality gates

| Gate                                    | Result                                                                                                                                                                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| packages/providers                      | **143/143** (17 files) — +18 new (refresh, staleness w/ injectable clock, delta + ledger persistence, model reactivation, bounded FIFO, cache-first, stale re-derive, delete clears cache, credential isolation, fail-safe discovery, owner isolation) |
| packages/services routing               | **25/25** (ModelSelectionIntelligence 13 · ProviderRoutingAdvisor 12) — +3 (intelligence facts override cost heuristics, AGGREGATOR never free, fallback preserved, unavailable-model exclusion)                                                       |
| services/api ProviderIntelligenceRouter | **14/14** — +5 (status/refresh through the real tRPC pipeline, IDOR, ledger→routing exclusion via RuntimePorts)                                                                                                                                        |
| services/api router-registry            | **33/33** (all namespace procedures fire through the real pipeline — no dead handlers)                                                                                                                                                                 |
| apps/web                                | **120/120** (13 files) — unchanged, still green                                                                                                                                                                                                        |
| Typecheck                               | ✅ 0 errors — packages/providers · packages/services · services/api · apps/web                                                                                                                                                                         |
| ESLint                                  | ✅ 0 errors / 0 warnings on all changed files                                                                                                                                                                                                          |
| Coverage gate                           | 🟢 unchanged (providers ≥80% maintained)                                                                                                                                                                                                               |

## 6. Honest limitations

- **Live provider-API model discovery** (official model-list endpoints) and live refresh against real provider metadata are **operator steps** — the default is the fail-safe declared-only discovery adapter; verification is never claimed beyond what a source proved (`FULLY_VERIFIED` only when a configured source confirms the model set).
- No Postgres/Docker on this machine (unchanged from EPIC-011/012); the in-memory cache is the hermetic default (production can inject a Postgres-backed store via the intelligence infrastructure options).
- Known-models ledger is process-local with the in-memory store (same persistence horizon as the registry's in-memory test double).

## 7. Acceptance criteria

- ✅ Provider added once → VedMoulya automatically derives what models/capabilities are actually available (with provenance; UNKNOWN where absent)
- ✅ Main UI remains clean; model selector displays discovered models; explicit model selection + Auto mode intact
- ✅ Routing can explain why it selected a model; hard requirements (precision/evidence/capability) override cost
- ✅ Free/local/paid distinguished (never conflated); free never beats quality
- ✅ Safe refresh reports deltas; removed models marked unavailable/deprecated — never silently deleted; user preferences preserved
- ✅ Cached intelligence + staleness + last-verified; no metadata queries on every render
- ✅ No credential exposure in intelligence metadata; owner isolation + IDOR intact
- ✅ Existing EPIC-012A functionality and architecture preserved (verified by the retained 142/142 + 120/120 + 33/33 suites)

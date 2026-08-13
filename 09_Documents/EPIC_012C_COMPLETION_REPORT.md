# EPIC-012C — AI World Discovery, Provider Catalog & Market Intelligence

**Verdict: 🟢 GREEN — IMPLEMENTATION VERIFIED** (live ecosystem-source adapters are operator steps; every claim stays evidence-first — UNKNOWN is never fabricated)

**Date:** 2026-08-10

---

## 1. Mission

Build VedMoulya's first **AI WORLD DISCOVERY & MARKET INTELLIGENCE LAYER** — continuously answer:

> WHAT IS NEW → WHAT IS USEFUL → WHAT IS FREE → WHAT CAN RUN LOCALLY → WHAT CAN VEDMOULYA CONFIGURE → WHAT SHOULD BE IGNORED

Quality and usefulness over volume. Every discovered item carries **provenance + a confidence state**; nothing is ever fabricated, no live external service is required for the core product (deterministic curated catalog + pluggable source port), and discovery is **bounded** (source limits, request budgets, processing budgets, storage caps, refresh intervals) — never an uncontrolled crawler.

**Preserved:** the frozen EPIC-012A/012B provider experience (provider router, ModelSelector, enable/disable, configuration screen), the existing routing engine, provider intelligence/refresh services, lifecycle ledger, free-vs-quality routing policy, auth/IDOR/rate-limit/security controls — **nothing rebuilt, no second routing engine, no news dashboard**.

## 2. What was already there (verified, not rebuilt)

| Capability                                              | Source                                                    | Status |
| ------------------------------------------------------- | --------------------------------------------------------- | ------ |
| Provider management UI + scrollable model selector      | `apps/web/src/app/providers/*`                            | EXISTS |
| Provider enable/disable + configuration view            | `apps/web/src/app/providers/*`                            | EXISTS |
| Real model capability data + resource classification    | `ProviderIntelligenceService` / `ModelResourceClassifier` | EXISTS |
| Safe refresh + model lifecycle ledger                   | `ProviderIntelligenceRefreshService`                      | EXISTS |
| Provider intelligence cache/store                       | `ProviderIntelligenceStore` + bounded in-memory store     | EXISTS |
| Hosted provider metadata discovery port (fail-safe)     | `ProviderCatalogDiscoveryPort`                            | EXISTS |
| Intelligence-aware routing (FREE MUST NOT BEAT QUALITY) | `ModelSelectionIntelligence` / `ProviderRoutingAdvisor`   | EXISTS |
| Owner-scoped gateway APIs + IDOR/rate-limit/security    | `providers.*`, gateway middleware                         | EXISTS |
| AI runtime, LoopEngine, quality/evidence architecture   | `@vedmoulya/services`, `loop-engine`, `experience`        | EXISTS |

**Gap (EPIC-012C):** no discovery layer over the AI ecosystem, no pluggable source abstraction, no relevance scoring / recommendation engine, no free/local classification of discoveries, no GitHub repository intelligence, no AI World bell/panel/page, no digest, no discovery→configure flow, no tests, and no web client hooks — the `aiWorld.*` gateway namespace was **already wired** (`RouterRegistry` + `ApiApplicationService` + `AIWorldRouter`) against a domain package that had **zero tests and zero UI**.

## 3. What was implemented

### 3.1 Domain layer (`packages/ai-world` — completed + hardened)

The package already contained the domain engines (verified from source, now **tested and lint-hardened**):

- **`AIDiscoverySource` port** (pluggable sources — provider announcements, official model catalogues, GitHub, model repositories, trusted technical sources, AI products, news). The UI is never hardcoded to a website; sources return **raw facts only** — every derived field is computed by the domain engines with provenance.
- **`DiscoveryNormalizer`** — raw source → canonical `DiscoveryItem` (security scan → free/local classify → GitHub intelligence → relevance score → recommendation → stable id from source + url/title hash). Never fabricates: absent metadata stays UNKNOWN.
- **`SecurityScanner`** — treats discovered content as **untrusted input**: prompt injection, malicious links (`javascript:`/`data:`/`file:`), fake claims, deceptive pricing, unsafe install instructions, poisoned metadata — heuristic + labelled, never authoritative, never executed.
- **`FreeResourceClassifier`** — independent axes: FREE_API / FREE_WITH_QUOTA / OPEN_WEIGHTS / OPEN_SOURCE / LOCAL / SELF_HOSTABLE / PAID / UNKNOWN. "Open source" ≠ "free API"; a claim without evidence lands on UNKNOWN. **FREE never implies recommended.**
- **`GitHubRepositoryIntelligenceEngine`** — repo usefulness, NOT star-count popularity: license handling, abandonment/inactivity detection, suspicious-pattern detection, documentation quality, deployment complexity, evidence-backed flags (`abandoned` / `unclear_license` / `suspicious` / `low_documentation` / `security_concerns` / `inactive_development`) + security considerations.
- **`RelevanceScorer`** — 10-factor scoring (VedMoulya relevance, technical usefulness, quality/evidence, recency, free availability, local usability, integration potential, adoption [minor], strategic importance). A viral product is not automatically useful. **Added:** a suggested registry family earns concrete integration points (one-click configurable) — evidence-driven, so the discover→configure flow is reachable from the bell.
- **`RecommendationEngine`** — **IGNORE / WATCH / REVIEW / TRY / CONFIGURE / INTEGRATE**, in QUALITY → CAPABILITY → EVIDENCE → USABILITY → FREE/LOCAL → COST order. Security-flagged content is hard-blocked; configurable providers/models get CONFIGURE.
- **`DiscoveryOrchestrator`** — bounded daily evolution: `maxItemsPerSource` / `maxItemsPerRun` / `maxSourcesPerRun` / storage cap / refresh interval; a failing source NEVER fails the run (honest report); duplicates skipped; security-rejected items counted, never stored.
- **`DigestBuilder`** — the concise "AI WORLD — TODAY" digest (≤5 entries, recommendation-ordered, IGNORE/security-flagged excluded).
- **`DiscoveryApplicationService`** — the `aiWorld.*` contract: `getWorld` (bell view: 🔥 Important / ⭐ Recommended / 🧩 GitHub / 📰 Updates + unread badge), `getDigest`, `list`, `getItem`, `markRead`, `markAllRead`, `setAction`, `runDiscovery` (rate-limited by the refresh interval). Every per-user read/write keys on the caller's own userId — owner isolation structural.
- **`InMemoryDiscoveryStore`** — bounded FIFO retention (never an unbounded sink), owner-scoped attention state (IDOR-safe by construction).
- **`StaticCatalogDiscoverySource`** — deterministic, evidence-honest default catalog (models, providers, applications, GitHub repos, news) so the product is fully functional without live network access; live adapters are pluggable operator steps.

### 3.2 Gateway (`services/api` — already wired, now test-verified)

- `aiWorld.*` namespace: `getWorld` / `getDigest` / `list` / `getItem` / `markRead` / `markAllRead` / `setAction` (standard tier) + `runDiscovery` (heavy tier) — auth + rate limits + zod + the standard **IDOR guard**; wired through `ApiApplicationService` (bounded `InMemoryDiscoveryStore` + static catalog, auto-seed on first access).

### 3.3 Web experience (`apps/web`)

- **Dedicated AI World bell** (top-right, distinct Radar icon + unread badge) next to the existing LifeOS notifications bell — the generic notification center is **fully preserved**.
- **AI World drawer** (the bell panel): digest strip ("AI World — Today"), 🔥 Important / ⭐ Recommended / 🧩 GitHub / 📰 Updates sections (≤4 each), per-item Mark read / Watch / Dismiss / Configure Provider actions, Mark-all-read, bounded refresh (shows "Next refresh · HH:MM"), "Open AI World" footer.
- **`/ai-world` page**: header, digest card, discovery control card (last run / next refresh / Run discovery — disabled within the interval), filter tabs (All / Important / Recommended / GitHub / AI Updates / Models / Providers / Applications), full cards with evidence disclosure, GitHub intelligence, security-caution flags, and actions.
- **`DiscoveryItemCard`** (shared drawer + page): WHAT happened / WHY it matters / SHOULD I do something — in seconds. Recommendation + free/local/capability/confidence chips (text + colour, never colour alone), evidence-first, **source links only rendered for safe http(s) schemes** (untrusted input — never auto-opened).
- **`?provider=<family>` deep link** on `/providers`: "Configure Provider" opens the **existing** provider configuration view — discovery → evaluate → recommend → configure → existing intelligence refresh → existing routing, with **no duplicated configuration logic**.
- api-client hooks: `useAIWorldWorld` / `useAIWorldDigest` / `useAIWorldList` / `useAIWorldMarkRead` / `useAIWorldMarkAllRead` / `useAIWorldSetAction` / `useAIWorldRunDiscovery`.

## 4. Security

- **Discovered content is untrusted input** — the SecurityScanner flags prompt injection, malicious links, fake claims, deceptive pricing, unsafe install instructions and poisoned metadata before anything is stored; the orchestrator **rejects** injection/malicious-link items (counted, never stored); the UI only ever renders safe http(s) links.
- **Discovery NEVER executes arbitrary discovered code** — no auto-download, no auto-install, no auto-clone; GitHub repos are surfaced with flags + security considerations and require explicit user action.
- **No private user data leaves the platform** — discovery sources receive no user context; personalization uses only the platform's capability vocabulary.
- **Owner isolation structural** — per-user read/action state keys on the caller's own userId; the gateway IDOR guard refuses foreign userIds (test-verified on every procedure).
- **Bounded by design** — source limits, per-run budgets, storage caps and refresh intervals; rate-limited `runDiscovery`.

## 5. Tests & quality gates

| Gate                       | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| packages/ai-world          | **115/115** (12 files, all new) — normalization, stable ids, evidence tracking/aggregation, relevance scoring (incl. viral-but-irrelevant + configurable bonus), free/local classification (independent axes), GitHub intelligence (license/abandonment/inactivity/suspicious/docs), recommendation states, security scanning (injection/links/fake claims/deceptive pricing/unsafe instructions/poisoned metadata), dedup, digest, orchestrator budgets + fail-soft sources + security rejection, bounded store + owner isolation, application service world/digest/actions/refresh-interval rate limit, static catalog determinism |
| services/api AIWorldRouter | **7/7** — world/digest/list/getItem/markRead/markAllRead/setAction/runDiscovery through the REAL tRPC pipeline + full IDOR matrix + refresh-interval rate limit                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| services/api full suite    | **622/622** (26 files) — unchanged suites still green                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| apps/web                   | **120/120** (13 files) — unchanged, still green                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Typecheck                  | ✅ 0 errors — packages/ai-world · services/api · apps/web                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ESLint                     | ✅ 0 errors / 0 warnings on all changed files (incl. clearing pre-existing debt in the untested ai-world package: redundant `?? []`, always-true conditions, unnecessary optional chains, `require-await` on in-memory stores via the established file-level convention)                                                                                                                                                                                                                                                                                                                                                             |
| Coverage gate              | 🟢 ai-world ≥80% maintained (115/115 hermetic, deterministic — no live external services)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

## 6. Honest limitations

- **Live ecosystem discovery** (official provider announcements, live model catalogues, GitHub API, trusted news sources) is an **operator step** — the default is the deterministic evidence-honest curated catalog; live adapters plug into the `AIDiscoverySource` port. No live evidence is fabricated; live adapters must fail safe per the port contract.
- The discovery store is process-local in-memory (same persistence horizon as the other hermetic defaults; Postgres-backed stores are injectable via the port).
- No Postgres/Docker on this machine (unchanged from EPIC-011/012/012A/012B).
- Personalization currently uses the platform capability vocabulary (module-level personalization is a natural follow-up; no user data is ever exposed to sources).

## 7. Acceptance criteria

- ✅ Discovers AI models, providers, GitHub repositories, AI applications and important ecosystem changes (curated deterministic catalog + pluggable sources)
- ✅ Every item carries provenance + evidence + confidence; unknown stays UNKNOWN — never fabricated
- ✅ Free / free-with-quota / open-weights / open-source / local / self-hostable / paid / unknown classified on independent axes
- ✅ Ranked by usefulness (quality over volume; popularity is minor; free never beats quality)
- ✅ Recommendations: IGNORE / WATCH / REVIEW / TRY / CONFIGURE / INTEGRATE with plain-language reasons
- ✅ AI World bell (top-right, unread badge) opens the AI WORLD panel — not a generic notification center
- ✅ Concise daily digest — a short "AI WORLD — TODAY", not a news feed
- ✅ "Configure Provider" links discoveries into the **existing** provider configuration → existing intelligence refresh → existing routing
- ✅ Bounded discovery (source limits, budgets, storage caps, refresh intervals) + rate-limit-respecting refresh
- ✅ Discovery never executes/displays arbitrary discovered content; GitHub repos flagged + security considerations
- ✅ Owner isolation + IDOR on every procedure; all existing EPIC-012A/012B functionality preserved (622/622 gateway + 120/120 web retained)

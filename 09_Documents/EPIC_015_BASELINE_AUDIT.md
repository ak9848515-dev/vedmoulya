# EPIC-015 — VedMoulya Intelligence: Baseline Audit

> **Status:** Repository reconnaissance complete (2026-08-11).
> **Rule honoured:** _"Do not begin implementation until the baseline audit is complete."_
> This document classifies every dependency the Intelligence layer needs as
> **IMPLEMENTED / PARTIALLY_IMPLEMENTED / PLANNED / NOT_AVAILABLE** — nothing is
> assumed present, nothing is fabricated.

---

## 1. Method

Every EPIC-015 requirement was checked against the **actual repository** (source,
tests, gateway wiring, UI). Where a subsystem exists, its exact scope is recorded.
Where it does not, it is marked **NOT_AVAILABLE** and EPIC-015 must build it —
without duplicating anything already present.

---

## 2. What EXISTS and will be REUSED (never rebuilt)

### 2.1 EPIC-012C — AI World Discovery (`@vedmoulya/ai-world`) — **IMPLEMENTED**

| Capability                                                                                                                                            | Status         | Location                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------ |
| Pluggable `AIDiscoverySource` port (type/id/name/priority/freshness/`discover`)                                                                       | ✅ IMPLEMENTED | `contracts/AIDiscoverySource.ts`                                   |
| Deterministic `StaticCatalogDiscoverySource` (hermetic default)                                                                                       | ✅ IMPLEMENTED | `infrastructure/StaticCatalogDiscoverySource.ts`                   |
| `SecurityScanner` — discovered content treated as **untrusted input** (prompt-injection / poisoned-metadata / deceptive-claim protection)             | ✅ IMPLEMENTED | `domain/SecurityScanner.ts`                                        |
| `FreeResourceClassifier` — FREE_API / FREE_WITH_QUOTA / OPEN_WEIGHTS / OPEN_SOURCE / LOCAL / SELF_HOSTABLE / PAID / UNKNOWN; FREE never beats quality | ✅ IMPLEMENTED | `domain/FreeResourceClassifier.ts`                                 |
| `RelevanceScorer` — 10 weighted signals, quality over volume                                                                                          | ✅ IMPLEMENTED | `domain/RelevanceScorer.ts`                                        |
| `RecommendationEngine` — IGNORE / WATCH / REVIEW / TRY / CONFIGURE / INTEGRATE                                                                        | ✅ IMPLEMENTED | `domain/RecommendationEngine.ts`                                   |
| `DiscoveryOrchestrator` — budgets, per-source rate limits/cooldowns, dedup, never fatal                                                               | ✅ IMPLEMENTED | `domain/DiscoveryOrchestrator.ts`                                  |
| `DigestBuilder` — concise "AI WORLD — TODAY"                                                                                                          | ✅ IMPLEMENTED | `domain/DigestBuilder.ts`                                          |
| `InMemoryDiscoveryStore` — bounded FIFO, owner-scoped read/action state                                                                               | ✅ IMPLEMENTED | `infrastructure/InMemoryDiscoveryStore.ts`                         |
| `DiscoveryApplicationService` — getWorld / getDigest / list / getItem / markRead / markAllRead / setAction / runDiscovery                             | ✅ IMPLEMENTED | `application/DiscoveryApplicationService.ts`                       |
| Gateway `aiWorld.*` namespace (auth + rate limits + IDOR)                                                                                             | ✅ IMPLEMENTED | `routers/AIWorldRouter.ts`                                         |
| UI — bell + drawer (🔥/⭐/🧩/📰) + `/ai-world` page + Configure-provider deep-links                                                                   | ✅ IMPLEMENTED | `apps/web/components/ai-world/*`, `apps/web/app/ai-world/page.tsx` |

### 2.2 EPIC-012A/B — Provider Intelligence (`@vedmoulya/providers`) — **IMPLEMENTED**

- `ProviderPreferencesService` (per-user enabled providers, budget policy, `setProviderEnabled`),
  gateway `providers.*` (getPreferences / setProviderEnabled / getIntelligenceStatus /
  refreshIntelligence) behind auth + rate limits.
- Provider Intelligence Profiles with provenance (never fabricated), model resource types
  (LOCAL / FREE HOSTED / FREE API QUOTA / USER-PAID API / …), local-model + hardware-aware
  intelligence, "Why this model?" explanations, paid-approval UX.
- `/providers` page with `?configure=<family>` deep-link — **the single existing
  configuration surface** EPIC-015 must route CONFIGURE recommendations into.

### 2.3 EPIC-013 — Capability Marketplace (`@vedmoulya/capability-marketplace`) — **IMPLEMENTED**

- `CapabilitySourcePort` — `providerCandidates` / `discoveryCandidates` / `localModelCandidates`
  over provider registry + AI World + local-model discovery.
- `CapabilityPlanner` → `FactoryCapabilityPlan` (required capabilities, steps, candidates,
  evidence, risks, approval points, unavailable capabilities, recommendations).
- `CapabilityDecomposer` (outcome → ordered steps), `IntegrationClassifier` (NATIVE_API /
  DIRECT_PROVIDER / OPEN_SOURCE / LOCAL_MODEL / GITHUB_PROJECT / EXTERNAL_APPLICATION /
  MANUAL_STEP / UNKNOWN — external apps **never** assumed automatable),
  `AutomationBoundaryEngine` (FULLY/PARTIALLY/HUMAN_APPROVAL/MANUAL), `QualityFirstSelector`
  (QUALITY → EVIDENCE → USABILITY → FREE/LOCAL → COST), `ApprovalEngine`.
- Gateway `capabilityMarketplace.*` + `/capability-marketplace` page + `/applications`
  third mode.

### 2.4 EPIC-014 — Execution Bridge (`@vedmoulya/execution-bridge`) — **IMPLEMENTED**

- `mapCapability` / `isMapped` (capability → frozen runtime capability), `PlanRunResolver`
  (EXECUTABLE / APPROVAL_REQUIRED / CONFIGURE_REQUIRED / MANUAL_REQUIRED / UNAVAILABLE),
  `StepVerifier`, `ApprovalRuntime`, `PreferenceLedger` (explicit-vs-inferred, provenance),
  `RunBudgetGuard` (fail-closed), `ExecutionRunService`, `execution.*` gateway namespace +
  `ExecutionRunner` UI.

### 2.5 EPIC-006 — LoopEngine (`@vedmoulya/loop-engine`) — **IMPLEMENTED**

- `LoopEngine` (understand → decompose → specialist → critic → bounded refinement),
  `AIOrchestratorSpecialistPort` (the frozen execution seam), `CriticEvaluator`,
  `GoalUnderstandingService`, budget-bounded termination.

### 2.6 EPIC-016 — Brain (`@vedmoulya/brain`) — **IMPLEMENTED**

- `BrainApplicationService` (createTask → plan → selectResources → requestApproval/approve/
  reject → execute → verify → evaluateOutcome), `BrainPolicyEngine` (sensitive actions
  **never** self-granted), `BrainDecisionRecorder` (provenance), `OutcomeEvaluator`
  (EXPLICIT vs INFERRED learning), `ProviderRoleAssigner` (13 roles, quality-first).
- **Ports ready for EPIC-015 wiring:** `BrainCandidatePort` (provider/discovery/local
  candidates), `BrainPreferencePort` (EPIC-014 ledger), `BrainPlanPort` (EPIC-013 plan).
- Gateway `brain.*` (13 procedures) + `/brain` UI.

### 2.7 Auth & gateway conventions — **IMPLEMENTED**

- JWT (jose HS256, issuer `vedmoulya`, audience `vedmoulya-api`), Google login at the web
  layer unchanged. `assertUserIdMatchesSession` central IDOR guard.
- Procedure tiers: `publicProcedure` / `standardProcedure` / `heavyProcedure` /
  `searchProcedure` / `healthProcedure` / `authProcedure` (rate-limit tiers).
- Server-side credential pattern: **env-var keys** (`AI_OPENAI_API_KEY` …) held by the
  frozen runtime, never in the browser; `redactSecrets` on all trace/log output.
- Owner-scoped in-memory store convention (bounded FIFO) — `InMemoryBrainStores`,
  `InMemoryDiscoveryStore`, `InMemoryExecutionRunStore`, `InMemoryProviderPreferencesStore`.

---

## 3. What is MISSING — EPIC-015 must build (with explicit states)

### 3.1 GitHub authentication — **NOT_AVAILABLE**

- No GitHub App / OAuth flow exists anywhere. Google auth is for the VedMoulya account only.
- EPIC-015 must add a **separate Connect GitHub** flow (GitHub App architecture preferred),
  with: connect / see connected account / see permissions / see accessible repos /
  disconnect+revoke / refresh authorization / last-verification time.
- No GitHub token is stored anywhere today; the env-var key pattern does NOT apply to
  per-user GitHub credentials — EPIC-015 must introduce the server-side per-user
  credential store (never in browser/logs/AI prompts).
- Public-repo discovery must not require private-repo permissions; private repos require
  explicit authorization; write ops require separate permissions + separate approval.

### 3.2 GitHub repository intelligence (deep) — **PARTIALLY_IMPLEMENTED**

- ✅ EXISTS (EPIC-012C): `GitHubRepositoryIntelligenceEngine` — owner/repo name, description,
  language, stars/forks, last-commit, license + `licenseConfidence`, documentation quality,
  deployment complexity, self-hostable, flags (abandoned / unclear_license / suspicious /
  low_documentation / security_concerns / inactive_development), security considerations.
- ❌ MISSING (EPIC-015): visibility, watchers, issues, releases, commit-activity history,
  dependencies, installation method, package manager, Docker requirements, runtime
  requirements, API availability, **local-execution capability**, model requirements,
  GPU/VRAM requirements, network requirements, env vars, secrets requirements, external
  services, permissions, security advisories, verification timestamp.
- ❌ MISSING: the **controlled acquisition pipeline** — DISCOVERED → SECURITY REVIEW →
  RELEVANCE → APPROVAL → ACQUIRE → SANDBOX → ANALYZE → STORE INTELLIGENCE → OPTIONAL
  CONFIGURATION. READ vs CLONE vs EXECUTE vs INSTALL vs CONFIGURE vs USE are distinct
  actions today; none of the execute/install side exists (and must stay approval-gated).

### 3.3 Security gate / classification — **NOT_AVAILABLE** (only metadata-level)

- ✅ EXISTS: `SecurityScanner` (untrusted-content text scan) + GitHub metadata flags.
- ❌ MISSING: install/postinstall/preinstall-script inspection, shell/subprocess usage,
  arbitrary command execution, credential collection, env-var/fs/SSH/browser-credential
  access, network calls, unknown binaries, encoded scripts, dependency vulnerabilities,
  typosquatting, abandoned deps, unsigned binaries, suspicious release artifacts, Docker
  privileges, host mounts, secret exposure, outbound data transfer, dynamic downloads,
  RCE paths.
- ❌ MISSING: the **security classification** — TRUSTED / TRUSTED_WITH_REVIEW /
  SECURITY_REVIEW_REQUIRED / SUSPICIOUS / BLOCKED / UNKNOWN with attached evidence, using
  honest language ("no blocking indicators found in the checks performed" — never "safe").
- ❌ MISSING: sandbox/container isolation decision → **SECURITY_REVIEW_REQUIRED** when the
  environment cannot sandbox. No execution of untrusted code on the host (never).

### 3.4 License intelligence — **PARTIALLY_IMPLEMENTED**

- ✅ EXISTS: license presence, `licenseConfidence`, unclear-license flag, self-hostable.
- ❌ MISSING: license-type taxonomy, commercial-use restrictions, redistribution
  restrictions, attribution requirements, **model license separate from software license**,
  LICENSE_UNKNOWN as a first-class state with the "do not auto-approve commercial use" rule.

### 3.5 Free-resource limits & staleness — **PARTIALLY_IMPLEMENTED**

- ✅ EXISTS: `FreeResourceClassifier` classes + evidence + retrievedAt.
- ❌ MISSING: daily/monthly/token/request/context limits, model availability, expiration,
  regional restrictions, rate limits, current status, verification timestamp, and the
  **STALE lifecycle** (mark STALE rather than assume still-free when evidence ages).

### 3.6 Local-model intelligence (hardware) — **PARTIALLY_IMPLEMENTED**

- ✅ EXISTS: EPIC-012B local-model + hardware-aware intelligence, `LocalModelCandidateFact`
  (id/name/sizeGb/runtime/capabilities/capabilitiesProvenance/available).
- ❌ MISSING (as a full EPIC-015 matrix): RAM/VRAM/CPU/disk requirements, quantization,
  supported runtime, context length, benchmark evidence, license, privacy advantages,
  estimated local performance, installation complexity, and the "recommend local only when
  quality acceptable AND hardware suitable AND privacy/cost benefit meaningful" rule.

### 3.7 Task-specific intelligence / better-option discovery — **NOT_AVAILABLE**

- The Brain selects from **given** candidates; nothing answers _"for THIS task, is there
  something significantly better available?"_ across configured + free + local + GitHub +
  external + paid.
- ❌ MISSING: `findBestCapability(task)` / `findFreeAlternative(task)` /
  `findLocalAlternative(task)` / `findGitHubCapability(task)` / `findBetterProvider(task)` /
  `checkCapabilityFreshness(capability)` / `evaluateSecurity(resource)` /
  `evaluateLicense(resource)` / `requestUserApproval(resource)` / `getAcquisitionPlan(resource)` /
  `getFallbackPlan(task)` — the Brain-port contract EPIC-015 must provide.
- ❌ MISSING: BEST_AVAILABLE_NOW / BEST_FREE / BEST_LOCAL / BEST_LOW_COST / BEST_PAID /
  BEST_CONFIGURED result shape, with **approval recommendations** (never auto-activation).

### 3.8 User-approval recommendations & affordability — **NOT_AVAILABLE**

- ✅ EXISTS (foundation): Brain sensitive-action approval gates, EPIC-012A paid-approval UX,
  EPIC-013/014 approval engines.
- ❌ MISSING: "Better capability found" / "Useful open-source capability found" / "Free local
  model available" premium notifications with [Use Recommended] [Continue With Current]
  [Review Details] [Don't Suggest Again] / [Review & Configure] [Use Current Tools] [Ignore]
  / [Download] [Review] [Continue Current]; and the decline path — SEARCH FREE → FREE QUOTA →
  LOCAL → OPEN SOURCE → GITHUB → CURRENT CONFIGURED, producing the best achievable result
  (never task failure). One decline is never promoted to a permanent financial preference
  unless explicitly confirmed.

### 3.9 Intelligence memory / lifecycle — **NOT_AVAILABLE** (partial state only)

- ✅ EXISTS: AI World per-item read/action state; EPIC-014 preference ledger.
- ❌ MISSING: the resource lifecycle ledger — DISCOVERED → VERIFIED → SECURITY_REVIEWED →
  RECOMMENDED → USER_APPROVED → CONFIGURED → VALIDATED → ACTIVE → STALE → DEPRECATED →
  BLOCKED, with provenance and **no silent deletion** of deprecated models/providers/repos.
  Every recommendation must answer: WHY / WHAT evidence / WHEN verified / risks /
  permissions / cost / free alternative / local alternative / what happens if declined.

### 3.10 Notifications (meaningful events) — **PARTIALLY_IMPLEMENTED**

- ✅ EXISTS: the AI World bell + drawer + digest.
- ❌ MISSING: event-driven notifications for _better provider discovered · new free model ·
  free quota increased · provider unavailable/retired · useful GitHub project · security
  warning · license concern · local model suitable for current hardware · paid tool
  materially improves current task · configured provider changed capabilities_ — gated by
  relevance scoring (never one notification per ecosystem event).

### 3.11 GitHub resource detail screen — **PARTIALLY_IMPLEMENTED**

- ✅ EXISTS: `DiscoveryItemCard` github section (name/stars/forks/language/license/flags/
  first security consideration).
- ❌ MISSING: the premium detail screen — owner/organization, verified status, capabilities,
  quality bar, security status, license, activity, requirements (RAM/VRAM/OS/runtime), cost,
  automation level, evidence + verification date, and actions [Configure] [Download]
  [Open Repository] [Ignore].

### 3.12 Social/community sources — **NOT_AVAILABLE** as a concept

- No social/community source adapters exist; EPIC-015 must add them as **DISCOVERY SIGNALS
  ONLY** (never independently establishing legitimacy/security/pricing/API/model
  availability), with official sources carrying higher evidence weight.

---

## 4. Classification summary

| EPIC-015 need                                   | Status                                                   | Reuse                                         |
| ----------------------------------------------- | -------------------------------------------------------- | --------------------------------------------- |
| Discovery pipeline (DISCOVER→IDENTIFY→VERIFY→…) | 🟢 EPIC-012C orchestrator + normalizer                   | ai-world                                      |
| Pluggable sources + budgets                     | 🟢 EPIC-012C `AIDiscoverySource` + orchestrator          | ai-world                                      |
| GitHub metadata intelligence                    | 🟡 PARTIAL → extend                                      | ai-world `GitHubRepositoryIntelligenceEngine` |
| GitHub App auth + permission model              | 🔴 NOT_AVAILABLE → **build new**                         | auth middleware (IDOR guard reuse)            |
| Controlled repo acquisition + sandbox decision  | 🔴 NOT_AVAILABLE → **build new**                         | approval pattern (Brain/EPIC-014)             |
| Security gate + classification                  | 🔴 NOT_AVAILABLE → **build new**                         | SecurityScanner foundation                    |
| License intelligence                            | 🟡 PARTIAL → extend                                      | ai-world licenseConfidence                    |
| Free-resource limits + staleness                | 🟡 PARTIAL → extend                                      | FreeResourceClassifier                        |
| Local-model hardware matrix                     | 🟡 PARTIAL → extend                                      | EPIC-012B local intelligence                  |
| Quality-first selection                         | 🟢 EPIC-013 QualityFirstSelector + Brain role assigner   | capability-marketplace / brain                |
| Task-specific better-option discovery           | 🔴 NOT_AVAILABLE → **build new** on BrainCandidatePort   |
| Approval recommendations + affordability        | 🔴 NOT_AVAILABLE → **build new** on Brain approval gates |
| Intelligence memory/lifecycle                   | 🔴 NOT_AVAILABLE → **build new** (ledger pattern reuse)  |
| Notifications                                   | 🟡 PARTIAL → extend AI World bell + relevance gating     |
| GitHub detail screen                            | 🟡 PARTIAL → extend DiscoveryItemCard                    |
| Secrets never exposed / IDOR / rate limits      | 🟢 existing conventions (auth, redactSecrets, tiers)     |

---

## 5. Conclusions for the implementation plan

1. **Massive reuse surface:** discovery, evidence, security-scanning, free/local
   classification, quality-first selection, approval engines, owner-scoped stores, auth,
   rate tiers, and the Brain's candidate/preference ports are all real and green.
2. **The genuinely new build is narrow but deep:** GitHub App authentication +
   per-user GitHub credential store, the deep GitHub intelligence + acquisition pipeline,
   the security/license gates, the task-specific better-option engine, the approval
   recommendation UX, and the intelligence lifecycle ledger.
3. **Hard boundary kept:** no execution of untrusted code on the host; GitHub resources
   are EVALUATE/recommendation-only until explicit user approval (and even then only the
   documented sandboxed path); external apps never assumed automatable.
4. **Recommended phasing (like EPIC-016):**
   - Phase 0 — this audit + constitution.
   - Phase 1 — task-specific intelligence + recommendation engine over existing sources
     (wired into the Brain's ports) + intelligence lifecycle ledger.
   - Phase 2 — GitHub intelligence subsystem + security/license gates + acquisition
     pipeline (approval-gated, sandbox-decision honest).
   - Phase 3 — Connect GitHub (GitHub App) + permission model + per-user credential store.
   - Phase 4 — UI: AI World extension + GitHub detail screen + approval notifications.
   - Phase 5 — docs + tests + browser journey + final validation.

No implementation begins until the user confirms scope and phasing.

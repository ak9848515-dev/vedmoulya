# VedMoulya — Task Progress

**Updated:** 2026-08-12 (production startup & environment hardening audit — Docker/WSL verified (pgvector/pg16 + redis:7-alpine healthy), Sprint-22 real-Postgres persistence gate 4/4 PASS, production preflight fail-closed exit 1 with actionable actions, production build exit 0, CI-style production boot verified (Ready ~1.5s · health.check 200 critical-degraded · live 200 · ready 200 not_ready · cadence boot-tick fail-closed · graceful shutdown), startup.sh --dev bounded run exit 0 (health PASSED attempt 2), env templates document AI_WORLD_CADENCE_REFRESH_INTELLIGENCE, startup.sh comments corrected to the built-in loader; then EPIC-018/019/020/021/022 gap-closure sprint — all gates re-run green: frozen EI repos 123 files / 1266, persistence+ecosystem+scheduler 16 files / 155+1, gateway 34 files / 709+1 (cadence +4 EPIC-021), web 16 files / 167, scheduler benchmark 13/13, preflight dev READY, typecheck 0 (root+api+web), lint 0; closures: real bell-drawer notifications, frozen-repo sql.json() double-encoding fix, dotenv removal, EPIC-021 scheduled opportunity refresh with NEW_OPPORTUNITY notifications)** + SPRINT-023 OUTCOME INTELLIGENCE & REAL-PROBLEM EXECUTION (2026-08-12):** composition-only sprint — typed `ProblemDefinition` + deterministic `ProblemUnderstandingService` (composes `GoalUnderstandingService`, never fabricates; UNKNOWN stays UNKNOWN) + `goals.understandProblem` gateway + `/goals` "Understand a problem" panel + hermetic **12-journey outcome benchmark 30/30 PASS** (CI/release-wired) — goals 77/77, gateway 714+1 skip / 35 files, web 167/167, typecheck 0, lint 0) **+ SPRINT-024 LIVE OUTCOME VERIFICATION & REAL-RUNTIME EXECUTION (2026-08-12, 🟢 GREEN):** REAL RUNTIME ARTIFACT VERIFICATION — root-confined read-only `ArtifactReaderPort` + closed `ArtifactExpectation` vocabulary (FILE_EXISTS/FILE_ABSENT/JSON_VALID/JSON_FIELD/CSV_VALID/CALCULATION/DRY_RUN; PASS/FAIL/UNKNOWN) + deterministic `ArtifactVerifier` + production `NodeArtifactReader` (no traversal/symlink escape; honest UNKNOWN) composed INTO the existing `StepVerifier` (success only when execution contract AND real artifact both verify); honest `deriveOutcomeVerdict` refined (definitive verification FAIL → FAILED, inconclusive → UNKNOWN; 11/11 tests); **real-runtime benchmark `runtime:verification:benchmark` 12 real-artifact journeys / 36/36 PASS** (CI/release-wired); `/goals` outcome-contract strip with plain-language verdicts — brain+execution-bridge 172/172, goals 77/77, gateway 714+1 skip / 35 files, web 167/167, scheduler 13/13, SPRINT-023 journeys 30/30 (untouched), typecheck 0, lint 0) **+ SPRINT-025 CONTINUOUS LEARNING, OUTCOME MEMORY & ADAPTIVE IMPROVEMENT (2026-08-12, 🟢 GREEN — IMPLEMENTATION VERIFIED):** evidence-driven learning from completed REAL journeys with **zero new engines** — `LearningSignal` FACT/INFERENCE/UNKNOWN model + `deriveLearningSignals` · verdict-gated `BrainOutcomeMemory` (`recordLearning` — UNKNOWN/FAILED never become SUCCESS) · user-correction loop `correctLearning` (EXPLICIT > INFERRED via the existing `PreferenceLedger`) · advisory experience tie-break in `ProviderRoleAssigner` (quality-first preserved) · `/brain` learning feed with "You told me / I observed / I inferred" labels + Correct/Forget · **learning benchmark 15 journeys / 25/25 PASS** (CI-wired) — brain 152/152, gateway 716+1 / 35 files, web 167/167, SPRINT-023 30/30 + SPRINT-024 36/36 + scheduler 13/13 untouched, typecheck 0, lint 0)
**Status:** ✅ OS v1.0 FROZEN (OS-003) + APP-001 complete (🟡 COMPLETE WITH CONDITIONS) + **AI-RUNTIME-001 complete (🟡 READY WITH CONDITIONS)** + **AI-RUNTIME-002 complete (🟢 CONDITION-FREE PRODUCTION APPROVED, 2026-08-08)** + **AI-RUNTIME-003 complete (🟢 CONDITION-FREE PRODUCTION APPROVED, 2026-08-08)** + **EPIC-006 LOOP-ENGINE complete (🟢 GREEN, 2026-08-08)** + **EPIC-007 APP-FACTORY complete (🟢 GREEN, 2026-08-08)** + **EPIC-008 APP-WORKSPACE complete (🟢 GREEN, 2026-08-09)** + **EPIC-009 REQUIREMENTS-ENGINE complete (🟢 GREEN, 2026-08-09)** + **EPIC-010 APP-VISUAL complete (🟢 GREEN, 2026-08-09)** + **EPIC-011 PROD-VALIDATION complete (🟢 GREEN — IMPLEMENTATION VERIFIED / LIVE VALIDATION PENDING, 2026-08-09)** — real Vercel AI SDK + production RAG + EI-003 input optimization activated in the runtime; calibration + accuracy + provider + real-world matrix validated; orchestrated AI / loop engine delivered (Phases 0–19); AI Application Factory delivered (Phases 0–22); Real Application Workspace & Production UX delivered (persistent lifecycle, version history, 12-tab workspace, owner-scoped access); Product Intelligence & Requirements Engine delivered (Phases 0–35 — provenance-backed requirement extraction, question intelligence, safe defaults, completeness gating, product plan, approval gate, factory handoff); Adaptive Application Experience & Visual Intelligence delivered (Phases 0–23 — design system, domain-aware visual strategy, visual critic, multi-dimensional quality model, evidence-first review, targeted refinement, QUALITY center); Production Validation & Autonomous Quality delivered (Phases 0–15 — live AI runtime + AI critique verify commands that FOUND + FIXED a real Vercel-SDK-v7 `instructions` production defect, 8-app production benchmark, 16/16 hard quality gates, Chrome pixel-verified visual regression with committed baselines, failure-chaos + adversarial security re-verification) + **EPIC-012 OBSERVABILITY & CONTROL PLANE complete (🟢 GREEN — COMPLETE WITH OPERATOR ACTIVATION REQUIRED, 2026-08-10)** — ExecutionTrace spine (`@vedmoulya/core`), TelemetryPort wiring in loop/factory/experience/requirements/rag engines, AI-runtime OTel bridge, unified CostLedger + anomaly detection, application health model, `ops.*` control-plane namespace (inspect + audited control), structured incident diagnostics, configurable alerting, telemetry security audit — 595/595 gateway tests, 457 engine tests, 13 core trace tests, lint 0/0, typecheck 0 + **EPIC-012A PREMIUM EXPERIENCE + AI PROVIDER INTELLIGENCE complete (🟢 GREEN — IMPLEMENTATION VERIFIED, 2026-08-10)** — premium AI Providers screen (consolidated usage indicator, direct enable/disable, compact scrollable model selector with search/Auto/keyboard + mobile bottom-sheet, dedicated configuration screen), automatic Provider Intelligence Profiles with provenance (never fabricated), model resource types (LOCAL/FREE HOSTED/FREE API QUOTA/USER-PAID API/…), local-model + hardware-aware intelligence, precision/evidence/budget-aware selection over the EXISTING routing, "Why this model?" + paid-approval UX, human-readable AI-working stages, honest error/abstention UX + **EPIC-012B AI PROVIDER INTELLIGENCE & MODEL DISCOVERY complete (🟢 GREEN — IMPLEMENTATION VERIFIED, 2026-08-10)** — safe refresh mechanism with delta + persistent known-models lifecycle ledger, staleness/caching (24 h refresh policy), per-model deprecation status, routing extended with intelligence facts (FREE MUST NOT BEAT QUALITY), `providers.getIntelligenceStatus`/`refreshIntelligence` (owner-scoped, IDOR refused) — providers 143/143 tests (18 new), routing + gateway + web suites green, lint 0/0, typecheck 0 + **EPIC-012C AI WORLD DISCOVERY & MARKET INTELLIGENCE complete (🟢 GREEN — IMPLEMENTATION VERIFIED, 2026-08-10)** — new `@vedmoulya/ai-world` workspace (pluggable `AIDiscoverySource` port + deterministic static catalog, evidence-first `DiscoveryItem` with UNKNOWN honesty, 10-signal `RelevanceScorer` with one-click-configurable bonus, `FreeResourceClassifier` FREE API/FREE WITH QUOTA/OPEN WEIGHTS/OPEN SOURCE/LOCAL/SELF HOSTABLE/PAID/UNKNOWN — FREE never beats QUALITY, `GitHubRepositoryIntelligence` with abandoned/unclear-license/suspicious flags, IGNORE→INTEGRATE recommendation engine, bounded `DiscoveryOrchestrator` with budgets + rate-limit cooldowns, concise today-digest, `SecurityScanner` treating discovered content as untrusted input), gateway `aiWorld.*` namespace (getWorld/getDigest/list/getItem/markRead/markAllRead/setAction/runDiscovery — owner-scoped, IDOR refused, bounded FIFO store), dedicated AI World bell + drawer (🔥 Important / ⭐ Recommended / 🧩 GitHub / 📰 Updates) + `/ai-world` page with filters + evidence + Run discovery, Discovery→Configure Provider deep-links into the existing `/providers?configure=` flow — ai-world 115/115 tests (122 new total incl. gateway AIWorldRouter 7/7), gateway full suite 622/622, web 120/120, typecheck 0, lint clean + **EPIC-013 CAPABILITY MARKETPLACE & FACTORY INTELLIGENCE complete (🟢 GREEN — IMPLEMENTATION VERIFIED, 2026-08-10)** — new `@vedmoulya/capability-marketplace` workspace (types → contracts → domain → infrastructure → application): 20+ capability graph (TEXT_GENERATION/REASONING/CODING/RESEARCH/RAG/VISION/IMAGE/VIDEO/AUDIO/TTS/STT/MUSIC/AVATAR/TRANSLATION/DOCUMENT_PROCESSING/EMBEDDINGS/WEB_RESEARCH/BROWSER_AUTOMATION/CODE_EXECUTION/DEPLOYMENT — never assumed API-executable), outcome→step `CapabilityDecomposer` (the spec's 10-step video pipeline), `IntegrationClassifier` (NATIVE_API/DIRECT_PROVIDER/OPEN_SOURCE/LOCAL_MODEL/GITHUB_PROJECT/EXTERNAL_APPLICATION/MANUAL_STEP/UNKNOWN with evidence-derived apiAvailable — external apps never assumed automatable), READY/CONFIGURE/EVALUATE/EXTERNAL/MANUAL/UNAVAILABLE/UNKNOWN candidate classes, `AutomationBoundaryEngine` (FULLY/PARTIALLY/HUMAN_APPROVAL/MANUAL — no fake full automation, irreversible actions gate approval), `QualityFirstSelector` (QUALITY → EVIDENCE → USABILITY → FREE/LOCAL → COST — cheapest never wins), `ApprovalEngine` (publish/send/deploy/purchase/delete/share), `CapabilityPlanner` assembling the `FactoryCapabilityPlan` (evidence, risks, approval points, unavailable capabilities, cost/time only when evidence exists), configuration bridge (CONFIGURE_PROVIDER/EVALUATE_LOCAL_MODEL/REVIEW_EXTERNAL_TOOL deep-links into existing systems — no duplicated screens), gateway `capabilityMarketplace.*` namespace (plan/getPlan/listPlans/capabilities — owner-scoped, IDOR refused, bounded FIFO plan store), `/capability-marketplace` page + `/applications` "Capability Plan" third mode + api-client hooks — capability-marketplace 52/52 tests (8 files), gateway +5 `CapabilityMarketplaceRouter.test.ts` (full suite 627/627 / 27 files), web 120/120, typecheck 0, lint clean + **EPIC-014 CAPABILITY-EXECUTION complete (🟢 GREEN — IMPLEMENTATION VERIFIED, 2026-08-10)** — execution-bridge 23/23, gateway 634/634, web 120/120, browser journey PASSED, execution benchmark 8/8 + **EPIC-016 VEDMOULYA BRAIN complete (🟢 GREEN — IMPLEMENTATION VERIFIED, 2026-08-11)** — brain 82/82, gateway BrainRouter 7/7, web 146/146, browser journey PASSED, brain benchmark 12/12 + **EPIC-015 VEDMOULYA INTELLIGENCE complete (🟢 GREEN — IMPLEMENTATION VERIFIED, 2026-08-11)** — ecosystem-intelligence 93/93, gateway router 12/12 (full 653/653), web 159/159, browser journey PASSED, intelligence benchmark 12/12 + **EPIC-017 LIVE INTELLIGENCE BRIDGE complete (🟢 GREEN — IMPLEMENTATION VERIFIED, 2026-08-11)** — live-intelligence-bridge 45/45, gateway LiveIntelligenceBridgeRouter 7/7 (full 660/660 / 31 files), web 159/159, browser journey PASSED, bridge benchmark 10/10, full-repo lint 0/0 + **EPIC-018 STARTUP & ENVIRONMENT RELIABILITY complete (🟢 GREEN — IMPLEMENTATION VERIFIED, 2026-08-11)** — preflight engine (`@vedmoulya/core` additive) + `npm run preflight` CLI + `scripts/startup.sh` rewritten (tsx validation replacing the broken `node -e require(...)` ERR_MODULE_NOT_FOUND path, env loading via `process.loadEnvFile`, Docker/build/DB detection, DEV vs PRODUCTION, actionable WHAT/WHY/REQUIRED/CONTINUES/ACTION failures) — preflight tests 20/20, full core 273/273, full repo 619 files / 7,756 tests / 0 failures, `startup.sh --dev` verified end-to-end, provider classification honest (OpenAI REGISTERED/EXECUTABLE; DeepSeek REGISTERED/EXECUTABLE via Vercel-AI-SDK createOpenAI adapter; Anthropic/Google/OpenRouter/Ollama TAXONOMY ONLY — no adapters added) + **EPIC-019 STARTUP/ENVIRONMENT/PROVIDER-RUNTIME HARDENING complete (🟢 GREEN — IMPLEMENTATION VERIFIED, 2026-08-12)** — one canonical startup strategy (`scripts/lib/probes.ts` shared by startup.sh/preflight/doctor/check-port) · provider runtime registry as single source of truth (CONFIGURED/NOT_CONFIGURED/UNSUPPORTED_RUNTIME/MOCK/DISABLED/ERROR — config + production validator + registration agree) · `npm run doctor` CLI (PASS/FAIL rows, no secrets) · port-conflict handling in startup.sh (menu or `--ci` deterministic) · `--port/--timeout/--ci` flags + bounded health check + process-tree cleanup · `npm run verify` (bounded + ANSI-free NO_COLOR) · DeepSeek fully wired via Vercel-AI-SDK adapter (live = operator step) · Anthropic/Google/OpenRouter/Ollama catalog-only UNSUPPORTED_RUNTIME · dev boots with zero AI keys (mock), production fail-closed (no silent mock) + **EPIC-018 AI WORLD SCHEDULER RUNTIME CLOSURE complete (🟢 GREEN — IMPLEMENTATION VERIFIED, 2026-08-12)** — the audit found `scheduler.tick()` had no runtime caller; the new `SchedulerCadenceDriver` (`services/api/src/observability/scheduler-cadence.ts`, os-health-scheduler pattern) gives it a real periodic caller (default 10 min, `AI_WORLD_CADENCE_ENABLED` / `AI_WORLD_CADENCE_INTERVAL_MS`): no overlapping ticks · unref'd interval · graceful stop · per-user error isolation · honest abort when the identity directory is unavailable · bounded user enumeration from the EXISTING identity service · wall-clock fail-closed truncation · aggregate-only logs (no secrets) · implements NO scheduling policy (due-ness/cooldowns/rate limits/budgets stay in DiscoveryScheduler + RunBudgetGuard over the frozen LoopBudget — exactly one scheduler, one budget engine). Gateway `aiWorldScheduler.getRuntimeStatus` (auth + rate tier + IDOR) + honest runtime indicator in the `/ai-world` Discovery Activity panel. Validation: driver tests 13/13 · SchedulerRouter+registry 45/45 · full gateway 702/702 / 33 files · web 166/166 · scheduler benchmark 13/13 PASS · typecheck 0 (root + web) · lint 0 · real Chrome journey PASSED (server log proves the boot tick + fail-closed). Honest: live discovery sources + Postgres schedule persistence (restart resets — not claimed) = operator steps; generic notifications drawer = future UI sprint. Docs: `09_Documents/EPIC_018_SCHEDULER_{COMPLETION_REPORT,EVIDENCE}.md` + MASTER_ROADMAP numbering note (EPIC-018 label shared with the startup epic — distinct files preserved) **+ SPRINT-025 CONTINUOUS LEARNING, OUTCOME MEMORY & ADAPTIVE IMPROVEMENT complete (🟢 GREEN — IMPLEMENTATION VERIFIED, 2026-08-12)** — evidence-driven learning from completed REAL problem-solving journeys with **zero new engines** (no new brain/memory/recommendation/decision/budget/scheduler/notification/provider-selection/execution engine): `LearningSignal` FACT/INFERENCE/UNKNOWN model + deterministic `deriveLearningSignals` (one observation never promoted to a permanent user belief) · `BrainOutcomeMemory` enriched with verdict/verification/signals/corrections + `recordLearning` derives the honest verdict (`deriveOutcomeVerdict` — UNKNOWN/FAILED never become SUCCESS; memory pollution prevented) · user-correction loop `correctLearning` (EXPLICIT user facts written to the existing `PreferenceLedger` with source/confidence/evidence/timestamp — stronger than any inferred preference; additive `explicit_user_correction` source) · advisory experience tie-break in `ProviderRoleAssigner` (quality-first preserved, never overrides security/approval/budget) · gateway `brain.correctLearning` (auth + rate tier + IDOR) + `/brain` learning feed with plain-language "You told me / I observed / I inferred" labels + confidence + Correct/Forget · **learning benchmark 15 real-architecture journeys / 25/25 PASS** (`npm run learning:benchmark`, wired into `benchmarks` + CI + release — through the real `BrainApplicationService` + real stores + real ledger decay). Validation: brain **152/152** · gateway **716 + 1 skip / 35 files** (BrainRouter correctLearning test) · web **167/167** · scheduler **13/13** · SPRINT-023 journeys **30/30** · SPRINT-024 runtime **36/36** (both untouched) · learning benchmark **25/25** · typecheck **0** (root + api + web) · full-repo lint **0**. Honest: live-provider execution + Postgres persistence for learning stores remain operator steps. Docs: `09_Documents/SPRINT-025_{BASELINE_AUDIT,EVIDENCE,COMPLETION_REPORT}.md`; MASTER_ROADMAP / PROJECT_STATUS / CHANGELOG / README / task_progress synchronized.

---

## Current State (2026-08-11)

- **Repository:** v1.0.0 baseline + CERT-002 certification-fix working tree + EI-007…EI-010 + OS-001 + OS-002/OS-003 freeze + APP-001 application-platform layer + **EPIC-006 LOOP-ENGINE** + **EPIC-007 APP-FACTORY** + **EPIC-008 APP-WORKSPACE** + **EPIC-009 REQUIREMENTS-ENGINE** + **EPIC-010 APP-VISUAL** + **EPIC-011 PROD-VALIDATION** + **EPIC-012 OBSERVABILITY & CONTROL PLANE** + **EPIC-012A/B PROVIDER-EXPERIENCE & DISCOVERY** + **EPIC-012C AI-WORLD** + **EPIC-013 CAPABILITY-MARKETPLACE**
- **Workspaces:** 43 (1 app, 29 packages, 13 services) — `@vedmoulya/context-fabric` (APP-001) + `@vedmoulya/loop-engine` (EPIC-006) + `@vedmoulya/app-factory` (EPIC-007) + `@vedmoulya/requirements` (EPIC-009) + `@vedmoulya/experience` (EPIC-010) + `@vedmoulya/ai-world` (EPIC-012C) + `@vedmoulya/capability-marketplace` (EPIC-013) added; EPIC-011 adds NO workspace (production validation sprint — verify/benchmark scripts + e2e spec only)
- **Tests:** full workspace suite green, exit 0 — **524 files / 6 711 tests** (final run 2026-08-08, EPIC-006); loop-engine 13 files / 106 tests; **app-factory 16 files / 108 tests**; **requirements 8 files / 95 tests** (EPIC-009 — intent + extraction provenance, graph, ambiguity, question ranking/bundling, safe defaults, completeness gating, conflict detection, brief/journeys/design, strategy engines, review/change-impact/traceability/versioning, pipeline, application service, isolation); **gateway +5 `RequirementsLifecycleRouter.test.ts`** (start→answer→plan→approve→handoffGoal→handoffToFactory→changeImpact + cross-user refusal) (EPIC-008 adds `FactoryPersistenceLifecycle.test.ts` — persistence roundtrip, restart survival, ownership denial, lifecycle policy, delete confirm, version history; `PostgresApplicationRepository.test.ts` + `InMemoryApplicationRepository.test.ts`; `RepairLoop.test.ts` — bounded 6-attempt loop); **gateway 19 files / 549 tests** (EPIC-008 adds `FactoryLifecycleRouter.test.ts` — create→rename→archive→resume→history→delete + cross-user ownership refusal; `ProductionEngineWiring.test.ts` +2 for the registry dev/test in-memory fallback; EPIC-010 adds `ExperienceLifecycleRouter.test.ts` — build→evaluate→findings→refine + cross-user refusal, a router coverage walker firing every namespace procedure through the real pipeline with schema-generated full + minimal-optional inputs, and a `getAppRouter` lazy-singleton test); **experience 3 files / 36 tests** (EPIC-010 — design system, visual critic, quality model, targeted refinement, change impact, traceability, benchmark); **browser journey `apps/web/e2e/applications-journey.spec.ts` 2/2 in Chrome** (real-user ABAP Debugger journey — login → create → Plan → approve → build → READY → Tests PASS → Files → Diff → Deploy locally; reload persistence); **EPIC-012 adds core tracing 13 tests / 1 file, `OpsControlPlane.test.ts` (22), `AlertEngine.test.ts`, `ObservabilityWiring.test.ts` (E2E — real journey reconstructed from one trace) — gateway now 23 files / 595 tests**; **EPIC-012C adds `AIWorldRouter.test.ts` (7) — gateway 26 files / 622 tests**; **EPIC-013 adds `@vedmoulya/capability-marketplace` 52 tests / 8 files (decomposition, integration classification, automation boundary, quality-first selection, approval engine, planner incl. cost-estimate + unavailable-capability regressions, bounded store, application service + IDOR) + `CapabilityMarketplaceRouter.test.ts` (5 — plan/getPlan/listPlans/capabilities through the real tRPC pipeline + cross-user IDOR refusal) — gateway now 27 files / 627 tests**
- **Coverage:** gate 🟢 **34/34 workspaces ≥80%** — AI-RUNTIME-002 raised `packages/rag` 71.42→80.27%, `packages/services` 79.56→80.28%, `services/orchestrator` 79.8→88.46% branches; context-fabric 93.17% stmts · 81.14% branches · 97.08% funcs; **loop-engine 93.93% stmts · 82.6% branches · 95.83% funcs · 94.02% lines**; **app-factory 93.13% stmts · 80.83% branches · 95.94% funcs · 94.96% lines**; **experience 95.19% stmts · 80.34% branches · 97.56% funcs · 96.64% lines**; **gateway (services/api) 95.77% stmts · 80.61% branches · 97.8% funcs · 96.42% lines** (measured 2026-08-09 at EPIC-010 — the gateway coverage walker fires every namespace procedure through the real pipeline with schema-generated full + minimal-optional inputs; all ≥80%)
- **Known gate:** `storybook build` exits 1 — pre-existing upstream #32301 (Next 15.5.x bundled webpack × Storybook 8.6), reproduced without APP-001 code; fix requires changing frozen dependency versions
- **EPIC-014 CAPABILITY-EXECUTION — PLAN → EXECUTE → VERIFY** 🟢 **GREEN — IMPLEMENTATION VERIFIED** (2026-08-10) — new workspace **`@vedmoulya/execution-bridge`** executing EPIC-013 `FactoryCapabilityPlan`s with **no fabricated execution, no silent provider replacement, no budget/approval bypass, no false COMPLETED, no IDOR**: `PlanRunResolver` (EXECUTABLE / APPROVAL_REQUIRED / CONFIGURE_REQUIRED / MANUAL_REQUIRED / UNAVAILABLE) · `StepVerifier` (execution contract: execution + expected output + validation = success) · `ApprovalRuntime` (irreversible/gated steps pause at WAITING_FOR_APPROVAL; approve resumes, reject → honest PARTIAL) · `RunBudgetGuard` over the frozen `LoopBudget` (fail-closed; iterations survive resume) · `PreferenceLedger` (explicit-vs-inferred, provenance, feeds EPIC-015) · `execution.*` tRPC namespace + `ExecutionRunner` UI in `/capability-marketplace` (step timeline · approval prompt · manual hand-off · progressive disclosure). Validation: **23/23** package tests, gateway **634/634**, web **120/120**, **browser journey PASSED** (real Chrome), execution benchmark **8/8 PASS** (in `benchmarks` chain), typecheck 0, ESLint 0/0. Honest: live provider execution is an operator step, external apps stay manual hand-offs, GitHub EVALUATE-only, in-memory run store. See `09_Documents/EPIC_014_COMPLETION_REPORT.md`.
- **EPIC-016 VEDMOULYA BRAIN — PHASE 0+1: CONSTITUTION, BASELINE & CORE ARCHITECTURE** 🟢 **GREEN — IMPLEMENTATION VERIFIED** (2026-08-11) — new workspace **`@vedmoulya/brain`**: the central intelligence & orchestration coordinator — UNDERSTAND → REPRESENT → DECIDE → EXPLAIN → SELECT → PLAN with **narrow ports to the frozen estate** (nothing rebuilt): `IntentInterpreter` (UNKNOWN stays UNKNOWN, bounded assumptions, material ambiguity surfaced) · `BrainModeSelector` (FAST/BALANCED/QUALITY/DEEP_RESEARCH/COST_SENSITIVE/PRIVATE_LOCAL) · `ProviderRoleAssigner` (13 roles · quality-first · free-wins-when-sufficient · local fallback · no-candidates → error, never faked) · `ParallelPlanner` (execution-graph waves) · `ConflictDetector` (AGREEMENT…UNRESOLVED) · `OutputAssembler` (provenance-preserving synthesis) · `BrainBudgetGuard` (fail-closed: estimate/check-before/check-during) · `BrainPolicyEngine` (sensitive actions NEVER self-granted — publish/send/deploy/… require explicit approval) · `BrainDecisionRecorder` (decision · reason · alternatives · selected · confidence · provenance) · `OutcomeEvaluator` (EXPLICIT vs INFERRED learning — never silently promoted) · owner-scoped `InMemoryBrainTaskStore`/`InMemoryBrainDecisionStore`. Gateway `brain.*` namespace (**13 procedures** — createTask/plan/selectResources/execute/verify/requestApproval/approve/reject/getStatus/listTasks/getDecisionRecords/cancel/evaluateOutcome) behind auth + rate tiers + central `assertUserIdMatchesSession` IDOR guard; `BrainPorts.ts` reuses EPIC-013 plan · EPIC-012A/B candidates · EPIC-012C AI World · EPIC-006 LoopEngine specialist execution · EPIC-014 preference ledger. **`/brain` premium UI** (task input + examples · full-chain Run + per-stage Continue · stage rail · intent panel · N-provider role cards · approval gates + request-affordance · honest hand-offs (missing-capabilities, no-runtime-path) · verification checklist · synthesized result with provenance · decision records · budget/trace/history). Validation: **brain 82/82** (incl. journey-driven regression: decision records now carried on the task), gateway **BrainRouter 7/7** (full suite retained), web **146/146**, **browser journey PASSED** (real Chrome — full pipeline + approval gate + decision records), **brain benchmark 12/12 PASS** (`npm run brain:benchmark` — single vs routed LoopEngine vs brain N-provider; wired into `benchmarks` chain + CI), typecheck 0, ESLint 0/0. Honest: live provider execution is an operator step; GitHub/external-app acquisition is EPIC-015 (ports ready, not built here); in-memory stores (documented operator step). See `09_Documents/EPIC_016_COMPLETION_REPORT.md`.
- **EPIC-015 VEDMOULYA INTELLIGENCE** 🟢 **GREEN — IMPLEMENTATION VERIFIED** (2026-08-11) — new workspace **`@vedmoulya/ecosystem-intelligence`** answers **"For THIS task, is something significantly better available?"** across configured providers, free providers, local models, GitHub projects and paid providers — **DISCOVERY + EVIDENCE + SECURITY + LICENSE + FRESHNESS, never a static directory**. Domain: `GitHubConnectionManager` (GitHub separate from Google auth; least-privilege `public_metadata` baseline; repo read explicit; write consent separate — never silent) · `SecurityAssessor` (20+ evidence-backed checks; BLOCKED stops the pipeline; sandbox-enforced; honest "no blocking indicators" wording) · `LicenseEngine` (software + model license separately; LICENSE_UNKNOWN first-class) · `FreeResourceIntelligence` (quota ≠ free; stale → STALE) · `AcquisitionPlanner` (controlled repo pipeline; READ ≠ CLONE ≠ EXECUTE ≠ INSTALL ≠ CONFIGURE ≠ USE) · `TaskIntelligenceEngine` (quality-first, margin 8; better option → recommendation, never auto-activation) · `RecommendationAssembler` (premium approval cards) · `LifecycleLedger` (DISCOVERED→…→BLOCKED with provenance) · `NotificationGate` (relevance-gated). **Narrow seams reuse the frozen estate** — Brain's `BrainCandidatePort` (ONE candidate seam) + `BrainPreferencePort` (EPIC-014) + `GitHubAuthPort`/`GitHubRepoSourcePort`. Gateway **`github.*` + `ecosystemIntelligence.*` (25 procedures)** behind auth + rate tiers + dual IDOR guard. **`/ecosystem-intelligence` premium UI** (Task Intelligence + GitHub Connect permission review + Repository acquisition + Intelligence Memory). Validation: package **93/93** (coverage gates pass), gateway router **12/12** (full suite **653/653**), web **159/159** (+13 UI-helper tests), **browser journey PASSED** (`ecosystem-intelligence.spec.ts`), **intelligence benchmark 12/12 PASS** (`npm run intelligence:benchmark`, wired into `benchmarks` chain + CI + release), typecheck 0, ESLint 0/0. Honest: live GitHub App exchange / live discovery / real repo scanning are **operator steps**; repo cloning/install/execution **not built by design**. See `09_Documents/EPIC_015_COMPLETION_REPORT.md`.
- **EPIC-017 LIVE INTELLIGENCE BRIDGE** 🟢 **GREEN — IMPLEMENTATION VERIFIED** (2026-08-11) — the **INTEGRATION epic** that closes the loop between the EPIC-016 Brain, the EPIC-015 Intelligence layer and the frozen execution ecosystem — **USER TASK → BRAIN UNDERSTAND → CAPABILITY DISCOVERY → PROVIDER/MODEL INTELLIGENCE → ECOSYSTEM INTELLIGENCE → SECURITY/LICENSE/AVAILABILITY → QUALITY EVALUATION → CURRENT VS BETTER → RECOMMENDATION → APPROVAL → CONFIGURATION/HAND-OFF → VALIDATION → EPIC-014 EXECUTION → VERIFY → EVALUATE → PREFERENCE FEEDBACK**. New workspace **`@vedmoulya/live-intelligence-bridge`** — **no duplicated intelligence/execution/approval/security/memory/routing engine**; every capability consumed through the existing narrow ports. Delivered: the **intelligence bridge** (provider/model/GitHub/local/free/paid/external/alternative candidates with structured evidence — `qualityEvidence` · `taskFit` · `securityStatus` · `availability` · `costClass` · `freeTierStatus` · `localAvailability` · `confidence` · `recommendation` · `approvalRequired`; UNKNOWN first-class, never fabricated); **find-better-capability** (current vs alternatives with structured decision evidence — never hidden chain-of-thought; **quality always above cost/free preference**); **multi-provider orchestration reuse** (ProviderRoleAssigner / ParallelPlanner / ConflictDetector / OutputAssembler / CriticStrategy / BrainBudgetGuard reused, never rebuilt); **free/local/GitHub/paid decisions** (FREE ≠ BEST · LOCAL ≠ BEST · GITHUB ≠ TRUSTED · PAID ≠ BEST; paid/materially-better options require evidence-backed approval cards); **GitHub intelligence connection (safe)** (Google ≠ GitHub auth, least privilege, repository lifecycle preserved, no secrets in UI/prompts/logs); **approval bridge** (Brain recommends → policy decides → user approves → execution performs); **configuration bridge** (deep-links into EXISTING provider/local/GitHub surfaces — no duplicate screens); **execution bridge to EPIC-014** (RunBudgetGuard / LoopEngine / ValidationPipeline / ApprovalEngine / CostLedger reused, fail-closed); **result evaluation** (structured outcome evidence only); **preference/performance feedback** (task-specific, evidence-based, time-aware, reversible — EXPLICIT vs INFERRED); **AI World notifications** (materially relevant events only via the existing bell). Gateway `liveIntelligence.*` **7 procedures** (start · discover · compare · recommend · approve · execute · evaluate) behind auth + rate tiers + central IDOR guard; `LiveIntelligenceBridgePorts.ts` wires the frozen estate with zero duplication. **`/live-intelligence` premium UI** (stage rail Understand → Discover → Compare → Recommend → Approve → Hand-off → Execute → Verify → Evaluate → Feedback · candidate cards with evidence chips · better-option approval cards · honest no-better branch · execution summary · structured feedback). Validation: bridge **45/45**, gateway **LiveIntelligenceBridgeRouter 7/7** (full gateway **660/660 / 31 files**), web **159/159**, **browser journey PASSED** (`live-intelligence-bridge.spec.ts`), **bridge benchmark 10/10 PASS** (`npm run bridge:benchmark` — wired into `benchmarks` chain + CI + release), **full-repo lint 0/0** (incl. eliminating pre-existing working-tree debt in providers package / ModelSelector / settings / e2e), typecheck 0. Honest: live provider execution, live GitHub OAuth exchange, live ecosystem discovery and real repository scanning are **operator steps** (deterministic adapters hermetic default; no fabricated live claims); external apps stay honest manual/configuration hand-offs; in-memory bridge stores (Postgres = documented operator step). See `09_Documents/EPIC_017_COMPLETION_REPORT.md`.
- **EPIC-018 STARTUP & ENVIRONMENT RELIABILITY** 🟢 **GREEN — IMPLEMENTATION VERIFIED** (2026-08-11) — the startup epic that makes VedMoulya reliably start, diagnose itself and degrade gracefully. **Preflight engine** (`packages/core/src/startup/preflight.ts` — pure + injectable, exported from the barrel) + **CLI** (`scripts/preflight.ts`; `npm run preflight` / `--mode production`): checks environment · authentication (`AUTH_JWT_SECRET`) · database · redis · AI configuration · provider registry · production build · Docker; statuses READY/DEGRADED/BLOCKED/MISCONFIGURED/DEPENDENCY_UNAVAILABLE/NOT_CONFIGURED; exit 0/1/2; **never prints secrets** (dedicated leak test). **`scripts/startup.sh` fixed** — the plain-Node `require('@vedmoulya/core').getConfig()` `ERR_MODULE_NOT_FOUND` (package exports point at TS source) is replaced by the repository's **tsx** runtime via the preflight; loads the environment (root `.env.local`, then `apps/web/.env.local` in development), builds the web app when `.next/BUILD_ID` is missing, starts Docker Compose infra only when Docker is available (dev continues in-memory with a warning; production BLOCKED with instructions). **Environment model** — one authoritative loader (`process.loadEnvFile`; no dotenv); root `.env.local` investigated and NOT auto-created. **Provider classification (honest)** — OpenAI REGISTERED/EXECUTABLE/VERIFIED; DeepSeek REGISTERED/EXECUTABLE (`DeepSeekProvider` via Vercel AI SDK `createOpenAI` → `https://api.deepseek.com`, 16/16 deterministic tests, `AI_DEFAULT_PROVIDER=deepseek` + `AI_DEEPSEEK_API_KEY`; live execution = operator step); Mock registered in dev / explicit opt-in in prod; Anthropic/Google/OpenRouter/Ollama TAXONOMY ONLY (no adapters added). Validation: preflight **20/20**, full core **273/273**, full repo **619 files / 7,756 tests / 0 failures**, core typecheck 0, dev preflight exit 0 (READY), prod preflight exit 1 (BLOCKED + resolutions), `bash scripts/startup.sh --dev` verified end-to-end (preflight → Docker warning → dev server on :3000), `npm run dev` HTTP 200 + health.check OK. Docs: `09_Documents/EPIC_018_{STARTUP_ARCHITECTURE,ENVIRONMENT_MODEL,PREFLIGHT,SECURITY,EVIDENCE,COMPLETION_REPORT}.md` (scheduler security preserved as `EPIC_018_SCHEDULER_SECURITY.md`); MASTER_ROADMAP / PROJECT_STATUS / README / CHANGELOG / task_progress synchronized.
- **EPIC-019 PLATFORM STARTUP, ENVIRONMENT & PROVIDER RUNTIME HARDENING** 🟢 **GREEN — IMPLEMENTATION VERIFIED** (2026-08-12) — adds **no product features**: one canonical startup/environment strategy (`scripts/lib/probes.ts` — shared by `startup.sh`/preflight/doctor/check-port; tsx runtime, `process.loadEnvFile`, dev/test root `.env.local` → `apps/web/.env.local`, production root-only, shell vars win, secrets never printed); provider runtime registry (`packages/core/src/startup/provider-runtime.ts`) as the single source of truth with **CONFIGURED / AVAILABLE / NOT_CONFIGURED / UNSUPPORTED_RUNTIME / MOCK / DISABLED / ERROR** — `getConfig` + `validateProductionAIConfig` + `registerPlatformProviders` (contract test) all agree; **DeepSeek fully wired** (Vercel AI SDK `createOpenAI` → `https://api.deepseek.com`, registers when `AI_DEEPSEEK_API_KEY` set, valid prod default, live = operator step); Anthropic/Google/OpenRouter/Ollama **catalog-only (`UNSUPPORTED_RUNTIME`)**; **`npm run doctor`** CLI (`scripts/doctor.ts` — Environment/Node/npm/TS runtime/Database/Redis/Docker/Web build/AI runtime/Default provider/Provider adapters/taxonomy/Port/Configuration, PASS/FAIL/NOT_REQUIRED/WARN/INFO, exit 0/1, never prints secrets); **port conflicts never silent** in `startup.sh` (owner PID + menu [1] stop [2] another port [3] cancel, `--ci` deterministic; new `--port/--timeout/--ci` flags); **bounded + clean** (bounded health check `/api/trpc/health.check`, process-tree cleanup trap, `timeout` on docker compose); **`npm run verify`** (`scripts/verify.sh` — bounded + ANSI-free `NO_COLOR=1 FORCE_COLOR=0 CI=1 TERM=dumb`); dev boots with **zero AI credentials** (mock), production stays **fail-closed** (no silent mock). Evidence: `09_Documents/EPIC_019_{PROVIDER_RUNTIME_MATRIX,COMPLETION_REPORT}.md`.
- **EPIC-020 OUTCOME & REVENUE INTELLIGENCE** 🟢 **GREEN — IMPLEMENTATION VERIFIED** (2026-08-12) — outcome-first additive layer on the existing EPIC-020 (audited + verified first; one genuine defect fixed: `ProvidersRouter.getRuntimeStatus` lint). New `@vedmoulya/brain` components: `outcome-types.ts` (generic Outcome model: OutcomeType×14, Priority, Constraint, Status, Value, Evidence, Effort) · `OutcomePriorityEngine` (transparent hierarchy ranker — quality/evidence/money/time dominate cost; UNKNOWN contributes zero; quality never outranked by price) · `DailyOutcomeEngine` (Today's Top N from tasks+opportunities+events). Money intelligence: `Opportunity` gains evidence-only fields (requiredCapabilities/requiredProviders/estimatedEffort/cost/risk/approvalRequirement/recommendedNextAction; TRUSTED_WITH_REVIEW → review requirement). Satisfaction loop: `evaluateOutcome` now records YES/PARTIALLY/NO → `OutcomeEvaluation.satisfaction` + `BrainOutcomeMemory.satisfaction` (explicit, never silent). Gateway `brain.dailyPriorities` (+IDOR-guarded) + satisfaction input; `/brain` gains "Today's most valuable actions" panel + 3-value satisfaction buttons. Validation: brain **111/111**, gateway **683/683** (BrainRouter **17/17**), web **165/165**, typecheck 0, lint 0, **outcome-intelligence benchmark 23/23 PASS** (wired into `benchmarks`+CI+release), browser journeys PASSED (outcome-intelligence + continuous-intelligence regression). Honest: live execution/persistence remain operator steps; Outcome store in-memory (Postgres = operator). Docs: `09_Documents/EPIC_020_{OUTCOME_INTELLIGENCE_ARCHITECTURE,VALUE_MODEL,MONEY_INTELLIGENCE,OUTCOME_SECURITY,OUTCOME_EVIDENCE,OUTCOME_COMPLETION_REPORT}.md`.
- **SPRINT-022 PERSISTENT INTELLIGENCE FOUNDATION** 🟢 **GREEN — PERSISTENT INTELLIGENCE VERIFIED** (2026-08-12) — durable, owner-scoped Postgres behind the frozen intelligence store ports (in-memory dev/test, Postgres production/staging). `@vedmoulya/core` `WriteThroughDocumentStore` base (sync mirror + async write-through: idempotent parameterized upserts/deletes bound via **`sql.json()`** — exactly one JSON encoding, verified against live Postgres — microtask coalescing, drain-until-quiescent, boot hydrate, shutdown flush, FIFO retention, outage isolation) + **19 tables / 5 packages** (scheduler schedules/jobs/runs/source-policies/cooldowns; brain tasks/decisions/opportunities/events/outcome-memory/adaptive-ledger; ecosystem GitHub-metadata/lifecycle/recommendations/notifications-with-read-state/acquisitions; bridge loop runs; AI World items + user state). `resolvePersistenceBundle()` (env-gated factory, partial overrides) + `ApiApplicationService` wiring + `route.ts` hydrate-before-cadence + SIGTERM/SIGINT flush. IDOR at the query level (`PRIMARY KEY (owner, key)`), no duplicate records on restart (stable-id upserts), Brain learning + notifications survive restart, no secrets/tokens ever stored. **Defects fixed**: polymorphic `deleteDoc` shadowing (deletes silently never persisted), same-tick dedup, trailing-write durability gap, `addItems` count parity, boot hydrate/driver race, fake-sql `TemplateStringsArray` trap, and the **real-Postgres-exposed JSON double-encoding** (`JSON.stringify(x)::jsonb` → escaped-JSON text; fixed with `sql.json()` — frozen pre-022 EI repos share the latent pattern, documented §2b as a follow-up). **Validation (current tree)**: persistence suite **7 files / 43 passed + 1 env-gated skip** · **real-Postgres restart-recovery 4/4 PASSED** (live PostgreSQL 16: create state across all 12 store families → flush → recreate bundle → hydrate → no duplicates + owner isolation + notification read-state) · gateway **34 files / 705 + 1 skip** · web **167/167** · scheduler **42/42** · benchmark **13/13 PASS** · typecheck 0 · lint 0 · Chrome journey PASSED. Remaining operator items: production DB provisioning; frozen-repo `sql.json()` follow-up. Docs: `09_Documents/SPRINT_022_{PERSISTENCE_ARCHITECTURE,PERSISTENCE_SECURITY,COMPLETION_REPORT}.md`.
- **SPRINT-023 OUTCOME INTELLIGENCE & REAL-PROBLEM EXECUTION** 🟢 **GREEN — IMPLEMENTATION VERIFIED** (2026-08-12) — a **composition sprint** proving the full problem→outcome loop (understand → define outcome → decompose → allocate → execute → verify → recover → approve → deliver → measure → learn) from the EXISTING estate with **zero new engines**. Two narrow genuine gaps only: (1) **typed problem understanding** — `packages/goals/src/types/problem-types.ts` (`ProblemDefinition`: intent ANSWER/ACTION/OUTCOME/UNKNOWN, domain, desiredOutcome, constraints, missingInformation, approvalRequirements, successCriteria, riskLevel, confidence, provenance; UNKNOWN stays UNKNOWN — never fabricated) + deterministic `ProblemUnderstandingService` (composes the existing `GoalUnderstandingService`; measurability-filtered success criteria, time-token deadlines, amount-gated budget detection — negative cases regression-tested) + `GoalsApplicationService.understandProblem` + gateway `goals.understandProblem` (auth + rate tier + owner-inert) + `useUnderstandProblem` hook + compact "Understand a problem" panel on `/goals`; (2) **hermetic outcome-journey benchmark** `scripts/outcome-journey-benchmark.ts` — **12 real-world journeys / 30/30 PASS** (simple question · multi-step research · document/data · automation · coding · career · business/earning · tool/API · provider failure → bounded failover → recovery on the fallback provider (never re-picks the failed provider; keyed on the true runtime capability id — never vacuous) · verification failure (abstention caught, never reported success) · human-approval workflow (paid option pauses AWAITING_APPROVAL via the real `purchase` sensitive action; nothing executes before approval) · budget/token exhaustion (BrainBudgetGuard fail-closed mid-run stop)) — wired into the `benchmarks` chain + CI + release. **Composition (reused, not rebuilt):** `QualityFirstSelector` (quality → evidence → usability → free/local → cost) · `AutomationBoundaryEngine` (no fake automation) · `ApprovalEngine` · `CapabilityDecomposer` · Brain `BrainApplicationService` (execution · failover · verification · approval · budget over `LoopBudget`) · goals task-DAG. **No duplicate scheduler/budget/notification/approval/execution engine.** Validation: goals **77/77** (11 files) · gateway router test **3/3** · full gateway **714 passed + 1 skipped / 35 files** · web **167/167** · root typecheck **0** · lint **0**. Honest: live provider execution remains an operator step (deterministic hermetic scripted ports).
- **EPIC-020 CONTINUOUS INTELLIGENCE & ADAPTIVE ORCHESTRATION** 🟢 **GREEN — IMPLEMENTATION VERIFIED** (2026-08-12) — the Brain becomes a **continuously improving operating intelligence**: UNDERSTAND → DISCOVER → COMPARE → SELECT → APPROVAL → EXECUTE → VERIFY → EVALUATE → LEARN → MONITOR → RE-OPTIMIZE across providers/GitHub/local/free/paid. **Nothing rebuilt** (EPIC-006…019 preserved); `@vedmoulya/brain` **extended with narrow ports**: `BrainUsagePort` (provider usage/limits — KNOWN/UNKNOWN/ESTIMATED, never fabricated), `BrainExperiencePort` (adaptive task×provider evidence), `BrainMemoryPort` (durable outcome feedback), `BrainDiscoveryBridgePort` (screened AI World/scheduler events → Brain), `OpportunityStore`/`IntelligenceEventStore`. New domain: `UsageIntelligence` (evidence-gated budgets replacing fabricated `0.001`; quota exhaustion only when KNOWN ≤ 0; failure classification) · `AdaptiveScoreLedger` (recency-weighted, EXPLICIT > INFERRED) · `ExecutionFailover` (bounded, never re-picks the failed provider) · `OpportunityIntelligence` (7 categories, uncertainty always, never income promises; SUSPICIOUS/BLOCKED never become opportunities). Service: N-provider `assignMany` (DEEP_RESEARCH / QUALITY+HIGH) · fail-closed evidence-backed estimates · detect→classify→fallback→continue · `discoverIntelligence` · learning feedback (scores + memory + recurring-task opportunities) · `providerScores`; `BrainTask` gains `failoverEvents`. Gateway `brain.*` **+7 procedures** (discoverIntelligence/listOpportunities/updateOpportunity/listIntelligenceEvents/updateIntelligenceEvent/providerScores/dashboard) + `BrainDashboardService` + `/brain` operating dashboard (status hero · opportunities · Continuous AI World — discovery is never adoption · learning feed). Validation: brain **101/101** (19 new), gateway **BrainRouter 13/13** (full **683/683 / 32 files**), web **26/26** brain UI tests, typecheck 0, **continuous-intelligence benchmark 22/22 PASS** (all mission §17 scenarios; wired into `benchmarks` + CI + release), **browser journey PASSED** (`continuous-intelligence.spec.ts`). Honest: live provider/ecosystem execution + Postgres persistence for brain stores = operator steps; repo acquisition stays EPIC-015 approve-gated; AI World bell wiring planned. Evidence: `09_Documents/EPIC_020_{BASELINE_AUDIT,ARCHITECTURE,ORCHESTRATION_MODEL,PROVIDER_USAGE_MODEL,SECURITY_MODEL,DECISION_MODEL,EVIDENCE,COMPLETION_REPORT}.md`.
- **Next (planned):** **Live Intelligence Operations** — operator activation: live GitHub App authorization, GitHub API discovery + real repository security scanning, live provider execution, provider-change monitoring, Postgres persistence for the bridge stores, and notifications wired to the AI World bell (evidence-first + approval-gated).

### EPIC-007 — AI Application Factory (🟢 GREEN, 2026-08-08)

- **The APPLICATION FACTORY layer above the frozen platform** — takes a natural-language
  application idea and turns it into a structured, validated application project
  (UNDERSTAND → SPECIFY → ARCHITECT → PLAN → APPROVE → GENERATE → TEST → CRITIQUE →
  REFINE → BUILD → PACKAGE → DEPLOY/EXPORT). NOT another AI gateway, NOT another
  provider router, NOT another RAG, NOT another loop engine. Baseline audit:
  `09_Documents/EPIC_007_ADOPTION_AUDIT.md` (build-vs-adopt — no blind adoption).
  - **New workspace `@vedmoulya/app-factory`** — follows the frozen layering (types →
    contracts → domain → infrastructure → application → catalog). The factory
    executes NO AI directly: every specialist call flows through the same
    `AIOrchestratorSpecialistPort` the loop uses (AI-SELECT / EI-002 / EI-004 /
    EI-003 / Evidence-First via the frozen `AIOrchestrationService`), tools through
    the frozen ToolRuntime, and the generation loop through the **EPIC-006
    LoopEngine** (a backward-compatible optional pre-built `graph` input carries the
    application task graph). No provider SDK imported.
  - **Phases 1–4:** `SpecificationEngine` (typed `ApplicationSpecification`;
    unresolved requirements never silently assumed), `ArchitectureEngine` (typed
    architecture — technology-aware, not vendor-locked), `TaskGraphBuilder`
    (application task graph mapped to the loop graph — sequential + parallel waves),
    reusable specialist roles (Requirements Analyst … Deployment Engineer — logical
    capabilities, not hardcoded providers).
  - **Phases 5–9:** deterministic `generateProject` (typed, structured, testable,
    lintable, buildable) + `FileOperationLayer` (READ→PLAN→PATCH→TEST→REVIEW;
    create/modify/delete/rename with rollback + full audit trail) + `ExecutionPolicy`
    (READ_ONLY allowed / SAFE_WRITE controlled / DESTRUCTIVE_WRITE blocked unless
    authorized / NETWORK+DATABASE+CODE_EXECUTION blocked / SECRET_ACCESS prohibited /
    DEPLOYMENT explicit — no arbitrary shell/fs/network/package execution).
  - **Phase 7–8:** `BlueprintService` (source of truth: spec + architecture + task
    graph + technologies + files + dependencies + environment + database + APIs +
    tests + deployment + acceptance criteria) + `PlanPreviewService` (**Phase 8
    approval gate — no files are generated until the user approves the plan**).
  - **Phases 10–12:** `ValidationPipeline` (deterministic gates: manifest, unit
    tests, integration tests, build + bounded auto-fixes for safe failures),
    `UIQualityEvaluator` (responsive/a11y/spacing/typography/navigation/empty-
    loading-error states/mobile-desktop/dark-light/consistency), `SecurityReviewer`
    (dependency/auth/authz/IDOR/secret/input/injection/API/file/tool reviews;
    **CRITICAL/HIGH findings block completion**).
  - **Phases 13–17:** `ApplicationRegistry` (DRAFT/PLANNED/BUILDING/VALIDATING/READY/
    DEPLOYED/FAILED/ARCHIVED), per-application **isolated workspaces** (Phase 14 —
    root containment + policy + rollback; gateway wires a `workspaceFactory` so
    cross-application contamination is prevented by construction), version control
    that **never auto-pushes** (Phase 15), vendor-neutral `DeploymentAdapterPort`
    (Phase 16 — local implemented, Vercel declared; explicit authorization
    required), `EconomicsTracker` (Phase 17 — AI calls/tokens/cost/cache/
    iterations/retries/provider usage/generation time; estimate-before vs
    actual-after).
  - **Phase 18 first three applications:** ABAP Debugger, Restaurant App, AI App
    Builder — all pass the full validation pipeline (deterministic, not faked).
  - **Phase 20 API + UI:** `factory.*` tRPC namespace (create/approve/build/status/
    getDetail/deploy/list/vcInit/vcBranch/vcCommit/vcDiff/vcPreparePullRequest/
    vcHistory behind auth + IDOR + rate limits + zod) + `/applications` execution
    experience (goal → plan → approve → build → validation → security → files/ops →
    VCS → deploy).
  - **Phase 19 benchmark** (`npm run factory:benchmark`): spec accuracy **3/3**,
    build **3/3**, tests **3/3**, security blocks **0/3**; honest reading:
    orchestrated factory costs more than a single shot (~18 specialist calls / ~3 780
    tokens / ~$0.03 per generated application) but reduces human intervention to
    plan approval and guarantees spec/architecture/validation/security/audit.
  - **Validation:** app-factory coverage 93.42% stmts / 81.81% branches (≥80%) →
    coverage gate **32/32** · lint 0/0 · typecheck 0 · build + bundle budgets PASS ·
    audit 0 vulns. Verdict **🟢 GREEN — EPIC-007 COMPLETE**. Docs:
    `09_Documents/EPIC_007_{ADOPTION_AUDIT,ARCHITECTURE,APPLICATION_BLUEPRINT,SECURITY_MODEL,EVALUATION,COMPLETION_REPORT}.md`.
    Remaining honest limitations: in-memory workspaces + VCS journal (real fs/git
    behind the seams); generated projects are validated structured projects
    (production deployment = operator step); no live external DB/provider execution
    on this machine (no Docker/WSL).

### EPIC-009 — Product Intelligence & Requirements Engine (🟢 GREEN, 2026-08-09)

- **The INTELLIGENCE LAYER ABOVE THE APPLICATION FACTORY** — rebuilds nothing.
  Baseline audit: `09_Documents/EPIC_009_BASELINE_AUDIT.md`. Transforms
  `USER PROMPT → APPLICATION FACTORY` into
  `USER IDEA → UNDERSTAND → ANALYZE → EXTRACT REQUIREMENTS → AMBIGUITY →
CONFLICTS → HIGH-VALUE QUESTIONS → SAFE DEFAULTS → COMPLETE PRODUCT PLAN →
USER APPROVAL → APPLICATION FACTORY → LOOP ENGINE → BUILD → VALIDATE`.
- **New workspace `@vedmoulya/requirements`** (frozen layering types → contracts →
  domain → infrastructure → application → catalog) — **17 deterministic domain
  engines** orchestrated by `ProductIntelligenceEngine`; **zero AI calls in the
  core path** (optional non-fatal enrichment port over the frozen runtime).
- **Provenance spine (Phases 1–3):** `ProductIntent` explicit/inferred/assumptions/
  unknowns ledger + `RequirementSet` (13 categories); every claim + requirement
  carries source (USER/INFERENCE/QUESTION/DEFAULT/MEMORY/RAG/SYSTEM) + confidence
  - reason; **inference never silently becomes user fact**; UI provenance badges.
- **Question intelligence (Phases 5–8):** `AmbiguityEngine` + ranked (weighted
  impact), **bundled** `RequirementQuestionEngine` — BLOCKING must be answered
  (no safe default by design), IMPORTANT asked when practical, OPTIONAL never
  asked; rationale + impacts per question; plain language.
- **Safe defaults (Phase 9) + completeness gate (Phase 10):** ASSUMPTION/DEFAULT/
  REASON/IMPACT defaults, accept-all/edit/reject, security-sensitive defaults
  never silent; **a completeness score can never override a critical unknown** —
  `plan()`/`approve()` refuse while any blocker remains.
- **Conflict detection (Phase 11)** explains contradictions + explicit a/b/both
  resolution — never silently chooses.
- **Full product plan (Phases 12–23):** 18-section brief → journeys (happy/
  failure/empty/permission/network/validation/recovery) → experience strategy →
  application-specific design spec → architecture (choice/reason/alternative/
  tradeoff + complexity guard) → AI (only when required, via frozen runtime) →
  RAG (only when external knowledge needed) → tools (purpose/permissions/data/
  risk/approval) → security-by-design → cost (tokens/calls/cost/latency) →
  dependency-aware build plan (parallel waves via EPIC-006 LoopEngine) →
  Phase 23 approval gate (review: understood/explicit/inferred/don't-know).
- **Change control (Phases 24–26):** mandatory `ChangeImpactAnalyzer` (10 impact
  areas + what changes/not + risks + cost) before any modification; append-only
  `RequirementVersionControl`; `TraceabilityIndexer` (requirement → feature →
  test). **Memory (Phase 27)** per-session — never leaks across users/apps.
- **Gateway:** `requirements.*` tRPC (15 procedures) behind auth + IDOR + rate
  limits + zod; owner-scoped sessions enforced at the engine (`getOwned`);
  `PostgresRequirementSessionStore` + in-memory double; `handoffToFactory` →
  `factory.create` for APPROVED plans.
- **UI (Phase 28):** `/applications` **Product Intelligence** mode (recommended) —
  two-panel Product Builder: conversation + progressive intelligence panel
  (Understanding · Requirements · Questions · Assumptions · Product · Design ·
  Architecture · AI · Security · Cost · Plan), mobile tabs, resume sessions.
- **Benchmark (Phases 29–30):** `npm run requirements:benchmark` — **PASS**, 7/7
  real scenarios (restaurant, ABAP, AI support, finance, e-commerce, healthcare,
  workflow): understood (avg 11ms) · plan-gated until resolved · approved +
  handoff goals · IDOR refused · 0 AI calls.
- **Validation:** requirements **95 tests / 8 files — 0 failures**; gateway +5
  router tests (registry 31/31); typecheck 0 (requirements/api/web). Docs:
  `09_Documents/EPIC_009_{BASELINE_AUDIT,REQUIREMENTS_ARCHITECTURE,
QUESTION_INTELLIGENCE,DESIGN_INTELLIGENCE,SECURITY_MODEL,EVALUATION,
COMPLETION_REPORT}.md`; MASTER_ROADMAP / PROJECT_STATUS / README / task_progress
  synchronized. Verdict 🟢 **GREEN — EPIC-009 COMPLETE**. Honest limitations:
  deterministic core (optional enrichment is the future AI surface); four factory
  archetypes (other domains route through generic-web); live Postgres store
  contract-tested via in-memory double; live-provider/DB journeys are operator
  steps (no Docker/WSL).

### EPIC-011 — Production Validation & Autonomous Quality (🟢 GREEN — IMPLEMENTATION VERIFIED / LIVE VALIDATION PENDING, 2026-08-09)

- **Turns EPIC-010's implementation-verified experience intelligence into
  production-evidenced functionality — rebuilds nothing.** Baseline audit verified
  from source (`09_Documents/EPIC_011_BASELINE_AUDIT.md`) — previous completion
  reports were NOT trusted blindly; the IMPLEMENTED/TESTED/BROWSER VERIFIED/LIVE
  VERIFIED/OPERATOR REQUIRED/DEFERRED split is explicit.
  - **Phase 1 — Live AI runtime validation (`npm run ai:production:verify`):**
    operator-safe (never prints keys — only the 7-char prefix; never unbounded;
    never silently falls back to mocks; exit 2 = no key, 3 = quota-blocked).
    Verified authentication, model availability, timeout/retry/fallback,
    structured output, token accounting, budget enforcement, provider routing,
    evidence/abstention, error normalization, streaming, telemetry. **Found +
    fixed a REAL production defect the hermetic suites could not**: the Vercel
    AI SDK v7 rejects `system`-role messages — `VercelAIProvider` now extracts
    system prompts into the top-level `instructions` option at all three call
    sites (regression tests, 13/13). Before: `System messages not allowed`.
    After: the call reaches the real OpenAI API correctly (blocked only by the
    account's zero billing credits — honest LIVE VALIDATION BLOCKED, exit 3).
  - **Phase 2 — Live RAG validation:** `npm run rag:pg:verify` (operator-safe,
    exists since AI-RUNTIME-003). LIVE VALIDATION BLOCKED on this machine (no
    Docker/WSL distro, no Postgres listener, `DATABASE_URL` unset) — exact
    operator steps documented; no fabricated live-RAG evidence.
  - **Phase 3 — Live AI critique (`npm run ai:critique:verify`):** activates the
    EPIC-010 `AICritiquePort` seam over the frozen runtime with a deterministic
    task (the ABAP UI); measures critique latency/tokens/cost, verifies
    evidence-first merge never weakens when AI is absent (no port → deterministic
    report unchanged). Live path reached the real provider → quota-blocked →
    honest exit 3. Deterministic + merge checks pass.
  - **Phases 4/10/14 — Production benchmark (`npm run production:benchmark`):**
    **8/8 real applications** (ABAP Debugger, Restaurant, Finance, Healthcare,
    Education, E-commerce, Enterprise workflow, AI customer support) through
    requirements → plan → quality (10 dimensions) → critic → targeted
    refinement → security gate. **VERDICT PASS**: 8/8 archetype-matched · 8/8
    scored on all 10 dimensions · refinement targeted + approval-gated 8/8 ·
    security gate blocked 2/2 critical/high · evidence-first 8/8. Economics
    (est., honest): 40 AI calls / 82 800 in + 24 000 out tokens / 21 RAG +
    21 embedding calls / $0.136 total (~$0.017/app) · 0 real AI calls
    (deterministic). Timing: understand 11ms · plan 3ms · evaluate 0.7ms ·
    refine 0.2ms per app.
  - **Phases 5/6 — Browser visual validation + regression
    (`apps/web/e2e/visual-validation.spec.ts`):** real Chrome, real factory
    build, real generated UI in the sandboxed preview. Desktop/Tablet/Mobile:
    device re-framing to the declared width, **zero horizontal overflow**,
    real rendered UI + labeled textarea + empty-state, interaction at 375px.
    **Committed deterministic baselines** (`abap-{desktop,tablet,mobile}
-chromium-win32.png`, `toHaveScreenshot` maxDiffPixelRatio 1%) — regression
    comparison run passes; a missing baseline FAILS (never silently passes).
    Desktop/tablet baselines identical by construction (preview column width)
    — documented, not hidden.
  - **Phases 7/8 — Quality gates + autonomous loop
    (`npm run quality:gates:verify`):** **16/16 PASS** — CRITICAL/HIGH security,
    data leak, authorization failure, functional-test failure, grounding
    failure (when required), structured-output failure all BLOCK (NOT_READY);
    **aggregate-score masking FORBIDDEN**; the critic→refine→retest loop is
    bounded by LoopBudget (ITERATION_LIMIT before the next call; token budget
    enforced independently).
  - **Phases 11/12 — Failure chaos + adversarial security:** re-ran and recorded
    the frozen deterministic suites — AISecurity/FailureSafety/orchestration
    **51**, loop budget/engine **33**, execution-policy/workspace/security/
    session-stores **31** — all green. IDOR, cross-user isolation, prompt/
    retrieval injection, malicious code, tool denial, secret leakage,
    authorization bypass, score-masking: all fail safely. No critical/high
    findings, no leakage, no unbounded loops, no budget violations.
  - **Phase 9 — Observability:** reused `AIMetrics` (live in-run request/cache/
    cost counters printed by the verify scripts) + `AIObservability` (NOOP
    default; OTel/Langfuse exporter seams exist) — no competing telemetry
    introduced; full OTel/Langfuse activation remains DEFERRED (documented).
  - **Phase 13 — Real user journey:** EPIC-008/010 Chrome journeys 3/3 passing
    (login → create → plan/approve → build → preview → quality → refinement
    plan → diff → validation → deploy) + the new visual spec leg. No UI mocking.
  - **Regression:** orchestrator 50 (incl. the adapter-fix regression tests) ·
    experience 50 · requirements 130 · journey 3/3 · visual spec PASS. The 12
    pre-existing failures in `a11y.spec.ts`/`user-journey.spec.ts` are unrelated
    (unmodified files; AppShell hydration/viewport) and reproduced independently.
  - **Docs:** `09_Documents/EPIC_011_{BASELINE_AUDIT,LIVE_AI_VALIDATION,
RAG_VALIDATION,VISUAL_VALIDATION,SECURITY_VALIDATION,PRODUCTION_BENCHMARK,
COMPLETION_REPORT}.md`; MASTER_ROADMAP / PROJECT_STATUS / CHANGELOG / README
    / task_progress synchronized. Verdict **🟢 GREEN — IMPLEMENTATION VERIFIED /
    LIVE VALIDATION PENDING**. Honest limitations: live AI + live RAG are
    operator steps (zero-credit provider account — the call reached the real API
    and was honest-reported BLOCKED; no Postgres/Docker on this machine); visual
    baselines cover the ABAP acceptance app on Chromium/win32; OTel/Langfuse
    deferred.

### EPIC-012 — Production Observability, Control Plane & Operations (🟢 GREEN — COMPLETE WITH OPERATOR ACTIVATION REQUIRED, 2026-08-10)

- **Makes VedMoulya observable, diagnosable, controllable and economically
  measurable in production — CONNECTS and COMPLETES the existing telemetry
  estate.** Phase 0 gap audit (`09_Documents/EPIC_012_BASELINE_AUDIT.md`)
  classified every capability from source first (metrics registry, Prometheus +
  OTLP exporters, AIObservability seams, health routers, audit logs,
  correlation IDs all ADOPTED — nothing rebuilt blindly).
  - **Phase 1 — ExecutionTrace spine (`@vedmoulya/core` tracing):**
    `ExecutionTrace` / `TraceSpan` / `TraceStatus` (OK/ERROR/FAILED/ABSTAINED/
    BUDGET_EXCEEDED/TIMEOUT/PROVIDER_FAILURE/VALIDATION_FAILURE/SECURITY_BLOCK/
    USER_CANCELLED — superset of loop termination reasons, mapped 1:1 via
    `normalizeTraceStatus`); stable identifiers (traceId/spanId/executionId/
    userId/applicationId/correlationId); `TelemetryPort` narrow engine seam
    (`NoopTelemetryPort` default — zero behavior change); `ExecutionTraceProvider`
    AsyncLocalStorage-parented spine (one trace reconstructs USER → REQUIREMENTS
    → FACTORY → LOOP → AI → RAG → PROVIDER → QUALITY → REFINEMENT → DEPLOYMENT);
    **bounded owner-scoped `TraceStore`** (FIFO 5000 + optional TTL — never an
    unbounded sink; telemetry never throws into engine code).
  - **Phases 3–7 — Engine telemetry:** loop (`loop.run` span + `loop.step`
    events — authoritative per-provider tokens/cost/latency/retried/fallback),
    factory (`factory.create/approve/build/resume/deploy` with economics
    attributes), experience (`experience.evaluate` — verdict/overall/findings/
    blocking), requirements (start/answer/plan/approve), rag
    (`rag.ingest`/`rag.search` — collection/chunks/strategy/embedding_model).
    All 457 engine tests stay green (NOOP default unchanged).
  - **Phase 2/3 — AI runtime bridge:** `TraceProviderOtelBridge` implements the
    frozen `AIObservability.OtelBridge` seam against the trace spine — every
    `ai.*` span (provider/model/latency/tokens/cost/cache/retry/fallback/429/
    5xx/timeout/abstention/budget) lands in the correlated trace, redacted via
    the runtime's `redactSecrets`. OTel/Langfuse live export = operator
    activation (no fabricated evidence).
  - **Phase 8 — Unified cost & token ledger:** `CostLedger` (pure query over
    stored traces): totals + per provider/application/user + per-execution rows
    (cost per request/application/build/refinement/user/provider/model, cache
    savings, retries) + anomalies (COST_SPIKE > 3× median / critical > 6×;
    REPEATED_CALLS ≥ 5 identical AI calls in 60 s; CACHE_MISS_BURST ≥ 8 calls,
    0 cache hits). Ledger MEASURES only — frozen budget enforcement remains
    authoritative.
  - **Phase 10 — Application health model:** `assessApplicationHealth` →
    HEALTHY / DEGRADED / BLOCKED / FAILED / UNKNOWN from persisted evidence
    (status, validation gates, security report, UI quality, repair loop) —
    rule-first, a numeric score can never mask a security block.
  - **Phase 11 — Control plane:** `ops.*` tRPC namespace — inspect
    (listTraces/getTrace/listFailures/getDiagnostics/costLedger/costAnomalies/
    applicationHealth/providerHealth/alerts/auditLog) + control
    (retry/cancel/revalidate/requality/disableProvider/enableProvider).
    Owner-scoped reads for non-operators (IDOR refused at the store boundary);
    `OperatorGate` (`OPS_OPERATOR_IDS`, empty = deny-all); every control action
    audited (`AuditTrail` ring 500) + span-traced.
  - **Phase 12 — Incident diagnostics:** `buildIncidentDiagnostics` — WHAT/
    WHEN/WHERE/WHY/attempted/providers/retries/fallbacks/evidence/user+operator
    steps; never "Something went wrong."; no secrets/stack traces.
  - **Phase 13 — Alerting:** `AlertEngine` — 11 threshold rules (provider error
    rate 10%, latency p95 120 s, 429/min 10, RAG fallback 50%, abstention 30%,
    cost anomaly 5×, token anomaly 3×, quality regression 15 pts, security ≥1,
    deployment ≥1, application failures ≥3), configurable validated clamps,
    bounded history (200), no alerts for normal behavior.
  - **Phase 14 — Security audit:** `EPIC_012_SECURITY_AUDIT.md` — no keys/
    secrets in logs or traces, owner-scoped telemetry, operator authorization
    (deny-all default), audit trail, retention controls, safe errors, IDOR
    test-verified (cross-user trace read → NotFound; non-operator control →
    OPS_FORBIDDEN).
  - **Phase 15 — Performance:** bounded stores (5000/500/200), capped queries,
    `maxOpenSpans` guard, no sync-blocking exporter path — overhead documented;
    load/scale re-run deferred.
  - **Phases 16/17/19 — Tests:** core tracing 13/13; `OpsControlPlane` 22/22;
    `AlertEngine`; end-to-end `ObservabilityWiring` — a real application journey
    (create → approve → build → quality → deploy) runs through the real pipeline
    and is **reconstructed from one correlated trace**; gateway full suite
    **595/595 tests / 23 files**; `ProductionEngineWiring` hermetic regardless of
    local provider keys; lint + typecheck clean.
  - **Phase 20 — Docs:** `09_Documents/EPIC_012_{BASELINE_AUDIT,
OBSERVABILITY_ARCHITECTURE,TELEMETRY_MODEL,COST_MODEL,SECURITY_AUDIT,
OPERATIONS_GUIDE,COMPLETION_REPORT}.md`; MASTER_ROADMAP / PROJECT_STATUS /
    CHANGELOG / README / task_progress synchronized. Verdict **🟢 GREEN —
    COMPLETE WITH OPERATOR ACTIVATION REQUIRED**. Honest limitations:
    OTel/Langfuse live export + `OPS_OPERATOR_IDS` are operator-activation steps;
    load/scale re-run deferred; no Postgres/Docker on this machine (unchanged).

### EPIC-010 — Adaptive Application Experience & Visual Intelligence (🟢 GREEN, 2026-08-09)

- **The VISUAL INTELLIGENCE & QUALITY layer above the Application Factory** —
  generated applications become not merely _functionally correct_ but also
  _visually coherent, application-specific, responsive, accessible,
  evidence-reviewed and targeted-refinable_. **Zero architectural change** to the
  frozen platform — baseline audit verified from source
  (`09_Documents/EPIC_010_BASELINE_AUDIT.md`); no frozen system rebuilt.
  - **New workspace `@vedmoulya/experience`** (20 source files) following the
    frozen layering. Executes NO AI directly: the critic/quality engines are
    deterministic logic over the persisted application workspace; the optional
    AI-critique port is a non-fatal seam over the frozen runtime.
  - **Phases 1–7 Design Intelligence:** typed `ApplicationDesignSystem`
    (structured tokens), **domain-aware visual strategy** (archetype-driven —
    ABAP debugger professional/dense · restaurant visual/warm · finance
    trustworthy/analytical · healthcare calm/accessible · education
    engaging/friendly · enterprise structured — never one universal template),
    `DesignDecision`, `UIBlueprint`, state intelligence (LOADING/EMPTY/SUCCESS/
    ERROR/PARTIAL/OFFLINE/UNAUTHORIZED/FORBIDDEN/VALIDATION — never only the
    happy path), responsive intelligence (mobile/tablet/desktop per component),
    accessibility (keyboard/focus/semantics/labels/contrast/screen-reader/
    touch-target/reduced-motion).
  - **Phases 8–13 Critic & Quality:** `VisualCriticEngine` (10 dimensions →
    structured evidence-classified findings VC-xxx), unified
    `ApplicationQualityEvaluation` (FUNCTIONAL/UX/VISUAL/ACCESSIBILITY/SECURITY/
    PERFORMANCE/AI/RAG/DATA/ARCHITECTURE — **a high aggregate score can never
    hide a critical failure**), evidence-first review (CONFIRMED/LIKELY/UNCERTAIN/
    NOT_FOUND — never manufactured confidence), **targeted refinement** (a single
    finding touches only the affected component — never regenerate-all; untouched
    files preserved and reported), change impact (affected requirements/screens/
    components/files/tests/architecture/security/deployment surfaced).
  - **Phases 15–18 Quality Center & Security:** workspace **QUALITY tab** (overall
    - 10 dimension drill-downs: findings → evidence → recommendation → refine),
      design/implementation traceability, token-efficient refinement (zero AI calls
      — evaluation avg 0.97ms), security (refinement flows through the factory's
      owner-scoped engine — cross-user evaluation/refinement refused, IDOR proven
      by test).
  - **Gateway (`experience.*` namespace):** `evaluate`/`findings`/`refine`
    (approval-gated, owner-scoped) on authenticated + rate-limited procedures;
    router-registry E2E (create → approve → build → evaluate → findings → refine
    → cross-user refusal through the real tRPC pipeline); **router coverage
    walker** firing every namespace procedure through the real pipeline with
    schema-generated inputs (full + minimal optional-omitted variants — 34
    namespaces, 391+ schema-valid procedures) so no registry handler closure is
    dead code.
  - **Benchmark** (`npm run experience:benchmark`): hermetic deterministic —
    **7/7 scenarios** (ABAP Debugger, Restaurant, Finance Dashboard, Healthcare
    Appointments, AI Customer Support, Enterprise Workflow, E-commerce),
    quality 7/7 all 10 dimensions, evidence-classified 7/7, targeted +
    approval-gated refinement 7/7, untouched files preserved, security gate
    blocks NOT_READY on critical/high 2/2, cross-user refusal verified.
  - **Validation:** experience **36 tests / 3 files — 0 failures** (95.19% stmts
    · 80.34% branches · 97.56% funcs · 96.64% lines); gateway **549 tests / 19
    files — 0 failures** (95.77% stmts · 80.61% branches · 97.8% funcs · 96.42%
    lines); **coverage gate 🟢 34/34 workspaces ≥80%**; typecheck 0
    (experience/api/web); **ESLint 0 errors / 0 warnings repo-wide** (incl.
    eliminating pre-existing debt — floating promise in
    `scripts/app-factory-benchmark.ts` + one documented object-injection ignore);
    regression green (requirements 95 · app-factory 108 · loop-engine 106).
  - **Honest limitations:** visual validation is **IMPLEMENTATION VERIFIED, not
    pixel-verified** (the critic evaluates design system/blueprint/files against
    structured rules — no headless pixel assertions; "never claim visual
    validation that was not executed" honored); the shipped critic is
    deterministic (model-based critique = documented non-fatal seam over the
    frozen runtime — deferred, not silently claimed); no live external
    provider/DB execution on this machine (same WSL/Docker constraint as
    AI-RUNTIME-003/EPIC-007/008/009).
  - Docs: `09_Documents/EPIC_010_{BASELINE_AUDIT,DESIGN_SYSTEM,VISUAL_CRITIC,
QUALITY_MODEL,COMPLETION_REPORT}.md`; MASTER_ROADMAP / PROJECT_STATUS /
    CHANGELOG / README / task_progress synchronized. Verdict 🟢 **GREEN —
    EPIC-010 COMPLETE**.

### EPIC-008 — Real Application Workspace & Production UX (🟢 GREEN, 2026-08-09)

- **A PRODUCT USABILITY sprint — rebuilds nothing from the frozen platform.** Baseline
  audit: `09_Documents/EPIC_008_BASELINE_AUDIT.md`. Moves VedMoulya from _"the
  Application Factory can generate applications"_ to _"a real user can create,
  inspect, modify, validate, resume and manage an application through VedMoulya"_.
- **Persistent application lifecycle (Phase 1):** new `ApplicationProjectRepository`
  port + `InMemoryApplicationRepository` (hermetic double, deep-cloned documents) +
  `PostgresApplicationRepository` (production JSONB row keyed by application id with
  owner column). The engine persists the **complete project document** on every
  mutation → applications survive page refresh, logout, and server restart (proven by
  restart-survival tests). Lifecycle ops: `rename`, `archive` (never auto-deletes),
  `resume` (FAILED/ARCHIVED → DRAFT keeping plan + workspace), `delete` (explicit
  `confirm: true`), `history`.
- **Version history (Phase 14):** append-only `ApplicationVersion` records (version,
  change, status, author, AI tasks, tokens, cost, tests passed, security findings,
  build status, timestamp). Rollback is forward-only via `resume` — destructive
  rollback intentionally excluded.
- **Ownership at the engine (Phase 2/22):** every lifecycle op resolves through
  owner-scoped `getOwned` — foreign `userId` cannot rename/archive/delete/resume/read
  history (IDOR refused at the engine, never at the UI). Workspaces keyed by
  application id → cross-application file access prevented by construction.
- **Gateway (Phase 1/22):** all `FactoryRouter` handlers async; new handlers
  `rename`/`archive`/`delete`/`resume`/`history` + zod inputs on the authenticated
  procedures; `createProductionApplicationRepository()` wired into
  `ApiApplicationService` options.
- **Workspace UI (Phase 3–6):** `/applications` rebuilt — `page.tsx` create flow
  (goal entry incl. ABAP Debugger Assistant acceptance example → UNDERSTAND→SPECIFY→
  ARCHITECT→PLAN → APPROVE gate → build → manage) + `workspace.tsx` 12-tab
  `ApplicationWorkspace` (Overview · Specification · Architecture · Plan · Build ·
  Files · Diff · Tests · Security · History · Deployment · Settings), responsive,
  no raw stack traces, real persisted execution state (never faked progress),
  explicit deploy.
- **Validation (Phase 23/25):** app-factory **108 tests / 17 files** (new
  `FactoryPersistenceLifecycle.test.ts`, `PostgresApplicationRepository.test.ts`,
  `InMemoryApplicationRepository.test.ts`, `RepairLoop.test.ts`), gateway
  **526 tests / 16 files** (new `FactoryLifecycleRouter.test.ts` incl. cross-user
  ownership refusal), typecheck 0, **lint 0/0 on all changed areas (36 files)**,
  **coverage gate measured 🟢 93.53% stmts · 81.55% branches · 95.94% funcs ·
  95.36% lines (all ≥80%)**, factory benchmark re-verified green.
- **Phase 11 — bounded repair-loop UI (2026-08-09):** the engine runs a
  **6-attempt repair loop** (`MAX_REPAIR_ATTEMPTS`) during build validation
  (diagnose → patch → diff → re-validate), persisting every `RepairAttempt`
  (attempt/limit/diagnosis/patches/result). Exhaustion while failing → **FAILED +
  `REPAIR_LIMIT_REACHED`**; unappliable fixes stop the loop → `VALIDATION_FAILURE`.
  The workspace shows the attempt **n/6** counter, per-attempt diagnosis→patches→
  result, a REPAIR_LIMIT_REACHED banner with resume-and-rebuild, and never claims
  readiness (anything non-PASS → FAILED).
- **Docs (Phase 24):** `09_Documents/EPIC_008_{BASELINE_AUDIT,WORKSPACE_ARCHITECTURE,
COMPLETION_REPORT}.md`; MASTER_ROADMAP / PROJECT_STATUS / README / CHANGELOG /
  task_progress synchronized. Verdict 🟢 **GREEN — EPIC-008 COMPLETE**.
  Honest limitations: live-provider journey = operator step (no Docker/WSL); Postgres
  path contract-tested via in-memory double; Preview (Phase 13) surfaces
  validation/security evidence rather than a rendered app; rollback forward-only.

### EPIC-006 — Orchestrated AI / Loop Engine (🟢 GREEN, 2026-08-08)

- **Controlled, measurable, evidence-first orchestration engine** — NOT a chatbot, NOT a
  generic autonomous agent. Solves complex goals by UNDERSTOOD → DECOMPOSED → ASSIGNED TO
  SPECIALISTS → EXECUTED → EVIDENCE-CHECKED → CRITIQUED → REFINED → VALIDATED → COMPLETED,
  using the existing AI Runtime rather than bypassing it. Baseline audit:
  `09_Documents/EPIC_006_BASELINE_AUDIT.md` (reuse inventory — no duplicated capability).
  - **New workspace `@vedmoulya/loop-engine`** — the loop executes NO AI directly: every
    specialist call goes through `AIOrchestratorSpecialistPort` (AI-SELECT / EI-002 /
    EI-004 / Evidence-First via the frozen `AIOrchestrationService`), RAG through
    `RagSearchPort`, tools through `ToolRegistryToolPort` (frozen `ToolRuntime`); no
    provider SDK imported by the loop.
  - **Phases 1–3:** typed `GoalSpecification` (deterministic, explained derivation;
    underspecified goals suspend with USER_CLARIFICATION_REQUIRED), typed `LoopTaskGraph`
    (DAG + dependency waves, sequential + parallel), explainable per-task specialist
    selection.
  - **Phase 4–8:** bounded loop PLAN→EXECUTE→OBSERVE→EVALUATE→CRITIQUE→REFINE→RE-EXECUTE→
    VERIFY→COMPLETE with six hard budgets (iterations/tokens/cost/latency/provider
    calls/tool calls — checked BEFORE the next call); deterministic `CriticEvaluator`
    (PASS/FAIL/PARTIAL/ABSTAIN); Evidence-First mapping (insufficient→retrieve,
    conflicting→verify, bounded abstention); adaptive `RefinementPlanner` (WHY another
    iteration → different specialist shape); EI-003 optimization on every task.
  - **Phase 9–12:** memory policy (proposed only, never auto-persisted); security
    (auth/IDOR/rate limits/allowlists/schema/audit/timeout/cost — no shell/fs/network/code
    execution; denied tool → SECURITY_BLOCK); explainable trace; explicit
    `TerminationReason` (12 reasons, never silent).
  - **Phase 13–15:** three declarative use cases (ABAP Debugger Assistant, Restaurant App
    Builder, General AI App Builder); `loop.*` tRPC namespace (start/status/getTrace/
    cancel/resume/listRuns/listPatterns behind auth + IDOR + rate limits); `/loop` web
    execution experience (goal → plan → tasks → specialists → evidence → critique →
    result).
  - **Phase 16 tests:** 13 files / 106 tests (no infinite loops, no uncontrolled
    provider/tool calls, no budget overrun) + gateway `loop.*` e2e (router-registry suite
    30 tests).
  - **Phase 17 benchmark** (`npm run loop:benchmark`): single-model **3/9** vs orchestrated
    **7/9** goal success; avg tokens 160 vs 1 240; avg cost $0.0002 vs $0.0015; avg latency
    4ms vs 31ms; evidence sufficiency 8/9; abstention 1/9. Honest reading: orchestration is
    NOT universally better (more tokens/latency on easy goals — measured) but converts
    failures into successes and terminates explicitly — never silently, never infinitely.
    Measured limitation: the deterministic critic cannot detect semantic defects that
    satisfy every section check (false-acceptance probe); the model-critique enhancement
    is the planned follow-up.
  - **Validation:** loop-engine coverage 93.93% stmts / 82.6% branches (≥80%) → coverage
    gate **31/31** · lint 0/0 · typecheck 0 · `next build` + bundle budgets PASS · audit 0
    vulns. Verdict **🟢 GREEN — EPIC-006 COMPLETE**. Docs: `09_Documents/EPIC_006_{BASELINE_AUDIT,
ARCHITECTURE,LOOP_ENGINE,EVALUATION,COMPLETION_REPORT}.md`. Remaining honest
    limitations: no live external DB/provider execution on this machine (same WSL/Docker
    constraint as AI-RUNTIME-003); real-data loop calibration is a follow-up.

### AI-RUNTIME-002 — CONDITION-FREE PRODUCTION APPROVED (2026-08-08)

- **Closeout mission complete:** every condition C-01…C-12 + Phase 13 UI/UX + Phase 14
  engineering + Phase 15 documentation resolved with executable evidence.
  Certification: `09_Documents/AI_RUNTIME_002_CONDITION_FREE_CERTIFICATION.md`;
  post-remediation audit: `09_Documents/AI_RUNTIME_002_CONDITION_AUDIT.md`.
  - **C-01 pgvector:** migration + rollback (`RAG_MIGRATION_001`), `ensureRagReady`
    fail-fast gate, `checkRagHealth`/`isRagReady`, `pgvector/pgvector:pg16` image.
  - **C-02 smoke:** `npm run ai:smoke` (26 hermetic checks) + `npm run ai:smoke:live`.
  - **C-03 observability:** `AIObservability` (NOOP/TEST/OTel/Langfuse seams) + redaction.
  - **C-04 tool boundary:** `ToolRuntime` (typed registry, authz, validation, audit).
  - **C-05 failure safety:** `FailureSafety.test.ts` (16 failure modes).
  - **C-06 security:** `AISecurity.test.ts` (12+ regression tests, no P0/P1).
  - **C-07 production config:** `validateProductionAIConfig` fail-fast + env template.
  - **C-08 SDK path:** test-proven; raw-fetch opt-in only.
  - **C-09 RAG quality:** `npm run rag:eval` (measured baseline).
  - **C-10 token optimization:** `npm run ai:benchmark` (41.6% mean saved, 6/6 evidence kept).
  - **C-11 structured output:** validator + malformed/partial/retry tests.
  - **C-12 E2E:** `EndToEndPipeline.test.ts` (orchestrate + stream).
  - **Phase 13 UI:** `AICompanion.test.tsx` (9 tests).

### AI-RUNTIME-002 Highlights (2026-08-07)

- **SDK Runtime, Intelligent Provider Routing & Context Optimization** (EPIC-005,
  incl. mandatory amendment). Baseline + completion + evidence:
  `09_Documents/AI_RUNTIME_002_{BASELINE,Completion_Report,EVIDENCE}.md`.
  - **Vercel AI SDK installed & primary path:** `ai` v7 + `@ai-sdk/openai`;
    `VercelAIProvider` runs generateText / streamText / Output.object / embedMany
    behind the `ProviderAdapter` boundary; raw-fetch only behind
    `AI_RUNTIME_LEGACY_RAW_FETCH=true`.
  - **Production RAG (`@vedmoulya/rag`):** chunking, OpenAI embeddings,
    Postgres/pgvector repository (migration-ready), vector→keyword fallback,
    `rag.*` tRPC namespace, wired into the runtime via failure-tolerant port.
  - **EI-003 input optimization active in the real runtime:** rank → filter →
    dedupe → compress → token estimate → budget; `TokenOptimizationResult`
    telemetry; no silent truncation.
  - **EI-002/EI-004 provider routing:** health/capability/context/cost/latency/
    strategy scoring, deterministic fallback, typed selection explanations.
  - **Prompt caching** (tenant-safe keys, TTL, hit/miss metrics, stable-prefix
    reuse verified), **streaming stage sequence**, **schema-validated structured
    output** with bounded retry, AICompanion runtime-stage UX.
  - **Evidence-First foundation (Phase 8):** `EvidenceEvaluator` classifies
    groundedness as SUFFICIENT/PARTIAL/INSUFFICIENT/CONFLICTING and the runtime
    ABSTAINS (typed abstention, no provider call) when `groundingRequired` and
    evidence is insufficient/conflicting — never fabricates. **AI-SELECT:**
    per-item `ContextSelectionExplanation` (selected/excluded + reasons).
  - Validation: **6 601 tests / 511 files — 0 failures** · coverage **30/30** ·
    lint 0/0 · typecheck 0 · `next build` + bundle budgets PASS · audit 0 vulns.
  - Conditions: all **resolved** 2026-08-08 (observability + tool runtime + pgvector
    migration + deterministic smoke implemented; live smoke remains an operator step).

### AI-RUNTIME-003 Highlights (2026-08-08)

- **Production AI Calibration, Live RAG Validation & Runtime Intelligence Hardening**
  (EPIC-005). Moved the runtime from _implementation verified_ to _measured and
  calibrated_ — no frozen AI-RUNTIME-002 architecture modified, no engine rebuilt,
  no second RAG/optimizer/router created. All calibration artifacts + baseline:
  `09_Documents/AI_RUNTIME_003_{BASELINE_AUDIT,RAG_CALIBRATION,PROVIDER_CALIBRATION,
ACCURACY_EVALUATION,Completion_Report,EVIDENCE}.md`.
  - **Phase 1 live RAG tooling:** `npm run rag:pg:verify` (`scripts/rag-live-verify.ts`)
    — executes the full Postgres/pgvector path (migration → schema → ingest → embed
    → persist → retrieve → isolation checks) when `DATABASE_URL` is configured and
    exits 0 with `SKIPPED (no credentials)` otherwise — **never silently falls back
    to in-memory in production**. Live execution is a documented operator step.
  - **Phase 2 RAG calibration:** `npm run rag:calibrate` — 11-query dataset (exact,
    semantic, ambiguous, irrelevant, duplicate, conflicting, stale, multi-doc,
    injection, tenant-isolated) + minScore × topK sweep. Measured: **minScore=0.3 /
    topK=3 → precision 0.875 (↑43.2% vs 0.611), recall 1.000, rejection 1.000,
    authz 1.000, sufficiency 1.000** on the calibration corpus. Global default 0.2
    **retained** — at 0.3 the existing corpora lose recall/sufficiency (measured),
    so 0.3 is a documented per-query/per-collection option.
  - **Evidence conflict band calibration (measured + rejected):** n-gram similarity
    of genuine conflicts (0.543–0.777) vs complementary evidence (0.317–0.337) is
    separated by only ~0.011 from the FailureSafety short-pair conflict (0.306); a
    tighter band `[0.45, 0.85]` was rejected and the frozen `[0.2, 0.85]` band
    **retained** — missing a genuine conflict is unacceptable for Evidence-First;
    a false conflict abstains safely. Documented known limitation.
  - **minConflictRelevance calibration (measured + rejected):** 0.2983-scored
    borderline conflict missed at floor 0.3; floor 0.25 re-introduced false
    conflicts from irrelevant docs in the eval corpus; **0.3 retained**.
  - **Phase 3 optimization calibration:** `ai:benchmark` extended with mean
    end-to-end latency (13ms hermetic) + a budget-breach guard (infeasible budget
    rejected after compression — never silently truncated). 41.6% mean context
    reduction with 6/6 required evidence preserved.
  - **Phase 4 provider routing calibration:** `npm run provider:calibrate` — 7 task
    scenarios (complex reasoning, simple, coding, structured extraction, low-cost,
    vision, latency-first) × candidate pool; **45 checks, 0 failures**; every
    decision explainable via `ai.explainSelection`. Measured defect fixed:
    `latency-first` strategy could still select an 18× slower provider — latency
    weight doubled to 0.6 (×4 vs balanced) with regression tests.
  - **Phase 5 accuracy evaluation:** `npm run accuracy:evaluate` — 12 checks on the
    real runtime: abstention on unsupported/conflicting/stale, conflict surfaced,
    injection content handled, evidence sufficiency, no fabrication.
  - **Phase 6+7 validation:** ToolRuntime (24), AIObservability (29), FailureSafety
    (20), AISecurity (20) suites re-verified green — no gaps, no duplication.
  - **Phase 8 real-world matrix:** `npm run matrix:realworld` — **20/20 scenarios,
    25 checks, 0 failures**: simple, complex reasoning, coding, SAP/ABAP, business
    analysis, knowledge retrieval, user-specific, grounded, unsupported (abstain),
    conflicting (abstain), long-context (optimized), low-budget, provider failure
    (retry), timeout (fallback), 429 (retry), RAG failure (abstain), cache hit,
    cache miss, structured output, streaming (full stage sequence).
  - **Phase 9 performance:** latency captured per scenario (matrix) + benchmark;
    no N+1, bounded retries/fallback/cache, no duplicate provider calls.
  - Validation: full suite **6 604 tests / 511 files — 0 failures** · coverage
    gate **30/30 ≥80%** · lint 0/0 · typecheck 0 · `next build` + bundle budgets
    PASS · `npm audit --omit=dev` 0 vulnerabilities. Verdict **🟢 CONDITION-FREE
    PRODUCTION APPROVED** (2026-08-08).

### AI-RUNTIME-001 Highlights (2026-08-07)

- **Production AI Readiness audit + verified-gap implementation** (EPIC-005).
  Full baseline audit in `09_Documents/AI_RUNTIME_001_BASELINE_AUDIT.md`; every
  claim verified against source, not prior reports.
  - **P0 fixed:** the gateway AI orchestrator had **zero providers registered** —
    every real AI call (Content Agency, ClientOps, module insights) threw
    `NotFoundError('Provider', …)`. `ApiApplicationService` now calls
    `registerPlatformProviders(this.ai)`; production never serves synthetic
    responses (mock needs `AI_ENABLE_MOCK=true`); `createOrchestrator()` honors
    its config.
  - **New `ai.*` runtime namespace** — `orchestrate`, `listProviders`,
    `listCapabilities`, `getProviderHealth`, `getAllProviderHealth` (auth + IDOR
    - rate limits + zod, typed DTO returns).
  - **Token budgets:** `TokenEstimationService` (`@vedmoulya/ai`) + `maxInputTokens`
    guard enforced deterministically before any provider call; `ai.tokens.estimated`
    metric.
  - **Timeouts:** OpenAI adapter aborts hung requests (60s default / 10s health).
  - **AICompanion** wired to the real runtime (was canned).
  - Validation: 6 321 tests / 489 files · coverage 29/29 ≥80% · lint 0/0 ·
    typecheck 0 · `next build` PASS. Verdict 🟡 READY WITH CONDITIONS
    (`09_Documents/AI_RUNTIME_001_Completion_Report.md`). Next: AI-RUNTIME-002.

### APP-001 Highlights (2026-08-07)

- **Context & Personal Intelligence Fabric** (`packages/context-fabric`):
  the first post-V1 application-platform sprint of EPIC-006 — a reusable
  context foundation for APP-002 Agent Builder, APP-003 Agent Lifecycle,
  APP-004 Intelligence Trace and APP-006 Application Factory. Consumes the
  frozen OS v1.0 through narrow `FabricEngines` port contracts; no frozen
  EI/OS contract modified, no engine duplicated.
  - **Personal Intelligence Graph** — user ↔ goals, projects, tasks, skills,
    knowledge, memories, documents, applications, preferences, work history,
    learning history, AI interactions (provenance, confidence, timestamps,
    source, permissions, lifecycle, relevance).
  - **Business / Enterprise Context Graph** — organization ↔ people, teams,
    clients, projects, processes, applications, documents, policies,
    knowledge, business capabilities; membership-scoped access.
  - **Context Fabric** — unified abstraction over personal + enterprise
    context + memory + documents + knowledge + goals + tasks + projects +
    capabilities + execution history, layered on permissions + provenance.
    Extends EI-003; does not replace it.
  - **Hybrid retrieval** — `RetrievalStrategy` interface (keyword + graph
    relationships + memory relevance + recency + user/task relevance +
    mandatory permission filtering), deterministic ranker, no LLM required.
  - **Mandatory permission-aware pipeline** — identity → permission
    evaluation → eligible sources → retrieval → filtering → ranking →
    package; cross-user / cross-tenant / unauthorized-traversal / memory and
    document leakage / permission bypass all unit-tested and denied.
  - **Provenance + explanation** — `ProvenanceService` (where/when/source/why/
    confidence/permissions) + `ContextExplanationService` (human-readable
    “selected because…” reasons — the future APP-004 trace basis).
  - **`ContextFabricPackage`** — minimum-useful-context contract with request
    identity, goal/task refs, selected entities/relationships/memories/
    documents/capabilities, provenance, permissions, ranking scores,
    explanation and token/cost estimate.
  - **Graph repository seam** — `GraphRepository` abstract interface with
    in-memory (hermetic) + Postgres JSONB (production default via
    `createProductionContextFabricRepository`) implementations.
  - **API gateway:** `contextFabric.*` tRPC namespace — 11 procedures behind
    auth + IDOR + rate-limit middleware, zod-validated, DTO boundaries.
  - **Web:** `/context-fabric` Enterprise Context Fabric Explorer — 8 tabs
    (Overview, Personal Graph, Business Graph, Search, Context Package,
    Provenance, Permissions, Diagnostics), lazy views (2.36 kB route bundle),
    loading/empty/error states, dark mode, mobile-ready.
  - **Storybook:** `ContextFabric.stories.tsx` (10 components, 6 states each).
  - **Seed:** 11th `seed:ei` store (`context_fabric_graph` — 22 entities + 27
    relationships).
  - **Tests:** 9 package test files / 86 tests (93.17% stmts / 81.14%
    branches / 97.08% funcs) + gateway router/registry/wiring suites.
  - **Validation:** typecheck 0 · lint 0/0 · full suite 6 309/6 309 (487 files)
    · coverage gate 29/29 ≥80% · `next build` PASS · bundle budgets PASS.
    `storybook build` exits 1 for the pre-existing upstream #32301 toolchain
    issue (see `09_Documents/APP-001_Completion_Report.md`).
  - Documentation: `03_Architecture/APP-001_Context_Fabric_Architecture.md` +
    `09_Documents/APP-001_Completion_Report.md` + MASTER_ROADMAP +
    PROJECT_STATUS + CHANGELOG + task_progress + README updated.

### OS-001 Highlights (2026-08-07)

- **Enterprise Operating System Integration** (`packages/os-intelligence`):
  the integration layer that turns the eleven Enterprise Intelligence Engines
  (EI-001…EI-010 + INT-001) into ONE Enterprise Operating System. It
  integrates, validates, optimizes and certifies the complete platform — no
  new engines, no redesigned architecture, no isolated components. Every
  engine is consumed through narrow `OSEngines` port contracts (the same seam
  pattern as `MemoryEngines`/`KnowledgeEngines`/`BrainEngines`); no engine was
  modified and no logic duplicated.
  - **Engine registry:** the canonical catalog of all 11 engines — package,
    sprint, production repository and database table.
  - **Dependency matrix:** package build graph (verified acyclic — no circular
    dependencies) + runtime consultation graph (who consults whom, with
    per-edge reasons).
  - **System health:** live health pass over every engine port in parallel
    (fan-out — end-to-end latency equals the slowest engine, not the sum),
    per-engine latency/totals, and the overall OS health score.
  - **Pipeline validation:** the 15-stage event flow (Goal → Project → Task
    Planning → Capability Selection → Knowledge Retrieval → Memory Retrieval →
    Provider Selection → Context Assembly → Decision → Execution Strategy →
    Execution Graph → Execution Session → Learning → Knowledge Update → Memory
    Update), every stage validated against the owning engine's live registry.
  - **Cross-engine validation:** the nine integration pairs (Capability ↔
    Provider, Provider ↔ Context, Context ↔ Knowledge, Knowledge ↔ Memory,
    Memory ↔ Learning, Learning ↔ Brain, Brain ↔ Strategy, Strategy ↔
    Execution, Execution ↔ Learning).
  - **Diagnostics + platform validation:** the diagnostics battery (engine,
    dependency, contract, repository, pipeline, lifecycle, event-flow,
    ownership, database) and the `validatePlatform` certification gate.
  - **Performance:** end-to-end and per-engine latency measurement.
  - **Persistence:** `os_health_registry` health snapshots — `InMemoryOSRepository`
    (hermetic test double) + `PostgresOSRepository` (production default via
    `createProductionOSIntelligenceRepository`).
  - **API gateway:** `os.*` tRPC namespace — 9 procedures (systemHealth,
    pipelineHealth, runDiagnostics, validatePlatform, engineStatus,
    dependencyGraph, performanceMetrics, dashboard, snapshots) behind auth +
    IDOR + rate-limit middleware, zod-validated.
  - **Web:** `/os` Enterprise OS Dashboard with six tabs (Dashboard, Pipeline,
    Dependencies, Diagnostics, Performance, Snapshots), lazy-loaded views
    (50 kB budget), dark mode, mobile-ready.
  - **Seed:** 10th `seed:ei` store (`os_health_registry` — certified-platform
    health snapshot).
  - **Tests:** 14 os-intelligence test files / 138 tests + gateway router +
    production-wiring suites green. Storybook `OperatingSystem/*` stories
    (ScoreGauge, StatusBadge, StageBadge, SeverityBadge, EngineRow, StageRow,
    FindingRow, SnapshotRow).
  - Documentation: `03_Architecture/OPERATING_SYSTEM.md` +
    `09_Documents/OS-001_Completion_Report.md` + MASTER_ROADMAP +
    PROJECT_STATUS + CHANGELOG + task_progress updated.
- **Quality gates:** typecheck ✅ · lint ✅ (0 errors / 0 warnings) · next build ✅ ·
  bundle budgets ✅ (largest page < 50 kB) · full workspace test suite green

### EI-010 Highlights (2026-08-06)

- **Enterprise Memory Intelligence Platform** (`packages/memory-intelligence`):
  the Enterprise Memory Layer of VedMoulya — it records, retrieves, ranks,
  compresses, consolidates and expires evolving experience across the entire
  operating system. NOT chat history, NOT a vector database, NOT conversation
  memory. Every `MemoryItem` captures type (14 memory classes: working, session,
  project, business, capability, provider, execution, decision, learning,
  context, user preference, failure, success, long-term), owner, provenance
  (source + 15 source types), related goal/task/capability/provider/project/
  user/context/decision/execution, importance (score + level + factors),
  confidence, frequency, recency, usage count, lifecycle (captured → validated
  → consolidated → ranked → compressed → active → archived → expired),
  compression state (raw → compressed → summarized → collapsed), retention
  policy (TTL per policy), citations, relationships (10 edge types), consumers,
  and a full audit trail. Domain services: MemoryCaptureService (full Memory
  Pipeline: Event → Capture → Classification → Importance → Consolidation →
  Relationship Detection → Ranking → Compression → Retrieval → Brain →
  Execution → Learning → Memory Update), MemoryImportanceService,
  MemoryRankingService, MemoryRetrievalService (11 match modes: goal, project,
  user, capability, provider, context, time, importance, similarity, business
  module, keyword), MemoryCompressionService, MemoryConsolidationService
  (duplicate merging), MemoryExpirationService (retention TTLs),
  MemoryLifecycleService, MemoryAnalyticsService, MemoryCitationService
  (verification), MemoryRelationshipService. `MemoryGraph` abstract interface
  (in-memory + Postgres impls, BFS traversal). `memoryIntelligence.*` tRPC
  namespace (23 procedures) behind auth + IDOR + rate-limit middleware,
  zod-validated. Postgres `memory_registry` production default +
  `createProductionMemoryIntelligenceRepository()`. `/memory` web Enterprise
  Memory Center (9 tabs: dashboard, explorer, retrieval, timeline,
  relationships, importance, analytics, compression, retention). Seed catalog
  (23 memories + 17 relationships) as the 9th `seed:ei` store. 8 test files /
  111 tests, coverage 83.55% branches, gateway router + wiring suites green,
  Storybook `MemoryCard` stories. No existing engine modified — integration
  through `MemoryEngines` port contracts. Knowledge remains authoritative
  facts; Memory is evolving experience; the two systems are architecturally
  separate but tightly integrated.
- **Quality gates:** typecheck ✅ · lint ✅ (0 errors / 0 warnings) · next build ✅ ·
  bundle budgets ✅ (largest page < 50 kB) · `npm audit` reduced 9 → 8 (dev-toolchain only)
- **Certification:** CERT-001 conditions C-01…C-06 resolved — see
  [docs/CERT-002_Completion_Report.md](./docs/CERT-002_Completion_Report.md)

### EI-009 Highlights (2026-08-06)

- **Enterprise Knowledge Intelligence Platform** (`packages/knowledge-intelligence`):
  the Enterprise Knowledge Layer of VedMoulya — the authoritative knowledge
  source used by every Enterprise Intelligence Engine. Every `KnowledgeItem`
  captures WHAT VedMoulya knows, WHERE it came from (source + 12 source types),
  WHO owns/uses it (owner + consumer registry), WHETHER it is trusted (trust
  score + confidence), WHETHER it is current (lifecycle + validation), WHAT
  depends on it (dependencies + relationships), and HOW it should be used
  (citations + usage). 14 categories, 10 relationship types, 8 search modes
  (semantic — deterministic ranker, no LLM, no vector DB — keyword, category,
  relationship, dependency, consumer, trust, version), lifecycle draft → review
  → active → deprecated → archived, versioning + Knowledge Diff, trust scoring,
  and a `KnowledgeGraph` abstract interface (in-memory + Postgres impls, BFS +
  shortest path). `knowledge.*` tRPC namespace (24 procedures), Postgres
  `knowledge_registry` production default + `createProductionKnowledgeIntelligenceRepository()`,
  `/knowledge` web Enterprise Knowledge Center (10 tabs), seed catalog (30 items
  - 26 relationships) as the 8th `seed:ei` store. 17 test files / 142 tests,
    coverage 93.2% statements / 81.7% branches, gateway router + wiring suites
    green, Storybook `KnowledgeCard` stories. No existing engine modified —
    integration through `KnowledgeEngines` port contracts.

### EI-008 Highlights (2026-08-06)

- **Enterprise Brain — Central Decision Intelligence** (`packages/enterprise-brain`):
  the highest decision-making layer of VedMoulya. It coordinates every Enterprise
  Intelligence Engine through narrow `BrainEngines` port contracts and decides —
  it never executes. Each goal produces one `BrainDecisionPlan` with 14 fully
  explained decisions (goal priority … business objectives), each carrying why,
  evidence, confidence, trade-offs, alternatives, and risks. The 11-step pipeline
  (Receive Goal → Analyze → Consult Goal/Learning/Capability/Provider/Context/
  Execution-Strategy → Generate Plan → Explain → Pass to Execution Orchestrator)
  is traced per plan, and plans transition `proposed → approved → handed_off`
  (or rejected/superseded) through versioned, actor-scoped, audited transitions.
  `enterpriseBrain.*` tRPC namespace (14 procedures), Postgres `brain_registry`
  production default, `/enterprise-brain` web dashboard (8 tabs) with the live
  decide-a-goal pipeline runner and human-approval workflow, seed catalog (14
  decisions + 1 plan) in `seed:ei`. 94 package tests, coverage 96%+ statements,
  gateway router + wiring suites green. No existing engine modified — the Brain
  consumes every engine and owns none.

### EI-007 Highlights (2026-08-06)

- **Enterprise Learning Intelligence Platform** (`packages/learning-intelligence`):
  learning events (10 categories) → aggregation models → insights → the seven
  best-* recommendations → reports, with the human-approval safety workflow
  (approve / reject / rollback, version history, audit trail, confidence
  thresholds). `learningIntelligence.*` tRPC namespace (14 procedures),
  Postgres `learning_registry` production default, `/learning-intelligence` web
  dashboard (6 tabs), seed catalog (54 events) in `seed:ei`. 111 package tests,
  coverage 97%+ statements, gateway router + wiring suites green. No existing
  engine modified — integration through `LearningEngines` port contracts.

### CERT-002 Highlights (2026-08-06)

- **B-01 fixed:** pipeline capability discovery now resolves AI-feature names →
  registry capabilities via the `findByAIFeatures` translation layer
  (`PipelineBuilderService` + `CapabilityApplicationService.findByAIFeatures`);
  all 5 seed goals build a validated pipeline; the 4 previously failing tests pass
- **Build unblocked:** node-builtin leak into the client bundle fixed
  (`sideEffects: false` on pure EI packages + deep imports), Storybook-named
  exports extracted out of route pages (`execution-strategy`, `goals`, `execution`),
  provider/execution/goals pages split into lazy-loaded views to meet the 50 kB
  bundle budget
- **Lint gate restored:** 308 source errors remediated; `out/` + `android/` generated
  assets ignored; full-repo `eslint .` is 0/0
- **Coverage gate:** 8 failing workspaces → 23/23 (coverage config added to
  `intelligence` + `services/api`; new Postgres repo tests added)
- **C-04 Postgres repositories added for all 5 in-memory EI packages:**
  `PostgresCapabilityRepository`, `PostgresContextRepository`,
  `PostgresExecutionStrategyRepository`, `PostgresGoalRepository`,
  `PostgresTaskRepository`, `PostgresPipelineRepository` — wired into the gateway
  as production defaults via `ProductionRepositories.ts` factories (27 new tests,
  mocked-sql pattern, no live DB required)
- **C-05:** `hono` upgraded (moderate advisory resolved); remaining 8 findings are
  dev/build-toolchain (`vite` via Storybook, `fast-uri` transitive) — see
  [docs/CVE_TRACKING.md](./docs/CVE_TRACKING.md)
- **C-06:** README test counts corrected (418 files / 5 506 tests); MASTER_ROADMAP
  EI-006 claim now matches reality
- **Final hardening pass:** 21 residual lint errors + 5 warnings in the new
  Postgres EI code fixed (`eslint .` → 0/0); vitest full-suite teardown race
  (`onUserConsoleLog`) eliminated in the three gateway wiring suites; literal
  `\n` SQL defect in `PostgresExecutionStrategyRepository` restored; six dead
  in-memory fallbacks removed from `ApiApplicationService` so all six EI stores
  default to their production Postgres repositories; the `providers` store was
  wired to `createProductionProviderRepository()` (all seven EI stores now
  Postgres-backed); `npm run seed:ei` (`scripts/seed-ei.ts`) seeds the five EI
  catalogs into Postgres idempotently. Full report:
  [`docs/CERT-002_Completion_Report.md`](./docs/CERT-002_Completion_Report.md)

---

## Prior Baseline (2026-07-31)

- **Repository:** v1.0.0 tagged (`chore(meta): initial repository baseline` — `2bef790`)
- **Workspaces:** 26 (1 app, 11 packages, 13 services)
- **Tests:** 207 test files / 2709 passing — all green (SPRINT PH-002)
- **Coverage:** Per-workspace v8 coverage configured in every workspace with tests
- **Production certification:** 92/100 — 🟢 PRODUCTION READY WITH MINOR ISSUES
  (see [docs/PROJECT_REPORT_2026-07-31.md](./docs/PROJECT_REPORT_2026-07-31.md))
- **Fail-fast config:** `AUTH_JWT_SECRET`, `IDENTITY_DATABASE_URL`, `REDIS_URL`,
  AI provider keys, OAuth (Google), and SMTP credentials are validated at startup
  in production (P1-8 / P0-2 / PH-001-T2)

---

## BLD-010 Dashboard Experience Platform

### Implementation

- [x] DashboardDTO.ts - All DTOs defined
- [x] DashboardViewModelFactory.ts - View model factory
- [x] DashboardDTOMapper.ts - DTO mapper
- [x] DashboardAssembler.ts - Assembles snapshot from all services
- [x] DashboardCacheService.ts - Caching layer
- [x] DashboardConfigurationService.ts - Configuration
- [x] DashboardPersonalizationService.ts - Personalization
- [x] DashboardSnapshotService.ts - Snapshot generation
- [x] DashboardRecommendationService.ts - Recommendations
- [x] DashboardInsightService.ts - Insights
- [x] DashboardNotificationService.ts - Notifications
- [x] DashboardJourneyService.ts - Journey tracking
- [x] DashboardTimelineService.ts - Timeline
- [x] DashboardAnalyticsService.ts - Analytics
- [x] DashboardMetricsService.ts - Metrics
- [x] DashboardHealthService.ts - Health
- [x] DashboardApplicationService.ts - Main orchestrator
- [x] index.ts - Exports

### Testing

- [x] DashboardAssembler tests
- [x] DashboardDTOMapper tests
- [x] DashboardCacheService tests
- [x] DashboardSnapshotService tests
- [x] DashboardApplicationService tests
- [x] All other service tests

### Verification

- [x] Run all tests
- [x] Generate coverage report
- [x] Static analysis
- [x] Final certification report

---

## SPRINT PH-001 — Production Excellence Hardening

- [x] T1 Repository Foundation (LICENSE, .editorconfig, README)
- [x] T2 Production Configuration Hardening (fail-fast for all prod secrets)
- [x] T3 Workspace Test Completion (vitest config + test script + coverage everywhere)
- [x] T4 Repository Cleanup (removed error dump artifacts)
- [x] T5 Documentation Synchronization
- [x] T6 Verification (TypeScript, ESLint, tests, build)

---

## SPRINT PH-002 — Enterprise Operations & Reliability

- [x] T1 Observability — core `observability` module (Prometheus exporter, OTel
      exporter, correlation IDs via AsyncLocalStorage, error reporters, runtime
      gauges), Grafana dashboards (platform + AI metrics), Prometheus + OTel
      collector configs, docker-compose `observability` profile
- [x] T2 Graceful Shutdown — ordered SIGTERM/SIGINT shutdown (stop accepting →
      drain → flush metrics → close resources → stop lifecycle), wired into bootstrap
- [x] T3 Runtime Health — HealthRouter returns real app/db/redis/ai/memory/cache/
      queue/cpu/lifeos component status, version, git SHA, build timestamp, uptime,
      measured response times, readiness
- [x] T4 Performance — AI cache hit-ratio/provider-latency metrics, process
      runtime gauges on a 15s interval, per-component latency histograms
- [x] T5 Load Testing — zero-dep Node harness + k6 script covering
      health/auth/dashboard/search/lifeos/ai scenarios with token + user-id support
- [x] T6 Coverage Standardization — consistent vitest configs (json reporter,
      v8 provider, all branches) across workspaces
- [x] T7 Dependency Governance — `.github/dependabot.yml`, `docs/DEPENDENCY_POLICY.md`,
      `docs/CVE_TRACKING.md`
- [x] T8 Deployment Verification — API/web Dockerfiles, `.dockerignore`,
      `.env.production.example`, pinned observability image tags
- [x] T9 Reliability Review — `Reliability.test.ts` covering graceful shutdown,
      correlation, error reporting, Prometheus export, OTel exporter
- [x] T10 Final Validation — 0 TS errors, 0 ESLint errors, 2709 tests passing,
      all workspaces build

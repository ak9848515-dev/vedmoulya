# CURRENT ARCHITECTURE STATE

> **Canonical current truth.** This document describes the ACTUAL system as verified
> from source and tests **after SPRINT-040 (Local Runtime Verification)** — 2026-08-16.
>
> Historical sprint reports are preserved as records — all sprint deliverables live in
> `04_Sprints/SPRINT-0XX_*` (SPRINT-022/024/025/026/027/028/029/030/031/032/033/034/035/036/037/038/039/040 + reconciliation),
> the uniform sprint-documentation architecture; `09_Documents/` holds EPIC / AI-RUNTIME /
> OS / CERT documentation only. Where a historical claim and the verified code differ,
> this document is the authority and the difference is recorded.
>
> Status vocabulary (used throughout): IMPLEMENTED · TESTED · MOCKED ·
> OPERATOR-REQUIRED · PARTIAL · PLANNED · FUTURE · BLOCKED · DEPRECATED.
> "COMPLETE" is never claimed for something that is only documented.

---

## 0. Verification Basis

Every statement below was re-verified against the working tree on 2026-08-16:

| Gate                                               | Result                                                                                                                                                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Full test suite                                    | per-workspace re-verified 2026-08-16: gateway **1010 passed · 50 files**, world-model **298/298 · 23 files**, web **220/220 · 22 files**, voice **115/115 · 7 files**, identity **283/283 · 25 files** |
| Gateway (services/api)                             | **1010 passed · 50 files** (world.* +10 SPRINT-039 evidence-loop procedures on top of the SPRINT-038 problem/radar estate)                                                                             |
| Web (apps/web)                                     | **219/219 · 22 files** (CommandCenter drill-downs + Opportunity Radar, zero regressions)                                                                                                               |
| World Model (packages/world-model)                 | **298/298 · 23 files** (+38 SPRINT-039: observations/prospects/evidence-quality/bounded-calibration/next-best-action/comparison/drilldown + domain branch tests + benchmark gates)                     |
| Voice (packages/voice)                             | **115/115 · 7 files** (untouched in SPRINT-038)                                                                                                                                                        |
| Proactive (packages/proactive)                     | **60/60 · 7 files** (untouched)                                                                                                                                                                        |
| Intelligence Fabric (packages/intelligence-fabric) | **53/53 · 8 files** (untouched)                                                                                                                                                                        |
| Typecheck                                          | **0** (`tsc -b` root + `tsc --noEmit -p services/api` + web + world-model)                                                                                                                             |
| Lint                                               | **0 errors / 0 warnings** (`eslint .`, 4 GB heap)                                                                                                                                                      |
| Coverage gate                                      | **8/8 touched workspaces ≥80%** — world-model **91.21/82.14/92.33/94.2**; services/api unchanged                                                                                                       |
| `next build`                                       | **PASS**                                                                                                                                                                                               |
| Benchmarks chain (`npm run benchmarks`)            | all PASS — quality gates 16/16 + `calibration:benchmark` 13/13 + `provider:benchmark` 11/11 + **`opportunity:benchmark` 20/20**                                                                        |

Git baseline: `main` @ `5bba63c` (SPRINT-025 commit); SPRINT-026→032 work lives in the
working tree (uncommitted at the time of this document).

---

## 1. Product Vision

VedMoulya is an **authorized personal AI operating system** — ONE intelligence layer over
MANY capabilities, MANY providers, MANY workflows, governed by ONE owner-controlled
governance model. It is not an unrestricted autonomous agent, not a chatbot, not a
collection of duplicated AI agents, not an LMS, and not merely a provider marketplace.

The platform loop: **UNDERSTAND → DISCOVER → PLAN → APPROVE → EXECUTE → VERIFY → LEARN**.
AI may proactively THINK, DISCOVER, ANALYZE and PREPARE. AI must NOT grant itself
authority. Existing authorities remain the source of truth.

## 2. Core Architecture

- **One monorepo**: 1 Next.js app (`apps/web`), ~30 packages (`packages/*`), ~14
  services (`services/*`), npm workspaces, TypeScript project references, Vitest,
  ESLint strictTypeChecked.
- **Composition over invention**: every post-v1 capability is built as a composition
  layer with narrow ports into the frozen estate — never a duplicate engine.
- **The VedMoulya Brain** (`@vedmoulya/brain`) is the central governing intelligence
  authority: UNDERSTAND → REPRESENT → DECIDE → EXPLAIN → SELECT → PLAN.
- **Fail-closed everywhere**: approval, budget, verification, authorization, and IDOR
  checks default to refusal; UNKNOWN stays UNKNOWN; FAILED never becomes SUCCESS.

## 3. User Identity

- JWT-authenticated sessions (Google OAuth flow in the web app; `AUTH_JWT_SECRET`).
- Every user is an **owner**; every store and procedure is owner-scoped.
- Gateway middleware enforces `input.userId === session.userId` centrally (IDOR guard).
- Operator control plane (`ops.*`) behind `OPS_OPERATOR_IDS` (empty = deny-all).

## 4. Brain (EPIC-016, EPIC-020, SPRINT-023/024/025)

- `@vedmoulya/brain` — the central orchestrator: `IntentInterpreter`, `BrainModeSelector`
  (6 modes), `ProviderRoleAssigner` (13 roles, quality-first), `ParallelPlanner`,
  `ConflictDetector`, `OutputAssembler`, `BrainBudgetGuard` (fail-closed over the frozen
  `LoopBudget`), `BrainPolicyEngine` (sensitive actions NEVER self-granted),
  `BrainDecisionRecorder`, `OutcomeEvaluator`.
- **Continuous intelligence** (EPIC-020): `UsageIntelligence`, `AdaptiveScoreLedger`,
  `ExecutionFailover` (bounded, never re-picks the failed provider),
  `OpportunityIntelligence` (7 categories, uncertainty always, SUSPICIOUS/BLOCKED never
  become opportunities), `discoverIntelligence`, `providerScores`, `brainDashboard`.
- **Outcome intelligence** (EPIC-020): `OutcomePriorityEngine`, `DailyOutcomeEngine`
  (Today's Top N), money-intelligence fields on `Opportunity`, 3-value satisfaction.
- **Problem→outcome loop** (SPRINT-023): `ProblemDefinition` +
  `ProblemUnderstandingService` (composes `GoalUnderstandingService`, UNKNOWN stays
  UNKNOWN) + `goals.understandProblem`.
- **Live verification** (SPRINT-024): root-confined `ArtifactReaderPort` + deterministic
  `ArtifactVerifier` + production `NodeArtifactReader` composed into the existing
  `StepVerifier` — success only when the execution contract AND the real artifact verify.
- **Learning** (SPRINT-025): `LearningSignal` FACT/INFERENCE/UNKNOWN + `deriveLearningSignals`,
  verdict-gated `BrainOutcomeMemory` (`recordLearning` — UNKNOWN/FAILED never become
  SUCCESS), user-correction loop `correctLearning` (EXPLICIT user facts > inferred
  preferences via the existing `PreferenceLedger`), advisory experience tie-break in
  `ProviderRoleAssigner`.

## 5. Provider Orchestration

- **One routing authority**: `ProviderRoutingAdvisor` / `QualityFirstSelector` /
  `ProviderRoleAssigner` — QUALITY → EVIDENCE → USABILITY → FREE/LOCAL → COST.
  Cheapest never wins; FREE MUST NOT BEAT QUALITY (AI-RUNTIME-003 calibrated: latency
  weight corrected so an 18× slower provider can no longer win).
- Runtime adapters: OpenAI (REGISTERED/EXECUTABLE/VERIFIED), DeepSeek
  (REGISTERED/EXECUTABLE via Vercel-AI-SDK `createOpenAI`), Mock (dev / explicit prod
  opt-in via `AI_ENABLE_MOCK=true`). Anthropic/Google/OpenRouter/Ollama =
  **catalog-only (UNSUPPORTED_RUNTIME)** — no adapters added.
- Provider intelligence profiles (EPIC-012A/B) with provenance (VERIFIED/PROVIDER_DECLARED/
  MEASURED/INFERRED/UNKNOWN), resource types (LOCAL/FREE HOSTED/FREE API QUOTA/USER-PAID
  API/…), model lifecycle ledger, 24 h refresh policy.
- **No provider is ever hard-coded into business logic**; SPRINT-029 continues this
  (the proactive layer reads the capability marketplace surface, never a provider id).
- **SPRINT-030 — the Intelligence Fabric adds an ADVISORY orchestration layer** over
  this estate: `StrategyCandidate` orchestration contract + `SelectionStrategy`
  (CHEAP/FAST/QUALITY/PRIVATE/BALANCED — deterministic, explainable, privacy
  overrides cost) + `ProviderHealthLedger` (evidence-only runtime health, UNKNOWN
  until observed) + `CostPolicyGuard` (measure-only over CostLedger) + `WorkflowBounds`
  - `VerificationChainPolicy` + `ResultNormalizer` + `AutonomyPolicy` (levels 0–5 over
    the existing A/B/C/D). The Fabric **never executes, spends or authorizes** — actual
    routing stays with the frozen runtime; the registry remains the only catalog.

## 6. Capability Marketplace (EPIC-013)

- `@vedmoulya/capability-marketplace`: 20+ capability graph, `CapabilityDecomposer`,
  `IntegrationClassifier` (NATIVE_API/DIRECT_PROVIDER/OPEN_SOURCE/LOCAL_MODEL/
  GITHUB_PROJECT/EXTERNAL_APPLICATION/MANUAL_STEP/UNKNOWN), `AutomationBoundaryEngine`
  (FULLY/PARTIALLY/HUMAN_APPROVAL/MANUAL — no fake full automation),
  `QualityFirstSelector`, `ApprovalEngine` (publish/send/deploy/purchase/delete/share),
  `CapabilityPlanner` producing `FactoryCapabilityPlan` (evidence, risks, approval points,
  unavailable capabilities; cost/time only when evidence exists).

## 7. Execution (EPIC-014, EPIC-006)

- `@vedmoulya/execution-bridge`: `PlanRunResolver` (EXECUTABLE/APPROVAL_REQUIRED/
  CONFIGURE_REQUIRED/MANUAL_REQUIRED/UNAVAILABLE), `StepVerifier` (execution contract +
  expected output + validation = success), `ApprovalRuntime`, `RunBudgetGuard` (wraps the
  frozen `LoopBudget` — iterations/tokens/cost/wall-clock, fail-closed),
  `PreferenceLedger` (explicit vs inferred, provenance).
- `@vedmoulya/loop-engine`: the orchestrated AI loop (`LoopEngine`, `AIOrchestratorSpecialistPort`,
  bounded by LoopBudget; termination on ITERATION_LIMIT before the next call).
- Env-tunable hard limits (EPIC-014): `AI_EXECUTION_MAX_ITERATIONS=50`,
  `AI_EXECUTION_MAX_TOKENS=100000`, `AI_EXECUTION_MAX_COST_USD=5`,
  `AI_EXECUTION_MAX_LATENCY_MS=600000`. Fail-closed — a breach blocks, never silently exceeds.

## 8. Verification

- Deterministic `ArtifactVerifier` over closed expectations (FILE_EXISTS/FILE_ABSENT/
  JSON_VALID/JSON_FIELD/CSV_VALID/CALCULATION/DRY_RUN; PASS/FAIL/UNKNOWN), root-confined
  `NodeArtifactReader` (no traversal/symlink escape).
- Honest verdicts: definitive verification FAIL → FAILED; inconclusive → UNKNOWN;
  success is never fabricated.
- Real-runtime benchmark `runtime:verification:benchmark` 12 journeys / 36/36 PASS.

## 9. Memory

- Enterprise Memory Intelligence (EI-010, `@vedmoulya/memory-intelligence`) + Brain
  outcome memory (`BrainOutcomeMemory`) + `AdaptiveScoreLedger` (recency-weighted,
  EXPLICIT > INFERRED) + `PreferenceLedger` (explicit-vs-inferred with provenance).
- **No promotion path exists** from interaction artifacts (voice conversations,
  proactive recommendations) into facts/preferences/outcomes/learning — structural tests
  assert this.

## 10. Learning (SPRINT-025)

- Evidence-driven learning from completed REAL journeys; zero new engines.
- `deriveLearningSignals` (FACT/INFERENCE/UNKNOWN, one observation never promoted),
  verdict-gated memory writes, `correctLearning` user-correction loop, advisory
  experience tie-break in provider selection.
- Learning benchmark 15 journeys / 25/25 PASS (CI-wired).

## 11. Scheduler (EPIC-018 closure)

- `DiscoveryScheduler` + `RunBudgetGuard` (one scheduler, one budget engine);
  `ScheduleEngine` frequencies, 7-category `DiscoveryJobPolicy`, `ChangeDetector`
  (NO_CHANGE never notifies), `CooldownManager`, `SourcePolicyEngine`.
- `SchedulerCadenceDriver` (10 min default, `AI_WORLD_CADENCE_ENABLED` /
  `AI_WORLD_CADENCE_INTERVAL_MS`): no overlapping ticks, unref'd, graceful stop,
  per-user error isolation, bounded user enumeration from the existing identity
  service, aggregate-only logs (no secrets).
- EPIC-021: the cadence driver also drives the Brain's `discoverIntelligence` on the
  same heartbeat with NEW_OPPORTUNITY notifications through the EPIC-015 surface.

## 12. Notifications

- EPIC-015 `NotificationGate` (relevance-gated) + the AI World bell drawer
  (🔥 Important / ⭐ Recommended / 🧩 GitHub / 📰 Updates) with real read state
  (SPRINT-022 persistence: notifications + read-state survive restart).
- Dead `services/notifications` service was **deleted** in SPRINT-027 (proven: zero
  references anywhere in the repo).

## 13. Voice (SPRINT-027/028)

- **`packages/voice`** — narrow `SpeechToTextPort`/`TextToSpeechPort` seams, mock
  adapters (MOCK kind; refused in production unless `VOICE_ENABLE_MOCK=true`),
  `VoiceIntentGate` (reuses Brain `IntentInterpreter` + `SENSITIVE_ACTIONS`),
  owner-scoped bounded conversation store (in-memory + Postgres), `SpeechApplicationService`.
- **SPRINT-028**: real `RuntimeSpeechToTextAdapter`/`RuntimeTextToSpeechAdapter`
  (provider-neutral OpenAI-compatible HTTP, bounded payloads, AbortSignal + timeouts,
  normalized errors, `kind: REAL`, credentials server-side only; env `VOICE_STT_*` /
  `VOICE_TTS_*`), `VoiceAssistantService` (ANSWER intents → exact `ai.stream` Q&A
  runtime; ACTION intents → real `brain.createTask`), `voice.status` live probe
  (CONFIGURED only when a REAL adapter answers; UNAVAILABLE/ERROR/MOCK — never
  fabricated CONFIGURED), `VoicePanel` UX in the AICompanion.
- **VOICE ≠ AUTHORIZATION enforced + proven**: sensitive actions route to
  `WAITING_FOR_APPROVAL`; the ONLY approval path is the non-voice
  `voice.confirmSensitive` button which calls the existing Brain `approve` authority
  (structural test asserts no voice-only shortcut exists).

## 13b. Intelligence Fabric (SPRINT-030) — ADVISORY orchestration layer

- **`packages/intelligence-fabric`** — provider-neutral orchestration contract
  (`StrategyCandidate`), deterministic `SelectionStrategy` (CHEAP/FAST/QUALITY/PRIVATE/
  BALANCED — privacy overrides cost; PRIVATE + no local candidate → honest
  no-selection), evidence-only `ProviderHealthLedger` (UNKNOWN until real calls
  observed; quota → UNAVAILABLE; never fabricated), measure-only `CostPolicyGuard`
  (over the existing `CostLedger` trace spine — zero spend → `undefined`, never 0;
  fail-closed caps task $1 / daily $10 / provider $5 / workspace $20 with
  exhausted-bucket reporting; execution-time budget remains the frozen
  `RunBudgetGuard`), `WorkflowBounds` (depth ≤ 8 · tasks ≤ 24 · fan-out ≤ 8 · calls ≤
  64 · cost ≤ $5 · time ≤ 600 s), `VerificationChainPolicy` (bounded A → critique →
  verify; disagreement → NEEDS_REVIEW; deterministic stop), `ResultNormalizer`
  (text/json/tool/error + secret redaction), `AutonomyPolicy` (**levels 0–5** over the
  EXISTING A/B/C/D — single-step transitions; class B needs an explicit
  user-authorization record; class C at level 3 only ASKS; class D never).
- Gateway **`fabric.*` 8 procedures** (getProviderHealth / allProviderHealth /
  observeOutcome / checkCostPolicy / classifyAutonomy / selectStrategy /
  validateWorkflow / evaluateVerificationChain — auth + rate tier + central IDOR +
  zod) via `FabricBridgePorts` (the only seams to CostLedger + provider registry).
- **Cadence integration**: the scheduler heartbeat optionally refreshes proactive
  recommendations (`ProactiveRefreshPort`, `runDiscovery:false` default — no
  autonomous action). `FabricPanel` (Provider Network) in the AICompanion — observed
  health only + autonomy-gating notice.
- **Honest boundary**: the Fabric observes / measures / selects / validates — it
  **never executes, spends or authorizes**. Actual provider routing stays with the
  frozen runtime; the registry remains the only catalog.

## 13c. Control Plane (SPRINT-031) — autonomy control

- **`packages/control-plane`** — `ActiveIntelligenceControlPlane`: autonomy settings
  (levels 0–5), emergency stop, cycle/gates, opportunity lifecycle records — owner-
  scoped, IDOR-guarded, honest statuses (REJECTED/COMPLETED never re-entered into
  pipelines). Gateway `control.*` procedures + `ControlPanel` UX in the AICompanion.

## 13e. Autonomous Company OS (SPRINT-033) — founder + revenue intelligence, controlled blueprints

- **`packages/world-model` extended** (composition only — zero new engines; the
  Brain/Fabric/execution/memory/CostLedger authorities are untouched):
- **`RevenueIntelligence`** (Part F) — evidence-carrying revenue streams
  (estimated/actual revenue, costs, automation %, human effort, customers, conversion,
  retention; a figure WITHOUT evidence is REFUSED; UNKNOWN never recorded) + advisory
  `RevenueSnapshot` (totals/margins only from evidence) + advisory `RevenueDecisionHint`
  (BUILD/BUY/AUTOMATE/OUTSOURCE/STOP/SCALE — UNKNOWN when no evidence).
- **`FounderBriefing`** (Part A) — advisory, no-spam composition: TODAY (pending
  approvals, active/high-risk opportunities, revenue, cost, emergency stop, autonomy
  posture) + what-changed (recent world observations) + attention items + signal
  status. `hasContent:false` → caller must NOT notify.
- **`WorkflowExecutionBlueprint`** (Part E) — the controlled Opportunity → founder
  approval → workflow specification → provider/capability selection → execution
  (existing bridge ONLY) → verification → outcome path as a REPRESENTATION:
  per-step A/B/C/D via the existing `ActionClassPolicy`, approval gates on class-C
  steps, bounds via the existing `WorkflowBounds`. `executed:false` +
  `authorizationRequired:true` are STRUCTURAL — no voice-only authorization, no
  hidden execution, no autonomous spending.
- **Part B extensions** — `expectedMargin` + `founderInvolvement` opportunity factors
  (16→18, documented weights) + closed `OPPORTUNITY_CATEGORIES` vocabulary (17,
  normalized never invented).
- Owner-scoped revenue-stream persistence (in-memory + Postgres `world_revenue_streams`)
  in the shared persistence bundle; gateway `world.*` +7 procedures (26 total — auth +
  rate tier + central IDOR + zod); WorldPanel founder briefing + revenue snapshot cards.
- **Honest boundary**: the SPRINT-033 surfaces are ADVISORY and structurally incapable
  of approving/spending/executing; live world signals + live multi-provider execution
  remain OPERATOR-REQUIRED.

## 13f. Founder Command Center & Real-World Activation (SPRINT-034) — command center + evidence + signals + approval-gated execution

- **Founder Command Center** (`apps/web/src/components/CommandCenter.tsx`, mounted in
  the AICompanion) — presentation/composition ONLY: TODAY / PORTFOLIO / INTELLIGENCE /
  AUTOMATION / APPROVALS tabs over the EXISTING read models via `world.commandCenter`
  (aggregate of the existing world overview + founder briefing + revenue snapshot +
  pipeline + control-plane posture + blueprint approvals + cost). Approvals route
  solely through `world.decideBlueprintApproval` → the existing Brain approve/reject.
  No-spam TODAY (empty briefing → "nothing urgent"), UNKNOWN-cost honesty (never
  treated as zero), UNAVAILABLE signal honesty, boundary notice always present.
- **`OutcomeEvidence`** (revenue → outcome feedback): VERIFIED-only actuals — unverified /
  hypothesis / fabricated figures are REFUSED (never inferred; UNKNOWN stays UNKNOWN);
  bounded explainable feedback into `evaluateOpportunity` (Δ ≤ 0.05 per single outcome —
  one outcome NEVER rewrites global policy); every adjustment carries its evidence trail.
- **`LiveSignalAdapter`** — operator-configurable implementation of the frozen
  `WorldSignalSourcePort` (`WORLD_SIGNAL_BASE_URL` / `WORLD_SIGNAL_TOKEN` /
  `WORLD_SIGNAL_KINDS`, server-side only): provenance-REQUIRED (no sourceId/url →
  refused), untrusted-content sanitizer (script/markup/control-char strip, payload caps,
  10 s timeout), honest AVAILABLE/UNAVAILABLE/ERROR — never fabricated SUCCESS.
- **`BlueprintApprovalFactory`** — approval requests ONLY for C/D-gated blueprint steps
  (re-classified through the existing `ActionClassPolicy`; a stored class is never
  trusted), full exposure (action/reason/business/workflow/step/provider/cost/scope/
  risk/outcome/reversibility/authority); `executed:false` STRUCTURAL; decisions route
  exclusively through the Brain authority; execution stays with the existing bridge.
- **`CostWeightedRevenue`** — margin/ROI-aware revenue ranking over CostLedger via a
  narrow `WorldCostPort`; UNKNOWN cost/revenue/margin never zero; assumptions exposed;
  `roiUsd` (unclamped) vs `rankScore` (clamped) separated.
- Durable owner-scoped stores: `outcomeEvidence` + `blueprintApprovals` families
  (in-memory + Postgres `world_outcome_evidence` / `world_blueprint_approvals`);
  gateway `world.*` +7 procedures (33 total — auth + rate tier + central IDOR + zod).
- **Honest boundary**: the Command Center never executes/spends/authorizes by itself;
  approvals pass through the Brain authority only; VOICE ≠ AUTHORIZATION preserved;
  live world signals, live approved-blueprint execution and real revenue inflow remain
  **OPERATOR-REQUIRED**; no fabricated data, no income promises, no automatic business
  creation.

## 13g. Production Hardening, Calibration & Command Center Completion (SPRINT-035) — measured, explainable, operable

- **Command Center drill-downs** (`CommandCenter.tsx`): every section item (TODAY
  attention/approvals, PORTFOLIO streams/pipeline, INTELLIGENCE signals, AUTOMATION
  workflows, APPROVALS requests) is expandable with WHAT / WHY / EVIDENCE / COST / RISK /
  NEXT ACTION; approval detail routes through the existing Brain authority; expand state
  is a `ReadonlySet` (lint 0/0).
- **Bounded owner-scoped timeline** (`world.timeline`): composed from the EXISTING stores
  (opportunity / outcome / approval / revenue lifecycle) — NO new event store;
  stable-key idempotent (never duplicates), `limit` ≤ 50, paginated (`offset` +
  `hasMore`), owner-isolated.
- **Cost view** over the real CostLedger: `costDailyUsd` / `costProviderUsd` + honest
  `revenueVsCost`; OBSERVED / ESTIMATED / UNKNOWN labels; UNKNOWN never zero;
  per-stream cost never attributed from the owner aggregate (stream-scoped queries →
  undefined); ROI only with evidence.
- **Outcome/score calibration benchmark** (`CalibrationScenarios.ts` shared engine +
  `scripts/calibration-benchmark.ts` harness + `CalibrationBenchmark.test.ts` vitest
  gate): **13/13 scenarios PASS** — the SPRINT-034 safety boundary (`FEEDBACK_DELTA_MAX`
  0.05, `FEEDBACK_MIN_EVIDENCE` ≥ 1) proven intact; unverified evidence never scores;
  fabricated evidence rejected; one outcome cannot dominate; repeated evidence
  accumulates boundedly; conflicting evidence visible; unknown stays unknown;
  adjustments explainable. Wired as `calibration:benchmark` — the 17th `benchmarks`
  harness.
- **Voice presentation of the Command Center**: `CommandCenterQuestionRouter`
  (deterministic routing for focus/opportunities/approvals/margin/changes/cost) +
  read-only `CommandCenterPresentationPort` over the world read models — **VOICE ≠
  AUTHORIZATION preserved** (presentation only, no side effects; Brain remains the only
  approval authority; a sensitive action in a question still blocks).
- **Honest per-kind signal health** (`world.signalHealth`): lastSuccessAt / lastErrorAt /
  lastError; AVAILABLE only after a real observation — never fabricated "live".
- **Signal operator runbook** (`04_Sprints/SPRINT-035_SIGNAL_OPERATOR_RUNBOOK.md`): env,
  response format, timeouts, payload limits, failure modes, health checks, disable
  procedure, troubleshooting, security — no credentials documented.
- **Production configuration check** (`scripts/production-config-check.ts`): runtime
  CONFIGURED / NOT_CONFIGURED / OPTIONAL / OPERATOR_REQUIRED classification — nothing
  silently assumed.
- **Coverage recompute (SPRINT-035 §2, mandatory)**: world-model 93.73 / 83.92 / 95.60 /
  96.50; services/api 93.18 / **80.32** / 95.14 / 93.98 — the api branch gate was failing
  at 76.7% because the REAL gateway seams (`WorldBridgePorts.ts`) had no direct tests;
  fixed with meaningful tests (`WorldBridgePorts.test.ts` 34 tests over every factory);
  **coverage gate 45/45 workspaces PASS** (no exclusions, no threshold changes, no tests
  deleted).
- **Honest boundary**: Postgres, AI providers, world signals, STT/TTS, approved-blueprint
  execution and backup/recovery remain **OPERATOR-REQUIRED**; no fabricated data, no
  income promises, no unsupported claim of autonomous operation.

## 13h. Production Multi-Provider Orchestration (SPRINT-036) — bounded orchestration plans over the frozen estate

- **`MultiProviderOrchestrator`** (`packages/world-model/src/domain/MultiProviderOrchestrator.ts`):
  a COMPOSITION SEAM (not an engine) that plans bounded multi-provider workflows by
  composing the EXISTING authorities — `WorkflowFactory.decompose` (bounded
  decomposition) → fabric `validateWorkflow` (EXISTING WorkflowBounds) → fabric
  `selectStrategy` (advisory per-step provider binding + WHY + expected cost;
  CHEAP/FAST/QUALITY/PRIVATE/BALANCED; privacy overrides cost; PRIVATE + no local
  candidate → honest NO_SELECTION) → `ActionClassPolicy` (per-step A/B/C/D — provider
  output can NEVER change it) → `decideRetryPolicy`.
- **`decideRetryPolicy`** — deterministic bounded response table: never retries policy
  denial / cost rejection / malformed / invalid JSON; quota → fallback (no futile
  retry); transient (timeout / rate-limit / unavailable / error / network) → bounded
  retry (≤ 3) → privacy-safe fallback → STOP; verification disagreement →
  NEEDS_REVIEW (never price-resolved). PRIVATE/SENSITIVE steps fall back ONLY to
  privacy-safe candidates, else honest STOP with the reason exposed.
- **`OrchestrationPlan`** — owner-scoped, stable-keyed (goal + strategy, idempotent
  upsert), persisted in-memory + Postgres (`world_orchestration_plans`);
  `executed:false` + `authorizationRequired:true` STRUCTURAL — a REPRESENTATION that
  never calls a provider, never spends, never approves. Runtime path remains the
  EXISTING execution bridge.
- **Deterministic scenario engine + fixtures** (`benchmark/ProviderOrchestrationScenarios.ts`):
  the §14 workflow (research → reasoning → economic analysis → verification →
  finalization) over hermetic fixture providers — **11/11 verification points PASS**
  (privacy override, bounded retry/fallback, quota, malformed STOP, disagreement,
  honest NO_SELECTION, unknown cost never 0, structural guarantees, authority from
  ActionClassPolicy only, strategy behavior).
- **`provider:benchmark` harness** — 18th in the `npm run benchmarks` chain; strategy
  tradeoff table (CHEAP/FAST/QUALITY/PRIVATE/BALANCED) shown, no winner declared.
- **Gateway** `world.orchestratePlan` + `world.listOrchestrationPlans` (auth + rate tier
  - central IDOR + zod).
- **Honest boundary**: live multi-provider EXECUTION remains **OPERATOR-REQUIRED** (no
  credentials, no live calls — the normal suite is hermetic); provider economics from
  fixtures, not the ledger; autonomy levels unchanged; provider count is NOT a KPI.

## 13i. Live Orchestration & Real-World Execution Proof (SPRINT-037) — approved plan → existing bridge

- **`OrchestrationPlanSource`** (`services/api/src/infrastructure/OrchestrationPlanSource.ts`):
  the COMPOSITION SEAM that adapts an APPROVED `OrchestrationPlan` into a
  `FactoryCapabilityPlan` the EXISTING `ExecutionRunService` can run. Structural gates:
  only APPROVED plans adapt (`authorizationRequired:false` + decision present — else
  deterministic rejection); `executed:false` is NEVER flipped by the adapter; per-step
  capability vocabulary mapped through the EXISTING `CapabilityMapper`; provider state
  carried honestly (UNKNOWN → CONFIGURE, AVAILABLE → READY); per-step WHY / expected
  cost / privacy class carried into the runnable plan. NO alternate runtime — the
  adapter produces input for the bridge's own plan source contract.
- **`world.approveOrchestrationPlan`** — approval routes EXCLUSIVELY through the existing
  Brain approval port (same authority as blueprint decisions); the decision is recorded
  on the plan (approvedBy/at/decisionId). A stored class is never trusted; no voice /
  model / plan self-authorization path exists.
- **`world.startOrchestrationPlan`** — composes the EXISTING `ExecutionRunService.start`
  (auth + rate tier + central IDOR + zod; unapproved plan → deterministic rejection;
  idempotent per plan — a second start does not duplicate the run).
- **Command Center**: orchestration plans surfaced in the `world.commandCenter`
  automation view + the AUTOMATION tab (plan → provider/model/WHY → expected vs
  observed cost → status → verification → outcome; UNKNOWN stays UNKNOWN).
- **`integration:provider` operator test** (`npm run integration:provider`,
  `scripts/integration-provider.ts`): composes the REAL authorities end-to-end
  (world → fabric → approval → bridge); requires explicit operator configuration and
  fails clearly (exit 2) when credentials are absent — verified; strict cost/time
  limits; never silently falls back to fake adapters.
- **Verification 2026-08-15 from source**: services/api **1000 passed · 1 skipped · 50
  files**, world-model **220/220 · 18 files**, typecheck **0** (`tsc -b` + api + web),
  lint **0 errors · 0 warnings**, `next build` **PASS**, benchmarks chain all PASS
  (quality gates 16/16 + calibration 13/13 + provider orchestration 11/11), coverage
  gate **45/45 PASS** (world-model 92.49 stmts / 82.37 branch / 93.2 funcs / 95.2
  lines; api branch 80.32).
- **Honest boundary**: LIVE provider execution remains **OPERATOR-REQUIRED** —
  `scripts/production-config-check.ts` reports AI PROVIDERS NOT_CONFIGURED in this
  environment, so the approved-plan → bridge path is IMPLEMENTED + hermetic-TESTED
  (deterministic fixtures) but NOT LIVE-VERIFIED; multi-provider live comparison =
  OPERATOR-REQUIRED; an analytical workflow records an OPPORTUNITY, never REVENUE.

## 13j. Opportunity Discovery & Revenue Validation (SPRINT-038) — practical problem → revenue path

- **Practical problem representation** (`BusinessProblem` in `packages/world-model`):
  evidence/PROVENANCE-REQUIRED, owner-scoped, stable-key idempotent — a problem
  without evidence is REFUSED (`EVIDENCE_REQUIRED`); evidence text sanitized at the
  boundary (markup/scripts/control chars stripped, length-bounded); confidence
  DERIVED from the evidence set (VERIFIED only from a VERIFIED record, else
  ESTIMATED, else UNKNOWN) — never fabricated.
- **Three DISTINCT advisory scores** (PROBLEM / BUSINESS-OPPORTUNITY / EXPERIMENT) —
  deterministic weighted composites with documented weights returned with every
  score; every factor exposed with evidence; UNKNOWN factors contribute NOTHING
  (never converted to zero).
- **Explainable problem LEVELS 0–4** (INTERESTING → ANNOYING → COSTLY →
  REVENUE_IMPACTING → MISSION_CRITICAL) — evidence-driven with human-readable
  reasons; a high level measures PAIN, not commercial attractiveness (the
  opportunity score measures that separately).
- **Bounded lifecycle** (OBSERVED → PROBLEM → VALIDATED_PROBLEM →
  ECONOMIC_OPPORTUNITY → AI_FEASIBLE → EXPERIMENT_CANDIDATE →
  EXPERIMENT_APPROVAL_REQUIRED → EXPERIMENT_RUNNING → EXPERIMENT_COMPLETED →
  PAYMENT_EVIDENCE → BUSINESS_CANDIDATE → BUILD_RECOMMENDED + REJECTED / DISMISSED /
  NEEDS_REVIEW) — no idea→business jump; every transition validated with a reason.
- **Verified-payment-only revenue ladder**: INTEREST / PROBLEM_CONFIRMED /
  EXPERIMENT_SUCCESS / PAYING_INTEREST (WTP evidence) never reach REVENUE_VERIFIED —
  ONLY a `verified_payment` evidence record does; 2 → REPEAT_REVENUE, 3+ →
  REPEATABLE_BUSINESS. "Sounds useful" ≠ revenue; "I would pay ₹X" = WTP evidence,
  never revenue.
- **Zero/low-cost experiment planner** (NO_COST preferred → LOW_COST →
  CAPITAL_REQUIRED; cheaperAlternative advisory; approvalRequired for any budget > 0
  or external action — spending stays behind the existing authorization) +
  **customer discovery PREPARATION** (interview plan + question sets — NEVER a
  fabricated interview result).
- **STOP / kill-bad-ideas**: deterministic evidence-driven `recommendStop` reasons
  (insufficient pain/economics, poor AI feasibility, excessive competition, no
  buyer, excessive complexity, poor margin, experiment-without-revenue, rejected) —
  the system CAN say "do not build this".
- **Advisory Business Candidate** — produced only after verified payment + WTP
  evidence (`REVENUE_NOT_VERIFIED` / `PAYMENT_EVIDENCE_REQUIRED` /
  `WILLINGNESS_TO_PAY_REQUIRED` gates); founder remains final authority.
- **Provider economics over the EXISTING Intelligence Fabric** (`problemProviderEconomics`):
  existing providers PREFERRED when suitable; capability/quality gap → CAPABILITY
  GAP DETECTED founder notification (evaluated providers, why, local/open-source
  alternative, privacy implications, founderApprovalRequired) — NO automatic
  paid-provider adoption; PRIVATE never falls back to a public provider.
- **Opportunity Radar** (presentation-only read model) in the Command Center
  INTELLIGENCE tab — stage counts + WHAT/WHY/EVIDENCE/SCORES/LEVEL/REVENUE-STATE/
  NEXT-ACTION/STOP per problem; bounded (≤ 50 entries), owner-scoped.
- **Stores**: owner-scoped problems store (in-memory + Postgres `world_problems` in
  the shared persistence bundle); bounded FIFO (50/owner), evidence capped 20/problem,
  WTP capped 10.
- **Gateway `world.*` +13 procedures** (registerProblem/listProblems/getProblem/
  addProblemEvidence/recordCustomerSignal/recordVerifiedPayment/assessProblem/
  advanceProblem/planProblemExperiment/customerDiscovery/problemProviderEconomics/
  businessCandidate/opportunityRadar — auth + rate tier + central IDOR + zod).
- **`opportunity:benchmark` — 20/20 deterministic scenarios** wired into `npm run
benchmarks` + vitest gate (evidence-required · sanitization · scores · UNKNOWN≠0 ·
  levels · revenue-ladder · planner · STOP · capability-gap · privacy-override ·
  radar · stable-key · bounded).
- **Structural security**: problems/evidence carry NO approve/execute/authorize
  surface (external evidence never becomes authority — test-asserted); voice has no
  approval surface on problems; no self-execution; no memory promotion.

## 13l. Local Runtime Verification (SPRINT-040) — first end-to-end operational path

- **Objective**: prove the complete operational path over the frozen estate — Docker
  runtime → register/login → founder observation → provenance validation → evidence
  persistence → scoring → customer discovery → next-best-action → verified-payment
  progression — with the founder as the ultimate authority. **NEW ENGINES CREATED: 0**;
  the SPRINT-039 evidence loop needed **zero code changes** (exercised as-built).
- **Defects found + fixed (minimal):**
  - **D1 — identity `users` table never created anywhere.** The identity store was the
    ONE Postgres store violating the estate `ensureTable()` convention (its DB init
    only opened a connection), so first-run auth failed `REGISTRATION_FAILED` (error
    42P01). Fixed with `PostgresIdentityRepository.ensureTable()` (idempotent
    `CREATE TABLE IF NOT EXISTS users` mirroring `schema/users.ts` column-for-column +
    unique `users_email_idx` / `users_google_id_idx`; the drizzle schema's unique
    indexes on `status_state`/`created_at` were deliberately NOT mirrored — they would
    break multi-user operation), wired fire-and-forget in
    `createProductionIdentityRepository()` (the standard factory pattern) and
    **awaited** in `getAuthApp()` for a deterministic cold start.
  - **D2 — `IDENTITY_DATABASE_URL` unset locally** → `password authentication failed`
    against the Docker Postgres. Added to the gitignored `apps/web/.env.local`
    (dev credentials already public in `docker-compose.yml`; no API keys).
  - **D3 — no email-verification delivery exists anywhere (no SMTP), while the domain
    blocks sign-in for unverified accounts** → registered users could never sign in.
    Fixed dev/test-only in the EXISTING `AuthService.signUp` (`user.verifyEmail()` at
    registration, mirroring the existing Google sign-in path). Production/staging
    unchanged — the domain rule still blocks sign-in until a real verification flow
    ships (documented pre-existing gap).
  - **D4 — Next dev cache corruption** (`vendor-chunks/@vercel.js`, environment
    artifact) → `.next` cleared; no code change.
- **Live verification (authenticated gateway, LOCAL TEST data only):** sign-up 201 ·
  duplicate 409 · validation 400 · sign-in 200 · session 200 · sign-out 200; provenance
  refusal (missing → refused); claimed VERIFIED downgraded to OBSERVED; calibration
  refuses UNKNOWN fabrication (delta 0, "UNKNOWN never becomes zero"); prospect
  bounded chain with invalid-jump refusal; verified-payment-only revenue ladder
  (1 → REVENUE_VERIFIED, 2 → REPEAT_REVENUE, 3 → REPEATABLE_BUSINESS); explainable
  next-best-action (TALK_TO_CUSTOMERS, NO_COST, explicit STOP branch); radar /
  drilldown / command-center read models; honest EMPTY datasets before entry.
- **Stores**: the `users` table (identity) now follows the estate convention — every
  Postgres store creates its table idempotently on startup.
- **Tests added (only for defects found):** `ensureTable` DDL (identity),
  sign-up verify dev/production split (identity), auth-app deterministic bootstrap
  (web).
- **Honest boundary**: `vedmoulya-web` is NOT a Docker container (no web service in
  `docker-compose.yml` — the web app runs via `next dev` against the Docker
  Postgres/Redis); production email verification remains a documented pre-existing
  gap; only clearly-marked LOCAL TEST data was used — nothing fabricated, no income
  promises; live world signals + real provider execution remain OPERATOR-REQUIRED.

## 13k. Founder Evidence Loop (SPRINT-039) — real observations → bounded advisory

- **Founder observations** (`FounderObservation` in `packages/world-model`):
  provenance MANDATORY (refused `PROVENANCE_REQUIRED` otherwise); sanitized at the
  boundary (markup/scripts/control chars stripped, lengths bounded); explicit
  evidence states OBSERVED/REPORTED_BY_CUSTOMER/FOUNDER_OBSERVED/DOCUMENTED/VERIFIED/
  HYPOTHESIS/UNKNOWN/CONFLICTING — a claimed VERIFIED is downgraded to OBSERVED
  (VERIFIED requires a real cross-check); HYPOTHESIS is the honest default for
  unverifiable claims.
- **Customer-discovery ledger** (`CustomerDiscoveryRecord` — NOT a CRM, no PII
  dumps): bounded status chain CONTACTED→CONVERSATION→PROBLEM_CONFIRMED→
  SOLUTION_INTEREST→WTP_SIGNAL→PAYMENT_REQUESTED→VERIFIED_PAYMENT (+ LOST from any
  active state); discovery ≠ validation, interest ≠ revenue, WTP ≠ payment — ONLY a
  `verified_payment` evidence record reaches `REVENUE_VERIFIED`.
- **Bounded evidence calibration** (`CALIBRATION_DELTA_MAX` 0.05 per event over the
  EXISTING SPRINT-038 factors): strength-scaled, clamped [0,1]; UNKNOWN never
  becomes zero; conflicts surfaced (never silently resolved); every adjustment keeps
  its evidence trail.
- **Deterministic 8-dimension evidence quality** (provenance/directness/recency/
  independence/repetition/specificity/contradiction/verification) — honest UNKNOWN;
  stale evidence never inflates.
- **Explainable NEXT BEST ACTION** (TALK_TO_CUSTOMERS/TEST_WTP/REQUEST_PAYMENT/
  VERIFY_PROBLEM/RUN_NO_COST_EXPERIMENT/STOP with WHY/EVIDENCE/LEARNING/RISK/
  NEXT-DECISION) — the system CAN say "do not build this".
- **Evidence-driven opportunity comparison** (STRONG_EVIDENCE/PROMISING/
  NEEDS_CUSTOMER_VALIDATION/INSUFFICIENT_EVIDENCE/STOP/UNKNOWN) — a high score alone
  is never STRONG_EVIDENCE; bounded (≤50) owner-scoped ranked advisory.
- **Command Center drill-downs** (expandable evidence/prospects/next action per
  opportunity; honest EMPTY copy) + **voice read-only presentation**
  (CommandCenterQuestionRouter — VOICE ≠ AUTHORIZATION preserved).
- **Stores**: owner-scoped observations + prospects (in-memory + Postgres
  `world_observations`/`world_prospects` in the shared persistence bundle).
- **Gateway `world.*` +10 procedures** (observationRecord/observationsList/
  prospectRegister/prospectAdvance/prospectsList/evidenceQualityView/factorCalibrate/
  nextBestActionView/opportunityCompare/opportunityDrilldownView — auth + rate tier +
  central IDOR + zod).
- **Benchmarks**: `evidence:benchmark` 20/20 + `discovery:benchmark` 10/10 wired into
  `npm run benchmarks` (now 20 harnesses) + vitest gates.
- **Structural**: the evidence loop carries NO approve/spend/execute surface
  (test-asserted); spending/execution stays on the frozen approval-gated paths;
  **EMPTY datasets by design** — no fabricated observations/prospects/customers/
  revenue; real founder entry is ready.

## 13d. World Model & Business Operating System (SPRINT-032) — bounded world representation

- **`packages/world-model`** — the **minimum useful world representation** for better
  decisions, composed over the frozen estate (Brain, Proactive, Fabric, Control Plane,
  Voice, ActionClassPolicy). NOT a universal knowledge graph; NOT a database of the
  world.
- **World graph** (`WorldGraph`): typed owner-scoped entities (user/goal/project/skill/
  work/preference/permission/task/outcome/opportunity/business_unit/problem/service/
  customer/revenue/cost/workflow/capability/provider/model/role/worker/signal/risk) + a
  **closed relation vocabulary** (32 shapes). Observations REQUIRE provenance (no
  fabricated facts); stable-key idempotency (re-observing upserts, never duplicates);
  FIFO bounds (200 entities / 500 relations per owner); bounded paginated queries;
  dangling-edge cleanup on eviction.
- **Business operating model**: configurable `BusinessUnit` (identity, purpose, target
  customer, offerings, workflows, opportunities, costs, revenue, KPIs, automation
  level 0–5, AI capabilities, human responsibilities, approval requirements — never
  hard-coded businesses, never assumed profitable) · generic `WorkflowFactory`
  (CLIENT_REQUEST → ANALYZE → PROPOSE → APPROVAL → BUILD → TEST → DELIVER → VERIFY →
  BILLING) + bounded decomposition validated through the EXISTING Fabric
  `WorkflowBounds` (`executed:false` is structural — representation only) ·
  `HumanAIBoundary` composing the existing `ActionClassPolicy` (A/B/C/D — AI may
  research/analyze/draft/recommend/prepare/test; humans stay authoritative for
  sensitive decisions, financial/legal commitments, irreversible actions, business
  creation, external publication).
- **Opportunity economics** (`OpportunityEconomics`): 16-factor evidence-only scoring
  (market evidence, customer pain, demand signal, competition, implementation effort,
  initial cost, operating cost, potential revenue, time to first revenue, risk,
  automation potential, user fit, AI leverage, provider cost, scalability,
  defensibility) with every factor exposed — the composite is ADVISORY, never
  objective truth. Zero/low-capital modes (NO_COST / LOW_COST / CAPITAL_REQUIRED /
  UNKNOWN) across ₹0 / ₹1,000 / ₹5,000 / ₹10,000 / ₹25,000 tiers; UNKNOWN stays
  UNKNOWN; no income ever promised.
- **AI workforce** (`AIWorkforce`): ROLE ≠ MODEL ≠ PROVIDER ≠ AGENT — roles name
  responsibilities + capabilities + authority class; provider/model binding is an
  ADVISORY suggestion through the existing Fabric `selectStrategy` (privacy overrides
  cost; PRIVATE with no local candidate → honest no-selection). Workers never
  execute/spend/approve and can never escalate authority.
- **World signals** (`WorldSignalSourcePort`): interfaces ONLY for market trends,
  startup ideas, technology releases, AI model releases, open-source projects,
  pricing changes, customer demand, competitor changes, regulatory changes, job
  market, content trends — no live data fabricated (no source → UNAVAILABLE;
  connected-but-down → ERROR).
- **Composition seam** (`WorldModelService`) + narrow `WorldBrainPort` /
  `WorldProactivePort` / `WorldFabricPort` / `WorldActionPort` / `WorldControlPort` /
  `WorldSignalSourcePort`. Gateway **`world.*` 8 procedures** (observe/link/entities/
  relations/units/roles/workflows/evaluate/pipeline/overview — auth + rate tier +
  central IDOR + zod) via `WorldBridgePorts`. Durable owner-scoped stores (in-memory
  - Postgres via the shared `WriteThroughDocumentStore`) in the persistence bundle.
    `WorldPanel` in the AICompanion (My World / Business / Opportunities / Workforce /
    Signals with honest statuses).
- **Structural security**: no `approve/authorize/execute/spend` surface; no memory
  promotion (observations are interaction artifacts with provenance); no escalation.

## 14. Persistence (SPRINT-022 + voice + proactive)

- `@vedmoulya/core` `WriteThroughDocumentStore` base: sync mirror + async write-through,
  idempotent parameterized upserts via `sql.json()` (exactly one JSON encoding),
  microtask coalescing, drain-until-quiescent, boot hydrate, shutdown flush, FIFO
  retention, outage isolation.
- **22+ tables / 7 store families** wired through one `resolvePersistenceBundle()`:
  scheduler (schedules/jobs/runs/source-policies/cooldowns), Brain (tasks/decisions/
  opportunities/events/outcome-memory/adaptive-ledger), ecosystem (GitHub metadata/
  lifecycle/recommendations/notifications/acquisitions), bridge loop runs, AI World
  items + user state, **voice conversations**, **proactive recommendations**, **gateway
  audit logs**, **world-model** (entities/relations/business-units/roles/workflows +
  SPRINT-033 **revenue streams** + SPRINT-034 **outcome evidence** +
  **blueprint approvals**).
- Owner isolation at query level (`PRIMARY KEY (owner, key)`); no duplicates on restart
  (stable-id upserts); real-Postgres restart-recovery verified 4/4.
- In-memory default in dev/test; Postgres write-through in production/staging.

## 15. Security

- 3-layer IDOR protection (gateway middleware + engine stores + query-level PKs).
- Fail-closed policy engine; sensitive actions never self-granted; approval via the
  existing Brain authority only.
- Root-confined artifact reader; placeholder rejection; prompt-injection treated as
  DATA (never AUTHORITY).
- Rate limiting (SPRINT-027 R-1): async **RateLimiter port** — in-memory backend
  (honest `distributed:false`) + explicit Redis backend (`RATE_LIMIT_BACKEND=redis` +
  `REDIS_URL`, INCR+PEXPIRE fixed window, loud once-only degradation to bounded
  per-process buckets, fail-fast config errors; distributed safety never silently
  claimed; unauthenticated traffic shares an anonymous bucket per tier).
- Durable + owner-scoped gateway audit (SPRINT-027 R-2): `AuditLogStore`
  (WriteThroughDocumentStore-backed, bounded, oldest-evicted; in-memory only when unwired).
- No client-side secrets; provider credentials server-side only; secret redaction on all
  telemetry; never-print-secrets preflight/doctor.
- External content = data; discovered AI-world content is scanned as untrusted input.

## 16. Authorization

- **One approval authority**: the Brain's policy/approval surface (decision store).
- Action classification (SPRINT-029, Phase 5): A — safe analysis/drafting; B —
  user-authorized recurring automation; C — approval required (sensitive/irreversible);
  D — never automate. The classification composes the frozen `SENSITIVE_ACTIONS`
  vocabulary + marketplace irreversible-action vocabulary — no new authority.
- **Silence is NOT approval. Voice is NOT authorization. AI-generated plans are NOT
  authorization.** Proposals never self-authorize: `proactive.accept` on a class-C
  recommendation returns APPROVAL_REQUIRED.

## 17. Budget

- One budget engine: `LoopBudget` wrapped by `BrainBudgetGuard` (Brain) and
  `RunBudgetGuard` (execution bridge); env-tunable hard limits; fail-closed; iterations
  survive resume passes; cost anomalies via `CostLedger` + `AlertEngine`.

## 18. Audit

- Durable owner-scoped `AuditLogStore` (SPRINT-027 R-2) behind the middleware audit API;
  ops control-plane actions audited; execution traces reconstructable end-to-end
  (`ExecutionTrace` spine + `TraceProviderOtelBridge`, redacted).

## 19. Frontend Architecture

- Next.js App Router + tRPC client + Zustand stores; one design system (slate/violet
  tokens, lucide icons, `focus-visible` rings, mobile bottom-sheets).
- AICompanion drawer (chat + **VoicePanel** + **ProactivePanel**) — one product feel:
  ASK → DISCOVER → PLAN → APPROVE → EXECUTE → VERIFY → LEARN.
- Pages: dashboard, brain, goals, ai-world, providers, capability-marketplace,
  ecosystem-intelligence, live-intelligence, applications (factory), applications
  (requirements), context-fabric, enterprise-brain, execution, settings, portal, …
- Capacitor Android wrapper present (`apps/web/android`).

## 20. Backend Architecture

- `services/api` — one tRPC gateway (`RouterRegistry` ~5.6k lines) with ~40 namespaces /
  390+ procedures, `ApiApplicationService` wiring every engine, central
  auth/rate-limit/IDOR middleware, `ResponseMapper`, zod inputs.
- Every capability layer ships as a package: domain → contracts (narrow ports) →
  infrastructure → application; the gateway implements the ports over the real engines.
- Voice + proactive follow the same seam pattern (bridge ports in `services/api/src/infrastructure`).

## 21. Data Flow (user request → outcome)

```
User (web / voice / proactive) → gateway tRPC (auth + rate limit + IDOR)
  → Brain pipeline (understand → discover → compare → select → plan → approve → execute)
  → capability marketplace (plan/capabilities/automation boundary)
  → provider orchestration (quality-first routing → AI runtime)
  → execution bridge (steps, budget, approval, verification)
  → outcome memory (honest verdicts) → learning signals → adaptive ledger
  → notifications (relevance-gated) → dashboard / brain / voice / proactive surfaces
```

## 22. AI Provider Flow

- Single runtime: `AIOrchestrationService` (provider adapters registered once via
  `registerPlatformProviders`) → Vercel-AI-SDK `generateText`/`streamText`/
  `Output.object`/`embedMany` behind the frozen `ProviderAdapter` boundary → RAG
  retrieval (Postgres/pgvector, embeddings) → token optimization (EI-003) → prompt
  cache → telemetry (redacted).
- Provider selection evidence: QUALITY → EVIDENCE → USABILITY → FREE/LOCAL → COST;
  paid/materially-better options require evidence-backed approval cards.
- SPRINT-029 reads the capability view (READY capability ids) through the marketplace
  surface — provider identity is never baked into proactive logic.

## 23. Current Limitations

- Real STT/TTS providers are **OPERATOR-REQUIRED** (`voice.status` reports MOCK, never
  CONFIGURED, until an operator sets `VOICE_STT_*` / `VOICE_TTS_*`); streaming STT
  deferred.
- Live provider execution, live GitHub OAuth/discovery/repo scanning, live AI-world
  discovery sources, OTel/Langfuse live export, `OPS_OPERATOR_IDS` activation and
  Postgres provisioning are operator steps (deterministic hermetic defaults; no
  fabricated live claims).
- The proactive cadence refresh is now wired (SPRINT-030) — the scheduler heartbeat
  can optionally call `ProactiveIntelligenceService.refreshDiscovery` with
  `runDiscovery:false` (recommendation refresh only, no autonomous action, no-spam
  preserved) — but it is **not productized** behind an operator policy/settings UI
  (SPRINT-031 scope); user-triggered refresh remains the primary path.
- Live multi-provider decomposition + execution over real providers remains
  **OPERATOR-REQUIRED** (credentials + configured registry). The Fabric validates the
  bounded shape of any future decomposition (`WorkflowBounds`) but executes nothing.
- `listOutcomeMemory` on the proactive Brain port returns empty (the Brain application
  service does not expose outcome memory directly) — learning recommendations are
  therefore not currently produced by `refresh`; the seam is honest (no fabrication).
- SPRINT-033/034/035: live world signals + live multi-provider decomposition/execution
  remain **OPERATOR-REQUIRED**; revenue figures are evidence-only (a stream with no
  revenue evidence stays UNKNOWN — nothing fabricated); the workflow execution
  blueprint is a REPRESENTATION — acting on it requires the existing approval authority
  - the operator-required execution path; outcome feedback only ever moves a factor by
    ≤ 0.05 per single verified outcome (proven by the SPRINT-035 calibration benchmark
    13/13); the Command Center drill-downs/timeline/cost view are IMPLEMENTED but the
    deep analytics charts + multi-turn voice conversations remain FUTURE; coverage is
    recomputed (gate 45/45).
- SPRINT-036: multi-provider ORCHESTRATION PLANS are IMPLEMENTED + TESTED (deterministic
  fixture harness 11/11, gateway procedures, owner-scoped durable store) — but live
  multi-provider EXECUTION remains **OPERATOR-REQUIRED** (no production credentials, no
  live calls; the normal suite is hermetic). Plan-level costs are EXPECTED (fabric
  selection evidence), never OBSERVED — observed provider economics require live
  CostLedger data. Autonomy levels are unchanged. Provider count is not a KPI —
  capability coverage, reliability, cost efficiency and verification quality are.
- SPRINT-037: the APPROVED-PLAN → EXISTING-BRIDGE path is IMPLEMENTED + hermetic-TESTED
  (adapter structural gates, Brain-controlled approval, `world.startOrchestrationPlan`
  composing `ExecutionRunService.start`, Command Center lifecycle view) — but LIVE
  provider execution remains **OPERATOR-REQUIRED** (production-config-check reports AI
  PROVIDERS NOT_CONFIGURED in this environment; the `integration:provider` operator test
  fails fast without credentials — verified). Plan/step costs remain EXPECTED
  (fabric selection evidence); OBSERVED cost requires a real provider call + live
  CostLedger data (SPRINT-038+ scope). No revenue is claimed from analytical
  workflows.
- SPRINT-038: the opportunity-discovery domain is IMPLEMENTED + TESTED (260 world-model
  tests, 20/20 benchmark) with **EMPTY datasets by design** — NO fabricated customers,
  revenue or market data; the founder/user can enter REAL observations (register
  problem → evidence → customer signals → verified payments) immediately. Live world
  signals + real provider execution remain **OPERATOR-REQUIRED**; observed provider
  cost requires real calls + CostLedger data; the outcome/score calibration
  benchmark and voice presentation of the radar were delivered (SPRINT-035); Command
  Center drill-downs for problems/experiments were delivered (SPRINT-039). No real
  customer or revenue evidence exists in the repository.
- SPRINT-039: the founder evidence loop is IMPLEMENTED + TESTED (world-model 298 tests
  / 23 files, evidence:benchmark 20/20 + discovery:benchmark 10/10) with **EMPTY
  datasets by design** — NO fabricated observations, prospects, customers or revenue;
  real founder observation entry (observe → prospects → verified payments) is READY
  now. Live world signals + real provider execution remain **OPERATOR-REQUIRED**; the
  bounded-Δ calibration envelope is proven hermetic but real-world factor mapping
  should be reviewed with the first live dataset. No real customer or revenue
  evidence exists in the repository.
- SPRINT-040: the local runtime path is VERIFIED LIVE — register/login → founder
  observation → provenance validation → evidence persistence → scoring → customer
  discovery → next-best-action → verified-payment progression over Docker
  Postgres/Redis (web served via `next dev`; only LOCAL TEST data used). The identity
  `users` table now bootstraps idempotently on startup (estate `ensureTable()`
  convention — fixes first-run `REGISTRATION_FAILED`), and dev/test sign-up
  auto-verifies the email because the estate has NO verification delivery (no SMTP);
  production/staging behavior is unchanged and a real verification flow remains a
  documented future requirement. `vedmoulya-web` is NOT a container (not in compose).

## 24. Infrastructure Requirements

- Node ≥ 20 + npm workspaces; PostgreSQL 16 + pgvector and Redis (production; Docker
  Compose provided); `scripts/startup.sh --dev` / `npm run preflight` / `npm run doctor`
  for environment validation; `npm run verify` for the bounded CI-style gate.
- Production fail-closed: no silent mocks (`AI_ENABLE_MOCK`, `VOICE_ENABLE_MOCK`),
  `AUTH_JWT_SECRET`, `OPS_OPERATOR_IDS`, Redis for multi-instance rate limiting.
- Browser: Chrome (E2E/visual baselines); mobile: Capacitor Android wrapper.

## 25. Known Technical Debt

- Gateway branch coverage is above the 80% gate as of SPRINT-030 (81.33%) — held by
  the FabricRouter + FabricBridgePorts suites; continued vigilance required on new
  router code.
- `RouterRegistry.ts` (~5.6k lines) and `ApiApplicationService.ts` (~1.6k lines) are
  near the readability ceiling (documented in SPRINT-026).
- Frozen pre-022 EI repositories' latent `sql.json()` pattern: already fixed repo-wide
  in practice (SPRINT-022/027 verified); the frozen pre-022 docs still describe the old
  pattern (historical).
- Some intelligence stores remain in-memory in production paths (documented operator
  steps to swap to Postgres-backed stores).
- Proactive scheduler cadence wired but not productized behind operator policy UI
  (SPRINT-031).

---

## Appendix A — SPRINT-029/030 state at a glance

| Item                                                                                                                                                                                            | Status                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `packages/proactive` (recommendation model, A/B/C/D policy, automation discovery, business assessor, briefing, composition service)                                                             | IMPLEMENTED + TESTED                                                                      |
| Gateway `proactive.*` namespace (6 procedures, auth + rate limit + IDOR)                                                                                                                        | IMPLEMENTED + TESTED                                                                      |
| Owner-scoped store (in-memory + Postgres)                                                                                                                                                       | IMPLEMENTED + TESTED                                                                      |
| `ProactivePanel` in AICompanion                                                                                                                                                                 | IMPLEMENTED + TESTED                                                                      |
| `packages/intelligence-fabric` (orchestration contract, selection strategies, health ledger, cost guard, workflow bounds, verification chain, normalizer, autonomy policy, composition service) | IMPLEMENTED + TESTED                                                                      |
| Gateway `fabric.*` namespace (8 procedures, auth + rate limit + IDOR)                                                                                                                           | IMPLEMENTED + TESTED                                                                      |
| `FabricBridgePorts` (CostLedger + registry seams)                                                                                                                                               | IMPLEMENTED + TESTED                                                                      |
| `FabricPanel` Provider Network in AICompanion                                                                                                                                                   | IMPLEMENTED + TESTED                                                                      |
| Cadence refresh of proactive recommendations                                                                                                                                                    | IMPLEMENTED (wired) — productization behind operator policy UI is **FUTURE** (SPRINT-031) |
| Live multi-provider decomposition + execution                                                                                                                                                   | **OPERATOR-REQUIRED / FUTURE** (credentials + configured registry)                        |
| Real live discovery sources / live execution of proposals                                                                                                                                       | **OPERATOR-REQUIRED / FUTURE**                                                            |

## Appendix B — Status legend applied to the sprint chain

| Sprint                                                       | Planned                                                                                                                                                                                                                                                                                                                                                                                                                                 | Implemented                                                        | Tested                                                                                                                                                                                                                                | Mocked                                                                                                                       | Operator-required                                                                                                              | Partial                                                                                                        | Future                                                                                                                              |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| SPRINT-026 (audit + architecture)                            | 16-phase audit                                                                                                                                                                                                                                                                                                                                                                                                                          | all phases                                                         | core spot-checks 251/251                                                                                                                                                                                                              | —                                                                                                                            | —                                                                                                                              | —                                                                                                              | voice runtime + proactive (delivered 027–029)                                                                                       |
| SPRINT-027 (integrity + speech foundation)                   | R-1/R-2 + speech seams                                                                                                                                                                                                                                                                                                                                                                                                                  | R-1, R-2, packages/voice, hygiene                                  | full suite green                                                                                                                                                                                                                      | STT/TTS mock adapters                                                                                                        | real STT/TTS                                                                                                                   | —                                                                                                              | voice UX (SPRINT-028)                                                                                                               |
| SPRINT-028 (voice assistant)                                 | real adapters + Brain bridge + UX                                                                                                                                                                                                                                                                                                                                                                                                       | all                                                                | full suite green                                                                                                                                                                                                                      | mocks never masquerade                                                                                                       | real STT/TTS credentials                                                                                                       | —                                                                                                              | streaming STT                                                                                                                       |
| SPRINT-029 (proactive + automation)                          | proactive intelligence + A/B/C/D + briefing + business pipeline + UX                                                                                                                                                                                                                                                                                                                                                                    | all                                                                | full suite green                                                                                                                                                                                                                      | —                                                                                                                            | live discovery/execution                                                                                                       | outcome-memory evidence                                                                                        | multi-provider workflow decomposition                                                                                               |
| SPRINT-030 (intelligence fabric)                             | orchestration contract + selection + health + cost + bounds + verification + autonomy + cadence + UX                                                                                                                                                                                                                                                                                                                                    | all                                                                | full suite green (8 613 / 1 skip)                                                                                                                                                                                                     | —                                                                                                                            | live multi-provider execution                                                                                                  | —                                                                                                              | cadence productization, outcome-memory evidence into selection (SPRINT-031)                                                         |
| SPRINT-031 (active intelligence + control plane)             | autonomy control plane (settings, emergency stop, cycle, gates, opportunities)                                                                                                                                                                                                                                                                                                                                                          | all (packages/control-plane)                                       | full suite green                                                                                                                                                                                                                      | —                                                                                                                            | live execution                                                                                                                 | —                                                                                                              | —                                                                                                                                   |
| SPRINT-032 (world model + business OS)                       | bounded world graph + business units + opportunity economics + AI workforce + workflow factory + signals                                                                                                                                                                                                                                                                                                                                | all (packages/world-model)                                         | full suite green (8 793 / 1 skip)                                                                                                                                                                                                     | signal sources UNAVAILABLE                                                                                                   | live world signals, live multi-provider execution                                                                              | outcome-memory evidence into pipeline scoring                                                                  | founder command center (SPRINT-033+)                                                                                                |
| SPRINT-033 (autonomous company OS)                           | founder briefing + revenue intelligence + execution blueprint + opportunity extensions                                                                                                                                                                                                                                                                                                                                                  | all (world-model extended)                                         | world-model 142/142 · gateway 947+1 skip · web 203/203 · typecheck 0 · lint 0 · build PASS                                                                                                                                            | revenue figures UNAVAILABLE/UNKNOWN by default                                                                               | live world signals, live multi-provider execution                                                                              | founder command center FUTURE                                                                                  | live signal adapters, blueprint→approved execution, revenue→outcome feedback                                                        |
| SPRINT-034 (command center + activation)                     | founder command center + outcome feedback + live signal adapter + approval-gated blueprint + cost-weighted ranking                                                                                                                                                                                                                                                                                                                      | all (world-model extended)                                         | world-model 187/187 · gateway 951+1 skip · web 214/214 · typecheck 0 · lint 0 · build PASS                                                                                                                                            | signals/execution/revenue inflow OPERATOR-REQUIRED                                                                           | live world signals, approved-blueprint execution, real revenue inflow                                                          | command center drill-downs, coverage recompute                                                                 | outcome calibration, voice presentation, operator signal runbook                                                                    |     | SPRINT-035 (hardening + calibration) | coverage recompute + command center drill-downs + timeline + cost view + calibration benchmark + voice presentation + signal runbook + production config check | all (world-model/voice/gateway/web extended) | world-model 200/200 · gateway 985+1 skip · web 216/216 · voice 115/115 · typecheck 0 · lint 0/0 · build PASS · benchmarks 17/17 · coverage gate 45/45 | signals/execution/voice/Postgres OPERATOR-REQUIRED | live world signals, approved-blueprint execution, real revenue inflow, Postgres, STT/TTS | deep analytics charts, multi-turn voice conversations | real operator activation run, category-scoped historical evidence windows |
| SPRINT-036 (multi-provider orchestration)                    | bounded orchestration plans (per-step binding + WHY + expected cost + retry/fallback policy) + benchmark + gateway procedures                                                                                                                                                                                                                                                                                                           | all (world-model + gateway extended; NEW ENGINES CREATED: 0)       | world-model 214/214 · gateway 987+1 skip · typecheck 0 · lint 0/0 · build PASS · benchmarks 18/18 (provider 11/11) · coverage gate 45/45 (world-model 92.49/82.72/92.95/95.19; api 80.32 branch)                                      | — (hermetic fixtures, never a fake SUCCESS)                                                                                  | live multi-provider EXECUTION, production provider credentials                                                                 | —                                                                                                              | observed provider economics from the ledger, wiring an APPROVED plan into the bridge plan source, Command Center orchestration view |
| SPRINT-037 (live orchestration + real-world execution proof) | approved-plan → existing-bridge adapter + Brain-controlled approve + startOrchestrationPlan + Command Center lifecycle + integration:provider operator test                                                                                                                                                                                                                                                                             | all (world-model + gateway extended; NEW ENGINES CREATED: 0)       | world-model 220/220 · gateway 1000+1 skip · typecheck 0 · lint 0/0 · build PASS · benchmarks all PASS (16/16 + 13/13 + 11/11) · coverage gate 45/45 (world-model 92.49/82.37/93.2/95.2; api 80.32 branch)                             | AI providers NOT_CONFIGURED (production-config-check)                                                                        | LIVE provider execution (credentials + a real configured provider), observed cost telemetry                                    | —                                                                                                              | live provider execution proof (SPRINT-038+), real observed-cost calibration, capability-gap notifications                           |
| SPRINT-038 (opportunity discovery + revenue validation)      | practical problem representation + evidence/provenance + three advisory scores + levels 0–4 + bounded lifecycle + verified-payment-only revenue ladder + zero/low-cost experiment planner + customer discovery prep + STOP + business candidate + fabric provider economics + capability-gap notifications + Opportunity Radar                                                                                                          | all (world-model + gateway + web extended; NEW ENGINES CREATED: 0) | world-model 260/260 (21 files) · gateway 1000+1 skip · web 218/218 · typecheck 0 · lint 0/0 · build PASS · benchmarks all PASS (+ opportunity 20/20) · coverage gate 8/8 touched (world-model 91.21/82.14/92.33/94.2)                 | EMPTY datasets by design (no fabricated customers/revenue/market data); AI providers NOT_CONFIGURED                          | live world signals, real provider execution, observed cost telemetry, real customer/revenue evidence (operator/founder entry)  | outcome/score calibration benchmark, voice presentation of the radar, Command Center drill-downs               | real observation entry + live signal sources + revenue validation against real customers                                            |
| SPRINT-040 (local runtime verification)                      | first end-to-end operational path: Docker runtime → register/login → founder observation → provenance validation → evidence persistence → scoring → customer discovery → next-best-action → verified-payment progression; fixes: identity `users` table bootstrap (ensureTable convention — D1), `IDENTITY_DATABASE_URL` in .env.local (D2), dev/test-only sign-up email auto-verify (D3, production unchanged), .next cache clear (D4) | identity + api + web fixed (NEW ENGINES CREATED: 0)                | world-model 298/298 · identity 283/283 · api 1010/1010 · web 220/220 · typecheck 0 · lint 0/0 · build PASS · benchmarks all PASS · coverage gate 2/2 (identity 88.14/80.39/92.39/89.07; api 93.01/80.07/95.03/93.83)                  | ONLY LOCAL TEST data (auth accounts + fictional problem/prospects/payments, all clearly marked); AI providers NOT_CONFIGURED | real founder observation entry (ready), live world signals, real provider execution, real customers/revenue (operator/founder) | production email-verification flow (pre-existing gap, unchanged), web container in compose                     | real founder data entry + live signal sources + revenue validation against real customers                                           |
| SPRINT-039 (founder evidence loop)                           | founder observations (provenance-required) + evidence states + customer-discovery ledger + bounded calibration (Δ ≤ 0.05) + 8-dimension evidence quality + explainable next best action (incl. STOP) + evidence-driven comparison + Command Center drill-downs + voice read-only presentation                                                                                                                                           | all (world-model + gateway + web extended; NEW ENGINES CREATED: 0) | world-model 298/298 (23 files) · gateway 1010 (50 files) · web 219/219 · typecheck 0 · lint 0/0 · build PASS · benchmarks all PASS (+ evidence 20/20, discovery 10/10) · coverage gate world-model 91.11/82.18/90.83/94.34 · api PASS | EMPTY datasets by design (no fabricated observations/prospects/customers/revenue); AI providers NOT_CONFIGURED               | live world signals, real provider execution, observed cost telemetry, real founder observation entry (ready now)               | operator runbook for observation/prospect entry, founder "evidence journey" view, real-data calibration review | real observation entry + live signal sources + revenue validation against real customers                                            |

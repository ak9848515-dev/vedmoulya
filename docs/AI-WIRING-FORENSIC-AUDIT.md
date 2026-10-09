# AI WIRING & GENUINENESS FORENSIC AUDIT — VedMoulya

Mode: READ-ONLY. No source file modified. Repo: `D:\VedMoulya`. Date: 2026-10-08.
Method: per-capability input→output trace; code vs test vs live evidence separated from inference.
Statuses: RUNTIME_PROVEN / IMPLEMENTED_NOT_RUNTIME_PROVEN / MISSING / UNWIRED / SYNTHETIC_ONLY / UI_ONLY / BROKEN.

## 1. EXECUTIVE VERDICT — MIXED / MOSTLY GENUINE

The central AI spine is genuinely wired end-to-end: UI → tRPC `ai.stream`/`ai.orchestrate` → `AIRouter` → per-user `AIOrchestrationService` → `ProviderRoutingAdvisor`/candidates → real `ProviderAdapter.execute()` → vendor API → response → `CostLedger`/`AiUsageRecorder`/`ExecutionHealthService` → UI. No synthetic success is possible: `MockLastResort` pins mock as last-resort-only and all-real-failure yields honest error.
Ask VedMoulya is genuinely wired; its generic failure ("I could not complete that request right now") is a root-caused, regression-tested routing failure surface, not a placeholder (`AICompanion.handleSend catch`, `AICompanion.tsx:345-355`; cause pinned in `AskStreamProviderFallback.test.ts:5-15`: `stream()` tried only `candidates[0]` while `orchestrate()` iterated candidates — fixed).
Mission → real AI is genuinely wired (`MissionService` → `createMissionRuntime()` → planner/agent ports → adapters → governed tools → verification → checkpoint → memory). Live evidence via Ollama acceptance scripts; full prod live is operator-gated.
Ollama direct execution is RUNTIME_PROVEN (`qwen2.5-coder:7b-instruct`→HELLO consistent with `scripts/diag-ollama-adapter.ts`, `scripts/benchmark-project-report.ts:34-35`). Gemini storage+resolution PROVEN; live generation operator-gated. Anthropic/Claude is UNWIRED (catalog-only, explicitly disclosed). The M3 `@vedmoulya/api` string is a TEST FIXTURE literal (`MissionServiceBranches.test.ts:304`), not a production failure. No fake-AI screens found.
Score: RUNTIME_PROVEN ~25% / IMPLEMENTED_NOT_RUNTIME_PROVEN ~50% / UI_ONLY+SYNTHETIC ~25%.

## 2. ARCHITECTURE INVENTORY (condensed)

- UI Ask: `apps/web/src/components/AICompanion.tsx` (drawer; callers: AppShell, /ai, home) + `lib/ask-vedmoulya.ts` (intent/context/history). Prod-referenced YES.
- Providers UI: `app/providers/page.tsx`, `ProviderConnectFlow.tsx`, `SimpleProviderConfig.tsx`, `LocalAiPanel.tsx`, `local-ai-agent.ts`. YES.
- AI hub `/ai` (`app/ai/page.tsx`): status-only, honest, no AI call claimed. YES.
- Mission UI: `app/autonomous-builder/page.tsx`, `app/missions/**`. YES.
- Gateway: `services/api/src/router.ts` → `RouterRegistry.ts` → `routers/AIRouter.ts`, `ProvidersRouter.ts`, `MissionRouter.ts`; served from `apps/web/src/app/api/trpc/[trpc]/route.ts`. YES.
- App service: `services/ApiApplicationService.ts` (wires runtime, credentials, ledger). YES.
- User providers: `services/MissionUserProviders.ts` (`createUserAiOrchestratorResolver`, `createMissionUserProviderRegistrar`). YES.
- Setup: `services/ProviderSetupOrchestrator.ts` + `ProviderConnectionTester.ts` (probe + real validation generation + encrypted persist). YES.
- Runtime: `packages/services/src/ai/AIOrchestrationService.ts` (`orchestrate`, `stream`, `canServe`). YES.
- Routing: `runtime/ProviderRoutingAdvisor.ts`, `ModelSelectionIntelligence.ts`. YES.
- Adapters: `services/orchestrator/src/providers/*.ts`, registrar `index.ts:registerPlatformProviders`. YES (no Anthropic adapter exists).
- Catalog: `packages/providers/src/catalog/provider-catalog.ts`; credentials `PostgresProviderCredentialStore.ts`. YES.
- Mission: `packages/mission-runtime/src/composition/MissionRuntime.ts` + `services/MissionService.ts`. YES.
- Memory/learning: `execution-memory`, `memory-intelligence`, `brain/BrainOutcomeMemory`, `learning-intelligence`, `observability/AiUsageRecorder.ts`, `CostLedger.ts`, `ExecutionHealthService.ts`. YES (wired; live proof partial).
- Local AI: `packages/local-ai/*` + browser-direct `local-ai-agent.ts` (parallel lane + `recordLocalUsage` telemetry). YES.
- Voice: `packages/voice/*`, `routers/VoiceRouter.ts`, `components/VoicePanel.tsx` (real adapters exist; dev default mock, labeled). PARTIAL.

<!--APPEND-->

## 3. AI SCREEN INVENTORY (handlers real; no empty/no-op AI handler found)

1. Ask drawer (`AICompanion.tsx`): send → `handleSend:325` → `runAnswer:228`/`runMissionAction` → `api.ai.stream` + `mission.createAndRun` → user runtime → routed adapter → replay `:285-323`. IMPLEMENTED_NOT_RUNTIME_PROVEN path; adapters RUNTIME_PROVEN.
2. AI hub (`app/ai/page.tsx`): `ai.readiness` status only + links. GENUINE.
3. Providers (`app/providers/*`): Connect → `providers.setupProvider` → `ProviderSetupOrchestrator` (probe + real validation generation + encrypted persist). RUNTIME_PROVEN wiring; live needs key.
4. Local AI (`LocalAiPanel.tsx`/`local-ai-agent.ts`): browser→agent direct + `ai.recordLocalUsage`. IMPLEMENTED_NOT_RUNTIME_PROVEN.
5. Autonomous Builder (`:60` createAndRun) → `MissionService` → `MissionRuntime`. IMPLEMENTED_NOT_RUNTIME_PROVEN (scripts operator-gated).
6. Missions: same runtime as 5. Same status.
7. Brain: `brain.*` + runtime ports (advisory). IMPLEMENTED_NOT_RUNTIME_PROVEN.
8. Voice in Ask: `voice.*` → real answer port or labeled mock. MIXED (honest).
9. Home Ask input: entry into Ask, no second engine. GENUINE.
10. Domain surfaces: CRUD genuine; AI only where port-wired (Content Agency/factory/loop wired; others honest data views, no fabricated AI output).

## 4. FAKE/PLACEHOLDER DETECTION

- `MockProvider.ts:50-110` mock text — fenced dev/test adapter; prod only with `AI_ENABLE_MOCK=true` (`index.ts:272-277`). NONE.
- Voice mock adapter `kind:MOCK`, prod-refused unless flag. Dev-only.
- `ASK_INPUT_HINTS` declared hints, never state. NONE.
- `AICompanion.tsx:317,352` honest failure copy, generic. LOW.
- 4 SDK adapters report `healthy` from key-presence (only raw OpenAI + Ollama probe live). LOW-MEDIUM, mitigated by setup-time real validation.
- Anthropic `runtimeNote` discloses catalog-only. No coming-soon/TODO-gap/hardcoded-success/fixture-in-prod on execution paths.

<!--APPEND2-->

## 5. PROVIDER MATRIX

- google/Gemini: key-gated; `GoogleGeminiProvider` (SDK `@ai-sdk/google`); creds platform+per-user (`resolveGoogleKey`, `ProviderCredentialService.resolve`); models `gemini-3.5-flash` (+catalog 2.5 stale-risk); adapter-tested; live operator-gated. OPERATIONAL when key present.
- openai: key-gated; `VercelAIProvider` SDK primary (+`OpenAIProvider` REST iff `OPENAI_VIA_REST=true`); `resolveOpenAIKey`+legacy; `gpt-4o-mini`; 13/13 SDK regression; live operator step. OPERATIONAL when key present.
- deepseek: SDK via `https://api.deepseek.com`; `resolveDeepSeekKey`; `deepseek-chat`; 16/16 tests; live operator step. OPERATIONAL when key present.
- ollama: URL-gated; `/api/chat`+`/api/tags`, 120s timeout; preference→installed resolution, `configuredModel`, typed `MODEL_NOT_FOUND`; LIVE-PROVEN (`qwen2.5-coder:7b-instruct`→HELLO; diag+benchmark scripts). OPERATIONAL when daemon reachable.
- openrouter: shared `OpenAICompatibleProvider` (`https://openrouter.ai/api/v1`); `resolveOpenRouterKey`; default `openai/gpt-4o-mini`; adapter-tested; live operator step.
- custom: shared adapter; explicit endpoint+key. OPERATIONAL when configured.
- anthropic: CATALOG+PRESET ONLY, `adapter:null` (`provider-catalog.ts:237-299`), explicit `runtimeNote`, absent from registrar. UNWIRED (disclosed).
- mock: dev/explicit only, fixed `mock-v1`, last-resort rule pinned. SYNTHETIC fenced.

## 6. MODEL MATRIX

- `gemini-3.5-flash`: configurable, routable, adapter-tested, live operator-gated → IMPLEMENTED_NOT_RUNTIME_PROVEN.
- `gemini-2.5-pro/flash` (catalog): stale-risk vs platform pin → IMPLEMENTED_NOT_RUNTIME_PROVEN, do not trust without live check.
- `gpt-4o-mini/4o/4.1/o4-mini/4.1-mini`: SDK-tested → IMPLEMENTED_NOT_RUNTIME_PROVEN (live).
- `deepseek-chat/reasoner`: tested → IMPLEMENTED_NOT_RUNTIME_PROVEN (live).
- `openai/gpt-4o-mini` (openrouter): shared-adapter tested → IMPLEMENTED_NOT_RUNTIME_PROVEN.
- `llama3.2`/env/installed + `qwen2.5-coder:7b-instruct`: LIVE-PROVEN → RUNTIME_PROVEN.
- `claude-opus-4-1/sonnet-4-5/haiku-4-5`: catalog only, no adapter → CONFIGURED_ONLY/unexecutable.
- `mock-v1/mock-1`: SYNTHETIC fenced lane.

## 7. INPUT→OUTPUT TRACES

A. Ask: input `:627` → `handleSend:325` → intent+context+history → `api.ai.stream` → `AIRouter.stream:194` (per-user runtime, owned trace, D1 flush) → `AIOrchestrationService.stream:806` (cache→context→candidates→advisor→retry/stream→validate→evidence/abstain) → routed `stream()/execute()` → events replay `:285-323`; failure → catch-all `:352`. Status: path IMPLEMENTED_NOT_RUNTIME_PROVEN; adapters RUNTIME_PROVEN.
B. Setup: `/providers` Connect → `providers.setupProvider` → `ProviderSetupOrchestrator` (discover→probe→real `validateProviderGeneration`→encrypted persist→enable); `connected` true only on SUCCESS. RUNTIME_PROVEN wiring; live needs key.
C. Model selection: `ModelSelector` renders discovery only; `choosePreferredModel`; advisor `decide`; Phase-B contract forbids silent substitution (`AIOrchestrationService.ts:64-70`). IMPLEMENTED_NOT_RUNTIME_PROVEN.
D/E. Mission/Builder: RUN → `mission.createAndRun` → `MissionService` (ownership, lock, detached loop) → `createMissionRuntime()` (selector→planner port→agent port→`orchestrate`→governed tools→artifact verification→checkpoint→`ingestRun`→advisory). Production path from call sites; live scripts Ollama-backed, full prod operator-gated. IMPLEMENTED_NOT_RUNTIME_PROVEN.
F. Brain: `brain.*` advisory via runtime ports. IMPLEMENTED_NOT_RUNTIME_PROVEN.
G. Local AI: G1 gateway Ollama lane RUNTIME_PROVEN; G2 browser→agent lane real code + telemetry, IMPLEMENTED_NOT_RUNTIME_PROVEN.
H. Artifacts/delivery: `MissionDeliveryPanel`, commercial-pending, revenue scripts — real plumbing, live operator-gated.
<!--APPEND3-->

## 8. ASK VEDMOULYA SPECIFIC

Chain: input `:627` → `handleSend:325` → `runAnswer:228` → `api.ai.stream` → `AIRouter.stream:194` → `createUserAiOrchestratorResolver` (`MissionUserProviders.ts:146`) → `AIOrchestrationService.stream:806` → adapter `stream()` → UI replay → catch-all `:352`. Proven historical cause: `stream()` tried only `candidates[0]` (fixed; fallback pinned by `AskStreamProviderFallback.test.ts`). Other causes (unranked w/o keyed repro): no provider, bad/quota key, Ollama down, timeout, abstention. Failure class today: routing/execution + generic error mapping. NOT UI-only, NOT fabrication.

## 9. OLLAMA E2E

Base URL `AI_OLLAMA_BASE_URL`→`resolveOllamaBaseUrl` (`index.ts:151-153`); preset default `http://localhost:11434`; `.env.local:46,101` sets it. Model preference→installed-set resolution, `configuredModel`, explicit-`modelId` mismatch → `OllamaModelNotFoundError`. `POST {base}/api/chat`, parser `:319-353`, 120s timeout, health `/api/version`, streaming parity, structured via schema-instruction + runtime validation. Proven: direct lane RUNTIME_PROVEN (HELLO + diag/benchmark scripts); Mission via Ollama script-evidenced; Ask via Ollama shared-path (isolated trace IMPLEMENTED_NOT_RUNTIME_PROVEN).

## 10. GEMINI (storage != generation)

Setup probe + real validation generation → encrypted `PostgresProviderCredentialStore` → `resolveGoogleKey` / per-user `resolve` (`MissionUserProviders.ts:90-92`) → registration (`index.ts:214-220`) → advisor/candidates → `GoogleGeminiProvider` SDK calls (thinking-budget guard, error normalization `:393-413`) → ledger/UI. Storage PROVEN; resolution PROVEN; execution IMPLEMENTED+tested; live generation OPERATOR-GATED (no in-repo transcript; `ai:production:verify` exists).

## 11. OTHER CLOUD PROVIDERS

OpenAI/DeepSeek/OpenRouter/Custom: credentials-supported + adapter-tested, live operator-gated (status 2 of brief scale). Anthropic: UI/catalog-only (5+4). Mock: fenced mock-only (7). None claimed operational from compilation alone.

## 12. ROUTER AUDIT

Requirements via factory+domain rules; candidates `selectCandidates:269-318` (capability/health/disabled/preferred); advisor ordering when EI ports wired; `canServe` honest readiness; `recordExecutionHealth` feedback. REAL available→mock wins? NO (`MockLastResort` pins real execution even when advisor ranks mock first). REAL fails→synthetic? NO (real-candidate iteration; mock excluded unless mock-only). ALL fail→honest `ProviderExecutionFailed` naming providers + last cause, no mock usage recorded (cases 3/3b/6-7). Stream fallback fixed + pinned (partial-content failure propagates real error, no duplication).

## 13. MISSION→AI + M3 ANALYSIS

Production path from call sites: Builder RUN → `MissionRouter` → `MissionService.ts:22-34` → `createMissionRuntime()` (`MissionRuntime.ts:7-17` chain) → views → polling. Controller never touches SDKs/shell/git directly. M3 `@vedmoulya/api does not resolve`: ONLY a test objective literal (`MissionServiceBranches.test.ts:304`); no `@vedmoulya/api` workspace exists; no production import. It exercises constraint classification BEFORE AI execution. Verdict: NON-ISSUE, not a runtime defect; NOT PROVEN as any failure.
<!--APPEND4-->

## 14. MEMORY/LEARNING

- Execution memory: adapter→`ingestRun` (sanitized real runs); in-memory / Postgres via `ensureMissionPersistence`. Tests green; live PG operator-gated → IMPLEMENTED_NOT_RUNTIME_PROVEN.
- Brain learning: `recordLearning` (UNKNOWN/FAILED never SUCCESS) + `correctLearning`; 15-journey 25/25 hermetic → IMPLEMENTED_NOT_RUNTIME_PROVEN.
- Experience: advisory-only; never overrides health. IMPLEMENTED by design.
- Usage/cost: `AiUsageRecorder.record` + `CostLedger` + D1 `flushUsage`; ledger tests green → IMPLEMENTED_NOT_RUNTIME_PROVEN (prod live).
- Health/evidence: `recordExecutionHealth` fire-and-forget → bounded ledgers. Same status.
- Ask conversation memory: none by design (honestly absent).

## 15. FAILURE HONESTY — PASS

No failure→success conversion found. Pins: `MockLastResort` 3/3b/6-7, `AskStreamProviderFallback`, `FailureSafety`, verdict→UNKNOWN. Non-fabricating gaps: generic Ask copy; key-presence health x4.

## 16. THREE CATEGORIES

A. RUNTIME PROVEN: Ollama direct; credential persist+resolve; setup validation pipeline; router safety suites; cloud adapter execution shape (tested + key-gated script).
B. IMPLEMENTED_NOT_RUNTIME_PROVEN: Ask/Mission live; cloud live generation; model-selection live; Local-Agent direct; voice real adapters; durable memory/learning/usage live; content/factory/loop AI live.
C. UI_ONLY/SYNTHETIC/BROKEN: Anthropic execution (UNWIRED, disclosed); ~15 peripheral dashboards as invokers; fenced mock; voice mock dev default; M3 string (non-issue).
<!--APPEND5-->

## 17. EVIDENCE QUALITY (code | test | live | inference)

Ask: `AICompanion.tsx:228-359` | fallback + ux08 + companion tests | operator-gated; incident in test header | current cause provider-side until keyed repro (INFERENCE). Mission: `MissionService.ts:22-34`, `MissionRuntime.ts:7-17` | runtime-e2e + product-001 + branches tests | `scripts/live-*-acceptance.ts`, `bld023-live-acceptance.ts` | full prod operator-verified (INFERENCE). Ollama: `OllamaProvider.ts:76-260` | adapter tests | HELLO + diag/benchmark scripts | none. Gemini: store + resolvers + adapter | credential + adapter + user-provider suites | `ai:production:verify` operator step, no transcript | live given valid key (INFERENCE). Anthropic: preset note + `adapter:null` + registrar absence | alignment tests | N/A | none. No-synthetic: `MockLastResort` + gating | deterministic | — | none. M3: test literal `:304`, no such workspace | — | — | none.

## 18. READ-ONLY CHECKS

Source, package.json, routes, config (key-presence only), health code, adapter code inspected; suites read, not executed. No modifications, installs, env/credential/DB changes, commits.

## 19. VERDICT Q1–Q17

Q1 MOSTLY GENUINE. Q2 No fake-AI screens; one UNWIRED provider surface (Anthropic, disclosed). Q3/Q4 per §5/§6. Q5 flows §7. Q6 Ask YES (§8). Q7 Mission YES (§13, scripts-evidenced, prod operator-gated). Q8 Ollama: infra YES, direct PROVEN, Mission script-evidenced, Ask shared-path. Q9 Gemini: storage PROVEN, resolution PROVEN, execution tested, live operator-gated. Q10 §11. Q11 Mock accident NO (pinned). Q12 Honest YES (§15). Q13 Memory wired, live gated; Ask memory honestly absent. Q14 25/50/25 over ~10 groups. Q15 Gap: missing Anthropic adapter. Q16 Risk: narrow live-proven surface; one bad key reproduces generic Ask failure (fallback mitigates). Q17 Action: ship Anthropic adapter or gate Claude out of selectable surfaces.

## 20. SCORE / GAPS / NEXT ACTION / EVIDENCE TABLE

Score: PROVEN 25% / IMPLEMENTED 50% / UI-SYNTHETIC 25%. Gaps: (1) Anthropic adapter; (2) cloud live transcripts absent; (3) generic Ask copy; (4) key-presence health x4; (5) stale-risk `gemini-2.5-*` ids. Next: add `orchestrator/providers/AnthropicProvider.ts` + key resolution + user family + tester support; flip catalog `adapter:null`; else mark preset non-executable. Key files: `AICompanion.tsx`; `ask-vedmoulya.ts`; `routers/AIRouter.ts`; `services/{ApiApplicationService,MissionUserProviders,ProviderSetupOrchestrator,ProviderConnectionTester,MissionService}.ts`; `AIOrchestrationService.ts` + `ProviderRoutingAdvisor.ts` + `__tests__/{MockLastResort,AskStreamProviderFallback}.test.ts`; `orchestrator/index.ts` + `providers/*`; `providers/catalog/provider-catalog.ts` + `PostgresProviderCredentialStore.ts`; `mission-runtime/composition/MissionRuntime.ts`; `shared/providers/providerPresets.ts`; `MissionServiceBranches.test.ts:304`.

AI WIRING FORENSIC AUDIT COMPLETE

SOURCE CHANGES:
NONE

# SYSTEM-MAP.md — Actual Architecture, Entry Points, Data Flow, Persistence

> Source-based map. Every claim below points at a real file. Where a claim could not be
> verified at runtime it is labelled **[not runtime-proven]**.

## 1. Shape of the repository

- Monorepo, npm workspaces: `apps/*`, `packages/*`, `services/*`, `tooling/*` (`package.json`).
- **47 packages** (`packages/*`), **9 services** (`services/*`), **1 application** (`apps/web`).
- `packages/*/package.json` export TypeScript **source** (`"exports": "./src/index.ts"`), so the
  workspace is a single type graph reached from source — not pre-built artifacts.
- TypeScript strict; Vitest workspace runner (`vitest.config.ts` → per-workspace `vitest.config.ts`).
- 4,928 `.ts`/`.tsx` files; **982 test files** under `packages|services|apps`.

## 2. Application layer — `apps/web`

- Next.js 15 / React 19 / Tailwind, tRPC client (`apps/web/src/lib/api-client.ts`, 4,901 lines — oversized).
- **63 routes** (`apps/web/src/app/**/page.tsx`), including:
  - Identity: `login`, `signup`, `oauth2redirect`, `verify-email`, `onboarding/profile`, `settings`.
  - Mission/revenue: `missions`, `progress`, `task-manager`, `content-agency/*`, `portal/*`.
  - Intelligence surfaces: `ai`, `ai-world`, `brain`, `intelligence`, `context-fabric`, `world` (panel),
    `capabilities`, `capability-marketplace`, `loop`, `execution*`, `os`, `ecosystem*`, `life`, `career`, `business`.
- **UX risk:** the route count is far larger than any single audited journey; several routes are catalog/
  panel surfaces whose _usability_ is asserted by their own components/tests, not by a fresh browser pass
  (see `UX-AUDIT.md`).

## 3. API gateway — `services/api`

- **49 routers** (`services/api/src/routers/*.ts`) mounted through `services/api/src/services/RouterRegistry.ts`
  (**7,003 lines — the single largest source file**).
- Composition root: `services/api/src/services/ApiApplicationService.ts` (**3,150 lines**).
- Cross-cutting middleware (`services/api/src/middleware/`): `auth.ts`, `audit.ts`, `rate-limit.ts`,
  `validation.ts`, `error.ts`.
  - `auth.ts`: real **HS256 JWT** verification (`jose`), issuer `vedmoulya`, audience `vedmoulya-api`,
    `type === 'access'`; anonymous context for public routes; `isAuthenticated`, `authenticateRequest`
    (fail-closed), and **`assertUserIdMatchesSession`** (IDOR guard).
- Notable domain services: `MissionService`, `Opportunity*` (Source/Qualification/Recommendation/Value/
  Monitoring), `MissionClientOpsHandoff`, `ProviderSetupOrchestrator`, `ProviderConnectionTester`,
  `CommercialOutcomeService`, `ProviderUsageIngestor`, `ExecutionHealthService`, `BrainDashboardService`.

## 4. Identity — `services/identity`

- `auth/AuthService.ts`, `auth/TokenService.ts` (HS256), `auth/GoogleProvider.ts`,
  **`auth/OAuthState.ts`** (server-side CSRF state: 32 random bytes, only the SHA-256 **hash** persisted,
  single-use, 10-minute TTL), `auth/VerificationToken.ts`, `auth/VerificationEmailSender.ts`.
- Authorization: `authorization/{Abilities,AuthorizationService,AuthorizationMiddleware,OwnershipGuard,Policies}.ts`.
- Persistence: `infrastructure/persistence/PostgresIdentityRepository.ts` (idempotent `ensureTable`),
  `OAuthStateStore.ts`, `VerificationTokenStore.ts`, `cache/UserCache.ts`.
- **Known gap (documented, pre-existing):** no SMTP in production ⇒ email-verification delivery is absent
  while sign-in requires a verified account; dev/test auto-verifies.

## 5. AI orchestration — `services/orchestrator`

- `AIOrchestrationService` (`packages/services/src/ai/AIOrchestrationService.ts`, 2,027 lines).
- **Provider adapters actually present**: `OpenAIProvider`, `VercelAIProvider` (primary SDK path),
  `DeepSeekProvider`, `GoogleGeminiProvider`, `OpenAICompatibleProvider` (OpenRouter + custom endpoints),
  `OllamaProvider`, `MockProvider`, `OpenAIEmbeddingProvider`.
- `registerPlatformProviders()` (`services/orchestrator/src/index.ts:170`) registers **OpenAI (Vercel SDK)**,
  **DeepSeek**, **Google Gemini**, **OpenRouter**, **Ollama**, and any **custom** endpoints; `MockProvider`
  is added when enabled (dev / non-production) and is the _only_ provider when `AI_ENABLE_MOCK=true`
  outside tests.
- **Documentation drift:** `README.md` and `09_Documents/EPIC_019_PROVIDER_RUNTIME_MATRIX.md` describe
  Google/OpenRouter/Ollama as catalog-only `UNSUPPORTED_RUNTIME`; the code registers and routes them.
- Routing intelligence: `services/orchestrator/src/index.ts` routing ports; `packages/intelligence-fabric`
  (`ProviderHealthLedger`, `CostPolicyGuard`, `SelectionStrategy`, `VerificationChainPolicy`).

## 6. Mission / autonomy

- `packages/mission-controller` — owns the autonomous lifecycle (objectives, checkpointing, approval gate,
  diagnosis/repair ports).
- `packages/planning` — frozen planner + `PlanTemplate` extension point (`PLAN_TEMPLATES`).
- `packages/agent-execution` — the execution engine (`domain/AgentExecutionEngine.ts`), verification
  (`domain/verification.ts`), recovery (`domain/recovery.ts`), plan validation.
- `packages/mission-runtime` — production composition (`composition/MissionRuntime.ts`), governed tool
  registry (`adapters/GovernedToolRegistry.ts`), workspace tools, data-report template + deterministic
  aggregation + narrative consistency check.
- Rule preserved in code: **Mission owns the lifecycle; Brain/other engines supply reusable intelligence.**
  No second autonomous loop was found.

## 7. Revenue path

`services/api/src/services/Opportunity*` → `MissionService` (canonical Mission launch) →
`mission-runtime` plan (`DataReportTemplate`) → governed tools (`data_aggregate`, `workspace_write`,
`data_narrative_check`) → artifact → independent verification → `MissionClientOpsHandoff` (draft,
`pendingApproval: true`) → **human** approval/submission. Money is _never_ represented as received by the
system; only a `verified_payment` record advances the revenue ladder (`packages/world-model`).

## 8. Memory / learning / context

- `packages/execution-memory`, `packages/experience-optimization`, `packages/context-fabric`,
  `packages/memory-intelligence`, `packages/learning-intelligence`, `packages/knowledge-intelligence`.
- Owner-scoped persistence: in-memory default, Postgres when configured.

## 9. Persistence & infrastructure

- Postgres (`pgvector/pgvector:pg16`), Redis, Prometheus, OpenTelemetry collector, Grafana — `docker-compose.yml`.
- Repositories per service; identity uses a real Postgres repository; several stores are in-memory by default
  (documented "in-memory in dev, Postgres in production").

## 10. Tests, CI, scripts, docs

- Tests: Vitest per workspace (982 files). **Full-suite run did not complete in a 600 s bound** in this audit.
- CI: `.github/workflows/ci.yml`, `.github/workflows/release.yml`.
- E2E: `apps/web/playwright.config.ts` + `apps/web/e2e` (not run in this audit).
- Ops scripts: `scripts/startup.sh`, `scripts/preflight.ts`, `scripts/doctor.ts`, `scripts/verify.sh`,
  `scripts/production-config-check.ts`, benchmarks (`npm run benchmarks`).
- Docs: extensive `docs/`, `09_Documents/`, `04_Sprints/` reports; `docs/ARCHITECTURE_OWNERSHIP_MAP.md`
  (roadmap P1.1); audit convention already exists at `docs/audits/`.

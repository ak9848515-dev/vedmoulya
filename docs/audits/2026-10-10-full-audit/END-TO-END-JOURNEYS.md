# END-TO-END-JOURNEYS.md — Journey Traces & Evidence Classification

Classification per capability (per the audit brief):
**A** runtime-proven with reproducible evidence · **B** implemented & tested, not runtime-proven ·
**C** partially wired / narrow scenario only · **D** UI/catalog/docs only · **E** broken / misleading / absent.

> Audit constraint: this was a **read-only** pass. No fresh browser session was performed, and no live
> cloud-provider run was executed. Where a journey is only **code-traced**, it is labelled so. Existing
> acceptance evidence (`_rev001-live/`, `_rev002a-live/`, `_rev004a-live/`, `.rev004a-live-run.log`) was
> reused read-only.

---

## Journey A — Identity & first use — **B (code-traced + integration-tested)**

Trace: `apps/web/src/app/login|signup|oauth2redirect|verify-email` → `apps/web/src/auth/*` →
API gateway context (`services/api/src/middleware/auth.ts`) → identity routes/controller
(`services/identity/src/presentation/routes/IdentityRoutes.ts`) → `AuthService` → `PostgresIdentityRepository`
→ JWT (`TokenService`, HS256, iss `vedmoulya`, aud `vedmoulya-api`).

- Real JWT verification on every protected procedure; anonymous context only for public routes.
- Google OAuth `state` is server-minted, hash-persisted, single-use, 10-min TTL (`auth/OAuthState.ts`).
- **Not proven in this audit:** a _fresh browser_ sign-up → dashboard → reload → logout cycle.
- **Documented pre-existing gap:** production email-verification delivery (no SMTP) while sign-in requires a
  verified account; dev/test auto-verifies. This can block a _real_ user (see G-06).

## Journey B — AI provider setup — **C**

Trace: `apps/web/src/app/providers` → `ProvidersRouter` → `ProviderSetupOrchestrator` /
`ProviderConnectionTester` → credential storage → `registerPlatformProviders` → adapter execution.

Distinguishing the required states:

| State                 | Evidence                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| Catalog-only          | Stated for Google/OpenRouter/Ollama in docs — **contradicted by code** (they are registered adapters). |
| Implemented adapter   | ✅ OpenAI, VercelAI, DeepSeek, GoogleGemini, OpenAICompatible, Ollama, Mock, OpenAIEmbedding.          |
| Configured            | ✅ Local `.env.local` configures Ollama; the REVENUE-004A run registered it.                           |
| Credential-resolved   | ✅ For Ollama (live run). Cloud keys present locally but **no live cloud call reproduced**.            |
| Reachable             | ✅ Ollama proven reachable (`/api/tags`). Cloud: not reproduced.                                       |
| Successfully executed | ✅ **Ollama only** (REVENUE-004A, 0 cloud tokens). Cloud providers: **not runtime-proven** here.       |

**Risk:** the docs collapse these states (see G-02). The product can show a provider as
`UNSUPPORTED_RUNTIME`/catalog while it is in fact executable — or vice-versa.

## Journey C — Ask VedMoulya — **C**

Trace: web prompt → `AIRouter`/`ai.stream` → `AIOrchestrationService` → capability routing → provider →
response → usage/health → UI. Context assembly via `context-fabric` / capabilities.

- Auth, rate tiers, and error mapping exist in the gateway middleware.
- Streaming/cancellation/timeout behavior and "UI status reflects real execution" were **not** exercised in a
  fresh browser session in this audit; provider timeout is bounded (`AI_PROVIDER_TIMEOUT_MS`, Ollama override).
- Classification C: wired and unit-tested, not end-to-end proven in this pass.

## Journey D — Mission & autonomy — **A (local provider)**

Trace: goal → `MissionControllerService` → objective selection → `PlanningApplicationService` +
`PlannerService` (+ templates) → `AgentExecutionEngine` → governed tools → verification → recovery →
checkpoint → memory → next objective → bounded termination.

**Runtime-proof (REVENUE-004A, local Ollama):** Mission COMPLETED; objective VERIFIED
(`agent_execution_verification`); steps step-1..step-4 `completed verified=true attempts=1`; `run outcome:
ACHIEVED`; `final goal verification VERIFIED`. Recovery is bounded (`maxAttempts`, `maxRevisions`), and
UNKNOWN is never success (`packages/agent-execution/src/domain/verification.ts`).

- Verified: **completion cannot substitute for objective verification** (completion gate requires a VERIFIED
  objective; `readBackVerification` and the command policy fail closed).
- Not proven: long-horizon multi-objective autonomy and durable restart recovery **under a live Postgres**
  (roadmap S10/P1.5).

## Journey E — Local AI — **A (proven) / B (browser+CORS path)**

Trace: `services/orchestrator/src/providers/OllamaProvider.ts` (rejects unknown requested models with a typed
`MODEL_NOT_FOUND`; optional `num_predict`; explicit `fallbackToInstalledModel` opt-in) registered via
`registerPlatformProviders`.

- **Proven live** this-session-equivalent evidence: REVENUE-004A executed through Ollama with the configured
  model, 0 cloud, 0 mock.
- **Not proven:** the _browser → local-agent_ reachability/CORS/private-network path (no fresh browser test).

## Journey F — Real opportunity → deliverable — **A (local) / B (cloud, human submission)**

Trace and evidence:

1. Opportunity/qualification/risk + authorized acceptance — `OpportunitySourceAdapter`,
   `OpportunityQualification`, `OpportunityRecommendation`.
2. Canonical Mission launch — `MissionService` (composed `createMissionRuntime`).
3. Real provider — **Ollama (proven)**; cloud **not reproduced**.
4. Governed tools — `data_aggregate`, `workspace_write`, `data_narrative_check` (path-jailed, audited).
5. Artifact — `_rev004a-live/output/sunrise-traders-sales-report.md` (readable, 2024 bytes).
6. Independent verification — deterministic (36 checks) + narrative consistency (0 contradictions).
7. Delivery **draft** — `pendingApproval: true`, `submitted: false`, no external action.
8. **Human** approval/submission — out of system scope by design; **money received is never claimed**.

Existing evidence reused: `_rev001-live/mission-acceptance.txt` (`VEDMOULYA_MISSION_ACCEPTANCE_OK`),
`_rev002a-live/{mission-acceptance,m2-acceptance}.txt`,
`_rev002a-live/m2-delivery-verification.txt` (`VEDMOULYA_M2_DELIVERY_OK`).

**Distinction enforced:** verified artifact → delivery draft → (human) external submission → money received
are four separate states; only the first two are produced by the system.

## Journey G — Memory, learning & user context — **B/C**

Trace: `packages/execution-memory`, `packages/experience-optimization`, `packages/context-fabric`,
`packages/world-model` (`WorldGraph` provenance-required observations).

- Outcome-gated learning exists (`SPRINT-025`: UNKNOWN/FAILED never become SUCCESS) and is owner-scoped.
- **Risk:** distinguishing _genuine learning_ (outcomes change future decisions) from _record storage presented
  as learning_ was **not proven end-to-end** in this audit; it rests on unit/benchmark evidence (B/C).

## Journey H — Production lifecycle — **C**

- Build/test: CI workflows exist (`.github/workflows/{ci,release}.yml`); `docker-compose.yml` provides
  Postgres(pgvector)/Redis/Prometheus/OTel/Grafana.
- Startup: `scripts/startup.sh`, `doctor`, `preflight`, `verify.sh`, `production-config-check.ts`.
- **Not verified here:** an actual deployment, migrations run against a real environment, live telemetry sink,
  and rollback/restore. Roadmap P0.1 (staging+prod deployment) and P1.5 (migration/backup/restore drills)
  remain open. **`npm run typecheck` is red in the current working tree** (G-01), so a CI build on this tree
  would fail before deploy.

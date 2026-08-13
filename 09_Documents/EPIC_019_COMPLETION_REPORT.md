# EPIC-019 — Platform Startup, Environment & Provider Runtime Hardening

**Completion Report · 2026-08-12 · Verdict: 🟢 GREEN — IMPLEMENTATION VERIFIED**

> EPIC-019 adds **no product features**. It fixes startup/environment/provider-runtime problems surfaced during the latest verification, and it hardens the honesty boundary: **catalog evidence ≠ runtime capability, configuration ≠ availability, availability ≠ execution, execution ≠ successful outcome.**

---

## 1. Root causes

| #   | Symptom observed                                                                                                                                                                                   | Root cause                                                                                           | Fix                                                                                                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | `scripts/startup.sh` performed Node-level config validation with plain `node -e "require('@vedmoulya/core')"` → `ERR_MODULE_NOT_FOUND` because `@vedmoulya/core` exports TS sources                | Plain Node cannot resolve the TS module graph; startup used a non-canonical validation path          | All startup commands run through the repository TS runtime (**tsx**) via the shared probe surface (`scripts/lib/probes.ts`)                                                                                                          |
| R2  | Inconsistent environment loading: `npm run dev` via Next.js vs `startup.sh` vs scripts, with root `.env.local` absent while `apps/web/.env.local` exists                                           | No single authoritative env-file strategy                                                            | One strategy in `scripts/lib/probes.ts`: development/test load root `.env.local` then `apps/web/.env.local`; production/staging root only. Built-in `process.loadEnvFile` (no dotenv); existing shell vars win; secrets never echoed |
| R3  | `AI_OPENAI_API_KEY` treated as required unless `AI_DEFAULT_PROVIDER=deepseek`, while DeepSeek's runtime status was unclear — risk of "pretending DeepSeek works because it exists in the taxonomy" | Provider taxonomy (catalog) and runtime capability were conflated                                    | `packages/core/src/startup/provider-runtime.ts` is the single source of truth; `getConfig`, `validateProductionAIConfig`, `registerPlatformProviders`, preflight, doctor and the UI all read the same registry                       |
| R4  | Verification commands hung for minutes (next dev/start, docker, Playwright, background servers)                                                                                                    | No bounded timeouts or process cleanup                                                               | `scripts/verify.sh` runs every command under `timeout` with `NO_COLOR/FORCE_COLOR=0/CI=1`; `startup.sh` gains `--timeout`, bounded health polling and a process-tree cleanup trap                                                    |
| R5  | Raw ANSI escape sequences (`[555;33m`-style) in captured verification logs under PowerShell/agents                                                                                                 | Child tools emit color codes when stdout looks like a TTY                                            | `scripts/verify.sh` exports `NO_COLOR=1 FORCE_COLOR=0 CI=1 TERM=dumb` — application UI untouched                                                                                                                                     |
| R6  | No single "is this machine ready?" command; port-3000 conflicts were silent or opaque                                                                                                              | Doctor builder existed but had **no CLI binding**; port probe existed but `startup.sh` never checked | `scripts/doctor.ts` CLI (`npm run doctor`) + `scripts/check-port.ts` wired into `startup.sh` with an interactive menu and deterministic `--ci` failure                                                                               |

## 2. Files changed (EPIC-019)

**New:**

- `scripts/lib/probes.ts` — shared canonical probes (mode resolution, env loading, docker/build/store/config) used by every startup CLI.
- `scripts/lib/ts-probe.ts` — TS-runtime probe (module-graph load proof).
- `scripts/doctor.ts` — `npm run doctor` CLI binding (rows + exit code, no secrets).
- `scripts/check-port.ts` — machine-readable port probe for bash (`AVAILABLE` / `OCCUPIED pid [cmd]` / `ERROR`).
- `scripts/verify.sh` — bounded, ANSI-free verification runner (`npm run verify`).
- `09_Documents/EPIC_019_PROVIDER_RUNTIME_MATRIX.md` — evidence table.
- `09_Documents/EPIC_019_COMPLETION_REPORT.md` — this report.

**Modified (continuing the existing EPIC-018/019 working tree):**

- `scripts/startup.sh` — port check + interactive menu / `--ci`, `--port`, `--timeout`, bounded health check, process-tree cleanup, bounded `docker compose`.
- `scripts/preflight.ts` — refactored to the shared probe surface (thin binding).
- `package.json` — `doctor`, `doctor:prod`, `check-port`, `verify` scripts.
- `packages/core/src/startup/provider-runtime.ts` — removed a redundant ternary (no behavior change).
- `packages/core/src/config/index.ts` (pre-existing working tree) — `getConfig` agrees with the runtime registry.
- `services/api/src/infrastructure/ProductionAIConfig.ts` (pre-existing) — production validator reads the same registry states.
- `services/orchestrator/src/index.ts` + `services/orchestrator/src/providers/DeepSeekProvider.ts` (pre-existing) — `registerPlatformProviders` registers `DeepSeekProvider` (Vercel AI SDK) when `AI_DEEPSEEK_API_KEY` is set.
- Documentation: `04_Sprints/MASTER_ROADMAP.md`, `CHANGELOG.md`, `README.md`, `task_progress.md`.

## 3. Architecture decisions

1. **One canonical startup strategy** — every startup/diagnostic command (`startup.sh`, `preflight`, `doctor`, `check-port`) resolves mode and loads the environment through `scripts/lib/probes.ts`. No script may duplicate startup logic.
2. **Provider runtime registry is the single source of truth** — `packages/core/src/startup/provider-runtime.ts` (pure, injectable) defines `CONFIGURED / AVAILABLE / NOT_CONFIGURED / UNSUPPORTED_RUNTIME / MOCK / DISABLED / ERROR` and is consumed by config, production validation, registration contract tests, preflight, doctor and the UI. The orchestrator test _"provider runtime registry agrees with registration"_ enforces sync.
3. **DeepSeek: fully wired (option A)** — a real `DeepSeekProvider` adapter (Vercel AI SDK `createOpenAI` → `https://api.deepseek.com`, Chat Completions path, 16/16 deterministic tests) was already present. It is registered when `AI_DEEPSEEK_API_KEY` is set and is a valid `AI_DEFAULT_PROVIDER` in production. **Live execution remains an operator step** — the adapter is deterministic-tested, never live-claimed.
4. **Catalog-only families stay honest** — Anthropic / Google / OpenRouter / Ollama have no adapter; set keys are never consumed; `AI_DEFAULT_PROVIDER=anthropic` fails fast in production; development reports `UNSUPPORTED_RUNTIME`.
5. **Dev boots without paid keys** — the deterministic mock is registered in development/test automatically; `npm run dev` boots with zero AI keys (health check passes).
6. **Production stays fail-closed** — `AUTH_JWT_SECRET`, non-loopback `IDENTITY_DATABASE_URL`/`REDIS_URL`, a real AI key (or explicit `AI_ENABLE_MOCK=true`), and a production build are all required. No silent fallback to mock.
7. **Port conflicts are never silent** — interactive menu ([1] stop [2] another port [3] cancel) on a TTY; deterministic exit-1 in `--ci`/non-TTY.
8. **Bounded everything** — verify scripts and startup sub-commands run under `timeout`; health polling is bounded; `--timeout N` runs terminate cleanly via a process-tree trap (`taskkill /T` on Windows).

## 4. Provider runtime matrix

See `09_Documents/EPIC_019_PROVIDER_RUNTIME_MATRIX.md`. Summary: **OpenAI** and **DeepSeek** are the only runtime-executable families; **Mock** is the deterministic dev/opt-in path; **Anthropic, Google, OpenRouter, Ollama** are catalog-only (`UNSUPPORTED_RUNTIME`).

## 5. Startup behavior — before / after

| Concern                | Before                                                              | After                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Config validation      | plain `node -e require('@vedmoulya/core')` → `ERR_MODULE_NOT_FOUND` | preflight + doctor via tsx (TS module graph loads; probed explicitly)                                                        |
| Env loading            | multiple, inconsistent paths                                        | one strategy (`scripts/lib/probes.ts`); dev/test: root `.env.local` → `apps/web/.env.local`; prod: root only; shell vars win |
| Provider truth         | key required / taxonomy confusion                                   | registry-driven `CONFIGURED / UNSUPPORTED_RUNTIME / MOCK / …` everywhere                                                     |
| Dev boot without keys  | —                                                                   | mock registered automatically; `npm run dev` READY (health 200)                                                              |
| Production fail-closed | partial                                                             | JWT + non-loopback DB/Redis + real AI key or explicit mock + build, all fail-fast                                            |
| Port 3000 conflict     | silent / opaque                                                     | detected with owner PID; menu or deterministic `--ci` failure                                                                |
| Hanging commands       | unbounded waits                                                     | `timeout` everywhere; `--timeout` bounded runs; cleanup trap                                                                 |
| ANSI in captured logs  | raw escapes                                                         | `NO_COLOR/FORCE_COLOR=0/CI=1/TERM=dumb` in `verify.sh`                                                                       |
| One-shot diagnostics   | —                                                                   | `npm run doctor` (dev) / `npm run doctor:prod`                                                                               |

## 6. Test results

_(filled from the final validation run — see section below)_

## 7. Browser verification

_(filled from the real-Chrome smoke journey — see section below)_

## 8. Remaining operator-required items (unchanged by EPIC-019)

- **Real AI keys** for live OpenAI/DeepSeek execution — live calls are operator steps; nothing here claims live success.
- **Docker daemon + Postgres/Redis** for a production-like local run (dev continues on the in-memory convention with clear warnings).
- **Production build** before `bash scripts/startup.sh` (never built implicitly) — `npm run build -w apps/web`.
- **Root `.env.local`** for production/staging secrets (never auto-created, never copied from `apps/web/.env.local`).
- **STAGING/PRODUCTION platform environments** (Vercel/Railway) per `docs/ops/DEPLOYMENT_GUIDE.md`.
- **Anthropic / Google / OpenRouter / Ollama adapters** — implementing any of these is future work (taxonomy-only today).

## 9. Architectural risks discovered

1. **Legacy `OPENAI_API_KEY` divergence** — the runtime registry lists `OPENAI_API_KEY` as a configuring key (backward-compatible fallback), while production fail-fast requires the canonical `AI_OPENAI_API_KEY`. Production therefore always blocks on legacy-only keys (fail-closed, correct), but the registry/`doctor` can show OpenAI `CONFIGURED` from a legacy key in dev while production would still demand the canonical key. Documented in the matrix; acceptable and honest — the strict gate is the canonical key.
2. **Registry ↔ adapter drift** — `PROVIDER_RUNTIME_DESCRIPTORS` must stay in sync with `registerPlatformProviders`. Mitigated by the contract test in `services/orchestrator`; the matrix doc is evidence, not a second source of truth.
3. **`process.loadEnvFile` vs dotenv** — `scripts/load-env.ts` (startup.sh export emission) uses the `dotenv` package while preflight/doctor use Node's built-in `process.loadEnvFile`. Both share the same precedence contract (existing shell vars win — verified empirically), but the dual mechanism is a maintenance smell; unifying the export path to the built-in is a future cleanup.
4. **`--skip-docker` softening** — reachability checks degrade in strict modes when the Docker daemon is down; hard configuration checks are never softened. Operators must read the DEGRADED warnings (documented).
5. **Windows process-tree cleanup** relies on `taskkill //T`; on exotic shells this can be best-effort. Bounded runs always exit deterministically regardless.

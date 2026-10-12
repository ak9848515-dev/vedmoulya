# VM Sprint 012 — Durable Execution Evidence + Control-Plane Coverage Closure

**Date:** 2026-10-12
**Branch:** `main`
**Baseline HEAD at pass start:** `d73c9808` (`docs(docs): record sprint 011 traceability evidence`)
**Worktree at pass start:** 16 modified tracked files + 4 untracked test files + 5 untracked `_sprint*-live/` evidence directories + 2 root scratch analysis scripts, all preserved.

## Outcome

This sprint finishes the P1.2 join begun in Sprint 011: the canonical Mission objective now carries a **bounded, sanitized snapshot of the real Agent Execution run** (`MissionExecutionTrace`) and it is persisted with the objective, so owner-scoped Mission traces reconstruct real execution evidence after process loss instead of depending on the process-local run registry. The API exposes this as an owner-authorized joined trace (`control.getMissionTrace`) that resolves opportunity → approval → launch intent → Mission → execution without inventing a second lifecycle or a new event store.

The previous pass reported that the full test suite, production build, bundle check, and accessibility suite passed but the **control-plane coverage gate failed**. That failure is now fixed with meaningful tests (below); all re-run gates pass with recorded exit codes. This report and the source/test changes are **committed locally only — Sprint 012 is not pushed.**

## What changed

- `packages/mission-controller/src/types/mission-types.ts` — add `MissionExecutionTrace` and optional `MissionObjective.executionTraces` (optional so older persisted JSONB stays readable).
- `packages/mission-controller/src/contracts/mission-ports.ts` — surface `trace` on the execution result; add optional `MissionStore.saveRequired` durability barrier.
- `packages/mission-controller/src/application/MissionControllerService.ts` — persist the returned trace onto the objective and force a required save **outside** the executor catch path, so a database failure stops the objective rather than being reported as an execution failure.
- `packages/mission-controller/src/infrastructure/InMemoryMissionStore.ts` — implement `saveRequired` for the in-memory backend.
- `packages/mission-controller/src/index.ts` — export `MissionExecutionTrace`.
- `packages/mission-runtime/src/adapters/PlanningExecutionPorts.ts` — build the bounded trace from the real run (`actions` ≤ 200, `observations` ≤ 200, artifacts ≤ 20/action); action errors pass through `sanitizeTraceText(..., maxLength 400)`, artifact name/type are bounded.
- `packages/mission-runtime/src/persistence/PostgresMissionStores.ts` — implement `PostgresMissionStore.saveRequired` (flush + write-through upsert + replace any stale queued copy).
- `services/api/src/services/MissionService.ts` — prefer the persisted trace when present, falling back to the in-process run; report `executionAvailable` true if either exists.
- `services/api/src/routers/ControlRouter.ts` — add `getMissionTrace` (owner resolved first; 503 when not configured; 404 vs 503 on not-found; `NOT_LINKED`/`MISSING` represented honestly; no cross-owner disclosure).
- `services/api/src/services/RouterRegistry.ts` — wire `readMissionTrace` and the `getMissionTrace` procedure.
- Test additions (meaningful coverage, no vacuous assertions): 5 control-plane suites extended and 4 new suites added — `ActiveIntelligenceControlPlane.test.ts` (gate/discovery/launch handshake/briefing branches), `AutonomySettingsValidator.test.ts`, `ControlGate.test.ts` (default clock, `privateOnly` + LOCAL provider, prohibited provider, `currentLevel` cap), `EmergencyStop.test.ts` (absent/empty state), `OpportunityLifecycle.test.ts` (idempotent transition, `VERIFIED`-only-after-`EXECUTED` guard, external-ref dedup, clamping/caps), plus `CommercialOutcomeReconcile.test.ts`, `InMemoryControlStores.test.ts`, `PostgresOpportunityMissionLinkStore.test.ts` (hermetic stateful `postgres.js` fake exercising insert-won/conflict-recovery/update-won/fail-closed), and `OpportunityMissionTracePostgres.test.ts` (real PostgreSQL joined-trace reconstruction, skipped only when no DB).

## Coverage closure for `packages/control-plane`

The configured 80% thresholds (`statements`, `branches`, `functions`, `lines`) are **unchanged**; no files were excluded and collection was not disabled. Fresh `coverage-final.json` (11 files) measures:

| Metric     | Covered          | Threshold | Result |
| ---------- | ---------------- | --------- | ------ |
| Statements | 98.90% (358/362) | 80%       | PASS   |
| Branches   | 95.99% (263/274) | 80%       | PASS   |
| Functions  | 99.15% (117/118) | 80%       | PASS   |
| Lines      | 99.69% (324/325) | 80%       | PASS   |

The remaining uncovered sites are defensive nullish-coalescing fallbacks (`?? ''`-style), one optional-clock default, and one error-path expression — each below the branch threshold and each already exercised on its primary side. No uncovered behavior was found that is unreachable or defective.

## Gate results (actual exit codes)

| Gate                                            | Command                                                                             | Result                                                                                                                                                                                                      |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused control-plane tests                     | `npm test -w packages/control-plane`                                                | PASS, exit 0 — 10 files, 108 tests.                                                                                                                                                                         |
| Focused control-plane coverage gate             | `COVERAGE_GATE_FILTER=packages/control-plane node scripts/coverage-gate.mjs`        | PASS, exit 0 — 1/1 workspace, all four metrics ≥ 80%.                                                                                                                                                       |
| Full coverage gate (all workspaces)             | `npm run test:coverage`                                                             | PASS, exit 0 — 56 workspace configs across 2 concurrent batches; 28/28 ✅ per batch, no timeout, `🟢 Coverage gate PASSED`.                                                                                 |
| Full test suite                                 | `npx vitest run --maxWorkers=4 --reporter=dot`                                      | PASS, exit 0 — 977 files, 12,971 tests (421.92s).                                                                                                                                                           |
| Typecheck                                       | `npm run typecheck`                                                                 | PASS, exit 0.                                                                                                                                                                                               |
| Lint                                            | `npm run lint`                                                                      | PASS, exit 0 — 58 scopes, 0 failed (148.7s).                                                                                                                                                                |
| Dependency-cycle check                          | `npm run deps:cycles`                                                               | PASS, exit 0 — 57 workspaces, no cycles.                                                                                                                                                                    |
| Formatting                                      | `npm run format`                                                                    | PASS, exit 0 — after evidence-dir ignore + tracked-doc normalization (see below).                                                                                                                           |
| Production build                                | `npm run build`                                                                     | PASS, exit 0 — Next.js compiled; `apps/web/.next/BUILD_ID` present.                                                                                                                                         |
| Bundle check                                    | `npm run test:performance`                                                          | PASS, exit 0 — largest page 129 kB; `providers` (125 kB) and `settings` (60 kB) exceed the 50 kB advisory limit (pre-existing, warn-only).                                                                  |
| Accessibility suite                             | `npm run test:a11y`                                                                 | PASS, exit 0 — 6/6 Chromium a11y tests.                                                                                                                                                                     |
| Benchmark chain                                 | `npm run benchmarks`                                                                | PASS, exit 0 — includes `quality:gates:verify` 18/18 (security CRITICAL/HIGH block, aggregate-masking forbidden, functional/grounding/structured-output block, bounded refinement loop, dependency cycles). |
| Dependency audit                                | `npm audit --audit-level=critical`                                                  | PASS, exit 0 — 17 advisories (5 low, 12 high, **0 critical**); no fix available for `webpack-dev-middleware`/`elliptic` (build-time only).                                                                  |
| Persistence/recovery — real PostgreSQL          | `node --env-file=.env.local --import tsx scripts/live-real08-postgres-recovery.ts`  | PASS, exit 0 — 9/9 checks: verified state and `verifiedAt` survive runtime loss unchanged, dependent objective stays PENDING, resume completes it, failed objective stays FAILED.                           |
| Recovery — OS process crash + lease             | `node --env-file=.env.local --import tsx scripts/live-restart-acceptance.ts`        | PASS, exit 0 — 26/26: real process crash, fresh-process recovery, single-execution cross-process lease, one VERIFIED objective.                                                                             |
| Persistence — joined trace on fresh connections | `npx vitest run services/api/src/__tests__/OpportunityMissionTracePostgres.test.ts` | PASS, exit 0 — 1/1 against real PostgreSQL (this is the Sprint 011 `NOT RUN` item, now proven).                                                                                                             |
| Provider — production runtime verification      | `node --env-file=.env.local --import tsx scripts/ai-production-verify.ts`           | BLOCKED — exit 3; provider auth + model negotiation succeeded, live call blocked by **no billing credits** (operator step, not an implementation failure).                                                  |
| Provider — live AI critique                     | `node --env-file=.env.local --import tsx scripts/ai-critique-verify.ts`             | BLOCKED — exit 3; 4/5 implementation checks pass; live call blocked by the same billing limitation.                                                                                                         |
| Local provider path                             | bundled in recovery harnesses                                                       | PASS — real Ollama provider registered and returned successful reasoning calls (e.g. 20.1s latency) during the Postgres recovery drill.                                                                     |
| Staging recovery/restore drills (D-09)          | —                                                                                   | NOT RUN — no staging environment is authorized/available; unchanged from prior sprints.                                                                                                                     |
| Cloud-provider live acceptance                  | —                                                                                   | NOT RUN/BLOCKED — depends on the billing operator step above.                                                                                                                                               |

## Formatting: the four differences

The history recorded by Sprint 007 was: `npm run format` "failed only on four pre-existing untracked Sprint 3 Markdown evidence files; preserved untouched". Those four files — `_sprint3-live/mission-ws/{dependency-audit,packages-inventory,release-signoff}.md` and `_sprint3-live/negative-ws/packages-inventory.md` — are **untracked evidence that must be preserved byte-for-byte**, so they were **not** rewritten. Instead, `_sprint*-live/` was added to `.prettierignore`, matching the existing policy that already ignores the analogous generated evidence roots (`_live*/`, `_real08/`, `_s3*/`, `_rev002a-live/`, `_rev004a-live/`). Separately, three **tracked** repository documents that Prettier flagged (`docs/audits/2026-10-11-quality-sprint-007/FINAL-REPORT.md`, `…-008/FINAL-REPORT.md`, and `…-008/evidence/postgres-mission-readback.json`) were normalized with `prettier --write` (table alignment and JSON array collapsing only). `npm run format` then passed with exit 0. The four evidence files remain unmodified on disk.

## Preservation and hygiene

- Branch `main`, five stashes (`stash@{0}` … `stash@{4}`) and all five untracked `_sprint*-live/` evidence directories were preserved; nothing was reset, cleaned, discarded, or reverted.
- Root scratch analysis scripts `_cov-analyze.mjs` / `_cov-detail.mjs` (created by the prior pass) were preserved on disk for inspection; they are now ignored as root-scratch (`/_*.mjs` in `.gitignore`, `_*.mjs` in the ESLint ignore list), matching the existing debug-script policy. They were the sole cause of the lint failure and are not source.
- A credential-pattern scan over every changed and new file found no likely secret values (none printed). No `sk-…`, cloud key, private key, or inline password was introduced.
- No push, no deploy, no external submission, no purchase. No paid cloud credits were consumed (the OpenAI calls were rejected before billing).

## Limitations

1. **Identity database configuration warning (accessibility server).** The a11y run's web server repeatedly logs `[auth-route] Initialization failed: IDENTITY_DATABASE_URL must be set to a non-localhost URL outside NODE_ENV=development. Refusing the localhost default in production (fail-fast).` The a11y suite still passes because `A11Y_ALLOW_UI_ONLY_READINESS=true` exercises UI structure without the identity database. This is an environment/configuration gap, recorded as a limitation.
2. **Cloud provider live validation is blocked** by a billing operator step (provider auth and model negotiation succeed). The local Ollama path is verified; cloud completions are not.
3. **The full coverage gate reports 56 workspace configs**, run as two concurrent 28-workspace batches (the prior "28-workspace" wording counted one batch). Both batches passed in full.
4. **`PostgresOpportunityMissionLinkStore.test.ts`** exercises a stateful in-process `postgres.js` fake, not a live database; the live durable path is covered separately by the real-Postgres `OpportunityMissionTracePostgres.test.ts` and the two recovery harnesses.
5. **Bundle advisory limits** (`providers`, `settings` pages) remain exceeded; the check is warn-only and pre-existing.
6. **Staging backup/restore, failover, and migration drills (D-09)** remain unverified.

## Score

Keep the accepted baseline at **7.3 / 10**. Durable execution evidence and a proven fresh-connection joined trace meaningfully improve Persistence and Runtime/recovery, and the control-plane coverage gate now closes cleanly. However, cloud-provider live acceptance and staging recovery/restore remain unproven, so the evidence does not justify a headline increase this sprint.

## Remaining steps / certification status

Not certified as release-ready. All non-live gates and the live DB/Ollama persistence, recovery, and joined-trace gates pass with recorded exit codes. Outstanding operator/environment items: (1) add provider billing credits and re-run `ai:production:verify` / `ai:critique:verify`; (2) provision a staging environment for D-09 recovery/restore drills; (3) set a non-localhost `IDENTITY_DATABASE_URL` for full a11y/production server readiness. Sprint 012 is committed locally only and is **not pushed**.

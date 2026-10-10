# Executive Summary and Baseline Scorecard

**Baseline date:** 2026-10-10 (Asia/Calcutta)  
**HEAD:** `86bad52137ab432991db8c283c832c0946f2d308` (`main`, equals `origin/main`)  
**Worktree:** seven pre-existing modified files, none staged. Baseline checks ran against this worktree; a pristine checkout was not tested.

## Assessment

VedMoulya has distinct ownership for Mission, Brain, Loop, Providers and governed execution, a broad set of tested domain packages, and prior local-provider acceptance evidence for a real mission artifact and approval-gated delivery draft. It is not demonstrated to be release-ready: the current full test run failed one user-facing component test, provider documentation remains materially inconsistent with executable registration, and deployed/staging, cloud-provider, browser accessibility, durable recovery, and operational restore paths are not verified.

**Baseline score: 64.6 / 100.** This is an evidence-weighted audit judgment, not a product KPI. No post-remediation score is claimed yet.

| Dimension                                     |  Weight | Maturity / 5 | Weighted | Confidence               | Evidence and limiting gap                                                                                                                                                                  |
| --------------------------------------------- | ------: | -----------: | -------: | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Architecture, modularity, ownership           |      12 |          3.5 |      8.4 | Medium                   | 58 workspace graph is acyclic; Mission ownership is explicit. Large composition/router files and 49 API routers raise ownership/maintenance costs.                                         |
| UI/UX, accessibility, responsive behavior     |      12 |          2.5 |      6.0 | Low                      | 63 route pages and component tests exist. No fresh browser, responsive, or accessibility run yet; one current full-suite UI failure.                                                       |
| Brain, planning, intelligence quality         |      12 |          3.5 |      8.4 | Medium                   | Planner/Brain/execution wiring and deterministic benchmarks/tests exist; quality of contextual interpretation and future-decision learning lacks a fresh end-to-end observation.           |
| Provider configuration, routing, failover     |      10 |          3.0 |      6.0 | Medium                   | Local Ollama acceptance is documented historically; executable provider set conflicts with runtime-matrix documentation; no fresh cloud request.                                           |
| End-to-end wiring and functional completeness |      12 |          3.5 |      8.4 | Medium                   | Prior local opportunity-to-verified-artifact-to-draft evidence; identity-to-first-use and several UI paths are not freshly browser-proven.                                                 |
| Runtime correctness, execution, verification  |      12 |          3.5 |      8.4 | Medium                   | Focused suites pass; prior local runtime evidence is reproducible in records but was not rerun here. Full suite currently has one failed test.                                             |
| Mission autonomy, memory, learning, recovery  |       8 |          3.0 |      4.8 | Low                      | Canonical bounded Mission lifecycle and outcome-gated tests; long-horizon and durable restart learning/recovery not proven against Postgres.                                               |
| Security, privacy, authorization              |       8 |          3.5 |      5.6 | Medium-low               | JWT/ownership guards and governed tool controls have source/test evidence; exhaustive router ownership, browser session, retention/deletion and distributed rate limits remain unverified. |
| Testing, maintainability, defect hygiene      |       8 |          3.5 |      5.6 | High for executed checks | Typecheck and focused tests pass; full suite has 1 failure among 12,868 tests; repo-wide lint/format/build baseline is still being recorded.                                               |
| Build, deployment, operations, observability  |       6 |          2.5 |      3.0 | Low                      | CI, Docker Compose, health and telemetry configuration exist; no staging/deployment, rollback, backup/restore or live telemetry sink proof.                                                |
| **Total**                                     | **100** |              | **64.6** |                          |                                                                                                                                                                                            |

## Baseline checks

- `git diff --check`: exit 0.
- `npm run deps:cycles`: exit 0; 58 workspaces scanned, no internal dependency cycles.
- `npx vitest run packages/agent-execution packages/mission-runtime services/api/src/__tests__/ProviderExperienceService.test.ts`: exit 0; 33 files / 302 tests passed, 27.15 s.
- `npm run typecheck`: exit 0 (`tsc -b` and API no-emit typecheck), 16.6 s.
- `npm test`: exit 1 after 463.92 s; 966 files, 12,868 tests: 965 files / 12,867 tests passed, one test failed. Failure is `apps/web/src/components/__tests__/CommandCenter.test.tsx` opportunity drill-down; `OpportunityValueIntelligencePanel` calls `useMissionStatus`, whose `api.mission` namespace is absent from this test's tRPC mock. Full trace is in [runtime evidence](RUNTIME-ACCEPTANCE-EVIDENCE.md).
- Historical lint run in the preceding work session exposed one parser error from a local probe artifact and security warnings in two mission-runtime adapters; both package/root scopes passed after narrow config correction. Full current-snapshot lint is still required before post-fix comparison.
- Full format, full lint, production build, E2E, accessibility, live-provider and deployment checks have not yet been run for this baseline.

## Release blockers and limitations

No confirmed P0 security/data-loss/fabricated-success defect is established by this baseline. Current blockers are recorded separately in [the gap register](PRIORITIZED-GAP-REGISTER.md). The full-suite test failure is verified and must be fixed or shown to be an invalid test before release. G-17 remains deferred: do not compose orchestration-fabric as a second production routing authority.

## Prior audit reconciliation

The earlier tracked audit under `2026-10-10-full-audit` started at `bdbe6111`; its G-01 health literal/typecheck failure is fixed in subsequent commits (current typecheck passes). Its G-02 provider runtime matrix drift remains confirmed: `services/orchestrator/src/index.ts` conditionally registers Google, OpenRouter, and Ollama adapters, while `09_Documents/EPIC_019_PROVIDER_RUNTIME_MATRIX.md` still calls those providers unsupported/catalog-only. Earlier live Ollama artifacts remain historical evidence, not a fresh runtime run in this audit.

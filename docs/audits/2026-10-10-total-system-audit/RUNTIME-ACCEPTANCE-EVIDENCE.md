# Runtime and Acceptance Evidence

## Commands executed for current baseline

| Command                                                                                                                         | Result       | Duration / coverage                                      |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------- |
| `git diff --check`                                                                                                              | PASS, exit 0 | Working diff, before remediation                         |
| `npm run deps:cycles`                                                                                                           | PASS, exit 0 | 58 workspaces, ~1.2 s                                    |
| `npx vitest run packages/agent-execution packages/mission-runtime services/api/src/__tests__/ProviderExperienceService.test.ts` | PASS, exit 0 | 33 files / 302 tests, 27.15 s                            |
| `npm run typecheck`                                                                                                             | PASS, exit 0 | `tsc -b` + API typecheck, ~16.6 s                        |
| `npm test`                                                                                                                      | FAIL, exit 1 | 463.92 s; 966 files / 12,868 tests; 12,867 pass / 1 fail |

## Full-suite failure

`apps/web/src/components/__tests__/CommandCenter.test.tsx > CommandCenter > expands an opportunity card with category/evidence/next-action (SPRINT-035 drill-down)` fails with `TypeError: Cannot read properties of undefined (reading 'status')`. Stack originates in `useMissionStatus` at `apps/web/src/lib/api-client.ts:4384`, called from `OpportunityValueIntelligencePanel.tsx:129`. The test’s mocked `api` object lacks `mission.status`. This is a verified UI test-integration failure; production runtime behavior is not established by the stack alone.

## Historical runtime artifacts (not freshly reproduced)

The earlier tracked audit references REVENUE-001/002A/004A runs in ignored `_rev001-live`, `_rev002a-live`, `_rev004a-live` directories and `.rev004a-live-run.log`. Reported evidence includes local Ollama execution, a VERIFIED artifact, deterministic independent checks, approval-gated draft and no external submission. These records are historical and remain local; this run neither overwrote nor deleted them. The current audit does not claim fresh local or cloud provider connectivity.

## Not executed yet

Full current lint, full Prettier check, production builds, E2E/browser, accessibility, benchmarks, npm audit, a local-provider run, cloud-provider generation, staging/deployment and DB backup/restore. A command result will be added only after it runs; absence is not a pass.

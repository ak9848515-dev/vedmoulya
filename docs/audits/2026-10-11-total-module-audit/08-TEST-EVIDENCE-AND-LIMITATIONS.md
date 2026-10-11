# Test Evidence and Limitations

All commands run from repository root on 2026-10-11. Exit codes captured from the
tested command (pipefail-safe for piped runs). No full-suite or large build was
run (bounded pass; disk 19 GB free of 51 GB).

## Executed checks (fresh, this pass)

| #   | Command                                                                                                                                                | Result                                             | Exit |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- | ---- |
| 1   | `git status --short`                                                                                                                                   | clean (no output)                                  | 0    |
| 2   | `git diff --stat`                                                                                                                                      | empty                                              | 0    |
| 3   | `npm run deps:cycles`                                                                                                                                  | 58 workspaces scanned, no internal cycles          | 0    |
| 4   | `npm run typecheck` (`tsc -b` + API no-emit)                                                                                                           | no errors                                          | 0    |
| 5   | `npx vitest run apps/web/src/components/__tests__/CommandCenter.test.tsx`                                                                              | 1 file / 19 tests passed                           | 0    |
| 6   | `npm run lint`                                                                                                                                         | 58 scopes, `failed=0`, wallTime 192.6 s            | 0    |
| 7   | `npx vitest run packages/mission-runtime packages/brain packages/providers packages/agent-execution packages/mission-controller services/orchestrator` | 90 files / 1,096 tests passed                      | 0    |
| 8   | `npm audit --production`                                                                                                                               | 0 vulnerabilities                                  | 0    |
| 9   | `npm audit --audit-level=high`                                                                                                                         | 17 vulnerabilities (5 low, 12 high), dev/Storybook | 1    |

### Note on #5

The 2026-10-10 baseline recorded this test **failing** (missing `api.mission`
namespace in the tRPC mock). It now passes 19/19 — a confirmed fix.

## Not run this pass (missing evidence)

| Check                                           | Why not run                    | Implication                                     |
| ----------------------------------------------- | ------------------------------ | ----------------------------------------------- |
| `npm test` (full suite)                         | ~460 s; bounded read-only pass | Full count/regression unknown; baseline existed |
| `npm run build` / production build              | time/size                      | Build not verified in this pass                 |
| `npm run format`                                | time                           | Formatting not verified                         |
| `npx playwright test` / `test:a11y`             | browser prerequisites          | UI journeys unverified                          |
| Deterministic benchmarks (`npm run benchmarks`) | long-running                   | Model-quality unmeasured                        |
| Live provider run (cloud or Ollama)             | credentials/network; read-only | Only historical Ollama evidence exists          |
| Staging deploy / restore drill                  | no environment                 | Deployment unproven                             |

## Verified claims vs unverified risks

**Verified (fresh):** typecheck, lint, dependency cycles, focused suites,
CommandCenter test, production dependency cleanliness, fail-closed keyless
provider health (source + regression tests).

**Unverified risks (do not treat as passing):** full-suite green, build,
formatting, E2E/a11y, cloud providers, durable restart/recovery, backup/restore,
staging/rollback, benchmarks, WCAG compliance.

## Reliability of the run set

- Checks 3, 4, 6 are repository-wide gates and are high-confidence.
- Check 7 is a representative spine subset (private packages + providers),
  not the whole estate; it is high-confidence for the modules it covers.
- No test was skipped, weakened, or suppressed to obtain a green result.

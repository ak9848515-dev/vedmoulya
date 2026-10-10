# Remediation Plan and Score Comparison

## Baseline score

Baseline is **64.6/100**, scored in `EXECUTIVE-SUMMARY.md` using fixed formula `weight Ã— maturity/5`. This is the current pre-remediation worktree, not the older HEAD-only audit. Acceptance evidence and limitations for every dimension are recorded there.

## Dependency-ordered plan

1. Reproduce the CommandCenter failure; repair the test fixture/API contract without weakening the live mission-status path; run the focused UI tests and then the full suite.
2. Reconcile provider capability documentation with the conditional runtime registrations; add a deterministic regression guard if maintainable.
3. Run full lint and format checks, record complete warning/error counts, and resolve verified warnings without broad suppressions.
4. Run the repositoryâ€™s deterministic benchmark gates and production builds; assess actual failures before making fixes.
5. Review confirmed security/data-lifecycle findings within available local scope; avoid speculative rewrites or weakening controls.
6. Run browser/E2E/accessibility checks when local prerequisites allow. Any provider test must use already-configured, authorized credentials and distinguish local vs cloud.
7. Recalculate the same dimensions from evidence. A score change requires acceptance evidence, not simply a code diff.

## Post-fix comparison

Current post-fix score is **69.6/100** in `CURRENT-WORKTREE-REVIEW.md`. Increases use fresh local gates; external release evidence remains open.

| Dimension                              | Baseline maturity | Baseline points | Post-fix maturity | Post-fix points | Evidence required for increase                                                    |
| -------------------------------------- | ----------------: | --------------: | ----------------: | --------------: | --------------------------------------------------------------------------------- |
| Architecture/modularity/ownership      |             3.5/5 |          8.4/12 |             3.5/5 |          8.4/12 | Ownership boundaries and dependency-cycle gate pass; composition remains broad    |
| UI/UX/accessibility/responsive         |             2.5/5 |          6.0/12 |             3.0/5 |          7.2/12 | Six structural route checks pass; axe, keyboard and device matrix remain open     |
| Brain/planning/intelligence            |             3.5/5 |          8.4/12 |             3.5/5 |          8.4/12 | Benchmarks exist; correlated real intent-to-verified-result evidence remains open |
| Provider config/routing/failover       |             3.0/5 |          6.0/10 |             3.5/5 |          7.0/10 | Correct docs and registration tests; authorized cloud generation still open       |
| End-to-end wiring                      |             3.5/5 |          8.4/12 |             3.5/5 |          8.4/12 | Browser structural checks pass; full user journey and live mission remain open    |
| Runtime/execution/verification         |             3.5/5 |          8.4/12 |             4.0/5 |          9.6/12 | Full suite, typecheck and workspace build pass; live store remains unverified     |
| Mission/memory/learning/recovery       |             3.0/5 |           4.8/8 |             3.0/5 |           4.8/8 | Restart and outcome-changes-next-decision evidence remains open                   |
| Security/privacy/authorization         |             3.5/5 |           5.6/8 |             4.0/5 |           6.4/8 | No high/critical production advisories; exhaustive authz/session checks remain    |
| Testing/maintainability/defect hygiene |             3.5/5 |           5.6/8 |             4.0/5 |           6.4/8 | 12,870 tests, lint, format, typecheck, build and structural a11y pass             |
| Build/deploy/operations/observability  |             2.5/5 |           3.0/6 |             2.5/5 |           3.0/6 | Local gates pass; bundle overruns, staging, restore and telemetry remain          |

| **Total** | | **64.6/100** | | **69.6/100** | Production recovery, deployment, live providers, full E2E and performance budget cleanup remain |

## Release actions

No files are staged. Do not commit or push until the exact staged diff and ownership of all existing worktree changes have been reviewed. Staging/production, rollback, and restore proof remain release requirements.

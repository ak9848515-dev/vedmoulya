# VM-SPRINT-009 — Final Report

- **Date:** 2026-10-11
- **Repository:** `D:/VedMoulya`
- **Baseline HEAD:** `f2cd06581f4a68b6ad8e11bee3438603e743dbaa`
- **Final implementation HEAD (source/tests):** `22fce3d3` (`fix(api): gate opportunity mission launch on risk`); the following report commit is documentation-only.
- **Sprint 008 publication:** Published by normal fast-forward push; local and `origin/main` both verified at baseline HEAD before Sprint 009 changes.
- **Sprint 009 push:** Not pushed, per request.
- **Score:** 7.3 / 10, unchanged from Sprint 008; the narrow risk gate and tests do not justify a broader score increase.

## 1. Repository truth and preservation

At start, `main` was two commits ahead of `origin/main`, with the remote at `0f0f52681f0a8215d2efee1c07608b87bb3b0e2d`. The two local commits were exactly Sprint 008: `a30d8cdb` (planning verification fix/tests) and `f2cd0658` (Sprint 008 report/evidence). Their parent relationship and file diff were inspected. A normal `git push origin main` succeeded; fetch confirmed local and remote both at `f2cd0658` before this sprint began.

The worktree had no tracked modifications at baseline. Existing untracked evidence directories `_sprint3-live/`, `_sprint5-live/`, `_sprint6-live/`, `_sprint7-live/`, and `_sprint8-live/` were preserved. All five existing stashes were preserved: `pre-security-baseline-healthprobe`, three `lint-staged automatic backup` entries, and `WIP on main (5bff61b)`.

## 2. S7.2 scope and architecture wiring

The audit found S7.0 acquisition and S7.1 monitoring, qualification/ranking, Brain-backed human approval, owner-scoped opportunity persistence, `startMissionForOpportunity`, the existing `PLANNED` idempotency claim, the canonical `mission.createAndRun` bridge, durable opportunity↔Mission association storage, Mission execution/readback, and explicit human approval/start UI already wired. Proposal generation returns a draft and exposes no submission operation. The frozen roadmap was read and not modified.

The complete concise map and pre-code acceptance criteria are in [WIRING-MAP.md](WIRING-MAP.md). The smallest source gap was that launch did not rerun suitability or block a HIGH-risk persisted record immediately before the Mission call. `ControlRouter` now requires the persisted approval evidence, reuses the current assessor at launch, refuses HIGH risk in either source or current assessment, and writes score/risk/approval provenance into the existing `PLANNED` lifecycle transition note. The canonical Mission lifecycle and stores remain unchanged.

### Acceptance matrix

| Criterion                                                         | Result                                            | Evidence / limitation                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner-scoped persisted opportunity required                       | PASS                                              | Existing router loads with authenticated owner; negative cross-owner regression tests pass.                                                                                                                                                                                                                                                              |
| Approval and current suitability/risk before Mission creation     | PASS                                              | Persisted approval required; current assessor invoked; HIGH risk rejected before claim/launch; new regression test.                                                                                                                                                                                                                                      |
| Explicit authorized trigger                                       | PASS                                              | Authenticated `control.startMissionForOpportunity`; human approval does not auto-start; existing UI has separate start action.                                                                                                                                                                                                                           |
| Repeated/concurrent idempotency                                   | PASS within tested process and durable-link paths | Existing sequential/concurrent tests prove one Mission; retries with a persisted association return it.                                                                                                                                                                                                                                                  |
| Durable owner/opportunity/Mission association                     | PASS                                              | Existing Postgres and in-memory owner-scoped link stores and bidirectional lookups.                                                                                                                                                                                                                                                                      |
| Canonical Mission lifecycle and bounded derived objective         | PASS                                              | Existing launch port delegates to `createAndRun`; derivation tests preserve only recorded facts.                                                                                                                                                                                                                                                         |
| Honest Mission failure and outcome traceability                   | PASS with limitation                              | Existing Mission records carry execution/verification state and opportunity link is queryable; launch failures do not claim success. A Mission created while association persistence remains unavailable may be unlinked.                                                                                                                                |
| Draft-only content and no external actions                        | PASS                                              | Proposal seam is draft-only; no external submission, message, purchase, or proposal occurred.                                                                                                                                                                                                                                                            |
| Existing lifecycle/audit states reused                            | PASS                                              | Existing approval, `PLANNED` claim, association, and Mission activity used; no redundant status model added.                                                                                                                                                                                                                                             |
| Interrupted recovery cannot bypass authorization/risk/idempotency | BLOCKED for crash-safe reconciliation             | Recovery rechecks approval/risk before retry. However, if `createAndRun` has created a Mission and association persistence fails through its retry/process crash, the opportunity has no durable Mission ID to reconcile; a later retry could create another Mission. Fix requires canonical Mission idempotency or a durable launch-intent/result seam. |

## 3. Files changed

- `services/api/src/routers/ControlRouter.ts` — persisted approval validation, pre-launch current suitability/risk check, HIGH-risk refusal, and auditable launch claim detail.
- `services/api/src/__tests__/OpportunityMissionDerivation.test.ts` — regression proving a HIGH-risk approved record creates no Mission and remains unclaimed.
- `docs/audits/2026-10-11-quality-sprint-009/WIRING-MAP.md` — architecture map, acceptance criteria, and explicit recovery limitation.
- `docs/audits/2026-10-11-quality-sprint-009/FINAL-REPORT.md` — this evidence report.

## 4. Verification evidence

| Command                                                                 | Result                                                                                                                                                           |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused S7.2/opportunity suites before source change                    | Exit 0; 4 files, 62 tests passed                                                                                                                                 |
| Focused S7.2/opportunity suites after source change                     | Exit 0; 4 files, 63 tests passed                                                                                                                                 |
| `npm run deps:cycles`                                                   | Exit 0; 57 workspaces, no cycles                                                                                                                                 |
| `npm run typecheck`                                                     | Exit 0                                                                                                                                                           |
| `npm run lint`                                                          | First run caught one unnecessary optional check; corrected. Rerun exit 0; 58 scopes passed (208.3 seconds).                                                      |
| Targeted Prettier check                                                 | Exit 0 after formatting the test and Markdown map                                                                                                                |
| `npm test -- --maxWorkers=4 --reporter=dot`                             | Exit 1; 971/972 files passed, 12,914/12,915 tests passed. One unrelated `mission-watchdog.test.ts` cadence assertion observed 1005 ms against a 1001 ms ceiling. |
| `npm test -- --run services/api/src/__tests__/mission-watchdog.test.ts` | Exit 0; 1 file, 7 tests passed, consistent with transient timing flake; the full-suite failure is retained above.                                                |

No paid cloud AI credits were used. No live provider acceptance was run. No external submission occurred.

## 5. Pre-commit workflow investigation

The configured hook is `.husky/pre-commit` → `npx lint-staged --allow-empty`; staged TypeScript runs `eslint --fix` then Prettier. The staged-file tasks completed successfully on each source and documentation commit attempt. The commit-message hook rejected the first source message (`opportunities`) and first documentation message (`audit`) because neither is an allowed scope; retrying with allowed scopes `api` and `docs` passed. The earlier apparent lint-staged stall was not reproducible on these staged scopes. Full-repository `npm run lint` takes about 208 seconds across 58 scopes, so a broad lint operation may be mistaken for a hung hook; the exact cause of the older unlogged stall cannot be proven. No hook bypass or configuration rewrite was used.

## 6. Commits and score

The Sprint 009 source and regression test are committed locally in `22fce3d3`. The wiring map and this report are committed separately after review. Sprint 009 remains unpushed. The final documentation commit is the final repository HEAD and is recorded in the completion summary.

The Sprint 008 weighted score remains **7.3 / 10** using its unchanged dimensions and weights. The S7.2 risk gate is a bounded safety improvement; the unresolved crash window and one full-suite timing flake do not support a score increase.

| Dimension                  |   Weight |           Sprint 008 |           Sprint 009 |
| -------------------------- | -------: | -------------------: | -------------------: |
| Architecture               |      15% |                  6.8 |                  6.8 |
| End-to-end functionality   |      15% |                  8.1 |                  8.1 |
| AI intelligence            |      12% |                  7.5 |                  7.5 |
| Runtime / recovery         |      12% |                  7.1 |                  7.1 |
| Tests                      |      10% |                  8.3 |                  8.3 |
| Security                   |      10% |                  7.5 |                  7.5 |
| Persistence                |       8% |                  7.0 |                  7.0 |
| UX / accessibility         |       8% |                  7.0 |                  7.0 |
| Performance                |       5% |                  5.5 |                  5.5 |
| Documentation / operations |       5% |                  7.4 |                  7.4 |
| **Weighted total**         | **100%** | **7.332 → 7.3 / 10** | **7.332 → 7.3 / 10** |

## 7. Remaining blocker and next sprint

Before claiming crash-safe exactly-once opportunity launch, add/reuse durable idempotency spanning Mission creation and opportunity association, then test process interruption after Mission creation and before link persistence. Keep P1.2 End-to-End Traceability and frozen G-17 deferral intact; do not activate orchestration-fabric authority as part of that fix.

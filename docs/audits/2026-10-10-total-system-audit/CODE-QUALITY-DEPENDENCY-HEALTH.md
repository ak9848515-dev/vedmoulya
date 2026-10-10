# Code Quality and Dependency Health

## Baseline measurements

- Dependency-cycle gate: 58 workspaces scanned, pass.
- TypeScript: `npm run typecheck` pass (build references plus API no-emit).
- Focused regression set: 33 files / 302 tests pass.
- Full Vitest: 966 files; 12,867 pass, 1 fail; exit 1 after 463.92 s.
- Formatting, full lint, production build and npm vulnerability audit: not yet measured against this baseline snapshot.
- `npm audit --audit-level=critical` exists as the repository script; CI also has production high-level and full critical-level audit gates.

## Confirmed failure

The CommandCenter opportunity drill-down test mocks the tRPC namespaces used by the mounted panel but omits `api.mission.status`, now required by `useMissionStatus` (`apps/web/src/components/OpportunityValueIntelligencePanel.tsx:129`, `apps/web/src/lib/api-client.ts:4384`). Add the missing realistic mock and assert the interaction still renders; do not remove mission status polling from production code merely to satisfy a stale fixture.

## Existing worktree changes

At baseline, modified relative to HEAD: `eslint.config.js`, `packages/agent-execution/src/domain/AgentExecutionEngine.ts`, `packages/mission-runtime/src/adapters/DataAggregateTool.ts`, `packages/mission-runtime/src/adapters/DataNarrativeCheck.ts`, `scripts/benchmark-project-report.ts`, `scripts/revenue-001-live.ts`, `scripts/revenue-002a-live.ts`. They were present before this audit. The preceding lint task corrected two security false-positive scopes and a probe ignore pattern in `eslint.config.js`; no ownership was assumed for the other edits. All are preserved and none are staged.

## Hygiene inventory

Ignored local state includes environment files, build outputs, extensive logs, generated coverage/caches, Android signing material, and probe directories. None is tracked or needed for repository source inventory; ownership/value is unclear, so no broad deletion or ignore-rule change is proposed. Untracked temporary test artifacts encountered in the preceding task were explicitly removed at the user’s request; this audit does not remove remaining ignored material.

## Maintainability signals

The repo has 49 package and 9 service directories, 49 API routers and 996 filename-matched test/spec files. Earlier audit reports identify oversized API composition/client files and widespread lint-disable patterns. These are follow-up signals; no broad refactor is justified without file-specific impact and tests.

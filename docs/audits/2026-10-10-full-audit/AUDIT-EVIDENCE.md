# AUDIT-EVIDENCE.md

All commands were run read-only. No source file was edited during the audit; no packages were installed; no
live cloud-provider calls were made; no secrets were read or printed. Full-suite / long commands were bounded
with `timeout`.

---

## 0. Initial repository state (captured before inspection)

```
git branch --show-current        → main
git rev-parse HEAD               → bdbe6111dbb1e596540ff5b783d74f869d44690c
git log -1 --oneline             → bdbe6111 fix(ai): correct provider endpoints and credential injection
git status -sb                   → ## main...origin/main
git remote -v                    → origin git@github.com:ak9848515-dev/vedmoulya.git
git status --short               → 19 modified tracked files; untracked: _rev001-live/, _rev002a-live/,
                                   _rev004a-live/, scripts/revenue-*.ts, mission-runtime data-* adapters,
                                   .rev004a-gate.*, .tmp-*, services/api revenue tests
git diff --stat                  → 19 files changed, 1011 insertions(+), 57 deletions(-)
```

Pre-existing untracked acceptance artifacts preserved: `_rev001-live/`, `_rev002a-live/`, `_rev004a-live/`,
`scripts/revenue-00{1,2a,4a}-live.ts`, `packages/mission-runtime/src/adapters/Data{Aggregate,Narrative,Report}*.ts`.

## 1. Inventory evidence

| Command                                         | Result                                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `ls packages`                                   | 47 entries (46 packages + README)                                                                                                     |
| `ls services`                                   | 9 (`api, content-agency, decision, execution, identity, knowledge, memory, notifications, orchestrator`)                              |
| `ls apps`                                       | `web`                                                                                                                                 |
| `find … -name '*.test.ts*' \| wc -l`            | 982 test files                                                                                                                        |
| `find … -name '*.ts*' \| wc -l`                 | 4,928 TS/TSX files                                                                                                                    |
| `find apps/web/src/app -name page.tsx \| wc -l` | 63 routes                                                                                                                             |
| `ls services/api/src/routers`                   | 49 routers                                                                                                                            |
| `wc -l` top sources                             | `RouterRegistry.ts` 7003 · `apps/web/src/lib/api-client.ts` 4901 · `ApiApplicationService.ts` 3150 · `AIOrchestrationService.ts` 2027 |
| `ls .github/workflows`                          | `ci.yml`, `release.yml`                                                                                                               |
| `ls services/orchestrator/src/providers`        | OpenAI, VercelAI, DeepSeek, GoogleGemini, OpenAICompatible, Ollama, Mock, OpenAIEmbedding                                             |
| `docker-compose.yml`                            | postgres(pgvector:pg16), redis:7, prometheus, otel-collector, grafana                                                                 |

## 2. Test evidence (this audit; exact exit codes preserved)

| Command                                                                                                   | Outcome                                                            |  Exit |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----: |
| `npx vitest run --root services/api`                                                                      | **108 passed \| 1 skipped (109 files) · 1842 passed \| 5 skipped** |     0 |
| `npx vitest run --root services/identity`                                                                 | **33 files · 425 passed**                                          |     0 |
| `npx vitest run --root packages/world-model`                                                              | **23 files · 310 passed**                                          |     0 |
| `npx vitest run --root packages/mission-runtime`                                                          | **22 files · 170 passed**                                          |     0 |
| `npx vitest run --root packages/agent-execution`                                                          | **10 files · 108 passed**                                          |     0 |
| `npx vitest run services/api/src/__tests__/Opportunity{FirstRevenueAcceptance,MissionDerivation}.test.ts` | **2 files · 16 passed**                                            |     0 |
| `timeout 600 npx vitest run` (all workspaces)                                                             | **no summary within 600 s — run was bounded/killed**               | (n/c) |

## 3. Static-gate evidence

| Command                                                        | Outcome                                                                              |                          Exit |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------: |
| `npx tsc -b`                                                   | no output                                                                            | **0** (incremental; see note) |
| `npm run typecheck` (`tsc -b && tsc --noEmit -p services/api`) | `TS2322` at `services/orchestrator/src/providers/OpenAICompatibleProvider.ts(125,5)` |                         **1** |

> **Note (masking hazard):** `tsc -b` alone reported green while the consumer-project typecheck
> (`tsc --noEmit -p services/api`, which re-checks the shared source graph) found the error. A
> project-reference build can therefore mask a real type error. Recorded as CQ-01.

## 4. Reused runtime evidence (read-only; NOT re-run in this audit)

- **REVENUE-004A fresh live run** — `.rev004a-live-run.log`, `_rev004a-live/`:
  Mission COMPLETED · objective VERIFIED (`agent_execution_verification`) · step-1..step-4
  `completed verified=true attempts=1` · provider `ollama`, model `qwen2.5-coder:7b-instruct`, `local:true`,
  **cloud tokens 0, mock executions 0** · artifact 2024 bytes · independent verification PASS ·
  narrative consistency CONSISTENT (20 checks, 0 contradictions, 0 review) · draft `pendingApproval: true`,
  `submitted: false`, external submission NONE.
- `_rev002a-live/m2-delivery-verification.txt` → `VEDMOULYA_M2_DELIVERY_OK` (objective VERIFIED; draft
  `pendingApproval: true`, `submitted: false`; no external action).
- `_rev001-live/mission-acceptance.txt`, `_rev002a-live/{mission-acceptance,m2-acceptance}.txt` → acceptance OK.

## 5. Source references cited in the findings

- `services/orchestrator/src/providers/OpenAICompatibleProvider.ts:115-131`; `services/orchestrator/src/index.ts:170-256`.
- `packages/ai/src/types/index.ts:45` (ProviderStatus), `:151` (ProviderHealth).
- `services/api/src/middleware/auth.ts` (JWT + IDOR), `services/api/src/services/RouterRegistry.ts`,
  `services/api/src/services/ApiApplicationService.ts`.
- `services/identity/src/auth/OAuthState.ts`, `.../auth/AuthService.ts`, `.../persistence/PostgresIdentityRepository.ts`.
- `packages/agent-execution/src/{domain/AgentExecutionEngine.ts,domain/verification.ts,domain/recovery.ts}`.
- `packages/mission-runtime/src/{composition/MissionRuntime.ts,adapters/GovernedToolRegistry.ts,adapters/DataReportTemplate.ts}`.
- `README.md`; `09_Documents/EPIC_019_PROVIDER_RUNTIME_MATRIX.md`; `docker-compose.yml`; `.github/workflows/{ci,release}.yml`.

## 6. Final repository state (post-audit)

- Only this audit directory was **added**: `docs/audits/2026-10-10-full-audit/*.md`.
- No tracked file was modified; nothing staged, committed, or pushed.
- Verify with (run by the operator, not persisted here to keep the tree clean):
  `git status --short` and `git diff --stat` — the 19 modified + untracked sets from §0 are unchanged apart from
  the new audit directory.

## 7. Limitations / what was NOT verified

1. **No fresh browser session** (Journeys A, C, E browser path, UX) — all UX and browser-dependent claims are
   source-derived, not visually verified.
2. **No live cloud-provider execution** (roadmap P1.4) — cloud providers remain B (implemented + tested).
3. **Full test suite did not complete in 600 s** — per-workspace results are green; a global green claim is
   **not** made.
4. **No deployed/staging environment** (P0.1) and no migration/backup/restore drill (P1.5).
5. **No penetration test**; SEC-01..SEC-05 are **unverified**, not confirmed defects.
6. E2E (`playwright`) and a11y suites were **not** run.

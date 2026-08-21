# SPRINT-026 — Test Gap Report

> **Sprint:** SPRINT-026 — Voice Intelligence + Complete-System Architecture Audit
> **Scope:** Phase 11 (Testing Audit) + Phase 8 (Code Quality) + Phase 9 (Database/Persistence) findings
> **Date:** 2026-08-13
> **Verdict:** 🟢 **Test estate is unusually strong (648 files, coverage-gated, 17 hermetic benchmarks, browser journeys). Gaps are concentrated in exactly the areas this sprint addresses: voice, proactive, and a few cross-cutting surfaces.**

---

## 1. Test Estate (verified inventory)

| Layer                | Inventory                                                                                                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                 | 648 test files across workspaces; coverage gate ≥80% per workspace (34/34 workspaces claimed; gate script `scripts/coverage-gate.mjs`)                                                                                |
| Hermetic benchmarks  | 17+ scripts under `scripts/*-benchmark.ts` wired into `benchmarks` + CI (brain, execution, intelligence, bridge, scheduler, continuous, outcome, journey, runtime-verification, learning, production, quality-gates…) |
| Router tests         | Full tRPC pipeline tests per router incl. IDOR refusals (BrainRouter 17/17, FactoryLifecycle, RequirementsLifecycle…)                                                                                                 |
| Persistence          | `WriteThroughDocumentStore` + `PostgresApplicationRepository` + **real-Postgres restart-recovery 4/4** (env-gated)                                                                                                    |
| Browser (Playwright) | 11 specs: a11y, ai-world-scheduler, applications-journey, brain, continuous-intelligence, ecosystem-intelligence, execution-journey, live-intelligence-bridge, outcome-intelligence, user-journey, visual-validation  |
| Security             | CodeQL + npm audit in CI; adversarial security suites (AI-RUNTIME-002 C-05/C-06)                                                                                                                                      |
| Live verification    | `ai:smoke:live`, `rag:pg:verify`, `provider:calibrate`, `accuracy:evaluate` (operator-run)                                                                                                                            |

**Spot-checked this sprint:** brain + execution-bridge + capability-marketplace **251/251 PASS**; `tsc -b` + api typecheck **0**.

## 2. Test Coverage Gap Matrix

| Area                              | Existing                          | Gap                                                                                                                            | Priority      |
| --------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| Voice                             | — (no voice code)                 | STT/TTS port tests, transcript store, interruption, confirmation-without-voice-authz                                           | **P0 for S2** |
| Proactive assistant               | dailyPriorities/opportunity tests | Digest composition, cadence-triggered "attention" runs, notification dedup under cadence                                       | P1 (S3)       |
| AICompanion chat                  | Phase-13 UI tests exist           | No browser journey for the chat drawer; no streaming error/abort test in browser                                               | P2 (S1)       |
| Rate-limit / audit                | limiter unit tests                | Multi-instance semantics, Redis-backed limiter tests, durable audit store tests                                                | P1 (S1)       |
| Notifications                     | ecosystem store + gate tests      | Unified-surface test after S-1 removal; read-state dedup under restart (partially covered by 4/4 restart test)                 | P2 (S1)       |
| Voice safety model                | approval journey tests (purchase) | Voice-specific negative cases: "voice says approve" without gesture → denied; PIN mismatch; replay; session-end confirm        | P0 (S2)       |
| Provider speech capability        | —                                 | Candidate selection for SPEECH_TO_TEXT/TEXT_TO_SPEECH when a speech adapter is registered                                      | P0 (S1)       |
| Concurrency                       | cadence overlap guard tests       | Multi-user cadence concurrency under load; scheduler + brain refresh contention                                                | P2 (S3)       |
| Browser journeys for engine pages | 11 specs                          | `/os`, `/context-fabric`, `/memory`, `/providers` configuration flow, `/applications` third mode (partially)                   | P3 (S4)       |
| Weak/vacuous tests                | walker-generated coverage         | Router coverage walker fires every procedure with schema inputs — strong; keep the "minimal-optional" negative path maintained | keep          |

## 3. Code Quality Audit (Phase 8) — findings classified

| ID   | Sev | Finding                                                                                                                                                                                                             | Evidence                                           |
| ---- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Q-1  | P0  | (none found)                                                                                                                                                                                                        | —                                                  |
| Q-2  | P1  | **Audit log in-memory** (see R-2)                                                                                                                                                                                   | `middleware/audit.ts`                              |
| Q-3  | P1  | **Rate limiter in-memory** (see R-1)                                                                                                                                                                                | `middleware/rate-limit.ts`                         |
| Q-4  | P2  | `services/notifications` dead service (see S-1)                                                                                                                                                                     | no imports anywhere                                |
| Q-5  | P2  | RouterRegistry.ts is **5,470 lines** — the single largest file; router registration + middleware + shared helpers mixed                                                                                             | `services/RouterRegistry.ts`                       |
| Q-6  | P2  | BrainApplicationService.ts is **1,183 lines** — approachable but near the practical ceiling; splitting `recordLearning`/`correctLearning`/`executeAssignment` into focused modules is a maintainability improvement | `brain/src/application/BrainApplicationService.ts` |
| Q-7  | P2  | Frozen-vs-current doc drift: `CURRENT_STATE.md`, `IMPLEMENTATION_STATUS.md`, `FEATURE_MATRIX.md` frozen at OS-003 and **not updated** through SPRINT-022…025                                                        | file dates/contents                                |
| Q-8  | P3  | Mega-paragraph status lines in `task_progress.md` / `MASTER_ROADMAP.md` (single long lines)                                                                                                                         | read directly                                      |
| Q-9  | P3  | Per-user rate-limit key includes tier config but not endpoint — a heavy endpoint and a standard endpoint share the same bucket for the same user                                                                    | `rate-limit.ts` key                                |
| Q-10 | P3  | Hardcoded hex colors in AICompanion instead of tokens                                                                                                                                                               | `AICompanion.tsx`                                  |
| Q-11 | P3  | `Math.random()` used for task/correction id generation (brain) — fine for single-node dev, weak for distributed IDs; SPRINT-022 upserts use stable owner+key so impact is limited                                   | `BrainApplicationService.ts` id creation           |

**Verified clean:** no circular imports observed across the audited packages; strict TS (`noUncheckedIndexedAccess`) with targeted eslint-disable comments for closed-record lookups (all reviewed and legitimate); ESM throughout; no unsafe `any` in the audited core paths.

## 4. Database + Persistence Audit (Phase 9)

### 4.1 What is durable (verified)

| Store                                                              | Engine                                                                        | Status                                                       |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Identity users/sessions                                            | `services/identity` Postgres repo                                             | IMPLEMENTED (production path)                                |
| RAG embeddings                                                     | `@vedmoulya/rag` + pgvector (migration + rollback + readiness)                | IMPLEMENTED                                                  |
| Application projects                                               | `PostgresApplicationRepository`                                               | IMPLEMENTED                                                  |
| 19 intelligence stores (scheduler/brain/ecosystem/bridge/AI World) | `WriteThroughDocumentStore` (sync mirror + async write-through, `sql.json()`) | IMPLEMENTED — restart-recovery verified 4/4 vs live Postgres |

### 4.2 The SPRINT-022 JSON double-encoding check (asked explicitly)

- **Fixed and verified** for the 19 SPRINT-022 stores: `sql.json()` is the single JSON encoding; the pre-fix pattern (`JSON.stringify(x)::jsonb`) stored escaped-JSON text and was caught by live-Postgres testing.
- **Remaining:** the **frozen pre-022 EI repositories** (knowledge/memory/decision/execution services + EI engine repos) still use the old pattern — documented as a mechanical follow-up (DB-2). This audit confirms it is **still documented as outstanding**; not fixed here (frozen contracts + out of scope for an audit sprint).

### 4.3 What remains in-memory (IMPLEMENTED vs OPERATOR CONFIGURED)

| Store                                      | Production state                                                       | Requirement before GA                          |
| ------------------------------------------ | ---------------------------------------------------------------------- | ---------------------------------------------- |
| Brain tasks/decisions/opportunities/events | persisted via the 19-store bundle                                      | — (done)                                       |
| Execution runs / capability plans          | in-memory (`InMemoryRepositories` dev fallback)                        | Postgres store or documented single-node limit |
| Context-fabric stores                      | in-memory (contract-tested via double)                                 | Postgres (documented)                          |
| Preferences / experience ledgers           | in-memory + Postgres variants                                          | confirm production wiring                      |
| Cadence state                              | in-memory (restart resets — documented; dedup prevents duplicate runs) | distributed lock for multi-replica             |

**Development vs production:** dev/test resolve in-memory deterministically (`resolvePersistenceBundle`), production/staging resolve Postgres; hydration error-isolated; fail-fast readiness checks present.

### 4.4 Indexes / constraints / transactions

- `PRIMARY KEY (owner, key)` per store; `(owner, updated_at DESC)` index; idempotent `CREATE TABLE IF NOT EXISTS`; parameterized queries only (no interpolation) — SQL-injection impossible by construction.
- Upserts use `ON CONFLICT` stable-id semantics — no duplicates on restart (verified 4/4).
- Write-through is per-change (no multi-store transactions) — documented tradeoff; each write is atomic; cross-store consistency relies on the mirror + flush.

---

## 5. Verdicts

1. **Testing:** strong, honest, and CI-gated. Gaps are exactly the new surfaces (voice, proactive, chat browser journey, durable audit/rate-limit) — no legacy test debt found in the audited core.
2. **Code quality:** no P0; two P1 operational items (R-1/R-2); a handful of P2/P3 maintainability items. Nothing warrants a rewrite.
3. **Persistence:** SPRINT-022 fix verified; the frozen-repo `sql.json()` follow-up and the remaining in-memory stores are the two concrete items to close before GA.

# VM-QUALITY-SPRINT-005 — Final Report

**Objective:** continue from the sprint-004 result of **7.2 / 10**; close the
remaining runtime-evidence gaps without changing the frozen roadmap or weakening
the scoring criteria.
**Entered at HEAD:** `59630925` (branch `main`, 7 ahead of `origin/main`).
**Final score (baseline weights, unchanged):** **7.3 / 10** (+0.1).

## 1. What actually changed this sprint

| Step | Outcome                                                                    | Evidence                            |
| ---- | -------------------------------------------------------------------------- | ----------------------------------- |
| 0    | Baseline recorded (HEAD, stashes, infra); no files changed before it       | `STEP0-BASELINE.md`                 |
| 1    | **D-08b root-caused + resolved**; diagnosability defect **fixed + tested** | `STEP1-KNOWLEDGE-GRAPH.md`          |
| 2    | **Fresh local-provider mission E2E** + durable-persistence proof           | `STEP2-LOCAL-MISSION-ACCEPTANCE.md` |
| 3    | Brain E2E failure classified **provider-credit, not code**                 | `STEP3-BRAIN-E2E.md`                |
| 4    | Focused tests + typecheck + lint; scores updated only on fresh evidence    | `STEP4-VERIFICATION-AND-SCORES.md`  |

## 2. Headline results

### Step 1 — knowledge graph (D-08b)

- **Root cause:** local database **configuration drift**, not a defect. The engine
  `*_DATABASE_URL`s pointed at `localhost:55432` (a SPRINT-022 container port;
  nothing listening) **and** carried a stale password. The correct running database
  is the compose Postgres on **5432** with the committed dev credentials.
- **Confirmed non-causes:** migration/schema mismatch (tables exist; DDL idempotent),
  permissions (`42501` never occurred once correct), incompatible SQL (DDL + `ILIKE`
  succeed on 5432), application defect (none in the query path).
- **Fix:** repaired the local `.env.local` engine URLs (uncommitted) **and** fixed a
  real _diagnosability_ defect — the DDL bootstrap now logs the full cause chain
  (`describeErrorChain`) so `ECONNREFUSED` / `28P01` / `42P01` are no longer hidden
  behind drizzle's `"Failed query"` wrapper. Two regression suites added (7 unit
  tests; 1 real-Postgres test).
- After repair: `ensureTable OK`, `searchNodes OK`, all four knowledge tables present.

### Step 2 — fresh local-provider mission acceptance

- **Provider/model:** REAL local Ollama `qwen2.5-coder:7b-instruct` (`local=true`),
  `cloud tokens 0 / local tokens 188`.
- **Complete path proven** (`mission_mv3hetrj_1`): USER GOAL → MISSION → PLANNING
  (`step-1`/`step-2` verified) → REAL LOCAL PROVIDER → GOVERNED EXECUTION (`tools=2`)
  → VERIFICATION (`agent_execution_verification`, **VERIFIED**) → **DURABLE
  PERSISTENCE** → RESULT (artifact byte-exact) → **HUMAN APPROVAL**.
- **Durable persistence actually exercised:** queried independently — local PG row
  `COMPLETED/ACHIEVED` + `1 × VERIFIED` checkpoint; the Neon run
  (`mission_mv3hq08s_1`) also persisted a `COMPLETED` mission row and printed
  **`LIVE MISSION ACCEPTANCE: PASS`**.
- **Human approval mandatory:** delivery draft `pendingApproval=true`, external
  submission **NO**.
- **Honest gaps:** memory/learning produced **no durable entry** (§2 of STEP2); the
  managed-Neon write-through intermittently failed with `ENOTFOUND`.

### Step 3 — Brain E2E

- The sprint-004 failure was a **provider-credit** condition (`openai`,
  `AI_APICallError: You have no credits remaining`), surfaced honestly — **not** an
  application defect. Deterministic Brain gateway suites pass offline (**31/31**),
  isolating app correctness from the credit condition. Cloud live acceptance remains
  blocked (no credits); local browser acceptance remains open.

## 3. Verification actually run

`typecheck` **exit 0** · `errorChain` **7 passed** · knowledge real-Postgres **1
passed** · api focused suites **15 passed** · Brain deterministic **31 passed** ·
`eslint` on changed files **0 errors** · mission acceptance **COMPLETED/VERIFIED**
and **PASS**. Repo-wide `npm run test` / `npm run lint` **not run** (time/CPU).

## 4. Scores (baseline weights unchanged)

Baseline **7.2** → **7.3 / 10** (+0.1). Increases: Persistence +0.5, End-to-end +0.2,
AI +0.1, Runtime +0.1, Tests +0.1, Documentation +0.2; all others unchanged. Full
rationale and the arithmetic are in `STEP4-VERIFICATION-AND-SCORES.md`.

## 5. Commits, push, worktree

- Code: the `describeErrorChain` fix + logging change + two regression suites.
- Docs: this sprint-005 evidence set.
- **Push status:** not pushed (no push authorized).
- **Worktree:** only intended files staged per commit; `_sprint3-live/` untouched;
  `_sprint5-live/` evidence and `.sprint5-*` logs remain untracked. `.env.local`
  (gitignored) was repaired locally and is **not** committed. No secrets committed.

## 6. Constraints honored

Frozen roadmap unchanged; `mission.*` sole autonomous lifecycle; `brain.*` unchanged;
G-17 fabric **not** enabled (no second routing authority); no second autonomous loop;
`RouterRegistry.ts` **not** refactored; no destructive git; no credential/shared
artifact committed; no blocked check reported as passing; every fix is a small,
test-backed change.

## 7. Where 7.3 → 9.0 still stands

Unchanged blockers, now with one fewer:

1. **Browser journey on a live/local provider** (D-08a) — pin `brain.spec.ts` to
   Ollama or fund a cloud key.
2. **Reliable durable endpoint** — the managed Neon route is intermittently
   `ENOTFOUND`; plus produce a durable **learning** entry for a clean success.
3. **Staging recovery drills** (D-09).
4. **Architecture scale-down** of `RouterRegistry.ts` (D-02) — explicitly out of
   scope this sprint.

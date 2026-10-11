# STEP 1 — Knowledge-graph failure (D-08b): root cause + fix

**Status:** **RESOLVED in the local environment.** Root cause = **database
configuration drift**, not an application defect. One _diagnosability_ defect was
found and fixed with regression tests.

## 1. Reproduction

Fresh, sanitized diagnostic `scripts/_diag-knowledge-graph.ts` calls the REAL
`initializeDatabase()` + `PostgresKnowledgeRepository.ensureTable()` + `searchNodes`
(the exact `knowledge_nodes … ILIKE` query) + `findNodesByLabel` + `countGraphs`,
and reports table existence via `to_regclass`. Credentials are never printed.

**Before repair (as configured):**

```
KNOWLEDGE_DATABASE_URL: host=localhost port=55432 db=vedmoulya_knowledge user=vedmoulya
ensureTable:      FAIL  message=Failed query: CREATE TABLE IF NOT EXISTS knowledge_graphs ...
searchNodes:      FAIL  message=Failed query: ... label ILIKE $1 OR description ILIKE $2
knowledge_graphs: probe FAIL
```

The drizzle wrapper hides the driver error. Walking `error.cause`:

```
cause[0] Error        msg=Failed query:
cause[1] AggregateError code=ECONNREFUSED
```

→ **nothing was listening on `localhost:55432`.** Port 55432 is the SPRINT-022
container port; the running compose database is published on **5432** (and
`.env.example` / `.env.production.example` both document `5432` with one database
per engine). Correcting only the port produced a second, distinct failure:

```
cause[0] Error         msg=Failed query:
cause[1] PostgresError code=28P01  msg=password authentication failed for user "vedmoulya"
```

→ the engine URLs also carried a **stale password** from the old container. The
committed `docker-compose.yml` credentials (`vedmoulya` / `vedmoulya-dev`) are the
ones the running container accepts.

## 2. Determination

| Candidate                   | Verdict                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Database configuration      | **YES — primary cause** (stale port `55432` + stale password)                                                                  |
| Migration / schema mismatch | **NO** — tables exist and `ensureTable()` is idempotent                                                                        |
| Permissions                 | **NO** — `42501` never occurred once credentials were correct                                                                  |
| Incompatible SQL            | **NO** — the DDL and `ILIKE` search are valid; they succeed on 5432                                                            |
| Application defect          | **NO** in the repository query path                                                                                            |
| **Diagnosability defect**   | **YES** — the DDL bootstrap logged only drizzle's `"Failed query"` wrapper and discarded the `ECONNREFUSED`/`28P01` root cause |

## 3. Fix

### 3a. Environment repair (local, NOT committed)

`.env.local` (gitignored) engine URLs corrected to the running compose database:

- `localhost:55432` → `localhost:5432`
- engine password → the committed compose dev credential

After repair, the unmodified diagnostic reports:

```
ensureTable:      OK
searchNodes:      OK total=0
findNodesByLabel: OK total=0
countGraphs:      OK total=0
knowledge_graphs: knowledge_graphs
knowledge_nodes:  knowledge_nodes
knowledge_edges:  knowledge_edges
knowledge_lineage: knowledge_lineage
```

### 3b. Code fix — surface the real root cause (committed)

`services/api/src/infrastructure/errorChain.ts` (new) → `describeErrorChain()`
flattens an error + its `cause` chain, keeping each link's `name`, first message
line, `code` and `severity` (never a DSN). `awaitAllEngineEnsureTables()`
(`services/api/src/infrastructure/ProductionRepositories.ts`) now logs
`describeErrorChain(error)` instead of `error.message`, so the next
"table initialization failed" line names `ECONNREFUSED` / `42501` / `42P01`
instead of an opaque drizzle wrapper. This is the exact reason D-08b could not be
diagnosed in sprint 004.

## 4. Regression tests

1. `services/api/src/__tests__/errorChain.test.ts` — **7 passed**. Guards that the
   cause chain (code + severity) is surfaced, multi-line messages are reduced to a
   first line, non-Error causes are handled, and circular chains terminate.
2. `services/knowledge/src/infrastructure/persistence/__tests__/PostgresKnowledgeRepository.postgres.test.ts`
   — **1 passed (real Postgres)**. Boots the REAL repository against a REAL
   PostgreSQL (no in-memory substitute), runs `ensureTable()` **twice** (idempotency)
   and executes the `ILIKE` search + label search + `countGraphs()`. Gated on a
   reachable Postgres exactly like `services/api/.../PersistenceStores.test.ts`;
   honestly skips when none is available.

## 5. Blocker resolution

D-08b is **no longer an unexplained blocker**. The npm/CI databases already carry
the knowledge tables; the local failure was pure configuration drift. Production
readiness (a full managed-schema migration) remains an operator concern recorded
elsewhere (SPRINT-044/045), and is **not** claimed as done here.

# EPIC-011 — Live RAG Validation (Phase 2)

## 1. Command (operator-safe, exists since AI-RUNTIME-003)

```bash
npm run rag:pg:verify
# = npx tsx scripts/rag-live-verify.ts
```

Executes the COMPLETE Postgres/pgvector path when configured:
migration → schema → ingest → embed → persist → vector retrieval →
tenant/user isolation → rollback/readiness. Without `DATABASE_URL` it exits
non-zero with an explicit `SKIPPED` message — it NEVER silently falls back to
in-memory repositories.

## 2. Pipeline Under Test

```
INGEST → CHUNK → EMBED → PERSIST → RETRIEVE → RERANK/FILTER → EVIDENCE →
PROMPT → ANSWER
```

Verified properties: pgvector path · embedding provider · retrieval ·
metadata filtering · owner isolation · `groundingRequired` · insufficient
evidence · conflicting evidence · abstention. Cross-user isolation is
exercised against the real persistence layer (owner-scoped queries).

## 3. Result (2026-08-09)

**LIVE VALIDATION BLOCKED — no PostgreSQL available on this machine.**

Measured constraints:

- No Docker engine (WSL has no distros → `docker info` fails).
- No PostgreSQL listener on :5432.
- `DATABASE_URL` unset.

The Postgres RAG path remains **IMPLEMENTED + contract-tested via the in-memory
double** (RAG_MIGRATION_001, `ensureRagReady` fail-fast gate, health/readiness
checks) — but no live-DB claim is made. The `npm run rag:pg:verify` command
exits non-zero with exact operator steps whenever the environment is missing.

## 4. Operator Steps to Achieve FULL Live RAG Verification

1. Start PostgreSQL with pgvector:
   `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=vedmoulya-dev pgvector/pgvector:pg16`
   (or any Postgres 16 + pgvector instance).
2. `export DATABASE_URL=postgres://vedmoulya:vedmoulya-dev@localhost:5432/vedmoulya`
3. `export AUTH_JWT_SECRET=<strong secret>`
4. `npm run rag:pg:verify` → expect full pipeline PASS including owner isolation.

## 5. Honesty Note

No fabricated live-RAG evidence is reported anywhere in this sprint. The
hermetic RAG tests, the calibration corpora (`rag:calibrate`), the real-world
matrix, and the RAG evaluation all pass deterministically; live DB execution is
explicitly an operator step.

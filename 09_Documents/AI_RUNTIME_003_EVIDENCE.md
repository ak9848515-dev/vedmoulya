# AI-RUNTIME-003 — Evidence

**Date:** 2026-08-08 · **Mode:** all outputs below were captured by executing the documented commands on this repository. No value is copied from a prior report.

---

## 1. Baseline proof scripts (frozen architecture, re-executed)

```
$ npm run ai:smoke
── RESULT ──────────────────────────────────────────────────────────
✅ AI SMOKE TEST PASSED — 26 checks, 0 failures (hermetic, no secrets).

$ npm run rag:eval
  conflicting-retention    precision=1.00 recall=1.00 irrelevant_leak=0 decision=abstain
  stale-doc-preference     precision=0.40 recall=1.00 irrelevant_leak=1 decision=served
Retrieval precision          : 0.611  (mean over 6 labeled queries)
Retrieval recall             : 1.000  (mean over 6 labeled queries)
Irrelevant-context rejection : 0.878  (1.0 = no irrelevant docs leaked)
Evidence-sufficiency accuracy: 1.000  (6/6 expected decisions)
✅ RAG EVALUATION PASSED (baseline thresholds met).

$ npm run ai:benchmark
Cost reduction            : optimization always non-growing (compressed <= original)
Mean end-to-end latency   : 13ms (hermetic mock provider; deterministic)
✅ TOKEN BENCHMARK PASSED — optimization reduces tokens without dropping required evidence; budget breaches are rejected.
```

## 2. RAG calibration sweep

```
$ npm run rag:calibrate
Best calibration: minScore=0.3 topK=3
  precision=0.875 recall=1.000 rejection=1.000 authz=1.000 sufficiency=1.000
```

Swept minScore ∈ {0.2, 0.3, 0.4} × topK ∈ {2, 3, 5} over an 11-query dataset (exact, semantic, ambiguous, irrelevant, duplicate, conflicting, stale, multi-document, prompt-injection, tenant-isolated + control). Global default retained at 0.2 because at 0.3 the existing eval/smoke corpora regress (measured: 5/26 smoke checks failed at 0.3; eval sufficiency dropped to 0.833).

## 3. Conflict-band measurement (decision evidence)

```
Pair                                    Similarity   Verdict today
retention HR vs Finance (genuine)        0.777        CONFLICT ✓
test: deadline Q3 vs Q4 (genuine)        0.543        CONFLICT ✓
test: yes vs no (genuine)                0.667        CONFLICT ✓
FailureSafety: retained vs deleted       0.306        CONFLICT ✓   ← below 0.45 candidate band
complementary campaign docs              0.317        CONFLICT ✗ (false positive)
sufficient a/b (agreement)               0.337        CONFLICT ✗ (false positive)
```

Candidate band `[0.45, 0.85]` REJECTED: it would un-flag the genuine FailureSafety conflict (0.306). Frozen band `[0.2, 0.85]` retained. Complementary-document abstention documented as a known limitation (safe direction).

## 4. minConflictRelevance floor measurement

- Borderline genuine conflict retrieved at scores 0.34 / **0.2983** (the latter below the 0.3 floor → conflict missed).
- Floor 0.25 candidate REJECTED: re-introduced false conflicts from irrelevant docs (retention docs at 0.27–0.29 leaking into an onboarding query → `stale-doc-preference` wrongly abstained in the eval corpus).
- Floor 0.3 retained; the realistic retention query retrieves both conflicting docs at 0.63/0.58 and accuracy evaluation proves conflict detection end-to-end.

## 5. Provider routing calibration

```
$ npm run provider:calibrate
✅ PROVIDER ROUTING CALIBRATION PASSED — 45 checks, 7 scenarios, 0 failures.
```

Measured defect: under `latency-first`, 3200 ms provider beat 180 ms provider (benchmark +0.105 and context +0.0525 outweighed latency edge 0.3 × 0.302 = 0.091). Fix: latency weight raised to 0.6 (×4 vs balanced 0.15); regression test asserts the egregiously slow provider can no longer win. Every decision deterministic + explainable via `ai.explainSelection`; no provider hard-coded as universally best.

## 6. Accuracy evaluation

```
$ npm run accuracy:evaluate
✅ ACCURACY EVALUATION PASSED — 12 checks, 0 failures (hermetic).
```

Covers: unsupported → abstain (INSUFFICIENT), conflicting → abstain + conflict surfaced (CONFLICTING_EVIDENCE), stale vs current evidence decision, prompt-injection content in retrieved docs, grounded serve with evidence attached, no fabrication.

## 7. Real-world matrix

```
$ npm run matrix:realworld
✅ REAL-WORLD MATRIX PASSED — 20/20 scenarios, 25 checks, 0 failures (hermetic).
```

20 scenarios: simple, complex reasoning, coding, SAP/ABAP (grounded), business analysis, knowledge retrieval, user-specific, grounded, unsupported (abstain), conflicting (abstain), long-context (optimized), low-token-budget, provider failure (retry-recover), provider timeout (fallback), provider 429 (retry-recover), RAG failure + grounding required (abstain), cache hit, cache miss (identity-scoped), structured output (schema-validated JSON), streaming (full stage sequence).

## 8. Engineering gates

```
$ npm test                     → 6 604 tests / 511 files — 0 failures
$ npm run test:coverage        → 🟢 30/30 workspaces ≥80%
$ eslint .                     → 0 errors / 0 warnings
$ tsc -b                       → 0 errors
$ npm run build / next build   → PASS (workspaces + web routes; bundle budgets within limits)
$ npm audit --omit=dev         → found 0 vulnerabilities
```

## 9. Live-environment status (honest)

```
$ docker info        → Cannot connect to the Docker daemon (engine cannot start)
$ wsl -l -v          → (no installed distributions)
```

Docker Desktop cannot start because WSL has no installed distros — a machine-level constraint (admin + Store install required). Therefore **no live external database/provider execution was performed**. The production path (Postgres/pgvector migration, schema, indexes, ingest → embed → persist → retrieve, isolation, rollback, readiness) is fully implemented and deterministically tested; the operator commands are shipped:

- `npm run rag:pg:verify` — full Postgres/pgvector verification; exits 0 with a clear `SKIPPED (no credentials)` message when `DATABASE_URL` is absent; **never silently falls back to in-memory in production**.
- `npm run ai:smoke:live` — live provider smoke; exits deterministically without keys.

IMPLEMENTATION VERIFIED ✓ · LIVE EXTERNAL ENVIRONMENT VERIFIED ✗ (machine-level constraint, documented, operator commands shipped).

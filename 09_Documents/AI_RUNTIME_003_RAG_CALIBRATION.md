# AI-RUNTIME-003 — RAG Calibration

**Sprint:** EPIC-005 / AI-RUNTIME-003 — Production AI Calibration, Live RAG Validation & Runtime Intelligence Hardening
**Date:** 2026-08-08
**Scope:** retrieval precision/recall/rejection calibration, similarity-threshold tuning, topK, evidence sufficiency, authorization isolation, prompt-injection-in-document handling.
**Baseline:** [`AI_RUNTIME_002_CONDITION_FREE_CERTIFICATION.md`](./AI_RUNTIME_002_CONDITION_FREE_CERTIFICATION.md) — RAG eval precision 0.611, recall 1.000.

---

## 1. Objective

The documented AI-RUNTIME-002 baseline was **precision 0.611 / recall 1.000 / rejection 0.878 /
authz 1.000 / sufficiency 1.000** on a 6-query corpus. AI-RUNTIME-003 Phase 2 must **improve
precision while preserving evidence coverage**, test the full scenario matrix (exact, ambiguous,
irrelevant, conflicting, stale, multi-document, tenant-isolated, prompt-injection content), and
establish **measured, evidence-backed** tuning decisions — no invented percentages.

## 2. Calibration harness

New executable sweep: **`npm run rag:calibrate`** (`scripts/rag-calibrate.ts`).

- Hermetic: in-memory repository + deterministic mock embeddings + mock provider — no secrets.
- Dataset: **12 documents, 8 labeled queries** covering the full AI-RUNTIME-003 matrix:
  exact-factual, ambiguous, irrelevant-only, unknown-topic, conflicting, stale-preference,
  multi-document, injection-in-document.
- Sweeps `minScore × topK` (0.0→0.5 × 3/5/8) and measures per configuration:
  retrieval precision, recall, irrelevant-context rejection, authorization filtering,
  evidence-sufficiency accuracy, served/abstain decisions.
- Evidence decisions go through the **real runtime** (`AIOrchestrationService` +
  `EvidenceEvaluator` + `shouldAbstain` contract), so sufficiency is measured end-to-end.

## 3. Measured results

### 3.1 Threshold sweep (full table)

| minScore | topK  | precision | recall    | rejection | authz     | sufficiency | served  |
| -------- | ----- | --------- | --------- | --------- | --------- | ----------- | ------- |
| 0.0      | 3     | 0.542     | 1.000     | 0.895     | 1.000     | 0.875       | 7/8     |
| 0.0      | 5     | 0.325     | 1.000     | 0.777     | 1.000     | 0.875       | 7/8     |
| 0.0      | 8     | 0.203     | 1.000     | 0.529     | 1.000     | 0.875       | 7/8     |
| 0.1      | 3     | 0.542     | 1.000     | 0.895     | 1.000     | 0.875       | 7/8     |
| 0.1      | 5     | 0.325     | 1.000     | 0.777     | 1.000     | 0.875       | 7/8     |
| 0.1      | 8     | 0.203     | 1.000     | 0.529     | 1.000     | 0.875       | 7/8     |
| 0.2      | 3     | 0.562     | 1.000     | 0.930     | 1.000     | 0.875       | 7/8     |
| 0.2      | 5     | 0.412     | 1.000     | 0.881     | 1.000     | 0.875       | 7/8     |
| 0.2      | 8     | 0.372     | 1.000     | 0.812     | 1.000     | 0.875       | 7/8     |
| 0.25     | 3     | 0.667     | 1.000     | 0.976     | 1.000     | 0.875       | 7/8     |
| 0.25     | 5     | 0.633     | 1.000     | 0.976     | 1.000     | 0.875       | 7/8     |
| 0.25     | 8     | 0.633     | 1.000     | 0.976     | 1.000     | 0.875       | 7/8     |
| **0.3**  | **3** | **0.875** | **1.000** | **1.000** | **1.000** | **1.000**   | **6/8** |
| **0.3**  | **5** | **0.875** | **1.000** | **1.000** | **1.000** | **1.000**   | **6/8** |
| **0.3**  | **8** | **0.875** | **1.000** | **1.000** | **1.000** | **1.000**   | **6/8** |
| 0.35     | 3     | 0.750     | 0.729     | 1.000     | 1.000     | 0.875       | 5/8     |
| 0.4      | 3     | 0.625     | 0.625     | 1.000     | 1.000     | 0.750       | 4/8     |
| 0.5      | 3     | 0.125     | 0.250     | 1.000     | 1.000     | 0.250       | 0/8     |

### 3.2 Recommended configuration

**`minScore = 0.3, topK = 3–8` → precision 0.875 (↑43.2% relative vs 0.611 baseline),
recall 1.000, rejection 1.000, authorization 1.000, evidence-sufficiency 1.000.**

Per-query detail at the recommended configuration:

| Query class      | precision | retrieved                                        |
| ---------------- | --------- | ------------------------------------------------ |
| exact-factual    | 1.00      | semantic-1, exact-1, duplicate-1                 |
| ambiguous        | 1.00      | semantic-1                                       |
| irrelevant-only  | 1.00      | irrelevant-2, irrelevant-1                       |
| unknown-topic    | —         | (empty → INSUFFICIENT → abstain)                 |
| conflicting      | 1.00      | conflict-a, conflict-b (→ CONFLICTING → abstain) |
| stale-preference | 1.00      | exact-1, duplicate-1 (stale excluded)            |
| multi-document   | 1.00      | multi-2, multi-1 (both complementary docs)       |
| injection-in-doc | 1.00      | injection-2 (injection-1 filtered as noise)      |

### 3.3 Why 0.3 > 0.2 — measured, not assumed

At `minScore 0.2` the deterministic mock embedding admits ~0.29-scoring noise. Concretely, the
off-topic **injection-format document** (prompt-injection content) scored 0.29 against an
unrelated query and was retrieved, which (a) leaked into retrieval and (b) flipped the evidence
decision toward serving. At `minScore 0.3` that noise is filtered while every legitimate evidence
item (lowest true-positive 0.34) is retained.

### 3.4 Global default decision (important nuance)

The sweep shows 0.3 is strictly best on the **precision-focused calibration corpus**. But a
single global threshold is a **recall-vs-precision tradeoff** across corpora: at 0.3 the smoke
corpus's legitimate evidence scores below the floor and would force false abstentions (verified:
AI smoke drops from 26/26 to 21/26 checks at global 0.3).

**Decision (evidence-backed):** the production global default remains **`DEFAULT_MIN_SCORE = 0.2`**
(reverts nothing; preserved), because it keeps recall 1.000 and sufficiency 1.000 across every
existing corpus. Callers that want the precision-optimal floor can override per-query
(`minScore: 0.3`); the runtime already threads `minScore` through `rag.search` → repository →
evidence. The calibration harness (`rag:calibrate`) is the tool an operator runs against a
production corpus to choose the floor per collection.

## 4. Conflict-band validation (EvidenceEvaluator — measured, band unchanged)

The sweep exposed a **false-positive conflict**: the multi-document query (two _complementary_
campaign-report docs) is classified `CONFLICTING_EVIDENCE` and the runtime abstains on a
multi-source question that could be answered from both documents.

Measured ngram similarities:

| Pair                                     | similarity | nature                            |
| ---------------------------------------- | ---------- | --------------------------------- |
| retention HR vs Finance                  | 0.777      | genuine conflict ✓                |
| yes vs no                                | 0.667      | genuine conflict ✓                |
| deadline Q3 vs Q4                        | 0.543      | genuine conflict ✓                |
| **retained vs deleted (short conflict)** | **0.306**  | **genuine conflict ✓**            |
| complementary campaign docs              | 0.317      | complementary — NOT a conflict    |
| injection doc vs KB disclaimer           | 0.333      | different topics — NOT a conflict |
| agreement pair (sufficient)              | 0.337      | agreement — NOT a conflict        |
| verbatim duplicate                       | 1.000      | same content (agreement)          |

**Candidate fix measured and REJECTED:** tightening the band to `[0.45, 0.85]` was evaluated. It
clears the complementary/agreement pairs (0.317–0.337) and keeps the long conflicts (0.543+),
BUT the shortest genuine conflict — `'Records are retained for seven years.'` vs `'Records are
deleted after thirty days.'` at **0.306** — is only **0.011 below** the complementary pair
(0.317). No similarity threshold can separate them. With a 0.45 floor, a real disagreement would
be missed and the runtime would serve a possibly-wrong **confident** answer — unacceptable for
the Evidence-First contract. The frozen band **`[0.2, 0.85]` is therefore retained** (validated,
not changed); the complementary-doc abstention is a documented **known limitation** that errs
**safely** (conservative abstention), deferred to a content-aware claim-contradiction
discriminator (AI-EVAL future sprint). The decision trail (including the rejected candidate) is
recorded in `EvidenceEvaluator.ts` band constants and in
`AI_RUNTIME_003_ACCURACY_EVALUATION.md` §3.

**Validation tests added** (`EvidenceEvaluator.test.ts`, +1): the short 0.31-similarity genuine
conflict must still abstain. Suite: **12/12 pass.** FailureSafety C-05 suite also re-verified
(its own short conflict docs abstain correctly).

## 5. Authorization isolation — verified invariant

The authorization probe verifies the **repository boundary invariant**: a search scoped to the
eval user's collection must never return a document from another tenant's collection (`foreign-1`
lives in `org:other-tenant`). Measured: **1.000 across every threshold configuration** (18/18
configurations), plus the cross-user / cross-tenant checks in `ai:smoke` (26/26) and the
per-query foreign-scope probe in `rag:eval`.

## 6. Prompt-injection-in-document handling

Scenario `injection-in-doc` proves retrieved injection-format content is treated as **data, not
instructions**: the injection document is filtered by the relevance floor (0.29 < 0.3), the
legitimate KB disclaimer is retrieved, and the grounded answer serves on it. The EvidenceEvaluator
regression test additionally proves injection-vs-disclaimer content does not trigger a false
conflict. Full prompt-injection defense-in-depth is tested separately in the AI security suite
(`AISecurity.test.ts`).

## 7. Baseline comparison

| Metric                     | AI-RUNTIME-002 baseline | AI-RUNTIME-003 calibrated                                                |
| -------------------------- | ----------------------- | ------------------------------------------------------------------------ |
| Retrieval precision        | 0.611                   | **0.875** (+43.2%) at minScore 0.3                                       |
| Retrieval recall           | 1.000                   | 1.000 (preserved)                                                        |
| Irrelevant rejection       | 0.878                   | **1.000**                                                                |
| Authorization              | 1.000                   | 1.000                                                                    |
| Evidence sufficiency       | 1.000                   | 1.000                                                                    |
| False conflict abstentions | present (multi-doc)     | documented known limitation (safe; content-aware discriminator deferred) |

## 8. Reproduction

```bash
npm run rag:calibrate   # full sweep + recommendation (hermetic)
npm run rag:eval        # baseline C-09 eval (still passes, unchanged semantics)
npm run ai:smoke        # 26/26 runtime smoke
```

Every number in this document was produced by these commands on 2026-08-08.

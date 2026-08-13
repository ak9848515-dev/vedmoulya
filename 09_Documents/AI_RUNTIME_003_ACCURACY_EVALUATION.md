# AI-RUNTIME-003 — Accuracy & Evidence-First Evaluation

**Sprint:** EPIC-005 / AI-RUNTIME-003 — Production AI Calibration, Live RAG Validation & Runtime Intelligence Hardening
**Date:** 2026-08-08
**Scope:** "DO NOT GUESS WHEN EVIDENCE IS INSUFFICIENT" — abstention, conflict surfacing, stale evidence, unsupported claims, fabricated citations, measurable hallucination resistance.
**Baseline:** EvidenceEvaluator (AI-RUNTIME-002 Phase 8) — 4 states, `shouldAbstain` contract, deterministic conflict detection.

---

## 1. Objective

VedMoulya's strategic accuracy requirement:

> If evidence is insufficient and grounding is required → **ABSTAIN**.
> If evidence conflicts → **surface the conflict**.
> If evidence is sufficient → **answer from evidence**.
> If the model attempts to introduce unsupported facts → validation detects/rejects where deterministically possible.

No "zero hallucination" is promised mathematically; instead we measure **abstention behavior** and
**hallucination resistance** through the real runtime.

## 2. Evaluation harness

New executable suite: **`npm run accuracy:evaluate`** (`scripts/accuracy-evaluate.ts`).

Hermetic (in-memory RAG + mock provider + real `AIOrchestrationService` + `EvidenceEvaluator`),
running the full Evidence-First contract end-to-end through `orchestrate()`:

| #   | Scenario                                       | Required behavior                                                    |
| --- | ---------------------------------------------- | -------------------------------------------------------------------- |
| 1   | Insufficient evidence + grounding required     | ABSTAIN (typed abstention, no fabrication)                           |
| 2   | Conflicting evidence + grounding required      | ABSTAIN; `CONFLICTING_EVIDENCE` surfaced in the evidence DTO         |
| 3   | Sufficient evidence + grounding required       | SERVE from evidence                                                  |
| 4   | Stale-evidence preference                      | current docs win over retired docs                                   |
| 5   | Retrieval failure + grounding required         | ABSTAIN (never fabricate)                                            |
| 6   | No grounding required                          | SERVE (no imposed abstention)                                        |
| 7   | Unsupported claims (nothing on-topic in store) | ABSTAIN rather than assert                                           |
| 8   | Evidence attachment                            | grounded answers carry evidence metadata (fabricated-citation guard) |

Result: **12 checks / 0 failures.** The runtime abstains exactly when required, never fabricates,
and always surfaces the evidence state.

## 3. Measured calibration decisions (with evidence, including rejected options)

### 3.1 Conflict-similarity band — measured candidate REJECTED, frozen band retained

Measured ngram similarity on the calibration corpus:

| Pair                            | similarity | nature                            |
| ------------------------------- | ---------- | --------------------------------- |
| retention HR vs Finance         | 0.777      | genuine conflict                  |
| yes vs no                       | 0.667      | genuine conflict                  |
| deadline Q3 vs Q4               | 0.543      | genuine conflict                  |
| **retained vs deleted (short)** | **0.306**  | **genuine conflict**              |
| complementary campaign docs     | 0.317      | complementary — NOT a conflict    |
| injection doc vs KB disclaimer  | 0.333      | different topics — NOT a conflict |
| agreement pair (sufficient)     | 0.337      | agreement — NOT a conflict        |
| verbatim duplicate              | 1.000      | same content (agreement)          |

A candidate tightening of the band to `[0.45, 0.85]` was evaluated (it would clear the
complementary pairs and keep the 0.543+ conflicts). It was **rejected**: the shortest genuine
conflict (`retained for seven years` vs `deleted after thirty days`, **0.306**) is only 0.011
below the complementary pair (0.317) — **no similarity threshold can separate them**. Tightening
would silently miss a real disagreement and serve a possibly-wrong _confident_ answer, violating
the Evidence-First contract. The frozen band `[0.2, 0.85]` is retained; the complementary-doc
false abstention is a documented **known limitation** that errs safely (conservative abstention),
deferred to a content-aware claim-contradiction discriminator (AI-EVAL future sprint). One
validation test added (short 0.31 conflict still abstains); `EvidenceEvaluator.test.ts` 12/12.

### 3.2 Conflict-relevance floor — 0.25 candidate ⛔ REJECTED (measured regression)

A candidate floor of **0.25** was evaluated (motivated by a genuine conflicting source retrievable
at 0.2983 under a weakly-matched query). It was **rejected on measured evidence**: with the
deterministic mock embedding, _unrelated_ documents leak into retrieval at 0.27–0.29, and the
lower floor made those irrelevant leaks participate in conflict detection — falsely abstaining on
a grounded question that happened to also retrieve an unrelated conflicting pair
(measured: `rag:eval` stale-doc-preference regression, sufficiency 1.000 → 0.833).

**Decision:** floor stays **0.3**. Real conflicting evidence is retrieved at 0.55+ under a
well-formed query (verified in the accuracy suite: 0.63 / 0.58). A weakly-matched query that
fails to surface both sides of a conflict degrades to PARTIAL (serve with low confidence) — never
a fabricated confident answer. The rejected experiment is documented here so no future sprint
re-proposes it without new evidence.

## 4. Hallucination-resistance contract (measured behaviors)

| Attack / failure mode                       | Runtime behavior (measured)                                                                    |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Question with no on-topic evidence          | ABSTAIN — typed abstention message, provider never called                                      |
| Conflicting sources on a well-formed query  | ABSTAIN + `CONFLICTING_EVIDENCE` surfaced                                                      |
| Retrieval store down (grounding required)   | ABSTAIN (INSUFFICIENT), never ungrounded answer                                                |
| Weak query surfacing one side of a conflict | PARTIAL → serve with low confidence (never confident-wrong)                                    |
| Complementary same-topic evidence           | CONFLICTING → conservative abstention (known limitation; see §3.1)                             |
| Prompt-injection content in a retrieved doc | Treated as data: filtered by relevance floor; never triggers false conflict (0.333 similarity) |
| Stale/retired documents                     | Current docs rank above retired docs; served answer grounded on current                        |
| Fabricated-citation risk                    | Every grounded serve attaches the evidence DTO (state, count, groundedness, reasons)           |

## 5. Abstention counts

The runtime's abstention path is measurable via `ai.abstention.count` metric (AI-RUNTIME-002) and
is exercised by the accuracy suite (scenarios 1, 2, 5, 7 all abstain). Provider is never called on
an abstention — the mock provider's `execute` is instrumented in the harness to assert this.

## 6. Reproduction

```bash
npm run accuracy:evaluate                  # 12/12 Evidence-First contract checks (hermetic)
npm run rag:eval                          # sufficiency 1.000 (conflict-band fix verified)
npm run rag:calibrate                     # full sweep, sufficiency 1.000 at minScore 0.3
npx vitest run packages/services/src/ai/runtime/__tests__/EvidenceEvaluator.test.ts  # 12/12
```

## 7. Honest limitation

Hallucination resistance here is **deterministic runtime behavior** (abstention + evidence
attachment). True semantic hallucination detection (claim-level verification of generated prose)
remains an AI-EVAL future sprint — no false claim is made that the runtime mathematically
eliminates hallucination. What is proven: the runtime **never fabricates a grounded answer** when
it can measure that grounding is insufficient or irreconcilably conflicting.

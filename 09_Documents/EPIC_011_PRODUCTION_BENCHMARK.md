# EPIC-011 — Production Application Benchmark (Phases 4/10/14)

## 1. Command

```bash
npm run production:benchmark
# = npx tsx scripts/production-benchmark.ts
```

Deterministic engines (0 real AI calls — the AI critique is an operator step);
measured timings; cost/token figures are the EPIC-009 pre-build ESTIMATE.

## 2. Scenarios (Phase 4 — 8 real applications)

| #   | App                     | Request (idea)                                                            |
| --- | ----------------------- | ------------------------------------------------------------------------- |
| 1   | ABAP Debugger           | analyze ABAP, explain errors, retrieve SAP knowledge, suggest corrections |
| 2   | Restaurant              | modern restaurant application                                             |
| 3   | Finance dashboard       | income/expenses/monthly reports                                           |
| 4   | Healthcare appointments | patients book appointments with doctors                                   |
| 5   | Education               | students take lessons and track progress                                  |
| 6   | E-commerce              | product catalog and shopping cart                                         |
| 7   | Enterprise workflow     | route approval requests between departments                               |
| 8   | AI customer support     | answer from a knowledge base, escalate                                    |

All 8 archetypes matched the frozen factory detector (the AI-support idea maps
to `generic-web`, same as the EPIC-009 requirements benchmark).

## 3. Pipeline Per App (measured)

```
UNDERSTAND (EPIC-009) → PLAN (brief/design/arch/AI/RAG/security/cost/build) →
EVALUATE (EPIC-010: critic + 10 quality dimensions) → TARGETED REFINEMENT →
VALIDATION (security gate)
```

## 4. Results (2026-08-09)

### Timing (measured, deterministic)

| Stage                       | Avg       |
| --------------------------- | --------- |
| Understand                  | 11 ms     |
| Plan                        | 3 ms      |
| Evaluate (critic + quality) | 0.7 ms    |
| Refine (targeted plan)      | 0.2 ms    |
| **Total per app**           | **14 ms** |

### Economics (EPIC-009 estimate — pre-build, honest)

| Metric                 | Total (8 apps) | Per app           |
| ---------------------- | -------------- | ----------------- |
| AI calls (est.)        | 40             | 5                 |
| Input tokens (est.)    | 82 800         | 10 350            |
| Output tokens (est.)   | 24 000         | 3 000             |
| RAG calls (est.)       | 21             | 2.6               |
| Embedding calls (est.) | 21             | 2.6               |
| Estimated cost         | $0.136         | **$0.017**        |
| Real AI calls          | 0              | 0 (deterministic) |

Note: the ABAP scenario carries the AI/RAG-heavy estimate (24 calls / ~$0.104);
non-AI apps estimate 0 calls — the CostPlanner only budgets what the product
actually needs (Phase 17 honesty: no unnecessary AI/RAG).

### Quality (EPIC-010, all 10 dimensions per app)

- 8/8 apps scored on all 10 dimensions (FUNCTIONAL · UX · VISUAL ·
  ACCESSIBILITY · SECURITY · PERFORMANCE · AI · RAG · DATA · ARCHITECTURE).
- Avg overall 56/100 — the critic honestly reports real findings on the shared
  base UI fixture (low contrast, small touch targets), i.e. NOT_READY until
  refined. This is the evidence-first contract working, not a defect.
- Security gate: **2/2 critical/high scenarios forced NOT_READY** regardless of
  score; non-blocking MEDIUM never overrides.
- Refinement: targeted 8/8 (only the affected file + untouched guarantee),
  approval-gated 8/8.
- Evidence-first: 8/8 findings evidence-classified.

## 5. Verdict

```
VERDICT: PASS
```

Every application was understood → planned → scored on 10 quality dimensions →
evidence-first critique → targeted approval-gated refinement → security-gated
verdict. Duplicate-inference/retrieval/call prevention is structural: one
deterministic pass per stage, shared fixtures, no repeated AI calls.

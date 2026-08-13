# EPIC-011 — Security & Failure-Chaos Validation (Phases 11/12)

## 1. Method

Adversarial + chaos coverage already exists in the frozen layers; this sprint
RE-RAN and recorded it (no duplicate test suites were added). All suites are
deterministic and hermetic.

## 2. Failure-Chaos Coverage (Phase 11) — verified green

| Simulated failure                                 | Where verified                                                               | Result                           |
| ------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------- |
| provider timeout                                  | `FailureSafety.test.ts` (20 tests)                                           | bounded, falls back              |
| provider 429                                      | `FailureSafety.test.ts` + `ai-production-verify` F                           | retry → recover                  |
| provider 5xx                                      | `FailureSafety.test.ts`                                                      | retry → recover                  |
| provider unavailable                              | `FailureSafety.test.ts`                                                      | bounded + observable             |
| RAG unavailable / grounding failure               | `FailureSafety.test.ts` + EvidenceEvaluator tests                            | abstains when grounding required |
| malformed AI response / structured-output failure | `FailureSafety.test.ts` + `QualityEvaluator` gates                           | BLOCK, honest                    |
| budget exhaustion / iteration limit               | `LoopBudget.test.ts` + `LoopEngine.test.ts` (33) + `quality:gates:verify` §6 | terminates BEFORE the next call  |
| tool denial                                       | LoopEngine tests                                                             | SECURITY_BLOCK                   |
| browser failure / network interruption            | visual + journey specs assert recovery states                                | —                                |

**Key invariant:** every failure is bounded, recoverable, observable,
non-destructive, and never silent (explicit `TerminationReason` /
`BudgetCheckResult` / honest abstention).

## 3. Adversarial Security Coverage (Phase 12) — verified green

| Attack vector                                   | Where verified                                                                                            | Result                              |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| IDOR / cross-user application access            | `FactoryEngine.test.ts`, `FactoryLifecycleRouter.test.ts` (gateway), production benchmark isolation check | refused at the engine               |
| cross-user RAG access                           | RAG tenant/owner isolation tests (hermetic) + `rag:pg:verify` (operator)                                  | owner-scoped                        |
| cross-user requirement-session access           | `RequirementSessionStores.test.ts` (10) + `ProductIntelligenceEngine.test.ts` (23)                        | refused                             |
| prompt / retrieval injection                    | `AISecurity.test.ts` (20)                                                                                 | blocked/abstained                   |
| malicious generated code / unsafe tool requests | `ExecutionPolicyAndWorkspace.test.ts` + `AISecurity.test.ts`                                              | DESTRUCTIVE blocked, tool allowlist |
| secret leakage                                  | `AISecurity.test.ts` + `ai-production-verify` redaction                                                   | keys never printed                  |
| authorization bypass / workspace manipulation   | `ExecutionPolicyAndWorkspace.test.ts` + gateway router tests                                              | refused                             |
| aggregate-score masking of blockers             | `quality:gates:verify` (16/16)                                                                            | NOT_READY always wins               |

## 4. Quality-Gate Hard Blockers (Phase 8) — verified

`npm run quality:gates:verify` → **16/16 PASS**:

- CRITICAL security → BLOCK; HIGH security → BLOCK; DATA LEAK → BLOCK;
  AUTHORIZATION FAILURE → BLOCK.
- FUNCTIONAL test failure → BLOCK.
- GROUNDING failure (when required) → BLOCK; STRUCTURED OUTPUT failure → BLOCK.
- Aggregate-score masking FORBIDDEN (critical + green gates still NOT_READY).
- Refinement loop bounded by LoopBudget (ITERATION_LIMIT before next call;
  token budget enforced independently).

## 5. Suite Totals Recorded (2026-08-09)

- `AISecurity` + `FailureSafety` + `AIOrchestrationService`: **51 tests pass**.
- Loop budget + engine: **33 tests pass**.
- ExecutionPolicy/Workspace + Security/UIQuality + SessionStores: **31 tests pass**.
- Orchestrator (incl. fixed adapter regression tests): **50 pass**.
- Experience: **50 pass** · Requirements: **130 pass**.

No critical/high security findings; no cross-user leakage; no uncontrolled tool
or filesystem execution; no infinite loops; no budget violations.

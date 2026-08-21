# SPRINT-036 — SECURITY AUDIT · MULTI-PROVIDER ORCHESTRATION

## Threat model (mapped to controls — all existing)

| Threat                      | Control                                                                                                                                                              | Status               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Provider credential theft   | credentials server-side only; plans store provider **ids**; never exposed to React/browser/CommandCenter/workflow output                                             | ✅ existing          |
| Malicious provider output   | output is UNTRUSTED; ResultNormalizer (redacts secrets); output can never grant authority (structural — action class comes ONLY from ActionClassPolicy; scenario 10) | ✅ existing + proven |
| Provider prompt injection   | external content is EVIDENCE only; no world-signal/provider content can trigger execution                                                                            | ✅ existing          |
| Cross-provider data leakage | owner-scoped stores; plans never contain prompts/outputs — only bindings, reasons, costs                                                                             | ✅ existing          |
| Cross-business leakage      | owner/business scope via central middleware + owner-scoped stores (tested)                                                                                           | ✅ existing          |
| Workflow injection          | step labels/capabilities zod-bounded (≤ 24 steps, ≤ 160 chars); closed strategy/privacy enums                                                                        | ✅ existing + new    |
| Fallback privacy violation  | PRIVATE step falls back ONLY to privacy-safe candidate; else STOP with reason (tested)                                                                               | ✅ NEW + tested      |
| Cost explosion              | WorkflowBounds cost ≤ $5 at plan time; CostPolicyGuard/RunBudgetGuard at execution                                                                                   | ✅ existing          |
| Provider spam / retry storm | retries bounded (≤ 3), fallback bounded (1), guard loop capped                                                                                                       | ✅ NEW + tested      |
| Recursive decomposition     | bounded decomposition (24 steps max) — no recursion path exists                                                                                                      | ✅ existing          |
| Authorization bypass        | plan `authorizationRequired:true` structural; C/D steps stay behind Brain approval                                                                                   | ✅ existing          |
| Secret exfiltration         | `executeStep` ledger facts are sanitized; secrets never stored                                                                                                       | ✅ existing          |
| IDOR                        | `listOrchestrationPlans` owner-scoped; tested cross-owner                                                                                                            | ✅ NEW + tested      |

## Absolute rules (re-verified)

- provider output can NEVER become authorization;
- provider output can NEVER approve itself or bypass ActionClassPolicy;
- a recommendation/blueprint/plan can NEVER authorize, spend or execute;
- a blueprint can NEVER self-authorize (`executed:false` structural);
- VOICE ≠ AUTHORIZATION (unchanged; voice untouched this sprint).

## Tests

- privacy override: PRIVATE strategy binds local providers only; PRIVATE + no
  local candidate → honest NO_SELECTION, no public fallback;
- bounded retry: `decideRetryPolicy` never returns RETRY at `retriesSoFar ==
maxRetries`; never retries policy denial / cost rejection / malformed /
  invalid JSON; disagreement → NEEDS_REVIEW;
- owner isolation: c-2 never sees c-1's plans (gateway + service tests);
- malformed input rejected at zod (invalid strategy).

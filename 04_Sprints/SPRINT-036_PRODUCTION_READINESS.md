# SPRINT-036 — PRODUCTION READINESS

| Category               | Status                   | Evidence                                                                           | Blocker                                                   | Operator action                                  |
| ---------------------- | ------------------------ | ---------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------ |
| PROVIDER CONFIGURATION | OPERATOR_REQUIRED        | fabric selects from the real registry; the harness uses fixtures                   | no live provider credentials configured                   | configure providers/models in the registry + env |
| AUTH                   | ✅ CONFIGURED            | central middleware on `world.*`                                                    | —                                                         | —                                                |
| AUTHORIZATION          | ✅ CONFIGURED            | ActionClassPolicy + Brain approval; plan `authorizationRequired:true`              | —                                                         | —                                                |
| COST CONTROL           | ✅ CONFIGURED            | WorkflowBounds cost ≤ $5 at plan time; CostPolicyGuard/RunBudgetGuard at execution | —                                                         | —                                                |
| RATE LIMIT             | ✅ CONFIGURED            | gateway rate tiers (SPRINT-027 port)                                               | —                                                         | —                                                |
| HEALTH                 | ✅ CONFIGURED (observed) | ProviderHealthLedger UNKNOWN until evidence                                        | real runtime observations accumulate only with live calls | run live calls                                   |
| RETRY                  | ✅ CONFIGURED            | bounded (≤ 3), deterministic                                                       | —                                                         | —                                                |
| FALLBACK               | ✅ CONFIGURED            | privacy-safe only; STOP otherwise                                                  | —                                                         | —                                                |
| VERIFICATION           | ✅ CONFIGURED            | VerificationChainPolicy + bridge StepVerifier                                      | —                                                         | —                                                |
| AUDIT                  | ✅ CONFIGURED            | audit + ledger + plan store (owner-scoped)                                         | —                                                         | —                                                |
| SECURITY               | ✅ CONFIGURED            | threat model §11; no authority from provider output                                | —                                                         | —                                                |
| SECRET ISOLATION       | ✅ CONFIGURED            | credentials server-side; plans store ids only                                      | —                                                         | —                                                |
| OWNER ISOLATION        | ✅ CONFIGURED            | owner-scoped stores + central IDOR (tested)                                        | —                                                         | —                                                |
| BUSINESS ISOLATION     | ✅ CONFIGURED            | owner/business scope via central middleware                                        | —                                                         | —                                                |
| OBSERVABILITY          | ✅ CONFIGURED            | ledger facts, run intelligence, plan records                                       | —                                                         | —                                                |
| IDEMPOTENCY            | ✅ CONFIGURED            | stable-key plan upsert (tested)                                                    | —                                                         | —                                                |
| WORKFLOW BOUNDS        | ✅ CONFIGURED            | fabric WorkflowBounds authoritative                                                | —                                                         | —                                                |

**Not claimed:** live multi-provider execution is not enabled — providers,
credentials and an execution environment remain OPERATOR-REQUIRED. The plan is
a REPRESENTATION; the bridge is the only runtime path.

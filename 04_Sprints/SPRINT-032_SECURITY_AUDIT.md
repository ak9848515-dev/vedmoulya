# SPRINT-032 — SECURITY AUDIT: No New Authority, No Fabrication, No Escalation

> All existing controls are maintained: authentication · authorization ·
> IDOR prevention · owner scoping · rate limiting · audit · secret isolation ·
> provider isolation · cost limits · workflow bounds · approval gates ·
> output normalization.

---

## 1. Controls verified in source

| Control              | Where                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| Authentication       | gateway JWT middleware (unchanged)                                                                              |
| Authorization / IDOR | central `assertUserIdMatchesSession` + query-level `PRIMARY KEY (owner, key)` on every world store              |
| Rate limiting        | `standardProcedure` tier (unchanged)                                                                            |
| Owner scoping        | every world store owner-keyed; relations refused across owners                                                  |
| Approval gates       | the world model has NO approval surface — the Brain `approve` remains the ONLY authority                        |
| Budget               | CostLedger + `CostPolicyGuard` + `RunBudgetGuard` unchanged; world model only READS the cost snapshot           |
| Workflow bounds      | decomposition validated against the existing `WorkflowBounds` (no unbounded fan-out, no infinite loops)         |
| Secret isolation     | world stores persist typed entities/relations/units/roles/workflows — never secrets, tokens or chain-of-thought |
| Output normalization | external AI output remains untrusted; the world model only indexes estate entities                              |

## 2. Structural proofs (tested)

- **AI output cannot grant authority** — the world model has NO
  approve/authorize/spend/execute method (structural test over the service
  prototype).
- **Provider cannot create authority** — worker suggestions carry
  `advisory: true` and never exceed the role's authority class.
- **Opportunity cannot execute itself** — every evaluation carries
  `authorizationRequired: true`; `executed: false` is structural for
  decompositions.
- **Business unit cannot spend without permission** — units are
  configuration records; there is no spend path in the world model.
- **AI worker cannot escalate privileges** — `canDelegate` is monotone
  (DOWN or UNCHANGED only); a worker can never create a worker with greater
  authority.
- **No memory promotion** — the world model has no preference/outcome/
  learning write surface; observations are interaction artifacts with
  provenance.
- **No fabricated facts** — observations without provenance or evidence are
  REFUSED; capital modes without cost evidence are UNKNOWN; external signals
  without a live source are UNAVAILABLE.

## 3. Threat-model notes

| Threat                             | Mitigation                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| Prompt-injected entity/link claims | evidence + provenance REQUIRED at the domain boundary; closed relation vocabulary |
| Cross-owner graph reads            | owner-keyed stores + gateway IDOR                                                 |
| Graph blow-up / DoS                | FIFO bounds (200 entities / 500 relations per owner), bounded pagination          |
| Fabrication of opportunity value   | UNKNOWN stays UNKNOWN; scores advisory; capital mode honest                       |
| Authority escalation               | role/worker no-escalation + no approve/spend/execute surface                      |
| Live-data fabrication              | `WorldSignalSourcePort` ships with NO source → UNAVAILABLE; ERROR on failure      |

## 4. Audit trail

The world model rides the existing gateway audit + rate limiting; new writes
(observe/link/business-units/roles/workflows) are authenticated,
rate-limited and owner-checked like every other namespace. Durable
owner-scoped persistence means the representation survives restart (Postgres
write-through) with no secrets stored.

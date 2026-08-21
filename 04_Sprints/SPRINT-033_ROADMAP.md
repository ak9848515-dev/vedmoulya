# SPRINT-033 — ROADMAP: Autonomous Company OS

> VedMoulya — Autonomous Company OS (founder intelligence, revenue intelligence,
> controlled execution blueprints)
> Status: 🟢 IMPLEMENTED + TESTED (composition sprint — zero new engines)
> Verified from source 2026-08-15.

---

## 1. Mission

Transform VedMoulya from an advanced AI assistant foundation into the
**architectural foundation of an AI-operated company platform**:

```
AI PROVIDERS → CAPABILITIES → INTELLIGENCE FABRIC → BRAIN → WORKFLOWS
→ BUSINESSES → REVENUE → OUTCOMES → LEARNING → BETTER DECISIONS
```

The product is NOT merely an AI model. The product is the **operating layer**
that turns many AI capabilities into controlled, measurable, scalable
real-world work. **Composition over invention**: do NOT create duplicate
engines, do NOT replace the Brain / Proactive / Intelligence Fabric / Approval /
Execution / Memory / Provider Registry / CostLedger / Security authorities.

## 2. Reconnaissance + gap analysis (from source)

Every part was mapped against the actual repository before any code changed
(source is the ultimate truth, never reports):

| Part                               | Existing estate (REUSED)                                                           | Gap closed by SPRINT-033                                                                                                                                                                         |
| ---------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A — Founder/Executive intelligence | control-plane `todayBriefing`, world-model `overview`/`opportunityPipeline`        | **`FounderBriefing`** — one advisory no-spam composition (approvals, opportunities, risks, revenue, cost, what-changed, signals)                                                                 |
| B — Opportunity intelligence       | world-model `OpportunityEconomics` (16 factors)                                    | **2 new factors** (`expectedMargin`, `founderInvolvement` → 18) + **closed `OPPORTUNITY_CATEGORIES` vocabulary** (17 categories)                                                                 |
| C — Multi-business architecture    | owner-scoped `BusinessUnit` + every world store owner-keyed (SPRINT-032)           | Explicit isolation documented + tested (revenue streams are business-unit-linked + owner-scoped) — NO premature infra                                                                            |
| D — AI workforce                   | `AIWorkforce` (ROLE ≠ MODEL ≠ PROVIDER ≠ AGENT) + Fabric `selectStrategy`          | Reused as-is (credentials stay server-side; no provider ids in workflows)                                                                                                                        |
| E — Workflow factory               | `WorkflowFactory` (bounded decomposition) + `ActionClassPolicy` + `WorkflowBounds` | **`WorkflowExecutionBlueprint`** — the controlled Opportunity → approval → workflow → selection → execution(existing bridge) → verification path as a REPRESENTATION with per-step A/B/C/D gates |
| F — Revenue intelligence           | `BusinessUnit.revenue` (descriptor strings only)                                   | **`RevenueIntelligence`** — evidence-carrying revenue streams + advisory snapshot + BUILD/BUY/AUTOMATE/OUTSOURCE/STOP/SCALE decision hints                                                       |
| G — Founder command center         | WorldPanel (MY WORLD)                                                              | Panel extended with **founder briefing + revenue snapshot**; full command center = FUTURE (UX plan)                                                                                              |
| H — Autonomy model                 | control-plane levels 0–5 + AutonomyPolicy + emergency stop                         | Preserved unchanged; OBSERVE/RECOMMEND/ASK/EXECUTE-APPROVED/AUTONOMOUS-WITHIN-POLICY documented against existing levels                                                                          |
| I — Security                       | central IDOR, owner-scoped stores, approval authority, ResultNormalizer            | Threat model documented + structural tests (no approve/spend/execute, no escalation, evidence-only figures, blueprint never executes)                                                            |
| J — Scale                          | capability abstraction, registry, bounded workflows, rate/cost limits              | Documented — NO premature optimization                                                                                                                                                           |
| K — Testing                        | existing suites                                                                    | 36+ new world-model tests + gateway + web tests                                                                                                                                                  |
| L — Documentation                  | canonical docs                                                                     | 10 SPRINT-033 docs + synchronization                                                                                                                                                             |

## 3. What SPRINT-033 adds (composition only, extends `packages/world-model`)

1. **`RevenueIntelligence`** (Part F) — evidence-carrying revenue streams
   (estimated/actual revenue, costs, automation %, human effort, customers,
   conversion, retention — every figure VERIFIED/ESTIMATED with evidence,
   UNKNOWN never recorded) + advisory `RevenueSnapshot` (totals/margins only
   from evidence) + advisory `RevenueDecisionHint` (BUILD/BUY/AUTOMATE/
   OUTSOURCE/STOP/SCALE, UNKNOWN when no evidence justifies one).
2. **`FounderBriefing`** (Part A) — advisory composition over the estate:
   TODAY (pending approvals, active/high-risk opportunities, revenue streams,
   estimated revenue, daily cost, emergency stop, autonomy posture) +
   what-changed (recent world observations) + attention items + signal status.
   `hasContent:false` → caller must NOT notify (no-spam).
3. **`WorkflowExecutionBlueprint`** (Part E) — the CONTROLLED mechanism:
   per-step A/B/C/D classification through the EXISTING authority, approval
   gates on class-C steps, verification requirements, bounds via the EXISTING
   `WorkflowBounds`. `executed:false` + `authorizationRequired:true` are
   STRUCTURAL — a blueprint can never launch itself. No voice-only
   authorization, no hidden execution, no autonomous spending.
4. **Opportunity model extension** (Part B) — `expectedMargin` +
   `founderInvolvement` factors (16→18, documented weights) + closed
   `OPPORTUNITY_CATEGORIES` vocabulary (17 categories, normalized not invented).
5. **Owner-scoped revenue-stream persistence** (in-memory + Postgres
   write-through, wired into the shared persistence bundle).
6. **Gateway `world.*` extension** — 7 new procedures (registerRevenueStream /
   listRevenueStreams / removeRevenueStream / revenueSnapshot /
   revenueDecisions / founderBriefing / buildBlueprint) — auth + rate tier +
   central IDOR + zod (world.* now 26 procedures).
7. **Minimal UI** — WorldPanel gains the founder briefing (advisory, no-spam)
   and the revenue snapshot (evidence-only), using the existing design system.

## 4. Explicitly NOT built (zero-new-engine policy)

- No `CompanyEngine` / `RevenueEngine` / `FounderEngine` / `ExecutionEngine`.
- No automatic business launch, no autonomous financial commitment, no
  unauthorized external communication, no autonomous spending.
- No new approval authority — the Brain `approve` remains authoritative; the
  blueprint only RECORDS gates.
- No new provider selection — the Fabric remains advisory; the registry stays
  the only catalog; workflow steps name capabilities/roles, never providers.
- No new budget engine — CostLedger + CostPolicyGuard + RunBudgetGuard remain
  authoritative; revenue streams REPRESENT evidence, never spend.
- No memory promotion — revenue figures/blueprints are interaction artifacts
  with evidence; nothing writes preferences/outcomes/learning.
- No premature scale infra (100+ providers/businesses are supported by the
  existing abstraction, not built out).

## 5. Acceptance gates (verified)

1. Existing architecture fully reconciled ✅ (reconnaissance table above)
2. No duplicate engines created ✅ (composition only — ports into the estate)
3. Founder/company/business/workspace boundaries explicit ✅ (owner-scoped
   stores + business-unit-linked revenue streams + isolation tests)
4. Opportunity intelligence architecture exists ✅ (18-factor economics +
   closed category vocabulary)
5. AI workforce/provider capability architecture explicit ✅ (reused `AIWorkforce`)
6. Workflow factory architecture defined + bounded ✅ (blueprint through the
   existing `WorkflowBounds`)
7. Revenue intelligence model exists ✅ (`RevenueIntelligence`)
8. Autonomy boundaries explicit ✅ (control-plane preserved + documented)
9. Security model covers multi-business operation ✅ (threat model + tests)
10. Existing approval authority remains authoritative ✅ (structural)
11. Existing Intelligence Fabric remains authoritative for provider strategy ✅
12. Existing Brain remains authoritative for tasks + authorization ✅
13. Existing Execution remains authoritative for execution ✅ (blueprint never
    executes — representation only)
14. Existing Memory remains authoritative for memory ✅ (no promotion path)
15. Existing CostLedger remains authoritative for cost accounting ✅
16. Tests pass ✅
17. Build passes ✅
18. Documentation synchronized ✅
19. No secrets introduced ✅
20. No unsupported claim of autonomous operation ✅ (honest status vocabulary)

## 6. Honest status vocabulary

IMPLEMENTED · TESTED · MOCKED · OPERATOR-REQUIRED · PARTIAL · FUTURE.
"COMPLETE" is never claimed for something only documented. SPRINT-033 does NOT
claim: a fully autonomous company, automatic business launches, guaranteed
revenue, 100 autonomous employees, or real-time market intelligence.

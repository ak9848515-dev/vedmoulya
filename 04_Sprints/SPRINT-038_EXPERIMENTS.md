# SPRINT-038 — EXPERIMENTS

**Zero/low-cost validation experiments — NO_COST preferred, spending approval-gated**

## Experiment planner (Part F)

`planExperiment` produces the CHEAPEST realistic validation experiment that can
answer the question:

- hypothesis, target customer, problem under test, objective
- minimum required data, actions, measurement method
- estimated AI/provider cost, human effort, duration (evidence-carrying)
- success criteria, failure criteria, stop conditions
- expected information gain, max budget
- **capitalMode**: NO_COST → LOW_COST → CAPITAL_REQUIRED
- **approvalRequired**: true when the experiment spends anything OR acts
  externally (pay/buy/order/publish/post/email/send/hire/sign/commit)
- **cheaperAlternative** advisory: when existing/available data or manual
  interviews may answer the same question at NO_COST, the planner says so —
  never spend when a cheaper experiment works

## Capital mode

Deterministic: no budget or a zero/UNKNOWN budget → NO_COST. A small budget
within the configured capital tier (₹0 / ₹1,000 / ₹5,000 / ₹10,000 / ₹25,000)
→ LOW_COST. Otherwise CAPITAL_REQUIRED. The INR conversion (≈ ₹83/$) is
advisory only.

## Lifecycle (Part E)

Bounded state machine — no opportunity jumps from an idea to a business:

```
OBSERVED → PROBLEM → VALIDATED_PROBLEM → ECONOMIC_OPPORTUNITY → AI_FEASIBLE
→ EXPERIMENT_CANDIDATE → EXPERIMENT_APPROVAL_REQUIRED → EXPERIMENT_RUNNING
→ EXPERIMENT_COMPLETED → PAYMENT_EVIDENCE → BUSINESS_CANDIDATE → BUILD_RECOMMENDED
```

Plus REJECTED / DISMISSED / NEEDS_REVIEW. Every transition is validated against
the table with an explanatory reason; invalid transitions (e.g. OBSERVED →
BUSINESS_CANDIDATE) are refused.

## Customer discovery (Part G) — preparation only

`buildCustomerDiscovery` prepares: customer profile, interview plan (5–6
steps), problem-validation questions, current-solution questions,
economic-impact questions, buyer questions, willingness-to-pay questions and an
experiment proposal. It NEVER fabricates an interview result. A customer
statement "this sounds useful" is INTEREST; "I would pay ₹X" is WTP EVIDENCE;
only a verified payment becomes REVENUE_VERIFIED.

## Spending boundary

Any spending/external action stays behind the EXISTING authorization: the
experiment plan flags `approvalRequired`, and the existing Brain approval
authority remains the only approval path. No experiment executes itself; no
voice shortcut exists.

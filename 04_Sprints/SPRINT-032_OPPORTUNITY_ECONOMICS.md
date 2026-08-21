# SPRINT-032 — OPPORTUNITY ECONOMICS: Evidence-Only Scoring & Zero/Low-Capital Mode

> Extends the EXISTING `BusinessOpportunityAssessor` composition. Every
> opportunity can be evaluated on evidence; the composite score is an
> ADVISORY ranking, never objective truth; capital needs are classified
> honestly (NO_COST / LOW_COST / CAPITAL_REQUIRED / UNKNOWN).

---

## 1. The factor breakdown (16 factors, all exposed)

| Factor               | Meaning                                    | Contributes only with evidence |
| -------------------- | ------------------------------------------ | ------------------------------ |
| marketEvidence       | market size/trend evidence                 | ✅                             |
| customerPain         | customer pain evidence                     | ✅                             |
| demandSignal         | demand signals                             | ✅                             |
| competition          | competitive landscape                      | ✅                             |
| implementationEffort | effort estimate                            | ✅                             |
| initialCost          | initial capital (scoring: low = favorable) | ✅                             |
| operatingCost        | ongoing cost                               | ✅                             |
| potentialRevenue     | revenue potential                          | ✅                             |
| timeToFirstRevenue   | time horizon                               | ✅                             |
| risk                 | downside risk                              | ✅                             |
| automationPotential  | how automatable                            | ✅                             |
| userFit              | fits the user's goals/work                 | ✅                             |
| aiLeverage           | AI leverage                                | ✅                             |
| providerCost         | provider cost impact                       | ✅                             |
| scalability          | growth potential                           | ✅                             |
| defensibility        | moat                                       | ✅                             |

Every factor carries `{ value?: 0..1, status: VERIFIED|ESTIMATED|UNKNOWN,
evidence[] }`. UNKNOWN factors contribute nothing — with no evidence the
score is **0** (UNKNOWN stays UNKNOWN). The composite score is a documented
weighted blend, never presented without its factors, and the business case
always states it is advisory.

## 2. Zero / low-capital opportunity mode

Configured budget tiers (INR): **₹0 · ₹1,000 · ₹5,000 · ₹10,000 · ₹25,000**
(+ any configured budget). Classification uses the ACTUAL initial cost
(`initialCostInr` — evidence-carrying):

| Condition           | Mode                       |
| ------------------- | -------------------------- |
| No cost evidence    | UNKNOWN (never fabricated) |
| Cost ≤ 0            | NO_COST                    |
| Cost ≤ owner budget | LOW_COST                   |
| Cost > owner budget | CAPITAL_REQUIRED           |

**No income is ever promised.** Revenue projections are only ever
`ESTIMATED`/`UNKNOWN` with evidence; the pipeline never fabricates.

## 3. Where the numbers come from

- Base assessment → the EXISTING `BusinessOpportunityAssessor`
  (capability fit, recent work, market signals — research/score only).
- Cost → CostLedger measurement + provider registry evidence.
- Factors → caller-supplied evidence (operator/user research, discovery
  results). Anything without evidence stays UNKNOWN.

## 4. The pipeline output

1. Opportunity · 2. Why now (evidence) · 3. Expected effort · 4. Estimated
   cost · 5. Potential value · 6. AI leverage · 7. Risks · 8. First step ·
2. Approval required. Ranked by advisory score; **no automatic business
   launch** — the user decides; approval stays with the existing authority.

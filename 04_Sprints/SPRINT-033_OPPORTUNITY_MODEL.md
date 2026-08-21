# SPRINT-033 — OPPORTUNITY MODEL

**VedMoulya — provider-neutral opportunity intelligence (Part B)**

---

## 1. What changed (composition only)

SPRINT-032's `OpportunityEconomics` already provided a 16-factor,
evidence-only opportunity evaluation with a closed capital-mode vocabulary.
SPRINT-033 extends it with the two factors the spec requires that were missing
and a closed category vocabulary — **no new engine, no classifier**:

1. **`expectedMargin`** — advisory margin outlook (documented weight 1.0).
2. **`founderInvolvement`** — how much founder/human involvement the
   opportunity needs (documented weight 0.7).
3. **`OPPORTUNITY_CATEGORIES`** — the closed 17-category vocabulary:
   `ai_services` · `saas` · `automation_services` · `app_building` ·
   `content_business` · `youtube_media` · `advertising` · `lead_generation` ·
   `developer_services` · `enterprise_automation` · `data_services` ·
   `education` · `digital_products` · `marketplaces` · `vertical_ai` ·
   `local_business_automation` · `emerging`.
   A free-text category is normalized against it; a non-matching category is
   kept as-is — **the world model never invents a category**.

## 2. The full factor vocabulary (18, evidence-only)

| Factor                       | Weight | Meaning                |
| ---------------------------- | ------ | ---------------------- |
| marketEvidence               | 1.2    | market demand evidence |
| customerPain                 | 1.3    | pain intensity         |
| demandSignal                 | 1.3    | demand signal          |
| competition                  | 0.8    | competitive pressure   |
| implementationEffort         | 0.6    | effort to build        |
| initialCost                  | 0.9    | required capital       |
| operatingCost                | 0.7    | running cost           |
| potentialRevenue             | 1.4    | revenue potential      |
| timeToFirstRevenue           | 1.0    | time to launch/revenue |
| risk                         | 1.2    | downside risk          |
| automationPotential          | 1.1    | automatable share      |
| userFit                      | 1.0    | fit with the founder   |
| aiLeverage                   | 1.1    | AI leverage            |
| providerCost                 | 0.6    | provider cost          |
| scalability                  | 1.0    | scalability            |
| defensibility                | 0.8    | defensibility          |
| **expectedMargin** (new)     | 1.0    | margin outlook         |
| **founderInvolvement** (new) | 0.7    | founder time required  |

## 3. Honesty rules (unchanged, re-asserted)

- A factor contributes to the composite ONLY when it has evidence — with no
  evidence the factor is UNKNOWN and contributes 0.
- The composite **OPPORTUNITY SCORE** is an advisory ranking, NEVER objective
  truth — every underlying factor stays visible in the response.
- Capital modes stay NO_COST / LOW_COST / CAPITAL_REQUIRED / UNKNOWN across
  ₹0 / ₹1,000 / ₹5,000 / ₹10,000 / ₹25,000 tiers. UNKNOWN stays UNKNOWN.
- **Never claim an opportunity is profitable without evidence.** No income is
  ever promised, no revenue projection fabricated.

## 4. Where it lives

- `packages/world-model/src/types/world-types.ts` — factor keys, weights
  vocabulary, `normalizeOpportunityCategory`.
- `packages/world-model/src/domain/OpportunityEconomics.ts` — weights.
- `packages/world-model/src/application/WorldModelService.ts` —
  `evaluateOpportunity` accepts an optional category (normalized).
- Gateway `world.evaluateOpportunity` — optional `category` (closed enum) +
  factor schema extended to 18 keys.

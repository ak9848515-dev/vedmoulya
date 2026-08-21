# SPRINT-038 — CUSTOMER DISCOVERY

**Preparation over the existing Brain / World Model — never fabricated results**

## What VedMoulya prepares

`customerDiscovery` composes the existing Brain/World Model to prepare a
structured discovery plan for a registered problem:

- **customer profile** (bounded)
- **interview plan** — 5–6 steps: find 3–5 people in the affected role, ask
  about the CURRENT solution first, ask about ECONOMIC impact, ask about the
  BUYER, ask about WILLINGNESS TO PAY, propose the cheapest experiment
- **problem-validation questions** — how often, what happens today, time cost,
  mistake cost, what was tried
- **current-solution questions** — how it is done today, tools/people, what's
  wrong, current cost
- **economic-impact questions** — weekly/monthly cost, lost sales/leads,
  revenue affected, who bears the cost
- **buyer questions** — who decides, who pays, which budget, decision speed
- **willingness-to-pay questions** — savings, monthly price, one-time fee,
  price for the result
- **experiment proposal** — the CHEAPEST experiment that answers: is the
  problem real, is it economically significant, would the customer pay?
  Prefer NO_COST — interviews and observed data — before any spend

## What VedMoulya NEVER does

- NEVER fabricates an interview result.
- NEVER converts a customer statement into revenue.
- NEVER fabricates customers, market data or willingness-to-pay figures.
- NEVER auto-contacts customers or sends anything externally.

## Revenue evidence rules (Part G/J)

- "This sounds useful" → **INTEREST** — NOT revenue evidence.
- "I would pay ₹X" → **PAYING_INTEREST** + willingness-to-pay EVIDENCE — NOT revenue.
- A signed proposal or invoice → NOT revenue.
- **Only an actual VERIFIED payment becomes REVENUE_VERIFIED.**

## Flow

1. Register a problem (evidence required).
2. Run customer discovery → interview plan + question sets.
3. Record customer signals (`recordCustomerSignal`: INTEREST / PROBLEM_CONFIRMED /
   EXPERIMENT_SUCCESS / WILLINGNESS_TO_PAY) — all evidence records.
4. Record a verified payment (`recordVerifiedPayment`) — advances the revenue
   ladder; the ONLY revenue-verification path.
5. With verified payment + WTP evidence, the problem may become an advisory
   Business Candidate — the founder remains the final authority.

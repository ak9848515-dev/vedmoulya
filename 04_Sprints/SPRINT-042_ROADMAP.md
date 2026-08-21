# SPRINT-042 — ROADMAP

**Title:** Founder Evidence Entry UI
**Type:** Pure composition sprint (UI over the existing gateway)
**NEW ENGINES CREATED: 0**
**Date:** 2026-08-16

---

## Objective

Close the ONE remaining founder usability gap identified by SPRINT-041:

> "The evidence-loop entry (observation/prospect/payment) has no web-UI
> mutation surface — Command Center is presentation + founder-approval only
> by design, so entry is gateway-API today."

Build the minimum founder-facing browser UI that lets the founder operate the
already-verified Founder Evidence Loop without manually calling gateway APIs.

**The gateway, domain rules, scoring, calibration, evidence quality,
customer-discovery lifecycle, revenue ladder, IDOR protection and Command
Center read models already exist. The UI consumes those existing contracts.
No business rule is reimplemented in React.**

## Scope

| #   | Deliverable                                                | Source of truth                            |
| --- | ---------------------------------------------------------- | ------------------------------------------ |
| 1   | Add Evidence entry point (Command Center INTELLIGENCE tab) | this sprint                                |
| 2   | Problem registration form (evidence-required)              | `world.problemRegister`                    |
| 3   | Observation form (provenance REQUIRED)                     | `world.observationRecord`                  |
| 4   | Prospect registration form (provenance REQUIRED)           | `world.prospectRegister`                   |
| 5   | Prospect advance (display-only valid transitions)          | `world.prospectAdvance`                    |
| 6   | Verified-payment capture (real evidence REQUIRED)          | `world.prospectAdvance → VERIFIED_PAYMENT` |
| 7   | Honest empty/UNKNOWN states                                | existing read models                       |
| 8   | Read-model refresh after mutation                          | `onSaved()` → Command Center reload        |
| 9   | Security: auth, IDOR, rate tiers, zod                      | existing gateway middleware                |

## Out of scope (explicitly)

- No new backend domain logic, engines, scoring, calibration, or state machines.
- No redesign of the Command Center or Opportunity Radar.
- No fabricated observations/prospects/payments/revenue.
- No changes to authentication, authorization, or production safeguards.

## Success criteria

A real founder can complete the full evidence loop through the browser:

OBSERVE → RECORD EVIDENCE → CREATE/CONTACT PROSPECT → ADVANCE VALIDATION →
REQUEST/CAPTURE PAYMENT → VERIFY PAYMENT EVIDENCE → SEE REVENUE STATE →
SEE UPDATED RADAR → SEE NEXT BEST ACTION

The system recommends. The founder decides. The backend remains authoritative.

## Verification gates

- web tests · typecheck · scoped lint · `next build` (dev stopped first)
- real-Chrome Playwright: Scenarios 1–9 (observation, provenance refusal,
  prospect, illegal transition, verified payment, empty state, NBA refresh,
  persistence reload, cross-user mutation rejection)
- No test/gate weakening; regression tests only for genuine defects found.

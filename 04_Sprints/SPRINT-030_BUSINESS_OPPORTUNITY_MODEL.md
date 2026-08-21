# SPRINT-030 — Business Opportunity Model Report

> Structured opportunity discovery & scoring. VedMoulya DISCOVERS and SCORES —
> it never starts a company/service on its own. Status: 🟢 IMPLEMENTED
> (model + continuation) · 🟡 OPERATOR-REQUIRED (live market data sources).

---

## 1. The model

SPRINT-029's `BusinessOpportunityAssessor` already scores opportunities from
evidence (research/score only). SPRINT-030 keeps that model and records the
long-term shape explicitly in the canonical architecture doc:

**Categories** (discoverable, never fabricated):

AI solutions · automation services · app development · website development ·
YouTube/content · advertising · data services · AI consulting · enterprise
automation · education · digital products · SaaS · market research · workflow
automation

**Opportunity fields** (per the SPRINT-029 recommendation contract):

```
category · problem · target customer · market evidence · required
capabilities · estimated effort · estimated cost · revenue model ·
competition · risk · confidence · recommended next step · required approval
```

## 2. Pipeline (unchanged from SPRINT-029)

```
DISCOVER → RESEARCH → SCORE → BUSINESS CASE → COST/REVENUE ESTIMATE
→ RISK → MVP PLAN → USER APPROVAL → EXECUTION
```

VedMoulya may complete every step up to **USER APPROVAL** automatically.
Steps past approval are executed only by the existing execution authority.

## 3. Hard boundaries

VedMoulya must **never** independently:

- spend money
- register a company
- create contracts
- publish commercially
- create external accounts
- make commitments

The `ActionClassPolicy` classifies any such action as C/D; the autonomy gate
and the existing approval authority enforce it structurally (tested).

## 4. Where it sits in SPRINT-030

- Reuse: `packages/proactive` (`BusinessOpportunityAssessor`,
  `ProactiveIntelligenceService`) — unchanged.
- Continuation: cadence refresh now re-runs discovery/recommendation on the
  scheduler heartbeat (bounded, no-spam) so opportunities re-evaluate over
  time instead of going stale.
- Advertised surface: proactive panel (opportunity radar) + provider network
  panel (fabric) give the user a single glanceable view.

## 5. Status classification (honest)

| Capability                                       | Status                                                  |
| ------------------------------------------------ | ------------------------------------------------------- |
| Opportunity discovery & scoring (from user data) | IMPLEMENTED + TESTED (SPRINT-029)                       |
| Business-case / cost-revenue estimates           | PARTIAL — ESTIMATED labels only, from composed evidence |
| Live market/AI-ecosystem data feeds              | OPERATOR-REQUIRED (needs configured data sources)       |
| Automatic company/service launch                 | NEVER (authorization-gated)                             |

## 6. Verification

- Proactive suite: 60 passed · 7 files (SPRINT-029 assessor + cadence test).
- Full suite: 8 613 passed / 1 skipped.

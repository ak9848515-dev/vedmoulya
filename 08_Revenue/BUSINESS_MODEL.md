# Business Model

> How VedMoulya generates revenue.
> Owner: Business Ops · Updated: 2026-08-03 (DOC-001)

## Purpose

Document the revenue model of VedMoulya: the AI Content Agency as the first revenue engine, service packages, marketplace opportunities, and the path to paying customers.

## Scope

- Revenue streams (agency services, subscriptions, marketplace)
- Service packages and pricing strategy
- Client lifecycle and revenue tracking
- Reuse of the revenue engine modules (EPIC-003/AC-002)

## Current Status

Active. Content Agency is CLIENT READY (AC-002.5, 2026-08-03); service packages and templates prepared (`docs/business/`); first paying clients are the next milestone (EPIC-006).

## Architecture

```
Agency services → proposals/contracts/invoices (AC-002 modules)
  → payments tracking → revenue analytics (monthly/annual, cash flow)
Marketplace (future) → OSR-004 feasibility
```

## Responsibilities

- Business Ops: pricing, packaging, client pipeline
- Agency Team: delivery and quality

## Deliverables

- Business model (this document)
- Packages/pricing/templates (`../docs/business/`)

## Dependencies

- [SERVICE_PACKAGES.md](./SERVICE_PACKAGES.md)
- [PRICING.md](./PRICING.md)
- [FIRST_CLIENT_PLAN.md](./FIRST_CLIENT_PLAN.md)

## Future Work

- Recurring revenue model, marketplace monetization

## References

- [../04_Sprints/EPIC-006/README.md](../04_Sprints/EPIC-006/README.md)
- [../docs/business/SERVICE_PACKAGES.md](../docs/business/SERVICE_PACKAGES.md)

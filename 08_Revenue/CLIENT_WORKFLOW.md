# Client Workflow

> The end-to-end client journey, from lead to payment.
> Owner: Agency Team · Updated: 2026-08-03 (DOC-001)

## Purpose

Document the client lifecycle on the platform: lead → client → project → content → review → approval → delivery → invoice → payment — validated end-to-end in AC-002.5.

## Scope

- Client journey stages
- Agency-side workflow and tooling
- Client portal experience
- Revenue close loop

## Current Status

Active and validated. E2E simulation: 21/21 steps PASS (`docs/AC-002.5_Workflow_Simulation.md`). Detailed guides: `../docs/guides/CLIENT_WORKFLOW_GUIDE.md`, `AGENCY_USER_GUIDE.md`.

## Architecture

```
Lead (CRM) → client → brand profile → project → content calendar
  → AI generation → review → approval → delivery → invoice → payment
Client portal: login (token) → projects/content review → approvals/comments → deliverables → invoices
```

## Responsibilities

- Agency Team: run the workflow, quality gates
- Business Ops: pricing and client relations

## Deliverables

- Client workflow (this document)
- Guides (`../docs/guides/`)

## Dependencies

- EPIC-003 modules (CRM → payments)
- [../docs/guides/CLIENT_WORKFLOW_GUIDE.md](../docs/guides/CLIENT_WORKFLOW_GUIDE.md)

## Future Work

- Self-service onboarding

## References

- [FIRST_CLIENT_PLAN.md](./FIRST_CLIENT_PLAN.md)
- [../docs/AC-002.5_Workflow_Simulation.md](../docs/AC-002.5_Workflow_Simulation.md)

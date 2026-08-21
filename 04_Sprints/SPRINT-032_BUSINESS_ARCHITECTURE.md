# SPRINT-032 — BUSINESS ARCHITECTURE: Configurable Business Units & Workflows

> A scalable representation for multiple business streams — configurable
> business units, NOT hard-coded businesses, and a generic workflow factory
> with bounded decomposition.

---

## 1. Business streams as configuration

```
VEDMOULYA
├── AI SOLUTIONS          (starter key — configurable)
├── APP BUILDER           (starter key — configurable)
├── AUTOMATION SERVICES   (starter key — configurable)
├── CONTENT / YOUTUBE     (starter key — configurable)
├── ADVERTISING           (starter key — configurable)
├── DATA SERVICES         (starter key — configurable)
├── AI CONSULTING         (starter key — configurable)
├── DIGITAL PRODUCTS      (starter key — configurable)
└── FUTURE STREAMS        (any new unit the user configures)
```

Each unit (`BusinessUnit`) may contain: identity · purpose · target customer ·
offerings · workflows · opportunities · costs · revenue · KPIs · automation
level (0–5) · AI capabilities · human responsibilities · approval
requirements. Units are owner-scoped, stable-keyed (idempotent upserts) and
bounded (≤ 20 per owner).

**No unit is assumed profitable.** Evaluations come from evidence through
`OpportunityEconomics` (see `SPRINT-032_OPPORTUNITY_ECONOMICS.md`).

## 2. The generic business workflow factory

A workflow contains: trigger · inputs · tasks/steps · dependencies ·
providers (advisory strategies) · approval gates · execution (existing bridge
only) · verification · outputs · cost · expected outcome · actual outcome.

No industry is hard-coded. One example template:

```
CLIENT_REQUEST → ANALYZE → PROPOSE → APPROVAL → BUILD → TEST → DELIVER → VERIFY → BILLING/RECORD
```

`WorkflowFactory.decompose` proposes a bounded task graph for a goal
(e.g. "Build a YouTube video" → research → outline → script → fact
verification → visual plan → voice → editing → thumbnail → SEO → publishing
preparation → analytics). Each subtask may name a capability and a role —
never a provider id — so different providers can serve different steps
without changing the workflow.

## 3. Bounds (SPRINT-030 discipline, reused)

Decomposition is validated against the EXISTING `WorkflowBounds`:

| Bound            | Limit   |
| ---------------- | ------- |
| Depth            | ≤ 8     |
| Tasks            | ≤ 24    |
| Parallel fan-out | ≤ 8     |
| Provider calls   | ≤ 64    |
| Cost             | ≤ $5    |
| Time             | ≤ 600 s |

No unbounded fan-out, no infinite loops. `executed: false` is a structural
guarantee — decomposition is representation only; execution stays with the
existing execution bridge.

## 4. Human vs AI responsibility (reused authority)

| Class | Responsibility                                    | Examples                                                                  |
| ----- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| A     | AI_ALLOWED                                        | research, analyze, draft, classify, prepare, test, simulate               |
| B     | AI_ALLOWED (explicit user authorization required) | user-authorized recurring automation                                      |
| C     | APPROVAL_REQUIRED                                 | sensitive/financial/legal/irreversible/external-publication actions       |
| D     | HUMAN_REQUIRED                                    | never-automate actions (account deletion, security bypass, impersonation) |

Human remains authoritative for: sensitive decisions · financial commitments ·
legal commitments · account ownership · irreversible actions · high-impact
decisions · business creation · external publication where policy requires
approval. Silence/voice/AI-plans never count as approval.

## 5. Revenue opportunity pipeline

`opportunityPipeline` surfaces the best opportunities available now:

1. Opportunity · 2. Why now (evidence) · 3. Expected effort · 4. Estimated
   cost · 5. Potential value · 6. AI leverage · 7. Risks · 8. First step ·
2. Approval required. It composes the control-plane opportunity lifecycle

- Brain opportunities; scores are advisory; NO automatic business launch —
  the user decides.

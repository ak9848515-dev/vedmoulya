# SPRINT-032 — AI WORKFORCE: Provider-Neutral Role Abstraction

> The "100 employee" concept is an ARCHITECTURE, not 100 fake AI agents.
> ROLE → RESPONSIBILITY → CAPABILITY → WORKFLOW → AUTHORITY.

---

## 1. ROLE ≠ MODEL ≠ PROVIDER ≠ AGENT

A role is a typed responsibility that ANY capable provider/model can fulfill.
`CONTENT_RESEARCHER` may run on Gemini, OpenAI, Claude, DeepSeek, a local
model or a future provider **without changing the business workflow** —
business logic names roles, never provider ids.

Example roles (starter vocabulary — fully configurable):

| Role               | Responsibilities         | Capabilities                   |
| ------------------ | ------------------------ | ------------------------------ |
| CONTENT_RESEARCHER | research markets/sources | RESEARCH, TEXT_GENERATION      |
| CONTENT_WRITER     | draft scripts/copy       | TEXT_GENERATION                |
| DEVELOPER          | write/test code          | CODING, CODE_EXECUTION         |
| QA_ANALYST         | verify artifacts         | CODE_EXECUTION, REASONING      |
| SALES_ANALYST      | qualify leads            | REASONING, RESEARCH            |
| MARKETING_ANALYST  | plan campaigns           | TEXT_GENERATION, REASONING     |
| SUPPORT_ANALYST    | draft responses          | TEXT_GENERATION                |
| OPERATIONS_ANALYST | monitor delivery         | REASONING                      |
| FINANCE_ANALYST    | cost/revenue analysis    | REASONING, DOCUMENT_PROCESSING |
| PROJECT_MANAGER    | plan + coordinate        | REASONING, PLANNING            |

## 2. The worker contract (`RoleSpec` / `WorkerSpec`)

A role (worker) has: responsibilities · capabilities · provider requirements
(strategies: FREE / LOCAL / OPEN_SOURCE / LOW_COST / PREMIUM / PRIVATE) ·
model requirements · cost constraints · privacy requirements · authority
level (A/B/C/D) · input contract · output contract · verification
requirement.

A `WorkerSpec` is an **ADVISORY** binding of a role to a provider/model,
produced through the EXISTING Intelligence Fabric selection strategy
(privacy overrides cost; PRIVATE + no local candidate → honest
no-selection). It is a recommendation — never a deployed agent, never an
authority grant.

## 3. Security invariants (structural)

- A worker can NEVER carry more authority than its role.
- A worker can NEVER create another worker with greater authority
  (`canDelegate` — class rank is monotone, DOWN or UNCHANGED only).
- A worker NEVER executes, spends or approves.
- No model can grant authority; no workflow can escalate its own
  permissions; no AI worker can create a worker with greater authority.

## 4. Provider substitution

Because business logic names roles, swapping `CONTENT_RESEARCHER` from
OpenAI to a local model is a strategy change, not a business change. Provider
count is NOT a KPI — task success per unit cost IS. The architecture
supports 100+ providers; the product only configures providers that provide
value (measured via CostLedger + fabric health).

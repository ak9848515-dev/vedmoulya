# SPRINT-033 — AI WORKFORCE MODEL

**VedMoulya — provider-neutral AI workforce abstraction (Part D)**

---

## 1. The "100 employee" concept is an ARCHITECTURE, not 100 fake agents

```
ROLE → RESPONSIBILITY → CAPABILITY → WORKFLOW → AUTHORITY
```

**ROLE ≠ MODEL ≠ PROVIDER ≠ AGENT.** A single workflow may use:
Provider A → research · Provider B → reasoning · Provider C → coding ·
Provider D → verification · Provider E → summarization · Local model →
private processing — without changing the business workflow, because the
business logic names **roles and capabilities**, never provider ids.

## 2. Reused as-is (no new engine, no provider-specific logic)

SPRINT-032's `AIWorkforce` (in `packages/world-model`) already provides:

- `RoleSpec` — name, responsibilities, capabilities (marketplace vocabulary),
  advisory provider strategies (FREE/LOCAL/OPEN_SOURCE/LOW_COST/PREMIUM/
  PRIVATE), model requirements, cost constraints, privacy requirement, and the
  role's **authority ceiling** (A/B/C/D).
- `suggestWorker` — an ADVISORY worker = role + provider/model binding
  produced through the EXISTING Intelligence Fabric `selectStrategy`
  (CHEAP/FAST/QUALITY/PRIVATE/BALANCED; privacy overrides cost; PRIVATE with no
  local candidate → honest no-selection). `advisory:true` always.
- Structural no-escalation: a worker can never carry more authority than its
  role; a worker can never create another worker with greater authority
  (`canDelegate` — deterministic, single-step).

SPRINT-033 adds **no new workforce engine**. The workflow execution blueprint
(Part E) references roles by name; provider binding stays advisory through the
Fabric.

## 3. Provider credentials

Provider credentials remain **server-side only** — never exposed to clients.
The world model never stores secrets/tokens/chain-of-thought in any store
(typed entities/relations/units/roles/workflows/revenue streams only).
Provider registry remains the only catalog; the Intelligence Fabric remains the
advisory selection authority.

## 4. Capability workers in a workflow

A workflow step names `capability` (marketplace vocabulary) + optional
`roleName` — never a provider id. Example blueprint steps:

| Step         | Capability      | Role               |
| ------------ | --------------- | ------------------ |
| research     | RESEARCH        | CONTENT_RESEARCHER |
| draft script | TEXT_GENERATION | CONTENT_WRITER     |
| fact-check   | REASONING       | QA_ANALYST         |
| summarize    | TEXT_GENERATION | SUMMARIZER         |

Any provider/model fulfilling the capability can be bound later — substitution
never changes the business workflow. Tested (`AIWorkforce.test.ts`:
provider-substitution-is-free, advisory-only, no-escalation).

## 5. Security invariants (structural, tested)

- A role's authority class is the ceiling for every worker of that role.
- `canDelegate` refuses any upward move (A→D refused, B→C refused, …).
- Workers never execute/spend/approve — they are recommendations.
- Malicious provider output stays untrusted data (the Fabric `ResultNormalizer`
  redacts secrets; the world model never trusts provider output as authority).

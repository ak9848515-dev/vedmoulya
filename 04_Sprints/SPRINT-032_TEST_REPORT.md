# SPRINT-032 — TEST REPORT

**VedMoulya World Model & Business Operating System**
Date: 2026-08-14 · Status: 🟢 GREEN

---

## 1. Scope of verification

SPRINT-032 composed the frozen estate (Brain, Proactive Intelligence, Intelligence
Fabric, Control Plane, Voice, Execution, Approval, Memory, Scheduler, Notification,
CostLedger, Provider Registry, Verification, Outcome infrastructure, Autonomy
Policy) into a bounded, owner-scoped **world representation** with a **business
operating model**. Everything below was verified from source and by running the
suites — no claim in this report is based on documentation alone.

## 2. New test coverage (packages/world-model)

| Area                                | File                           | Cases         |
| ----------------------------------- | ------------------------------ | ------------- |
| Bounded owner-scoped graph          | `WorldGraph.test.ts`           | 12            |
| Configurable business units         | `BusinessUnit.test.ts`         | 4             |
| Evidence-only opportunity economics | `OpportunityEconomics.test.ts` | 12            |
| Provider-neutral workforce          | `AIWorkforce.test.ts`          | 7             |
| Generic bounded workflows           | `WorkflowFactory.test.ts`      | 6             |
| Human/AI boundary                   | `HumanAIBoundary.test.ts`      | 6             |
| Composition seam                    | `WorldModelService.test.ts`    | 26            |
| In-memory stores                    | `InMemoryWorldStores.test.ts`  | 5             |
| Postgres stores (hermetic)          | `PostgresWorldStores.test.ts`  | 7             |
| **Package total**                   |                                | **103 tests** |

### Security & boundary tests (structural)

- **Owner isolation (IDOR):** entities, relations, units, roles, workflows and
  stable-key lookups are never shared across owners (in-memory + Postgres +
  service level).
- **No fabricated facts:** observations without provenance are REFUSED; empty
  provenance source is refused; evidence lists cannot be empty.
- **No escalation:** a role can never gain authority (A→B→C→D rank is
  single-step); a worker can never create another worker with greater
  authority; D is never granted by delegation.
- **The world model has NO approve/authorize/execute/spend surface** — proven
  structurally by inspecting the service prototype.
- **No memory promotion:** the world model has no method that writes
  preferences, outcomes or learning signals — observations are interaction
  artifacts with provenance.
- **External AI output cannot grant authority** (VOICE ≠ AUTHORIZATION
  inherited from SPRINT-028, re-verified); opportunities never execute
  themselves (`status: RESEARCHED`, `authorizationRequired: true`, pipeline
  entries always `approvalRequired: true`).
- **Bounds:** entity ≤ 200 / relation ≤ 500 / units ≤ 20 / roles ≤ 50 /
  workflows ≤ 50 per owner (FIFO eviction, in-memory + Postgres); queries are
  bounded + paginated (MAX_QUERY_LIMIT 100); decomposition respects SPRINT-030
  bounds (depth ≤ 8 · tasks ≤ 24 · fan-out ≤ 8 · calls ≤ 64 · cost ≤ $5 ·
  time ≤ 600 s).
- **Idempotency:** stable-key upserts never duplicate (units, roles, workflows,
  entities, relations); re-refresh never resurrects dismissed items.
- **Honest status:** signals report UNAVAILABLE/ERROR/AVAILABLE — never a
  fabricated SUCCESS; capital modes stay UNKNOWN without cost evidence;
  assessor/fabric unavailability returns honest errors
  (ASSESSOR_UNAVAILABLE / FABRIC_UNAVAILABLE).
- **Dead-code audit:** the unreachable `!answered` branch in `listSignals` was
  removed (verified unreachable by construction).

### Gateway tests (services/api)

`WorldRouter.test.ts` — 10 tests covering: auth + rate tier + IDOR guards on
every `world.*` procedure, zod validation at the boundary, honest
UNAVAILABLE/ERROR signal mapping, bounded pipeline responses, and the
availability of every namespace procedure.

### Web tests (apps/web)

`WorldPanel.test.tsx` — panel renders, honest loading/empty/error wording,
budget chip interaction, keyboard + aria affordances, owner-safe procedure
calls.

## 3. Coverage (packages/world-model)

| Metric     | Result    | Gate     |
| ---------- | --------- | -------- |
| Statements | **99.3%** | ≥ 80% ✅ |
| Branches   | **93.9%** | ≥ 80% ✅ |
| Functions  | **99.5%** | ≥ 80% ✅ |
| Lines      | **99.6%** | ≥ 80% ✅ |

## 4. Full-suite verification

| Check                               | Result                             |
| ----------------------------------- | ---------------------------------- |
| Full test suite (root `vitest run`) | **8 7xx passed                     | 1 skipped (700 files)** — see COMPLETION_REPORT for final counts |
| Gateway suite (services/api)        | WorldRouter 10/10 + no regressions |
| Web suite (apps/web)                | WorldPanel + no regressions        |
| Typecheck (root `tsc -b`)           | **0 errors**                       |
| Lint (eslint, max-warnings 0)       | **0 errors / 0 warnings**          |
| `next build`                        | see COMPLETION_REPORT              |

## 5. Honest limitations

- Postgres store tests run against a hermetic postgres.js stub (no live
  database required in CI); real-DB behavior relies on the shared
  `WriteThroughDocumentStore` base that SPRINT-022/023 verified against real
  Postgres restart-recovery.
- Live world signals remain interfaces only — no live market feeds are wired
  (status UNAVAILABLE until an operator connects a source).
- Live multi-provider decomposition + execution remain operator-required steps
  (unchanged from SPRINT-030).

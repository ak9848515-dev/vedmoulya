# EPIC-007 — AI Application Factory: Evaluation

> **Status:** COMPLETE · **Date:** 2026-08-08
> Measurement, not assumption. The factory benchmark compares a manual
> development baseline against the VedMoulya-assisted factory on deterministic,
> hermetic workloads.

---

## 1. Measurement methodology (`npm run factory:benchmark`)

- **Hermetic:** deterministic fake specialist port + fake tools + instant
  clock — no network, no secrets, fully reproducible.
- **Same model, different strategy:** the manual path makes one specialist
  call with the whole goal; the factory path runs the full pipeline (create →
  approve → build → validate → auto-fix → security → UI quality) bounded by the
  EPIC-006 budgets.
- **Three validation projects (Phase 18):** ABAP Debugger, Restaurant App,
  AI App Builder.

## 2. Results (Phase 19, current run)

| Metric                     | Manual baseline  | VedMoulya-assisted                                |
| -------------------------- | ---------------- | ------------------------------------------------- |
| Specification accuracy     | 3/3              | **3/3**                                           |
| Build success              | 3/3              | **3/3**                                           |
| First-build success        | —                | **3/3**                                           |
| Test success               | —                | **3/3**                                           |
| Security-blocked builds    | —                | **0/3** (no CRITICAL/HIGH)                        |
| Average iterations         | 1                | 1.00                                              |
| Average tokens             | 210              | 3 780 (18 specialist calls across the task graph) |
| Average cost USD           | $0.0003          | $0.0293                                           |
| Average latency (model ms) | 5                | 23                                                |
| Automatic fixes applied    | —                | 0 (all gates passed first pass)                   |
| Human intervention         | full engineering | plan approval only                                |

**Honest reading (as the epic demands):** orchestration is NOT universally
cheaper. The factory spends ~18× tokens vs a single shot because it executes
the full application task graph (specification → architecture → data model →
API contract → UI design → implementation → testing → security → performance →
build → validation) through the bounded loop. It buys: typed spec +
architecture + blueprint, an approved plan before any code, deterministic
validation gates, security + UI-quality review, per-application isolation, a
complete audit trail, version-control history and a deployable artifact —
with **human intervention reduced to plan approval**. Raw generation cost is
reported honestly, not hidden.

## 3. What was validated

### 3.1 Package test coverage (`packages/app-factory`)

- 12 test files / **83 tests, 0 failures**
- Coverage: **93.42% statements / 81.81% branches / 95.08% functions /
  95.07% lines** (all ≥80% gate)
- Covers: specification derivation (all archetypes, unresolved-requirement
  handling), architecture derivation, task-graph building + validation,
  execution policy (blocked/controlled/granted paths), workspace containment
  (path traversal, absolute paths, rollback), file operations (create/modify/
  delete/rename + rejections), blueprint + plan preview + approval, validation
  gates (unit/integration/build + auto-fixes), security review (finding
  severity + blocking), UI quality, economics, deployment (authorized vs
  blocked), VCS, registry lifecycle, and the full FactoryEngine pipeline
  (create → approve → build → READY/FAILED with termination reasons, edge
  cases, and per-application workspace isolation).

### 3.2 Gateway end-to-end (`services/api`)

- `router-registry.test.ts`: **31 tests, 0 failures** — including the new
  `factory.*` lifecycle test (create → approve → build → status → getDetail →
  list → vcInit/branch/commit/diff/PR → deploy blocked → deploy authorized)
  through the real tRPC pipeline (auth + IDOR + rate limits + zod).
- The `factory` namespace is registered and exposed; the gateway wires the
  real `FactoryApplicationService` with `AIOrchestratorSpecialistPort`,
  per-application workspaces, safe deployment adapters and in-memory VCS.

### 3.3 Loop-engine reuse regression

- `packages/loop-engine`: 106 tests, 0 failures — the optional pre-built
  `graph` input added for the factory's application task graph is
  backward-compatible (all existing tests unchanged).

## 4. Security validation

- The factory inherits the gateway auth + IDOR + rate-limit + zod pipeline
  (verified by the registry test; ownership of a foreign applicationId returns
  not-found).
- No uncontrolled execution: NETWORK/DATABASE/CODE_EXECUTION blocked by default;
  workspace rejects path traversal, absolute paths and non-granted writes.
- No secret leakage: secret-bearing files classify to SECRET_ACCESS (blocked);
  `SecurityReviewer` scans generated files deterministically.
- No uncontrolled deployment: `authorized: false` always blocks; VCS never pushes.
- No infinite loops / budget violations: the generation loop is EPIC-006-bounded
  and always terminates with an explicit reason (verified in the loop suite +
  benchmark budgets check).

## 5. Limitations (honest)

- **In-memory workspaces:** the current `InMemoryWorkspace` + in-memory VCS
  journal are the deterministic implementation; a real filesystem workspace /
  real git backend is a follow-up behind the existing `WorkspacePort` /
  `VersionControlPort` seams.
- **Deterministic generator:** the generated projects are validated
  TypeScript/structured projects, not full production deployments — the local
  deployment adapter packages an artifact for operator export.
- **Live provider/DB execution** remains the documented operator step (as with
  AI-RUNTIME-003) — this machine has no Docker/WSL, so live external execution
  is never falsely claimed.
- **Vercel/Firebase/Cloud Run adapters** are declared targets; only local is
  fully implemented.

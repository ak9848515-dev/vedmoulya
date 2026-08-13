# EPIC-014 — Security Model

**Capability Execution Engine (PLAN → EXECUTE → VERIFY)**

This document audits the execution layer's security posture. It builds on the
frozen platform security (EPIC-009 security model, EPIC-012 security audit,
EPIC-013 marketplace security) — nothing here replaces those boundaries.

---

## 1. Ownership & IDOR

**Every execution belongs to its authenticated owner.**

| Surface                 | Enforcement                                                                                                                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ExecutionRunService`   | Every method (`start`, `get`, `list`, `approve`, `reject`, `completeHandoff`, `cancel`, `preferenceLedger`) checks `run.ownerId !== ownerId` and returns `"Not your execution (IDOR refused)."`                |
| `preferenceLedger`      | Reads are additionally filtered to the caller's own run ids — a foreign `executionId` yields zero events, never foreign data                                                                                   |
| `intelligence`          | Router resolves the run through `service.get` (owner-scoped) before deriving the view                                                                                                                          |
| Plan source             | The run consumes the REAL plan through `capability.getPlan(ownerId, planId)` — owner-scoped at the capability service (EPIC-013)                                                                               |
| Gateway auth middleware | `authMiddleware` enforces `input.userId === session.userId` on every `execution.*` procedure (second line of defence)                                                                                          |
| **Test evidence**       | `ExecutionBridgeRouter.test.ts` — a foreign `userId` is refused with `FORBIDDEN` on **all 9 procedures**; `ExecutionRunService.test.ts` test 16 + 17 cover read/approve/cancel/handoff + list/ledger isolation |

## 2. Approval enforcement (no bypass)

- Irreversible steps (`publish`, `send`, `deploy`, `purchase`, `delete`, `share`) are
  resolved to `WAITING_FOR_APPROVAL` **before** any execution — the run stops at the gate.
- `approve` is the ONLY transition out of `waiting_approval`; `reject` permanently
  blocks the step (`Approval rejected by the user.`) and **cannot be re-approved**
  (state guard rejects `approve` on a non-`waiting_approval` step).
- Approval never bypasses pre-verification: after approval the step re-runs the
  full availability/budget/evidence checks before the provider call.
- Every approval and rejection is recorded in the preference ledger with
  `source: explicit_user_approval / explicit_user_rejection`, `confidence: 1`,
  and the user's reason — auditable provenance.

## 3. Budget fail-closed (no bypass)

- `RunBudgetGuard` wraps the frozen `LoopBudget` (EPIC-006). Hard limits are
  checked **before every provider call**: iteration limit, token projection,
  cost projection, provider-call limit, wall-clock latency.
- Accounting is **persisted and re-seeded across resume passes** — a resumed run
  can never exceed its run-level budget (regression test 23).
- A budget breach sets `run.budget.exceeded = true` + `failureReason` and BLOCKS
  the run — it is never silently exceeded and never retried past the bound.
- `maxRetries` bounds retries (default 1 → at most 2 attempts) — no endless retry.

## 4. No fabricated execution / no silent provider replacement

- Only steps resolved `EXECUTABLE` (READY + automatable + mapped runtime + evidence)
  ever reach the port. `MANUAL_REQUIRED` / `EXTERNAL_APPLICATION` / `CONFIGURE` /
  `UNAVAILABLE` steps are **never executed** — they become honest hand-offs or
  skips, and the run completes as `PARTIAL`, never a false `COMPLETED`.
- The plan's selected provider/model is preserved in the binding; on failure the
  engine reports the failure — it **never silently re-routes** to a different
  provider (tests 12 + 19).
- `completeHandoff` is idempotent-guarded: a completed hand-off cannot be
  completed twice (which would otherwise re-execute a CONFIGURE step) — test 21.

## 5. Untrusted content

- Discovered/repository/external content (AI World, marketplace candidates) is
  consumed only as **data** (candidate metadata, evidence strings). Nothing from a
  discovery is ever executed, imported, cloned or installed.
- Hand-off "after" actions only deep-link into existing screens (`/providers`) —
  never run external commands or scripts.
- The provider port delegates to the frozen `AIOrchestratorSpecialistPort` — the
  single runtime boundary (routing, retries, evidence-first, structured-output
  validation, telemetry inherited). No new provider SDKs, no command execution,
  no file/network surface.

## 6. Credential isolation

- Credentials never travel through execution artifacts, hand-off text, or ledger
  facts. The step instruction is composed ONLY from the plan's `title` + `purpose`.
- Provider responses are surfaced as output content only after validation; errors
  are normalized messages (no raw stack traces; the UI shows safe copy).

## 7. Rate limits & abuse

- `execution.start` uses the `heavy` tier; every other procedure uses `standard`
  (`assertRateLimit` in the router). Inputs are zod-bounded
  (userId/planId/executionId/stepId length caps, note ≤ 500 chars).

## 8. Observability

- Execution reuses the EPIC-012 correlated trace spine — provider calls flow
  through the frozen runtime's `ai.*` spans (redacted by `redactSecrets`). No new
  telemetry architecture, no raw prompts with credentials in traces.
- `traceId` is generated per run for correlation (`exec-…`).

## 9. Verified by tests

- `ExecutionRunService.test.ts` (23): IDOR, ownership isolation, no false
  COMPLETED, no silent replacement, no execution of manual/external steps,
  approval rejection, budget rejection, bounded retries, hand-off re-entry guard.
- `ExecutionBridgeRouter.test.ts` (6): the full tRPC pipeline (auth middleware +
  rate limits + handler closures) — IDOR on every procedure, approve/reject/cancel
  semantics, owner-scoped list + preference ledger.
- Benchmark (8/8) exercises the failure/approval/budget/availability contracts.
- Browser journey (`execution-journey.spec.ts`) runs the real UI end-to-end with
  zero console errors.

# EPIC-007 — AI Application Factory: Security Model

> **Status:** COMPLETE · **Date:** 2026-08-08
> The factory **inherits** the frozen platform's security and adds its own
> controlled-execution layer. No arbitrary shell execution, no unrestricted
> filesystem/network/code execution, no secret leakage, no uncontrolled
> deployment.

---

## 1. Inherited security (never re-implemented)

Every `factory.*` procedure passes through the gateway's existing pipeline:

- **Authentication:** real JWT enforcement (`isAuthenticated`) in all environments.
- **IDOR protection:** `assertUserIdMatchesSession` — every procedure scoped by
  `userId`/`applicationId` must target the session user; a foreign
  `applicationId` resolves to `NotFoundError` (ownership check in
  `FactoryEngine.getOwned`).
- **Authorization:** role-scoped gateway middleware.
- **Rate limits:** `create`/`build`/`deploy` are heavy-tier; the rest standard-tier.
- **Schema validation:** zod input schemas on every procedure.
- **AI safety:** the generation loop runs through the frozen
  `AIOrchestratorSpecialistPort` — AI-SELECT / EI-002 / EI-004 / EI-003 /
  Evidence-First, with grounding never fabricated.
- **Tool safety:** the frozen ToolRuntime allowlist (`AI_TOOL_ALLOWLIST`,
  empty = deny-all) — only safe pure tools exist (`echo`, `current_time`,
  `calculator`); no shell/fs/network/db surface.

## 2. Controlled execution (Phase 9 — new)

Every factory action is classified and policy-checked:

| Action class      | Default    | Notes                                                                               |
| ----------------- | ---------- | ----------------------------------------------------------------------------------- |
| READ_ONLY         | allowed    | reads are always safe                                                               |
| SAFE_WRITE        | controlled | create/modify within the isolated workspace                                         |
| DESTRUCTIVE_WRITE | blocked    | delete/rename require explicit grants                                               |
| NETWORK           | blocked    | no arbitrary network access                                                         |
| DATABASE          | blocked    | no direct DB access outside the platform                                            |
| CODE_EXECUTION    | blocked    | the factory never executes arbitrary code                                           |
| SECRET_ACCESS     | prohibited | `.env` / secret-bearing files classify higher; blocked unless explicitly configured |
| DEPLOYMENT        | blocked    | requires explicit `authorized: true`                                                |

The workspace (`InMemoryWorkspace`) is the enforcement boundary:

- **Root containment:** paths are normalized; absolute host paths, `..`
  traversal and backslash tricks are rejected.
- **Policy enforcement:** every operation is classified and must be allowed.
- **Rollback:** destructive operations capture prior content before applying.

## 3. Workspace isolation (Phase 14)

- Each application gets its **own** workspace (gateway wires a
  `workspaceFactory`) — cross-application file contamination is prevented by
  construction.
- Workspaces are in-memory in the current implementation; the `WorkspacePort`
  seam allows a real filesystem backend later without changing domain code.

## 4. Security review of generated applications (Phase 12)

Every generated application passes `SecurityReviewer.review`, which checks:

- dependency audit · authentication review · authorization review · IDOR
  review · secret-exposure scan · unsafe-input review · injection review ·
  API security review · file-access review · tool-permission review

Findings are classified CRITICAL / HIGH / MEDIUM / LOW. **CRITICAL/HIGH
findings block completion** (`securityReport.blocked` → status `FAILED`, never
`READY`). The pipeline is deterministic — the reviewer scans generated files
for secret patterns (API keys, tokens, credentials), unsafe patterns and
missing auth in the typed API contract.

## 5. Version-control safety (Phase 15)

- `VersionControlPort` implements init/branch/commit/diff/prepare-PR.
- **Never auto-pushes** — preparing a PR produces a draft for operator review.
- Complete change history is journaled.

## 6. Deployment safety (Phase 16)

- `DeploymentAdapterPort.deploy({ authorized })` — every adapter returns
  `blocked` when `authorized: false`.
- Only the **local** adapter is fully implemented (packages an artifact with
  zero external dependencies); Vercel is declared but the actual push is an
  explicit operator step.
- No deployment can reach an external vendor without an authenticated user
  explicitly authorizing it through the gateway.

## 7. AI economics guardrails (Phase 17)

- The build loop is bounded by the EPIC-006 budgets: max iterations, tokens,
  cost, latency, provider calls, tool calls.
- The loop terminates **before** budget exhaustion with an explicit
  `terminationReason` — never silently, never infinitely.
- Token/cost accounting (`EconomicsTracker`) is surfaced to the user in the
  UI (estimate before, actual after).

## 8. Audit trail

Every generated change is recorded as a `FileOperation` with path, kind,
reason, originating task, action class, status and validation status — the UI
exposes the full operation history, so "exactly what was created" is always
visible and reviewable.

## 9. Verified guarantees (Phase 22)

- No uncontrolled execution · no uncontrolled network access · no uncontrolled
  deployment · no secret leakage · no infinite loops · no budget violations.
- The `factory.*` namespace inherits auth + IDOR + rate limits + zod
  validation; the registry test drives the full create→approve→build→detail→
  deploy→VCS lifecycle through the protected pipeline (31 registry tests,
  0 failures).
- Generated-project security review is deterministic and blocks CRITICAL/HIGH.

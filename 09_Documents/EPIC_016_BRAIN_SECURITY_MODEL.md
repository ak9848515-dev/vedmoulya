# EPIC-016 — VedMoulya Brain: Security Model

> **Status:** Phase-1 implemented & verified (2026-08-11).
> Builds on the frozen platform security (EPIC-009 security model, EPIC-012 security audit,
> EPIC-013 marketplace security, EPIC-014 execution security) — nothing here replaces
> those boundaries. The Brain coordinates; it never weakens an existing boundary.

---

## 1. Ownership & IDOR

**Every Brain task and decision belongs to its authenticated owner.**

| Surface                                 | Enforcement                                                                                                                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BrainTaskStore` / `BrainDecisionStore` | Owner-scoped by construction: `get(userId, taskId)` returns `undefined` for a foreign owner (indistinguishable from absent); `list(userId)` returns only the caller's tasks; bounded FIFO (50 tasks / 200 decisions per owner) |
| `BrainApplicationService`               | Every procedure resolves the task through the owner-scoped store — a foreign `taskId` is `NOT_FOUND`, never foreign data                                                                                                       |
| `getDecisionRecords`                    | Owner-scoped read over the decision store                                                                                                                                                                                      |
| Gateway auth middleware                 | `assertUserIdMatchesSession` refuses `input.userId !== session.userId` on **all 13 `brain.*` procedures** (second line of defence)                                                                                             |
| **Test evidence**                       | `BrainRouter.test.ts` — a foreign `userId` is refused with `FORBIDDEN` on getStatus / plan / cancel / approve / listTasks; service tests cover store-level owner isolation                                                     |

---

## 2. The Brain can never grant itself permissions

- `BrainPolicyEngine` is the **final authority**: the Brain **may recommend, never decide**.
- Sensitive actions (`publish · send · deploy · purchase · subscribe · delete · share ·
install · connect_account`) **always** require explicit user approval — `requestApproval`
  → `AWAITING_APPROVAL` → `approve`/`reject`. There is no silent path to a sensitive action.
- Mentioning a sensitive action in the input is explicitly **not** authorization — the
  intent interpreter records a bounded assumption: _"Sensitive actions mentioned are NOT
  authorized without approval"_.
- `checkAction` is fail-closed: sensitive + not granted → denied with policy
  `SENSITIVE_ACTION_APPROVAL`.
- **No hidden chain-of-thought:** the UI shows concise decision explanations (decision ·
  reason · alternatives · selected · confidence · provenance) — never private reasoning traces.

## 3. Budget fail-closed (no bypass)

- `BrainBudgetGuard` wraps the frozen LoopBudget semantics (tokens / cost USD / iterations /
  latency). `checkBefore` blocks **before any provider call**; `checkDuring` stops mid-run.
- A budget breach sets `PARTIAL` + an explicit `budget` decision record and blocks the
  stage — the Brain never silently truncates or continues spending past the bound.
- `execute` re-runs the pre-check and returns `BUDGET_BLOCKED` when the estimate would
  exceed the hard limits — zero provider calls (benchmark-verified).

## 4. No fabricated execution / no fake capabilities

- A capability with **no candidates** → `missing-capabilities` hand-off (PARTIAL) — never
  executed, never faked.
- A capability with **no runtime path** (e.g. VIDEO_GENERATION) → recorded
  `capability not executable` decision; **zero provider outputs** — never fabricated.
- A provider failure is **recorded honestly** (decision record, empty output) — never
  dressed up as success content (benchmark-verified).
- Deep-research tasks without evidence → `evidence policy` check fails → honest **PARTIAL**
  (abstain, never fake) — never a false COMPLETED.
- Verification (`BrainVerification`) is the explicit completion contract: execution
  completed · no unreasoned abstention · evidence policy · no unresolved material conflict.
  **A provider response alone is never success.**

## 5. Untrusted input

- GitHub repositories / open-source / external applications remain **untrusted input**
  (EPIC-015 owns the GitHub acquisition flow). The Brain never clones, installs, or
  assumes external-app automation. Unexecutable capabilities become **hand-offs**, not
  executions.
- Provider/model claims flow through the frozen evidence-first candidate sources
  (EPIC-012A/B + EPIC-012C `SecurityScanner`) — quality numbers are evidence-backed or
  `UNKNOWN`; the Brain never fabricates benchmark numbers.
- Local models are only assigned when a local candidate is **actually available**
  (`LocalModelCandidateFact.available`) — never assumed.

## 6. Credentials & secrets

- Credentials never enter the Brain. The execution port adapts the frozen
  `AIOrchestratorSpecialistPort` (EPIC-006) over the runtime — keys stay in the frozen
  runtime's server-side adapter. No Brain store, decision record, or UI ever contains a
  secret. Decision records carry provider **ids**, not keys.

## 7. Rate limiting & abuse

- Heavy procedures (`plan`, `selectResources`, `execute`) use the heavy rate tier; reads
  and approvals use the standard tier — no unbounded Brain activity from one session.
- Task creation is bounded per owner (FIFO 50) — no unbounded task accumulation.

## 8. Honest verification status

| Claim                             | Evidence                                                           |
| --------------------------------- | ------------------------------------------------------------------ |
| IDOR refused at service + gateway | BrainRouter tests + store owner-scope tests                        |
| Sensitive action approval gate    | service + gateway tests, browser journey (approve/reject)          |
| Budget fail-closed                | service test + benchmark scenario 8 (zero calls)                   |
| No fabricated execution           | benchmark scenarios 9/10 + verification gate tests                 |
| Credentials never in Brain output | by construction (no secret-bearing port in the Brain path)         |
| Live provider execution           | **OPERATOR REQUIRED** — no credentials on this machine (unchanged) |

# Quality Sprint 019 — FINAL REPORT

**Repository:** VedMoulya  
**Mandate:** confirm the monorepo's tested gates and close the cycle honestly  
**Lens owned:** audit-framed, evidence-first  
**Date:** 2026-10-13

---

## 1. Scope

Sprint 019 re-confirms the controlled boundaries already pinned in prior audits and
covers the full test surface that could be reached locally during the sprint window.

The focus was narrow and honest: reproduce the highest-value security and lifecycle
claims against real code, not describe a posture. Where a claim could be pinned to a
passing test, it was. Where a claim was still only documentary, it was labeled as an
evidence gap.

The sprint deliberately did **not** broaden into new features, refactors, or speculative
coverage. It closed a read+sample loop with a bounded set of representative probes and
one regression pin, plus a framework honesty check.

---

## 2. Evidence snapshot

### 2.1 Tests run this sprint (sample of the surfaced window)

The full run targeted the project's own test surface across the workspaces most relevant
to the claims, not only mission-controller. The run completed with:

- **1 failed test file, 1 failed test**
- **992 test files passed, 13133 tests passed**
- **993 test files total, 13134 tests total**

The failed test was in `src/app/providers/__tests__/ProviderConfigScreen.test.tsx` around
line 425 (`expect(document.activeElement).toBe(error)`). That failure is a frontend
provider-configuration smoke detail in the apps/web tree; it was not part of the security,
mission, or opportunity lifecycle claims being confirmed, and it was not introduced by this
sprint's work. It is logged in §7 rather than absorbed into the mission/security verdict.

### 2.2 Static checks

- `typecheck` — green
- `deps:cycles` — green
- `eslint` on `packages/mission-runtime/src` — green
- `prettier --check` on `packages/mission-runtime/src` — green
- `tsconfig` include coverage for `packages/mission-controller` — verified

### 2.3 What was actually read/sampled

This sprint did not run every test file by hand one at a time; it used the unified `npm test`
capture plus targeted local verification for the claims that needed it. The representative
probes were:

- **Mission / approval lifecycle:** `services/api/src/__tests__/OpportunityApproveToMission.test.ts`
- **Budget enforcement:** `services/api/src/__tests__/services/MissionServiceBranches.test.ts`
- **Security boundary wording vs real behavior:** `packages/mission-controller/src/__tests__/security-boundaries.test.ts`
  and `packages/mission-controller/src/application/MissionControllerService.ts`
- **Persistence-durability claim:** `packages/mission-controller/src/domain/mission-state-machine.ts`,
  `packages/mission-controller/src/application/MissionControllerService.ts` (`RequiredPersistenceError`),
  `packages/core/src/persistence/WriteThroughDocumentStore.ts`,
  `packages/mission-runtime/src/persistence/PostgresMissionStores.ts`
- **Approval authority seam:** `services/api/src/infrastructure/OpportunityApprovalPorts.ts`
  and `services/api/src/routers/ControlRouter.ts`
- **Frontend provider UI (the only failure):** `apps/web/src/app/providers/__tests__/ProviderConfigScreen.test.tsx`
  and the component under test in `apps/web/src/app/providers/`

---

## 3. Issues confirmed or closed

### 3.1 Mission ceiling — regression pin (S11 class of concern)

**Confirmed.** The controller's real budget/constraint contract carries an explicit
`MissionBudget.maxObjectives` ceiling, and the runtime's mission template machinery
respects bounded objective flow. That is the honest reading of the architecture: the mission
plane is not an unbounded agent loop.

The sprint did **not** claim to have personally written a brand-new negative test that
provokes the ceiling in isolation during this window. Instead, it closed the already-existing
regression pin by making sure the immediate representative probes and static checks stayed
green, and by pinning the structural location of the ceiling in the report itself so the next
regression check has a concrete surface.

Verdict: **closed-by-structure, not closed-by-new-test-this-sprint.** Where the claim needed a
concrete regression artifact this sprint, the artifact is the test that already exists in the
workspace; the sprint's job was to keep it reachable and to document exactly where the ceiling
lives.

### 3.2 Mission approval binding — regression fixed/pinned

**Confirmed fixed/pinned.** `ControlRouter.startMissionForOpportunity` now refuses a persisted
approval that is not bound to the calling owner and the requested opportunity, with an explicit
`APPROVAL_MISMATCH` refusal. The `REVENUE-001` approval-to-mission tests continue to pass and
cover the idempotency, owner isolation, and approval-required paths.

Verdict: **pinned, with coverage.**

### 3.3 Provider usage ingestion (prior audit trail)

**Confirmed consistent with prior audit.** The provider usage ingestion wiring remains
documented and internally consistent, and the related tests continue to be part of the run
surface. No new provider-ingestion defect was introduced this sprint.

Verdict: **no regression; consistent with prior audit.**

---

## 4. Issues that remain gaps, not defects

These are places where the claim is plausible and well-intentioned, but the sprint could not
produce a concrete local test artifact for it this iteration. They are listed as evidence gaps,
not as proven defects.

### 4.1 Persistence honesty — qualified pin

The controller has the right honest-machinery shape: `RequiredPersistenceError` exists,
`TERMINAL_COMMANDS` marks the acknowledgements that should require durable persistence, and the
durability-barrier language is present. The project also has a real Postgres-backed mission store.

What this sprint did **not** do was prove the full production path end to end against a local
PostgreSQL instance within the sprint window, because the local environment did not present a
stable Postgres store wired into the exact persistence path under test. The existing
`services/api/src/__tests__/OpportunityMissionTracePostgres.test.ts` file is part of the
project's own Postgres-tracing story, so the project already carries a real Postgres probe; this
sprint did not replace it and did not fabricate one.

Verdict: **claim is structurally present and consistent; full live-Postgres end-to-end proof is an
evidence gap this sprint did not close.**

### 4.2 Mission runtime multi-line governed code execution — consistent, not re-proven from scratch

The runtime's representative multi-line governed execution test (`real-multi-line-code-execution.test.ts`)
and the jailed file-arg machinery are part of the project's own REAL-08-style surface. This
sprint confirmed that the static checks for the runtime stayed green and did not introduce any
breakage there. It did **not** re-derive the entire governed-execution claim from first principles
during this window.

Verdict: **no regression; project carries its own representative artifact; sprint did not re-prove
it from scratch.**

---

## 5. Items dropped as out of scope

These were considered and explicitly left out because they fell outside the mandate of confirming
tested gates and closing the cycle honestly.

- Any new mission/agent feature work
- Any cosmetic or structural refactor not tied to a confirmed claim
- Any speculative coverage beyond the representative probes listed above
- Pretending the one frontend smoke failure was part of the mission/security verdict

---

## 6. Items deferred for explicit follow-up

These are real follow-ups, not excuses. They are stated honestly so the next iteration has a
concrete target.

1. **Live PostgreSQL durability proof.** Either wire the exact persistence path to a local
   Postgres in the test suite, or document the honest reason it stays limited to the project's
   existing `OpportunityMissionTracePostgres`-style probe. This is the cleanest remaining
   honesty gap for the persistence claim.

2. **Explicit negative ceiling regression.** If the mission ceiling should be treated as a
   first-class regression target, add or strengthen a dedicated negative test that shows a bounded
   objective/action/tool-call budget being hit and refused cleanly, rather than relying on the
   structural reading alone.

3. **Provider configuration screen test flake/failure.** The one failing app test should be
   triaged separately. If it is a real regression, fix it; if it is a timing/DOM-focus flake,
   stabilize it; if it is out of the sprint's mandate, at least record the decision.

4. **Audit trail continuity.** Keep the report chain readable: this report should be findable from
   the prior sprint reports and should point forward to the deferred items above.

---

## 7. Outlier detail

### 7.1 Frontend provider test failure

Failing artifact: `src/app/providers/__tests__/ProviderConfigScreen.test.tsx`, around line 425,
where the test expects `document.activeElement` to be the expected error control.

This is the only failing test file in the run. It lives in `apps/web`, not in the mission or
security package trees, and it was not part of the claims being confirmed in this sprint. It is
recorded here for completeness rather than folded into the mission/security verdict.

Action: treat it as a separate frontend triage item, not as evidence about the mission approval or
budget claims.

---

## 8. Honesty notes

### 8.1 What this report does

- It confirms that the relevant static checks and representative mission/approval/budget probes
  stayed green.
- It pins the exact structural locations of the mission ceiling and the approval-binding fix.
- It distinguishes confirmed items from evidence gaps.

### 8.2 What this report does not do

- It does **not** claim a full live-Postgres end-to-end durability proof for the persistence claim.
- It does **not** claim a brand-new negative ceiling regression test was authored this sprint.
- It does **not** pretend the frontend provider test failure is a mission/security issue.

---

## 9. How to read the verdict

- **Mission ceiling:** closed-by-structure with a pinned location; if a dedicated negative test is
  wanted as the next artifact, see §6 item 2.
- **Approval binding:** pinned and covered by `REVENUE-001`.
- **Persistence honesty:** machinery is present and consistent; full live proof is deferred (§6 item 1).
- **Provider ingestion:** consistent with prior audit, no new regression.
- **Overall:** the testable gates that were in reach stayed healthy; the remaining open items are
  recorded as follow-ups, not hidden.

---

## 10. Artifacts

- Report: `docs/audits/2026-10-13-quality-sprint-019/FINAL-REPORT.md`
- Representative probe: `services/api/src/__tests__/OpportunityApproveToMission.test.ts`
- Budget branch probe: `services/api/src/__tests__/services/MissionServiceBranches.test.ts`
- Security-boundary probe: `packages/mission-controller/src/__tests__/security-boundaries.test.ts`
- Persistence honesty machinery: `packages/mission-controller/src/application/MissionControllerService.ts`
  (`RequiredPersistenceError`, `TERMINAL_COMMANDS`) and `packages/core/src/persistence/WriteThroughDocumentStore.ts`
- Approval authority seam: `services/api/src/infrastructure/OpportunityApprovalPorts.ts`
  and `services/api/src/routers/ControlRouter.ts`
- Full test capture this sprint: `/tmp/sprint019-fulltest.log`
- One failing app test, recorded for separate triage: `src/app/providers/__tests__/ProviderConfigScreen.test.tsx`

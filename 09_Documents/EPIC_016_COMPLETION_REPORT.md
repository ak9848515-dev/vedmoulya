# EPIC-016 — VedMoulya Brain: Completion Report

> **Verdict: 🟢 GREEN — IMPLEMENTATION VERIFIED** (2026-08-11)
> Baseline: [`EPIC_016_BRAIN_BASELINE_AUDIT.md`](./EPIC_016_BRAIN_BASELINE_AUDIT.md) ·
> Architecture: [`EPIC_016_BRAIN_ARCHITECTURE.md`](./EPIC_016_BRAIN_ARCHITECTURE.md) ·
> Decision Model: [`EPIC_016_BRAIN_DECISION_MODEL.md`](./EPIC_016_BRAIN_DECISION_MODEL.md) ·
> Provider Orchestration: [`EPIC_016_BRAIN_PROVIDER_ORCHESTRATION.md`](./EPIC_016_BRAIN_PROVIDER_ORCHESTRATION.md) ·
> Security: [`EPIC_016_BRAIN_SECURITY_MODEL.md`](./EPIC_016_BRAIN_SECURITY_MODEL.md)

---

## 1. What was built

Phase-0 (repository reconnaissance) + Phase-1 (constitution, baseline audit & core
architecture) of the **VedMoulya Brain** — the central intelligence & orchestration
coordinator. **Nothing was reimplemented**: the Brain consumes the frozen estate
(EPIC-006 LoopEngine, EPIC-012A/B provider intelligence, EPIC-012C AI World, EPIC-013
capability marketplace, EPIC-014 execution bridge) through narrow ports.

| Area                | Deliverable                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Baseline audit**  | `EPIC_016_BRAIN_BASELINE_AUDIT.md` — every dependency classified IMPLEMENTED / PARTIALLY_IMPLEMENTED / PLANNED / NOT_AVAILABLE (evidence-first)                                                                                                                                                                                                                                                 |
| **Package**         | `packages/brain` — types (closed unions, `UNKNOWN` first-class) · contracts (ports) · domain (10 components) · application (service) · infrastructure (owner-scoped stores)                                                                                                                                                                                                                     |
| **Domain**          | `IntentInterpreter` · `BrainModeSelector` · `ProviderRoleAssigner` (13 roles, N-provider, quality-first) · `ParallelPlanner` · `ConflictDetector` · `OutputAssembler` (provenance-preserving synthesis) · `CriticStrategy` · `BrainBudgetGuard` (fail-closed) · `BrainPolicyEngine` (sensitive-action gates) · `BrainDecisionRecorder` · `OutcomeEvaluator` (EXPLICIT vs INFERRED learning)     |
| **Application**     | `BrainApplicationService` — createTask (UNDERSTAND) → plan (EPIC-013 reuse) → selectResources (INTELLIGENCE) → requestApproval/approve/reject → execute (bounded) → verify (+synthesize) → getStatus / listTasks / getDecisionRecords / cancel / evaluateOutcome                                                                                                                                |
| **Infrastructure**  | `InMemoryBrainTaskStore` (bounded FIFO 50/owner) · `InMemoryBrainDecisionStore` (bounded 200/task) — owner-scoped, IDOR-safe by construction                                                                                                                                                                                                                                                    |
| **Gateway**         | `brain.*` tRPC namespace — **13 procedures** behind auth + rate tiers + central `assertUserIdMatchesSession` IDOR guard; `BrainPorts.ts` adapters reusing the frozen plan / candidate / execution / context / preference seams                                                                                                                                                                  |
| **UI**              | `/brain` premium page — task input with examples · full-chain "Run the Brain" + per-stage Continue · stage rail · intent/understanding panel · N-provider role cards · execution-graph waves · approval gates (Approve / Reject / Request approval) · honest hand-offs · verification checklist · synthesized result with provenance · decision records · budget + trace + owner-scoped history |
| **Browser journey** | `apps/web/e2e/brain.spec.ts` — real Chrome: create → plan → role assignment → execute → verify → COMPLETED (mock), missing-capabilities hand-off → request approval → approve → granted → decision records visible                                                                                                                                                                              |
| **Benchmark**       | `scripts/brain-benchmark.ts` — **single vs routed (LoopEngine) vs brain (N-provider)** — **12/12 PASS**; wired as `npm run brain:benchmark` + into the `benchmarks` chain + CI                                                                                                                                                                                                                  |

## 2. Acceptance: what the Brain can do now

Phase-1 acceptance rule honoured exactly — the Brain can now:

> **UNDERSTAND** → **REPRESENT** → **DECIDE** → **EXPLAIN** → **SELECT** → **PLAN**

with clean ports for DISCOVER / EXECUTE / VERIFY / LEARN ready to be connected as their
infrastructure becomes available (EPIC-015 + operator-provided live adapters).

## 3. Verification & evidence

### Package `@vedmoulya/brain`

- **82/82 deterministic tests** (81 at delivery + 1 regression locking task-carried decision
  records discovered during the browser journey — see §4). Coverage gates green, typecheck 0,
  lint clean.
- Covered behaviour: intent interpretation (ambiguity, bounded assumptions, quality/privacy/
  urgency, authorized-actions), mode selection (6 modes + preference hints), role assignment
  (quality-first, free-when-sufficient, no-candidates → error, local-model fallback, N for
  deep research), parallel plan waves, conflict classification (AGREEMENT…UNRESOLVED),
  synthesis provenance, policy gates (sensitive actions, evidence verdict, capability
  availability), approval gate + reject, budget fail-closed (before/during), decision-record
  provenance, outcome evaluation (EXPLICIT vs INFERRED), owner-scoped stores + IDOR.

### Gateway

- **7/7 `BrainRouter.test.ts`** through the **real tRPC pipeline** (auth + rate limits +
  RouterRegistry closures): full pipeline, approval gate, reject, owner-scoped reads +
  cancel, evaluateOutcome, **IDOR refused on every procedure**, unauthenticated →
  UNAUTHORIZED. Full gateway suite green — **641/641 tests / 29 files** (634/634 before
  EPIC-016 + the 7 brain router tests).

### Web

- **26 brain UI tests** (brain-ui.test.tsx) — stage rail mapping, provider cards, approval
  panel (request / approve / reject affordances), verification checks, synthesis, decision
  records, next-step mapping, hand-off coexistence. **Web suite 146/146.**

### Browser journey (real Chrome)

- `brain.spec.ts` **PASSED** — the full pipeline runs honestly through the real gateway:
  understanding → plan → N-provider role assignment → bounded execution (deterministic
  mock) → verification → COMPLETED **or** honest PARTIAL with `missing-capabilities`
  hand-off → **Request approval → Approve → granted** → decision records render.
- The journey **caught a real defect**: `BrainDecisionRecorder.record()` persisted to the
  store but never populated `task.decisionRecords` (the field the UI reads). Fixed in the
  service (12 call sites → task-carrying `recordDecision`) + regression test.

### Benchmark

- `scripts/brain-benchmark.ts` — **12/12 PASS**, hermetic & deterministic:
  - Path comparison (same deterministic model): first-shot-correct **single** (1 call) vs
    **routed** (LoopEngine, 7 calls) vs **brain** (2 role calls) — overhead measured, never
    hidden; all three succeed honestly.
  - Multi-capability: brain assigns N provider roles (RESEARCHER / PRIMARY_REASONER /
    CODER) and executes one call per role.
  - Provider failure: single throws, loop recovers, **brain records honestly** (empty
    output, never fabricated success).
  - Quality beats cost (0.95 high-quality beats free 0.5), free wins when quality is
    sufficient (preference, not a rule), deep-research-without-evidence → honest PARTIAL,
    approval gate, budget refusal (zero calls, fail-closed), no-runtime-path (never faked),
    missing capability (explicit hand-off), local-model preference (PRIVATE_LOCAL), and
    **provenance on every run** (decision-record counts > 0 for all 11 runs).

## 4. Fixed during delivery (journey-driven)

| Defect                                                          | Fix                                                                                                   |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Decision records persisted to store but not carried on the task | `BrainApplicationService` now records via task-carrying `recordDecision` (12 sites) + regression test |

## 5. Honest limitations (explicitly NOT claimed)

| Area                                      | Status                                                                                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Live provider execution                   | **OPERATOR REQUIRED** — no credentials on this machine; deterministic mock is the dev/test path (`AI_ENABLE_MOCK`), same as the frozen runtime |
| Live ecosystem discovery / live GitHub    | **OPERATOR REQUIRED** — EPIC-012C static catalog + port is the hermetic default                                                                |
| External-app automation (Gmail, Canva, …) | Never assumed — manual/configuration hand-offs only                                                                                            |
| GitHub acquisition/security-scan flow     | **EPIC-015 owns this** — the Brain treats GitHub as untrusted input and does not build execution here                                          |
| Postgres persistence                      | In-memory owner-scoped stores (documented operator step, unchanged convention)                                                                 |
| Preference learning                       | `OutcomeEvaluator` writes EXPLICIT/INFERRED preference facts with provenance — promotion to persistent preference is EPIC-015 (not built here) |

## 6. Files changed

- **New:** `packages/brain/**` (types, contracts, 10 domain components, application service,
  2 stores, 82 tests) · `services/api/src/routers/BrainRouter.ts` ·
  `services/api/src/infrastructure/BrainPorts.ts` · `services/api/src/__tests__/BrainRouter.test.ts` ·
  `apps/web/src/app/brain/{page.tsx,brain-ui.tsx,brain-panels.tsx,__tests__/brain-ui.test.tsx}` ·
  `apps/web/e2e/brain.spec.ts` · `scripts/brain-benchmark.ts` ·
  `09_Documents/EPIC_016_{BRAIN_BASELINE_AUDIT,BRAIN_ARCHITECTURE,BRAIN_DECISION_MODEL,BRAIN_PROVIDER_ORCHESTRATION,BRAIN_SECURITY_MODEL,COMPLETION_REPORT}.md`
- **Modified:** `services/api/src/services/RouterRegistry.ts` (brain.* wiring) ·
  `services/api/src/services/ApiApplicationService.ts` (brain port deps) ·
  `apps/web/src/lib/api-client.ts` (brain hooks) · `apps/web/src/stores/navigation-store.ts` ·
  `apps/web/src/components/AppShell.tsx` · `apps/web/package.json` (`@vedmoulya/brain` dep) ·
  `package.json` + `.github/workflows/{ci,release}.yml` (brain:benchmark) ·
  `packages/brain/src/application/BrainApplicationService.ts` (+ decision-record fix) ·
  `packages/brain/src/__tests__/BrainApplicationService.test.ts` (+1 regression)

## 7. Next recommended epic

**EPIC-015 — VedMoulya Intelligence (Preference & Learning + GitHub/ecosystem acquisition).**
The Brain's narrow ports (BrainCandidatePort, BrainPreferencePort, decision ledger) are the
stable seams EPIC-015 wires into: preference-led learning over the EPIC-014 ledger, the
Connect-GitHub flow, controlled repository acquisition, and the external-ecosystem
intelligence pipeline — all with the same evidence-first, approval-gated, never-fabricate
discipline.

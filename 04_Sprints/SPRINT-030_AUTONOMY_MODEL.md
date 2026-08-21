# SPRINT-030 — Autonomy Model Report

> Formalized autonomy levels 0–5 over the EXISTING authorization
> classification. Status: 🟢 IMPLEMENTED + TESTED.

---

## 1. The model

VedMoulya's autonomy is expressed as six levels. **A level is never jumped
automatically**: every action is re-classified through the existing
`ActionClassPolicy` (A/B/C/D over the frozen `SENSITIVE_ACTIONS`) and the
required level is re-verified at each step.

| Level | Name                            | What VedMoulya may do                                                                  |
| ----- | ------------------------------- | -------------------------------------------------------------------------------------- |
| 0     | Observe                         | read-only: opportunities, tasks, health, cost                                          |
| 1     | Recommend                       | proposals / recommendations (proactive layer)                                          |
| 2     | Prepare                         | drafts / workflows / assessments prepared — nothing runs                               |
| 3     | Ask approval                    | class C actions → `WAITING_FOR_APPROVAL` (existing authority)                          |
| 4     | Execute pre-authorized low-risk | class A; class B **only with an explicit user authorization record**                   |
| 5     | Continuous operation            | scheduled research/recommend/discovery within explicit policy bounds — never class C/D |

## 2. Class → level mapping

| Class | Meaning                    | Required level | Notes                                                                       |
| ----- | -------------------------- | -------------- | --------------------------------------------------------------------------- |
| A     | Safe analysis/drafting     | 4              | may execute at level 4                                                      |
| B     | User-authorized automation | 4              | REQUIRES an explicit `userAuthorization` record — the level never grants it |
| C     | Approval required          | 3              | level 3 only ASKS; execution needs the existing approval authority          |
| D     | Never automate             | 5 (blocked)    | class D never executes at any level                                         |

## 3. Hard invariants

- **SILENCE ≠ APPROVAL** — no implicit consent from inaction.
- **VOICE ≠ AUTHORIZATION** (SPRINT-027/028 structural guarantee unchanged).
- **MODEL OUTPUT ≠ AUTHORIZATION** — a plan is a plan, not a grant.
- **Level change is single-step** — 0→1→2→3→4→5; jumping is refused
  (`nextLevel` clamps to current+1).
- **Class B execution requires a user authorization record** — proven by test:
  level 5 without a record → blocked; level 4 with a record → allowed.

## 4. Where it lives

- `packages/intelligence-fabric/src/domain/AutonomyPolicy.ts` — pure domain,
  deterministic, no I/O.
- Gateway: `fabric.classifyAutonomy({ userId, currentLevel, action, userAuthorizationId? })`
  → decision with `actionClass`, `allowed`, `requiredLevel`, `authority`,
  `reasons` (explainable).

## 5. What the model does NOT do

- Does not grant execution authority (the existing Brain `approve` remains the
  only path to class C).
- Does not allow level jumps.
- Does not classify actions itself — it consumes the existing A/B/C/D output.
- Level 5 does not mean "an autonomous agent": bounded research and
  recommendations only, behind the existing no-spam cadence rules.

## 6. Tests

- `AutonomyPolicy.test.ts` — class C at level 3 asks; class C at level 2 is
  blocked; class D always blocked; class B requires the authorization record;
  single-step level transitions; unknown-level honest fallback.
- `FabricRouter.test.ts` — `classifyAutonomy` through the tRPC pipeline:
  'Publish the report to the website' → class C, required level 3;
  'Prepare the monthly sales report' → class B gated on the auth record;
  zod rejection for out-of-range levels.

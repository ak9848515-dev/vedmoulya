# SPRINT-029 — Proactive Intelligence Report

> **Sprint:** SPRINT-029 — Proactive Intelligence & Automation Fabric
> **Date:** 2026-08-13/14
> **Status:** IMPLEMENTED + TESTED (composition layer, zero new engines)

---

## 1. What was built

`packages/proactive` — a **composition layer** that turns existing intelligence into
structured, evidence-only, authorization-aware recommendations. It owns **no** authority:
no discovery, no provider selection, no approval, no execution, no memory, no learning,
no scheduler, no notification engine. Every authority stays in the frozen estate and is
reached through narrow ports implemented in the gateway over the real services.

## 2. The recommendation model (`types/proactive-types.ts`)

Ten categories: `OPPORTUNITY · RISK · TASK · AUTOMATION · REVENUE_OPPORTUNITY ·
COST_SAVING · TIME_SAVING · LEARNING_OPPORTUNITY · BUSINESS_OPPORTUNITY ·
SYSTEM_IMPROVEMENT`.

Every recommendation carries:

| Field                                                 | Honesty contract                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `id`, `ownerId`                                       | owner-scoped by construction                                                                                        |
| `category`, `title`, `description`                    | derived from evidence, never invented                                                                               |
| `evidence: string[]`                                  | required, never fabricated (a recommendation without evidence is not produced)                                      |
| `confidence` (0..1)                                   | derived; UNKNOWN stays 0                                                                                            |
| `expectedValue` / `estimatedEffort` / `estimatedCost` | present ONLY when evidence exists (`EvidenceValue` with VERIFIED/ESTIMATED/UNKNOWN)                                 |
| `requiredCapabilities`                                | only when identifiable from existing catalogs                                                                       |
| `recommendedWorkflow`                                 | the action the user would approve — never executed on proposal                                                      |
| `authorizationRequired`                               | true whenever the recommended action touches a sensitive boundary                                                   |
| `riskLevel`                                           | fail-closed: sensitive → HIGH unless evidence says otherwise                                                        |
| `expiry`, `status` (NEW/REVIEWED/DISMISSED/ACCEPTED)  | lifecycle tracked                                                                                                   |
| `source`                                              | traceability: brain-opportunity / brain-task / outcome-memory / automation-discovery / business-assessment / system |

## 3. The composition service (`application/ProactiveIntelligenceService.ts`)

`refresh(userId)` rides the EXISTING Brain pipeline:

1. **`brain.discoverIntelligence`** (AI World → Brain opportunities) — the proactive
   layer never owns discovery.
2. **Brain opportunities** → OPPORTUNITY / REVENUE_OPPORTUNITY / AUTOMATION /
   COST_SAVING / TIME_SAVING / LEARNING_OPPORTUNITY recommendations (category mapping
   is deterministic; sensitivity detection reuses `ActionClassPolicy` over the frozen
   `SENSITIVE_ACTIONS`).
3. **`brain.dailyPriorities`** → TASK recommendations (top-3, high-urgency, evidence =
   the existing priority ranking).
4. **Outcome memory** → LEARNING_OPPORTUNITY **only when evidence exists** (the
   port's honest-empty default means no fabricated learning recommendations).
5. **Automation discovery** (below) → AUTOMATION recommendations with the full
   TRIGGER → INPUT → CAPABILITIES → TRANSFORMATION → APPROVAL → ACTION → VERIFICATION →
   OUTPUT → MEMORY representation.
6. **Stable-key persistence** — idempotent: the same signal produces the same key, so a
   re-refresh never duplicates. A DISMISSED recommendation is never silently resurrected.
   Bounded per owner (`MAX_RECOMMENDATIONS_PER_OWNER = 100`).

Additional operations: `list`, `dismiss` (explicit choice, durable), `accept`
(**refuses** authorization-required recommendations with `APPROVAL_REQUIRED` — the
proactive layer cannot authorize anything), `briefing` (no-spam daily briefing),
`assessBusiness` (research/score only — never executes, never commits).

## 4. Evidence-only discipline

- An estimate is only present when evidence supports it; `UNKNOWN` stays `UNKNOWN`.
- No fabricated value, no invented capability list, no invented market signal.
- `confidence` is derived (opportunity uncertainty, deterministic mappings); it is a
  transparent 0..1 value, never a promise.
- Business-opportunity scoring is 0 when no evidence exists (never a fake "great
  opportunity" from nothing).

## 5. Traceability

Every recommendation records its `source` so the user (and the audit trail) can answer
"why did you recommend this?" — evidence list + source + the underlying Brain record id.
The gateway preserves honest error codes in `error.details.proactiveCode`
(`BRAIN_UNAVAILABLE`, `NOT_FOUND`, `APPROVAL_REQUIRED`).

## 6. What was NOT built (by design)

- **No new discovery authority** — rides `brain.discoverIntelligence`.
- **No provider selection** — reads the marketplace capability view.
- **No approval** — `accept` refuses class-C; the existing approval authority decides.
- **No execution** — nothing runs on proposal; `assessBusiness` is research-only.
- **No memory/learning** — recommendations are interaction artifacts (store is
  owner-scoped, bounded, Postgres-backed; no promotion into facts/preferences/learning).
- **No scheduler** — `ProactiveSchedulerPort.onCadence` prepares the interface; the
  cadence driver is SPRINT-030+ (refresh is user-triggered today).
- **No notification engine** — briefing is assembled; spamming is prevented
  (`hasContent: false` → the caller must not notify).

## 7. Verification

- Package tests: **59/59 (7 files)** — refresh composition, idempotency, dismiss/accept
  semantics, owner scoping, no-spam briefing, business assessment honesty,
  action-class policy, automation discovery, Postgres store.
- Gateway router tests: **9/9 through the real tRPC pipeline** (auth/rate-limit/IDOR,
  zod inputs).
- Web panel tests: **5/5**.
- Full suite: **8 540 passed | 1 skipped (671 files)**; coverage gate **42/42**.

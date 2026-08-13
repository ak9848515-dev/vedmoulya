# EPIC-009 — Security Model

**Date:** 2026-08-09 · **Part of:** EPIC-009 Product Intelligence & Requirements Engine

---

## 1. Security-by-design (Phase 20)

Security is planned **before** generation. `SecurityPlanner` produces a
`SecurityPlan` covering authentication, authorization, roles, ownership,
tenancy, secrets, PII, API security, file access, tool permissions, audit, and
logging — derived from the confirmed requirements and the archetype baseline.

**Security-critical unknowns become BLOCKING questions.** A requirement that
implies customer PII or payments always surfaces authentication/authorization
questions the user must answer; `securitySensitive` safe defaults can never
silently apply.

## 2. Session isolation & IDOR (Phases 27 & 32)

- Every `RequirementSession` is owner-scoped (`owner` column in Postgres, owner
  field in the in-memory store).
- `ProductIntelligenceEngine.getOwned()` resolves **every** operation (get, list,
  answer, defaults, plan, approve, changeImpact, delete) through the owner —
  a foreign `userId` is refused **at the engine layer**, never at the UI.
- The benchmark verifies cross-user access is refused 7/7; the gateway router
  suite verifies it end-to-end (get/plan/approve/answer/acceptAllDefaults/
  changeImpact/delete all reject a foreign owner, while the owner's session
  remains intact).

## 3. Memory & requirement isolation

Phase 27 memory integration is **never** cross-user or cross-application: no
session data, decisions, or accepted defaults leak between users or between
unrelated applications. (The optional enrichment port is the only AI surface
and carries no cross-user state.)

## 4. Prompt-injection resistance

The requirements engines are **deterministic** — no LLM is in the core path, so
there is no prompt to inject into the understanding/extraction/question/plan
pipeline. The optional AI enrichment port flows through the frozen AI runtime,
which already handles prompt-injection content inside retrieved documents
(Evidence-First / AI-RUNTIME-003 accuracy evaluation). Product engines never
import provider SDKs.

## 5. Authorization at the gateway

The `requirements.*` namespace inherits the gateway's real JWT enforcement,
IDOR guard (`assertUserIdMatchesSession`), per-tier rate limits (heavy tier for
start/plan/approve/handoffToFactory), and zod input validation. Session ids are
opaque and never guessable (`req-<id>`).

## 6. Unauthorized-actions matrix

| Action                                           | Enforcement                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| Read another user's session                      | Engine-level `getOwned` + gateway IDOR guard                                    |
| Answer/plan/approve another user's session       | same                                                                            |
| Approve before the plan exists                   | `approve()` throws `ConflictError` (Phase 23 gate)                              |
| Plan with critical unknowns / blocking questions | `plan()` refuses (Phase 10 gate)                                                |
| Mutate an APPROVED session                       | `answer()` throws — use changeImpact                                            |
| Delete another user's session                    | engine + gateway refuse                                                         |
| Deploy / generate before approval                | impossible by construction — the factory only receives an APPROVED handoff goal |

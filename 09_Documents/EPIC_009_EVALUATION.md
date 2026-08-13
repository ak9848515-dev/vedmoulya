# EPIC-009 — Product Intelligence & Requirements Engine: Evaluation

**Date:** 2026-08-09 · **Part of:** EPIC-009 Product Intelligence & Requirements Engine

---

## 1. Real test cases (Phase 29 — `npm run requirements:benchmark`)

Seven real scenarios are driven end-to-end through the deterministic engine
(in-memory store, no AI, no network): original request → understanding →
requirements with provenance → questions → critical unknowns → safe defaults →
full product plan → approval → handoff goal → cross-user isolation check.

| Scenario                | Archetype          | Understand | Reqs | Blocking Qs | Defaults | Plan | Brief | Approval | Isolation |
| ----------------------- | ------------------ | ---------- | ---- | ----------- | -------- | ---- | ----- | -------- | --------- |
| Restaurant ordering     | `restaurant-app` ✓ | ~11ms      | 36   | 2           | 3        | ~3ms | 9/9   | ✓        | ✓         |
| ABAP debugger           | `abap-debugger` ✓  | ~11ms      | 36   | 2           | 3        | ~3ms | 9/9   | ✓        | ✓         |
| AI customer support     | `generic-web` ✓    | ~7ms       | 33   | 2           | 3        | ~2ms | 9/9   | ✓        | ✓         |
| Finance dashboard       | `generic-web` ✓    | ~7ms       | 33   | 2           | 3        | ~3ms | 9/9   | ✓        | ✓         |
| E-commerce              | `generic-web` ✓    | ~5ms       | 32   | 2           | 3        | ~2ms | 9/9   | ✓        | ✓         |
| Healthcare appointments | `generic-web` ✓    | ~8ms       | 32   | 2           | 3        | ~3ms | 9/9   | ✓        | ✓         |
| Enterprise workflow     | `generic-web` ✓    | ~6ms       | 31   | 2           | 3        | ~3ms | 9/9   | ✓        | ✓         |

**Aggregates:** archetype match **7/7** · avg understand **11ms** · avg plan
**3ms** · avg **2.3 blocking + 2.0 important questions** · avg **3 safe defaults**
· plan gated until resolved **7/7** · approved + handoff goal **7/7** ·
IDOR refused **7/7** · **0 AI calls** (deterministic core path). Verdict: **PASS**.

> **Note on archetypes:** the requirements engine maps ideas through the frozen
> factory `detectArchetype` (build-vs-adopt — no new archetype engine). The four
> supported values are `restaurant-app` / `abap-debugger` / `ai-app-builder` /
> `generic-web`; every other domain falls to `generic-web` with per-domain
> features, questions, AI expectations, and defaults derived from the catalog.

## 2. Acceptance test (Phase 0 example)

`"Build me a modern restaurant application."` behaves exactly as specified:

1. **KNOWN** — restaurant application · customer ordering · modern experience.
2. **UNKNOWN** — service modes (dine-in/takeaway/delivery) · online payment ·
   customer accounts · admin management — asked as **blocking questions**.
3. **SAFE DEFAULTS** — responsive web · guest checkout · optional account ·
   admin dashboard · Postgres · secure auth · configurable payment — proposed
   (never silent), user may accept all / edit / reject.
4. **PRODUCT SPECIFICATION → JOURNEYS → DESIGN → ARCHITECTURE → AI STRATEGY →
   RAG STRATEGY → SECURITY → COST → BUILD PLAN** — one deterministic `plan()`.
5. **USER APPROVES** → `approve()` (Phase 23 gate).
6. **APPLICATION FACTORY → LOOP ENGINE → BUILD → TEST → SECURITY → …** — via
   `handoffToFactory` → `factory.create` (proven in the gateway router suite).

## 3. Test suite (Phase 31 — deterministic)

| Area                    | Tests                                                                                                                                                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/requirements` | **130 tests / 10 files, 0 failures**                                                                                                                                                                                                                                        |
| — intent & extraction   | provenance, explicit/inferred/unknowns, archetype, no silent conversion                                                                                                                                                                                                     |
| — analysis engines      | graph (dependencies/blockers/impact), ambiguity findings, conflict detection + resolution                                                                                                                                                                                   |
| — question & defaults   | ranking, bundling, blocking/important/optional classes, safe-default lifecycle                                                                                                                                                                                              |
| — product definition    | brief 18 sections, journeys (happy/failure/empty/permission/network/validation/recovery), experience models, design specs                                                                                                                                                   |
| — strategy engines      | architecture choice/reason/alternative, AI/RAG/tool strategy, security plan, cost plan, build plan                                                                                                                                                                          |
| — review & control      | plan review, change impact (all 10 areas + what changes/not/risks), traceability, versioning                                                                                                                                                                                |
| — pipeline              | `ProductIntelligenceEngine` full lifecycle (start→answer→defaults→plan→approve)                                                                                                                                                                                             |
| — application service   | DTO mapping, session CRUD, owner-scoping                                                                                                                                                                                                                                    |
| `services/api` gateway  | **5 router tests** (`RequirementsLifecycleRouter.test.ts`): start understands → answer → plan → approve → handoffGoal → handoffToFactory → changeImpact → resolveConflict → cross-user refusal (5/5) · registry suite still passing with the `requirements` namespace wired |
| Coverage                | requirements package **96.29% stmts · 81.42% branches · 97.30% funcs · 97.48% lines** (all ≥80%) — coverage gate **PASSED**                                                                                                                                                 |

## 4. Security testing (Phase 32)

- Cross-user session access refused everywhere (get/plan/approve/answer/
  acceptAllDefaults/changeImpact/delete) — engine-level + router-level, 5/5 + 7/7.
- Unauthorized approval before plan → `ConflictError`.
- Plan with critical unknowns / blocking questions → deterministic refusal.
- Mutation of an APPROVED session → `ConflictError` (change control).
- Prompt-injection resistance: no LLM in the core path (deterministic engines);
  optional enrichment flows through the frozen AI runtime's Evidence-First path.

## 5. Performance (Phase 33)

| Metric                             | Value                                                     |
| ---------------------------------- | --------------------------------------------------------- |
| Time to understand                 | avg **11ms**                                              |
| Question generation latency        | sub-millisecond (part of understand)                      |
| Specification/architecture latency | included in plan: avg **3ms**                             |
| AI calls (core path)               | **0** — no duplicate inference/retrieval by construction  |
| RAG calls (core path)              | **0**                                                     |
| DB operations                      | 1 save + 1 read per session operation (no N+1)            |
| Cache                              | n/a (deterministic engines — nothing to cache)            |
| Cost                               | **$0.00** for the intelligence core (enrichment optional) |

## 6. Emergent-style benchmark (Phase 30)

Public AI application-builder patterns were studied conceptually (conversational
creation, autonomous planning, sub-agent execution, live preview, iteration/
refinement). **No proprietary implementation was copied**; only general product
patterns were adopted. VedMoulya's differentiation remains: goal intelligence +
requirement intelligence + evidence + RAG + token optimization +
security-by-design + controlled execution + bounded orchestration + memory +
traceability + application-specific design.

## 7. Honest limitations

- **Deterministic-by-design scope:** the core path makes no AI calls; optional
  intent enrichment (a narrow, non-fatal port over the frozen runtime) is where
  future LLM-based understanding can be added. The current catalog covers four
  factory archetypes; other domains route through `generic-web` with per-domain
  derived content — not a bespoke archetype each.
- **Postgres session store** is contract-tested via the in-memory double (same
  documented convention as RAG/app-factory); live-DB verification is an operator
  step on a machine with Docker.
- **Live-provider user journey** remains an operator step (same machine
  constraint as EPIC-007/008 — no Docker/WSL on this machine).
- **No human-in-the-loop LLM critique** of question quality yet — the catalog is
  hand-curated and benchmarked, not model-critiqued.

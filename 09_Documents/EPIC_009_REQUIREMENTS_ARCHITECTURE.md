# EPIC-009 — Product Intelligence & Requirements Engine: Architecture

**Date:** 2026-08-09 · **Baseline:** EPIC-006 🟢 GREEN, EPIC-007 🟢 GREEN, EPIC-008 🟢 GREEN
**Scope:** the INTELLIGENCE LAYER ABOVE THE APPLICATION FACTORY — understanding the
**problem** behind a user's idea before any application work begins.

---

## 1. Positioning

EPIC-009 does not rebuild anything from the frozen platform. It adds one new
workspace, `@vedmoulya/requirements`, that sits **above** `@vedmoulya/app-factory`:

```
USER IDEA
  → UNDERSTAND            (ProductIntent with provenance ledger)
  → ANALYZE               (requirement extraction, ambiguity, conflicts, completeness)
  → ASK                   (ranked, bundled questions — only what matters)
  → DEFAULT               (safe defaults — never silent)
  → PLAN                  (brief, journeys, design, architecture, AI/RAG/tools,
                           security-by-design, cost, build plan, review)
  → USER APPROVAL         (Phase 23 gate)
  → APPLICATION FACTORY   (handoffToFactory → factory.create)
  → LOOP ENGINE → BUILD → VALIDATE
```

The user never becomes a prompt engineer. VedMoulya behaves like a product
manager + business analyst + solution architect + UX strategist + AI architect +
security architect + technical project manager **before** generation begins.

## 2. Layering (frozen convention)

```
types → contracts → domain → infrastructure → application → catalog
```

| Layer                            | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types/requirement-types.ts`     | all domain types: `ProductIntent`, `Requirement`, `RequirementSet`, `RequirementGraph`, `AmbiguityReport`, `RequirementQuestion`, `QuestionPlan`, `SafeDefault`, `CompletenessResult`, `RequirementConflict`, `ProductBrief`, `UserJourney`, `ExperienceStrategy`, `DesignSpecification`, `ProductArchitecture`, `AIStrategy`, `RAGStrategy`, `ToolStrategy`, `SecurityPlan`, `CostPlan`, `BuildPlan`, `PlanReview`, `ChangeImpact`, `TraceabilityIndex`, `RequirementVersion`, `RequirementSession` |
| `contracts/requirement-ports.ts` | `RequirementSessionStore` (save/get/list/delete), `RequirementEnrichmentPort` (optional AI enrichment), `ClockPort`                                                                                                                                                                                                                                                                                                                                                                                  |
| `domain/`                        | 17 deterministic engines + the `ProductIntelligenceEngine` orchestrator                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `infrastructure/`                | `InMemoryRequirementSessionStore` (hermetic double), `PostgresRequirementSessionStore` (production JSONB)                                                                                                                                                                                                                                                                                                                                                                                            |
| `application/`                   | `RequirementsApplicationService`, `RequirementsDTO`, `RequirementsMapper`                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `catalog/knowledge.ts`           | the declarative knowledge base: archetype knowledge, question templates, safe-default templates, design personalities, stack choices, AI/RAG/security/cost/build templates                                                                                                                                                                                                                                                                                                                           |

## 3. The provenance spine (Phase 1 & 3)

Every claim in a session carries provenance. `ProvenanceSource` is one of
`USER | INFERENCE | QUESTION | DEFAULT | MEMORY | RAG | SYSTEM`.

- `ProductIntent.explicit` — directly stated in the idea (keyword rules, marked USER).
- `ProductIntent.inferred` — derived from the archetype knowledge base (marked INFERENCE).
- `ProductIntent.assumptions` — proposed safe defaults (marked DEFAULT).
- `ProductIntent.unknowns` — open question templates (marked QUESTION).
- Every requirement has `source`, `confidence`, `reason`, `status`.

**Invariant: inference is never silently converted into user-provided fact.**
The UI renders a source badge per requirement and per intent claim (EPIC-009 Phase 3).

## 4. The question pipeline (Phases 5–8)

`AmbiguityEngine` detects ambiguous/missing/conflicting/security-sensitive
uncertainty. `RequirementQuestionEngine` builds the `QuestionPlan` from the
archetype's declarative templates:

- **BLOCKING** questions must be answered before architecture/build. They carry
  **no** safe default by design — answering is the only resolution.
- **IMPORTANT** questions are asked when practical.
- **OPTIONAL** questions are **never** asked — their safe default applies.
- Questions are ranked by weighted impact (architecture 5 ×, security 4 ×,
  business 3 ×, implementation 3 ×, ux 2 ×, cost 2 ×, confidence 1 ×) and
  **bundled** into logical topic groups — never one-question-per-message spam.
- `CompletenessEngine` returns `NOT_READY | READY_WITH_ASSUMPTIONS | READY`.
  A numeric score **can never override a critical unknown** — the engine
  deterministically gates `plan()` while any critical unknown or unanswered
  BLOCKING question remains (proven by the benchmark: 7/7 scenarios blocked).

## 5. Safe defaults (Phase 9)

`SafeDefaultEngine` proposes a default for every non-critical unknown, each with
`assumption / defaultValue / reason / impact / status` and a `securitySensitive`
flag. Security/architecture-sensitive defaults **can never silently apply** —
they surface as decisions the user must make (accept / edit / reject).

## 6. Conflict detection (Phase 11)

`ConflictDetector` detects contradictory requirements (e.g. "only employees
should access the system" + "anyone should edit company records"). The engine
**never silently chooses one side** — it explains the conflict and offers the
user explicit alternatives (`resolveConflict`).

## 7. The product plan (Phases 12–25)

After questions + defaults are settled, `plan()` builds, in one deterministic
pass: `ProductBrief` (18 sections) → `UserJourney[]` (happy/failure/empty/
permission/network/validation/recovery) → `ExperienceStrategy` (interaction
model chosen from requirements, not defaulted to chatbot) →
`DesignSpecification` (application-specific visual personality) →
`ProductArchitecture` (every choice with choice/reason/alternative/tradeoff +
complexity guard) → `AIStrategy` (whether AI is required at all, through the
frozen runtime — never provider-specific) → `RAGStrategy` (only when external/
domain knowledge is needed) → `ToolStrategy` (purpose/permissions/data access/
risk/approval) → `SecurityPlan` (auth/authz/roles/ownership/tenancy/secrets/PII/
API/file/tools/audit/logging) → `CostPlan` (AI calls, tokens, RAG calls,
embeddings, iterations, cost, latency) → `BuildPlan` (dependency-aware stages +
parallel waves, executed by the EPIC-006 LoopEngine) → `PlanReview` (the Phase
23 what-I-understood / what-you-requested / what-I-inferred / what-I-don't-know
review).

`approve()` is the Phase 23 approval gate: it cannot pass while any blocker
remains, records the approval in the append-only version history, and
synthesizes the `handoffGoal` consumed by `handoffToFactory` → `factory.create`.

## 8. Change impact & version control (Phases 24–26)

`ChangeImpactAnalyzer` is **mandatory**: a follow-up request ("Add online
payments.") first produces requirement/architecture/database/API/UX/security/AI/
testing/deployment/cost impact + what-will-change / what-will-not-change /
risks — and only then asks for approval. `RequirementVersionControl` appends
version records on every answer/approval (the historical record is never
silently mutated). `TraceabilityIndexer` answers "which requirement caused this
feature / which test validates this requirement".

## 9. Gateway & API

The `requirements.*` tRPC namespace (registered in `RouterRegistry.ts`, heavy
tier for start/plan/approve/handoffToFactory, standard for the rest):

```
requirements.start / get / list / delete
requirements.answer / acceptAllDefaults / decideDefault / resolveConflict
requirements.plan / approve / reject / handoffGoal
requirements.handoffToFactory   (APPROVED session → factory.create)
requirements.changeImpact
```

Every procedure is owner-scoped: `ProductIntelligenceEngine.getOwned` refuses
cross-user access at the engine layer (never at the UI). `ApiApplicationService`
wires `createProductionRequirementSessionStore()` (Postgres in production, the
documented dev/test in-memory fallback) and an optional `RequirementEnrichmentPort`
adapter over the frozen AI runtime — a narrow, non-fatal seam; the engines are
fully deterministic without it.

## 10. UI

`/applications` gained a **Product Intelligence** mode (recommended) alongside
the existing Direct Factory flow. The `ProductBuilder` is a two-panel premium
experience: the conversation ("What do you want to build?") on the left drives
the progressive flow; the intelligence panel on the right exposes Understanding ·
Requirements (provenance badges) · Questions · Assumptions · Product · Design ·
Architecture · AI · Security · Cost · Plan. On mobile the panel becomes
progressive tabs. Beginner-simple on the surface, deep detail one click away.

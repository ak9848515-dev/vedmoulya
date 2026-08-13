# EPIC-009 — Question Intelligence

**Date:** 2026-08-09 · **Part of:** EPIC-009 Product Intelligence & Requirements Engine

---

## 1. The principle

> Do not ask all possible questions. Determine which questions actually matter.

`RequirementQuestionEngine` + `AmbiguityEngine` + `SafeDefaultEngine` +
`CompletenessEngine` together implement Phases 5–10. The engine's behavior is
**deterministic** — the same idea always produces the same questions, ranked and
bundled the same way, gated the same way. No LLM is involved in the core path
(enrichment is an optional, non-fatal port).

## 2. Ambiguity detection (Phase 5)

`AmbiguityEngine` scans the idea + requirements and produces findings such as:

- "restaurant app with **delivery**" → delivery fleet vs third-party delivery vs
  pickup vs dine-in vs zones vs fees vs live tracking.
- Architecture-changing uncertainty, security-sensitive uncertainty, and
  unrealistic expectations are classified separately.

Each finding that maps to a real decision is linked to a question template
(`resolvesAmbiguityId`), so answering a question visibly clears an ambiguity.

## 3. Question classes & ranking (Phase 6)

| Class     | Behavior                                                                        |
| --------- | ------------------------------------------------------------------------------- |
| BLOCKING  | Must be answered before safe architecture/build. **No safe default by design.** |
| IMPORTANT | Asked before implementation when practical.                                     |
| OPTIONAL  | **Never asked** — the safe default applies (unless the user opens Settings).    |

Ranking is the weighted impact sum:

```
architecture ×5 + security ×4 + business ×3 + implementation ×3 + ux ×2 + cost ×2 + confidence ×1
```

The benchmark confirms the average idea surfaces **2–3 BLOCKING + 2 IMPORTANT**
questions and **3 safe defaults** — a short, focused conversation, never a
questionnaire.

## 4. Question quality (Phase 7)

Questions are short, understandable, specific, actionable, and non-technical
where possible:

> Good: "Should customers create an account, or order as guests?"
> Bad: "Which persistence and identity architecture do you require?"

Every question carries `rationale` ("why it matters") and `impacts`, so the UI
can explain **why** the question is being asked — the user is never quizzed
without context. Technical decisions are explained simply.

## 5. Bundling (Phase 8)

Questions are grouped by topic into `QuestionBundle`s. The restaurant-idea flow
asks one bundle at a time:

```
RESTAURANT ORDERING
1. dine-in / takeaway / delivery / all three?
2. pay online or at the restaurant?
3. accounts required or guest checkout?
4. who manages menu + orders (staff dashboard)?
```

But the engine **does not** ask questions whose answers can be safely defaulted
— those become `SafeDefault`s (Phase 9).

## 6. Safe defaults (Phase 9)

Every proposed default is displayed with:

```
ASSUMPTION   "The restaurant manages its own menu and orders"
DEFAULT      "Admin dashboard for staff"
REASON       "A restaurant without a staff interface cannot operate"
IMPACT       "Adds an admin role + auth scope to the build"
```

The user may **Accept all · Edit · Reject** (`acceptAllDefaults` /
`decideDefault`). **Critical and security-sensitive assumptions can never
silently become defaults** — they are always surfaced as decisions
(`securitySensitive: true` blocks silent acceptance at the engine level).

## 7. Completeness (Phase 10)

`CompletenessEngine` evaluates functional / UX / data / security / integration /
AI / deployment / performance and returns:

```
score, confidence, criticalUnknowns, importantUnknowns, assumptions
```

**A numeric score can never override a critical unknown.** The acceptance
example holds: a 98%-complete plan with unresolved payment security is
**NOT READY**. The engine's `plan()` and `approve()` refuse to run while any
critical unknown or unanswered BLOCKING question exists — proven 7/7 in the
benchmark and enforced in `blockingReasons()`.

## 8. Conflict detection (Phase 11)

Contradictory requirements are detected and surfaced with an explanation; the
user explicitly chooses how to resolve (`resolveConflict` with a/b/both). The
engine never silently picks a side.

## 9. Measured behavior (requirements:benchmark)

| Metric                      | Value                                             |
| --------------------------- | ------------------------------------------------- |
| Understanding latency       | avg **11ms** (deterministic)                      |
| Plan latency                | avg **3ms** (deterministic)                       |
| Blocking questions / idea   | avg **2.3** (only the ones that change the build) |
| Important questions / idea  | avg **2.0**                                       |
| Safe defaults / idea        | avg **3**                                         |
| Plan blocked until resolved | **7/7**                                           |
| AI calls for the core path  | **0** (deterministic; enrichment is optional)     |

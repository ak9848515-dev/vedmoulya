# EPIC-020 — Decision & Learning Model

**User priorities, memory/learning feedback, opportunity intelligence · 2026-08-12**

## 1. User priority model (mission §11)

VedMoulya optimizes around the user's real priorities:

1. Solve meaningful real-world problems
2. Help generate income / earning opportunities
3. Save time
4. Reduce repetitive work
5. Improve decision quality
6. Protect privacy/security
7. Minimize unnecessary cost
8. Continuously improve capability

The system recognizes opportunities ("this task can be automated", "this workflow can save hours/week", "a free GitHub/open-source solution exists", "a paid tool is unnecessary because an equivalent free/local option exists") — **but every recommendation stays evidence-based and uncertainty-explicit**.

## 2. Decision provenance (REUSED from EPIC-016)

Every Brain decision is recorded: decision · reason · selected option · alternatives · evidence · confidence · provenance. EPIC-020 adds failover decisions (`provider failover`), usage notes in role-assignment decisions, and learning/opportunity provenance.

## 3. Memory / learning feedback (mission §10)

Successful (and failed) task outcomes flow back into Brain memory:

- **Task type** (capability set) · **selected providers** · **resources considered** (why selected) · **quality outcome** · **failure outcome** · **cost** · **tokens** · **user approval/rejection** · **verification result**.

`BrainOutcomeMemory` — structured, owner-scoped:

```ts
{ userId, taskId, taskType, providers[{providerId, capability, role, succeeded}],
  selectedReason[], outcome: SUCCESS|PARTIAL|FAILED,
  costUsd?, tokens?, userAccepted, capturedAt }
```

- `BrainMemoryPort.recordOutcome` — the gateway adapter captures into the frozen Memory Intelligence pipeline (non-fatal; in-memory outcome store is the primary feed).
- `AdaptiveScoreLedger.recordPerformance` — recency-weighted task×provider evidence; EXPLICIT vs INFERRED, never silently promoted.
- `PreferenceLedger` (EPIC-014, REUSED) — explicit preference events.

**No hidden chain-of-thought memory** — decisions, provenance and concise reasons only.

## 4. Opportunity intelligence (mission §12)

`OpportunityIntelligence` — a narrow detector with 7 categories:

`earning` · `freelance` · `automation` · `career` · `business` · `productivity` · `cost_saving`

### From AI World / scheduler events (`detectFromEvents`)

- Screened, relevance-evidenced events map to opportunities (e.g. `NEW_FREE_API` → cost_saving; `NEW_GITHUB_REPOSITORY` → automation; `NEW_OPEN_SOURCE_TOOL` → productivity).
- Security gates: `BLOCKED`/`SUSPICIOUS` items and `SECURITY_CONCERN`/`MODEL_DEPRECATION` events NEVER become opportunities.
- Uncertainty = 0.45 + (1 − relevance) × 0.35, raised for `SECURITY_REVIEW_REQUIRED`/`UNKNOWN` posture. **Every opportunity carries uncertainty — never an income promise.**
- `estimatedValue` appears ONLY when evidence exists (status KNOWN/UNKNOWN).

### From task outcomes (`detectFromOutcome`)

- Deliberately conservative: only a task whose objective expresses recurrence/automation intent (`automate|daily|weekly|monthly|recurring|every N`) AND completed AND user-accepted becomes an automation opportunity. A single anecdote is never presented as income.
- Example: "Automate the daily sales report generation" (completed + accepted) → `automation` opportunity with 55% uncertainty.

Verified: benchmark scenarios 16/17/22 (discovery → recommendation, scheduler provenance, recurring-task opportunity detection).

## 5. Re-optimization loop

```
MONITOR → RE-OPTIMIZE
```

- `providerScores(capability)` reads the adaptive ledger (advisory).
- The dashboard surfaces adaptive evidence ("recent evidence matters").
- Selection remains quality-first — scores inform, never dictate.

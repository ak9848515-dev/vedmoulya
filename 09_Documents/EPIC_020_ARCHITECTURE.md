# EPIC-020 — Architecture

**Continuous Intelligence & Adaptive Orchestration · 2026-08-12**

## 1. Design principle

VedMoulya is NOT a LangChain/CrewAI clone. The Brain is the orchestration authority; existing engines stay specialized systems reached ONLY through narrow ports. EPIC-020 **extends `@vedmoulya/brain`** — it does not add a new engine.

```
USER TASK
   │
   ▼
UNDERSTAND ── IntentInterpreter → BrainModeSelector
   ▼
PLAN ──────── BrainPlanPort ──► EPIC-013 capability plan (REUSED)
   ▼
INTELLIGENCE ─ BrainCandidatePort ──► EPIC-012A/B providers · EPIC-012C AI World · local models (REUSED)
   │            ┌──────────────────────────────────────────────┐
   │            │ EPIC-020: assignMany → N provider roles      │
   │            │ (DEEP_RESEARCH / QUALITY+HIGH consult        │
   │            │  independent providers for the SAME cap)     │
   │            └──────────────────────────────────────────────┘
   │            BrainUsagePort ──► usage/limits evidence (KNOWN/UNKNOWN/ESTIMATED)
   ▼
APPROVAL ───── BrainPolicyEngine (sensitive actions pause) + BrainPreferencePort (REUSED)
   ▼
EXECUTE ────── BrainExecutionPort ──► EPIC-006 specialist port (REUSED)
   │            EPIC-020: ExecutionFailover — detect → classify → deprioritize → alternate → continue
   ▼
VERIFY ─────── ConflictDetector → CriticStrategy → OutputAssembler (REUSED) → BrainVerification
   ▼
RESULT ─────── honest terminal state (COMPLETED / PARTIAL / hand-off — never fabricated)
   ▼
EVALUATE ───── OutcomeEvaluator (REUSED) + user acceptance
   ▼
LEARN ──────── AdaptiveScoreLedger (recency-weighted) · BrainMemoryPort (durable) · PreferenceLedger (REUSED)
   ▼
MONITOR ────── BrainDiscoveryBridgePort ──► scheduler/AI World screened events · IntelligenceEventStore
   │            OpportunityIntelligence — evidence-backed opportunities (uncertainty, no income promises)
   ▼
RE-OPTIMIZE ── providerScores + dashboard adaptive evidence → selection input
```

## 2. New narrow ports (all in `@vedmoulya/brain`)

| Port                                          | Mission § | Purpose                                                           |
| --------------------------------------------- | --------- | ----------------------------------------------------------------- |
| `BrainUsagePort`                              | §3        | Provider adapters supply usage/limits evidence; never invented    |
| `BrainExperiencePort`                         | §4        | Record/read task×provider performance evidence                    |
| `BrainMemoryPort`                             | §10       | Durable structured outcome feedback (decisions + provenance only) |
| `BrainDiscoveryBridgePort`                    | §8        | Screened AI World / scheduler events → Brain                      |
| `OpportunityStore` / `IntelligenceEventStore` | §8/§12    | Owner-scoped stores (in-memory convention)                        |

## 3. New domain components (`packages/brain/src/domain`)

- **`UsageIntelligence`** (§3) — evidence status vocabulary KNOWN/UNKNOWN/ESTIMATED; `deriveFactsFromCandidates` (only registry-declared fields become KNOWN); `summarizeFacts`; `estimateTotalCost` (evidence-gated, UNKNOWN stays UNKNOWN); `quotaExhausted` (only when KNOWN ≤ 0); `isFreeOrLocal`; `classifyFailure` (keyword + evidence driven — UNKNOWN stays UNKNOWN).
- **`AdaptiveScoreLedger`** (§4) — recency-weighted quality (exponential decay, 30-day half-life); EXPLICIT feedback outranks INFERRED; advisory input only, never a permanent ranking.
- **`ExecutionFailover`** (§5) — `FallbackSelector` mirrors the frozen `ProviderRoleAssigner` semantics (quality-first, free/local when quality sufficient); never re-picks the failed provider; bounded by `maxAttempts`; never infinite.
- **`OpportunityIntelligence`** (§12) — 7 categories (earning/freelance/automation/career/business/productivity/cost_saving); events → opportunities only when security-clear and relevance-evidenced; SUSPICIOUS/BLOCKED/SECURITY_CONCERN/MODEL_DEPRECATION never become opportunities; task-outcome opportunities only when recurring + completed + accepted; every opportunity carries uncertainty; `estimatedValue` only with evidence.

## 4. Service integration (`BrainApplicationService`)

- `selectResources` — N-provider realization: `assignMany` for DEEP_RESEARCH / QUALITY+HIGH; usage evidence attached to every assignment (`attachUsageEvidence`); evidence-backed budget estimate; fail-closed pre-check.
- `executeAssignment` — mapped capability → bounded attempts → failure classification → `FallbackSelector` → failover event + decision record → continue within budget; budget stop returns immediately (fail-closed).
- `discoverIntelligence` — bridge fetch → dedupe against store → opportunity detection → store.
- `evaluateOutcome` + `recordLearning` — adaptive scores + memory + opportunity detection from accepted recurring outcomes.
- `providerScores` — read adaptive evidence (advisory).

## 5. Gateway (`services/api`)

- `BrainPorts.ts` — `createBrainUsagePort` (real health/availability/free-tier from `ProviderExperienceService`), `createBrainDiscoveryBridgePort` (screens frozen AI World world/digest/github/updates into security-tagged events), `createBrainMemoryPort` (structured capture into Memory Intelligence, non-fatal).
- `BrainRouter.ts` + `RouterRegistry.ts` — `brain.*` +6 procedures: `discoverIntelligence`, `listOpportunities`, `updateOpportunity`, `listIntelligenceEvents`, `updateIntelligenceEvent`, `providerScores`, `dashboard`. All auth + rate-tier + IDOR guarded.
- `BrainDashboardService.ts` — the operating view composing ONLY existing telemetry.

## 6. Web (`apps/web`)

- Typed hooks (`useBrainDashboard`, `useBrainDiscoverIntelligence`, `useBrainListOpportunities`, `useBrainUpdateOpportunity`, `useBrainListIntelligenceEvents`, `useBrainUpdateIntelligenceEvent`).
- `brain-dashboard.tsx` — status hero (what/why/approvals/learned), opportunities panel (acknowledge/dismiss), continuous AI World panel (Discover → screened events; discovery ≠ adoption), learning feed + adaptive scores.
- Mounted on `/brain` above the task pipeline (ErrorBoundary-isolated).

## 7. Honesty invariants

1. Provider limits: KNOWN/UNKNOWN/ESTIMATED — never fabricated.
2. Free ≠ best; quality always above cost; free wins only when quality is sufficient.
3. Discovery ≠ adoption; suspicious content never becomes an opportunity.
4. A failed provider never yields fabricated content.
5. Budgets fail closed; no infinite retries.
6. Learning is EXPLICIT or INFERRED-with-evidence, never silently promoted.
7. Memory stores decisions/provenance/reasons — never hidden chain-of-thought.
8. Opportunities carry uncertainty — never income promises.

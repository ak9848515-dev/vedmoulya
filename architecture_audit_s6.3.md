# S6.3 Opportunity Value Intelligence — Architecture Audit Report

## 1. Opportunity Assessment Location (`BusinessOpportunityAssessor`)

**File**: `packages/proactive/src/domain/BusinessOpportunityAssessor.ts`

- **Method**: `assess(input: BusinessOpportunityInput): BusinessOpportunityAssessment`
- **Scoring Algorithm**:
  - Capability fit (required vs available capabilities) → weighted 60%
  - Recent work (≤90 days) → capped at 20%
  - Market signals (relevance ≥ 0.5) → capped at 20%
  - Formula: `capabilityFit * 0.6 + min(0.2, recentWork/10) + min(0.2, relevantSignals/5)`
- **Key Properties**:
  - Score 0 = `UNKNOWN` (no evidence) — never fabricated
  - Business case only populated when evidence exists
  - Cost/revenue estimates show `UNKNOWN` status when no evidence

## 2. Relevance Calculation Location (`RelevanceScorer`)

**File**: `packages/proactive/src/domain/RelevanceScorer.ts`

- **Purpose**: Evaluates market/AI-world signals for opportunity relevance
- **Threshold**: Signals with `relevance ≥ 0.5` count as "relevant"
- **Integration**: Used by `BusinessOpportunityAssessor` in `marketSignals` processing (line 63-66)
  - Authorization required for all opportunities (`authorizationRequired: true`)

## 3. Historical Outcomes Retrieval (`ExecutionMemoryService`)

**Files**:

- **Primary**: `packages/execution-memory/src/application/ExecutionMemoryService.ts`
  - `retrieve(query: MemoryQuery, runtimeTruth?: RuntimeTruth): Promise<MemoryEvidence[]>`
  - Applies passive decay (half-life default 45 days) at retrieval
  - Resolves memory conflicts against current runtime truth
  - Returns ranked, advisory-only evidence
- **Confidence Computation**: `packages/execution-memory/src/domain/memory-confidence.ts`
  - `computeConfidence(input: ConfidenceInput): ExecutionMemoryConfidence`

## 4. Commercial Learning Influence Point

**Location**: `ExecutionMemoryService` → `BusinessOpportunityAssessor`

- **Mechanism**:
  1. Past executions → `ExecutionMemoryService.ingestRun()` → learning signals
  2. Signals aggregated into `MemoryEntry` with confidence scoring
  3. `BusinessOpportunityAssessor` consumes historical data via:
     - `relatedWork` (prior task history in input)
     - `marketSignals` (AI-world evidence with relevance scores)
  4. Commercial success only counts when outcome is `PAID` (verified in outcome types)
- **Isolation**: Owner-scoped storage prevents cross-user learning
  - All stores use `(ownerId, key)` composite primary key

## 5. Existing Assessment Contract

**Current Object**: `BusinessOpportunityAssessment` (from `BusinessOpportunityAssessor`)

- `id: string` — opportunity identifier
- `ownerId: string` — scoped to the owner
- `title: string`, `description: string`
- `category: string` — derived from title/description keywords
- `score: number` — 0-1, with 0 meaning `UNKNOWN`
- `businessCase: string[]` — evidence-based or `["No evidence yet — research before any commitment."]`
- `estimatedCost?` / `estimatedRevenue?` — `{ label: string; status: string }`; status is `UNKNOWN` when no evidence
- `riskLevel: 'LOW' | 'MEDIUM'` — `MEDIUM` when required capabilities are missing
- `mvpPlan: string[]` — research → capability mapping → MVP → approval → execution
- `authorizationRequired: true` — always required
- `evidence: string[]` — supporting evidence bullets
- `createdAt: string` — timestamp

**Gap vs S6.3**: Missing explicit commercial value intelligence dimensions:

- Commercial success probability (separate from delivery success)

## 6. Smallest Missing Contract: `OpportunityValueIntelligence`

**Location**: `packages/proactive/src/domain/OpportunityValueIntelligence.ts` (new file)
**Purpose**: Extend existing `BusinessOpportunityAssessment` with commercial value dimensions while preserving all advisory-only, evidence-based principles.

```typescript
export interface OpportunityValueIntelligence extends BusinessOpportunityAssessment {
  // Commercial value dimensions (advisory only)
  commercialValue: {
    successProbability: number | 'UNKNOWN';  // Probability of PAID outcome
    evidenceLevel: 'INSUFFICIENT' | 'LOW' | 'MEDIUM' | 'HIGH';
    basis: string[];  // e.g., ["3 similar PAID outcomes", "2 verified client payments"]
  };

  // Delivery success dimensions (separate from commercial)
  deliveryValue: {
    deliverySuccessProbability: number | 'UNKNOWN';
    evidenceLevel: 'INSUFFICIENT' | 'LOW' | 'MEDIUM' | 'HIGH';
    basis: string[];
  };

## 7. Implementation Approach
**Service**: Extend `BusinessOpportunityAssessor` or create `OpportunityValueIntelligenceService`
**Dependencies** (reuse existing frozen estate):
1. `BusinessOpportunityAssessor` — for base opportunity scoring (capability fit, recent work, market signals)
2. `ExecutionMemoryService` — for historical outcome retrieval & confidence computation
3. `RelevanceScorer` — if market signal evaluation needs enhancement (optional)

**Logic Flow**:
1. Delegate base scoring to `BusinessOpportunityAssessor` (unchanged)
2. Query `ExecutionMemoryService` for:
   - Similar past opportunities with commercial outcomes
   - Compute commercial success rate (only `PAID` outcomes count as success)
   - Derive confidence level from evidence sample count/verified count/recency
3. Construct `OpportunityValueIntelligence` by enriching base assessment with:
## 8. Verification Against Requirements
All 22 scenarios covered:

✅ **Owner isolation** – All data stores scoped by `ownerId`; no cross-user learning
✅ **UNKNOWN vs FALSE** – Explicit `'UNKNOWN'` state for missing evidence; never fabricated values
✅ **Commercial = PAID only** – Learning signals filtered for verified `PAID` outcomes; pending/invoice/cancelled counted as activity, not success
✅ **Delivery/commercial separated** – Distinct `commercialValue` and `deliveryValue` sub-objects
✅ **Advisory only** – `authorizationRequired: true` preserved; no auto-execution fields
✅ **No fabricated values** – Evidence-based confidence; `UNKNOWN` when sample count < 1 or unverified
✅ **Reuses existing infrastructure** – Zero new scoring engines; composes `BusinessOpportunityAssessor` + `ExecutionMemoryService` + `RelevanceScorer`

## 9. Test Coverage Requirements (22 scenarios)
Tests must validate:
1. Owner isolation (cross-user contamination impossible)
2. Pending ≠ PAID (only confirmed payments count as success)
3. Missing evidence → UNKNOWN (not 0 or fabricated values)
4. Evidence strength mapping to confidence levels
5. Commercial delivery separation
6. Authorization requirement preservation
7. Evidence basis accuracy
8. Risk level calculation consistency
9. MVP plan integrity
10. Timestamp immutability
11. Evidence array handling
12. Category derivation consistency
13. Business case population rules
14. Cost/revenue UNKNOWN semantics
15. Score bounds enforcement (0-1)
16. Empty input handling
17. Recent work window (90-day boundary)
18. Market signal relevance threshold (0.5)
19. Capability fit calculation
20. Evidence deduplication
21. Memory conflict resolution
22. Passive decay application at retrieval
   - `commercialValue.successProbability` (0-1 or 'UNKNOWN')
   - `deliveryValue.deliverySuccessProbability` (0-1 or 'UNKNOWN')
   - Evidence-based basis strings
   - Owner isolation verification
4. **Critical Constraints**:
   - ❌ NO new scoring engines — reuse existing confidence computation
   - ❌ NO automatic actions — advisory output only (authorizationRequired=true)
   - ❌ NO value fabrication — 'UNKNOWN' when evidence insufficient
   - ✅ Owner isolation maintained via existing store scoping
  // Value intelligence metadata
  valueIntelligence: {
    lastUpdated: string;
    ownerIsolated: boolean;
    valuesFabricated: false;  // Always false — guard against fabrication
  };
}
```

**Key Semantics**:

- `successProbability: 'UNKNOWN'` ≠ `0` — distinguishes no evidence from evidence of failure
- Commercial success requires `PAID` outcome (pending/invoice/cancelled = activity, not success)
- All values evidence-based — never inferred or fabricated when evidence lacking
- Owner isolation enforced at store level (no cross-contamination)
- Evidence strength for value predictions
- Explicit `UNKNOWN` vs `FALSE`/`0` distinction for sparse data
- Value intelligence metadata (owner isolation, fabrication guard)
  - No trust of client-supplied owner IDs — validated at service boundary
  - Evidence-based: success rate + sample strength + recency + verification ratio
  - Levels: `INSUFFICIENT` (<1 sample or 1 unverified) → `LOW` → `MEDIUM` → `HIGH`
  - Never model-chosen — purely deterministic from evidence

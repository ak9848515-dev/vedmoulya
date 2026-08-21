# SPRINT-029 — Provider Orchestration

> **Sprint:** SPRINT-029 — Proactive Intelligence & Automation Fabric
> **Date:** 2026-08-13/14
> **Status:** COMPOSITION (zero new provider logic) + FUTURE (workflow decomposition)

---

## 1. Principle

**Never hard-code a provider into business logic.** The proactive layer contains no
provider id, no model name, no vendor SDK. It reads the **capability marketplace
surface** (`ProactiveCapabilityPort.availableCapabilities` → the ids of capabilities the
owner's configured providers can currently serve) and composes the frozen routing
authority for anything that would execute.

## 2. What SPRINT-029 does today

- **Capability evidence**: business-opportunity scoring and automation proposals use the
  marketplace's capability view (READY capability ids for the owner) — feasibility is
  evidence-based, never assumed.
- **Advisory automation boundary**: `AutomationBoundaryEngine.assess` is attached to
  automation proposals as advisory metadata.
- **No selection logic**: the proactive layer never picks a provider/model. If a
  proposal is accepted and executed, the EXISTING `QualityFirstSelector` /
  `ProviderRoutingAdvisor` / `ProviderRoleAssigner` do the selection (QUALITY →
  EVIDENCE → USABILITY → FREE/LOCAL → COST; FREE MUST NOT BEAT QUALITY).

## 3. The multi-provider orchestration requirement (PHASE 3)

The frozen estate already orchestrates N providers for a single task through the Brain:
`ProviderRoleAssigner` (13 roles) + `ParallelPlanner` + `OutputAssembler` + `ConflictDetector`

- `ExecutionFailover` (bounded, never re-picks the failed provider) + the EPIC-013
  `CapabilityDecomposer` (outcome → steps) + the EPIC-014 execution bridge (step-level
  provider-agnostic execution). **SPRINT-029 deliberately adds no second orchestration
  layer.** A YouTube-pipeline-style decomposition (research → fact verification → script →
  visual → voice → editing → thumbnail → SEO → quality verification) is a composition of
  `CapabilityDecomposer` + `ProviderRoleAssigner` — SPRINT-030+ scope, and it must reuse
  exactly these authorities.

## 4. Cost optimization (PHASE 4)

- The existing marketplace/selection layer already understands resource types (LOCAL /
  FREE HOSTED / FREE API QUOTA / USER-PAID API / …) and **FREE MUST NOT BEAT QUALITY**.
- SPRINT-029's business opportunity model surfaces **cost only when evidence exists**
  (an `EvidenceValue` with VERIFIED/ESTIMATED/UNKNOWN — never a fabricated "$X/mo").
- No quota bypass, no licensing bypass, no rate-limit bypass: anything executing flows
  through the frozen runtime with its budgets, cooldowns and approval gates.

## 5. Scalability

The architecture is provider-count-agnostic: providers are registry entries with
capability mappings; routing is a port (`ProviderIntelligencePort`); business logic
names capabilities, never providers. Scaling from a handful to 50/100+/N providers
requires registry entries + adapters — **no redesign** (frozen since EPIC-012B).

## 6. Honest status

- Provider selection for proactive-triggered work: **reused, unchanged** (the frozen
  authorities). IMPLEMENTED + TESTED (existing suites).
- Full workflow decomposition (multi-provider, multi-step pipeline proposals):
  **FUTURE** (SPRINT-030+) — the seams (`CapabilityDecomposer`, provider-role
  assignment, execution bridge) are ready; no new engine required.
- Live provider execution: **OPERATOR-REQUIRED** (unchanged platform posture).

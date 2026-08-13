# EPIC-017 — VedMoulya Live Intelligence Bridge: Baseline Audit

**Status:** PHASE 0 — COMPLETE (2026-08-11)
**Verdict:** The integration surface is fully IMPLEMENTED. Every system EPIC-017 must connect exists, is tested, and exposes narrow ports. **No new intelligence/execution/approval/security engine is required — EPIC-017 is a pure integration epic.**

---

## 1. Audit method

Every required dependency was inspected in the ACTUAL working tree (not assumed from
documentation): package exports, contracts, application services, gateway wiring
(`ApiApplicationService` + `RouterRegistry`), and the deterministic adapter seams used
in CI. Classification legend:

| Class                     | Meaning                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| **IMPLEMENTED**           | Real, tested implementation exists and is reachable through a narrow port                   |
| **PORT_READY**            | Interface exists; a live/external adapter is an operator step (deterministic adapter in CI) |
| **PARTIALLY_IMPLEMENTED** | Core exists; some boundary is operator-required                                             |
| **OPERATOR_REQUIRED**     | Requires live credentials/external services not present on this machine                     |
| **PLANNED**               | Documented for a future epic                                                                |
| **NOT_AVAILABLE**         | Absent from the repository                                                                  |

---

## 2. Dependency classification

### 2.1 The Brain — EPIC-016 (`@vedmoulya/brain`) — **IMPLEMENTED**

- `BrainApplicationService`: `createTask → plan → selectResources → requestApproval / approve / reject → execute → verify → evaluateOutcome`, owner-scoped, IDOR-safe stores.
- Domain reused by the bridge (NOT rebuilt): `IntentInterpreter`, `BrainModeSelector`, `ProviderRoleAssigner` (13 roles), `ParallelPlanner`, `ConflictDetector`, `OutputAssembler`, `CriticStrategy`, `BrainBudgetGuard` (fail-closed), `BrainPolicyEngine` (`SENSITIVE_ACTIONS`, approval gates), `BrainDecisionRecorder`, `OutcomeEvaluator`.
- Ports: `BrainPlanPort`, `BrainCandidatePort`, `BrainExecutionPort`, `BrainContextPort`, `BrainPreferencePort`, `BrainTaskStore`, `BrainDecisionStore`.
- Gateway: `brain.*` namespace (13 procedures), `BrainPorts.ts` deterministic adapters, `BrainRouter.test.ts` 7/7. Tests 82/82. Benchmark 12/12.

### 2.2 Ecosystem Intelligence — EPIC-015 (`@vedmoulya/ecosystem-intelligence`) — **IMPLEMENTED**

- `EcosystemIntelligenceApplicationService` answers the Brain's intelligence questions directly: `findBetterOption`, `findFreeAlternative`, `findLocalAlternative`, `findGitHubCapability`, `findBetterProvider`, `checkCapabilityFreshness`, `evaluateSecurity`, `evaluateLicense`, `getAcquisitionPlan`, `approveAcquisition`, `respondToRecommendation`, `notify`.
- Reuses `BrainCandidatePort` + `BrainPreferencePort` (single source seam — zero duplication).
- Domain: `TaskIntelligenceEngine` (quality-first, material-improvement margin 8), `SecurityAssessor`, `LicenseEngine`, `FreeResourceIntelligence`, `AcquisitionPlanner`, `RecommendationAssembler`, `LifecycleLedger`, `NotificationGate` (relevance-gated).
- GitHub: separate least-privilege flow (`GitHubConnectionManager`, provider-side revoke, write-consent).
- Gateway: `ecosystemIntelligence.*` namespace, `EcosystemIntelligencePorts.ts` deterministic adapters, router tests. Package 81/81. Web UI 13/13 helper tests. E2E journey passing. Benchmark 12/12.

### 2.3 Provider Intelligence / Registry — EPIC-012A/012B (`packages/services`, `packages/ai`) — **IMPLEMENTED**

- `AIOrchestrationService` (provider registration, capability routing, retry/fallback), `ModelSelectionIntelligence`, `ProviderRoutingAdvisor`, `AIOrchestratorSpecialistPort`.
- Provider registry + capability→provider matching feed `CapabilitySourcePorts.ts` (deterministic gateway seam).
- Configuration surface: `/providers` screen + `AI_PROVIDERS_*` config (deep-link target for CONFIGURE hand-offs).

### 2.4 AI World — EPIC-012C (`@vedmoulya/ai-world`) — **IMPLEMENTED**

- `DiscoveryApplicationService` (getWorld/getDigest/listItems/getItem/markRead/markAllRead/setAction/runDiscovery), `DiscoveryStore` with `addItems` seam, `SecurityScanner` (untrusted input sanitization), `RelevanceScorer`, bounded FIFO store.
- **Notification surface:** the existing AI World bell + `/ai-world` page + EPIC-015 relevance-gated `IntelligenceNotification` store (`EcosystemIntelligenceApplicationService.notify`). EPIC-017 emits through THIS surface — no new notification system.

### 2.5 Capability Marketplace — EPIC-013 (`@vedmoulya/capability-marketplace`) — **IMPLEMENTED**

- `CapabilityMarketplaceApplicationService` (`plan/getPlan/listPlans/capabilities`), `CapabilityPlanner` (decompose → match → quality-first select → assemble), `ApprovalEngine`, `QualityFirstSelector`, `AutomationBoundaryEngine`, `CapabilitySourcePort`.
- The `FactoryCapabilityPlan` is the plan contract EPIC-017 hands to execution.

### 2.6 Capability Execution — EPIC-014 (`@vedmoulya/execution-bridge`) — **IMPLEMENTED**

- `ExecutionRunService` (`start/approve/reject/completeHandoff/cancel/get/list/preferenceLedger/intelligence`), `PlanRunResolver` (dispositions), `StepVerifier` (pre/post contracts), `ApprovalRuntime`, `RunBudgetGuard` (fail-closed over LoopBudget), `PreferenceLedger`, `CapabilityMapper`, `InMemoryExecutionRunStore`.
- Gateway: `execution.*` namespace, `execution-journey` e2e passing. Benchmark 8/8.

### 2.7 Approval / Policy — **IMPLEMENTED (REUSE)**

- `BrainPolicyEngine.requiresApproval` + `SENSITIVE_ACTIONS` (publish/send/deploy/purchase/subscribe/delete/share/install/connect_account).
- EPIC-013 `ApprovalEngine` (irreversible actions) + EPIC-014 `ApprovalRuntime` (execution-time re-check).
- EPIC-015 acquisition approval (`AcquisitionPlanner`, `approveAcquisition`).
- EPIC-017 adds **no new policy engine** — it composes these existing gates.

### 2.8 Memory / Preference — **IMPLEMENTED (REUSE)**

- EPIC-014 `PreferenceLedger` + `InMemoryPreferenceLedger` (provenance-preserving events; explicit ≠ inferred).
- `BrainPreferencePort` (the single record seam). EPIC-017 derives task-specific, time-aware, reversible performance facts FROM these events — no new memory engine, no global ranking.

### 2.9 Authentication & Ownership — **IMPLEMENTED (REUSE)**

- Google auth unchanged; owner-scoped stores; auth middleware + IDOR guard on every gateway procedure; rate-limit tiers; zod schema validation.

### 2.10 AI configuration / routing — **IMPLEMENTED (REUSE)**

- Existing provider configuration + routing (EPIC-012A/B) reused for deep-links and current-configuration comparison. No duplicate configuration screens.

---

## 3. What EPIC-017 must ADD (and nothing more)

| Component                                                    | Why it is genuinely new                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@vedmoulya/live-intelligence-bridge` workspace              | The **orchestrator** that runs the full loop — no single existing service drives USER TASK → … → FEEDBACK end-to-end                                                                                                                                                                  |
| `BridgeLoopRun` state machine                                | Explicit stages: UNDERSTAND → DISCOVER → COMPARE → RECOMMEND → APPROVAL → CONFIGURE/HANDOFF → PLAN → EXECUTE → VERIFY → EVALUATE → FEEDBACK                                                                                                                                           |
| Structured `BridgeCandidate` / `BridgeComparison` view model | The brief's evidence shape (candidate, capability, provider, model, integrationType, qualityEvidence, taskFit, securityStatus, availability, costClass, freeTierStatus, localAvailability, confidence, recommendation, approvalRequired) — assembled from EXISTING intelligence facts |
| Acquisition-class derivation                                 | `FREE_API / FREE_WITH_QUOTA / LOCAL_MODEL / OPEN_SOURCE / GITHUB_PROJECT / PAID / EXTERNAL_APPLICATION / MANUAL / UNKNOWN` from existing freeClass/integrationType facts                                                                                                              |
| Task-specific performance feedback                           | Time-aware, reversible per-(task, capability, provider) facts derived from the existing preference ledger                                                                                                                                                                             |
| AI World emission seam                                       | `BridgeAiWorldPort` → existing `DiscoveryStore.addItems` + `notify` gate — the ONLY new outward seam, into the EXISTING surface                                                                                                                                                       |
| Gateway `liveIntelligence.*` namespace + deterministic ports | Thin tRPC facade over the real services (auth + IDOR + rate limits)                                                                                                                                                                                                                   |
| Web `/live-intelligence` UI                                  | Premium progressive-disclosure loop view (better-capability card, approval, hand-off, outcome, feedback)                                                                                                                                                                              |
| Tests / e2e / benchmark / docs                               | Acceptance evidence for the integration                                                                                                                                                                                                                                               |

## 4. Explicit non-goals (verified NOT duplicated)

- No new provider router (EPIC-012A/B) · no new discovery (EPIC-012C) · no new capability planner (EPIC-013) · no new execution engine (EPIC-014) · no new loop engine (EPIC-006) · no new approval engine · no new memory engine · no new notification system · no new auth.

## 5. Operator-required boundaries (honest)

- Live provider execution (no credentials on this machine) — deterministic execution port in CI.
- Live GitHub OAuth exchange + provider-side revoke — deterministic auth adapter in CI.
- Live ecosystem discovery — static catalog default; pluggable source port ready.

## 6. Conclusion

Phase 0 audit is **GREEN**. All 10 dependency groups are IMPLEMENTED with narrow ports.
EPIC-017 proceeds as a pure integration epic: one new workspace, one gateway namespace,
one web surface, and acceptance evidence — reusing every engine that exists.

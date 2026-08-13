# EPIC-017 — VedMoulya Live Intelligence Bridge: Architecture

**Status:** IMPLEMENTED (2026-08-11)
**Verdict:** 🟢 GREEN — the full loop is operational through the existing ecosystem.

---

## 1. Purpose

Connect the VedMoulya Brain (EPIC-016) to the existing Intelligence and Execution
ecosystem so that this complete loop becomes operational:

```
USER TASK → BRAIN UNDERSTAND → CAPABILITY DISCOVERY → PROVIDER/MODEL
INTELLIGENCE → ECOSYSTEM INTELLIGENCE → SECURITY/LICENSE/AVAILABILITY →
TASK-SPECIFIC QUALITY → COMPARE CURRENT VS BETTER → RECOMMENDATION →
USER APPROVAL WHEN REQUIRED → CONFIGURATION/HAND-OFF → VALIDATION → ROUTING →
EPIC-014 EXECUTION → VERIFY → EVALUATE → MEMORY/PREFERENCE FEEDBACK
```

The Bridge is an **orchestrator, not an engine**. It never rebuilds provider
intelligence, discovery, capability planning, execution, approval, security,
memory, or routing — every stage delegates to an existing system through a narrow
port. Nothing is fabricated; UNKNOWN stays UNKNOWN; nothing is auto-activated
without user approval.

## 2. Decision hierarchy (unchanged, enforced by the Bridge)

```
QUALITY → EVIDENCE → ACCURACY/PRECISION → TASK FIT → RELIABILITY → SECURITY →
USABILITY → FREE/LOCAL → COST
```

- FREE never automatically beats quality.
- A paid option is never automatically selected.
- A GitHub repository is never automatically trusted.
- A local model is never preferred simply because it costs ₹0.

## 3. The loop state machine

`BridgeLoopRun` tracks explicit stage state (16 stages):

```
UNDERSTAND → DISCOVER → COMPARE → RECOMMEND → APPROVAL → CONFIGURE/HANDOFF →
PLAN → EXECUTE → VERIFY → EVALUATE → FEEDBACK → NOTIFY → COMPLETED/FAILED/BLOCKED
```

Every stage has an explicit status (`pending | running | completed | blocked |
failed | skipped`). The loop never jumps from DISCOVERED to CONFIGURED.

Loop statuses: `NEW · UNDERSTANDING · DISCOVERING · COMPARING · RECOMMENDING ·
AWAITING_APPROVAL · CONFIGURING · HANDING_OFF · PLANNING · EXECUTING · VERIFYING ·
EVALUATING · FEEDBACK · NOTIFYING · COMPLETED · PARTIAL · BLOCKED · FAILED`.

## 4. Package layout — `@vedmoulya/live-intelligence-bridge`

```
src/
├── types/       bridge-types.ts         — BridgeStage, BridgeCandidate, BridgeComparison,
│                                          BridgeRecommendation, BridgeApproval,
│                                          BridgeExecutionHandoff, BridgeOutcomeEvaluation,
│                                          BridgePerformanceFact, BridgeNotificationEvent,
│                                          BridgeLoopRun, BridgeLoopConfig, AcquisitionClass
├── contracts/   bridge-ports.ts         — BridgeClockPort, BridgeBrainPort,
│                                          BridgeIntelligencePort, BridgeMarketplacePort,
│                                          BridgeExecutionPort, BridgeAiWorldPort,
│                                          BridgeLoopStore + REUSED BrainCandidatePort /
│                                          BrainPreferencePort (single source seam)
├── domain/
│   ├── AcquisitionClassifier.ts         — FREE/LOCAL/GITHUB/PAID decision (evidence-only)
│   ├── BridgeCandidateAssembler.ts      — option → structured view model
│   ├── BridgeComparisonBuilder.ts       — current vs better (structured reasons)
│   ├── BridgeRecommendationBuilder.ts   — premium "better option found" card
│   ├── BridgeApprovalPolicy.ts          — approval gate derivation (never bypassed)
│   ├── BridgeOutcomeEvaluator.ts        — result evaluation (taskCompleted/quality/…)
│   ├── BridgePreferenceFeedback.ts      — task-specific, time-aware, reversible facts
│   └── BridgeNotificationMapper.ts      — meaningful-event → AI World (relevance gate)
├── infrastructure/ InMemoryBridgeLoopStore.ts — owner-scoped bounded store
├── application/   LiveIntelligenceBridgeService.ts — the orchestrator
└── __tests__/     45 deterministic tests
```

## 5. Stage → existing system mapping (zero duplication)

| Stage      | Delegates to                                                            | Port                          |
| ---------- | ----------------------------------------------------------------------- | ----------------------------- |
| UNDERSTAND | Brain `createTask` + `plan` (EPIC-016)                                  | `BridgeBrainPort`             |
| DISCOVER   | Brain candidate seam (provider registry + AI World + local models)      | `BrainCandidatePort` (reused) |
| COMPARE    | Ecosystem Intelligence `findBetterOption` (EPIC-015)                    | `BridgeIntelligencePort`      |
| RECOMMEND  | `TaskIntelligenceEngine` best-option + recommendation assembler         | `BridgeIntelligencePort`      |
| APPROVAL   | Bridge approval policy over Brain/EPIC-013/EPIC-014 gates               | policy engine (reused)        |
| CONFIGURE  | Deep-link into existing provider configuration (no new screen)          | hand-off record               |
| HANDOFF    | Capability Marketplace `plan` (EPIC-013)                                | `BridgeMarketplacePort`       |
| PLAN       | Same plan (the `FactoryCapabilityPlan` contract)                        | —                             |
| EXECUTE    | Execution Bridge `start/approve/reject/completeHandoff` (EPIC-014)      | `BridgeExecutionPort`         |
| VERIFY     | Execution `get` (verified steps, honest status)                         | `BridgeExecutionPort`         |
| EVALUATE   | `BridgeOutcomeEvaluator` over the real run                              | domain                        |
| FEEDBACK   | Existing `BrainPreferencePort` ledger (EPIC-014)                        | reused seam                   |
| NOTIFY     | Existing AI World notification surface (`DiscoveryStore`/`notify` gate) | `BridgeAiWorldPort`           |

## 6. Gateway wiring

- `liveIntelligence.*` tRPC namespace: `start · discover · compare · recommend ·
approve · reject · handOff · verify · evaluateAndLearn · get · list ·
emitNotification` — all authenticated, owner-scoped (IDOR refused), rate-limited
  (standard/heavy tiers), zod-validated.
- `LiveIntelligenceBridgePorts.ts` — thin facades over the real services
  (`BrainApplicationService`, `EcosystemIntelligenceApplicationService`,
  `CapabilityMarketplaceApplicationService`, `ExecutionRunService`) + the existing
  notification surface. Deterministic in CI; no secrets cross any port.
- Registered in `RouterRegistry` behind the central auth guard.

## 7. Web surface

`/live-intelligence` (nav: **Live Intelligence**) — premium progressive disclosure:

- Task input + examples → **Run the Bridge**.
- Loop card: objective, status badge, capability chips, **stage rail**
  (Understand → Discover → Compare → Recommend → Approval → Execute → Verify →
  Evaluate).
- **Capability candidates** — evidence-first (provider registry, AI World, local
  models); UNKNOWN stays UNKNOWN.
- **Current vs better — for THIS task** — structured reasons, never chain-of-thought.
- **Recommendations** — material improvements only; paid/GitHub/external always
  require explicit approval (`Approve & Configure` / `Use recommended` /
  `Keep current`).
- **Hand-off** — configuration/manual/execution boundary, deep-linked to existing
  surfaces; never auto-executed.
- **Outcome evaluation** — taskCompleted, quality, accuracy, validation,
  latency/cost, provider performance.
- **Task-specific performance** — derived, reversible, time-aware.
- **Sent to AI World** — relevance-gated emissions.
- **Recent Bridge loops** — owner-scoped history.

## 8. Honest boundaries (what the Bridge does NOT claim)

- Live provider execution is an operator step (deterministic ports in CI).
- Live GitHub OAuth exchange is an operator step.
- Live ecosystem discovery is an operator step (static catalog default).
- When no materially better option is evidenced, the Bridge honestly reports
  "No materially better option requires activation" and continues with the best
  configured option — declining is never task failure.

## 9. Reused systems (explicit non-goals)

No new provider router · no new discovery · no new capability planner · no new
execution engine · no new loop engine · no new approval engine · no new memory
engine · no new notification system · no new auth. All verified against the
baseline audit.

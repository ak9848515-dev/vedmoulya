# EPIC-017 — VedMoulya Live Intelligence Bridge: Live Intelligence Behavior

**Status:** IMPLEMENTED (2026-08-11)

This document specifies the observable intelligence behavior of the bridge: what
the user sees, why the bridge recommends what it recommends, and how it answers
the nine UI questions.

---

## 1. What the user experiences

The Bridge UI communicates, with progressive disclosure:

| Question                  | Where it is answered                                                  |
| ------------------------- | --------------------------------------------------------------------- |
| WHAT AM I DOING?          | Loop card: objective + stage rail + status                            |
| WHY THIS PROVIDER?        | Candidate cards (evidence list per candidate)                         |
| WHY THIS MODEL?           | Candidate cards (quality, capability, evidence)                       |
| IS THERE A BETTER OPTION? | "Current vs better — for THIS task" cards                             |
| WHAT WILL IT COST?        | Recommendation card cost chip (evidence-backed or UNKNOWN)            |
| IS IT FREE?               | Acquisition class chip (FREE_API / FREE_WITH_QUOTA / …)               |
| IS IT LOCAL?              | Local availability + LOCAL_MODEL acquisition class                    |
| IS IT SAFE?               | Security status chip (no blocking indicators found / review required) |
| DO I NEED TO APPROVE?     | "Explicit approval required" + Approve/Reject actions                 |
| WHAT HAPPENS NEXT?        | Hand-off card, outcome evaluation, performance feedback               |

## 2. Finding a better capability (Phase 2)

For each required capability the bridge calls the existing intelligence seam:

1. Current = what the user actually has configured (`BEST_CONFIGURED`).
2. Alternatives = all candidates (configured + free + local + GitHub + paid).
3. `TaskIntelligenceEngine` ranks by QUALITY → EVIDENCE → TASK FIT → RELIABILITY →
   AVAILABILITY → FREE/LOCAL → COST, with a material-improvement margin.
4. If the best alternative materially improves quality with evidence, the bridge
   emits a structured `BridgeComparison` + `BridgeRecommendation` with WHY reasons
   (never hidden chain-of-thought).

The UI shows only the structured reasons:

```
Current      Configured Base          Quality 70/100
Recommended  Paid Star                Quality 96/100
Why          • Stronger task evidence — materially better.
             • Paid option with evidenced cost.
             • Activation requires explicit user approval.
```

## 3. Better-option notification (Phase 4)

When a materially better paid/configured option exists, the user sees a premium
card (not a spammy banner):

```
⭐ Higher-quality option available: Paid Star
Current      Configured Base          Quality 70/100
Recommended  Paid Star                Quality 96/100
Cost         $0.05/use
Security     TRUSTED_WITH_REVIEW
Requires     api_key · subscription
Free alternative: Configured Base     [when evidenced]
Local:        —                       [never invented]
[Approve & Configure]   [Keep current]
```

Paid purchases/subscriptions ALWAYS require explicit approval. Downloading /
installing / connecting ALWAYS require explicit approval.

## 4. GitHub / open-source (Phase 5)

A useful open-source capability found:

```
Useful open-source capability found: OpenRepo Kit
Security   SECURITY_REVIEW_REQUIRED
Approval   Explicit approval required
[Review & Configure]  [Use Current Tools]  [Ignore]
```

Repository lifecycle stays DISCOVERED → SECURITY REVIEW → RELEVANCE → APPROVAL →
ACQUIRE → SANDBOX → ANALYZE → STORE INTELLIGENCE → OPTIONAL CONFIGURATION. The
bridge never clones, installs, or executes anything by itself.

## 5. Free / local decision (Phase 4)

- `findFreeAlternative` returns the best evidence-backed free candidate or an
  honest `{ free: false, note }`.
- `findLocalAlternative` returns available local models or
  `{ available: false, note }` — a local model is never recommended merely
  because it is free; quality + hardware suitability gate it.
- When the better option is paid and the configured base is free, the
  recommendation shows the free alternative when evidenced — and the local
  alternative only when genuinely available (never invented).

## 6. Declining is never task failure (Phase 4/15)

If the user declines a paid provider:

```
SEARCH FREE → FREE QUOTA → LOCAL → OPEN SOURCE → GITHUB → CURRENT CONFIGURED
```

The loop continues with the best achievable option, records the decision as
evidence (`continue_with_current`), and does NOT infer a permanent financial
preference from one decline. The outcome evaluation records
`userApproval: REJECTED` and the loop still completes honestly.

## 7. Hand-off (Phase 7/8)

- **Configuration** → deep-link into the EXISTING provider configuration
  (`/providers`) — no duplicate screen.
- **Manual / external** → honest hand-off card ("requires manual completion"),
  never fabricated API execution.
- **Execution** → the plan reaches EPIC-014; the frozen `RunBudgetGuard`,
  `StepVerifier`, `ApprovalRuntime`, and `ValidationPipeline` all remain in force.
- The UI shows `kind` (CONFIGURE / MANUAL / EXTERNAL / EXECUTE / UNAVAILABLE),
  plan + execution ids, the step, and an explicit "Proceed to execution" action
  where applicable.

## 8. Outcome evaluation + feedback (Phase 9/10)

After execution the bridge evaluates (structured, no hidden chain-of-thought):

- taskCompleted · quality · accuracy · validation · failures ·
  providerPerformance (per role: succeeded/latency/cost) · latencyMs · costUsd ·
  reliability · userApproval · chosenCapabilityPerformedBetter.

Then it records task-specific performance facts through the EXISTING preference
ledger:

- per (provider, role) fact with quality class, privacy/cost benefit flags,
  `derived: true`, evidence, timestamp — **reversible and time-aware**.
- No global permanent ranking is built. A provider that was excellent yesterday
  may not remain excellent forever.

## 9. AI World notifications (Phase 11)

Materially relevant changes reach the EXISTING AI World surface via
`BridgeAiWorldPort`:

- NEW_MODEL · BETTER_MODEL · FREE_QUOTA_AVAILABLE · FREE_QUOTA_CHANGED ·
  PROVIDER_DEGRADED · NEW_GITHUB_PROJECT · GITHUB_PROJECT_ABANDONED ·
  SECURITY_CHANGE · NEW_LOCAL_MODEL · BETTER_CAPABILITY · PRICE_CHANGE ·
  MODEL_DEPRECATED.

Gating: `BridgeNotificationMapper` + the existing relevance threshold. Events
below relevance are dropped with a reason — no spam.

## 10. Operator boundaries (honest)

| Capability                                        | Status                                             |
| ------------------------------------------------- | -------------------------------------------------- |
| Deterministic bridge loop (tests, benchmark, e2e) | IMPLEMENTED + VERIFIED                             |
| Live provider execution                           | OPERATOR REQUIRED (no credentials on this machine) |
| Live GitHub OAuth exchange                        | OPERATOR REQUIRED                                  |
| Live ecosystem discovery                          | OPERATOR REQUIRED (static catalog default)         |
| Real repository acquisition / sandbox             | OPERATOR REQUIRED (EPIC-015 acquisition pipeline)  |

Nothing in the bridge claims LIVE status it cannot verify. All CI-facing behavior
is deterministic and hermetic.

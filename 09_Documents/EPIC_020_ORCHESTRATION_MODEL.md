# EPIC-020 — Orchestration Model

**N-provider task orchestration, failure handling & quality critic loop · 2026-08-12**

## 1. Multi-provider task orchestration (mission §1)

For ONE user task the Brain assigns N providers/resources with roles. Example (from the mission):

```
"Research the best AI automation solution for downloading and cleaning Excel files daily."
  Provider A  → research            (RESEARCHER)
  Provider B  → technical architecture (ARCHITECT)
  Provider C  → security analysis   (SECURITY_REVIEWER)
  GitHub repo → implementation reference (REFERENCE)
  Local model → private-data reasoning (PRIVATE_REASONER)
  Provider D  → critic/reviewer     (CRITIC)
```

Execution: parallel execution (per the EPIC-016 `ParallelPlanner` execution graph) → collect outputs → detect conflicts (`ConflictDetector`) → score evidence → quality-first selection → synthesize (`OutputAssembler`) → verify → store outcome.

**Selection order (NEVER an average):** QUALITY → EVIDENCE → TASK FIT → ACCURACY → RELIABILITY → USABILITY → FREE/LOCAL → COST. **Cost never outranks quality.**

### N-provider realization (`ProviderRoleAssigner.assignMany`)

- New `assignMany(capability, candidates, opts)` returns **N assignments** for the SAME capability.
- `BrainApplicationService.selectResources` uses it when the mode demands independent corroboration:
  - `DEEP_RESEARCH` — always N (independent perspectives for the same capability).
  - `QUALITY` + `qualityTarget === 'HIGH'` — N.
- Otherwise one role assignment per capability (the frozen EPIC-016 behavior).
- Verified: benchmark scenario 2 (roles RESEARCHER + WRITER for 2 capabilities), scenario 3 (2 providers on RESEARCH → MATERIAL_CONFLICT detected, never averaged), scenarios 18/19 (N allocations → N execution calls).

## 2. Failure / fallback orchestration (mission §5)

A provider failure does NOT fail the task:

```
detect failure → classify → remove/deprioritize candidate → select alternative → continue within budget
```

- `UsageIntelligence.classifyFailure` — evidence + keyword driven: `QUOTA_EXHAUSTED` / `PROVIDER_UNAVAILABLE` / `MODEL_DEGRADED` / `SUBSCRIPTION_UNAVAILABLE` / `UNKNOWN_FAILURE` (never guessed, never masked).
- `FallbackSelector` — reuses the frozen quality-first semantics; **never re-picks the failed provider**; free/local preferred when quality is sufficient; quality-first when the target is HIGH.
- Bounded: `maxAttempts = min(2, max(1, maxIterations))` per capability — no infinite retries.
- Budget fail-closed: if the run budget is exceeded mid-run, execution STOPS immediately (no further assignments, no fake synthesis).
- Every failover is recorded: `task.failoverEvents` (capability, failedProviderId, failureClass, fallbackProviderId, reason, attempts, timestamp) + a decision record.

Examples verified in the benchmark:

- quota exhausted → classified QUOTA_EXHAUSTED → failover to another free provider (scenario 5);
- provider unavailable → honest empty output + failure decision, never fabricated content (scenario 4);
- budget exhaustion → BUDGET_BLOCKED with zero provider calls (scenario 12).

## 3. Quality critic loop (mission §6)

After multi-provider outputs:

```
1. collect → 2. normalize → 3. compare → 4. detect disagreement → 5. evidence-check →
6. critic → 7. synthesize → 8. verify
```

- `ConflictDetector` classifies: AGREEMENT / MINOR_VARIANCE / MATERIAL_CONFLICT / MAJOR_CONFLICT / EVIDENCE_CONFLICT / UNRESOLVED.
- Verification checks: execution completed · no abstention without reason · evidence policy · no unresolved material conflict.
- **UNRESOLVED is reported honestly** — the Brain never manufactures consensus. Synthesis surfaces `unresolvedConflicts` with provider provenance and confidence.

## 4. Free-first intelligence (mission §2)

For every candidate (when evidence exists): free · free with quota · paid · local · open-source · self-hostable · GitHub · subscription required · unknown.

- FREE ≠ BEST. When two candidates are sufficiently equivalent, preference order:
  `FREE → FREE WITH QUOTA → LOCAL → OPEN SOURCE → SELF HOSTED → LOW COST → PAID`.
- If a substantially better resource requires payment: **explicit approval required** with estimated cost (when evidence exists), why it is better, and the free/low-cost alternative — the Brain never silently subscribes.
- Verified: benchmark scenario 6 (0.85 free beats 0.86 paid when quality is sufficient), scenario 7 (0.95 premium beats 0.5 free on quality, and the 'subscribe' action requires explicit approval).

## 5. Approval intelligence (mission §7)

- Sensitive actions (`publish`/`send`/`deploy`/`purchase`/`subscribe`/`delete`/`share`/`install`/`connect_account`…) pause at `AWAITING_APPROVAL` via the frozen `BrainPolicyEngine`.
- Low-risk information retrieval never interrupts.
- Approval is risk-sensitive: irreversible/high-risk actions gate; informational hand-offs (`missing-capabilities`) are shown, never faked.

## 6. Human control (mission §14)

```
AI recommends → Policy decides → User approves sensitive actions →
Execution executes bounded approved actions → Verification confirms →
Memory records outcome
```

Never: silent purchases/subscriptions/account connections/private-repo access/destructive actions/deployment/publishing/installation/untrusted-repo execution.

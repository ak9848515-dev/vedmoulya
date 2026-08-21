# SPRINT-033 — COMPANY OS MODEL

**VedMoulya Autonomous Company OS — founder intelligence · multi-business architecture · autonomy model**

---

## 1. What the Company OS is

VedMoulya is an **authorized, founder-controlled AI company platform**: ONE
founder, N businesses, N workspaces, N workflows, N customers, N AI providers,
N capabilities — with strict isolation and ONE governance model. The product is
not an AI model; it is the **operating layer** that turns many AI capabilities
into controlled, measurable, scalable real-world work.

The platform loop is unchanged from the OS:

```
OBSERVE → RECOMMEND → ASK → (founder approves) → EXECUTE-APPROVED
→ VERIFY → LEARN
```

SPRINT-033 adds the **founder-facing composition** (advisory briefing) and the
**revenue/decision model** — it does not add autonomy. Nothing in this model
spends, commits, communicates externally or creates a business.

## 2. Founder / executive intelligence (Part A)

`FounderBriefing` (world-model, `domain/FounderBriefing.ts`) composes ONLY the
existing estate through the existing ports and answers:

1. **What is happening?** — TODAY: active opportunities, revenue streams,
   estimated revenue, daily cost, emergency stop, autonomy posture.
2. **What changed?** — `whatChanged`: the 5 most recent world observations
   (provenance-carrying, per-owner).
3. **What opportunities exist?** — the world-model opportunity pipeline
   (control-plane lifecycle + Brain opportunities, deduped, evidence-exposed).
4. **What problems require attention?** — `attention` items (emergency stop,
   unconfirmed autonomy settings, HIGH-risk opportunities, opportunities that
   require approval).
5. **What should VedMoulya do next?** — ADVISORY ONLY: the briefing proposes
   attention lines; the founder decides. `hasContent:false` → the caller must
   NOT notify (no-spam, same discipline as the proactive briefing).
6. **What could generate revenue?** — revenue streams + estimated monthly
   revenue (evidence-only).
7. **What can be automated?** — advisory automation % per stream + the
   AUTOMATE/SCALE decision hints in `RevenueIntelligence.decide`.
8. **What requires founder approval?** — `pendingApprovals` from the pipeline
   (approvalRequired, never APPROVED) — the existing approval authority decides.

**Advisory first, always**: `advisory:true` on the briefing. No autonomous
financial commitment, no unauthorized external communication, no unauthorized
business creation.

## 3. Multi-business architecture (Part C)

1 founder · N businesses · N workspaces · N workflows · N customers · N
providers · N capabilities — with strict isolation:

| Boundary            | Mechanism (existing, reused)                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| Founder ↔ owner     | gateway JWT + central `assertUserIdMatchesSession` (IDOR)                                      |
| Business ↔ business | `BusinessUnit` is owner-scoped; revenue streams link to a `businessUnitId` (never cross-owner) |
| Workspace           | every world store keyed `(owner, key)` — one owner per logical workspace                       |
| Workflow ↔ workflow | `BusinessWorkflow` owner-scoped + bounded (24 steps)                                           |
| Customer data       | represented as world entities with provenance — never cross-owner                              |
| Providers           | registry is the ONLY catalog; workflow steps name capabilities/roles                           |
| Cost                | CostLedger + CostPolicyGuard + RunBudgetGuard remain authoritative                             |
| Memory              | world artifacts never promote into preferences/outcomes/learning                               |

Each business can eventually have identity, mission, goals, customers,
workflows, permissions, budget, providers, memory, metrics, revenue, expenses
and audit history — the SPRINT-032 `BusinessUnit` already carries identity,
purpose, target customer, offerings, workflows, opportunities, costs, revenue,
KPIs, automation level, AI capabilities, human responsibilities and approval
requirements. **No premature future infrastructure was built** — the isolation
mechanism that exists today is sufficient and tested.

## 4. Autonomy model (Part H)

The existing autonomy levels (0–5) and authorization model are preserved
unchanged (control-plane `AutonomySettings` + Fabric `AutonomyPolicy` +
emergency stop). SPRINT-033 documents the boundary vocabulary mapped onto
them:

| Stage                    | What it means                                             | Existing authority                                        |
| ------------------------ | --------------------------------------------------------- | --------------------------------------------------------- |
| OBSERVE                  | read-only composition (briefing, pipeline, snapshot)      | world-model ports (read-only)                             |
| RECOMMEND                | advisory proposals (briefing, decision hints, blueprints) | `advisory:true` everywhere                                |
| ASK                      | class-C sensitive actions request approval                | ActionClassPolicy → existing approval authority           |
| EXECUTE-APPROVED         | low-risk work after explicit approval                     | existing execution bridge + RunBudgetGuard                |
| AUTONOMOUS-WITHIN-POLICY | level ≥ threshold, within explicit policy/budget          | control-plane settings + CostPolicyGuard + emergency stop |

**Invariants (structural, tested):**

- Sensitive actions NEVER silently transition into execution — a blueprint's
  class-C step has an approval gate ONLY the existing authority clears.
- Every important action has policy, scope, owner, audit, budget and
  rollback/failure handling (the existing authorities provide them).
- No voice-only authorization, no hidden execution, no autonomous spending.

## 5. The operating layer (final principle)

The product advantage is NOT copying ChatGPT/Claude/Gemini/Grok/Cursor. The
advantage is the controlled pipeline:

```
AI PROVIDERS → CAPABILITIES → INTELLIGENCE FABRIC → BRAIN → WORKFLOWS
→ BUSINESSES → REVENUE → OUTCOMES → LEARNING → BETTER DECISIONS
```

SPRINT-033 adds the two missing representations in that chain that the
repository justified: **revenue** (evidence-carrying streams + advisory
decisions) and the **founder briefing** (the control surface for decisions).
Everything else was already built and is reused.

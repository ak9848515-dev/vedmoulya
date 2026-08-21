# SPRINT-029 — Authorization Model

> **Sprint:** SPRINT-029 — Proactive Intelligence & Automation Fabric
> **Date:** 2026-08-13/14
> **Status:** IMPLEMENTED + TESTED

---

## 1. Principle

**AI may proactively THINK, DISCOVER, ANALYZE and PREPARE. AI must NOT grant itself
authority. Existing authorities remain the source of truth.**

The proactive layer classifies candidate actions so the platform knows what may be
proposed and what class of authorization a proposal would need — it does **not** decide
approval. The actual approval decision always belongs to the existing approval authority.

## 2. The A/B/C/D classification (`domain/ActionClassPolicy.ts`)

| Class                              | Meaning                                                                                                       | Examples                                                                                | Runs                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **A** — Safe                       | analysis, drafting, classification, summarization                                                             | summarize, classify, analyze, draft, research, extract, transcribe                      | may run without per-run approval; still owner-scoped and rate-limited |
| **B** — User-authorized automation | approved recurring reports / workflows / data transformations                                                 | anything non-sensitive the user explicitly authorized                                   | runs only under explicit user authorization                           |
| **C** — Approval required          | external publishing, external messages, financial spending, account creation, business launch, config changes | anything matching the frozen `SENSITIVE_ACTIONS`                                        | the existing approval authority decides each time                     |
| **D** — Never automate             | prohibited or unsafe actions                                                                                  | delete-account, prohibited, unsafe, impersonate, bypass-security, grant-self-permission | always refused; never proposed                                        |

## 3. Authorities composed (not duplicated)

- **Sensitive vocabulary**: the Brain's `SENSITIVE_ACTIONS` — the exact same authority
  the `VoiceIntentGate` and `BrainPolicyEngine` use. One vocabulary, three consumers.
- **Irreversible actions**: the capability marketplace's irreversible-action vocabulary
  (advisory via `AutomationBoundaryEngine`).
- **Approval**: the existing Brain approval authority (decision store). Nothing in this
  sprint approves.

## 4. The three non-authorizations

1. **Silence is NOT approval** — a proposal with no explicit user decision never runs.
2. **Voice is NOT authorization** — carried over from SPRINT-027/028; the proactive
   layer has no voice path at all.
3. **AI-generated plans are NOT authorization** — a recommendation's `recommendedWorkflow`
   is a proposal, not a grant.

## 5. Enforced at every boundary

- `proactive.accept` on a class-C recommendation returns `APPROVAL_REQUIRED` (403
  envelope, `proactiveCode: 'APPROVAL_REQUIRED'`) — the proactive layer cannot
  self-authorize. Tested through the real tRPC pipeline.
- `AutomationDiscovery` never proposes class D; class C workflows are proposed with
  `authorizationRequired: true`.
- The recommendation model records `authorizationRequired` and fail-closed `riskLevel`
  (sensitive → HIGH unless evidence says otherwise).
- The UI shows an explicit "Approval" chip on class-C cards and disables the accept
  button ("Approval required — cannot accept here").
- Gateway: every `proactive.*` procedure is behind `standardProcedure`
  (authMiddleware + rate limit) and the central IDOR guard (`input.userId` must equal
  the session user).

## 6. Decision traceability

- `ActionClassDecision` records `actionClass`, `reasons` and the `authority` that
  informed the decision (`SENSITIVE_ACTIONS | IRREVERSIBLE_ACTIONS | SAFE_VERBS |
NEVER_AUTOMATE | DEFAULT`) — every classification is explainable and auditable.
- The user can see why a recommendation needs approval (evidence list + approval chip).

## 7. Verification

- `ActionClassPolicy.test.ts` 7/7: sensitive → C, never-automate → D (even with
  recurring intent), safe verbs → A, defaults → B, empty action → D, proposable set.
- `AutomationDiscovery.test.ts` 7/7: class C / D behavior at the workflow level.
- `ProactiveRouter.test.ts`: `accept` on a sensitive recommendation is refused;
  cross-user `userId` throws "not authorized" (IDOR) before the handler.
- Structural guarantee: `ProactiveIntelligenceService` exposes **no** method that
  grants approval, spends money, executes, or mutates another owner's records.

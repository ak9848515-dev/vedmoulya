# SPRINT-030 — Security Report

> Security posture of the Intelligence Fabric. Status: 🟢 IMPLEMENTED +
> TESTED — no new attack surface, no authorization bypass, no secret exposure.

---

## 1. Threat model (how each threat is met)

| Threat                                 | Mitigation                                                                                                    | Where proven                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Prompt injection from provider output  | Provider output is DATA, never AUTHORITY; verification chain + normalization                                  | `ResultNormalizer` redacts secrets; `VerificationChainPolicy` marks disagreement |
| Malicious provider response            | Normalized error kinds; `retryable:false` for malformed; never directly executed                              | `ResultNormalizer.test.ts`                                                       |
| Provider attempting to extract secrets | Secret redaction in normalized output; credentials stay server-side                                           | `ResultNormalizer.test.ts`                                                       |
| Model attempting to bypass approval    | Class C/D → existing approval authority; autonomy gate never grants execution                                 | `AutonomyPolicy.test.ts`, `FabricRouter.test.ts`                                 |
| Cross-workspace access                 | Owner scoping: every `fabric.*` procedure IDOR-checks `userId === caller`                                     | `FabricRouter.test.ts`                                                           |
| Unauthorized provider access           | Registry remains the only catalog; Fabric is read-only over it                                                | bridge-port tests                                                                |
| Fake provider health                   | `UNKNOWN` until real observations; health derived from observations only                                      | `ProviderHealthLedger.test.ts`                                                   |
| Fabricated cost                        | Cost measured from trace spine; zero-spend → `undefined`, never 0                                             | `FabricBridgePorts.test.ts`                                                      |
| Infinite workflow loop                 | `WorkflowBounds` + verification-chain hard termination                                                        | `WorkflowBounds.test.ts`, `VerificationChainPolicy.test.ts`                      |
| Unbounded provider fan-out             | `MAX_PARALLEL_FANOUT` + `MAX_PROVIDER_CALLS` fail closed                                                      | `WorkflowBounds.test.ts`                                                         |
| Runaway automation                     | Autonomy levels 0–5; nothing above level 2 acts without existing approval; class D never                      | `AutonomyPolicy.test.ts`                                                         |
| Excessive notifications                | Cadence hook only refreshes recommendations (no-spam rule inherited from SPRINT-029 `DailyBriefingAssembler`) | cadence tests                                                                    |

## 2. Non-negotiable invariants (enforced + tested)

1. **VOICE ≠ AUTHORIZATION** (SPRINT-027/028, structural tests unchanged)
2. **MODEL OUTPUT ≠ AUTHORIZATION** — `classifyAutonomy` returns a gate
   decision, never an execution grant
3. **PROVIDER RESPONSE ≠ DIRECT EXECUTION** — normalized results are data;
   execution passes the existing authority
4. **SILENCE ≠ APPROVAL** — class B requires an explicit `userAuthorization`
   record; the autonomy level alone never grants it
5. **PRIVACY OVERRIDES COST** — PRIVATE tasks never route to remote providers
   on price alone

## 3. Credential hygiene

- Provider credentials remain server-side (env `VOICE_*` / provider registry);
  never in client bundles, never logged, never in prompts, never returned by
  `fabric.*` (verified — the router returns only health/cost/selection data).
- The Fabric holds **no credentials at all** — it composes the registry, which
  owns secrets.

## 4. Tenant / owner isolation

- Every `fabric.*` procedure runs through `standardProcedure` (auth +
  rate-limit) and asserts `input.userId === ctx.userId` before touching any
  store.
- The Fabric domain itself is stateless except the per-owner health ledger
  instance created in `ApiApplicationService` composition; gateway access is
  owner-checked.
- Cost snapshots are owner-scoped (`ledger.compute(…, { userId })`).

## 5. Adversarial tests added

- Malicious provider output with embedded `sk-…` secret → redacted
- Provider failure → honest `UNAVAILABLE`/empty candidates (never fake health)
- Zero spend → `undefined` (never fabricated 0)
- Class B without authorization record → blocked even at level 5
- Class C at level 3 → ASK (approval still required)
- Workflow with fan-out 9 against max 8 → blocked
- Verification disagreement → `NEEDS_REVIEW`
- Invalid zod input on gateway procedures → rejected
- Unknown level / unknown state → honest fallback, never crash

## 6. Security-relevant verification

| Gate                               | Result                   |
| ---------------------------------- | ------------------------ |
| Full suite                         | 8 613 passed / 1 skipped |
| Lint (`eslint . --max-warnings=0`) | 0 / 0                    |
| Typecheck                          | 0                        |
| Coverage gate                      | 43 / 43                  |
| `next build`                       | PASS                     |

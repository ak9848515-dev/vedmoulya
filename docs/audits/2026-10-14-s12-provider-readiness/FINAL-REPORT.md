# VedMoulya — S12 Provider Readiness (Blocker B): Live AI Provider Verification Audit

**Date (UTC):** 2026-10-14
**Branch:** `main` · **HEAD:** `a124274b0d1fa91f361e0a5775e144658405913a` (unchanged)
**Scope:** S012-B audit only — no paid provider call made, no production config changed, no secret printed.
**Safety:** no reset, clean, revert, stage, commit, push, tag, or deploy. All five stashes preserved. All pre-existing work untouched.

---

## Verdict: **BLOCKED** (operator-owned: billing credits)

Live verification cannot be claimed: both verifiers exit non-zero without funded credentials by construction, and no funded credential exists here. This report closes the ambiguity — exact commands, implementation, config-vs-credential-vs-billing distinction, mock-exclusion proof, cost envelope, handoff. **S12 remains NO-GO** until every mandatory gate passes.

---

## 0. Baseline and preservation

| Item          | State                                                                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch / HEAD | `main` / `a124274b0d1fa91f361e0a5775e144658405913a` (before and after; unchanged)                                                                                                           |
| Stashes       | 5/5 preserved (`pre-security-baseline-healthprobe`; 3× lint-staged backups; WIP release-candidate-v1.0.0)                                                                                   |
| Tree          | Sprint 026 baseline + S12-4A set + S12-A report untouched; sole addition is this report directory                                                                                           |
| Evidence read | `BLOCKER-REPORT-S12-PRODUCTION.md` · sprint-026 `FINAL-REPORT.md` · sprint-012 checklist (§B) · S12-A report · deployment guide · provider-runtime registry · both verifier scripts in full |

---

## 1. Exact verification commands and implementation

- `npm run ai:production:verify` (`scripts/ai-production-verify.ts`): OpenAI via Vercel AI SDK `VercelAIProvider` (`ai@7`), model `OPENAI_PRODUCTION_MODEL` default `gpt-4o-mini`, plus `OpenAIEmbeddingProvider`. §§A–H: auth+availability (`AUTH_OK`, model id) · token accounting + budget bounds · routing explanation · structured-output schema check · grounding honesty · error normalization on a labelled deterministic flaky-mock · streaming stages · telemetry. `liveCalls` printed; exit 0 iff `failures===0`. No key → exit **2** (`LIVE VALIDATION BLOCKED`, never fabricated). Billing/quota message → exit **3** with billing steps; other errors → exit 1. Only the 7-char key prefix logged.
- `npm run ai:critique:verify` (`scripts/ai-critique-verify.ts`): same provider/model through `AICritiquePort` (`AIOrchestratorSpecialistPort`); deterministic `VisualCriticEngine` baseline always runs first. No key → exit **2**; unreachable/quota/error → `provider:'none'` → exit **3**; success requires an executed critique (`provider !== 'none'`), evidence-first finding shape, non-negative cost. Merge-honesty (§3, no port → deterministic unchanged) always runs.

Last recorded outcome (Sprint 012, NOT re-run here — a re-run would spend a billed call if credits existed): **both exit 3** — auth + model negotiation succeeded, the real call refused for no billing credits; critique 4/5 implementation checks with live blocked.

---

## 2. Configuration vs credential vs billing vs generation vs critique

Five gates; only the last two spend money. (a) **Configuration:** `AI_DEFAULT_PROVIDER=openai` names a runtime-eligible family (`validateDefaultProvider`; catalog-only defaults hard-fail). (b) **Credential presence:** `AI_OPENAI_API_KEY` (canonical, ≥32 chars, non-placeholder) or legacy `OPENAI_API_KEY` — verifiers read legacy `OPENAI_API_KEY` directly; the gateway resolves canonical-first (`resolveOpenAIKey()`). Presence → registry `CONFIGURED`, proves nothing about funds. (c) **Billing:** credits on the account — proven only by a 200-class completion. (d) **Non-mocked generation:** production-verify exit 0 with `liveCalls > 0`, non-empty content, `tokenUsage` in/out > 0, `cost > 0`. (e) **Critique:** critique-verify exit 0 with `provider !== 'none'` and an executed critique. Sprint 012 stopped at (c): (a)+(b) held, OpenAI reached, billing refused.

---

## 3. Mock/fallback exclusion evidence

- **Verifiers never silently mock:** neither script registers `MockProvider` for live sections (`VercelAIProvider` built directly from the key); absent key exits 2/3 before orchestration — fabrication structurally impossible. The only mocks (`ai-production-verify` §F) are labelled deterministic harnesses for retry/timeout normalization, never counted in `liveCalls`.
- **Production registry:** `readProviderRuntimeState()` reports `MOCK` only with `AI_ENABLE_MOCK=true` in strict modes, else `DISABLED` ("never silent"); `registerPlatformProviders()` registers mock-alone under the flag, real adapters otherwise (mock absent by default in prod). The suite contract test ("registry agrees with registration") pins registry≡registration.
- **Health honesty:** `VercelAIProvider.getHealth` reports key-presence only, no network probe; `/health/ready` gates on DB `SELECT 1`, never provider health. `CONFIGURED` is never presented as generation evidence.

---

## 4. Billing, cost, and safety controls

- **Billing requirement:** funded OpenAI account (credits/payment method). Quota refusal is classified exit 3 (operator step), never a pass — so a no-credit run both proves reachability and refuses success.
- **Bounded spend per run:** production-verify caps (32/256/24/64/1500 output tokens; 2000–8000 input); critique-verify caps (1500 out / 8000 in). At `gpt-4o-mini` pricing a full pass costs single-digit cents; both scripts print per-call tokens + `$cost`.
- **Safe preflight (spends nothing):** `npm run ai:smoke` — hermetic 26-check pipeline (mock provider + embeddings) proving implementation without credentials. Executed this session: **exit 0, 26/26 passed**. `services/orchestrator` typecheck: clean. These prove implementation, never live billing/generation — and are not claimed as such.
- **Secret handling:** verifiers log a 7-char prefix only; diagnostics redact key-shaped strings; this report contains no credential.

---

## 5. Operator handoff (prerequisites + expected evidence)

**Owner:** Account Operator owning the OpenAI billing account (Sprint 012 records UNASSIGNED). No one in this checkout can perform these steps.

1. Fund the OpenAI account (credits/payment method) holding the key.
2. In the operator shell (never committed): `export OPENAI_API_KEY=sk-…` (real key; `AI_OPENAI_API_KEY` equivalent for the gateway) + `export AUTH_JWT_SECRET=<strong secret>` + optionally `OPENAI_PRODUCTION_MODEL=gpt-4o-mini`.
3. Run `npm run ai:production:verify` → expect exit **0**, `✅ PRODUCTION AI VERIFICATION PASSED`, non-zero `liveCalls`, §§A–H all ✓. Exit 3 → still no credits (re-fund, re-run); exit 2 → key absent; exit 1 → implementation defect (file it, do not fund around it).
4. Run `npm run ai:critique:verify` → expect exit **0** with an executed live critique (`provider: openai`, findings shaped, cost printed).
5. Record both transcripts (check counts, `liveCalls`, token/cost lines, model id) as the S012-B closure evidence in a follow-up audit note. Do not paste the key.

---

## 6. Confirmed code gaps and narrowly scoped recommendations

- **No credential-affecting defect found.** Two documentation-level observations, fixable without credentials, billing, or production access (proposed, not applied — out of audit scope): (i) the verifier scripts read legacy `OPENAI_API_KEY` while the gateway prefers canonical `AI_OPENAI_API_KEY` (`resolveOpenAIKey()` covers both, and the S12-B handoff sets a key satisfying both — no functional gap, but aligning the scripts to `resolveOpenAIKey()` would remove the dual-variable cognitive load); (ii) `MockProvider` in `ai-production-verify` §F is correctly labelled, but a one-line comment asserting "these checks never increment `liveCalls`" would make the live-vs-harness accounting grep-able.
- **Not gaps:** placeholder rejection (<32 chars → `ERROR`), catalog-only families failing fast as default, mock `DISABLED` by default in production — all verified as fail-closed by existing tests.

---

## 7. Preservation confirmation; S12 disposition

HEAD `a124274b0d1fa91f361e0a5775e144658405913a`; 5/5 stashes intact; no stage/commit/push/tag/deploy/reset/clean/revert; no secret printed; no paid call made (verifiers inspected, never executed against a key — no key exists here); sole addition is this report directory. Safe checks executed: `ai:smoke` exit 0 (26/26), orchestrator typecheck clean, core config-contract suite 15/15 (from the S12-A session, same HEAD).

**Explicit statement: S12 remains NO-GO until every mandatory release gate is satisfied with authorized evidence.** Live AI provider readiness is NOT claimed — both verifiers remain BLOCKED on funded billing credits (last result: exit 3 / exit 3, Sprint 012).

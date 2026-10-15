# VedMoulya — S12 Blocker B: Live Provider Acceptance Journey (real completions)

**Date (UTC):** 2026-10-15
**Branch:** `main` · **Base HEAD:** `f1dbce7f` (nothing committed by this run; the temporary driver is gitignored)
**Scope:** execute the live provider acceptance journey for **S012-B** and report only what actually happened. No production system contacted, no configuration changed, no credential printed, persisted or transmitted anywhere but the provider's own API.
**Cost envelope:** ~14 requests: 3 model-list GETs and 11 completions capped at `max_tokens = 5`. No long-form generation.

---

## Verdict

**Split, and both halves are real.**

| Requirement (as written in `BLOCKER-REPORT-S12-PRODUCTION.md` §2)                 | Verdict                                                                                            |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `scripts/ai-production-verify.ts` exits 0                                         | **STILL BLOCKED** — exit 3, live provider answered: _"You have no credits remaining."_             |
| `scripts/ai-critique-verify.ts` exits 0                                           | **STILL BLOCKED** — exit 3, live critique did not execute                                          |
| _"Confirmation of non-mocked cloud token generation (real provider completions)"_ | **NOW VERIFIED** — 3/3 consecutive real Google Gemini completions, HTTP 200, non-empty answer text |

The two named verifier scripts are hardcoded to OpenAI, and that account has no billing credits. The **capability** the blocker paragraph actually describes — a real, non-mocked cloud completion — is now demonstrated through the repository's own provider path on a different funded family.

**This does not close S012-B as written.** The blocker's evidence requirement names those two scripts, and both still fail. What changed is that "no cloud provider can be shown to generate" is no longer true, and the remaining gap is narrowed to _an OpenAI account with credits_, not to provider integration.

---

## 1. Method — the repository's own live path, not a bespoke curl

Both halves of the journey run the exact production functions the provider UI uses to decide whether a provider is connected (`services/api/src/services/ProviderConnectionTester.ts`):

1. `testProviderConnection({ family })` — a real `GET` against the provider's own model-list endpoint (auth + reachability), returning the provider's **reported** model ids (never invented).
2. `validateProviderGeneration({ family, modelId })` — **one real completion** with `max_tokens = 5` and the prompt `Reply with the single word: ok`, performed only on a model the probe itself reported. This is the step that makes "connected" honest, and it emits a credential-free diagnostic record (`generation_success` / `generation_http_error` / `generation_empty_response` / `generation_network_error`).

Driver: `scripts/_provider-live-acceptance.ts` (temporary; gitignored by the existing `/scripts/_*.ts` rule, so it is not part of any commit). Run as:

```bash
npx tsx --env-file=.env.local scripts/_provider-live-acceptance.ts          # all families
LIVE_FAMILIES=google LIVE_MODEL_OVERRIDE=gemini-3.5-flash-lite \
  npx tsx --env-file=.env.local scripts/_provider-live-acceptance.ts        # one model
```

`--env-file` is required because the verifier scripts read `process.env` and the repository's `.env.local` is not auto-loaded outside the web app. Credentials are read through the repository's own resolver, so the result describes _this deployment's_ configuration rather than a hand-picked key.

---

## 2. Results — per family

| Family       | Probe (`GET /models`)                        | Live generation                   |
| ------------ | -------------------------------------------- | --------------------------------- |
| `google`     | ✅ connected — 46 models reported            | ✅ **real completions** (see §3)  |
| `openrouter` | ✅ connected — 462 models reported           | ❌ HTTP **401** `invalid_api_key` |
| `openai`     | ❌ HTTP **401** `invalid_api_key` (0 models) | ⛔ not attempted (probe failed)   |

### 2.1 The two documented verifiers (OpenAI)

```text
$ npx tsx --env-file=.env.local scripts/ai-production-verify.ts
Provider: openai · Model: gpt-4o-mini · key sk-proj… (never printed)
✓ provider registered + configured
ℹ LIVE VALIDATION BLOCKED (provider quota) — the call reached the real provider
  and authentication/model negotiation succeeded, but the account has no
  billing credits.
Provider response: AI_APICallError: You have no credits remaining. Add credits
  to continue using the API at https://platform.openai.com/settings/organization/billing/.
exit 3

$ npx tsx --env-file=.env.local scripts/ai-critique-verify.ts
4/5 implementation checks passed
✗ live AI critique executed against the real provider — AI critique unavailable
  (deterministic evaluation stands)
exit 3
```

Note what this _does_ prove: the OpenAI credential authenticates and the model is negotiated — the request reached the provider and was refused for funding. The failure is a billing state, never an integration defect, and the script says so rather than fabricating a live result. The critique run also shows the deterministic `VisualCriticEngine` still producing its 4/5 implementation checks with the live leg absent — no silent substitution of the deterministic path for a live one.

### 2.2 Gemini — the successful journey

`gemini-3.5-flash-lite`, three consecutive attempts, unedited diagnostic lines:

| Attempt | HTTP | Classification       | candidatePresent | contentPartPresent | answerLength | latencyMs |
| ------- | ---- | -------------------- | ---------------- | ------------------ | ------------ | --------- |
| 1       | 200  | `generation_success` | true             | true               | 2            | 8617      |
| 2       | 200  | `generation_success` | true             | true               | 2            | 5374      |
| 3       | 200  | `generation_success` | true             | true               | 2            | 16662     |

`answerLength: 2` is the model answering the literal prompt `Reply with the single word: ok` — real response text, not an empty envelope.

Model sweep (one attempt each, `requested` only after the probe reported the id):

| Model                      | Live generation                               |
| -------------------------- | --------------------------------------------- |
| `gemini-3.5-flash`         | ✅ ok (12.9 s, cold)                          |
| `gemini-3.5-flash-lite`    | ✅ ok (1.7 s) — and 3/3 on repeat             |
| `gemini-flash-lite-latest` | ✅ ok (2.2 s)                                 |
| `gemini-flash-latest`      | ✅ ok (3.0 s; one transient HTTP 503 earlier) |
| `gemini-2.5-flash-lite`    | ❌ HTTP 404 `not_found`                       |
| `gemini-pro-latest`        | ❌ HTTP 429 `rate_limited`                    |

---

## 3. Findings that are not only about this blocker

1. **The OpenRouter probe is a false positive with an invalid credential.** `testProviderConnection('openrouter')` reports `connected: true` and "462 models available" while the credential is rejected by the very next real request (HTTP 401). OpenRouter's `GET /api/v1/models` is a **public** catalogue endpoint: it authenticates nothing. The family's `runtimeNote` therefore claims _"this deployment has a server-managed OpenRouter credential — AI execution is live"_ when execution is not live. The repository's two-step design (probe, then generate) contains the damage — the UI's "connected" verdict comes from the generation validation — but the probe result on its own is wrong, and any caller that trusts `connected` alone is misled. A credential-checking endpoint (OpenRouter's own `/api/v1/key`) or gating "connected" on the generation step for aggregator families would remove the false positive. **Not fixed here** (it changes user-facing provider state and belongs with the provider-UX owner).
2. **The local `.env.local` has a credential/​slot mismatch.** `AI_OPENROUTER_API_KEY` is 164 characters and starts `sk-pro…` — the shape of an **OpenAI project key** (`sk-proj-…`), not an OpenRouter key (`sk-or-v1-…`), and OpenRouter rejects it with 401. Conversely `AI_OPENAI_API_KEY` is a 31-character **placeholder** (`sk-test…`), so the OpenAI family resolves a placeholder and 401s, while the shell carries a _different_, real-but-unfunded `OPENAI_API_KEY`. Two ids are effectively swapped/unusable. Reported because a "no credential configured" diagnosis would have been wrong for these families — the credentials exist, they are the wrong ones.
3. **`ListModels` advertising a model is not proof it can be generated.** `gemini-2.5-flash` and `gemini-2.5-flash-lite` appear in the 46-model list but return HTTP 404 on `generateContent` for this key, while the 3.x generation models answer normally. A provider UI that populates its model dropdown from the list endpoint can therefore offer a model that cannot serve a request. This is consistent with a model-surface/API-version difference on the key's project rather than a defect in this repository, but it is exactly the kind of gap the generation validation exists to catch — and it did.
4. **A `-latest` alias is not a stability guarantee.** `gemini-flash-latest` returned HTTP 503 `UNAVAILABLE` on one attempt and 200 on the next. Any operator guidance that names a `-latest` alias as the production model should expect this; a pinned version is the safer default.

---

## 4. What remains BLOCKED, and the exact prerequisite

| Item                                                                               | Status       | Prerequisite                                                                                                     |
| ---------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------- |
| `ai-production-verify.ts` exit 0                                                   | **BLOCKED**  | Credits on the OpenAI account used by `OPENAI_API_KEY` (script is OpenAI-hardcoded)                              |
| `ai-critique-verify.ts` exit 0                                                     | **BLOCKED**  | Same credential                                                                                                  |
| Live cloud generation, capability-level                                            | **VERIFIED** | — (Google Gemini, 4 models, 3/3 on repeat)                                                                       |
| Live generation on the **deployment's own default family** (`AI_DEFAULT_PROVIDER`) | **VERIFIED** | `AI_DEFAULT_PROVIDER` resolves to the Google family in this `.env.local`, and Google is the family that answered |

An operator could close S012-B in either of two ways: fund the OpenAI account (the literal requirement), or accept the Gemini evidence and re-point the two verifier scripts at a family this deployment can actually pay for. The second is a code change and an owner decision, not a credential.

---

## 5. Limitations stated plainly

- Only three families were exercised (`google`, `openrouter`, `openai`). Anthropic and DeepSeek have **no** credential in this environment (the family also has no execution adapter here) and were not tested.
- The completions are **5-token validation prompts**, not workload generation. They prove the provider answers and the credential/route works; they are not a quality, throughput or cost claim.
- No streaming, structured-output or embedding path was exercised live.
- The successful family is the one this checkout already had a funded credential for. **Nothing here shows that production has one.**
- The temporary driver is gitignored and uncommitted; this report is the durable artifact.

---

## 6. Preservation

No commit, push, tag, deploy or configuration change. No file outside `scripts/_*.ts` (gitignored) and this report was created. No credential value appears in this report, in the driver, or in any command output it quotes — keys are referred to by family, shape and length only. No production system or account setting was touched; the only outbound traffic was to the providers' own documented endpoints.

# NEXT-FIX-PROMPT.md — Single Recommended Next Fix

> **Status (G-05G, 2026-10-10): COMPLETED.** The G-01 fix described below has been implemented in the working
> tree (`OpenAICompatibleProvider.ts:128` returns `configured ? 'healthy' : 'down'`; regression test
> `OpenAICompatibleProvider.test.ts:148-160`, 23/23 pass). This prompt is retained as the historical record of the
> recommendation. The next highest-value open item is **G-02** (`GAP-REGISTER.md`).

> Chosen from confirmed evidence: **G-01 — repo-wide typecheck/build is red** because the uncommitted
> provider-health change returns a status value outside `ProviderStatus`. It is a **P1 build/CI blocker**,
> its root cause is confirmed, and the correct fix is **XS** and behavioural-preserving.

Copy everything between the rules into a coding agent.

---

## OBJECTIVE

Restore repo-wide `npm run typecheck` (and therefore CI/build) to green **without weakening the health-status
honesty improvement** that the current uncommitted change introduces, by mapping the "provider not configured"
case to a value that already exists in the `ProviderStatus` union.

## CONFIRMED ROOT CAUSE (do not re-investigate from scratch)

- `services/orchestrator/src/providers/OpenAICompatibleProvider.ts:115-131` returns
  `status: configured ? 'healthy' : 'unhealthy'`.
- `packages/ai/src/types/index.ts:45` defines
  `export type ProviderStatus = 'healthy' | 'degraded' | 'unstable' | 'down';`
- `'unhealthy'` is not a member ⇒ `npm run typecheck` fails with `TS2322` at `OpenAICompatibleProvider.ts:125`.
- The same provider interface is `ProviderHealth` (`packages/ai/src/types/index.ts:151`).

## INSPECT FIRST (read-only)

- `services/orchestrator/src/providers/OpenAICompatibleProvider.ts` (the uncommitted change; `getHealth`, `isHealthy`).
- `packages/ai/src/types/index.ts` (`ProviderStatus`, `ProviderHealth`).
- Sibling adapters for the established convention: `OpenAIProvider.ts`, `DeepSeekProvider.ts`,
  `GoogleGeminiProvider.ts`, `OllamaProvider.ts`, `MockProvider.ts` — how do they express "not configured"?
- `services/orchestrator/src/providers/__tests__/OpenAICompatibleProvider.test.ts` (the new tests added with
  the change — they pass; make sure they still do).

## PROTECT THE WORKING TREE (mandatory)

- Run `git status --short` and `git diff --stat` first and preserve all existing Revenue/Mission work,
  `_rev001-live/`, `_rev002a-live/`, `_rev004a-live/`, `docs/audits/`, scripts, probes, and reports.
- **Do NOT** run `git reset`, `git clean`, `git restore`, or `git stash`. Do NOT stage, commit, or push.
- Do NOT reformat unrelated files. Change only the minimum required files.

## REQUIRED IMPLEMENTATION BEHAVIOUR

1. In `OpenAICompatibleProvider.getHealth()`, replace the out-of-union `'unhealthy'` with an **existing**
   `ProviderStatus` value that truthfully means "cannot serve": use `'down'`.
2. Keep the honesty semantics: configured → `'healthy'` (errorRate 0); not configured → `'down'` (errorRate 1).
3. If (and only if) the sibling adapters establish a different existing convention, follow that convention
   and state why.
4. Do **not** invent a new status value and do **not** widen `ProviderStatus` unless you first show that no
   existing member is truthful (then stop and explain before doing it).
5. Update the code comment to reference the real vocabulary.

## REGRESSION TESTS & ACCEPTANCE CRITERIA

- Add/extend a test asserting `getHealth().status` is a member of `ProviderStatus` for **both** a configured and
  an unconfigured instance (configured → `'healthy'`; unconfigured → `'down'`), and that `errorRate` and
  `isHealthy()` stay consistent.
- Acceptance: `npm run typecheck` exits 0; the provider test file passes; no other test regresses.

## EXACT VERIFICATION COMMANDS (record exit codes)

```
git status --short
git diff --stat
npx vitest run --root services/orchestrator
npm run typecheck
npx eslint services/orchestrator/src/providers/OpenAICompatibleProvider.ts services/orchestrator/src/providers/__tests__/OpenAICompatibleProvider.test.ts
npx prettier --check services/orchestrator/src/providers/OpenAICompatibleProvider.ts services/orchestrator/src/providers/__tests__/OpenAICompatibleProvider.test.ts
```

## OUT OF SCOPE (do not do here)

- Do not rename or broaden `ProviderStatus`; do not touch the marketplace/fabric provider-status vocabularies
  (that is separate work — G-05).
- Do not change other providers, routing, health ledgers, or the provider matrix docs (G-02 is a separate fix).
- Do not run live cloud-provider calls.
- Do not "fix" anything else to make lint/tests pass.

## REQUIRED FINAL REPORT

- Exact files changed (with line refs) and why.
- The status value chosen and justification against `ProviderStatus`.
- Output of every verification command **with exit codes** (do not filter away failures; preserve exit status).
- Confirmation `git status` still shows all pre-existing work intact and nothing staged/committed/pushed.
- If `npm run typecheck` still fails elsewhere, quote the exact remaining error(s) verbatim.

## STOP CONDITION

If, after inspection, no existing `ProviderStatus` member truthfully represents "not configured" (i.e. the
honest fix would require changing the union), **stop and report** the options and impact instead of changing
the union or inventing a value.

---

### Why this is the highest-value next fix

It is the only **confirmed** defect that makes the _whole tree_ fail a first-class gate (`npm run typecheck`,
hence CI/build and any deploy — roadmap P0.1). It is bounded (one function + one test), preserves the intent of
the in-flight honesty change, and unblocks every subsequent roadmap item (G-06 email, G-07 deployment, G-16 live
providers). Every alternative candidate is either larger (G-06/G-07) or unverified (G-08–G-11).

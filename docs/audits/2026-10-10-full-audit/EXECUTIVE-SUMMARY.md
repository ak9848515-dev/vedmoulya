# VedMoulya — Full Engineering / AI / UX / Revenue Audit — Executive Summary

- **Audit date:** 2026-10-10
- **Auditor:** Codebuff (automated, read-only audit)
- **Repository:** `ak9848515-dev/vedmoulya` (local clone at `D:/VedMoulya`)
- **Branch / HEAD at audit start:** `main` @ `bdbe6111dbb1e596540ff5b783d74f869d44690c` (tracking `origin/main`)
- **Scope:** source, tests, configuration, and the acceptance evidence already present in the tree. No source files were modified; no expensive live-provider work was re-run.

> **Uncertainty:** scores below are audit judgments, not measurements. They rest on the evidence cited in `AUDIT-EVIDENCE.md`; several dimensions could not be fully verified in a bounded read-only pass (flagged as _missing evidence_).

---

## 1. Scores

| #   | Dimension                                | Weight | Score |
| --- | ---------------------------------------- | -----: | ----: |
| 1   | Architecture & code quality              |    15% |   6.5 |
| 2   | End-to-end functional integrity          |    15% |   7.5 |
| 3   | AI intelligence & provider orchestration |    15% |   7.0 |
| 4   | Mission autonomy & recovery              |    10% |   7.5 |
| 5   | Security & privacy                       |    15% |   7.0 |
| 6   | Persistence & data integrity             |     5% |   6.5 |
| 7   | UX & usability                           |    10% |   6.0 |
| 8   | Tests & regression confidence            |     5% |   7.0 |
| 9   | Production readiness                     |     5% |   5.5 |
| 10  | Revenue delivery readiness               |     5% |   7.5 |

**Weighted overall = 6.9 / 10** (0.975 + 1.125 + 1.050 + 0.750 + 1.050 + 0.325 + 0.600 + 0.350 + 0.275 + 0.375 = **6.875 → 6.9**).

**Separate UX score = 6.0 / 10** (source-based; no fresh browser session was performed).

---

## 2. Critical blockers (shown regardless of average)

> **Reconciliation (G-05G, 2026-10-10):** **G-01 is now fixed** in the working tree
> (`OpenAICompatibleProvider.ts:128` returns `'down'`; union-membership regression test at
> `OpenAICompatibleProvider.test.ts:148-160`, 23/23 pass). It is retained in this table as the historical
> record of what blocked shipping at audit time. **No score below was changed** for this fix — the score is an
> audit judgment of the audit-time tree, and unit-level fixes do not by themselves establish deployed-runtime
> correctness (see `HEALTH-CONTRACT-AUDIT.md` §11.3). G-02 remains open.

| ID   | Sev    | Status @G-05G | Blocker                                                                                                                                                                                                             | Evidence                                                                                                                                                                                                 |
| ---- | ------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G-01 | **P1** | **Fixed**     | Repo-wide `npm run typecheck` **fails (exit 1)** on the uncommitted provider-health change: `status: 'unhealthy'` is not in `ProviderStatus`. Any CI/build gate that runs it is red.                                | `npm run typecheck` → `services/orchestrator/src/providers/OpenAICompatibleProvider.ts(125,5) TS2322`; union at `packages/ai/src/types/index.ts:45` = `'healthy' \| 'degraded' \| 'unstable' \| 'down'`. |
| G-02 | **P1** | Open          | Provider runtime state is documented as **catalog-only** for Google/OpenRouter/Ollama, but the code registers and executes them (Ollama proven live). Documentation drift → users cannot trust "connection status". | `README.md` ("catalog-only… UNSUPPORTED_RUNTIME") vs `services/orchestrator/src/index.ts:219,244` (Google/Ollama registered) and the fresh Ollama run in `_rev004a-live`.                                |

No **P0** (security/authorization/data-loss/fabricated-success) blocker was confirmed in this pass. See `GAP-REGISTER.md` for P0 candidates that remain _unverified_ rather than confirmed.

---

## 3. What genuinely works end to end (evidence-backed)

- **Real opportunity → verified artifact → approval-gated delivery draft.** `REVENUE-004A` fresh run (real local Ollama, `qwen2.5-coder:7b-instruct`): Mission **COMPLETED**, objective **VERIFIED** (`agent_execution_verification`), all four governed steps verified (aggregate → author → governed write + exact read-back → deterministic narrative consistency check), **independent verification PASS**, draft `pendingApproval: true`, `submitted: false`, 0 cloud tokens, 0 mock. Evidence: `.rev004a-live-run.log`, `_rev004a-live/`.
- **M2 delivery draft** with read-back from ClientOps: `_rev002a-live/m2-delivery-verification.txt` (objective VERIFIED, `pendingApproval: true`, `submitted: false`, no external action).
- **API gateway, identity, and core engines pass their own suites** (this audit): `services/api` 1842 pass / 5 skip; `services/identity` 425; `packages/world-model` 310; `packages/mission-runtime` 170; `packages/agent-execution` 108 — all exit 0.
- **Governed tool posture** is real: capability → allowlist → schema → timeout → rate-limit → audit, path-jailed workspace tools, per-step tool allowlist, IDOR guard on `userId` inputs.

---

## 4. What is implemented but NOT runtime-proven

- **Cloud providers** (OpenAI / DeepSeek / Google / OpenRouter): adapters + unit tests exist and are registered, but no live cloud execution is in the evidence (the only fresh live run used local Ollama with 0 cloud tokens).
- **Voice STT/TTS**, **live world signals**, **Blueprints with external side effects**: implemented behind ports, marked operator-required.
- **Durable Postgres persistence** beyond identity: repositories exist; full restart/backup/restore drills are roadmap P1.5 (not reproduced in this audit).
- **Deployed/staging environment (P0.1)**: `docker-compose.yml` + CI exist; no deployed-environment evidence.

---

## 5. Current capability statement

The platform is a **wide, coherently-layered monorepo** (47 packages, 9 services, 63 web routes, 49 API routers, 982 test files) whose **mission/revenue spine is genuinely functional on a local provider** and whose **governance boundaries are real rather than cosmetic**. Its main risks are **breadth without verification** (many subsystems with A/B/C evidence and little live proof), **documentation drift vs code**, and **operational readiness** (no staging, build gate red in the working tree).

## 6. Next action (single highest-value fix)

**Fix G-01** — make the uncommitted provider-health change type-correct by using the existing `ProviderStatus` vocabulary (map "not configured" to `'down'`, not the invented `'unhealthy'`), restoring `npm run typecheck` / CI to green while preserving the honesty improvement. Executable prompt: [`NEXT-FIX-PROMPT.md`](./NEXT-FIX-PROMPT.md).

> **Reconciliation (G-05G, 2026-10-10):** **G-01 has since been fixed** in the working tree, with a
> union-membership regression test (`OpenAICompatibleProvider.test.ts:148-160`). The next highest-value open item
> is therefore **G-02** (provider-matrix documentation drift). This section is retained as the audit-time
> recommendation; see `GAP-REGISTER.md` for the current status column.

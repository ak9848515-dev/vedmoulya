# CODE-QUALITY-SECURITY-AUDIT.md

> Static source review + test evidence + reused runtime evidence. **Not** a penetration test and **not** a
> security certification. Each finding is tagged **[confirmed]** or **[hypothesis / unverified]**.

---

## A. Confirmed code-quality findings

### CQ-01 — Build gate red from an out-of-union provider status **[confirmed, P1 — NOW FIXED, see reconciliation note]**

> **Reconciliation (G-05G, 2026-10-10):** fixed. `OpenAICompatibleProvider.ts:128` now returns
> `configured ? 'healthy' : 'down'`; regression test `OpenAICompatibleProvider.test.ts:148-160` (23/23 pass,
> exit 0). Finding retained as the historical record.

- **Where:** `services/orchestrator/src/providers/OpenAICompatibleProvider.ts:115-131`.
- **Evidence:** `npm run typecheck` → exit 1, `TS2322` at `:125`. `status: configured ? 'healthy' : 'unhealthy'`
  but `ProviderStatus = 'healthy' | 'degraded' | 'unstable' | 'down'` (`packages/ai/src/types/index.ts:45`).
- **Note:** `tsc -b` alone returned exit 0 while `tsc --noEmit -p services/api` (which re-checks the source
  graph) found it — an **incremental-build masking** hazard: a project-reference build can report green while a
  consumer project is red.
- **Impact:** CI/`npm run typecheck` fails; publishing this tree is blocked.
- **Smallest fix:** map the unconfigured case to the existing `'down'` (or `'unstable'`) and add a test
  asserting the returned `status` is a member of `ProviderStatus`.

### CQ-02 — Documentation drift on provider runtime state **[confirmed, P1→P2]**

- **Where:** `README.md` ("Anthropic, Google, OpenRouter and Ollama are catalog-only (UNSUPPORTED_RUNTIME)"),
  `09_Documents/EPIC_019_PROVIDER_RUNTIME_MATRIX.md` vs `services/orchestrator/src/index.ts:219` (Google),
  `:244` (Ollama), `:226` (OpenRouter).
- **Evidence:** code registers + routes all three; `_rev004a-live` executed via Ollama live.
- **Impact:** Journey B truthfulness — a user/operator cannot rely on documented connection state.

### CQ-03 — Oversized modules / low cohesion hotspots **[confirmed, P2]**

- `services/api/src/services/RouterRegistry.ts` — **7,003 lines** (single largest source file).
- `apps/web/src/lib/api-client.ts` — 4,901 lines.
- `services/api/src/services/ApiApplicationService.ts` — 3,150 lines; `packages/services/src/ai/AIOrchestrationService.ts` — 2,027.
- **Impact:** review/edit risk, merge conflicts, unclear ownership.
- **Smallest fix:** extract cohesive router groups / client namespaces behind existing barrels — incremental,
  behaviour-preserving.

### CQ-04 — Competing provider-status vocabularies **[confirmed, P2 — investigated; recommendation refined]**

- `packages/ai/src/types/index.ts:45` `ProviderStatus = 'healthy'|'degraded'|'unstable'|'down'`
- `packages/services/src/marketplace/MarketplaceDTO.ts:127` `ProviderStatus = 'active'|'inactive'|'error'|'configuring'`
- `packages/intelligence-fabric/src/types/fabric-types.ts:22` `ProviderHealthState = UNKNOWN|HEALTHY|DEGRADED|UNAVAILABLE|MISCONFIGURED`
- **Impact:** three sources of truth for "provider state"; invitations to mis-map (CQ-01 is an instance).

> **Reconciliation (G-05G, 2026-10-10) + refinement:** investigated in depth by
> [`HEALTH-CONTRACT-AUDIT.md`](./HEALTH-CONTRACT-AUDIT.md) (nine provider-status vocabularies; routing/UI-class
> fail-open seams F-R1/F-R2/F-U1) and [`F-U2-STATUS-OWNERSHIP-AUDIT.md`](./F-U2-STATUS-OWNERSHIP-AUDIT.md)
> (four `ProviderStatus` axes, proven import-isolated). **The "three" count is a lower bound, and the reading
> "define one canonical type" is rejected** — the four concepts are four different axes. The live-honesty instance
> (CQ-01/G-01) is fixed; the latent seams F-R1/F-R2/F-U1 are now fail-closed; the naming/rename work is deferred. **Severity stays P2.**

### CQ-05 — Test-suite wall-clock exceeds the bounded audit window **[confirmed, P2]**

- `npx vitest run` (all workspaces) **did not produce a summary within 600 s**; only per-workspace runs
  completed (see `AUDIT-EVIDENCE.md`).
- **Impact:** slow feedback; CI cost; harder regression isolation. Not a correctness defect.

### CQ-06 — Repository hygiene / scratch artifacts at root **[confirmed, P3]**

- Many untracked root files: `_*.log` (build/lint/test/run logs), `.rev004a-gate.{ts,mjs,err}`, `.tmp-*.mjs`,
  `packages/mission-runtime/{compiled,.out,.rev004a-probe.ts}`.
- **Impact:** noisy root; risk of committing logs. (Preserved, not deleted, per audit rules.)

### CQ-07 — Dead/placeholder adapters and TODO density **[hypothesis, P3]**

- 15 source files contain `TODO/FIXME/HACK/XXX`. 2 tests are skipped.
- Not individually triaged in this pass; listed for follow-up, **not** asserted broken.

---

## B. Security review

### Confirmed controls (positive)

- **Authentication:** real JWT HS256 verification, issuer/audience/type checked
  (`services/api/src/middleware/auth.ts`). Fail-closed `authenticateRequest`.
- **IDOR guard:** `assertUserIdMatchesSession` rejects mismatched `userId` input (central in the gateway).
- **OAuth CSRF:** server-minted `state`, only SHA-256 hash stored, single-use, 10-min TTL
  (`services/identity/src/auth/OAuthState.ts`).
- **Governed tools:** capability → allowlist/denylist → schema validation → timeout → rate-limit → audit
  (`packages/services/src/ai/runtime/ToolRuntime.ts`); workspace tools resolve through an operator-held root
  binding (path jail, no absolute paths, no `..`); per-step tool allowlists; command execution is an
  allowlisted catalog, not a free shell.
- **Human boundary:** delivery is a **draft** with `pendingApproval: true`; no auto-submit/contact/payment.

### Gaps / unverified

- **SEC-01 [unverified, P2]** Credential **encryption at rest, rotation, and deletion** semantics were not
  exercised. `.env.local` present locally (gitignored) with cloud keys + DB URLs; **no values were read or
  printed during this audit**.
- **SEC-02 [unverified, P2]** **Data retention/deletion** (roadmap P0.4 privacy/data lifecycle) — not
  confirmed implemented end-to-end.
- **SEC-03 [unverified, P2]** **Distributed rate limiting** (roadmap P0.5) — an in-memory rate limiter is the
  default; multi-instance correctness unproven.
- **SEC-04 [hypothesis, P3]** SQL-injection surface inside `RouterRegistry.ts` (7,003 lines) not exhaustively
  reviewed; the repo claims zod validation + parameterized repos, which was **not** re-proven here.
- **SEC-05 [unverified, P2]** Backup/restore/DR (roadmap P1.5) — no drill evidence.

> No **P0** security/authorization/data-loss/fabricated-success blocker was **confirmed** in this pass. Note
> that the revenue path's independent verification and the "never claim money received" rule are _designed in_
> and were observed working (REVENUE-004A); this is strong counter-evidence to a fabricated-success P0.

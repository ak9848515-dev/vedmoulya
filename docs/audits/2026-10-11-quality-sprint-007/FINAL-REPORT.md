# VM-QUALITY-SPRINT-007 — Final Evidence Report

**Date:** 2026-10-11  
**Repository:** `D:/VedMoulya`  
**Accepted starting score:** 7.3 / 10 (Sprint 005 weights retained)

## 1. Baseline and preservation

At Step 0, branch was `main`, HEAD `ddb0f192`, with `origin/main` 15 commits behind and none ahead. The tracked worktree was clean. Existing `_sprint3-live/`, `_sprint5-live/`, `_sprint6-live/` evidence and all five stashes were preserved. No push was made. Existing unrelated generated/user files were not staged.

Sprint 006 recorded 972 files / 12,910 tests, lint, typecheck and dependency-cycle gates passing. Its local-provider Brain browser run failed at the disabled Publish action; its mission acceptance and managed-database writes had not been established.

## 2. D-08a: live Brain approval journey

### Root cause

The UI correctly keeps approval controls unavailable while pipeline execution is busy. The browser test treated an intermediate `PARTIAL` badge, an empty result shell, or “No role assignments yet” as terminal. In the real run, those appeared while Execute remained busy and Cancel was disabled. The test proceeded to the approval panel before execution had settled.

A second provider-selection issue made the journey brittle: capability marketplace candidates could include providers without registered execution adapters. The Brain candidate port now filters candidates against the actual runtime registry, so unavailable cloud catalogue entries cannot be assigned as executable candidates. Runtime configuration also previously ignored `AI_ENABLE_MOCK=false` in development. The runtime registry and orchestrator now honor explicit false, allowing a real local provider to run without the deterministic mock.

### Changes and evidence

- `apps/web/e2e/brain.spec.ts` now requires recorded nonzero provider output, waits for task settlement via the live busy control, scopes assertions to the active task, and exercises both Approve and Reject. Approval only records consent; no publish/submission was performed.
- Added regression coverage for filtering unregistered providers, explicit mock disablement, and local Ollama registration without the mock.
- Fresh Chromium run with `AI_ENABLE_MOCK=false`, Ollama only, and `qwen2.5-coder:3b`: **1 passed (6.6 minutes)**. Runtime `ai_usage_events` showed four successful Ollama calls with that model. See [browser log](evidence/brain-e2e-ollama.log).
- The test does not use arbitrary sleeps or force-enable controls. Its larger timeout accommodates local inference and cold model loading.

The displayed static marketplace model label may differ from the selected local runtime model; runtime usage evidence, rather than that label, establishes the actual model used.

## 3. Mission acceptance and provider evidence

The fresh Brain run establishes real Ollama generation and approval behavior. The separate canonical Mission acceptance harness did **not** pass: it wrote the expected artifact byte-exactly using two governed tool calls, and usage evidence showed Ollama `qwen2.5-coder:3b` with two successful events (260 local tokens), but the Mission ended `FAILED` / `FAILED_FINAL`, objective `PENDING`, with no verification evidence after a command exited with code 1. This remains an unresolved Mission execution/verifier defect; no canonical Mission acceptance is claimed. Full log: [Mission harness](evidence/live-mission-acceptance-ollama.log).

## 4. D-11a / D-11c: managed PostgreSQL write and readback

An explicitly namespaced, idempotent probe was inserted into Neon `memory_registry` (`collection=vm_sprint007_persistence_probe`, ID `brain-ojaggymg`) and independently read back. The record matched expected `userId`/`ownerId` (`e2e-user`), mission key and test status. The insert used `ON CONFLICT DO NOTHING`; no update, delete, migration, or unrelated-user query was performed. Default DNS resolution failed for the hostname during the independent read attempt; resolving the exact hostname through a public resolver and retaining TLS hostname verification allowed the independent connection/read to succeed. Evidence: [readback JSON](evidence/neon-write-read.json).

This proves one controlled write and independent readback, not backup/restore, process-crash durability, or recovery acceptance.

## 5. D-11b: retry/backoff decision

Inspection of `WriteThroughDocumentStore` found a synchronous in-memory mirror and bounded async write-through queue, idempotent owner/key upserts, deduplication, failure logging/requeue, and flush on later activity or lifecycle shutdown. The existing same-store transient recovery test and focused persistence suite cover recovery on a later flush. There is no timed retry/backoff.

No automatic retry was added: the current contract is best-effort async persistence with explicit flush, and no automatic eventual-write SLA is defined. A volatile in-memory queue can still lose pending writes if the process exits before another retry/flush; this remains a limitation if stronger durability is required.

## 6. Regression gates

| Gate | Result |
| --- | --- |
| Focused Brain, API, provider runtime, orchestrator and write-through Vitest | 6 files, 242 tests passed |
| Live Ollama Brain Chromium journey | 1 passed; real Ollama usage verified |
| Mock Brain browser journey | 1 passed |
| `npm run deps:cycles` | Passed; 57 workspaces |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed; 58 scopes, 0 failed |
| `npm test -- --maxWorkers=4 --reporter=dot` | Passed; 972 files, 12,913 tests |
| Targeted Prettier check on changed source/test files | Passed |
| `npm run format` | Failed only on four pre-existing untracked Sprint 3 Markdown evidence files; preserved untouched |

The full-suite, lint, typecheck and dependency-cycle logs are retained under `_sprint7-live/`.

## 7. Score and roadmap

Sprint 005 weights and Sprint 006 dimension scores are retained. The Brain approval behavior and provider evidence improved materially, but canonical Mission acceptance failed, persistence automatic retry and recovery drills remain unverified, and the formatting gate remains blocked by pre-existing user evidence. The overall score therefore remains **7.3 / 10**; this sprint does not claim a score increase.

G-17 / orchestration-fabric remains deferred. `mission.*` remains the autonomous lifecycle; `brain.*` remains reusable intelligence. External submission stays behind human approval. No credentials or environment files were committed.

## 8. Commits

Source fixes and regression coverage are in the first Sprint 007 commit. This report and its copied evidence are in the second Sprint 007 commit. Neither commit was pushed.

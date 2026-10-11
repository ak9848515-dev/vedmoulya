# STEP 2 — Fresh local-provider mission acceptance

**Provider:** REAL local Ollama — `qwen2.5-coder:7b-instruct` (`local=true`).
**Harness:** the repository's existing operator harness
`scripts/live-mission-acceptance.ts` (drives the REAL gateway composition
`ApiApplicationService → MissionService → MissionRuntime`; no mocked AI, tools,
verification, memory or accounting).
**Route:** cloud keys blanked for the child process (`AI_OPENAI_API_KEY=`,
`AI_GOOGLE_API_KEY=`, `AI_OPENROUTER_API_KEY=`, … empty strings are _defined_, so
the harness's `.env.local` loader does not restore them) and
`AI_OLLAMA_MODEL=qwen2.5-coder:7b-instruct` pinned (the built-in default
`llama3.2` is not installed). `AI_ENABLE_MOCK=false`.

## 1. Complete-path result (fresh mission `mission_mv3hetrj_1`, local Postgres)

| Stage               | Evidence                                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| USER GOAL → MISSION | objective: _"Create a file named mission-acceptance.txt with exact contents VEDMOULYA_MISSION_ACCEPTANCE_OK"_; `CONTROLLED_AUTONOMOUS` |
| PLANNING            | plan steps `step-1`, `step-2` — each `status=completed verified=true`                                                                  |
| REAL LOCAL PROVIDER | `provider=ollama model=qwen2.5-coder:7b-instruct local=true`; `inputTokens=95 outputTokens=93 total=188`                               |
| GOVERNED EXECUTION  | `tools=2` through the governed tool runtime                                                                                            |
| VERIFICATION        | objective state **VERIFIED**, method `agent_execution_verification`, evidence `run outcome: ACHIEVED`                                  |
| DURABLE PERSISTENCE | local PG row `state=COMPLETED outcome=ACHIEVED`, `1` checkpoint row `state=VERIFIED` (see §3)                                          |
| MEMORY / LEARNING   | **not evidenced** — 0 new durable learning rows (see §4, honest gap)                                                                   |
| RESULT              | artifact `mission-acceptance.txt` = byte-for-byte `VEDMOULYA_MISSION_ACCEPTANCE_OK` (31 bytes)                                         |
| HUMAN APPROVAL      | delivery **DRAFT** created, `pendingApproval=true`; external submission **NO** (see §5)                                                |

Harness lifecycle events (excerpt):

```
OBJECTIVE_STARTED   Objective running: Create a file named mission-acceptance.txt … VERIFIED
OBJECTIVE_VERIFIED  … (agent_execution_verification)
CHECKPOINT_SAVED    Checkpoint saved after verified objective: obj_mv3hetrj_2
final state : COMPLETED   outcome : ACHIEVED
provider    : ollama      model   : qwen2.5-coder:7b-instruct   tokens : 188
```

Usage identity (no secrets): `{"source":"MISSION","provider":"ollama",
"model":"qwen2.5-coder:7b-instruct","local":true,"totalTokens":188,"status":"success"}`.
Aggregate board: `cloud tokens : 0`, `local tokens : 188` → **real local generation,
zero cloud usage**.

## 2. Fresh mission on the Neon route (`mission_mv3hq08s_1`) — harness PASS

A third fresh mission run with the default `.env.local` (mission persistence on the
managed Neon route) printed:

```
final state : COMPLETED   outcome : ACHIEVED
provider    : ollama      model   : qwen2.5-coder:7b-instruct   tokens : 116
cloud tokens : 0          local tokens : 116
════ RESULT ════  LIVE MISSION ACCEPTANCE: PASS
```

All ten harness sections executed, including Control Center and the UI-truth check.
The mission row persisted to Neon as **`COMPLETED`**.

## 3. Database-backed persistence is actually exercised

Queried independently of the runtime (fresh connections), not inferred from logs:

| Run (fresh mission)  | DB target        | Mission row            | Checkpoints for mission |
| -------------------- | ---------------- | ---------------------- | ----------------------- |
| `mission_mv3hetrj_1` | local PG `:5432` | `COMPLETED / ACHIEVED` | **1 × `VERIFIED`**      |
| `mission_mv3hq08s_1` | Neon pooler      | `COMPLETED / ACHIEVED` | 0 (write failed, §6)    |
| `mission_mv3h8wkl_1` | Neon pooler      | `RUNNING` (stale, §6)  | 0 (write failed, §6)    |

So the mission + checkpoint documents are written to, and read back from, a real
PostgreSQL — no in-memory substitute anywhere in the persistence path. (The
harness's _usage ledger_ is deliberately an in-memory store local to the harness;
it is observability data, not mission persistence.)

## 4. Honest gap — memory / learning

`MissionService` wires durable execution learning to
`PostgresMemoryRepository` over the mission's database (`memories` table). After
these runs the `memories` table had **0 rows** and the memory registry had **no new
rows** (latest seed rows are from 2026-08-20). The wiring is present and observable
by design (`onPersistenceFailure` logs, never fabricates a save), but a clean
single-objective success **produced no durable learning entry**. Reported as an
**open gap**, not as a pass.

## 5. Human approval is mandatory; external submission is disabled

Using the repository's existing `MissionClientOpsHandoffService` (the same service
the `mission.deliver` tRPC mutation calls) against `mission_mv3hetrj_1`:

```
mission mission_mv3hetrj_1 state COMPLETED verified 1
delivery.ok true
pendingApproval true
created true
external submission performed: NO
```

A VERIFIED outcome yields a **DRAFT** that stays `pendingApproval` forever — it is
never submitted, no client is contacted, no payment is claimed.

## 6. Blocked / degraded stages (not claimed as passing)

- **Neon write-through is intermittently unavailable from this host**:
  `getaddrinfo ENOTFOUND ep-solitary-glade-ayxd6iny-pooler…neon.tech` queued the
  checkpoint write for retry; `mission_mv3h8wkl_1`'s final mission save was lost
  (row left `RUNNING`) and `mission_mv3hq08s_1`'s checkpoint was not flushed. The
  local-Postgres route (`mission_mv3hetrj_1`) persisted both mission and checkpoint.
  This is a **network/environment** limitation of the managed route, surfaced
  honestly — durable persistence is proven on the real local PostgreSQL.
- **Memory/learning** (§4) — no durable entry for a clean success.

**Not claimed:** complete end-to-end success for _every_ stage — memory/learning
remains unproven, and the managed-Neon durability is intermittent.

# Step 4 — Real AI Provider Reliability Evidence

Three claims are separated, per protocol: **fail-closed health**,
**reachability**, and **actual generation**.

## A. Bounded adapter probe (fresh, real)

Probe through the real adapters (`services/orchestrator/src/providers/`):

| Claim                        | Command result                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Keyless adapter fails closed | `OpenAICompatibleProvider('' , …).getHealth().status = **down**` (never 'healthy')                            |
| Local reachability           | `OllamaProvider.getHealth().status = **healthy**`                                                             |
| Actual generation            | `OllamaProvider.execute(...)` → `model=qwen2.5-coder:7b-instruct`, `content="PONG"`, latency ≈ 26.96 s (cold) |

Ollama daemon: `http://localhost:11434` reachable; `qwen2.5-coder:7b-instruct`
installed. Cloud keys were **not** printed (presence only); the developer's
`.env.local` contains key **names** for OpenAI/Google/DeepSeek/OpenRouter/Ollama.

## B. Fresh real-provider mission acceptance (local Ollama route)

Command (cloud keys explicitly blanked to force the local route):
`AI_ENABLE_MOCK=false AI_OPENAI_API_KEY= AI_GOOGLE_API_KEY= AI_DEEPSEEK_API_KEY=
AI_OPENROUTER_API_KEY= AI_OLLAMA_BASE_URL=http://localhost:11434
MISSION_WORKSPACE_ROOT=_sprint3-live/mission-ws npx tsx
scripts/live-business-mission-acceptance.ts`
Evidence: `.sprint3-live-ollama.log`.

Result — the mission **functionally passed every acceptance criterion**:

| Criterion               | Observed                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| Mission state / outcome | `COMPLETED` / `ACHIEVED`                                                                       |
| Objectives              | **3/3 VERIFIED** (`agent_execution_verification`)                                              |
| Governed tools          | `workspace_write: 6`, `workspace_read: 16`                                                     |
| Artifacts on disk       | `packages-inventory.md`, `dependency-audit.md`, `release-signoff.md` — present + exact content |
| Independent cross-check | `PUBLISHED AUDIT IS FACTUALLY CORRECT: true`, node checker exit 0                              |
| Checkpoints             | 3                                                                                              |
| Execution memory        | 4 entries persisted                                                                            |
| Usage ledger            | 5 events, **563 local tokens / 0 cloud**, secret scan clean, other-owner events 0              |
| Negative test           | `NEGATIVE TEST CORRECT: true` (mission must not falsely succeed)                               |
| Harness overall exit    | **1**                                                                                          |

### Why the harness exited 1 (honest analysis — harness artifact, not a product defect)

The only failing predicate is `identityOk`. It requires every AI-usage event for
the fixed script owner to belong to the _current_ mission. The durable ledger
still held **2 events from an earlier interrupted run** of the same script (same
fixed owner id, mission `mission_mv3cdaza_1`), so `identityOk=false`. All other
predicates (`state COMPLETED`, `outcome ACHIEVED`, all objectives VERIFIED,
ordering, artifacts, reality match, node exit 0, checkpoints ≥ 3, memory > 0,
events > 0, `cloud.executions === 0`, other-owner events 0, negative test) passed.
No source change or data deletion was performed to force a green result.

## C. Honest fallback / failure semantics observed

- Keyless/empty **OpenAI** adapter still registered and was routed first; it
  failed with `reason=internal_error` and the runtime logged
  `Falling back to next AI provider` → **Ollama succeeded**. All-real-provider
  failure never fabricated success.
- **Observation (P3, efficiency):** a configured-but-failing provider is retried
  and routed before fallback on each request, burning a call each time. Honest,
  but a routing-quality item (prior sprint SPRINT-088 territory).
- Mock was **not** selected on the local route (`AI_ENABLE_MOCK=false`).

## D. Cloud providers

No live cloud generation was performed: `AI_GOOGLE_API_KEY` etc. are present in
the developer's `.env.local` (names only verified), but this audit did not use
them for generation (the first attempt routed to Google and timed out — evidence
`.sprint3-live-cloud-first.log` — so the local route was used deliberately).
Cloud reachability/generation remains **unverified**.

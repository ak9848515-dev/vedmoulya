# SPRINT-037 — OPERATOR ACTIVATION

How an operator genuinely activates the first real-world execution loop. Nothing here silently simulates production execution — without the configured pieces the system reports OPERATOR-REQUIRED and `integration:provider` exits non-zero.

## 1. Configure a REAL provider

The runtime registers real providers through the existing provider architecture (no hardcoded credentials, nothing in the browser bundle):

```bash
# Canonical production variable (validated by @vedmoulya/core)
export AI_OPENAI_API_KEY=sk-...
# Legacy fallback accepted by the runtime resolution (same as ai:smoke:live)
# export OPENAI_API_KEY=sk-...
# Required by @vedmoulya/core config
export AUTH_JWT_SECRET=<strong secret>
```

Verify with the existing checks:

```bash
npm run doctor          # startup diagnostics
npm run production:config-check   # honest configuration matrix
```

A provider is **AVAILABLE** only after a REAL successful call establishes runtime evidence — credentials alone are never claimed as availability (the fabric health ledger starts UNKNOWN; `voice.status` and `signalHealth` stay honest the same way).

## 2. Run the live integration test

```bash
npm run integration:provider
```

What it does (all REAL authorities, identical composition to the gateway):

1. Registers **only** the real `VercelAIProvider` — no mock, no fallback. Without a key it exits **2** with an explicit message.
2. Builds the REAL provider registry (seeded catalog includes OpenAI), the REAL Intelligence Fabric (`createFabricProviderPort`), the REAL Brain, the REAL world model, and the REAL `ExecutionRunService` with the orchestration-aware plan source.
3. Drives the §4 safe workflow: **plan** (`world.orchestratePlan`, BALANCED) → **approve** (`world.approveOrchestrationPlan` through the Brain) → **execute** (the existing `ExecutionRunService` → `createStepExecutionPort` → real provider) → **verify** (run StepVerifier) → **outcome** (run status + step dispositions).
4. Enforces **strict cost/time limits** (defaults: $0.50 max cost, 120 s max latency, 8k tokens, 10 iterations — env-tunable via `AI_EXECUTION_MAX_*` only by explicit operator decision).
5. Emits a machine-readable JSON summary on success.

The workflow is INFORMATION/ANALYSIS only: research a business opportunity and produce a structured recommendation. No financial transaction, no external communication, no irreversible action, no self-authorization.

## 3. What a non-zero exit means

| Exit | Meaning                                                                | Action                                                 |
| ---- | ---------------------------------------------------------------------- | ------------------------------------------------------ |
| 2    | No real key configured                                                 | Configure §1, re-run                                   |
| 1    | Provider unhealthy / plan failed / approval refused / run not verified | Read the printed reason; fix config or inspect the run |

## 4. Multi-provider live comparison

If TWO or more real providers are configured, the operator can extend the workflow steps (per-step capabilities bind to configured providers through the fabric). With only one provider the honest status is **MULTI-PROVIDER LIVE TEST = OPERATOR-REQUIRED** — never fabricated.

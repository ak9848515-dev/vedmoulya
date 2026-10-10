# AI Orchestrator Governance & Architecture

**Version:** 1.0  
**Status:** Governance target; runtime coverage must be verified per execution path  
**Owner:** AI Platform Team  
**Created:** 2026-08-01  
**Updated:** 2026-08-16  
**Implementation Seam:** `services/orchestrator`, `packages/ai`, `packages/intelligence-fabric`

---

## 1. Architectural Purpose

The AI Orchestrator is the shared control plane for the currently composed provider-generation path. It is intended to centralize provider selection, budgets, privacy policy, and bounded execution. This document does not claim that every intelligence subsystem is routed through one universal authority: production composition must be verified per path, and the orchestration-fabric provider-routing path remains deferred (G-17).

```
┌────────────────────────────────────────────────────────┐
│                   Application Layer                    │
│        (AI Mentor, Code Factory, Brain, Voice)         │
└───────────────────────────┬────────────────────────────┘
                            │ Typed AI Request DTO
                            ▼
┌────────────────────────────────────────────────────────┐
│                 services/orchestrator                  │
│  ┌───────────────────┐  ┌───────────────────────────┐  │
│  │ Rate & Cost Guard │  │  Deterministic Plan Critic │  │
│  └─────────┬─────────┘  └─────────────┬─────────────┘  │
│            ▼                          ▼                │
│  ┌──────────────────────────────────────────────────┐  │
│  │           Provider Routing & Selection           │  │
│  │     (CHEAP / FAST / QUALITY / PRIVATE / MOCK)    │  │
│  └─────────────────────────┬────────────────────────┘  │
└────────────────────────────┼───────────────────────────┘
                             │ Fail-Safe Execution
                             ▼
┌────────────────────────────────────────────────────────┐
│                   Provider Adapters                    │
│   ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│   │    OpenAI    │  │   DeepSeek   │  │ Mock Adapter│  │
│   │ (GPT-4o/mini)│  │  (V3 / R1)   │  │ (Hermetic)  │  │
│   └──────────────┘  └──────────────┘  └─────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 2. Selection Strategies (`packages/intelligence-fabric`)

When an AI capability request is submitted, the Orchestrator selects the optimal provider according to a deterministic strategy:

| Strategy       | Selection Logic                                                                              | Fallback Chain                                               |
| :------------- | :------------------------------------------------------------------------------------------- | :----------------------------------------------------------- |
| **`CHEAP`**    | Minimize monetary cost per 1k tokens while meeting minimum accuracy threshold.               | DeepSeek V3 → OpenAI GPT-4o-mini                             |
| **`FAST`**     | Minimize time-to-first-token (TTFT) and total latency for interactive UX (e.g., live voice). | OpenAI GPT-4o-mini → DeepSeek V3                             |
| **`QUALITY`**  | Maximize reasoning capability, architectural synthesis, and complex code generation.         | OpenAI GPT-4o → DeepSeek R1                                  |
| **`PRIVATE`**  | Data never leaves local runtime or sovereign tenancy. Prohibits public cloud routing.        | Local Host / On-Premise Engine (fails closed if unavailable) |
| **`BALANCED`** | Pareto-optimal balance of cost, speed, and accuracy for general user tasks.                  | OpenAI GPT-4o-mini                                           |

---

## 3. The Five Inviolable Guardrails

### Guardrail 1: Hard Cost & Token Ceilings

Every execution run is initialized with a non-negotiable budget envelope:

- `maxTokens`: Hard boundary on cumulative prompt + completion tokens.
- `maxCostUsd`: Dollar ceiling (e.g., \$0.05 for task execution).
- `maxTimeMs`: Timeout after which the provider call is aborted via `AbortSignal`.

### Guardrail 2: Deterministic Pre-Execution Critic

Before any agent-generated plan can touch the execution runtime (filesystem, shell, database), it must be inspected by a deterministic critic that verifies:

1. All tool arguments conform strictly to Zod schemas.
2. File paths are confined within the workspace root binding (jail check: no `..`, no absolute paths outside root).
3. Sensitive actions (Classes C & D) are paused for explicit human authorization.

### Guardrail 3: Privacy Overrides Cost

For any execution path that applies the `PRIVATE` policy, public-cloud fallback must be prohibited and an unavailable local/private provider must yield `NO_SELECTION` or `UNAVAILABLE`. End-to-end enforcement across all production paths remains to be verified.

### Guardrail 4: Hermetic Mock Testing

Outside production environments, the Orchestrator defaults to the in-memory mock engine (`MockAIProvider`), returning realistic, deterministic fixture responses. Unit tests and CI pipelines never incur token charges or require cloud API keys.

### Guardrail 5: Full Audit Provenance

Every executed call logs:

- `provider`: Model identifier and vendor.
- `tokens`: Prompt tokens, completion tokens, cached tokens.
- `cost`: Real observed cost computed from standard price tables.
- `durationMs`: Wall-clock execution time.
- `ownerId`: Enforced tenant boundary.

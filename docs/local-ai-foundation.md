# VedMoulya Local AI — Foundation (Phase 1)

Local AI runs models **on the user's own computer** through a local runtime.
Ollama is the first runtime implemented — it is **not** synonymous with "Local
AI". The foundation is designed so LM Studio, llama.cpp, vLLM, Jan or any
OpenAI-compatible runtime can be added later as an adapter, with no redesign of
the orchestration layer.

## Architecture

```
Browser (VedMoulya web app)
   │  HTTP (loopback)  ── Local Agent API
   ▼
VedMoulya Local Agent            ← runs on the user's computer
   │  Local Runtime interface
   ▼
Runtime adapter (OllamaRuntimeAdapter today)
   │  HTTP
   ▼
Ollama (127.0.0.1:11434)
   ▼
local model
```

Two boundaries matter:

1. **The cloud app never talks to Ollama.** A Vercel server cannot reach the
   user's `localhost`, so the browser talks to the **Local Agent** instead. The
   agent is a local process; it makes the Ollama request, which also removes
   browser CORS problems.
2. **Ollama is behind the runtime interface.** Nothing above
   `packages/local-ai/src/adapters/` knows Ollama's endpoints.

## Packages and files

| Path                                                          | Responsibility                                                     |
| ------------------------------------------------------------- | ------------------------------------------------------------------ |
| `packages/local-ai/src/types.ts`                              | `LocalRuntime` interface, model/generation types, error vocabulary |
| `packages/local-ai/src/states.ts`                             | The 10-state connection model and its derivation                   |
| `packages/local-ai/src/registry.ts`                           | Runtime adapter registration/selection                             |
| `packages/local-ai/src/adapters/ollama-runtime.ts`            | The Ollama adapter (all Ollama-specific detail)                    |
| `packages/local-ai/src/adapters/openai-compatible-runtime.ts` | OpenAI-compatible adapter (LM Studio, llama.cpp server, vLLM, Jan) |
| `packages/local-ai/src/adapters/http.ts`                      | Shared failure classification for every adapter                    |
| `packages/local-ai/src/agent/agent.ts`                        | The Local Agent service (status derivation, strict `verify`)       |
| `packages/local-ai/src/agent/server.ts`                       | Loopback HTTP API + CORS allow-list                                |
| `packages/local-ai/src/agent/cli.ts`                          | `npm run local-agent` entrypoint                                   |
| `apps/web/src/app/providers/local-ai-agent.ts`                | Browser client for the agent                                       |
| `apps/web/src/app/providers/use-local-ai-status.ts`           | The ONE live Local AI state hook (shared)                          |
| `apps/web/src/app/providers/LocalAiPanel.tsx`                 | The Local AI panel + the compact overview card                     |

## Local Runtime interface

```ts
interface LocalRuntime {
  readonly id: LocalRuntimeId; // 'ollama' | 'lm-studio' | …
  readonly displayName: string;
  capabilities(): LocalRuntimeCapabilities;
  discover(): Promise<RuntimeDiscoveryResult>; // is the runtime present?
  health(): Promise<RuntimeHealth>;
  listModels(): Promise<LocalModelListResult>;
  getModel(modelId: string): Promise<LocalModelDescriptor | null>;
  generate(request: LocalGenerateRequest): Promise<LocalGenerateResult>;
  stream(request: LocalGenerateRequest): AsyncIterable<LocalGenerateChunk>;
}
```

Every method is **total**: failures are typed results, never thrown surprises.

## Ollama adapter (verified API)

Checked against a running Ollama (0.34.4):

| Call    | Endpoint                          | Used for                     |
| ------- | --------------------------------- | ---------------------------- |
| version | `GET /api/version`                | `discover()`, `health()`     |
| models  | `GET /api/tags`                   | `listModels()`, `getModel()` |
| chat    | `POST /api/chat` (`stream:false`) | `generate()`                 |     | chat stream | `POST /api/chat` (`stream:true`, NDJSON) | `stream()` |

The agent exposes the streaming path at
`POST /runtimes/:id/stream` (NDJSON chunks), and the web panel's **Generate**
action renders the reply incrementally through it — the same Local Runtime
interface as the non-streaming path.

Model capabilities are `MEASURED` when Ollama reports them (its `/api/tags`
entries carry `capabilities`) and `INFERRED` otherwise.

### OpenAI-compatible adapter (LM Studio and friends)

The second runtime proves the interface is not Ollama-shaped. It implements the
same `LocalRuntime` contract against the OpenAI-compatible HTTP API:

| Call        | Endpoint                                         | Used for                                               |
| ----------- | ------------------------------------------------ | ------------------------------------------------------ |
| models      | `GET /v1/models`                                 | `discover()`, `health()`, `listModels()`, `getModel()` |
| chat        | `POST /v1/chat/completions` (`stream:false`)     | `generate()`                                           |
| chat stream | `POST /v1/chat/completions` (`stream:true`, SSE) | `stream()`                                             |

Default endpoint `http://127.0.0.1:1234` (LM Studio), id `lm-studio`. This API
exposes **no version** and **no declared capabilities**, so no version is
claimed and model capabilities are `INFERRED`. Both runtimes are registered by
the default agent; a runtime that is not running is reported as such, never as
an error.

## Connection states

`LOCAL_AGENT_NOT_RUNNING`, `LOCAL_AGENT_RUNNING`, `OLLAMA_NOT_RUNNING`,
`OLLAMA_UNREACHABLE`, `OLLAMA_INVALID_RESPONSE`, `OLLAMA_NO_MODELS`,
`OLLAMA_MODELS_FOUND`, `OLLAMA_MODEL_UNAVAILABLE`, `OLLAMA_GENERATION_FAILED`,
`OLLAMA_CONNECTED`.

A failure is never collapsed into "Ollama not installed": a **connection
refused** is `NOT_RUNNING`; a **timeout** is `UNREACHABLE`.

### OLLAMA_CONNECTED is strict

`verify` returns `CONNECTED` only when **all** hold:

1. the Local Agent is running,
2. Ollama is reachable,
3. its version answered,
4. the model catalog was read,
5. at least one model exists,
6. the selected model exists,
7. a **real generation** succeeded.

Anything less returns a narrower state, plus a per-condition `checks` list.

## Security boundary

The Local Agent is **only** an AI-runtime bridge for this phase:

- binds to `127.0.0.1` (never `0.0.0.0`),
- exposes only runtime discovery, model listing and generation,
- has **no filesystem API**, **no arbitrary command execution** and **no hidden
  remote-control mechanism**,
- imports no `node:fs`, no `node:child_process`,
- CORS is an explicit allow-list (an unknown origin gets no CORS header).

It never receives access to `C:\`, `D:\`, the home directory, browser data,
credentials, SSH keys or environment secrets.

**Not implemented yet** (future phases): workspace access, folder permissions,
file indexing, RAG, embeddings, MCP, local shell, coding agent, autonomous local
tools.

## Local development

1. Start Ollama (the app, or `ollama serve`).
2. Start the Local Agent:
   ```bash
   npm run local-agent
   ```
   Environment overrides:
   - `VEDMOULYA_LOCAL_AGENT_PORT` (default `43117`)
   - `VEDMOULYA_OLLAMA_URL` / `OLLAMA_BASE_URL` (default `http://127.0.0.1:11434`)
   - `VEDMOULYA_LM_STUDIO_URL` / `LM_STUDIO_BASE_URL` (default `http://127.0.0.1:1234`)
   - `VEDMOULYA_LOCAL_AGENT_ALLOWED_ORIGINS` (comma-separated, default local dev
     origins + the deployed app)
3. Open VedMoulya at `/providers` and use the **Local AI** panel: it shows the
   Local Agent, the runtime (Ollama), the discovered models and the connection
   state. Press **Connect local AI** to run the strict check.

Raw agent API (for debugging):

```bash
curl http://127.0.0.1:43117/health
curl http://127.0.0.1:43117/runtimes/ollama/status
curl -X POST http://127.0.0.1:43117/runtimes/ollama/verify
curl -X POST http://127.0.0.1:43117/runtimes/ollama/generate \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"Reply with the single word: ok"}]}'

# streamed generation (NDJSON chunks)
curl -N -X POST http://127.0.0.1:43117/runtimes/ollama/stream \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"Count to three."}]}'
```

## How the web app talks to the agent

`apps/web/src/app/providers/local-ai-agent.ts` probes
`http://127.0.0.1:43117` (then `http://localhost:43117`) and calls
`/health`, `/runtimes/ollama/status`, `/runtimes/ollama/verify` and
`/runtimes/ollama/stream`. Every call **never throws**: an absent agent is a
normal "not connected" result, so cloud AI keeps working and the app never
crashes.

One hook (`use-local-ai-status.ts`) owns the live connection state. The
`/providers` page calls it ONCE and passes the controller to both the full
Local AI panel and the compact **Local AI card on the AI Providers overview**,
so both surfaces always show the SAME measured state (no second probe, no
re-derived status).

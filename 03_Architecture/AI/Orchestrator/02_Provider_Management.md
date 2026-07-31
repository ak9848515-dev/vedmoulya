# Provider Management

**ARC-005 — Document 02/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief AI Orchestration Architect
**Created:** 2026-07-24
**Cross-references:** ARC-005/D01, PRD-001, ARC-001

---

## Purpose

Provider Management defines how AI providers are **registered, monitored, cataloged, versioned, and retired** within VedMoulya's orchestration architecture. Providers are interchangeable execution engines — Provider Management ensures they are always available, understood, and replaceable.

---

## Scope

This document covers the conceptual lifecycle and management of AI providers. It does NOT define specific provider SDKs, API integrations, authentication mechanisms, or configuration formats.

---

## Dependencies

- **ARC-005/D01** — AI Orchestration (overall orchestration context)
- **ARC-005/D03** — Capability Routing (uses provider capabilities)
- **ARC-005/D07** — Fallback & Resilience (uses provider health data)

---

## Provider Abstraction

Every AI provider, regardless of underlying implementation, is represented by a **conceptual provider abstraction**:

```
Provider
├── Identity (name, version, provider family)
├── Capabilities (what it can do)
├── Health (current status, latency, error rate)
├── Cost (per-token, per-request, budget)
├── Constraints (rate limits, context window, modality support)
└── State (enabled, disabled, deprecated, retired)
```

This abstraction ensures that no provider-specific details leak into the rest of the orchestration system.

---

## Provider Registration

### Registration Process

```
New Provider Discovered
        │
        ▼
Capability Declaration
        │
        ▼
Capability Mapping (to VedMoulya's capability model)
        │
        ▼
Health Baseline Establishment
        │
        ▼
Cost Profile Registration
        │
        ▼
Provider Added to Active Pool
```

### What Is Registered

| Attribute           | Description                 | Example                       |
| ------------------- | --------------------------- | ----------------------------- |
| **Provider ID**     | Unique internal identifier  | openai-gpt4o-2024-05          |
| **Provider Family** | Group or vendor             | OpenAI, Google, Anthropic     |
| **Version**         | Specific model version      | gpt-4o-2024-05-13             |
| **Capabilities**    | What this provider can do   | text-generation, code, vision |
| **Pricing model**   | How costs are calculated    | per-token, per-request        |
| **Context window**  | Maximum input context size  | 128K tokens                   |
| **Rate limits**     | Requests per minute/hour    | 500 RPM                       |
| **Latency profile** | Typical response time       | p50: 1.2s, p95: 3.5s          |
| **Modalities**      | Supported I/O types         | text, image, audio            |
| **Status**          | Enabled/disabled/deprecated | enabled                       |

---

## Health Monitoring

### Health Dimensions

| Dimension            | What It Measures               | Importance |
| -------------------- | ------------------------------ | ---------- |
| **Availability**     | Is the provider reachable?     | Critical   |
| **Latency**          | How fast does it respond?      | High       |
| **Error rate**       | How often does it fail?        | Critical   |
| **Response quality** | How good are its outputs?      | High       |
| **Capacity**         | Is it approaching rate limits? | Medium     |
| **Freshness**        | Is the model version current?  | Low        |

### Health States

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Healthy  │───▶│ Degraded │───▶│ Unstable │───▶│ Down     │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
      ▲               │              │               │
      │               │              │               │
      └───────────────┴──────────────┴───────────────┘
                         Recovery
```

| State        | Meaning                      | Action                         |
| ------------ | ---------------------------- | ------------------------------ |
| **Healthy**  | Operating normally           | Route traffic normally         |
| **Degraded** | Higher latency or error rate | Reduce traffic, monitor        |
| **Unstable** | Intermittent failures        | Stop routing, prepare failover |
| **Down**     | Complete failure             | Activate fallback immediately  |

### Health Checks

| Check Type     | Frequency        | What It Tests                                |
| -------------- | ---------------- | -------------------------------------------- |
| **Heartbeat**  | Every 30 seconds | Basic reachability                           |
| **Echo**       | Every 60 seconds | Simple response within timeout               |
| **Capability** | Every 5 minutes  | Full capability test with real task          |
| **Benchmark**  | Daily            | Comprehensive quality and latency assessment |

---

## Capability Catalog

The Capability Catalog maps **what VedMoulya needs** to **what providers can do**.

### VedMoulya Capability Model

| Capability             | Description                            | Example Providers                |
| ---------------------- | -------------------------------------- | -------------------------------- |
| **Text Generation**    | Generate natural language              | OpenAI, Gemini, Claude, DeepSeek |
| **Code Generation**    | Generate, explain, debug code          | OpenAI, Claude, DeepSeek         |
| **Reasoning**          | Complex logical reasoning              | OpenAI o-series, Claude          |
| **Embeddings**         | Convert text to vector representations | OpenAI, Gemini                   |
| **Vision**             | Analyze images and visual content      | OpenAI, Gemini, Claude           |
| **Speech-to-Text**     | Convert audio to text                  | OpenAI Whisper, Gemini           |
| **Text-to-Speech**     | Convert text to audio                  | OpenAI TTS                       |
| **Translation**        | Translate between languages            | Gemini, OpenAI                   |
| **Summarization**      | Condense long content                  | All providers                    |
| **Search & Retrieval** | Find relevant information              | Gemini, embedding-based          |

### Capability Mapping

Each provider declares which VedMoulya capabilities it supports:

```text
Provider: openai-gpt4o
  Supports: Text Generation, Code Generation, Reasoning,
            Vision, Embeddings, Translation, Summarization
  Context: 128K tokens
  Modalities: text-in, text-out, image-in

Provider: google-gemini-pro
  Supports: Text Generation, Code Generation, Reasoning,
            Vision, Speech-to-Text, Translation, Search
  Context: 1M tokens
  Modalities: text-in, text-out, image-in, audio-in
```

---

## Version Awareness

### Model Versioning

| Version Event          | Action                                              |
| ---------------------- | --------------------------------------------------- |
| **New model released** | Register new provider entry, benchmark, add to pool |
| **Model updated**      | Assess changes, update capability mapping           |
| **Model deprecated**   | Flag as deprecated, reduce routing, notify          |
| **Model retired**      | Remove from active pool, preserve history           |

### Version Tracking

- Every response is tagged with the provider version that generated it
- Historical responses remain valid even if the model is retired
- Version transitions are logged for traceability

---

## Provider Lifecycle

```
Discovery → Evaluation → Registration → Active → Deprecated → Retired
                                                │
                                                ▼
                                           Archived
```

| Stage            | Description                            | Duration        |
| ---------------- | -------------------------------------- | --------------- |
| **Discovery**    | New provider identified                | Days            |
| **Evaluation**   | Capabilities assessed, benchmarked     | Weeks           |
| **Registration** | Added to Provider Catalog              | Days            |
| **Active**       | Routing traffic normally               | Months to years |
| **Deprecated**   | Marked for retirement, reduced routing | Weeks to months |
| **Retired**      | No longer routing traffic              | End of life     |
| **Archived**     | Historical record preserved            | Permanent       |

---

## Provider Pool Management

The provider pool is organized by capability:

```
Provider Pool
├── Text Generation Pool
│   ├── openai-gpt4o (healthy)
│   ├── google-gemini-pro (healthy)
│   ├── anthropic-claude-opus (healthy)
│   └── deepseek-v3 (degraded)
├── Embeddings Pool
│   ├── openai-embedding-3 (healthy)
│   └── google-embedding (healthy)
├── Vision Pool
│   ├── openai-gpt4o-vision (healthy)
│   └── google-gemini-pro-vision (healthy)
└── Speech Pool
    ├── openai-whisper (healthy)
    └── google-speech (healthy)
```

Each pool maintains provider rankings by cost, latency, and quality for intelligent routing.

---

## Future Expansion

- **Automatic provider discovery** — New providers detected and registered automatically
- **Self-service provider registration** — Users add custom providers through configuration
- **Provider benchmarking** — Automated quality and performance benchmarking
- **Predictive health** — Predict provider degradation before it happens
- **Multi-region provider management** — Geographic provider distribution for latency optimization

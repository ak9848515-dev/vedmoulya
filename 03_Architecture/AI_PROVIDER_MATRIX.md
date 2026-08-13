# AI Provider Matrix

> Major AI providers compared across capabilities — documented facts distinguished from assessment.
> Owner: AI Platform Team · Updated: 2026-08-03 (EI-002 / EPIC-004)

## Purpose

Compare the major AI providers relevant to VedMoulya across capability dimensions (reasoning, coding, creative writing, research, vision, speed, cost, long context, reliability, enterprise usage) to inform routing policy. **Assessments are clearly marked; documented facts are cited as such.** This is an input to provider ranking (EI), not a substitute for live telemetry.

## Scope

- Providers in our taxonomy: OpenAI, Anthropic, Google, DeepSeek, OpenRouter, Ollama, Mock
- Capability dimensions: reasoning, coding, creative writing, research, vision, speed, cost, long context, reliability, enterprise usage
- Distinction: ✅ documented (vendor/public facts) vs 🔮 assessment (expert judgment, to be validated by EI-001 telemetry)

## Current Status

Matrix is **Implemented as the Enterprise Provider Registry** (2026-08-03, EI-002). The static comparison below is now backed by `packages/providers` — the registry seeds these seven families (with models, cost/latency/rate-limit profiles, health, and capability matrices) and exposes them through the `providers.*` API and the `/providers` marketplace screen. Routing decisions must still use live provider health/cost/quality telemetry from the orchestrator, not this static snapshot; the registry holds the intelligence, selection is a later sprint.

## Architecture

```
Provider Matrix (static snapshot, this doc)
  └─ informs Provider Ranking policy (EI-005 / PROVIDER_SELECTION)
  └─ validated continuously by orchestrator telemetry (quality, cost, latency)
```

## Responsibilities

- AI Platform Team: keep matrix current; attach telemetry
- Routing: always telemetry-first; matrix is only the prior

## Deliverables

- The comparison matrix (below)
- **`packages/providers`** Enterprise Provider Registry (EI-002): 7 seeded families, capability matrices, health engine, fleet aggregation, marketplace view — implemented
- Telemetry-backed ranking (Planned, EI-003)

## Dependencies

- `packages/ai/src/types/index.ts` (provider families, capabilities)
- `packages/providers` (EI-002 registry — provider definitions, models, matrix, health)
- [PROVIDER_SELECTION.md](./PROVIDER_SELECTION.md)
- [06_AI/PROVIDER_COMPARISON.md](../06_AI/PROVIDER_COMPARISON.md)

## Future Work

- Provider Benchmark Engine (EI-003): nightly refresh of measured quality/cost/latency per provider+capability into the registry
- Routing/selection consuming the registry (EI-003+)
- Postgres `ProviderRepository` for production persistence of registry edits

## References

- [TECHNOLOGY_REGISTRY.md](./TECHNOLOGY_REGISTRY.md)
- [06_AI/MODEL_CAPABILITIES.md](../06_AI/MODEL_CAPABILITIES.md)

---

## Scoring Legend

| Mark                  | Meaning                                                                                                                                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅ Documented         | Vendor-published fact per public documentation as of research date (models, capability availability, enterprise offerings). Context-window figures are **approximate and volatile** — re-verify against the vendor before reliance. |
| 🔮 Assessment         | Expert judgment based on public knowledge as of research date; NOT verified by this sprint's research; MUST be validated with telemetry before reliance                                                                             |
| ⚪ Weak / not offered | Documented as absent or assessed as weak                                                                                                                                                                                            |
| N/A                   | Not applicable (e.g., self-hosted option)                                                                                                                                                                                           |

---

## Provider Capability Matrix

| Dimension                                    | OpenAI                                                     | Anthropic                                                | Google                                                       | DeepSeek                                          | OpenRouter                                                   | Ollama                                    |
| -------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------- |
| **Reasoning**                                | ✅ Documented reasoning models (o-series)                  | ✅ Documented reasoning models (claude thinking)         | ✅ Documented reasoning models (gemini thinking)             | ✅ Documented reasoning-focused open models       | 🔮 Aggregate routing of reasoning models                     | 🔮 Depends on model pulled (open weights) |
| **Coding**                                   | ✅ Strong documented coding performance                    | ✅ Strong documented coding performance                  | ✅ Documented strong coding (Gemini)                         | 🔮 Good open coding models, cost-effective        | 🔮 Routes to best coding models                              | 🔮 Model-dependent                        |
| **Creative writing**                         | 🔮 Strong, versatile                                       | ✅ Documented strong stylistic/creative writing          | 🔮 Good, versatile                                           | 🔮 Capable, less polished                         | 🔮 Model-dependent                                           | 🔮 Model-dependent                        |
| **Research / long-form synthesis**           | 🔮 Strong                                                  | ✅ Documented long-context strength                      | ✅ Documented very long context                              | 🔮 Capable at lower cost                          | 🔮 Model-dependent                                           | 🔮 Model-dependent                        |
| **Vision / image understanding**             | ✅ Documented (GPT-4o-class vision)                        | ✅ Documented (Claude vision)                            | ✅ Documented (Gemini multimodal)                            | 🔮 Limited/absent in most open models             | 🔮 Only if routed to vision-capable models                   | 🔮 Only multimodal models                 |
| **Embeddings**                               | ✅ Documented embedding models                             | ⚪ Not a core offering                                   | ✅ Documented embedding API                                  | ⚪ Not offered                                    | N/A                                                          | 🔮 Local embedding models possible        |
| **Speech (STT)**                             | ✅ Documented (Whisper)                                    | ⚪ Not offered                                           | ✅ Documented (Gemini audio)                                 | ⚪ Not offered                                    | N/A                                                          | 🔮 Local whisper models possible          |
| **Speed**                                    | ✅ Documented fast (gpt-4o-class); reasoning models slower | ✅ Documented fast responses; thinking mode slower       | ✅ Documented fast (Gemini 2.x flash-class)                  | 🔮 Generally fast, low latency                    | 🔮 Depends on routed host                                    | 🔮 Local hardware-dependent               |
| **Cost**                                     | ✅ Published pricing; mid–high tier                        | ✅ Published pricing; higher tier                        | ✅ Published pricing; competitive tiers (flash)              | ✅ Documented very low cost                       | ✅ One-key access with per-model pricing; adds routing value | ✅ Free (self-hosted)                     |
| **Long context**                             | ✅ Documented large windows (≈100k+ tokens, approximate)   | ✅ Documented very large windows (≈200k–1M, approximate) | ✅ Documented very large windows (≈1M for some, approximate) | ✅ Documented large windows (≈128k+, approximate) | 🔮 Up to best routed model                                   | 🔮 Hardware-dependent                     |
| **Reliability / uptime**                     | ✅ High, enterprise SLAs                                   | ✅ High, enterprise SLAs                                 | ✅ High, enterprise SLAs                                     | 🔮 Good but fewer enterprise commitments          | 🔮 Depends on hosters; auto-fallback helps                   | N/A (local)                               |
| **Enterprise usage**                         | ✅ Enterprise/SSO/billing/SOC2                             | ✅ Enterprise/SSO/billing/SOC2                           | ✅ Enterprise/Vertex AI                                      | 🔮 Limited formal enterprise program              | 🔮 Emerging; no direct enterprise agreement                  | N/A                                       |
| **Self-host option**                         | ⚪ No                                                      | ⚪ No                                                    | ⚪ No                                                        | ✅ Open weights (downloadable)                    | N/A                                                          | ✅ Full self-host                         |
| **Data governance (no third-party transit)** | ⚪ SaaS only                                               | ⚪ SaaS only                                             | ⚪ SaaS only                                                 | 🔮 Via self-hosted open weights                   | ⚪ Third-party transit                                       | ✅ Fully local                            |

## VedMoulya Provider Families (from `packages/ai`, seeded in `packages/providers`)

| Family       | Role                | Registry Notes                                                                    |
| ------------ | ------------------- | --------------------------------------------------------------------------------- |
| `openai`     | Primary production  | Broad capability coverage; 11-capability matrix, embeddings + vision + speech     |
| `anthropic`  | Primary production  | Strong long-context creative/research; highest content-generation quality in seed |
| `google`     | Primary production  | Multimodal + embeddings; 1M-token context; competitive flash pricing              |
| `deepseek`   | Economy tier        | Cost-efficient reasoning/coding; low cost tier                                    |
| `openrouter` | Breadth/experiments | One-key access to many models; pass-through pricing                               |
| `ollama`     | Local/dev/offline   | Full self-host, zero cost, privacy-first                                          |
| `mock`       | Dev/test            | Deterministic, hermetic; `testing` lifecycle in the seed                          |

## Routing Guidance (assessment, to be telemetry-validated)

1. **Premium tier (`premium`)**: prefer providers with ✅ documented reasoning/enterprise strength (OpenAI/Anthropic/Google) — quality-first.
2. **Standard tier (`standard`)**: balanced choice; Google flash-class or OpenAI fast models for latency-sensitive work.
3. **Economy/free tier**: DeepSeek or Ollama (self-host) — cost-first; only for non-critical capabilities (per `qualityTierRule`, reasoning/coding require premium/standard).
4. **Vision / embeddings / speech**: route to providers that ✅ document those modalities; fallback lists per capability (see `CapabilityProfile` in `packages/ai`).
5. **Fallback ordering**: maintain ≥2 providers per critical capability (orchestrator `fallbackRule`, max 5 attempts).
6. **Cost control**: DeepSeek/Ollama for high-volume low-risk calls; provider prompt caching (Planned) to cut input cost on repeated brand context.

## Known Gaps (Research)

- 🔮 DeepSeek production quality at scale: validate with evals before heavy routing (Promptfoo/Langfuse, Planned).
- 🔮 OpenRouter billing/data-governance trade-off for regulated client work: restrict to non-sensitive workloads.
- 🔮 Local (Ollama/whisper.cpp) quality vs. hosted for `speech` and `vision`: run POCs.

## References

- [PROVIDER_SELECTION.md](./PROVIDER_SELECTION.md)
- [06_AI/PROVIDER_COMPARISON.md](../06_AI/PROVIDER_COMPARISON.md)
- [TECHNOLOGY_REGISTRY.md](./TECHNOLOGY_REGISTRY.md)

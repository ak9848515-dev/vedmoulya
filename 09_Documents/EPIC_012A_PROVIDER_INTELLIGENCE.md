# EPIC-012A — AI Provider Intelligence

**Status:** 🟢 COMPLETE — IMPLEMENTATION VERIFIED (LIVE PROVIDER DISCOVERY REQUIRES OPERATOR ACTION)  
**Date:** 2026-08-10  
**Epic:** EPIC-012A — Premium Experience Refinement + AI Provider Intelligence

---

## Summary

The AI Provider intelligence layer automatically profiles every connected provider and its models through authorized metadata sources. The system determines capabilities, context windows, limits, pricing, and availability — never fabricates unknown information. Every property carries provenance (VERIFIED / PROVIDER_DECLARED / MEASURED / INFERRED / UNKNOWN).

This layer **already existed** in the codebase before EPIC-012A (verified by baseline audit). EPIC-012A exposed it through the gateway and connected it to the user-facing experience.

---

## Provider Intelligence Profile (Phase 7)

When a provider is added or connected, `ProviderIntelligenceService` creates a `ProviderIntelligenceProfile` with:

| Property                | Provenance Sources                                   |
| ----------------------- | ---------------------------------------------------- |
| Model capabilities      | VERIFIED (metadata API), PROVIDER_DECLARED, INFERRED |
| Context window          | PROVIDER_DECLARED, MEASURED                          |
| Input/output limits     | PROVIDER_DECLARED                                    |
| Reasoning capability    | INFERRED from model metadata                         |
| Coding capability       | INFERRED from capability flags                       |
| Vision                  | PROVIDER_DECLARED                                    |
| Audio                   | PROVIDER_DECLARED                                    |
| Tool calling            | PROVIDER_DECLARED                                    |
| Structured output       | PROVIDER_DECLARED                                    |
| Embeddings              | PROVIDER_DECLARED                                    |
| Streaming               | PROVIDER_DECLARED                                    |
| Latency characteristics | MEASURED from health samples                         |
| Pricing                 | PROVIDER_DECLARED, INFERRED                          |
| Free availability       | PROVIDER_DECLARED                                    |
| Quota information       | PROVIDER_DECLARED, MEASURED                          |
| Availability/Health     | MEASURED from health checks                          |

Every property has `source`, `retrievedAt`, `verificationState`, and `refreshPolicy`. Unknown information is explicitly `UNKNOWN` — never guessed.

---

## Model Resource Types (Phase 8)

Models are classified independently of their "open source" or "free model" labels:

| Resource Type   | Description                                      |
| --------------- | ------------------------------------------------ |
| LOCAL           | Running on user's machine (Ollama, LM Studio)    |
| FREE_HOSTED     | Provider-hosted free inference tier              |
| FREE_API_QUOTA  | Free tier with API quotas/limits                 |
| USER_PAID_API   | User-provided paid API key                       |
| AGGREGATOR      | OpenRouter, one API key to many models           |
| OPEN_MODEL      | Open-weight model (may still have hosting costs) |
| CUSTOM_ENDPOINT | User-hosted or custom endpoint                   |
| ENTERPRISE      | Enterprise agreement/license                     |

Key distinction: "open source" ≠ "free API". "Free model" ≠ "unlimited free inference".

---

## Free Resource Intelligence (Phase 9)

Legitimate free resource categories are supported through discovery adapters:

- Provider free tiers (OpenAI free, Gemini free tier)
- OpenRouter free variants
- Local models (Ollama, LM Studio)
- OpenAI-compatible local endpoints
- User-hosted endpoints

Volatile information always includes: `source`, `retrievedAt`, `verificationState`, `refreshPolicy`. Unavailable = UNKNOWN. No hardcoded model database — discovery adapters only.

---

## Local Model Intelligence (Phase 10)

When the user explicitly connects a local runtime:

| Runtime           | Adapter                                                 |
| ----------------- | ------------------------------------------------------- |
| Ollama            | `LocalModelDiscovery` — auto-discovers installed models |
| LM Studio         | `LocalModelDiscovery` — detected via API                |
| OpenAI-compatible | Generic adapter for any compatible endpoint             |

Primary display: Model · Status · Size · Availability  
Advanced (progressive disclosure): context length · quantization · capabilities · hardware requirements

Never automatically downloads a model without explicit user authorization.

---

## Hardware-Aware Model Selection (Phase 11)

`HardwareCompatibilityService` evaluates available hardware before recommending local models:

| Classification  | Meaning                                          |
| --------------- | ------------------------------------------------ |
| SAFE            | Model fits comfortably within available hardware |
| POSSIBLE/SLOW   | Model may run but with reduced performance       |
| NOT_RECOMMENDED | Model too large or incompatible                  |
| UNSUPPORTED     | Hardware requirement cannot be satisfied         |
| UNKNOWN         | Hardware data unavailable                        |

Considers: RAM, VRAM, GPU, CPU, storage, model size, quantization. A free model that cannot run locally is NOT eligible purely because it's free.

---

## Files

| File                                                                    | Description                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------ |
| `packages/providers/src/domain/services/ProviderIntelligenceService.ts` | Auto-generated provider profiles with provenance |
| `packages/providers/src/infrastructure/ModelResourceClassifier.ts`      | Resource type classification                     |
| `packages/providers/src/infrastructure/HardwareCompatibilityService.ts` | Hardware-aware model fit assessment              |
| `packages/providers/src/infrastructure/LocalModelDiscovery.ts`          | Ollama/LM Studio/OpenAI-compatible discovery     |

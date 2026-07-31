# AI Platform

**BLP-002 — Document 05/15 — Technology Stack & Platform Decisions**
**Version:** 1.0
**Status:** LOCKED
**Owner:** AI Platform Architect
**Created:** 2026-07-27
**Design Freeze:** 2026-07-27

---

## Purpose

This document defines the **AI technology stack** for VedMoulya — AI providers, SDKs, embedding models, vector search, and AI infrastructure.

---

## Decision Summary

| Decision           | Choice                                   | Status     |
| ------------------ | ---------------------------------------- | ---------- |
| AI SDK             | **Vercel AI SDK v4** (provider-agnostic) | ✅ DECIDED |
| Primary LLM        | **OpenAI GPT-4o**                        | ✅ DECIDED |
| Secondary LLM      | **Anthropic Claude 3.5 Sonnet**          | ✅ DECIDED |
| Cost-Optimized LLM | **DeepSeek V3**                          | ✅ DECIDED |
| Embeddings         | **OpenAI text-embedding-3-small**        | ✅ DECIDED |
| Fallback LLM       | **OpenAI GPT-4o-mini**                   | ✅ DECIDED |
| Local Dev LLM      | **Ollama** (local models)                | ✅ DECIDED |
| Prompt Management  | **LangChain** (prompt templates, chains) | ✅ DECIDED |

---

## AI SDK: Vercel AI SDK v4

### Decision

| Aspect      | Detail                                                                            |
| ----------- | --------------------------------------------------------------------------------- |
| **Choice**  | Vercel AI SDK v4 (provider-agnostic AI framework)                                 |
| **Purpose** | Unified interface for all AI providers. Streaming, tool calls, structured output. |

### Alternatives Considered

| Alternative          | Pros                                                              | Cons                                     | Verdict                      |
| -------------------- | ----------------------------------------------------------------- | ---------------------------------------- | ---------------------------- |
| **Vercel AI SDK**    | Provider-agnostic, streaming, tool calls, Edge-ready, React hooks | Vercel-centric ecosystem                 | ✅ SELECTED                  |
| **LangChain**        | Rich ecosystem, many integrations                                 | Heavy abstraction, slow iteration        | ⏸ Limited use (prompts only) |
| **Direct API calls** | Simple, no abstraction                                            | No streaming, no fallback, no tool calls | ❌                           |
| **OpenAI SDK only**  | Simple, well-documented                                           | Provider lock-in, no fallback            | ❌                           |

### Provider Configuration

```typescript
import { generateText, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { deepseek } from '@ai-sdk/deepseek';

// Primary: OpenAI GPT-4o
const primary = openai('gpt-4o');

// Secondary: Anthropic Claude
const secondary = anthropic('claude-3-5-sonnet-20241022');

// Cost-optimized: DeepSeek
const costOptimized = deepseek('deepseek-chat');
```

---

## AI Provider Strategy

### Provider Tier System

| Tier          | Provider  | Model               | Use Case                          | Cost |
| ------------- | --------- | ------------------- | --------------------------------- | ---- |
| **Primary**   | OpenAI    | GPT-4o              | Default for all AI features       | $$$  |
| **Secondary** | Anthropic | Claude 3.5 Sonnet   | Fallback when primary unavailable | $$$  |
| **Cost**      | DeepSeek  | DeepSeek V3         | High-volume, low-complexity tasks | $    |
| **Fallback**  | OpenAI    | GPT-4o-mini         | Emergency fallback, simple tasks  | $$   |
| **Local**     | Ollama    | Llama 3.2 / Mistral | Development, testing              | Free |

### Provider Selection Logic

```text
IF primary available AND task requires frontier capability → Use GPT-4o
IF primary unavailable → Fall back to Claude 3.5 Sonnet
IF task is high-volume AND low-complexity → Use DeepSeek V3
IF all cloud providers unavailable → Use Ollama (local, limited capability)
IF task is development/testing → Use Ollama (mock provider)
```

### Cost Optimization

| Strategy                  | Savings          | Implementation                                        |
| ------------------------- | ---------------- | ----------------------------------------------------- |
| DeepSeek for simple tasks | 90%              | Route simple classification/summarization to DeepSeek |
| Response caching          | 30-50%           | Cache frequent AI responses (Redis, 1-hour TTL)       |
| Prompt compression        | 20-40%           | Compress conversation history to essential context    |
| Batch processing          | 10-20%           | Batch similar AI requests                             |
| Local model for dev       | 100% of dev cost | Ollama for all development and testing                |

---

## Embeddings: OpenAI text-embedding-3-small

### Decision

| Aspect      | Detail                                                                   |
| ----------- | ------------------------------------------------------------------------ |
| **Choice**  | OpenAI text-embedding-3-small (1536 dimensions)                          |
| **Purpose** | Text embeddings for semantic search, knowledge graph, content similarity |

### Alternatives Considered

| Alternative                       | Pros                                    | Cons                        | Verdict             |
| --------------------------------- | --------------------------------------- | --------------------------- | ------------------- |
| **OpenAI text-embedding-3-small** | High quality, low cost, 1536 dimensions | OpenAI dependency           | ✅ SELECTED         |
| **OpenAI text-embedding-3-large** | 3072 dimensions, higher quality         | 2x cost, 2x storage         | ❌ Overkill for MVP |
| **Cohere embed**                  | Good quality, multilingual              | Additional provider         | ❌                  |
| **Voyage AI**                     | Good quality, code-aware                | Less known                  | ❌                  |
| **Local (sentence-transformers)** | No API cost, private                    | Lower quality, requires GPU | 📝 Future           |

### Migration to Local Embeddings

| Trigger                        | Action                                    |
| ------------------------------ | ----------------------------------------- |
| Embedding API cost >$100/month | Evaluate local models (bge-large-en-v1.5) |
| Embedding latency >500ms p95   | Consider local inference with GPU         |

---

## Prompt Management

### Tool: LangChain (Limited)

| Aspect        | Detail                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------- |
| **Approach**  | Use LangChain for prompt templates and chains only. Avoid LangChain runtime abstractions.       |
| **Rationale** | LangChain's prompt management is valuable; its runtime abstractions add unnecessary complexity. |

### Custom Prompt Library

| Aspect         | Detail                                                                     |
| -------------- | -------------------------------------------------------------------------- |
| **Location**   | `packages/ai/prompts/`                                                     |
| **Format**     | TypeScript modules exporting prompt templates                              |
| **Versioning** | Each prompt has a version tag. Prompts are deployed independently of code. |

---

## AI Observability

| Tool                     | Purpose                               | Integration                    |
| ------------------------ | ------------------------------------- | ------------------------------ |
| **OpenAI Usage API**     | Token tracking, cost monitoring       | Automated daily report         |
| **Custom logging**       | Prompt/response logging for debugging | Structured logs with trace IDs |
| **LangSmith** (optional) | Prompt evaluation, A/B testing        | Post-MVP evaluation            |

---

## Architecture References

| Reference | Relationship                                                                                    |
| --------- | ----------------------------------------------------------------------------------------------- |
| ARC-005   | AI Orchestrator architecture is implemented through Vercel AI SDK's provider-agnostic interface |
| ARC-002   | Decision Intelligence uses AI for multi-criteria scoring and recommendations                    |
| ARC-003   | Knowledge Graph uses embeddings for semantic relationship discovery                             |

---

## Cross-References

| Reference     | Relationship                                                               |
| ------------- | -------------------------------------------------------------------------- |
| BLP-002 / D01 | P2 (Provider-Agnostic AI) is implemented through Vercel AI SDK abstraction |
| BLP-002 / D04 | pgvector stores embeddings generated by the AI platform                    |
| BLP-002 / D08 | API key management and rate limiting for AI providers                      |
| BLP-002 / D12 | Decision Record — TDR-005 (AI Platform Decision)                           |

---

## Quality Review

| Dimension              | Assessment                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Why**                | AI platform decisions determine intelligence quality, cost structure, and provider dependency risk.              |
| **Business Impact**    | Multi-provider strategy ensures no single point of failure. Cost-tiered routing optimizes spend.                 |
| **Engineering Impact** | Vercel AI SDK provides a unified interface. Provider swap requires zero code changes.                            |
| **Operational Impact** | Vercel AI SDK is zero-ops. Provider API keys are the only operational concern.                                   |
| **Security Impact**    | Data sent to AI providers must be reviewed for PII. SDK handles encryption in transit.                           |
| **Performance Impact** | Streaming responses (SDK default) provide sub-100ms time-to-first-token.                                         |
| **Cost Impact**        | Tiered routing reduces AI costs by 40-60%. Local model for dev eliminates dev cost.                              |
| **Future Scalability** | Provider-agnostic architecture allows easy addition of new providers. Local models enable air-gapped deployment. |

---

## Design Freeze Status

| Status    | Date       | Notes                                                  |
| --------- | ---------- | ------------------------------------------------------ |
| ✅ LOCKED | 2026-07-27 | AI Platform v1.0 frozen. Changes require CTO approval. |

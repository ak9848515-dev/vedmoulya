# Capability Routing

**ARC-005 — Document 03/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief AI Orchestration Architect
**Created:** 2026-07-24
**Cross-references:** ARC-005/D01, ARC-005/D02, ARC-005/D06, ARC-005/D07, ARC-001

---

## Purpose

Capability Routing is how VedMoulya determines **which AI provider should handle each request**. Routing is based on the capability required, not the provider identity. This ensures provider agnosticism and optimal execution.

---

## Scope

This document covers the conceptual routing model. It does NOT define specific routing algorithms, load-balancing strategies, or provider selection heuristics.

---

## Dependencies

- **ARC-005/D01** — AI Orchestration (overall system context)
- **ARC-005/D02** — Provider Management (capability catalog)
- **ARC-005/D06** — Cost & Performance Optimization (routing influenced by cost)
- **ARC-005/D07** — Fallback & Resilience (routing influenced by health)

---

## Routing Philosophy

```
Request → Capability Required → Available Providers → Best Provider Selected
                │                       │                       │
                ▼                       ▼                       ▼
         What can do this?        Who can do this?        Who does it best?
```

Routing is NOT:

- Round-robin (ignores capability differences)
- Hard-coded to specific providers (creates lock-in)
- Random (ignores quality and cost differences)

Routing IS:

- Capability-based (match task to provider strength)
- Context-aware (consider latency, cost, quality needs)
- Dynamic (changes with provider health and availability)
- Explainable (every routing decision can be explained)

---

## Capability Router Architecture

```
                  ┌──────────────────────────────────┐
                  │         CAPABILITY REQUEST        │
                  │   (Text Generation, Code, Vision) │
                  └──────────────┬───────────────────┘
                                 ▼
                  ┌──────────────────────────────────┐
                  │     CAPABILITY CLASSIFIER         │
                  │  Determines which capability     │
                  │  is needed for this request       │
                  └──────────────┬───────────────────┘
                                 ▼
                  ┌──────────────────────────────────┐
                  │     PROVIDER SELECTOR             │
                  │  Evaluates available providers:  │
                  │  - Does it support capability?   │
                  │  - Is it healthy?                │
                  │  - What is its cost?             │
                  │  - What is its latency?          │
                  │  - What is its quality score?    │
                  └──────────────┬───────────────────┘
                                 ▼
                  ┌──────────────────────────────────┐
                  │     ROUTING DECISION              │
                  │  Selected provider + rationale    │
                  └──────────────────────────────────┘
```

---

## Capability Types and Routing

### 1. Text Generation

**Description:** Generate natural language for conversations, content, explanations.

**Routing factors:**

- Quality required (creative writing vs. factual response)
- Latency tolerance (chat vs. batch processing)
- Context length needed (short query vs. long document)
- Tone and style requirements

**Typical providers:** OpenAI GPT-4o, Gemini Pro, Claude, DeepSeek

### 2. Code Generation

**Description:** Generate, explain, debug, or refactor code.

**Routing factors:**

- Programming language (some providers are stronger at certain languages)
- Complexity (simple syntax vs. complex architecture)
- Context size (small function vs. entire codebase)

**Typical providers:** Claude (strong at complex reasoning), DeepSeek (strong at code), OpenAI GPT-4o

### 3. Reasoning

**Description:** Complex logical reasoning, analysis, problem-solving.

**Routing factors:**

- Reasoning depth (simple deduction vs. multi-step reasoning)
- Domain specificity (general vs. specialized domain)
- Confidence requirement (exploratory vs. high-stakes)

**Typical providers:** OpenAI o-series, Claude Opus

### 4. Vision

**Description:** Analyze images, diagrams, charts, and visual content.

**Routing factors:**

- Image complexity (simple object recognition vs. complex diagram analysis)
- Required detail level (high-level description vs. detailed analysis)
- Integration with other capabilities (vision + text generation)

**Typical providers:** OpenAI GPT-4o Vision, Gemini Pro Vision, Claude 3.5 Sonnet

### 5. Speech-to-Text

**Description:** Convert audio to written text.

**Routing factors:**

- Audio quality (clean vs. noisy)
- Language (supported languages)
- Required accuracy (standard vs. high-accuracy)
- Real-time requirement

**Typical providers:** OpenAI Whisper, Gemini Speech

### 6. Text-to-Speech

**Description:** Convert text to spoken audio.

**Routing factors:**

- Voice quality and naturalness
- Language and accent
- Speed requirement

**Typical providers:** OpenAI TTS, ElevenLabs

### 7. Embeddings

**Description:** Convert text to vector representations for search and similarity.

**Routing factors:**

- Embedding dimension requirements
- Language support
- Cost optimization (embeddings are often high-volume)

**Typical providers:** OpenAI Embeddings, Gemini Embeddings

### 8. Search & Retrieval

**Description:** Find relevant information from knowledge bases.

**Routing factors:**

- Whether combined with embedding generation
- Integration with knowledge graph retrieval
- Real-time vs. batched

**Typical providers:** Combined embedding + text generation

### 9. Translation

**Description:** Translate content between languages.

**Routing factors:**

- Language pair
- Context preservation requirements
- Domain-specific terminology

**Typical providers:** Gemini, OpenAI

### 10. Summarization

**Description:** Condense long content while preserving key information.

**Routing factors:**

- Content length
- Required compression ratio
- Domain specialization
- Detail preservation requirements

**Typical providers:** All text generation providers

---

## Routing Decision Factors

| Factor               | Weight   | Description                                  |
| -------------------- | -------- | -------------------------------------------- |
| **Capability match** | Required | Must support the needed capability           |
| **Health status**    | Required | Must be healthy or degraded (not down)       |
| **Quality score**    | High     | Historical quality score for similar tasks   |
| **Latency**          | Medium   | Response time matching request urgency       |
| **Cost**             | Medium   | Cost per request within budget               |
| **Context window**   | Medium   | Must accommodate request context size        |
| **Specialization**   | Low      | Provider specialization for specific domains |

---

## Routing Strategies

### Quality-First Routing

Select the provider with the highest quality score for the capability.

**Best for:** High-stakes requests, user-facing content, important decisions.

### Cost-First Routing

Select the cheapest provider that meets minimum quality requirements.

**Best for:** Batch processing, high-volume tasks, internal operations.

### Latency-First Routing

Select the fastest provider that meets minimum quality requirements.

**Best for:** Real-time interactions, chat, time-sensitive responses.

### Balanced Routing

Weigh quality, cost, and latency based on request context.

**Best for:** General-purpose requests with standard requirements.

### Fallback Routing

If the primary provider fails, route to the next best provider.

**Best for:** All requests (reliability guarantee).

---

## Routing Explainability

Every routing decision must be explainable:

```
Routing Decision: openai-gpt4o
  Reason: Best quality score (9.2/10) for text generation
  Alternatives considered:
    - google-gemini-pro (quality: 8.7, cost: 40% less)
    - anthropic-claude-sonnet (quality: 9.0, latency: 20% slower)
  Not selected because:
    - Quality difference of 0.5 justifies cost premium for this task
    - Request is user-facing with high quality requirements
```

---

## Future Expansion

- **Predictive routing** — Predict optimal provider based on request patterns
- **Adaptive routing** — Routing strategy adapts based on real-time conditions
- **Multi-provider routing** — Split complex requests across multiple providers
- **Personalized routing** — Route based on user's historical provider performance
- **A/B routing** — Route test traffic to evaluate new providers

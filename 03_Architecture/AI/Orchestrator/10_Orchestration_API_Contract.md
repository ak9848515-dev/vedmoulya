# Orchestration API Contract

**ARC-005 — Document 10/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief AI Orchestration Architect
**Created:** 2026-07-24
**Cross-references:** ARC-005/D01, ARC-005/D03, ARC-005/D04, ARC-005/D08, ARC-001, ARC-003, ARC-004

---

## Purpose

The Orchestration API Contract defines the **conceptual interface** between the AI Orchestrator and all systems that request AI capabilities within VedMoulya. This is NOT a REST API, NOT a GraphQL schema, and NOT a code interface. It is a **conceptual contract** describing how capabilities are requested, executed, and returned.

---

## Scope

This document covers the conceptual contract for orchestration interactions. It does NOT define specific endpoints, data formats, transport protocols, or authentication mechanisms.

---

## Dependencies

- **ARC-005/D01** — AI Orchestration (overall system)
- **ARC-005/D03** — Capability Routing (routes requests to providers)
- **ARC-005/D04** — Context Assembly (assembles request context)
- **ARC-005/D08** — Response Validation (validates responses)

---

## Conceptual Contract

```
┌─────────────────────────────────────────────────────────────┐
│                     AI ORCHESTRATOR                          │
│                                                             │
│    ┌─────────────────────────────────────────────────┐      │
│    │          ORCHESTRATION API CONTRACT              │      │
│    │                                                  │      │
│    │  Inputs:  Capability Request + Context           │      │
│    │  Outputs: Capability Response + Metadata         │      │
│    │  Metadata: Confidence, Provider, Cost, Trace     │      │
│    └─────────────────────────────────────────────────┘      │
│                                                             │
│    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│    │ Knowledge    │  │ Execution    │  │ Decision     │    │
│    │ Graph        │  │ Intelligence │  │ Intelligence │    │
│    │ (ARC-003)    │  │ (ARC-004)    │  │ (ARC-002)    │    │
│    └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Orchestration Request

Every request to the Orchestrator includes:

### Inputs

| Input               | Description                                                     | Required    |
| ------------------- | --------------------------------------------------------------- | ----------- |
| **Capability**      | What capability is needed (text-generation, code, vision, etc.) | Yes         |
| **User input**      | The user's actual request or question                           | Yes         |
| **User identifier** | Anonymous user context reference                                | Yes         |
| **Request context** | What is happening contextually                                  | Recommended |
| **Quality tier**    | Premium, Standard, Economy                                      | Recommended |
| **Constraints**     | Output format, length limits, special requirements              | Optional    |
| **Request ID**      | Unique identifier for traceability                              | Recommended |

### Conceptual Structure

```text
Orchestration Request:
- Capability: text-generation
- User Input: "Help me write a project proposal"
- User Context: reference to assembled context
- Quality Tier: standard
- Constraints:
    - Format: markdown
    - Max Length: 1000 words
    - Include: budget section, timeline
```

---

## Orchestration Response

Every response from the Orchestrator includes:

### Outputs

| Output            | Description                                   |
| ----------------- | --------------------------------------------- |
| **Content**       | The generated response                        |
| **Provider**      | Which provider generated this response        |
| **Confidence**    | Confidence score for the response             |
| **Quality score** | Quality assessment of the response            |
| **Latency**       | How long the request took                     |
| **Cost**          | Estimated cost of this request                |
| **Validation**    | Validation results (pass, flag, warning)      |
| **Trace ID**      | Unique identifier linking request to response |

### Conceptual Structure

```text
Orchestration Response:
- Content: "Based on your goals and expertise..."
- Provider: openai-gpt4o
- Confidence: 0.92 (high)
- Quality Score: 8.5/10
- Latency: 1.2s
- Cost: $0.0032
- Validation: Pass
- Trace ID: req-abc-123-def
```

---

## Metadata

Every interaction carries structured metadata:

### Request Metadata

| Field                | Description                             |
| -------------------- | --------------------------------------- |
| **Request ID**       | Unique identifier for the request       |
| **Timestamp**        | When the request was made               |
| **Source system**    | Which VedMoulya system made the request |
| **User reference**   | Anonymous reference to user context     |
| **Request priority** | Urgency of the request                  |
| **Budget context**   | Which budget this request is billed to  |

### Response Metadata

| Field                  | Description                                     |
| ---------------------- | ----------------------------------------------- |
| **Response ID**        | Linked to Request ID                            |
| **Processing time**    | Total time from request to response             |
| **Context used**       | Summary of what context was assembled           |
| **Provider info**      | Provider ID and version that generated response |
| **Cost breakdown**     | Input tokens, output tokens, total cost         |
| **Validation details** | Validation results for each check               |
| **Routing decision**   | Why this provider was selected                  |

---

## Traceability

Every request and response is fully traceable:

```text
Request: req-abc-123-def
  ├── Received: 2026-07-24T10:30:00.000Z
  ├── From: Execution Intelligence
  ├── Capability: text-generation
  │
  ├── Context Assembly
  │   ├── User DNA: communication_preferences, expertise_level
  │   ├── Knowledge Graph: relevant_projects, current_skills
  │   ├── Execution: active_tasks, current_goal
  │   └── Privacy Filter: removed personal_identifiers
  │
  ├── Provider Selection
  │   ├── Considered: openai-gpt4o, google-gemini-pro, anthropic-claude
  │   ├── Selected: openai-gpt4o (quality: 9.2, cost: 0.003/req)
  │   └── Reason: Best quality/cost balance for standard tier
  │
  ├── Execution
  │   ├── Provider: openai-gpt4o (version: gpt-4o-2024-05-13)
  │   ├── Input tokens: 1,245
  │   ├── Output tokens: 387
  │   ├── Latency: 1.2s
  │   └── Cost: $0.0032
  │
  ├── Validation
  │   ├── Format: Pass
  │   ├── Safety: Pass
  │   ├── Policy: Pass
  │   ├── Quality: 8.5/10
  │   └── Confidence: 0.92
  │
  └── Response Delivered: 2026-07-24T10:30:01.200Z
```

---

## Capability-Specific Contracts

### Text Generation

```text
Request:
- Capability: text-generation
- User Input: [user's text request]
- Context: [assembled context reference]

Response:
- Content: [generated text]
- Format: [text/markdown]
```

### Code Generation

```text
Request:
- Capability: code-generation
- User Input: [code request]
- Context: [project context, language, tech stack]

Response:
- Content: [generated code]
- Language: [programming language]
- Format: [code block]
```

### Vision

```text
Request:
- Capability: vision
- User Input: [image reference + question]
- Context: [image context, analysis requirements]

Response:
- Content: [visual analysis]
- Format: [text description / structured analysis]
```

### Embeddings

```text
Request:
- Capability: embeddings
- User Input: [text to embed]
- Context: [embedding parameters, dimensions]

Response:
- Content: [vector embedding]
- Format: [numeric vector]
```

---

## Error Responses

When orchestration fails, the response includes:

| Error Type               | Description                    | User Message                                            |
| ------------------------ | ------------------------------ | ------------------------------------------------------- |
| **Provider unavailable** | No provider available          | "AI service temporarily unavailable. Please try again." |
| **Validation failure**   | Response failed validation     | "Could not generate a safe response. Please rephrase."  |
| **Timeout**              | Request timed out              | "Request timed out. Please try again."                  |
| **Budget exceeded**      | Cost budget reached            | "AI usage limit reached for today."                     |
| **Invalid request**      | Request could not be processed | "Could not process this request. Please check input."   |

---

## Consumer Responsibilities

| Responsibility         | Description                                     |
| ---------------------- | ----------------------------------------------- |
| **Specify capability** | Clearly indicate what capability is needed      |
| **Provide user input** | Include the user's original request             |
| **Handle errors**      | Gracefully handle error responses               |
| **Respect metadata**   | Use confidence and quality scores appropriately |
| **Provide feedback**   | Report response quality for improvement         |

---

## Quality of Service

| Metric                   | Target                               |
| ------------------------ | ------------------------------------ |
| **Availability**         | 99.9% (any provider available)       |
| **Latency (standard)**   | < 3 seconds                          |
| **Latency (real-time)**  | < 500ms                              |
| **Validation pass rate** | > 98% of responses pass validation   |
| **Cost accuracy**        | Cost estimation within 10% of actual |

---

## Future Expansion

- **Streaming responses** — Real-time response streaming for chat and interactive use
- **Multi-modal requests** — Single request with text, image, and audio inputs
- **Batch orchestration** — Batch processing of multiple requests
- **Priority queuing** — Priority-based request queuing and processing
- **Async orchestration** — Long-running request handling with callback delivery

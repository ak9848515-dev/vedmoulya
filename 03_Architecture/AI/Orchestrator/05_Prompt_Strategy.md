# Prompt Strategy

**ARC-005 — Document 05/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief AI Orchestration Architect
**Created:** 2026-07-24
**Cross-references:** ARC-005/D01, ARC-005/D04, ARC-005/D08, ARC-003, ARC-004, PRD-001

---

## Purpose

Prompt Strategy defines how VedMoulya **constructs prompts** for AI providers in a provider-agnostic way. Prompts are the bridge between VedMoulya's intelligence and the provider's execution capability — and they are entirely designed by VedMoulya.

---

## Scope

This document covers the conceptual prompt construction model. It does NOT define specific provider prompts, template languages, or formatting conventions.

---

## Dependencies

- **ARC-005/D01** — AI Orchestration (overall flow)
- **ARC-005/D04** — Context Assembly (provides context for prompts)
- **ARC-005/D08** — Response Validation (validates provider responses)

---

## Prompt Anatomy

A prompt is composed of five conceptual sections:

```
┌──────────────────────────────────────────────────────┐
│  [SYSTEM INSTRUCTIONS]                               │
│  Who VedMoulya is, how to behave, constraints        │
├──────────────────────────────────────────────────────┤
│  [USER CONTEXT]                                      │
│  Who the user is, what they know, their goals        │
├──────────────────────────────────────────────────────┤
│  [TASK CONTEXT]                                      │
│  What is being asked, relevant knowledge, history    │
├──────────────────────────────────────────────────────┤
│  [CONSTRAINTS]                                       │
│  Output format, quality requirements, boundaries     │
├──────────────────────────────────────────────────────┤
│  [USER INPUT]                                        │
│  The actual user request or question                 │
└──────────────────────────────────────────────────────┘
```

---

## Section 1: System Instructions

**Purpose:** Define the AI's role, behavior, and boundaries for every interaction.

**What is included:**

- VedMoulya's identity and purpose
- The AI's role in this interaction (assistant, coach, writer, analyst)
- Behavioral guidelines (helpful, honest, concise, supportive)
- Ethical boundaries (what the AI should not do)
- Response quality expectations
- Tone and formality guidance

**What is NOT included:**

- Provider-specific formatting
- Role-play instructions specific to any provider
- Internal VedMoulya system information

**Conceptual structure:**

```text
System Instructions:
- You are an AI assistant within VedMoulya, a platform that helps
  people build sustainable livelihoods.
- Your role is: [role determined by request type]
- You must be: [behavioral guidelines]
- You must never: [ethical boundaries]
- Response quality: [quality expectations]
- Tone: [tone determined by user preference]
```

---

## Section 2: User Context

**Purpose:** Provide the AI with relevant information about who the user is.

**What is included:**

- User's name or identifier (minimal)
- User's expertise level in the relevant domain
- User's communication preferences
- User's current goals relevant to this request

**Source:** Context Assembly (User DNA + Goals)

**Privacy:** Only the minimum context needed for personalization.

---

## Section 3: Task Context

**Purpose:** Provide the AI with all information needed to complete the task.

**What is included:**

- The task description
- Relevant knowledge from the Knowledge Graph
- Relevant past decisions or history
- Current execution state (if applicable)
- Supporting documents or references

**Source:** Context Assembly (Knowledge Graph, Memory, Execution, Decision)

**Structure:**

- Most important context first
- Supporting context as needed
- References and sources cited

---

## Section 4: Constraints

**Purpose:** Define the boundaries and requirements for the response.

**What is included:**

- Output format (text, structured, code, list)
- Length constraints
- Required sections or elements
- Quality requirements (factual accuracy, citations)
- What to avoid (hallucinations, speculation, sensitive topics)
- Explainability requirements (show reasoning)

**Example:**

```text
Constraints:
- Respond in [format determined by request]
- Maximum [length] words
- Include reasoning before conclusions
- If uncertain, state uncertainty explicitly
- Do not fabricate information
- Support claims with evidence where possible
```

---

## Section 5: User Input

**Purpose:** The actual user request or question.

**What is included:**

- The user's original input
- Any clarifications or elaborations
- Specific questions to answer

**Preservation:** The user's input is preserved as-is to maintain intent fidelity.

---

## Prompt Construction Process

```
                    ┌────────────────────────────────┐
                    │      PROMPT REQUEST             │
                    │  (Capability + Context + Input) │
                    └──────────────┬─────────────────┘
                                   ▼
                    ┌────────────────────────────────┐
                    │  1. CAPABILITY TEMPLATE         │
                    │  Select prompt structure       │
                    │  based on capability needed    │
                    └──────────────┬─────────────────┘
                                   ▼
                    ┌────────────────────────────────┐
                    │  2. SYSTEM INSTRUCTIONS         │
                    │  Inject role, behavior, ethics │
                    └──────────────┬─────────────────┘
                                   ▼
                    ┌────────────────────────────────┐
                    │  3. CONTEXT INJECTION           │
                    │  Insert assembled context      │
                    │  from Context Assembly         │
                    └──────────────┬─────────────────┘
                                   ▼
                    ┌────────────────────────────────┐
                    │  4. CONSTRAINT INJECTION        │
                    │  Add format, quality, safety   │
                    └──────────────┬─────────────────┘
                                   ▼
                    ┌────────────────────────────────┐
                    │  5. USER INPUT INJECTION        │
                    │  Append original user request  │
                    └──────────────┬─────────────────┘
                                   ▼
                    ┌────────────────────────────────┐
                    │      PROMPT READY               │
                    │  Sent to Capability Router     │
                    │  for provider execution        │
                    └────────────────────────────────┘
```

---

## Capability-Specific Prompt Structures

### Text Generation

```
System: [assistant role, helpful tone]
Context: [user identity, goals, relevant knowledge]
Task: [what the user wants]
Constraints: [format, length, tone]
Input: [user's question/request]
```

### Code Generation

```
System: [developer role, precision focus]
Context: [user's skill level, project context, tech stack]
Task: [code to generate, language, requirements]
Constraints: [performance, readability, best practices]
Input: [specific code request]
```

### Reasoning & Analysis

```
System: [analyst role, logical reasoning]
Context: [decision context, relevant knowledge, past decisions]
Task: [problem to solve, options to evaluate]
Constraints: [show reasoning, consider alternatives, state confidence]
Input: [specific question or problem]
```

### Summarization

```
System: [summarizer role, precision focus]
Context: [user's familiarity with topic, purpose of summary]
Task: [content to summarize, key points to preserve]
Constraints: [length, format, key information required]
Input: [content to summarize]
```

---

## Prompt Explainability

Every prompt can be decomposed and explained:

| Section             | Source                   | Purpose            |
| ------------------- | ------------------------ | ------------------ |
| System Instructions | VedMoulya (fixed)        | Define AI behavior |
| User Context        | User DNA + Goals         | Personalization    |
| Task Context        | Knowledge Graph + Memory | Grounding          |
| Constraints         | Request requirements     | Boundaries         |
| User Input          | User                     | Intent             |

---

## Prompt Principles

| Principle             | Description                                     |
| --------------------- | ----------------------------------------------- |
| **Provider-agnostic** | No provider-specific instructions or formatting |
| **Context-rich**      | Include enough context for accurate responses   |
| **Constraint-clear**  | Clearly define boundaries and requirements      |
| **Explainable**       | Every prompt section has a purpose              |
| **Privacy-safe**      | No unnecessary personal data                    |
| **Testable**          | Prompts can be evaluated for quality            |

---

## Future Expansion

- **Dynamic prompt optimization** — Prompt structure adapts based on response quality
- **Multi-turn prompt management** — Maintain prompting strategy across conversations
- **Prompt versioning** — Version-controlled prompt templates for reproducibility
- **A/B prompt testing** — Compare prompt strategies for effectiveness
- **Personalized prompt strategies** — Adapt prompt style to individual user preferences

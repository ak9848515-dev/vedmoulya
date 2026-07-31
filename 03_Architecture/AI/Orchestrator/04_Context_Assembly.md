# Context Assembly

**ARC-005 — Document 04/10**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief AI Orchestration Architect
**Created:** 2026-07-24
**Cross-references:** ARC-005/D01, ARC-005/D05, ARC-003, ARC-004, ARC-002, CMP-001

---

## Purpose

Context Assembly defines how VedMoulya **gathers, filters, and packages** the right context for each AI provider request. Context is what makes AI responses relevant, accurate, and personalized — and it is entirely owned by VedMoulya.

---

## Scope

This document covers the conceptual sources, assembly process, and privacy considerations for context. It does NOT define specific data structures, retrieval queries, or context serialization formats.

---

## Dependencies

- **ARC-005/D01** — AI Orchestration (overall orchestration flow)
- **ARC-005/D05** — Prompt Strategy (receives assembled context)
- **ARC-003** — Knowledge Graph (primary context source)
- **ARC-004** — Execution Intelligence (execution state context)
- **ARC-002** — Decision Intelligence (decision context)

---

## Context Sources

```
                    ┌──────────────────────────────────────┐
                    │           CONTEXT ASSEMBLY            │
                    ├──────────────────────────────────────┤
                    │  User DNA     │  Goals & Priorities  │
                    │  Knowledge    │  Memory & History    │
                    │  Execution    │  Decision Context    │
                    │  Task Context │  Privacy Filters    │
                    └──────────────────────────────────────┘
```

### Source 1: User DNA

**What is assembled:**

- User identity (name, preferred address)
- Communication preferences (tone, formality, language)
- Expertise level in relevant domains
- Learning style
- Cultural and contextual preferences

**Why it matters:** Ensures AI responses are tailored to who the user is.

**Privacy:** Only the subset of DNA relevant to the current request is included.

### Source 2: Goals & Priorities

**What is assembled:**

- Current active goals
- Goal priorities and deadlines
- Recent progress toward goals
- Current focus area or quarter theme
- Long-term vision context

**Why it matters:** Ensures AI responses are aligned with what the user is working toward.

**Privacy:** Only goal titles and progress — not underlying personal motivations unless needed.

### Source 3: Knowledge Graph

**What is assembled:**

- Skills the user possesses (relevant to the request)
- Knowledge the user has (to avoid explaining basics)
- Projects the user has worked on (for contextual reference)
- Past decisions and outcomes (for decision support)
- Knowledge gaps (areas the user needs to learn)

**Why it matters:** Grounds AI responses in what the user actually knows and has done.

**Privacy:** Only the specific knowledge entities relevant to the task are retrieved.

### Source 4: Memory & History

**What is assembled:**

- Recent conversation history (last N messages)
- Relevant past interactions
- Current session context
- User's stated preferences from past interactions

**Why it matters:** Enables natural, continuous conversations without repeating context.

**Privacy:** Conversation history is limited to what is needed for continuity.

### Source 5: Execution State

**What is assembled:**

- Current active tasks and projects
- Task status and deadlines
- Recent execution outcomes
- Current blockers or challenges
- Schedule and time context

**Why it matters:** Enables context-aware assistance during execution.

**Privacy:** Only task-level context, not personal schedule details unless relevant.

### Source 6: Decision Context

**What is assembled:**

- Decision being considered
- Options under evaluation
- Relevant past decisions
- Identified risks and trade-offs

**Why it matters:** Enables intelligent decision support from AI providers.

**Privacy:** Decision framing only — not sensitive personal details unless required.

### Source 7: Task Context

**What is assembled:**

- The specific task or request being made
- Input data provided by the user
- Expected output format
- Constraints and requirements
- Success criteria

**Why it matters:** Ensures the AI provider has the full context of what is being asked.

**Privacy:** Only the data explicitly provided for the task.

---

## Context Assembly Process

```
                     ┌──────────────────────────────────┐
                     │      REQUEST RECEIVED             │
                     │  "Help me write a project         │
                     │   proposal for a client"          │
                     └──────────────┬───────────────────┘
                                    ▼
                     ┌──────────────────────────────────┐
                     │  1. REQUEST ANALYSIS              │
                     │  What is being asked?             │
                     │  What context is relevant?        │
                     │  What privacy rules apply?        │
                     └──────────────┬───────────────────┘
                                    ▼
                     ┌──────────────────────────────────┐
                     │  2. CONTEXT RETRIEVAL             │
                     │  DNA: Communication style        │
                     │  Goals: Current client work goal  │
                     │  Knowledge: Past proposals        │
                     │  Memory: Recent client convos     │
                     │  Execution: Current projects      │
                     └──────────────┬───────────────────┘
                                    ▼
                     ┌──────────────────────────────────┐
                     │  3. CONTEXT FILTERING             │
                     │  Remove irrelevant context        │
                     │  Anonymize where appropriate      │
                     │  Apply privacy boundaries         │
                     └──────────────┬───────────────────┘
                                    ▼
                     ┌──────────────────────────────────┐
                     │  4. CONTEXT PACKAGING             │
                     │  Structure for prompt injection   │
                     │  Prioritize most relevant first   │
                     │  Respect context window limits    │
                     └──────────────┬───────────────────┘
                                    ▼
                     ┌──────────────────────────────────┐
                     │  5. CONTEXT DELIVERY              │
                     │  Delivered to Prompt Constructor  │
                     └──────────────────────────────────┘
```

---

## Context Filtering Rules

| Rule           | Description                                                            |
| -------------- | ---------------------------------------------------------------------- |
| **Relevance**  | Only context directly relevant to the request is included              |
| **Freshness**  | Outdated context is excluded or flagged                                |
| **Confidence** | Low-confidence knowledge is not included unless specifically requested |
| **Privacy**    | Sensitive personal information is excluded by default                  |
| **Minimality** | The minimum context needed for the task is assembled                   |
| **Hierarchy**  | Most important context first, supporting context later                 |

---

## Privacy Considerations

### What Is Never Sent To Providers

| Type                      | Examples                                |
| ------------------------- | --------------------------------------- |
| Full User DNA             | Complete identity profile, raw DNA data |
| Full Knowledge Graph      | All entities and relationships          |
| Full conversation history | Entire chat logs                        |
| Unfiltered personal data  | Address, phone, financial details       |
| Other users' data         | Cross-user information                  |
| System secrets            | API keys, internal configurations       |

### Privacy Architecture

```
User Data (VedMoulya-owned)
        │
        ▼
Context Assembly
        │
        ├── Privacy Filter (removes sensitive data)
        ├── Relevance Filter (removes irrelevant data)
        └── Minimization (keeps only what's needed)
                │
                ▼
Context Sent to Provider (filtered, minimal, ephemeral)
```

### Ephemeral Context

Context sent to AI providers is:

- **Ephemeral** — Not stored by the provider after the response
- **Task-bound** — Used only for the single request
- **Not trained on** — Contractually and architecturally prevented
- **Auditable** — What was sent is logged for compliance

---

## Context Window Management

AI providers have limited context windows. Context Assembly must prioritize:

```
Context Priority (highest to lowest)
1. Current request/input
2. Task instructions
3. Most relevant user context (DNA, goals)
4. Most relevant knowledge
5. Recent conversation history
6. Supporting reference material
7. Historical context
```

If context exceeds the window, lower-priority items are compressed or excluded.

---

## Future Expansion

- **Dynamic context assembly** — Context selection adapts based on real-time relevance scoring
- **Context compression** — Intelligent compression of long context to fit windows
- **Cross-session context** — Persist relevant context across sessions
- **Context confidence scoring** — Each context element carries a confidence score
- **Personalized context rules** — Users define their own context sharing preferences

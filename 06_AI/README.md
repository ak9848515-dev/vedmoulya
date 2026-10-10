# 06_AI — Artificial Intelligence Platform & Engine Governance

**Version:** 1.0  
**Status:** Active & Condition-Free Certified  
**Owner:** AI Platform Team & Chief AI Architect  
**Created:** 2026-07-24  
**Updated:** 2026-08-16

---

## Overview

The `06_AI` directory contains the operational guidelines, governance constraints, prompt architectures, and provider capability catalogs that govern all artificial intelligence behaviors across VedMoulya.

```
06_AI/
├── AI_GUIDELINES.md          # Inviolable rules every AI feature on VedMoulya must follow
├── AI_WORKFLOW.md            # Multi-stage AI execution pipelines, critic loops, and budgets
├── MODEL_CAPABILITIES.md     # Matrix of supported LLMs, vision models, and token contexts
├── PROMPT_LIBRARY.md         # Production system prompts, templates, and guardrails
├── PROVIDER_COMPARISON.md    # Cost, latency, and quality benchmarks for AI providers
├── ORCHESTRATOR_GOVERNANCE.md# Fail-safe routing, fallback chains, and token budget governance
└── README.md                 # AI platform hub and index
```

---

## Inviolable AI Principles

1. **The Orchestrator Choke Point:** No application service or UI component may invoke an external AI provider directly. All AI interactions must pass through `services/orchestrator` with typed requests, cache checks, and cost accounting.
2. **Deterministic Budgets:** Every AI request must declare maximum token budgets, execution timeouts, and cost ceilings. Runaway agentic loops are strictly blocked.
3. **Deterministic Critique:** AI generation is never trusted blindly. Agent plans pass through independent deterministic critics that verify schema validity, file system jail boundaries, and security constraints before execution.
4. **Hermetic Offline Testing:** Unit and CI test suites run against deterministic in-memory mock adapters (`AI_ENABLE_MOCK=true`) without external API keys or cloud dependencies.
5. **Truthful Telemetry:** Latency, tokens, cost, and provider metadata are permanently logged in owner-scoped audit ledgers.

---

## Core Guides

- **[AI_GUIDELINES.md](./AI_GUIDELINES.md):** Guidelines for engineers building AI features: routing, budgets, minimal context, and observability.
- **[AI_WORKFLOW.md](./AI_WORKFLOW.md):** Step-by-step description of how goals are converted into task graphs, executed across tools, and verified.
- **[PROMPT_LIBRARY.md](./PROMPT_LIBRARY.md):** Standardized, tested system prompts for mentors, critics, code synthesizers, and planners.
- **[ORCHESTRATOR_GOVERNANCE.md](./ORCHESTRATOR_GOVERNANCE.md):** Architectural deep-dive into multi-provider fallback, local vs. cloud routing, and privacy guardrails.

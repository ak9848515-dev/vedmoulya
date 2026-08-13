# EPIC-007 — AI Application Factory: Build-vs-Adopt Audit

> **Status:** COMPLETE (Phase 0) · **Date:** 2026-08-08
> **Principle:** Use existing components whenever they are mature. Build only what
> differentiates VedMoulya: GOAL + PERSONAL CONTEXT + EVIDENCE + INTELLIGENT
> ORCHESTRATION + CONTROLLED EXECUTION + VALIDATION + MEMORY + APPLICATION CREATION.

---

## 1. Purpose

Before implementing the Application Factory, every open-source / free technology
category that could accelerate application generation was evaluated. **Nothing is
adopted blindly.** Every candidate is classified and scored against license,
security, maintenance, extensibility, API availability, self-hosting, cost,
vendor lock-in, code quality and production suitability.

## 2. Classification scheme

| Class      | Meaning                                                                         |
| ---------- | ------------------------------------------------------------------------------- |
| **ADOPT**  | Mature, license-compatible, production-suitable — use directly as a dependency. |
| **ADAPT**  | Good core, but needs a small wrapper/configuration for the VedMoulya context.   |
| **WRAP**   | Keep behind a narrow port seam; swap without touching domain code.              |
| **BUILD**  | No mature option fits; the differentiation justifies building it.               |
| **REJECT** | License/security/maintenance/lock-in risk outweighs the benefit.                |

## 3. Candidate evaluation

### 3.1 AI coding agents

| Candidate                             | Class  | Verdict & rationale                                                                                                                                                                                                          |
| ------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aider                                 | REJECT | Open-source (Apache-2.0) and capable, but an interactive terminal agent — not a callable library. Cannot be embedded in a bounded, policy-checked engine; the factory's file-operation layer must own writes, not the agent. |
| Cline                                 | REJECT | VSCode-extension agent with broad filesystem/shell permissions — exactly the "uncontrolled execution" surface EPIC-007 forbids. No safe embeddable core.                                                                     |
| Continue                              | REJECT | Editor assistant; same embeddability + permission-surface problems as Cline.                                                                                                                                                 |
| OpenHands (formerly OpenDevin)        | REJECT | Docker-based autonomous agent — heavy, sandbox-dependent, and fundamentally an _autonomous_ agent (the opposite of the controlled, measurable factory).                                                                      |
| GitHub Copilot Workspace / agent mode | REJECT | Vendor-locked to GitHub + closed runtime; cannot run inside the VedMoulya gateway; no self-hosting.                                                                                                                          |

**Conclusion:** all mainstream AI _agents_ are rejected. The factory needs a
**controlled file-operation layer it owns** — not an autonomous agent with
broad permissions.

### 3.2 Application / UI generators

| Candidate          | Class          | Verdict & rationale                                                                                                                                                                                                                                                                |
| ------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v0 by Vercel       | WRAP (remote)  | Excellent UI generation, but a hosted SaaS with its own data model and account system. Cannot be invoked deterministically from a Node service; would be a manual operator tool at best, never part of the bounded pipeline.                                                       |
| Bolt.new / Lovable | REJECT         | Hosted SaaS, closed, no embedding API. Vendor lock-in on the generated artifact + the generation loop.                                                                                                                                                                             |
| create-t3-app      | ADAPT          | MIT, CLI scaffolding with industry-standard Next.js + tRPC + Prisma + Tailwind conventions. Used as the **convention source** for the deterministic project generator (file layout, tsconfig, scripts), not as a runtime dependency (its CLI is interactive and would need a TTY). |
| create-next-app    | ADAPT          | MIT; Next.js defaults adopted as convention (app router, strict TS). Interactive CLI → conventions only.                                                                                                                                                                           |
| CopilotKit         | REJECT for now | MIT, React framework for building AI apps — useful for _generated apps'_ AI chat surfaces (informed the ai-app-builder archetype's feature list) but not needed by the factory runtime itself.                                                                                     |

**Conclusion:** hosted generators are rejected; scaffolding CLIs are adapted as
**conventions** for the deterministic in-repo generator (Phase 5). The generator
produces typed, structured, repository-aware files without invoking any CLI.

### 3.3 Code-generation frameworks / AST tooling

| Candidate       | Class                 | Verdict & rationale                                                                                                                                                                                                                                                                                |
| --------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ts-morph        | WRAP                  | MIT, actively maintained, deterministic AST-based patching (create/update/delete TypeScript symbols). A future **FileOperationLayer** backend could wrap ts-morph for semantic patches; today the factory writes whole typed files (simple, safe, reviewable). Kept behind the WorkspacePort seam. |
| recast          | WRAP                  | MIT; deterministic AST printing for JS/TS — same WRAP verdict as ts-morph, alternative backend.                                                                                                                                                                                                    |
| Plop.js / Hygen | REJECT                | Template-based file generators — a runtime dependency whose value the deterministic `generateProject` already provides with zero deps and full type safety.                                                                                                                                        |
| Nx / Turborepo  | REJECT for generation | Excellent monorepo scaffolding, but the factory generates _standalone application projects_ (isolated workspaces), not monorepo members. Not needed.                                                                                                                                               |

### 3.4 MCP (Model Context Protocol) servers for code

| Candidate                      | Class  | Verdict & rationale                                                                                                                                                                                                                                                 |
| ------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MCP as a protocol              | WRAP   | MCP is a useful _future_ standard for wiring external tools into the ToolRuntime — but the frozen ToolRuntime already has a typed, audited tool boundary. No MCP adoption now; the protocol can be adapted later behind the same seam without touching domain code. |
| Public MCP file/editor servers | REJECT | Grant broad host filesystem access — violates the "no unrestricted filesystem access" rule. The isolated InMemoryWorkspace + policy-checked FileOperationLayer is the correct boundary.                                                                             |

### 3.5 Deployment platforms

| Candidate            | Class | Verdict & rationale                                                                                                                                                                                                |
| -------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vercel               | WRAP  | Mature serverless host; the `VercelDeploymentAdapter` declares the target and prepares a build artifact — the actual push is an **explicit operator step** (Phase 16: deployment requires explicit authorization). |
| Firebase / Cloud Run | WRAP  | Same pattern — declared targets; adapters only implemented when safely supportable. The `DeploymentAdapterPort` makes them drop-in.                                                                                |
| Railway / Fly.io     | WRAP  | Same verdict — port-defined targets, no vendor hardcoding.                                                                                                                                                         |
| Local / self-hosted  | ADOPT | The always-available safe target: packages the workspace as an artifact (`dist/Applications/app-*/artifact.tar.gz`) with zero external dependencies — the default for generated projects.                          |

**Conclusion:** deployment is a **vendor-neutral abstraction** (`DeploymentAdapterPort`)
with only the _safe, locally-satisfiable_ adapter implemented (local) plus a
declared Vercel adapter that prepares (never pushes).

### 3.6 Database generators / ORM

| Candidate | Class | Verdict & rationale                                                                                                                                                                                 |
| --------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma    | WRAP  | MIT, industry-standard schema → client generation. Generated projects _describe_ a Prisma-style schema (`db/schema.sql` + typed API contract); the factory does not shell out to `prisma generate`. |
| Drizzle   | WRAP  | MIT, lighter alternative — same WRAP treatment. The generated `db/schema.sql` + repository pattern is ORM-agnostic.                                                                                 |

### 3.7 Authentication frameworks

| Candidate                        | Class | Verdict & rationale                                                                                                                                                                                                                |
| -------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing VedMoulya identity/auth | ADOPT | The frozen IdentityApplicationService + JWT gateway middleware is the _approved_ auth infrastructure. Generated applications reference "existing approved auth infrastructure" — the factory never introduces a second auth stack. |

### 3.8 Testing frameworks

| Candidate  | Class | Verdict & rationale                                                                                                           |
| ---------- | ----- | ----------------------------------------------------------------------------------------------------------------------------- |
| Vitest     | ADOPT | Already the platform's test runner (MIT). Generated projects include `vitest`-style unit + integration test files by default. |
| Playwright | WRAP  | MIT, browser E2E — declared in generated projects' acceptance criteria; not invoked by the deterministic pipeline.            |

### 3.9 Design systems

| Candidate                | Class | Verdict & rationale                                                                                             |
| ------------------------ | ----- | --------------------------------------------------------------------------------------------------------------- |
| Tailwind CSS             | ADAPT | MIT; adopted as the UI design convention in generated `ui-design.md` + generated frontend scaffold conventions. |
| shadcn/ui                | ADAPT | MIT; component convention (copy-in pattern fits the isolated-workspace model — no runtime dependency).          |
| Existing `@vedmoulya/ui` | ADOPT | The platform's own design system for in-platform UI (the `/applications` page).                                 |

### 3.10 AI app builders / orchestration platforms

| Candidate                                    | Class              | Verdict & rationale                                                                                                                                        |
| -------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LangChain / LangGraph                        | REJECT for factory | The platform already has a frozen AI runtime + EPIC-006 LoopEngine. Adding LangChain would create a **second orchestration layer** — explicitly forbidden. |
| Dify / Flowise / n8n                         | REJECT             | Hosted/self-hosted visual builders with their own execution model; not embeddable in a bounded TypeScript pipeline; differentiates nothing.                |
| Agent Builder SDKs (OpenAI/Anthropic/Google) | REJECT             | Provider-specific agent abstractions — the platform's contract is provider-agnostic specialist selection through the runtime.                              |

### 3.11 Provider gateways / orchestrators

| Candidate                                              | Class              | Verdict & rationale                                                                                                                                                        |
| ------------------------------------------------------ | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any third-party gateway (LiteLLM, Portkey, OpenRouter) | REJECT for factory | The frozen `AIOrchestrationService` + ProviderRoutingAdvisor already IS the gateway. A second gateway violates the "do not build another provider router" rule in reverse. |

## 4. Decision summary

| Category                                          | Decision                                                                                                                                                          |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI coding agents                                  | REJECT (uncontrolled permission surface; not embeddable)                                                                                                          |
| Hosted app/UI generators                          | REJECT (vendor lock-in; no deterministic embedding)                                                                                                               |
| Scaffolding CLIs (create-t3-app, create-next-app) | ADAPT as conventions for the deterministic generator                                                                                                              |
| AST patchers (ts-morph, recast)                   | WRAP behind WorkspacePort for future semantic patches                                                                                                             |
| MCP                                               | WRAP as future ToolRuntime protocol; REJECT public file/editor servers                                                                                            |
| Deployment platforms                              | WRAP behind DeploymentAdapterPort; local adapter ADOPT, Vercel declared                                                                                           |
| ORM (Prisma/Drizzle)                              | WRAP (schema + repository conventions only)                                                                                                                       |
| Auth                                              | ADOPT existing approved identity infra                                                                                                                            |
| Testing                                           | ADOPT Vitest; WRAP Playwright                                                                                                                                     |
| Design systems                                    | ADAPT Tailwind/shadcn conventions; ADOPT @vedmoulya/ui in-platform                                                                                                |
| AI builder platforms (LangChain, Dify, n8n)       | REJECT (would duplicate frozen orchestration)                                                                                                                     |
| Third-party gateways                              | REJECT (duplicates the frozen AI runtime)                                                                                                                         |
| **Application Factory itself**                    | **BUILD** — nothing mature provides GOAL + CONTEXT + EVIDENCE + ORCHESTRATION + CONTROLLED EXECUTION + VALIDATION + MEMORY + APP CREATION as one bounded pipeline |

## 5. What this means for implementation

The factory **BUILDS only the minimum proprietary layer** that differentiates
VedMoulya, and **WRAPS/ADAPTS/ADOPTS everything else**:

- **BUILD:** `@vedmoulya/app-factory` — specification engine, architecture
  engine, task-graph builder (on EPIC-006), blueprint, plan preview + approval,
  controlled file-operation + execution policy, isolated workspaces, validation
  gates, security + UI-quality review, economics, registry, deployment + VCS
  abstraction, and the deterministic project generator.
- **REUSE (never rebuild):** the AI Runtime (`AIOrchestratorSpecialistPort`),
  the EPIC-006 LoopEngine (bounded generation loop), RAG, the ToolRuntime, the
  EvidenceEvaluator, the CriticEvaluator, Identity/auth, `@vedmoulya/ui`.
- **No new dependencies were added** beyond `@vedmoulya/core` + `@vedmoulya/loop-engine`
  (both already in the platform).

## 6. License / security notes

- Every ADAPT/WRAP candidate is MIT/Apache-2.0 — no copyleft contamination.
- No candidate grants the factory filesystem/shell/network rights: all writes
  flow through the policy-checked `WorkspacePort`; deploys require explicit
  authorization; VCS never auto-pushes.
- `npm audit --omit=dev` after the workspace addition: **0 vulnerabilities**
  (Phase 22).

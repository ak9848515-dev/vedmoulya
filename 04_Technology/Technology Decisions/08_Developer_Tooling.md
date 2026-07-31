# Developer Tooling

**TECH-001 — Document 08/10 — Technology Decision Record**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Technology Officer (CTO)
**Created:** 2026-07-27
**Cross-references:** ARC-001, IMP-001/D05, IMP-001/D07

---

## Purpose

This TDR defines the **developer tooling strategy** for VedMoulya — the tools, platforms, and workflows that enable the Founder + AI collaboration model and scale as the engineering team grows.

---

## Developer Tooling Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DEVELOPER TOOLING PHILOSOPHY                                │
│                                                                               │
│  1. AI-NATIVE — Tools must integrate with AI coding assistants.              │
│     If a tool has no AI integration, it creates friction.                     │
│                                                                               │
│  2. STANDARD OVER CUSTOM — Use standard tools with large communities.        │
│     Custom tooling is built only when no tool exists for the need.            │
│                                                                               │
│  3. LOW FRICTION — Setup time should be minutes, not hours.                   │
│     A new developer should be productive on Day 1.                            │
│                                                                               │
│  4. CONSISTENT — Every developer uses the same tool chain.                    │
│     No "works on my machine" — containers ensure environment parity.          │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Tooling Decisions

### Version Control

| Aspect               | Decision                                                                       |
| -------------------- | ------------------------------------------------------------------------------ |
| **Platform**         | GitHub                                                                         |
| **Hosting**          | GitHub.com (SaaS)                                                              |
| **Branch Strategy**  | Trunk-based development with short-lived feature branches                      |
| **Protection Rules** | Main branch protected — require PR review, passing CI, up-to-date branch       |
| **Conventions**      | Conventional Commits (type(scope): description). Linear history. Squash merge. |

**Rationale:** GitHub is the industry standard for AI integration (Copilot native). Trunk-based development enables CI/CD and reduces merge conflicts.

### IDE / Code Editor

| Aspect             | Decision                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------- |
| **Primary**        | VS Code (with GitHub Copilot, Cursor extensions)                                         |
| **Alternative**    | Cursor (AI-native editor) — for AI-paired development sessions                           |
| **Extensions**     | ESLint, Prettier, TypeScript, Tailwind CSS, Docker, GitLens, Thunder Client, REST Client |
| **Dev Containers** | VS Code Dev Containers — consistent environment for every developer                      |

**Rationale:** VS Code has the best AI integration ecosystem. Cursor provides an alternative for AI-first development. Dev containers ensure environment consistency.

### AI Coding Assistants

| Tool                     | Purpose                                                            | Phase   |
| ------------------------ | ------------------------------------------------------------------ | ------- |
| **GitHub Copilot**       | Primary code generation — inline completions, chat, agent mode     | MVP+    |
| **Cursor**               | AI-native editing — entire-file generation, contextual refactoring | MVP+    |
| **Codebuff (this tool)** | Strategic coding assistance — architecture-level code generation   | MVP+    |
| **Claude Code (future)** | Complex multi-file reasoning and generation                        | Growth+ |

**AI Tooling Costs:** Budget $20-40/user/month for AI tool subscriptions. ROI: 2-3x productivity gain on routine coding tasks.

### Documentation Platform

| Aspect                | Decision                                  |
| --------------------- | ----------------------------------------- |
| **Architecture Docs** | Markdown in repository (current approach) |
| **API Docs**          | Generated from code (OpenAPI/Typedoc)     |
| **Internal Wiki**     | GitHub Wiki or Notion (team preference)   |
| **Runbooks**          | Markdown in ops repository                |
| **Decision Records**  | ADR format in repository (docs/adr/)      |

**Rationale:** Keep documentation close to code. Markdown is version-controlled, reviewable, and AI-friendly.

### Project Management

| Aspect              | Decision                                                                    |
| ------------------- | --------------------------------------------------------------------------- |
| **Platform**        | GitHub Projects (MVP) → Linear (Growth)                                     |
| **Methodology**     | Weekly sprints (IMP-001/D05)                                                |
| **Backlog**         | GitHub Issues with labels (phase, module, priority, type)                   |
| **Sprint Tracking** | GitHub Project Board (Kanban: Backlog → Todo → In Progress → Review → Done) |

**Rationale:** GitHub Projects integrates natively with code (PRs, issues, commits). Minimal tool overhead for MVP. Linear provides better sprint management for larger teams.

### Code Review

| Aspect                | Decision                                                        |
| --------------------- | --------------------------------------------------------------- |
| **Process**           | GitHub PRs with required reviews                                |
| **AI Pre-Review**     | AI reviews every PR before human — catches style, common issues |
| **Human Review**      | At least 1 human review per PR. Security-sensitive: 2 reviews.  |
| **Checklist**         | PR template with review checklist (IMP-001/D08)                 |
| **Turnaround Target** | < 4 hours during working hours                                  |

### Architecture Review

| Aspect       | Decision                                                              |
| ------------ | --------------------------------------------------------------------- |
| **Process**  | Architecture Decision Records (ADRs) in docs/adr/                     |
| **Trigger**  | Any decision that affects module boundaries, contracts, or principles |
| **Review**   | Chief Program Architect + affected module owners                      |
| **Template** | ADR template: Context → Decision → Consequences → Options Considered  |

---

## CI/CD Tooling

| Stage                           | Tool                      | Purpose                                                     |
| ------------------------------- | ------------------------- | ----------------------------------------------------------- |
| **Continuous Integration**      | GitHub Actions            | Build, lint, test, security scan on every PR                |
| **Continuous Deployment**       | GitHub Actions → GKE      | Deploy to dev/staging/production                            |
| **Infrastructure Provisioning** | Terraform                 | Cloud infrastructure as code                                |
| **Kubernetes Deployments**      | Helm Charts               | Application deployment configuration                        |
| **Secret Management**           | GCP Secret Manager + SOPS | Encrypted secrets in repository (SOPS) + cloud secret store |

---

## Development Environment

### Local Development

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LOCAL DEVELOPMENT ENVIRONMENT                               │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  REQUIRED (for every developer)                                       │    │
│  │                                                                        │    │
│  │  ▸ VS Code + Dev Containers                                           │    │
│  │  ▸ Node.js (version managed by .nvmrc)                                │    │
│  │  ▸ Docker Desktop                                                     │    │
│  │  ▸ Git                                                                │    │
│  │  ▸ GitHub CLI (gh)                                                    │    │
│  │  ▸ 1Password or similar (for secrets)                                 │    │
│  │                                                                        │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  DEV CONTAINER INCLUDES:                                               │    │
│  │                                                                        │    │
│  │  ▸ TypeScript toolchain                                               │    │
│  │  ▸ ESLint + Prettier                                                   │    │
│  │  ▸ Local PostgreSQL (for relational)                                   │    │
│  │  ▸ Local Redis (for cache)                                             │    │
│  │  ▸ Local MinIO (for object storage)                                   │    │
│  │  ▸ Local Ollama (for local AI provider)                               │    │
│  │  ▸ Pre-commit hooks                                                    │    │
│  │                                                                        │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│  ONE COMMAND SETUP:                                                          │
│  git clone <repo>                                                            │
│  cd vedmoulya                                                                │
│  code . (opens dev container)                                                │
│  npm install                                                                 │
│  npm run dev                                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Pros & Cons

| Pros                                                             | Cons                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------ |
| Industry-standard tools with large communities                   | AI tooling costs ($20-40/user/month) add up            |
| VS Code + Dev Containers = consistent environment                | Dev Containers require Docker Desktop (resource-heavy) |
| GitHub integration = code + project management + CI in one place | GitHub Projects is less feature-rich than Jira/Linear  |
| ADR process ensures architecture decisions are documented        | ADR process requires discipline to maintain            |
| Trunk-based development reduces merge conflicts                  | Requires CI/CD maturity to deploy frequently           |

### Migration Strategy

| Tool                           | Migration Path                                                      | Cost   |
| ------------------------------ | ------------------------------------------------------------------- | ------ |
| GitHub → Other Git platform    | Standard Git. Any Git platform works. PRs/issues need migration.    | High   |
| VS Code → Other IDE            | Developer preference. No code lock-in. Config would need migration. | Low    |
| GitHub Actions → Other CI      | CI configs portable (YAML-based). Any CI runner works.              | Medium |
| Dev Containers → No containers | Dev container is convenience — project runs without it.             | Low    |

---

## Cross-References

| Reference   | Relationship                                                                     |
| ----------- | -------------------------------------------------------------------------------- |
| CMP-001     | "Human-first" — tooling should make developers productive, not frustrated        |
| ARC-001     | Principle #5 (Modular) — tooling supports modular development                    |
| IMP-001/D05 | Sprint Structure — sprint ceremonies use these tools (GitHub Projects, standups) |
| IMP-001/D07 | Team & AI Collaboration — tooling enables the Founder + AI collaboration model   |

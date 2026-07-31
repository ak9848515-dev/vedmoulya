# Developer Toolchain

**BLP-002 — Document 11/15 — Technology Stack & Platform Decisions**
**Version:** 1.0
**Status:** LOCKED
**Owner:** Chief Technology Officer
**Created:** 2026-07-27
**Design Freeze:** 2026-07-27

---

## Purpose

This document defines the **developer experience toolchain** for VedMoulya — the tools and practices that make developers productive, happy, and consistent.

---

## Decision Summary

| Decision          | Choice                                     | Status     |
| ----------------- | ------------------------------------------ | ---------- |
| Editor            | **VS Code** (with extensions)              | ✅ DECIDED |
| Type Checking     | **TypeScript** (strict mode)               | ✅ DECIDED |
| Linting           | **ESLint v9** (flat config)                | ✅ DECIDED |
| Formatting        | **Prettier v3**                            | ✅ DECIDED |
| Dev Containers    | **Dev Containers** (VS Code + Docker)      | ✅ DECIDED |
| Monorepo          | **npm workspaces**                         | ✅ DECIDED |
| Commit Convention | **Conventional Commits**                   | ✅ DECIDED |
| Commit Linting    | **commitlint**                             | ✅ DECIDED |
| Pre-commit Hooks  | **husky** + **lint-staged**                | ✅ DECIDED |
| PR Template       | **GitHub PR template**                     | ✅ DECIDED |
| Issue Templates   | **GitHub issue forms** (bug, feature, ADR) | ✅ DECIDED |
| Documentation     | **Markdown** + **Mermaid** (diagrams)      | ✅ DECIDED |

---

## VS Code Extensions

| Extension                 | Purpose                     | Required    |
| ------------------------- | --------------------------- | ----------- |
| ESLint                    | Inline linting              | ✅ Required |
| Prettier                  | Format on save              | ✅ Required |
| Tailwind CSS IntelliSense | Tailwind class autocomplete | ✅ Required |
| Docker                    | Container management        | ✅ Required |
| GitLens                   | Git history, blame          | Recommended |
| TypeScript + JavaScript   | Language features           | ✅ Built-in |
| Error Lens                | Inline error display        | Recommended |

---

## Monorepo Tooling

### npm Workspaces

| Aspect           | Detail                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------- |
| **Choice**       | npm workspaces (built-in, no additional tool)                                            |
| **Alternatives** | Turborepo (added complexity), Nx (overkill), pnpm workspaces (different package manager) |

### Package Conventions

| Pattern           | Convention                      |
| ----------------- | ------------------------------- |
| Internal packages | `@vedmoulya/{name}`             |
| Source            | `src/`                          |
| Tests             | Co-located: `Component.test.ts` |
| Built output      | `dist/` (gitignored)            |

---

## Git Conventions

### Branch Strategy

| Branch    | Purpose                | Protection             |
| --------- | ---------------------- | ---------------------- |
| `main`    | Production-ready code  | Protected, requires PR |
| `develop` | Integration branch     | Protected, requires PR |
| `feat/*`  | Feature branches       | None                   |
| `fix/*`   | Bug fix branches       | None                   |
| `docs/*`  | Documentation branches | None                   |

### Commit Convention

```
type(scope): description

Types: feat, fix, refactor, test, docs, style, chore, perf, security
Scopes: career, learning, business, knowledge, decision, execution, identity, webs
```

---

## Architecture References

| Reference     | Relationship                                                               |
| ------------- | -------------------------------------------------------------------------- |
| BLP-001 / D13 | Documentation Standards defines format, templates, and review requirements |

---

## Cross-References

| Reference     | Relationship                                                    |
| ------------- | --------------------------------------------------------------- |
| BLP-002 / D12 | Decision Record — TDR-011 (Developer Toolchain Decision)        |
| BLP-001 / D06 | AI Development Workflow integrates with the developer toolchain |

---

## Quality Review

| Dimension              | Assessment                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| **Why**                | Developer toolchain determines developer onboarding time, code consistency, and daily productivity.      |
| **Business Impact**    | Consistent tooling reduces onboarding from weeks to days. Automated formatting eliminates style debates. |
| **Engineering Impact** | pre-commit hooks catch issues before CI. Conventional commits enable automated changelog generation.     |
| **Operational Impact** | Dev Containers provide reproducible environments. No "works on my machine" problems.                     |
| **Security Impact**    | Pre-commit hooks scan for secrets. ESLint security rules catch common vulnerability patterns.            |
| **Performance Impact** | Dev Containers are as fast as native (bind mounts). Pre-commit hooks add <5s to each commit.             |
| **Cost Impact**        | All tools are free. VS Code is free. npm workspaces are built-in.                                        |
| **Future Scalability** | Toolchain scales with team. New hires use the same tools and conventions.                                |

---

## Design Freeze Status

| Status    | Date       | Notes                                                          |
| --------- | ---------- | -------------------------------------------------------------- |
| ✅ LOCKED | 2026-07-27 | Developer Toolchain v1.0 frozen. Changes require CTO approval. |

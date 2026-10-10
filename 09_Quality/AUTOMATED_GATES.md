# Automated Quality Gates & CI/CD Governance

**Version:** 1.0  
**Status:** Certified & Active in CI  
**Owner:** Release Engineering & Quality Council  
**Created:** 2026-08-01  
**Updated:** 2026-08-16  
**Implementation Seam:** `.github/workflows/ci.yml`, `scripts/`, `eslint.config.js`

---

## 1. Automated Gate Taxonomy

VedMoulya enforces a zero-regression, 10-tier quality gate hierarchy. All code merges into the `main` branch must pass every gate deterministically.

| Gate                                  | Scope                     | Command                   | Threshold / Criteria                                               |
| :------------------------------------ | :------------------------ | :------------------------ | :----------------------------------------------------------------- |
| **Gate 1: TypeScript Strict**         | Monorepo (58 scopes)      | `npm run typecheck`       | 0 errors allowed (`tsc -b && tsc -p services/api`).                |
| **Gate 2: Monorepo ESLint**           | Monorepo (58 scopes)      | `npm run lint`            | 0 errors, 0 warnings across all workspaces.                        |
| **Gate 3: Circular Dependencies**     | Monorepo dependency graph | `npm run deps:cycles`     | 0 internal circular cycles between workspaces.                     |
| **Gate 4: Configuration Contract**    | Environment files         | `npm run config:contract` | All `REQUIRED_PRODUCTION` variables documented; no leaked secrets. |
| **Gate 5: Critical Dependency Audit** | npm dependencies          | `npm run audit`           | 0 critical security vulnerabilities.                               |
| **Gate 6: Vitest Unit Suite**         | Packages & services       | `npm run test`            | 100% test pass rate across all workspace projects.                 |
| **Gate 7: Domain Benchmarks**         | Core AI engines           | `npm run benchmarks`      | 17+ benchmark harnesses pass with zero failures.                   |
| **Gate 8: Startup Diagnostics**       | Local / Docker runtime    | `npm run doctor`          | Clean PASS across Node, TS, DB, Redis, and ports.                  |
| **Gate 9: Playwright E2E**            | Web application           | `npm run test:e2e`        | Critical user journeys (register, login, command center) pass.     |
| **Gate 10: Accessibility (a11y)**     | Web UI                    | `npm run test:a11y`       | Zero WCAG 2.1 AA violations on core views.                         |

---

## 2. Gate Verification Execution Guide

The table above is the quality-gate catalog, not a claim that every listed
command is currently invoked by CI. As of 2026-10-10, `.github/workflows/ci.yml`
explicitly runs lint, format, dependency-cycle, typecheck, coverage tests,
benchmarks, npm audit, Playwright, accessibility, and bundle-size checks.
`npm run doctor` and `npm run config:contract` are available operator checks
but are not invoked by that workflow.

### Fast Developer Verification (`scripts/verify.sh`)

Developers can run the unified bounded verification runner before committing:

```bash
npm run verify
```

**Key Verification Guarantees:**

- **ANSI-Free Output:** Runs under `NO_COLOR=1` and `CI=1` to ensure CI logs and agents receive clean, parseable text.
- **Bounded Execution Timeouts:** Every sub-command runs under strict timeout envelopes (e.g., 900s for typechecks, 1200s for linting) to prevent hanging tasks.
- **Memory Bounded:** Increases Node old space size (`--max-old-space-size=4096`) to eliminate out-of-memory flakiness during whole-repo AST parsing.

---

## 3. Pre-Commit Enforcement (Husky & lint-staged)

Git hooks automatically run lightweight checks upon every local commit:

- `commitlint`: Validates conventional commit format (e.g., `feat(api): ...`, `fix(web): ...`).
- `lint-staged`: Runs Prettier formatting and targeted ESLint fixes on modified files before staging.

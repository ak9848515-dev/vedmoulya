# 09_Quality — Quality Assurance, Test Architecture & Release Gates

**Version:** 1.0  
**Status:** Canonical & Enforced in CI  
**Owner:** Quality Assurance & Release Engineering  
**Created:** 2026-07-24  
**Updated:** 2026-08-16

---

## Overview

The `09_Quality` directory defines the multi-tiered quality architecture, automated gate definitions, release readiness criteria, and performance standards enforced across the entire VedMoulya codebase.

```
09_Quality/
├── CHECKLIST.md          # Daily developer quality checklist before raising PRs
├── PERFORMANCE.md        # Performance budgets, bundle size limits, and latency targets
├── RELEASE_CHECKLIST.md  # Comprehensive pre-release verification protocol
├── TESTING_STRATEGY.md   # The test pyramid: unit, integration, benchmark, and e2e testing
├── AUTOMATED_GATES.md    # Automated CI gates: typecheck, lint, cycles, contracts, coverage
└── README.md             # Quality directory overview and navigation map
```

---

## The Quality Gate Hierarchy

VedMoulya employs 10 automated quality gates across local development, pre-commit hooks, and GitHub Actions CI:

```
[ Gate 1: TypeScript Strict ] ──► [ Gate 2: Monorepo ESLint ] ──► [ Gate 3: Circular Deps ]
                                                                          │
[ Gate 6: Vitest Unit Suite ] ◄── [ Gate 5: Config Contract ] ◄── [ Gate 4: Secret Audit ]
        │
        ▼
[ Gate 7: Benchmark Harness ] ──► [ Gate 8: Playwright E2E ] ──► [ Gate 9: WCAG a11y ]
                                                                          │
                                                                          ▼
                                                                [ Gate 10: Bundle Budgets ]
```

---

## Key Verification Commands

```bash
# 1. Core Verification Run
npm run verify           # Deterministic, bounded run: doctor + tests + typecheck + lint

# 2. Strict Individual Gates
npm run typecheck        # tsc -b && tsc --noEmit -p services/api (0 errors allowed)
npm run lint             # Strict ESLint across all 58 workspaces (0 warnings allowed)
npm run deps:cycles      # Enforce zero circular dependency cycles
npm run config:contract  # Verify all REQUIRED_PRODUCTION secrets match inventory
npm run audit            # Critical npm security audit check

# 3. Test Suites & Benchmarks
npm run test             # Vitest unit test suite (thousands of tests across packages)
npm run benchmarks       # 17+ benchmark harnesses (factory, loop, brain, provider, etc.)
npm run test:e2e         # End-to-end web browser testing with Playwright
npm run test:a11y        # Accessibility compliance checks
```

---

## Quality Metrics & Standards

- **Zero-Warning Tolerance:** CI lint runs fail on ESLint warnings as well as errors. TypeScript errors fail the typecheck gate.
- **Hermetic Testing:** Tests must execute independently without requiring external cloud network access or active payment credentials.
- **Fail-Fast Bootstrapping:** Services validate required secrets and environment variables upon startup; placeholder strings or missing keys terminate the process immediately with descriptive diagnostic guidance.

# Testing Toolchain

**BLP-002 — Document 10/15 — Technology Stack & Platform Decisions**
**Version:** 1.0
**Status:** LOCKED
**Owner:** DevOps Lead
**Created:** 2026-07-27
**Design Freeze:** 2026-07-27

---

## Purpose

This document defines the **testing technology stack** for VedMoulya — frameworks, tools, and automation for all test types.

---

## Decision Summary

| Decision          | Choice                                       | Status     |
| ----------------- | -------------------------------------------- | ---------- |
| Test Framework    | **Vitest**                                   | ✅ DECIDED |
| E2E Testing       | **Playwright**                               | ✅ DECIDED |
| Component Testing | **Storybook** + **Vitest**                   | ✅ DECIDED |
| API Testing       | **Supertest** (integration)                  | ✅ DECIDED |
| Accessibility     | **axe-core** + **Playwright**                | ✅ DECIDED |
| Visual Regression | **Playwright** (screenshot comparison)       | ✅ DECIDED |
| Contract Testing  | **Pact JS** (consumer-driven)                | ✅ DECIDED |
| Performance       | **k6** (load testing) + **Lighthouse** (web) | ✅ DECIDED |
| Security          | **CodeQL** (SAST) + **Dependabot** (deps)    | ✅ DECIDED |
| Coverage          | **c8** / **v8** (via Vitest)                 | ✅ DECIDED |
| Mocking           | **MSW** (API mocking) + **Vitest mocks**     | ✅ DECIDED |
| Faker             | **@faker-js/faker** (test data generation)   | ✅ DECIDED |

---

## Test Types & Tools

| Type              | Tool                  | When                              | Target            |
| ----------------- | --------------------- | --------------------------------- | ----------------- |
| Unit              | Vitest                | Every commit                      | ≥80% new code     |
| Integration       | Vitest + Supertest    | Every commit                      | ≥70% paths        |
| E2E               | Playwright            | Per PR (critical), nightly (full) | All journeys      |
| Component         | Storybook + Vitest    | Per component                     | All variants      |
| Contract          | Pact JS               | Per API change                    | All contracts     |
| Accessibility     | axe-core + Playwright | Every commit (auto)               | WCAG AA           |
| Visual Regression | Playwright            | Per UI change                     | Zero visual diffs |
| Performance (API) | k6                    | Per release                       | ≤500ms p95        |
| Performance (Web) | Lighthouse            | Every commit                      | ≥90 score         |
| Security (SAST)   | CodeQL                | Every commit                      | Zero criticals    |
| Dependency Scan   | Dependabot            | Weekly                            | Zero criticals    |

---

## Architecture References

| Reference     | Relationship                                                              |
| ------------- | ------------------------------------------------------------------------- |
| BLP-001 / D09 | Testing Strategy defines the 12 test types that this toolchain implements |

---

## Cross-References

| Reference     | Relationship                                            |
| ------------- | ------------------------------------------------------- |
| BLP-002 / D12 | Decision Record — TDR-010 (Testing Toolchain Decision)  |
| BLP-001 / D08 | Quality Gates validate testing results from these tools |

---

## Quality Review

| Dimension              | Assessment                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| **Why**                | Testing toolchain determines test reliability, developer feedback speed, and bug detection rate. |
| **Business Impact**    | 2-minute CI provides rapid feedback. Playwright catches UI regressions before they reach users.  |
| **Engineering Impact** | Same framework (Vitest) for unit, integration, and component tests reduces context switching.    |
| **Operational Impact** | Vitest is zero-config. Playwright is self-healing (auto-waits).                                  |
| **Security Impact**    | CodeQL + Dependabot catch vulnerabilities before deployment.                                     |
| **Performance Impact** | Lighthouse budgets prevent performance regressions. k6 validates scalability.                    |
| **Cost Impact**        | All tools are open source. GitHub-hosted runners have free tier quotas.                          |
| **Future Scalability** | All tools scale with project size. Playwright Cloud for parallel E2E runs (future).              |

---

## Design Freeze Status

| Status    | Date       | Notes                                                        |
| --------- | ---------- | ------------------------------------------------------------ |
| ✅ LOCKED | 2026-07-27 | Testing Toolchain v1.0 frozen. Changes require CTO approval. |

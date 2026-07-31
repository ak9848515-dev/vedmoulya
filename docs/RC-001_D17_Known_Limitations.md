# RC-001 — Deliverable 17: Known Limitations

**Version:** 1.0.0-rc1  
**Date:** July 30, 2026

---

## 1. Feature Limitations

| #   | Limitation                                                                                                       | Component | Impact                             | Target         |
| --- | ---------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------- | -------------- |
| 1   | PWA service worker not implemented                                                                               | Web App   | Users cannot install as PWA        | Post-RC-002    |
| 2   | Web manifest not generated                                                                                       | Web App   | No install prompt                  | Post-RC-002    |
| 3   | Offline support not implemented                                                                                  | Web App   | No offline functionality           | Post-RC-002    |
| 4   | Service stubs: orchestrator, execution, business, career, learning, marketplace, notifications only export index | Services  | No business logic in stub services | Future sprints |
| 5   | No end-to-end tests                                                                                              | Quality   | Playwright configured but no tests | RC-002         |
| 6   | No accessibility tests                                                                                           | Quality   | Test script is placeholder         | RC-002         |

## 2. Technical Limitations

| #   | Limitation                                  | Scope              | Impact                       | Resolution         |
| --- | ------------------------------------------- | ------------------ | ---------------------------- | ------------------ |
| 7   | tRPC v10/v11 version inconsistency          | Services           | Potential runtime issues     | Align to v11       |
| 8   | Zod version inconsistency (^3.24 vs ^3.25)  | Services           | Minor type safety gaps       | Align to ^3.25     |
| 9   | Vitest version inconsistency (^2.0 vs ^2.1) | Root vs workspaces | Minor test runner gaps       | Align to ^2.1      |
| 10  | ESLint: 13 errors in memory domain          | packages/domain    | Potential type safety issues | Fix in RC-002 prep |
| 11  | Prettier: 317 unformatted files             | All packages       | Code style inconsistency     | Run formatter      |

## 3. Documentation Limitations

| #   | Limitation                                | Impact               | Resolution            |
| --- | ----------------------------------------- | -------------------- | --------------------- |
| 12  | No published API reference (Swagger UI)   | Developer onboarding | Implement OpenAPI UI  |
| 13  | No deployment guide beyond Docker Compose | Operations           | Write deployment docs |

## 4. Security Limitations

| #   | Limitation                                          | Impact                  | Resolution                 |
| --- | --------------------------------------------------- | ----------------------- | -------------------------- |
| 14  | No CSP (Content Security Policy) headers configured | XSS mitigation          | Add to Next.js config      |
| 15  | npm audit not yet executed                          | Unknown vulnerabilities | Run on CI                  |
| 16  | Production secrets not generated                    | Cannot deploy           | Generate before production |

## 5. Performance Limitations

| #   | Limitation                              | Impact                         | Resolution                 |
| --- | --------------------------------------- | ------------------------------ | -------------------------- |
| 17  | No caching strategy for API responses   | Latency on repeated calls      | Implement caching layer    |
| 18  | No image optimization strategy verified | Potential large images         | Review Next.js Image usage |
| 19  | No load testing performed               | Unknown production performance | Schedule for RC-002        |

---

**Known Limitations:** ✅ DOCUMENTED — 19 limitations identified. None are release-blocking for RC-001.

# Security Platform

**BLP-002 — Document 08/15 — Technology Stack & Platform Decisions**
**Version:** 1.0
**Status:** LOCKED
**Owner:** Security Architect
**Created:** 2026-07-27
**Design Freeze:** 2026-07-27

---

## Purpose

This document defines the **security technology stack** for VedMoulya — authentication, authorization, encryption, key management, and security tooling.

---

## Decision Summary

| Decision            | Choice                                       | Status     |
| ------------------- | -------------------------------------------- | ---------- |
| Authentication      | **Auth.js v5** (NextAuth)                    | ✅ DECIDED |
| Authorization       | **CASL** (ability-based)                     | ✅ DECIDED |
| JWT Handling        | **jose** (JWT library)                       | ✅ DECIDED |
| Password Hashing    | **bcrypt** / **Argon2**                      | ✅ DECIDED |
| Encryption          | **Web Crypto API** + **AES-256-GCM**         | ✅ DECIDED |
| Audit Logging       | **Custom** (structured JSON, tamper-evident) | ✅ DECIDED |
| Secrets             | **Doppler** (MVP) → **Vault** (Enterprise)   | ✅ DECIDED |
| SAST                | **CodeQL** (GitHub-native)                   | ✅ DECIDED |
| Dependency Scanning | **Dependabot** + **Socket.dev**              | ✅ DECIDED |
| Secrets Scanning    | **GitHub Secret Scanning** + **TruffleHog**  | ✅ DECIDED |

---

## Authentication: Auth.js v5

### Decision

| Aspect      | Detail                                                  |
| ----------- | ------------------------------------------------------- |
| **Choice**  | Auth.js v5 (NextAuth) — framework-agnostic auth library |
| **Purpose** | User authentication across all services                 |

### Alternatives Considered

| Alternative       | Pros                                                               | Cons                              | Verdict     |
| ----------------- | ------------------------------------------------------------------ | --------------------------------- | ----------- |
| **Auth.js v5**    | Framework-agnostic, 80+ providers, TypeScript-native, session/ JWT | Next.js-centric ecosystem         | ✅ SELECTED |
| **Clerk**         | Excellent DX, pre-built UI                                         | Vendor lock-in, $95/month for pro | ❌          |
| **Supabase Auth** | Built-in with Supabase                                             | Tight to Supabase ecosystem       | ❌          |
| **Okta/Auth0**    | Enterprise-grade                                                   | Expensive, overkill for MVP       | ❌          |

### Provider Configuration

| Provider       | Phase | Purpose                 |
| -------------- | ----- | ----------------------- |
| Email/Password | MVP   | Core authentication     |
| Google OAuth   | MVP   | Social login            |
| GitHub OAuth   | MVP   | Developer-focused login |
| Magic Link     | v1.1  | Passwordless option     |

---

## Authorization: CASL

### Decision

| Aspect      | Detail                                               |
| ----------- | ---------------------------------------------------- |
| **Choice**  | CASL (ability-based authorization library)           |
| **Purpose** | Fine-grained permission checking across all services |

### Why CASL

| Reason            | Detail                              |
| ----------------- | ----------------------------------- |
| TypeScript-native | Full type inference for abilities   |
| Declarative       | Define abilities as plain objects   |
| Universal         | Works on frontend and backend       |
| Simple            | No complex RBAC/ABAC infrastructure |

---

## Compliance References

| Reference      | Requirements                                                                  |
| -------------- | ----------------------------------------------------------------------------- |
| CMP-002        | Authentication, authorization, encryption, audit logging, data classification |
| DES-010A / D13 | Privacy by default, data minimization, user consent                           |

---

## Cross-References

| Reference     | Relationship                                           |
| ------------- | ------------------------------------------------------ |
| BLP-002 / D07 | Security scanning integrated into CI/CD pipeline       |
| BLP-002 / D09 | Audit events are part of the observability platform    |
| BLP-002 / D12 | Decision Record — TDR-008 (Security Platform Decision) |
| CMP-002       | Compliance framework defines security requirements     |

---

## Quality Review

| Dimension              | Assessment                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Why**                | Security platform decisions determine user data safety, compliance status, and breach risk.                     |
| **Business Impact**    | Auth.js reduces auth implementation time by 80%. CASL enables fine-grained permissions without RBAC complexity. |
| **Engineering Impact** | Auth.js provides 80+ OAuth providers out of the box. CASL works on both frontend and backend.                   |
| **Operational Impact** | Auth.js is zero-ops. JWT-based sessions require no session store.                                               |
| **Security Impact**    | Auth.js follows security best practices (CSRF, HTTP-only cookies, PKCE).                                        |
| **Performance Impact** | JWT validation is sub-millisecond. CASL ability checks are in-memory.                                           |
| **Cost Impact**        | Auth.js is free. CASL is free. Security scanning tools have free tiers.                                         |
| **Future Scalability** | Auth.js supports any database. CASL scales to complex permission models.                                        |

---

## Design Freeze Status

| Status    | Date       | Notes                                                        |
| --------- | ---------- | ------------------------------------------------------------ |
| ✅ LOCKED | 2026-07-27 | Security Platform v1.0 frozen. Changes require CTO approval. |

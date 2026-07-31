# Authentication Strategy

**TECH-001 — Document 06/10 — Technology Decision Record**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Technology Officer (CTO)
**Created:** 2026-07-27
**Cross-references:** CMP-002, ARC-001, ENG-002, ENG-003, ENG-004, IMP-001/D02, IMP-001/D06

---

## Purpose

This TDR defines the **authentication and identity strategy** for VedMoulya — how users authenticate, how sessions are managed, how authorization is enforced, and how the platform scales from password-based auth to enterprise SSO.

---

## Authentication Philosophy

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION PHILOSOPHY                                   │
│                                                                               │
│  1. SECURITY BY DEFAULT — Authentication is never optional.                   │
│     Every API endpoint is authenticated unless explicitly marked public.       │
│                                                                               │
│  2. PROGRESSIVE AUTH — Start simple (email/password), add options as needed. │
│     Don't build enterprise auth in MVP.                                       │
│                                                                               │
│  3. USER DATA SOVEREIGNTY — Authentication authenticates the user.            │
│     It does not give the platform ownership of user data.                     │
│                                                                               │
│  4. BUY, NOT BUILD — Authentication is a well-solved problem.                 │
│     Use established libraries and services. Do NOT build auth from scratch.   │
│                                                                               │
│  5. AUDIT EVERYTHING — Every authentication event is auditable.               │
│     Login, logout, failed attempts, permission changes, role changes.         │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Identity & Authentication Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    IDENTITY & AUTHENTICATION ARCHITECTURE                      │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 1: IDENTITY SERVICE (OWNED)                                   │    │
│  │                                                                        │    │
│  │  ▸ User registration and profile management                           │    │
│  │  ▸ Identity verification (email, phone)                               │    │
│  │  ▸ Password management and recovery                                   │    │
│  │  ▸ Social login linkage (Google, GitHub)                              │    │
│  │  ▸ User preferences and settings                                      │    │
│  │  ▸ Data portability (export, delete)                                  │    │
│  │                                                                        │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                    │                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 2: AUTHENTICATION (BUY — Library/Service)                      │    │
│  │                                                                        │    │
│  │  ▸ Token generation and validation (JWT-based)                       │    │
│  │  ▸ Session management                                                  │    │
│  │  ▸ Password hashing (bcrypt/argon2)                                   │    │
│  │  ▸ Social login OAuth flows (Google, GitHub)                          │    │
│  │  ▸ MFA/TOTP support (Growth phase)                                    │    │
│  │  ▸ Rate limiting on auth endpoints                                    │    │
│  │                                                                        │    │
│  │  CANDIDATE LIBRARIES: NextAuth.js (Lucia), Supabase Auth, WorkOS      │    │
│  │                                                                        │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                    │                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │  LAYER 3: AUTHORIZATION (OWNED)                                      │    │
│  │                                                                        │    │
│  │  ▸ Role-based access control (RBAC) — user → role → permission       │    │
│  │  ▸ Resource-based authorization — who can access which data          │    │
│  │  ▸ Data-level authorization — field-level access based on role       │    │
│  │  ▸ API authorization middleware — every endpoint checks permissions   │    │
│  │  ▸ Audit log of permission checks and grants                          │    │
│  │                                                                        │    │
│  │  MVP: Simple RBAC (user, admin)                                       │    │
│  │  Growth: Fine-grained permissions per service                         │    │
│  │  Enterprise: ABAC (attribute-based access control)                    │    │
│  │                                                                        │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Authentication Evolution

### MVP Phase (Phases 1-4)

| Feature                | Implementation                                                                 | Rationale                                  |
| ---------------------- | ------------------------------------------------------------------------------ | ------------------------------------------ |
| **Email/Password**     | Hashed with bcrypt/argon2. Minimum 8 characters.                               | Simple, universal. No external dependency. |
| **Email Verification** | OTP or magic link. TTL 15 minutes.                                             | Prevents unverified accounts.              |
| **Session Tokens**     | JWT with short expiry (15 min access + 7 day refresh).                         | Stateless. No session store for MVP.       |
| **Social Login**       | Google OAuth 2.0 + GitHub OAuth (NextAuth.js).                                 | Reduces signup friction.                   |
| **Password Reset**     | Email magic link. TTL 1 hour.                                                  | Standard pattern.                          |
| **Rate Limiting**      | Per IP: 5 failed attempts → 15 min lockout. Per email: 3 password resets/hour. | Prevents brute force.                      |
| **Authorization**      | Simple RBAC: `user`, `admin`. Permission checks in middleware.                 | Sufficient for MVP.                        |

### Growth Phase (Phases 5-6)

| Feature                   | Implementation                                            |
| ------------------------- | --------------------------------------------------------- |
| **MFA/TOTP**              | Time-based one-time passwords. App-based (Authenticator). |
| **Passkeys**              | WebAuthn/FIDO2 for passwordless authentication.           |
| **Session Management UI** | View active sessions, revoke remotely.                    |
| **API Tokens**            | Personal access tokens for API access.                    |
| **Granular RBAC**         | Service-specific roles (career:editor, knowledge:viewer). |

### Enterprise Phase (Phase 7+)

| Feature                   | Implementation                                                |
| ------------------------- | ------------------------------------------------------------- |
| **SSO/SAML**              | Enterprise single sign-on (Okta, Azure AD, Google Workspace). |
| **SCIM**                  | User provisioning/deprovisioning.                             |
| **Directory Sync**        | Sync user lists from enterprise directory.                    |
| **Custom Auth Providers** | Allow enterprise to configure their own identity provider.    |
| **ABAC**                  | Attribute-based access control for fine-grained permissions.  |

---

## Authorization Model

### MVP Authorization

```text
ROLES:
  ┌────────┐      ┌────────────┐      ┌──────────────┐
  │ User   │─────→│ Admin       │─────→│ Super Admin   │
  └────────┘      └────────────┘      └──────────────┘

PERMISSIONS (MVP):
  ┌────────────────────────────┬──────────┬─────────┐
  │ Resource                    │ User     │ Admin   │
  ├────────────────────────────┼──────────┼─────────┤
  │ Own Profile (read)         │ ✅       │ ✅      │
  │ Own Profile (write)        │ ✅       │ ✅      │
  │ Other Profiles (read)      │ Limited  │ ✅      │
  │ Own Career Data             │ ✅       │ ✅      │
  │ Own Learning Data           │ ✅       │ ✅      │
  │ System Configuration        │ ❌       │ ✅      │
  │ User Management             │ ❌       │ ✅      │
  │ Audit Logs                  │ Own only │ ✅     │
  │ Analytics Dashboard         │ Own only │ ✅     │
  └────────────────────────────┴──────────┴─────────┘
```

### Authorization Enforcement

| Layer             | Enforcement                                                 | Technology             |
| ----------------- | ----------------------------------------------------------- | ---------------------- |
| **API Gateway**   | Authenticate request (validate JWT). Block unauthenticated. | Custom middleware      |
| **Service Layer** | Authorize action (check role/permission for the action).    | Custom middleware      |
| **Data Layer**    | Filter data by ownership/access level.                      | Query-level filtering  |
| **UI Layer**      | Show/hide UI elements based on permissions.                 | Client-side role check |

---

## Session Management

| Aspect                    | MVP Approach                           | Growth Approach               | Enterprise Approach              |
| ------------------------- | -------------------------------------- | ----------------------------- | -------------------------------- |
| **Token Type**            | JWT (stateless)                        | JWT + refresh tokens          | JWT + opaque tokens              |
| **Access Token TTL**      | 15 minutes                             | 15 minutes                    | 15 minutes                       |
| **Refresh Token TTL**     | 7 days                                 | 30 days                       | Configurable                     |
| **Token Storage**         | localStorage (web)                     | httpOnly cookie               | httpOnly cookie + secure storage |
| **Multi-device**          | One session at a time                  | Multiple concurrent sessions  | Unlimited                        |
| **Session Revocation**    | Password change = all sessions revoked | Individual session revocation | Real-time via event bus          |
| **Device Fingerprinting** | Not implemented                        | Basic (user agent, IP)        | Advanced (behavioral)            |

---

## Pros & Cons

| Pros                                              | Cons                                                  |
| ------------------------------------------------- | ----------------------------------------------------- |
| Buy auth library — not building from scratch      | Still requires security expertise to configure        |
| Progressive auth — simple MVP, complex enterprise | Migration from simple to enterprise requires planning |
| JWT-based — stateless, no session store for MVP   | JWT revocation requires short expiry + refresh tokens |
| RBAC is well-understood — easy to implement       | Fine-grained permissions add complexity               |
| Social login reduces registration friction        | Social login adds OAuth flow complexity               |

### Trade-offs Accepted

| Trade-off                                      | Why Acceptable                                                                                           |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| JWT in localStorage (MVP) vs. httpOnly cookies | MVP is web-only. localStorage is acceptable for MVP. HttpOnly cookies added with backend API extraction. |
| Simple RBAC vs. ABAC                           | MVP doesn't need attribute-based access control. ABAC added for enterprise multi-tenancy.                |
| Buy auth library vs. build fully custom        | Auth is well-solved. Custom auth would be security risk.                                                 |
| Social login dependency                        | Google/GitHub are stable OAuth providers. Users without these can use email/password.                    |

### Migration Strategy

| Scenario                            | Migration Path                                                                       | Cost               |
| ----------------------------------- | ------------------------------------------------------------------------------------ | ------------------ |
| JWT localStorage → httpOnly cookies | Switch token storage. Update frontend to send cookie. Update backend to read cookie. | Low (days)         |
| Simple RBAC → Fine-grained RBAC     | Add permission service. Update middleware. Migrate role assignments.                 | Medium (sprint)    |
| RBAC → ABAC                         | Add attribute engine. Define attribute rules. Migrate permission checks.             | High (2-3 sprints) |
| Custom auth → Enterprise SSO        | Add SAML/OIDC support alongside existing auth. Enterprise users choose SSO.          | Medium (sprint)    |
| Auth library migration              | Library change is isolated to auth module. No other service affected.                | Medium (sprint)    |

---

## Cross-References

| Reference   | Relationship                                                                                                      |
| ----------- | ----------------------------------------------------------------------------------------------------------------- |
| CMP-002     | Authentication is the first line of compliance — identity verification, session management, MFA                   |
| ARC-001     | Principle #3 (Privacy First) — authentication protects user data. Principle #6 (Secure) — auth enforces security. |
| ENG-002     | Security Service contract and Identity Service contract are implemented by this strategy                          |
| ENG-003     | Information Classification (D05) — auth enforces access based on data classification                              |
| ENG-004/D09 | Principle #3 (Privacy First) — authentication controls data access                                                |
| IMP-001/D02 | Identity Service implemented in Phase 1 (Week 5). Social login in Phase 2. Enterprise SSO in Phase 7.             |
| IMP-001/D06 | Security and Identity are Tier 0 foundation services — built first                                                |

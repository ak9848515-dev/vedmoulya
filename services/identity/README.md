# @vedmoulya/identity — Identity Platform

## Overview

The Identity bounded context is the authoritative source of **who the user is**, **how the platform understands the user**, and **how every other engine identifies the user**. This is **not** just authentication — Identity is the foundation for the entire VedMoulya platform.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Presentation Layer                         │
│  Hono Routes  │  tRPC Router  │  OpenAPI  │  Validation     │
├─────────────────────────────────────────────────────────────┤
│                   Application Layer                          │
│  IdentityApplicationService  │  AuthService  │  AuthzService │
├─────────────────────────────────────────────────────────────┤
│                   Domain Layer                               │
│  User  │  Value Objects  │  Events  │  Rules  │  Factory    │
├─────────────────────────────────────────────────────────────┤
│                   Infrastructure Layer                       │
│  Drizzle ORM  │  Postgres  │  Redis  │  Event Bus  │  DI    │
└─────────────────────────────────────────────────────────────┘
```

## Domain Model

### Entities

- **User** — Aggregate root with identity, profile, preferences, settings, status, role, and lifecycle behavior

### Value Objects

- **UserId** — Branded string type for type-safe identification
- **Email** — Validated email with normalization
- **UserProfile** — Display name, given/family names, avatar, bio, timezone, locale
- **UserPreferences** — Theme, language, notification settings
- **IdentitySettings** — Security, privacy, and session settings
- **IdentityStatus** — State machine (pending → active → suspended → deleted/locked)
- **Password** — Strength validation and hashing support
- **Role** — Admin, moderator, premium, user, guest with hierarchy and permissions

### Domain Events

19 event types covering user lifecycle, profile changes, authentication, and authorization.

## Authentication

### Email/Password

- Bcrypt password hashing (configurable rounds)
- JWT access tokens + refresh tokens via `jose`

### Google OAuth2

- Full OAuth2 authorization code flow
- Token exchange, profile fetching, auto-registration

### Token Strategy

| Token   | Type        | Expiry | Purpose           |
| ------- | ----------- | ------ | ----------------- |
| Access  | JWT (HS256) | 15m    | API authorization |
| Refresh | JWT (HS256) | 7d     | Token renewal     |

## Authorization

CASL-based authorization with 5 roles:

| Role      | Level | Access                              |
| --------- | ----- | ----------------------------------- |
| Admin     | 100   | Full system access                  |
| Moderator | 30    | Content management, user moderation |
| Premium   | 20    | Own content + analytics             |
| User      | 10    | Standard platform access            |
| Guest     | 0     | Read-only public content            |

### Policies

Resource-specific policies for: User, Content, Analytics, Billing, Team

## API Endpoints

### Users (REST)

- `POST /api/v1/identity/users` — Register
- `GET /api/v1/identity/users` — List (paginated)
- `GET /api/v1/identity/users/:id` — Get by ID
- `GET /api/v1/identity/users/email/:email` — Get by email
- `PATCH /api/v1/identity/users/:id/profile` — Update profile
- `PATCH /api/v1/identity/users/:id/preferences` — Update preferences
- `PATCH /api/v1/identity/users/:id/settings` — Update settings
- `DELETE /api/v1/identity/users/:id` — Archive (soft delete)
- `POST /api/v1/identity/users/:id/activate` — Activate
- `POST /api/v1/identity/users/:id/deactivate` — Deactivate

### Authentication (REST)

- `POST /api/v1/identity/auth/sign-in` — Email/password sign-in
- `POST /api/v1/identity/auth/sign-up` — Registration
- `POST /api/v1/identity/auth/sign-out` — Sign-out
- `POST /api/v1/identity/auth/refresh` — Token refresh
- `GET /api/v1/identity/auth/session` — Verify session
- `GET /api/v1/identity/auth/google/url` — Get Google OAuth URL
- `GET /api/v1/identity/auth/google/callback` — Google OAuth callback

### tRPC Procedures

All operations available via tRPC: `getUserById`, `getUserByEmail`, `listUsers`, `registerUser`, `updateProfile`, `updatePreferences`, `updateSettings`, `activateUser`, `deactivateUser`, `archiveUser`, `checkAuthentication`

## Observability

### Metrics

15 metric counters tracking: registrations, logins, profile updates, auth attempts, token operations, authorization checks

### Audit Events

22 audit action types with structured logging and correlation IDs covering all identity operations

### Tracing

OpenTelemetry-compatible span wrappers for identity operations

## Configuration

See `packages/core/src/config/index.ts` for all configuration options:

```env
AUTH_JWT_SECRET=your-secret
AUTH_JWT_EXPIRES_IN=15m
AUTH_REFRESH_EXPIRES_IN=7d
AUTH_BCRYPT_ROUNDS=12
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
IDENTITY_DATABASE_URL=postgres://localhost:5432/vedmoulya
```

## Dependencies

- `@vedmoulya/core` — Base types, errors, config, DI, event bus
- `@vedmoulya/domain` — Domain entities and value objects
- `@vedmoulya/services` — Application services
- `drizzle-orm` — Database ORM
- `hono` — HTTP framework
- `jose` — JWT signing/verification
- `bcrypt` — Password hashing
- `@casl/ability` — Authorization
- `zod` — Validation
- `@trpc/server` — Type-safe RPC

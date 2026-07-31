# Notifications Module

**Purpose:** Notifications bounded context within the VedMoulya domain model. Provides domain entities, value objects, use cases, infrastructure adapters, and presentation contracts for the notifications domain.

**Owner:** Engineering Team

## Layers

- **application/** — Use cases, DTOs, and service interfaces
- **domain/** — Entities, value objects, events, and domain services (zero external dependencies)
- **infrastructure/** — Persistence adapters, external API clients, and configuration
- **presentation/** — API controllers, middleware, and route definitions

## Dependencies

- `@vedmoulya/core` — Base types, errors, configuration
- `@vedmoulya/domain` — Shared domain entity types

## Future Expansion

- Complete domain entity and value object definitions
- Application use case implementations
- Infrastructure persistence layer
- REST API controllers and route handlers

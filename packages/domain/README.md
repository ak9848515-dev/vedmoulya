# @vedmoulya/domain

**Purpose:** Core domain model — entities, value objects, domain events, and domain services that define VedMoulya's business concepts. Technology-agnostic and framework-free per Domain Layer Purity (Architecture Rule 1.3).

**Owner:** Engineering Team

## Contents

- `src/entities/` — Domain entities with identity
- `src/value-objects/` — Immutable value objects
- `src/events/` — Domain event definitions
- `src/services/` — Domain service interfaces

## Dependencies

- `@vedmoulya/core` — Base types, errors, and utilities

## Usage

```typescript
import { User } from '@vedmoulya/domain';
```

## Future Expansion

- Complete entity definitions for all bounded contexts
- Domain event schemas with versioning
- Validation rules and domain constraints

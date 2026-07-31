# @vedmoulya/services

**Purpose:** Service contract definitions — interfaces, DTOs, and client libraries for communicating with backend services. Provides type-safe service client abstractions.

**Owner:** Engineering Team

## Contents

- `src/types/` — Service interface type definitions
- `src/constants/` — Service endpoint constants
- `src/errors/` — Service-specific error types

## Dependencies

- `@vedmoulya/core` — Base types and utilities
- `@vedmoulya/domain` — Domain entity types used in service contracts

## Usage

```typescript
import type { IdentityService } from '@vedmoulya/services';
```

## Future Expansion

- Service client implementations
- Type-safe API client generators
- Service mesh integration types

# @vedmoulya/testing

**Purpose:** Shared test utilities — test helpers, mock factories, fixture generators, and test infrastructure shared across all packages and services.

**Owner:** Engineering Team — QA

## Contents

- `src/types/` — Test-specific type definitions
- `src/constants/` — Test configuration constants
- `src/errors/` — Test error types
- `src/utils/` — Test helper utilities

## Dependencies

- `@vedmoulya/core` — Base types and utilities
- `@vedmoulya/domain` — Domain entity test factories

## Usage

```typescript
import { createTestUser, createMockRepository } from '@vedmoulya/testing';
```

## Future Expansion

- Test fixture factories for all domain entities
- Mock service implementations
- Test database helpers
- Integration test infrastructure

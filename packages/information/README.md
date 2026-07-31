# @vedmoulya/information

**Purpose:** Information architecture — data classification, lifecycle management, lineage tracking, and governance for all information types flowing through the platform.

**Owner:** Engineering Team

## Contents

- `src/types/` — Information type definitions
- `src/constants/` — Classification and lifecycle constants
- `src/errors/` — Information-specific error types

## Dependencies

- `@vedmoulya/core` — Base types and utilities

## Usage

```typescript
import { InformationType, Classification } from '@vedmoulya/information';
```

## Future Expansion

- Data classification schemas per ENG-003
- Information lifecycle state machines
- Lineage tracking infrastructure
- Consent management types

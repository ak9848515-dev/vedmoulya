# @vedmoulya/shared

**Purpose:** Shared utility functions — cross-cutting helpers, date formatting, string manipulation, validation primitives, and other common utilities used across all packages.

**Owner:** Engineering Team

## Contents

- `src/types/` — Shared type definitions
- `src/constants/` — Shared constants
- `src/errors/` — Shared error types
- `src/utils/` — Utility functions

## Dependencies

- `@vedmoulya/core` — Base types and utilities

## Usage

```typescript
import { formatDate, slugify, truncate } from '@vedmoulya/shared';
```

## Future Expansion

- Date/time manipulation utilities
- String and text processing helpers
- Validation composition helpers
- Data transformation utilities

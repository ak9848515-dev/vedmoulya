# @vedmoulya/config

**Purpose:** Shared configuration — environment variable definitions, configuration schemas, and default values shared across all packages and services.

**Owner:** Engineering Team

## Contents

- `src/types/` — Configuration type definitions
- `src/constants/` — Configuration defaults
- `src/errors/` — Configuration validation errors

## Dependencies

- `@vedmoulya/core` — Base types and utilities

## Usage

```typescript
import { loadConfig, AppConfig } from '@vedmoulya/config';
```

## Future Expansion

- Configuration schema validation
- Environment-specific configuration profiles
- Runtime configuration reload
- Encrypted configuration value types

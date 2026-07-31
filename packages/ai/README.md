# @vedmoulya/ai

**Purpose:** AI integration contracts — provider abstraction interfaces, context assembly types, response validation schemas, and prompt management types for the AI Orchestrator.

**Owner:** Engineering Team — AI

## Contents

- `src/providers/` — AI provider interface definitions
- `src/context/` — Context assembly type definitions
- `src/validation/` — Response validation types

## Dependencies

- `@vedmoulya/core` — Base types and utilities
- `@vedmoulya/domain` — Domain entity types

## Usage

```typescript
import type { AiProvider, ContextSlice } from '@vedmoulya/ai';
```

## Future Expansion

- Provider capability registration types
- Context assembly strategy interfaces
- Response validation gate definitions
- Prompt template management types

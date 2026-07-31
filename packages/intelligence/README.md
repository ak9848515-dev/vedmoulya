# @vedmoulya/intelligence

**Purpose:** Intelligence engine contracts — interfaces and types for Decision Engine, Execution Engine, Knowledge Graph, and AI Orchestrator integration points.

**Owner:** Engineering Team

## Contents

- `src/types/` — Intelligence contract type definitions
- `src/constants/` — Engine configuration constants

## Dependencies

- `@vedmoulya/core` — Base types and utilities
- `@vedmoulya/domain` — Domain entity types

## Usage

```typescript
import type { DecisionEngine, ExecutionEngine } from '@vedmoulya/intelligence';
```

## Future Expansion

- Decision scoring algorithm contracts
- Execution lifecycle state machine types
- Knowledge graph query interfaces
- Provider routing strategy types

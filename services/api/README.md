# @vedmoulya/api — API Gateway

**Purpose:** API Gateway — routes external client requests to appropriate backend services. Handles authentication, rate limiting, request validation, and response formatting.

**Owner:** Engineering Team — Backend

## Dependencies

- `@vedmoulya/core` — Base types, errors, configuration
- `@vedmoulya/domain` — Domain entity types

## Structure

- `src/routes/` — Route definitions and endpoint handlers
- `src/middleware/` — Authentication, validation, logging middleware
- `src/validators/` — Request validation schemas
- `src/handlers/` — Request response handlers

## Future Expansion

- OpenAPI specification generation
- Rate limiting and throttling
- Circuit breaker pattern for downstream services
- API versioning strategy

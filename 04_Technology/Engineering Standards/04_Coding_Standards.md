# Coding Standards

**TECH-002 — Document 04/10 — Engineering Standards Manual**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Engineering Officer (CEngO)
**Created:** 2026-07-27
**Cross-references:** CMP-001, ARC-001, ENG-001, ENG-002, TECH-001/D08, TECH-001/D09, TECH-002/D03, 09_Documents/Coding Standards.md

---

## Purpose

This document defines the **mandatory coding standards** for all VedMoulya code. Every line of code written — by humans or AI — must comply with these standards. These standards supersede and formalize the earlier 09_Documents/Coding Standards.md.

---

## General Coding Principles

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    CODING PRINCIPLES                                      │
│                                                                           │
│  1. READABILITY OVER CLEVERNESS — Code is written for humans first       │
│  2. CONSISTENCY — Follow existing patterns; if you improve a pattern,   │
│     improve it everywhere it appears                                    │
│  3. SIMPLICITY — The simplest correct solution is the best solution      │
│  4. EXPLICIT OVER IMPLICIT — Intent is expressed clearly in code         │
│  5. COMPOSABILITY — Prefer composition over inheritance                  │
│  6. DEFENSIVE — Validate inputs, handle errors, never trust external data │
│  7. TESTABLE — Every function should be testable in isolation            │
│  8. DOCUMENTED — Public APIs documented; complex logic explained         │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## TypeScript Standards

### TypeScript Configuration

| Setting                      | Value     | Rationale                                 |
| ---------------------------- | --------- | ----------------------------------------- |
| `strict`                     | `true`    | Enable all strict type-checking options   |
| `noUncheckedIndexedAccess`   | `true`    | Prevent undefined access on indexed types |
| `exactOptionalPropertyTypes` | `true`    | `undefined` vs. not present distinction   |
| `noImplicitReturns`          | `true`    | Every code path must return               |
| `noFallthroughCasesInSwitch` | `true`    | No accidental fall-through                |
| `strictNullChecks`           | `true`    | Null/undefined are explicit               |
| `target`                     | `ES2022`  | Modern JavaScript features                |
| `module`                     | `ESNext`  | For tree-shaking compatibility            |
| `moduleResolution`           | `bundler` | Works with modern bundlers                |

### Type Rules

```typescript
// ✅ GOOD: Explicit types on public APIs
export function getUserById(id: string): Promise<User | null>;

// ✅ GOOD: Use type inference for internal variables
const user = await getUserById('123'); // Type inferred

// ❌ BAD: Redundant type annotation on obvious expression
const user: User = await getUserById('123');

// ✅ GOOD: Branded types for domain primitives
type UserId = string & { readonly __brand: 'UserId' };
type Email = string & { readonly __brand: 'Email' };

// ❌ BAD: Primitive obsession
function getUser(id: string); // What kind of string? UserId? Email? Session?

// ✅ GOOD: Discriminated unions over optional fields
type Result<T> = { status: 'success'; data: T } | { status: 'error'; error: Error; code: number };

// ❌ BAD: Implicit state with optional fields
type Result<T> = {
  data?: T;
  error?: Error;
  code?: number;
};
```

### Naming Convention Enforcement

| Rule                              | Tool                                          | Behavior                          |
| --------------------------------- | --------------------------------------------- | --------------------------------- |
| PascalCase for classes/types      | ESLint `@typescript-eslint/naming-convention` | Error                             |
| camelCase for variables/functions | ESLint                                        | Error                             |
| No `I` prefix for interfaces      | ESLint                                        | Error                             |
| No Hungarian notation             | ESLint                                        | Error                             |
| No unused variables               | `@typescript-eslint/no-unused-vars`           | Error                             |
| No explicit `any`                 | `@typescript-eslint/no-explicit-any`          | Error (exception: migration data) |

**Cross-Reference:** TECH-002/D03 (Naming Conventions)

---

## Code Style

### Formatting

| Setting             | Value             | Tool                |
| ------------------- | ----------------- | ------------------- |
| **Formatter**       | Prettier          | Auto-format on save |
| **Semicolons**      | Required          | Prettier            |
| **Quotes**          | Single quotes     | Prettier            |
| **Trailing commas** | All (where valid) | Prettier            |
| **Print width**     | 100 characters    | Prettier            |
| **Tab width**       | 2 spaces          | Prettier            |
| **Bracket spacing** | true              | Prettier            |

### Imports

```typescript
// ✅ GOOD: Ordered imports (auto-fixed by ESLint)
// 1. External libraries (alphabetical)
import { z } from 'zod';
import { describe, expect, it } from 'vitest';

// 2. Internal package imports (alphabetical by path)
import { User } from '@vedmoulya/domain';
import { createUser } from '@vedmoulya/identity';

// 3. Relative imports (alphabetical by path)
import { UserRepository } from '../repositories/user.repository';
import { UserService } from './user.service';

// 4. Type imports (grouped with `import type`)
import type { UserProfile, UserRole } from '../types/user.type';

// ❌ BAD: Mixed import sources, no grouping
import { User } from '@vedmoulya/domain';
import { helper } from '../../../utils/helper';
import { z } from 'zod';
```

### Functions

```typescript
// ✅ GOOD: Pure functions (no side effects) are preferred
export function calculateScore(achievements: Achievement[], weights: ScoreWeights): number {
  return achievements.reduce(
    (total, achievement) => total + achievement.value * weights.default,
    0,
  );
}

// ✅ GOOD: Early returns over nested if-else
export function validateUser(user: unknown): ValidationResult {
  if (!user) return { valid: false, reason: 'User is required' };
  if (typeof user !== 'object') return { valid: false, reason: 'User must be an object' };
  if (!('email' in user)) return { valid: false, reason: 'Email is required' };
  return { valid: true };
}

// ❌ BAD: Deeply nested if-else
export function validateUser(user: unknown): ValidationResult {
  if (user) {
    if (typeof user === 'object') {
      if ('email' in user) {
        return { valid: true };
      } else {
        return { valid: false, reason: 'Email is required' };
      }
    } else {
      return { valid: false, reason: 'User must be an object' };
    }
  } else {
    return { valid: false, reason: 'User is required' };
  }
}
```

### Error Handling

```typescript
// ✅ GOOD: Custom error classes with cause and context
export class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`User not found: ${userId}`);
    this.name = 'UserNotFoundError';
  }
}

// ✅ GOOD: Result type for expected failures
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

export async function findUser(id: string): Promise<Result<User, UserNotFoundError>> {
  const user = await repository.findById(id);
  if (!user) return { ok: false, error: new UserNotFoundError(id) };
  return { ok: true, value: user };
}

// ❌ BAD: Throwing for expected cases
export async function findUser(id: string): Promise<User> {
  const user = await repository.findById(id);
  if (!user) throw new NotFoundError('User not found'); // Control flow via exceptions
  return user;
}

// ❌ BAD: Catching without rethrowing or handling
try {
  await processUser(userId);
} catch (error) {
  console.error(error); // Silent catch
}
```

---

## SOLID Principles in Practice

### Single Responsibility

```typescript
// ✅ GOOD: Each class has one reason to change
export class UserValidator {
  validate(user: unknown): ValidationResult {
    /* ... */
  }
}

export class UserRepository {
  async save(user: User): Promise<void> {
    /* ... */
  }
}

export class EmailNotifier {
  async sendWelcomeEmail(email: Email): Promise<void> {
    /* ... */
  }
}

// ❌ BAD: One class doing everything
export class UserService {
  validate(user: unknown) {
    /* ... */
  }
  save(user: User) {
    /* ... */
  }
  sendEmail(email: Email) {
    /* ... */
  }
  generateReport() {
    /* ... */
  }
}
```

### Open/Closed

```typescript
// ✅ GOOD: Open for extension, closed for modification
export interface ScoreCalculator {
  calculate(score: Score): number;
}

export class WeightedScoreCalculator implements ScoreCalculator {
  calculate(score: Score): number {
    return score.value * score.weight;
  }
}

export class BoostedScoreCalculator implements ScoreCalculator {
  constructor(private readonly boostFactor: number) {}
  calculate(score: Score): number {
    return score.value * this.boostFactor;
  }
}
```

### Liskov Substitution

```typescript
// ✅ GOOD: Subtypes are substitutable for base types
interface NotificationSender {
  send(message: string): Promise<void>;
}

class EmailSender implements NotificationSender {
  async send(message: string): Promise<void> {
    // Sends email — satisfies the contract without weakening postconditions
  }
}

class SMSSender implements NotificationSender {
  async send(message: string): Promise<void> {
    // Sends SMS — preserves all base type expectations
  }
}

// Any NotificationSender works with this service
class NotificationService {
  constructor(private readonly sender: NotificationSender) {}
}

// ❌ BAD: Violates LSP — throws unexpected error, weakens postconditions
class BrokenSender implements NotificationSender {
  async send(message: string): Promise<void> {
    throw new Error('Not implemented'); // Caller cannot rely on send() completing
  }
}
```

### Interface Segregation

```typescript
// ✅ GOOD: Small, focused interfaces
interface UserReader {
  findById(id: UserId): Promise<User | null>;
}

interface UserWriter {
  save(user: User): Promise<void>;
  delete(id: UserId): Promise<void>;
}

// Consumers depend only on what they need
class UserProfileViewer {
  constructor(private readonly reader: UserReader) {}
}

class UserAdminService {
  constructor(
    private readonly reader: UserReader,
    private readonly writer: UserWriter,
  ) {}
}

// ❌ BAD: Fat interface forces clients to depend on methods they don't use
interface UserService {
  findById(id: UserId): Promise<User | null>;
  save(user: User): Promise<void>;
  delete(id: UserId): Promise<void>;
  generateReport(): Promise<Report>;
}
```

### Dependency Inversion

```typescript
// ✅ GOOD: Depend on abstractions, not concretions
export interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  save(user: User): Promise<void>;
}

export class UserService {
  constructor(private readonly repository: UserRepository) {}
  // Works with any UserRepository implementation
}

// ❌ BAD: Depending on concrete implementation
export class UserService {
  private repository = new PostgresUserRepository();
}
```

---

## Error Handling Patterns

### Global Error Handling Strategy

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    ERROR HANDLING HIERARCHY                                │
│                                                                           │
│  Level 1: EXPECTED ERRORS                                                │
│  ─────────────────────────────                                           │
│  • Invalid input, missing data, rate limits                              │
│  • Handle with Result<T, E> types                                        │
│  • Return graceful error messages                                        │
│                                                                           │
│  Level 2: UNEXPECTED ERRORS                                              │
│  ─────────────────────────────                                           │
│  • Database connection failure, external API timeout                     │
│  • Catch and wrap with context                                           │
│  • Log with correlation ID                                               │
│  • Return 500 with error ID (not details)                                │
│                                                                           │
│  Level 3: CATASTROPHIC ERRORS                                            │
│  ─────────────────────────────                                           │
│  • Out of memory, unrecoverable state                                    │
│  • Process crash and restart                                             │
│  • Alert on-call engineer                                                │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Logging Standards

| Aspect          | Standard                              | Example                                                                         |
| --------------- | ------------------------------------- | ------------------------------------------------------------------------------- |
| **Level**       | Use appropriate level                 | `error` (failures), `warn` (unexpected), `info` (milestones), `debug` (details) |
| **Context**     | Include correlation IDs               | `logger.info({ userId, requestId }, 'User profile updated')`                    |
| **No PII**      | Never log personal data               | Not `logger.info(`User email: ${email}`)`                                       |
| **Structured**  | Use structured logging                | JSON format, not string interpolation                                           |
| **Performance** | Debug logs compile away in production | Use conditional or level-gated logging                                          |

---

## Code Documentation

### JSDoc Standards

```typescript
// ✅ GOOD: Document public APIs with JSDoc
/**
 * Creates a new user profile
 *
 * @param params - The user creation parameters
 * @param params.email - User's email address (must be unique)
 * @param params.name - User's display name
 * @param params.role - User's role in the system
 * @returns The newly created user
 * @throws UserAlreadyExistsError if email is taken
 * @throws ValidationError if parameters are invalid
 *
 * @example
 * const user = await createUser({
 *   email: 'alice@example.com',
 *   name: 'Alice',
 *   role: 'user'
 * })
 */
export async function createUser(params: CreateUserParams): Promise<User>;

// ❌ BAD: Redundant JSDoc that repeats the obvious
/** @param id - The id */
/** @returns The user */
export async function getUserById(id: string): Promise<User>;

// ✅ BETTER: No JSDoc for obvious functions; clear types tell the story
export async function getUserById(id: UserId): Promise<User | null>;
```

### Inline Comments

```typescript
// ✅ GOOD: Explain WHY, not WHAT
// Using exponential backoff because the external API rate-limits aggressively
// and we've observed 429 errors within the first 3 retries
const MAX_RETRY_DELAY = 30_000;
const retryDelay = Math.min(100 * Math.pow(2, attempt), MAX_RETRY_DELAY);

// ❌ BAD: Explaining WHAT (the code already says this)
// Multiply by 2 to the power of attempt number
const retryDelay = 100 * Math.pow(2, attempt);
```

---

## Security Best Practices

| Practice                    | Standard                                              | Enforcement                 |
| --------------------------- | ----------------------------------------------------- | --------------------------- |
| **Input validation**        | Validate all external inputs (Zod schemas)            | ESLint + runtime validation |
| **SQL injection**           | Use parameterized queries only                        | ESLint plugin + code review |
| **XSS prevention**          | Never use `dangerouslySetInnerHTML`                   | ESLint rule                 |
| **Secrets**                 | Never hardcode; use env vars + secret manager         | PR review + `git secrets`   |
| **Authentication**          | Every endpoint authenticated unless explicitly public | Middleware check            |
| **Authorization**           | Verify permissions on every request                   | Middleware check            |
| **CSRF**                    | CSRF tokens for state-changing requests               | Framework default           |
| **Rate limiting**           | Rate limit all public endpoints                       | API gateway                 |
| **Dependency audit**        | `npm audit` on every build                            | CI gate                     |
| **Content Security Policy** | Set strict CSP headers                                | Security headers middleware |

**Cross-Reference:** CMP-002 (Security policies), ARC-001 (Principle #11: Secure by Design)

---

## Performance Guidelines

| Guideline             | Standard                                   | Why                              |
| --------------------- | ------------------------------------------ | -------------------------------- |
| **N+1 queries**       | Detect and eliminate                       | Use eager loading, batch queries |
| **Memory allocation** | Avoid unnecessary allocations in hot paths | GC pressure affects latency      |
| **Async everywhere**  | Never block the event loop                 | Use async/await for I/O          |
| **Bundle size**       | Monitor and optimize imports               | Use tree-shaking, code-splitting |
| **Lazy loading**      | Defer non-critical resources               | Faster initial load              |
| **Caching**           | Cache expensive computations               | Reduce latency, reduce load      |
| **Indexes**           | Query patterns drive index design          | Monitor slow queries             |

---

## Linting & Formatting

### Required Tools

| Tool           | Purpose                      | Configuration File |
| -------------- | ---------------------------- | ------------------ |
| **ESLint**     | Code quality and style rules | `eslint.config.js` |
| **Prettier**   | Code formatting              | `.prettierrc`      |
| **TypeScript** | Type checking                | `tsconfig.json`    |

### Pre-commit Hooks

```text
pre-commit hook (husky):
  1. lint-staged → ESLint + Prettier on staged files
  2. TypeScript type check (affected files)
  3. Unit tests (affected files)
  4. Secret scan (gitleaks or similar)
```

**Cross-Reference:** TECH-001/D08 (Developer Tooling - pre-commit, CI/CD)

---

## Cross-Reference Summary

| Reference                            | Relationship to Coding Standards                                     |
| ------------------------------------ | -------------------------------------------------------------------- |
| **TECH-002/D03**                     | Naming conventions enforced by linting rules                         |
| **TECH-001/D08**                     | Developer tooling (ESLint, Prettier, Husky) enforces these standards |
| **TECH-001/D09**                     | Testing standards work alongside coding standards                    |
| **ARC-001**                          | 12 Architecture Principles influence coding patterns                 |
| **ENG-001**                          | Domain-Driven Design patterns in code                                |
| **CMP-002**                          | Security best practices align with compliance requirements           |
| **09_Documents/Coding Standards.md** | Superseded by this document                                          |

---

## Document Governance

| Aspect                     | Standard                                                        |
| -------------------------- | --------------------------------------------------------------- |
| **Version**                | 1.0                                                             |
| **Status**                 | Final                                                           |
| **Owner**                  | Chief Engineering Officer (CEngO)                               |
| **Review Cadence**         | Semi-annually                                                   |
| **Approval Required**      | CEngO + CTO                                                     |
| **Violation Consequences** | CI pipeline blocks violations; PR reviewer requests remediation |

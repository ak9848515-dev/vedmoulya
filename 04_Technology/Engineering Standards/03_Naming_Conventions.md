# Naming Conventions

**TECH-002 — Document 03/10 — Engineering Standards Manual**
**Version:** 1.0
**Status:** Final
**Owner:** Chief Engineering Officer (CEngO)
**Created:** 2026-07-27
**Cross-references:** CMP-001, ENG-001/D09, ARC-001, TECH-001, 09_Documents/Coding Standards.md, 09_Documents/Company Glossary.md

---

## Purpose

This document defines the **naming conventions** for all VedMoulya code, files, databases, APIs, and documentation. Consistent naming reduces cognitive load, makes code searchable, and ensures AI assistants generate consistent code.

---

## Universal Rules

These rules apply to **all** naming contexts across the entire project:

| Rule                 | Explanation                                 | Bad Example                     | Good Example                                             |
| -------------------- | ------------------------------------------- | ------------------------------- | -------------------------------------------------------- |
| **Descriptive**      | Names reveal intent, not implementation     | `data`, `temp`, `x`             | `userProfile`, `temporaryAccessToken`                    |
| **Pronounceable**    | Names can be spoken in conversation         | `usrPrflSvc`                    | `userProfileService`                                     |
| **Searchable**       | Names can be found with grep                | `a`, `b`, `fn`                  | `authenticateUser`, `handleError`                        |
| **Unambiguous**      | Names have one clear meaning                | `getData` (what data?)          | `getUserProfile`                                         |
| **Domain-Aligned**   | Names use ubiquitous language (ENG-001/D09) | `createPersonRecord`            | `createUser`                                             |
| **No Abbreviations** | Unless universally understood               | `usr`, `cfg`, `req`             | `user`, `config`, `request`                              |
| **No Encoding**      | No type/scope prefixes                      | `strName`, `intCount`, `m_name` | `name`, `count`, `name_` (Hungarian notation prohibited) |
| **No Negatives**     | Avoid negated boolean names                 | `isNotDisabled`, `hasNoErrors`  | `isEnabled`, `hasErrors`                                 |

---

## Language-Specific Conventions

### TypeScript / JavaScript

| Element                      | Convention                                        | Example                                    | Notes                              |
| ---------------------------- | ------------------------------------------------- | ------------------------------------------ | ---------------------------------- |
| **Classes**                  | PascalCase                                        | `class UserProfileService`                 | Always singular                    |
| **Interfaces**               | PascalCase (no `I` prefix)                        | `interface UserRepository`                 | Never `IUserRepository`            |
| **Types**                    | PascalCase                                        | `type UserStatus = 'active' \| 'inactive'` |                                    |
| **Enums**                    | PascalCase (enum name), UPPER_SNAKE_CASE (values) | `enum UserRole { ADMIN, USER }`            |                                    |
| **Functions**                | camelCase                                         | `function getUserById()`                   | Verb or verb-noun                  |
| **Methods**                  | camelCase                                         | `this.calculateScore()`                    | Verb or verb-noun                  |
| **Variables**                | camelCase                                         | `const userName = 'Alice'`                 |                                    |
| **Constants (module-level)** | UPPER_SNAKE_CASE                                  | `const MAX_RETRY_COUNT = 3`                | Only for truly immutable constants |
| **Private class members**    | # prefix                                          | `this.#accessToken`                        | Use native private fields          |
| **Boolean variables**        | `is`, `has`, `should`, `can` prefix               | `isActive`, `hasPermission`, `shouldRetry` |                                    |
| **Async functions**          | No special suffix needed                          | `fetchUserData()`                          | Not `fetchUserDataAsync`           |
| **Event handlers**           | `on` prefix or `handle` prefix                    | `onSubmit`, `handleClick`                  |                                    |
| **Generics**                 | Single capital letter or descriptive PascalCase   | `<T>`, `<TEntity>`, `<TResponse>`          |                                    |

### Flutter / Dart (Phase 3+)

| Element               | Convention                  | Example                     |
| --------------------- | --------------------------- | --------------------------- |
| **Classes**           | PascalCase                  | `class UserProfileWidget`   |
| **Functions/Methods** | camelCase                   | `void buildWidget()`        |
| **Variables**         | camelCase                   | `var userName = 'Alice'`    |
| **Constants**         | lowerCamelCase (prefix `k`) | `const kMaxRetryCount = 3`  |
| **Files**             | snake_case                  | `user_profile_service.dart` |
| **Directories**       | snake_case                  | `user_profile/`             |

### Go (Phase 5+ — extracted services)

| Element                  | Convention             | Example                 |
| ------------------------ | ---------------------- | ----------------------- |
| **Packages**             | lowercase, single word | `package user`          |
| **Exported functions**   | PascalCase             | `func GetUserByID()`    |
| **Unexported functions** | camelCase              | `func calculateScore()` |
| **Files**                | snake_case             | `user_profile.go`       |

---

## File and Directory Naming

| Context                 | Convention                 | Example                    | Exception                               |
| ----------------------- | -------------------------- | -------------------------- | --------------------------------------- |
| **Source files**        | kebab-case                 | `user-profile.service.ts`  | React component files: `PascalCase.tsx` |
| **React components**    | PascalCase                 | `UserProfileCard.tsx`      |                                         |
| **Test files**          | `*.test.ts` or `*.spec.ts` | `user.service.test.ts`     |                                         |
| **Story files**         | `*.stories.tsx`            | `button.stories.tsx`       |                                         |
| **Config files**        | kebab-case                 | `vitest.config.ts`         |                                         |
| **Documentation**       | PascalCase with spaces     | `Repository Governance.md` |                                         |
| **Directories (docs)**  | Title Case                 | `Human Journey/`           |                                         |
| **Directories (code)**  | kebab-case                 | `user-profile/`            |                                         |
| **Top-level repo dirs** | Numbered PascalCase        | `03_Architecture`          | Per Repository Governance               |

---

## Database Naming

### PostgreSQL

| Element                | Convention                               | Example                                  | Notes                          |
| ---------------------- | ---------------------------------------- | ---------------------------------------- | ------------------------------ |
| **Databases**          | snake_case                               | `vedmoulya_production`                   |                                |
| **Schemas**            | snake_case                               | `identity`, `knowledge_graph`            | One schema per bounded context |
| **Tables**             | snake_case (plural)                      | `users`, `user_profiles`, `goals`        | Plural for table names         |
| **Columns**            | snake_case                               | `created_at`, `user_id`, `email_address` |                                |
| **Primary keys**       | `id`                                     | `id`                                     | Always `id` unless composite   |
| **Foreign keys**       | `{table}_id`                             | `user_id`, `goal_id`                     |                                |
| **Indexes**            | `idx_{table}_{columns}`                  | `idx_users_email`                        |                                |
| **Unique constraints** | `uq_{table}_{columns}`                   | `uq_users_email`                         |                                |
| **Timestamp columns**  | `created_at`, `updated_at`, `deleted_at` |                                          | Must be `TIMESTAMPTZ`          |
| **Boolean columns**    | `is_` or `has_` prefix                   | `is_active`, `has_completed_profile`     |                                |
| **JSON/JSONB columns** | `_data` suffix or descriptive            | `profile_data`, `metadata`               |                                |
| **Views**              | `v_{descriptive_name}`                   | `v_user_active_goals`                    |                                |
| **Triggers**           | `trg_{table}_{action}`                   | `trg_users_updated_at`                   |                                |
| **Enums**              | snake_case (lowercase)                   | `user_status`, `goal_priority`           |                                |

**Migration Naming:**

```text
{YYYY}{MM}{DD}_{HH}{MM}_{description}.sql
Example: 20260727_1200_create_users.sql
```

**Cross-Reference:** TECH-001/D04 (Data & Storage Decisions)

---

## API Naming

### RESTful APIs

| Element              | Convention                           | Example                             | Notes                      |
| -------------------- | ------------------------------------ | ----------------------------------- | -------------------------- |
| **Resources**        | Plural nouns                         | `/users`, `/goals`, `/missions`     | Always plural              |
| **Collection**       | `GET /{resources}`                   | `GET /users`                        |                            |
| **Single item**      | `GET /{resources}/{id}`              | `GET /users/{userId}`               |                            |
| **Create**           | `POST /{resources}`                  | `POST /users`                       |                            |
| **Update**           | `PUT /{resources}/{id}`              | `PUT /users/{userId}`               | Full replace               |
| **Partial update**   | `PATCH /{resources}/{id}`            | `PATCH /users/{userId}`             |                            |
| **Delete**           | `DELETE /{resources}/{id}`           | `DELETE /users/{userId}`            |                            |
| **Nested resources** | `/{parent}/{parentId}/{child}`       | `/users/{userId}/goals`             | Up to 2 levels deep        |
| **Actions**          | `POST /{resources}/{id}/{action}`    | `POST /users/{userId}/verify-email` | For non-CRUD operations    |
| **Query parameters** | camelCase                            | `?sortBy=createdAt&order=desc`      |                            |
| **Version prefix**   | `/v{major}`                          | `/v1/users`                         |                            |
| **Headers**          | kebab-case with `X-` prefix (custom) | `X-Request-Id`, `X-Session-Token`   | Standard headers preferred |

### GraphQL (Phase 5+)

| Element           | Convention                                   | Example                         |
| ----------------- | -------------------------------------------- | ------------------------------- |
| **Types**         | PascalCase                                   | `type UserProfile`              |
| **Fields**        | camelCase                                    | `field firstName: String`       |
| **Inputs**        | PascalCase with `Input` suffix               | `input CreateUserInput`         |
| **Enums**         | PascalCase (name), UPPER_SNAKE_CASE (values) | `enum UserRole { ADMIN, USER }` |
| **Queries**       | camelCase                                    | `query getUserProfile`          |
| **Mutations**     | camelCase (verb-noun)                        | `mutation createUser`           |
| **Subscriptions** | camelCase                                    | `subscription onUserUpdated`    |

---

## Message/Event Naming

### Domain Events (ENG-001/D06)

| Element            | Convention            | Example             |
| ------------------ | --------------------- | ------------------- |
| **Event class**    | Past tense PascalCase | `class UserCreated` |
| **Event topic**    | kebab-case            | `user.created`      |
| **Event property** | camelCase             | `this.userId`       |
| **Event version**  | `{event}.v{major}`    | `user.created.v1`   |

### Message Queue

| Element            | Convention         | Example                             |
| ------------------ | ------------------ | ----------------------------------- |
| **Topic/Exchange** | kebab-case         | `user-events`, `goal-updates`       |
| **Queue**          | kebab-case         | `user-profile-queue`, `email-queue` |
| **Routing key**    | dot-notation kebab | `user.created`, `goal.completed`    |
| **Consumer group** | kebab-case         | `email-service-group`               |

---

## Git & Branch Naming

### Branch Naming

| Branch Type  | Pattern                        | Example                            |
| ------------ | ------------------------------ | ---------------------------------- |
| **Feature**  | `feature/{short-description}`  | `feature/user-authentication`      |
| **Bugfix**   | `fix/{short-description}`      | `fix/login-validation-error`       |
| **Hotfix**   | `hotfix/{short-description}`   | `hotfix/security-vulnerability`    |
| **Release**  | `release/{version}`            | `release/v1.2.0`                   |
| **Chore**    | `chore/{short-description}`    | `chore/update-dependencies`        |
| **Refactor** | `refactor/{short-description}` | `refactor/user-service-extraction` |
| **Docs**     | `docs/{short-description}`     | `docs/api-authentication-guide`    |

### Commit Messages

Follow **Conventional Commits** specification:

```text
type(scope): description

[optional body]

[optional footer]
```

| Type       | Usage                           | Example                                          |
| ---------- | ------------------------------- | ------------------------------------------------ |
| `feat`     | New feature                     | `feat(auth): add OAuth2 social login`            |
| `fix`      | Bug fix                         | `fix(api): handle null user profile`             |
| `docs`     | Documentation                   | `docs(readme): update setup instructions`        |
| `style`    | Formatting                      | `style: run prettier on all files`               |
| `refactor` | Code change without feature/fix | `refactor(user): extract validation logic`       |
| `test`     | Adding/updating tests           | `test(user): add unit tests for profile service` |
| `chore`    | Maintenance                     | `chore(deps): update vitest to 1.2.0`            |
| `perf`     | Performance improvement         | `perf(query): optimize user search`              |
| `ci`       | CI/CD changes                   | `ci: add dependency caching`                     |
| `build`    | Build system                    | `build: configure esbuild`                       |

**Rules:**

- Scope is optional but encouraged: `type(scope):`
- Description in imperative present tense: "add" not "added" or "adds"
- Description starts lowercase, no period at end
- Body wraps at 72 characters
- BREAKING CHANGE footer for breaking changes
- Reference issues: `Closes #123`

---

## CSS / Styling Naming

### Tailwind CSS (Primary)

Use utility classes directly. Custom CSS only when utilities are insufficient.

### Custom CSS Classes (when needed)

| Framework             | Convention                       | Example                              |
| --------------------- | -------------------------------- | ------------------------------------ |
| **CSS Modules**       | camelCase                        | `.userProfileCard {}`                |
| **CSS-in-JS**         | PascalCase for styled components | `const StyledButton = styled.button` |
| **BEM (legacy only)** | Follow BEM conventions           | `.block__element--modifier`          |

**Cross-Reference:** TECH-001/D02 (Frontend Technology)

---

## Test Naming

### Test Descriptions

```text
describe('{Component/Module/Service Name}', () => {
  it('{should} {expected behavior} {when/if} {condition}', () => {
    ...
  })
})
```

| Element              | Convention                             | Example                                                |
| -------------------- | -------------------------------------- | ------------------------------------------------------ |
| **`describe` block** | Module/class being tested (PascalCase) | `describe('UserService', ...)`                         |
| **`it` description** | `should {result} when {condition}`     | `it('should return user when valid ID provided', ...)` |
| **Test file name**   | `{source-file}.test.ts`                | `user-service.test.ts`                                 |
| **Test fixture**     | `kebab-case.fixture.ts`                | `test-users.fixture.ts`                                |
| **Mock file**        | `kebab-case.mock.ts`                   | `user-repository.mock.ts`                              |

**Cross-Reference:** TECH-002/D06 (Testing Standards)

---

## Environment Variable Naming

```text
{SCOPE}_{MODULE}_{VARIABLE}
```

| Part         | Convention            | Example                   |
| ------------ | --------------------- | ------------------------- |
| **Scope**    | Service/module prefix | `IDENTITY_`, `KG_`, `AI_` |
| **Variable** | UPPER_SNAKE_CASE      | `DATABASE_URL`, `API_KEY` |
| **Boolean**  | `_ENABLED` suffix     | `FEATURE_X_ENABLED`       |

Examples:

- `IDENTITY_DATABASE_URL=postgres://...`
- `KG_REDIS_URL=redis://...`
- `AI_OPENAI_API_KEY=sk-...`
- `LOG_LEVEL=info`
- `FEATURE_SOCIAL_LOGIN_ENABLED=true`

---

## Ubiquitous Language Alignment

Every name must use the **Ubiquitous Language** defined in ENG-001/D09.

```text
DO NOT USE:                      USE INSTEAD:
──────────────────────────────────────────────────
UserProfile (redundant)          User (domain concept)
Job, Work (inconsistent)         Career (bounded context)
Course, Lesson (specific)        Learning (bounded context)
Task, Todo (vague)               Goal, Mission (domain concepts)
Income, Salary (narrow)          Finance (bounded context)
Project, Portfolio (mixed)       Build (product module)
```

**Cross-Reference:** ENG-001/D09 (Ubiquitous Language), 09_Documents/Company Glossary.md

---

## Cross-Reference Summary

| Reference                            | Relationship to Naming Conventions                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------- |
| **ENG-001/D09**                      | Ubiquitous Language — all names must use domain terms                                    |
| **ARC-001**                          | Architecture principles influence naming (Provider Agnostic → no provider names in code) |
| **TECH-001/D02**                     | Frontend technology choices affect CSS/component naming                                  |
| **TECH-001/D03**                     | Backend technology choices affect file/class naming                                      |
| **TECH-001/D04**                     | Database naming is defined here                                                          |
| **09_Documents/Company Glossary.md** | Glossary defines the terminology to use in names                                         |
| **09_Documents/Coding Standards.md** | Existing naming conventions (superseded by this document)                                |

---

## Document Governance

| Aspect                | Standard                                                        |
| --------------------- | --------------------------------------------------------------- |
| **Version**           | 1.0                                                             |
| **Status**            | Final                                                           |
| **Owner**             | Chief Engineering Officer (CEngO)                               |
| **Review Cadence**    | Annually (or upon adding new technology/language)               |
| **Approval Required** | CEngO                                                           |
| **Enforcement**       | Linting rules auto-enforce naming; PR review catches violations |

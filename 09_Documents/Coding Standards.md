# Coding Standards

**Version:** 1.0
**Status:** Draft
**Owner:** Chief Technology Officer
**Created:** 2026-07-24
**Updated:** 2026-07-24
**Dependencies:** 09_Documents/Architecture Standards

## Description

Define the coding standards, conventions, and best practices that all VedMoulya development teams must follow to ensure code quality, consistency, and maintainability.

---

## General Principles

1. **Readability over cleverness** — Write code for humans first, machines second.
2. **Consistency** — Follow existing patterns when modifying code.
3. **Simplicity** — Prefer simple solutions over complex ones unless complexity is justified.
4. **Testability** — Every piece of code should be testable in isolation.
5. **Documentation** — Public APIs must be documented; complex logic must have inline comments.

## Language-Specific Standards

_(To be filled in based on chosen tech stack)_

### Naming Conventions

| Element            | Convention       | Example                   |
| ------------------ | ---------------- | ------------------------- |
| Classes/Interfaces | PascalCase       | `UserProfileService`      |
| Functions/Methods  | camelCase        | `getUserById()`           |
| Variables          | camelCase        | `userName`                |
| Constants          | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`         |
| Files/Directories  | kebab-case       | `user-profile-service.ts` |
| Database Tables    | snake_case       | `user_profiles`           |
| Database Columns   | snake_case       | `created_at`              |

## Code Review Standards

- All code must be reviewed before merging to main
- Reviews must check: correctness, style, performance, security, test coverage
- Automated checks (lint, test, build) must pass before review

## Testing Standards

- Unit tests required for all business logic
- Integration tests for API endpoints and data access
- E2E tests for critical user journeys
- Minimum 80% code coverage target

## Version Control

- Feature branches from `develop` or `main`
- Conventional commit messages (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`)
- Squash merge to main with descriptive commit message

---

_This document evolves as technology choices are made._

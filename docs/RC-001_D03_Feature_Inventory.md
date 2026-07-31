# RC-001 — Deliverable 3: Feature Inventory

**Version:** 1.0.0-rc1  
**Date:** July 30, 2026

---

## 1. Web Application Pages

| Route              | Page Component                              | Description           | Layout   |
| ------------------ | ------------------------------------------- | --------------------- | -------- |
| `/`                | `apps/web/src/app/page.tsx`                 | Home Dashboard        | AppShell |
| `/business`        | `apps/web/src/app/business/page.tsx`        | Business Intelligence | AppShell |
| `/career`          | `apps/web/src/app/career/page.tsx`          | Career Intelligence   | AppShell |
| `/learning`        | `apps/web/src/app/learning/page.tsx`        | Learning Intelligence | AppShell |
| `/marketplace`     | `apps/web/src/app/marketplace/page.tsx`     | Marketplace Platform  | AppShell |
| `/settings`        | `apps/web/src/app/settings/page.tsx`        | User Settings         | AppShell |
| `/api/trpc/[trpc]` | `apps/web/src/app/api/trpc/[trpc]/route.ts` | tRPC API Route        | None     |

## 2. Dashboard Sections (Home Page)

| Section               | Component                  | Purpose                           |
| --------------------- | -------------------------- | --------------------------------- |
| Welcome Hero          | `WelcomeHero.tsx`          | User greeting and status overview |
| Top Priority Card     | `TopPriorityCard.tsx`      | Highest priority item             |
| AI Insights           | `AIInsights.tsx`           | AI-generated insights             |
| Decision Center       | `DecisionCenter.tsx`       | Decision management UI            |
| Execution Center      | `ExecutionCenter.tsx`      | Execution tracking UI             |
| Journey Overview      | `JourneyOverview.tsx`      | Life journey visualization        |
| Memory Timeline       | `MemoryTimeline.tsx`       | Memory timeline view              |
| Module Status Grid    | `ModuleStatusGrid.tsx`     | Module health status grid         |
| Notifications Panel   | `NotificationsPanel.tsx`   | Notification display              |
| Priorities List       | `PrioritiesList.tsx`       | Priority items list               |
| Quick Actions         | `QuickActions.tsx`         | Shortcut action buttons           |
| Recommendations Panel | `RecommendationsPanel.tsx` | AI recommendations                |

## 3. Application Components

| Component           | File                      | Type                      |
| ------------------- | ------------------------- | ------------------------- |
| AppShell            | `AppShell.tsx`            | Layout wrapper            |
| Providers           | `Providers.tsx`           | React context providers   |
| ErrorBoundary       | `ErrorBoundary.tsx`       | Error boundary            |
| AICompanion         | `AICompanion.tsx`         | AI assistant widget       |
| CommandPalette      | `CommandPalette.tsx`      | Command palette (Cmd+K)   |
| NotificationsDrawer | `NotificationsDrawer.tsx` | Notifications slide-over  |
| PWAProvider         | `PWAProvider.tsx`         | PWA installation provider |

## 4. Hooks & Utilities

| Hook                         | File | Purpose                                              |
| ---------------------------- | ---- | ---------------------------------------------------- |
| (no custom hooks identified) | —    | Application uses direct imports from stores and tRPC |

## 5. State Stores

| Store                 | File   | Purpose                           |
| --------------------- | ------ | --------------------------------- |
| `navigation-store.ts` | Stores | Navigation state management       |
| `ui-store.ts`         | Stores | UI state (theme, sidebar, modals) |

## 6. Application Components (Detail)

| Component           | File                      | Type    | Hooks Used               |
| ------------------- | ------------------------- | ------- | ------------------------ |
| AppShell            | `AppShell.tsx`            | Layout  | Zustand (ui-store)       |
| Providers           | `Providers.tsx`           | Context | tRPC, TanStack Query     |
| AICompanion         | `AICompanion.tsx`         | Widget  | Zustand, tRPC            |
| CommandPalette      | `CommandPalette.tsx`      | Overlay | Zustand, keyboard events |
| NotificationsDrawer | `NotificationsDrawer.tsx` | Drawer  | Zustand                  |

## 7. Libraries & Utilities

| Library         | File                | Purpose                  |
| --------------- | ------------------- | ------------------------ |
| `api-client.ts` | `lib/api-client.ts` | API client configuration |
| `trpc.ts`       | `lib/trpc.ts`       | tRPC client setup        |

## 8. API Routers (tRPC)

| Router              | File                             | Procedures             |
| ------------------- | -------------------------------- | ---------------------- |
| IdentityRouter      | `routers/IdentityRouter.ts`      | Auth, user management  |
| BusinessRouter      | `routers/BusinessRouter.ts`      | Business operations    |
| CareerRouter        | `routers/CareerRouter.ts`        | Career operations      |
| LearningRouter      | `routers/LearningRouter.ts`      | Learning operations    |
| DashboardRouter     | `routers/DashboardRouter.ts`     | Dashboard data         |
| MarketplaceRouter   | `routers/MarketplaceRouter.ts`   | Marketplace operations |
| LifeOSRouter        | `routers/LifeOSRouter.ts`        | Life OS integration    |
| ConfigurationRouter | `routers/ConfigurationRouter.ts` | Configuration          |
| HealthRouter        | `routers/HealthRouter.ts`        | Health checks          |
| MetricsRouter       | `routers/MetricsRouter.ts`       | Metrics                |
| NotificationRouter  | `routers/NotificationRouter.ts`  | Notifications          |
| SearchRouter        | `routers/SearchRouter.ts`        | Global search          |

## 9. Key DTOs (Data Transfer Objects)

| DTO            | Domain      | Location                                              |
| -------------- | ----------- | ----------------------------------------------------- |
| BusinessDTO    | Business    | `packages/services/src/business/BusinessDTO.ts`       |
| CareerDTO      | Career      | `packages/services/src/career/CareerDTO.ts`           |
| DashboardDTO   | Dashboard   | `packages/services/src/dashboard/DashboardDTO.ts`     |
| DecisionDTO    | Decision    | `packages/services/src/decision/DecisionDTO.ts`       |
| ExecutionDTO   | Execution   | `packages/services/src/execution/ExecutionDTO.ts`     |
| LearningDTO    | Learning    | `packages/services/src/learning/LearningDTO.ts`       |
| LifeOSDTO      | LifeOS      | `packages/services/src/lifeos/LifeOSDTO.ts`           |
| MarketplaceDTO | Marketplace | `packages/services/src/marketplace/MarketplaceDTO.ts` |
| MemoryDTO      | Memory      | `packages/services/src/memory/MemoryDTO.ts`           |
| UserDTO        | Identity    | `packages/services/src/identity/UserDTO.ts`           |
| QuickActionDTO | Shared      | `packages/shared/src/types/QuickActionDTO.ts`         |
| AIDTO          | AI          | `packages/services/src/ai/AIDTO.ts`                   |

## 10. Domain Entities

| Entity           | Domain    | Location                                                     |
| ---------------- | --------- | ------------------------------------------------------------ |
| User             | Identity  | `packages/domain/src/identity/entities/User.ts`              |
| Decision         | Decision  | `packages/domain/src/decision/entities/Decision.ts`          |
| ExecutionMission | Execution | `packages/domain/src/execution/entities/ExecutionMission.ts` |
| ExecutionPlan    | Execution | `packages/domain/src/execution/entities/ExecutionPlan.ts`    |
| ExecutionStep    | Execution | `packages/domain/src/execution/entities/ExecutionStep.ts`    |
| ExecutionTask    | Execution | `packages/domain/src/execution/entities/ExecutionTask.ts`    |
| KnowledgeGraph   | Knowledge | `packages/domain/src/knowledge/aggregates/KnowledgeGraph.ts` |
| KnowledgeNode    | Knowledge | `packages/domain/src/knowledge/entities/KnowledgeNode.ts`    |
| KnowledgeEdge    | Knowledge | `packages/domain/src/knowledge/entities/KnowledgeEdge.ts`    |
| Memory           | Memory    | `packages/domain/src/memory/entities/Memory.ts`              |
| AIRequest        | AI        | `packages/ai/src/domain/entities/AIRequest.ts`               |

## 11. Domain Repositories

| Repository          | Domain    | Location                                                          |
| ------------------- | --------- | ----------------------------------------------------------------- |
| IdentityRepository  | Identity  | `packages/domain/src/identity/repository/IdentityRepository.ts`   |
| KnowledgeRepository | Knowledge | `packages/domain/src/knowledge/repository/KnowledgeRepository.ts` |
| MemoryRepository    | Memory    | `packages/domain/src/memory/repository/MemoryRepository.ts`       |
| DecisionRepository  | Decision  | `packages/domain/src/decision/repository/DecisionRepository.ts`   |
| ExecutionRepository | Execution | `packages/domain/src/execution/repository/ExecutionRepository.ts` |
| AIRequestRepository | AI        | `packages/ai/src/domain/repository/AIRequestRepository.ts`        |

## 12. ViewModels

| Module      | ViewModel Factory                | ViewModel Types                                                                                                                                                                                                                                                      | Test File            |
| ----------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Business    | `BusinessViewModelFactory.ts`    | `ProfileViewModel`, `KPIViewModel`, `RiskViewModel`, `BusinessDashboardViewModel`                                                                                                                                                                                    | ✅                   |
| Career      | `CareerViewModelFactory.ts`      | `ProfileViewModel`, `SkillViewModel`, `RoadmapViewModel`, `ResumeViewModel`, `InterviewViewModel`, `JobMarketViewModel`, `CareerDashboardViewModel`                                                                                                                  | ✅                   |
| Dashboard   | `DashboardViewModelFactory.ts`   | `IdentityViewModel`, `FocusViewModel`, `ExecutionViewModel`, `DecisionViewModel`, `MemoryViewModel`, `GrowthViewModel`, `JourneyViewModel`, `InsightSummaryViewModel`, `RecommendationSummaryViewModel`, `HealthViewModel`, `MetricsViewModel`, `DashboardViewModel` | ✅                   |
| Learning    | `LearningViewModelFactory.ts`    | `ProfileViewModel`, `PathViewModel`, `RevisionViewModel`, `StreakViewModel`, `LearningDashboardViewModel`                                                                                                                                                            | ✅                   |
| LifeOS      | `LifeOSViewModelFactory.ts`      | `ModuleCardViewModel`, `PriorityListViewModel`, `SearchSummaryViewModel`, `LifeOSDashboardViewModel`                                                                                                                                                                 | ❌ No dedicated test |
| Marketplace | `MarketplaceViewModelFactory.ts` | `CatalogViewModel`, `AssetHealthViewModel`, `ProviderSummaryViewModel`, `MarketplaceDashboardViewModel`                                                                                                                                                              | ✅                   |

## 13. Configuration Files

| File                          | Type        | Purpose                                       |
| ----------------------------- | ----------- | --------------------------------------------- |
| `tsconfig.base.json`          | TypeScript  | Shared compiler options                       |
| `tsconfig.json`               | TypeScript  | Root workspace references                     |
| `eslint.config.js`            | ESLint      | Flat config with typescript-eslint            |
| `.prettierrc`                 | Prettier    | Code formatting rules                         |
| `commitlint.config.ts`        | CommitLint  | Conventional commit validation                |
| `.env.example`                | Environment | Template for env variables                    |
| `docker-compose.yml`          | Docker      | Dev infrastructure (Postgres, Redis, Grafana) |
| `vitest.workspace.ts`         | Vitest      | Test workspace configuration                  |
| `apps/web/next.config.ts`     | Next.js     | Web app configuration                         |
| `apps/web/postcss.config.js`  | PostCSS     | CSS processing (Tailwind)                     |
| `apps/web/.storybook/main.ts` | Storybook   | Component documentation                       |
| `packages/ui/.storybook`      | Storybook   | UI package stories                            |

## 14. CI Configuration

| File                                        | Purpose                                     | Status                      |
| ------------------------------------------- | ------------------------------------------- | --------------------------- |
| `.github/workflows/ci.yml`                  | CI pipeline (lint, test, security, build)   | ✅ ACTIVE                   |
| `.github/workflows/release.yml`             | Release pipeline (validate, deploy, notify) | ✅ ACTIVE (manual dispatch) |
| `.github/ISSUE_TEMPLATE/bug_report.md`      | Bug report template                         | ✅ PRESENT                  |
| `.github/ISSUE_TEMPLATE/feature_request.md` | Feature request template                    | ✅ PRESENT                  |
| `.github/ISSUE_TEMPLATE/adr.md`             | ADR template                                | ✅ PRESENT                  |
| `.github/PULL_REQUEST_TEMPLATE.md`          | PR template                                 | ✅ PRESENT                  |

**CI Pipeline Stages:**

1. `quality` — ESLint, Prettier check, TypeScript typecheck
2. `test` — Vitest with coverage upload
3. `security` — npm audit, CodeQL SAST scan
4. `a11y` — Disabled (placeholder)
5. `performance` — Disabled (placeholder)
6. `build` — Depends on quality/test/security, builds all packages
7. `result` — Aggregates all stage results

**Release Pipeline Stages:**

1. `validate` — Typecheck, lint, test, build, security audit
2. `deploy` — Placeholder (configure per stage)
3. `notify` — Generate and upload release notes

## 15. Design Tokens

| Token Category | File                                    |
| -------------- | --------------------------------------- |
| Colors         | `packages/ui/src/tokens/colors.ts`      |
| Typography     | `packages/ui/src/tokens/typography.ts`  |
| Spacing        | `packages/ui/src/tokens/spacing.ts`     |
| Breakpoints    | `packages/ui/src/tokens/breakpoints.ts` |
| Elevation      | `packages/ui/src/tokens/elevation.ts`   |
| Motion         | `packages/ui/src/tokens/motion.ts`      |

## 16. Build Scripts

| Script     | Command                          |
| ---------- | -------------------------------- |
| Root build | `npm run build`                  |
| Web build  | `npm run build -w apps/web`      |
| Core build | `npm run build -w packages/core` |
| TypeCheck  | `npm run typecheck`              |
| Lint       | `npm run lint`                   |
| Test       | `npm run test`                   |
| Format     | `npm run format`                 |
| Quality    | `npm run quality`                |

## 17. API Middleware

| Middleware | File                       | Purpose          |
| ---------- | -------------------------- | ---------------- |
| Auth       | `middleware/auth.ts`       | Authentication   |
| Audit      | `middleware/audit.ts`      | Request auditing |
| Error      | `middleware/error.ts`      | Error handling   |
| Rate Limit | `middleware/rate-limit.ts` | Rate limiting    |
| Validation | `middleware/validation.ts` | Input validation |

## 18. Service Layer (packages/services)

| Module      | Services    | Test Count    |
| ----------- | ----------- | ------------- |
| Business    | 22 services | 24 test files |
| Career      | 23 services | 24 test files |
| Dashboard   | 17 services | 16 test files |
| Decision    | 2 services  | 2 test files  |
| Execution   | 6 services  | 7 test files  |
| Identity    | 3 services  | 0 test files  |
| Knowledge   | 5 services  | 0 test files  |
| Learning    | 22 services | 23 test files |
| LifeOS      | 15 services | 3 test files  |
| Marketplace | 21 services | 22 test files |
| Memory      | 6 services  | 6 test files  |
| AI          | 1 service   | 0 test files  |

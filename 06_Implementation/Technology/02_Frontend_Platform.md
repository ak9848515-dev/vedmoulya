# Frontend Platform

**BLP-002 — Document 02/15 — Technology Stack & Platform Decisions**
**Version:** 1.0
**Status:** LOCKED
**Owner:** Chief Technology Officer
**Created:** 2026-07-27
**Design Freeze:** 2026-07-27

---

## Purpose

This document defines the **frontend technology stack** for VedMoulya — the framework, rendering strategy, styling approach, state management, and mobile strategy.

---

## Decision Summary

| Decision          | Choice                                                   | Status     |
| ----------------- | -------------------------------------------------------- | ---------- |
| Web Framework     | **Next.js 15** with App Router                           | ✅ DECIDED |
| Styling           | **Tailwind CSS v4** + CSS Modules for complex components | ✅ DECIDED |
| Component Library | **shadcn/ui** (headless + Tailwind)                      | ✅ DECIDED |
| Animation         | **Framer Motion**                                        | ✅ DECIDED |
| State Management  | **React Server State** (server) + **Zustand** (client)   | ✅ DECIDED |
| Data Fetching     | **React Query (TanStack Query)**                         | ✅ DECIDED |
| Form Handling     | **React Hook Form** + **Zod** validation                 | ✅ DECIDED |
| Type Safety       | **tRPC** (end-to-end typesafe APIs)                      | ✅ DECIDED |
| Mobile (MVP)      | **Responsive PWA** (no native app)                       | ✅ DECIDED |
| Mobile (Future)   | **React Native** (post-MVP v1.1+)                        | 📝 PLANNED |
| Desktop (Future)  | **Tauri** (post-MVP v2.0)                                | 📝 PLANNED |

---

## Web Framework: Next.js 15

### Decision

| Aspect      | Detail                                                           |
| ----------- | ---------------------------------------------------------------- |
| **Choice**  | Next.js 15 with App Router (React 19)                            |
| **Purpose** | Primary web application framework for all user-facing interfaces |

### Alternatives Considered

| Alternative          | Pros                                                          | Cons                                   | Verdict     |
| -------------------- | ------------------------------------------------------------- | -------------------------------------- | ----------- |
| **Next.js 15**       | Full-stack React, SSR/SSG/ISR, serverless-ready, excellent DX | Larger bundle than minimal frameworks  | ✅ SELECTED |
| **Remix**            | Excellent web standards, great forms                          | Smaller ecosystem, less AI tooling     | ❌          |
| **Astro**            | Minimal JS, great for content sites                           | Poor for highly interactive dashboards | ❌          |
| **SvelteKit**        | Fast, small bundles                                           | Smaller ecosystem, less hiring pool    | ❌          |
| **Vite + React SPA** | Simple, fast builds                                           | No SSR, poor SEO, slower initial load  | ❌          |

### Trade-offs

| Trade-off                          | Impact                                                             | Mitigation                                                      |
| ---------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------- |
| Build complexity vs. SSR benefits  | Server components, streaming, and partial rendering add complexity | Use App Router conventions; avoid custom server config          |
| Bundle size vs. framework features | Next.js adds ~70KB to initial bundle                               | Leverage React Server Components (zero client JS for static UI) |

### Future Evolution

| Phase      | Expected Change                       | Trigger                            |
| ---------- | ------------------------------------- | ---------------------------------- |
| v1.0 (MVP) | Next.js 15 + App Router               | Default                            |
| v1.1       | Partial React Native for mobile       | Mobile usage >30%                  |
| v2.0       | Full React Native + Tauri exploration | User demand for native experiences |

---

## Styling: Tailwind CSS v4

### Decision

| Aspect      | Detail                                                                       |
| ----------- | ---------------------------------------------------------------------------- |
| **Choice**  | Tailwind CSS v4 with CSS Modules for complex components                      |
| **Purpose** | Utility-first CSS for rapid UI development, consistent with Experience Bible |

### Alternatives Considered

| Alternative             | Pros                                                           | Cons                            | Verdict                       |
| ----------------------- | -------------------------------------------------------------- | ------------------------------- | ----------------------------- |
| **Tailwind CSS**        | Rapid development, consistent design system, small prod bundle | Verbose HTML, learning curve    | ✅ SELECTED                   |
| **CSS Modules**         | Scoped styles, no runtime                                      | Slower to develop, inconsistent | ⏸ Used for complex components |
| **Styled Components**   | Dynamic styles, colocated                                      | Runtime cost, larger bundle     | ❌                            |
| **CSS-in-JS (various)** | Dynamic styles                                                 | Runtime cost, complex setup     | ❌                            |

### Integration with Design System

- Tailwind config extends the Experience Bible design tokens (color, spacing, typography)
- Custom plugin for VedMoulya-specific design tokens
- CSS Modules for complex animation sequences and component-specific layouts

---

## Component Library: shadcn/ui

### Decision

| Aspect      | Detail                                                                 |
| ----------- | ---------------------------------------------------------------------- |
| **Choice**  | shadcn/ui — copy-paste components built on Radix UI primitives         |
| **Purpose** | Accessible, unstyled component primitives that integrate with Tailwind |

### Key Components (MVP)

| Component              | Source    | Customizations                         |
| ---------------------- | --------- | -------------------------------------- |
| Button, Input, Select  | shadcn/ui | VedMoulya color tokens, radius         |
| Dialog, Sheet, Popover | shadcn/ui | Animation timing from Experience Bible |
| Card, Tabs, Accordion  | shadcn/ui | Layout tokens from Experience Bible    |
| Table, Badge, Avatar   | shadcn/ui | Default styling, no customization      |
| Forms, Toast           | shadcn/ui | Zod integration for validation         |

---

## Animation: Framer Motion

### Decision

| Aspect      | Detail                                                                   |
| ----------- | ------------------------------------------------------------------------ |
| **Choice**  | Framer Motion for animations and micro-interactions                      |
| **Purpose** | Declarative animations that match Experience Bible motion specifications |

### Motion Timing Reference

| Token        | Duration | Easing      | Usage                       |
| ------------ | -------- | ----------- | --------------------------- |
| `instant`    | 0ms      | None        | State changes, no animation |
| `fast`       | 100ms    | ease-out    | Micro-interactions, hover   |
| `normal`     | 200ms    | ease-in-out | Component transitions       |
| `slow`       | 300ms    | ease-in-out | Page transitions            |
| `deliberate` | 500ms    | ease-out    | Emphasis transitions        |
| `narrative`  | 700ms+   | custom      | Storytelling, celebrations  |

---

## State Management: Server + Client

### Server State (React Server Components)

| Aspect      | Detail                                                                             |
| ----------- | ---------------------------------------------------------------------------------- |
| **Pattern** | Server Components fetch and render data directly. Zero client JS for data loading. |
| **When**    | Dashboard data, lists, detail views, static content                                |

### Client State (Zustand)

| Aspect     | Detail                                                                |
| ---------- | --------------------------------------------------------------------- |
| **Choice** | Zustand — minimal, TypeScript-native, no boilerplate                  |
| **When**   | UI state (sidebar open, selected filters), form wizards, real-time UI |

### Server Cache (React Query)

| Aspect     | Detail                                                                      |
| ---------- | --------------------------------------------------------------------------- |
| **Choice** | TanStack Query (React Query v5)                                             |
| **When**   | Client-side data fetching, mutation, optimistic updates, cache invalidation |

---

## Type Safety: tRPC

### Decision

| Aspect      | Detail                                                                                 |
| ----------- | -------------------------------------------------------------------------------------- |
| **Choice**  | tRPC v11 for end-to-end typesafe APIs                                                  |
| **Purpose** | Shared TypeScript types between frontend and backend. No manual API client generation. |

### Reasoning

- Eliminates API client generation entirely
- Type errors caught at compile time, not runtime
- Works with Next.js server actions and API routes
- Supports subscriptions for real-time data

---

## Mobile Strategy

### MVP: Responsive PWA

| Aspect           | Detail                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------ |
| **Approach**     | Responsive web application + PWA capabilities                                              |
| **Capabilities** | Offline support (service worker), home screen install, push notifications                  |
| **Mobile UI**    | Mobile-first responsive design; all screens tested at 375px+                               |
| **Rationale**    | Web covers 95% of MVP use cases. Native apps add 5x development cost for marginal benefit. |

### Post-MVP: React Native (v1.1+)

| Aspect       | Detail                                                                            |
| ------------ | --------------------------------------------------------------------------------- |
| **Trigger**  | Mobile web usage exceeds 30% of sessions AND average session duration >10 minutes |
| **Approach** | React Native + Expo for cross-platform native apps                                |

### Future: Desktop (v2.0+)

| Aspect       | Detail                                                                  |
| ------------ | ----------------------------------------------------------------------- |
| **Approach** | Tauri (Rust-based desktop app framework, minimal bundle size)           |
| **Trigger**  | User demand for desktop-native experience OR offline-first requirements |

---

## Architecture References

| Reference      | Relationship                                                             |
| -------------- | ------------------------------------------------------------------------ |
| DES-010A / D00 | Experience Bible v1.0 governs all frontend design decisions              |
| DES-010A / D06 | Layout and Grid (Experience Bible) defines the responsive breakpoints    |
| DES-010A / D08 | Typography (Experience Bible) defines the font stack for the frontend    |
| DES-010A / D09 | Color System (Experience Bible) defines the color tokens used in theming |
| DES-010A / D05 | Animation and Motion (Experience Bible) defines the motion timing tokens |
| DES-010A / D07 | Component Behaviour (Experience Bible) defines component state patterns  |

---

## Cross-References

| Reference     | Relationship                                                             |
| ------------- | ------------------------------------------------------------------------ |
| BLP-002 / D03 | Backend Platform defines the tRPC router that frontend consumes          |
| BLP-002 / D05 | AI Platform defines how AI responses are displayed in the frontend       |
| BLP-002 / D10 | Testing Toolchain defines frontend testing tools (Playwright, Storybook) |
| BLP-002 / D12 | Decision Record — TDR-002 (Frontend Platform Decision)                   |
| CMP-002       | Compliance requirements for cookie consent, data collection in frontend  |
| PRD-001       | Human Journey Stages define page structure and navigation flow           |

---

## Quality Review

| Dimension              | Assessment                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Why**                | Frontend technology choices determine developer velocity, user experience quality, and mobile strategy.    |
| **Business Impact**    | Next.js enables fast iteration (SSR, server components). Responsive PWA avoids native app cost during MVP. |
| **Engineering Impact** | TypeScript-native stack (Next.js, tRPC, Zustand, React Query) eliminates type boundaries.                  |
| **Operational Impact** | Serverless-ready (Vercel). Zero ops for frontend hosting.                                                  |
| **Security Impact**    | Server Components eliminate client-side data exposure. tRPC provides type-safe input validation.           |
| **Performance Impact** | Server Components = zero client JS for static UI. Tailwind = <10KB CSS in production.                      |
| **Cost Impact**        | Vercel free tier for MVP. No native app development cost.                                                  |
| **Future Scalability** | Next.js scales from zero to millions of users. React Native path is clear.                                 |

---

## Design Freeze Status

| Status    | Date       | Notes                                                        |
| --------- | ---------- | ------------------------------------------------------------ |
| ✅ LOCKED | 2026-07-27 | Frontend Platform v1.0 frozen. Changes require CTO approval. |

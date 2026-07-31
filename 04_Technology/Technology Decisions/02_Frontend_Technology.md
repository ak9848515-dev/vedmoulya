# Frontend Technology

**TECH-001 — Document 02/10 — Technology Decision Record**
**Version:** 1.0
**Status:** Draft
**Owner:** Chief Technology Officer (CTO)
**Created:** 2026-07-27
**Cross-references:** CMP-001, ARC-001, ENG-004, IMP-001/D03, IMP-001/D06

---

## Purpose

This TDR evaluates frontend technology options for VedMoulya and recommends a primary strategy. The decision must balance development speed (MVP by Week 32), cross-platform reach (web + mobile + eventual desktop), maintainability over years, and compatibility with AI-assisted development.

---

## Evaluation Landscape

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FRONTEND TECHNOLOGY LANDSCAPE                               │
│                                                                               │
│  CATEGORY        │ OPTIONS                                │ MVP SUITABILITY │
│ ─────────────────┼────────────────────────────────────────┼───────────────── │
│  Web App         │ React, Vue, Angular, Svelte, Solid     │ High             │
│  Cross-Platform  │ Flutter, React Native, .NET MAUI,      │ Medium           │
│  Mobile          │ Kotlin (Android), Swift (iOS)          │ Low (Phase 7)   │
│  Desktop         │ Electron, Tauri, Flutter Desktop,      │ Low (Post-GA)   │
│                  │ .NET MAUI, Qt                           │                  │
│  SSR / Meta-fw   │ Next.js, Nuxt, SvelteKit, Remix        │ Medium           │
│                                                                               │
│  KEY CONSTRAINT: VedMoulya MVP is WEB-FIRST (IMP-001/D03).                    │
│  Native mobile and desktop are Phase 7+ concerns.                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Options Evaluation

### Option 1: React (with Next.js)

| Aspect                     | Assessment                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------- |
| **Architecture Alignment** | +2 — Strong alignment. Component model supports modularity. SSR via Next.js.            |
| **Productivity**           | +2 — Vast ecosystem, mature tools, extensive component libraries.                       |
| **Maintainability**        | +2 — TypeScript + strict mode enables maintainable code. Clear patterns.                |
| **AI Compatibility**       | +2 — Best-in-class AI tool support. GitHub Copilot, Cursor, Codex excel with React/TSX. |
| **Cross-Platform**         | +1 — React Native for mobile (known patterns). Not as seamless as Flutter.              |
| **Community**              | +2 — Largest frontend ecosystem. Most talent, libraries, resources.                     |
| **Performance**            | +1 — Good with SSR/SSG optimization. Virtual DOM handles most use cases.                |
| **Migration Path**         | +2 — Standard web technologies. No lock-in. Easy to migrate away.                       |
| **Weighted Score**         | **+1.85**                                                                               |

**Rationale:** React + Next.js provides the best balance of development speed, AI tool compatibility, ecosystem maturity, and maintainability. TypeScript support is exceptional — AI code generation produces correct, type-safe React components.

### Option 2: Vue (with Nuxt)

| Aspect                     | Assessment                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------- |
| **Architecture Alignment** | +2 — Component model, reactivity, modularity all strong.                           |
| **Productivity**           | +1 — Simpler than React for beginners. Good DX.                                    |
| **Maintainability**        | +1 — Single-file components organized well. Smaller ecosystem means fewer choices. |
| **AI Compatibility**       | +1 — AI tools support Vue but with less training data than React (~50% less).      |
| **Cross-Platform**         | +1 — Vuetify for mobile web. NativeScript Vue for native.                          |
| **Community**              | +1 — Strong but smaller than React. More limited talent pool.                      |
| **Performance**            | +1 — Good performance, smaller bundle size than React typically.                   |
| **Migration Path**         | +2 — Standard web technologies. No lock-in.                                        |
| **Weighted Score**         | **+1.30**                                                                          |

**Rationale:** Vue is excellent but AI tooling support lags behind React. The smaller talent pool is a hiring risk for future phases.

### Option 3: Angular

| Aspect                     | Assessment                                                                      |
| -------------------------- | ------------------------------------------------------------------------------- |
| **Architecture Alignment** | +1 — Opinionated framework aligns with enterprise needs. Heavy for MVP.         |
| **Productivity**           | -1 — More boilerplate, slower iteration for rapid prototyping.                  |
| **Maintainability**        | +2 — Strong typing, dependency injection, clear structure. Enterprise-grade.    |
| **AI Compatibility**       | +1 — Good TypeScript support but less React/JSX training data.                  |
| **Cross-Platform**         | 0 — Ionic for mobile, but not first-class.                                      |
| **Community**              | +1 — Strong enterprise adoption. Smaller than React.                            |
| **Performance**            | +1 — Good performance with Ivy renderer.                                        |
| **Migration Path**         | +1 — Standard web technologies but opinionated patterns harder to migrate from. |
| **Weighted Score**         | **+0.65**                                                                       |

**Rationale:** Angular is enterprise-ready but heavy for MVP. AI tooling support is adequate but not excellent. Slower iteration speed.

### Option 4: Svelte / SvelteKit

| Aspect                     | Assessment                                                                  |
| -------------------------- | --------------------------------------------------------------------------- |
| **Architecture Alignment** | +2 — Minimal, clean, modular. Strong alignment.                             |
| **Productivity**           | +2 — Less code, faster development. Excellent DX.                           |
| **Maintainability**        | +1 — Clean code but smaller ecosystem means more custom solutions.          |
| **AI Compatibility**       | 0 — Growing support but significantly less training data than React or Vue. |
| **Cross-Platform**         | 0 — Svelte Native for mobile, not mature.                                   |
| **Community**              | 0 — Growing fast but still small. Limited talent pool.                      |
| **Performance**            | +2 — No virtual DOM. Smallest bundle sizes. Compile-time optimization.      |
| **Migration Path**         | +1 — Standard web technologies, but distinctive patterns.                   |
| **Weighted Score**         | **+1.10**                                                                   |

**Rationale:** Excellent productivity and performance but AI tooling immaturity and small ecosystem are significant risks for a long-lived platform.

### Option 5: Flutter (Web Priority)

| Aspect                     | Assessment                                                                    |
| -------------------------- | ----------------------------------------------------------------------------- |
| **Architecture Alignment** | 0 — Widget model is composable. Dart is less architecture-native.             |
| **Productivity**           | +1 — Fast iteration with hot reload. Widget ecosystem is good.                |
| **Maintainability**        | +1 — Strong typing, clear widget hierarchy.                                   |
| **AI Compatibility**       | -1 — Dart has significantly less AI training data than TypeScript/JavaScript. |
| **Cross-Platform**         | +2 — True single codebase for web, mobile, desktop.                           |
| **Community**              | +1 — Strong Google backing. Growing but smaller than web-native frameworks.   |
| **Performance**            | +2 — Excellent performance. Skia/Impeller rendering. Canvas-based, not DOM.   |
| **Migration Path**         | -1 — Dart is a significant lock-in. Migrating away requires complete rewrite. |
| **Weighted Score**         | **+0.60**                                                                     |

**Rationale:** Flutter's cross-platform promise is compelling but the Dart/AI misalignment, web-not-first nature, and migration lock-in are significant concerns for MVP speed and long-term maintainability.

---

## Recommendation: React + Next.js (TypeScript)

### Primary Choice

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND TECHNOLOGY DECISION                           │
│                                                                               │
│  PRIMARY:  React 19+ with Next.js 15+ (App Router)                           │
│  LANGUAGE: TypeScript (strict mode)                                          │
│  STYLING:  Tailwind CSS (utility-first)                                      │
│  STATE:    React Context + Server Components (minimize client state)          │
│  TESTING:  Vitest (unit) + Playwright (E2E)                                  │
│  BUILD:    Next.js built-in (Webpack/Turbopack)                              │
│                                                                               │
│  RATIONALE:                                                                   │
│  • Best AI tooling support — Copilot, Cursor, and Codex excel with React/TSX │
│  • Largest ecosystem — component libraries, tools, talent                     │
│  • TypeScript provides safety without sacrificing AI generation quality      │
│  • Next.js SSR/SSG provides excellent performance for content-rich pages     │
│  • App Router aligns with modular architecture                                │
│  • React Server Components reduce client-side JavaScript                      │
│  • Standard web technologies — easy migration, no lock-in                    │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Evaluation Against Architecture Principles

| Principle            | Alignment | How                                                                             |
| -------------------- | --------- | ------------------------------------------------------------------------------- |
| Human First          | ✅ Strong | SSR ensures fast initial loads. Accessibility built into component libraries.   |
| Provider Agnostic    | ✅ Strong | Standard web technologies. No vendor lock-in.                                   |
| Privacy First        | ✅ Strong | Server Components keep sensitive data on server.                                |
| Domain-Driven        | ✅ Strong | Component hierarchy mirrors domain structure.                                   |
| Modular & Composable | ✅ Strong | React component model. Micro-frontend extraction path available.                |
| Explainable          | ✅ Strong | Clear component hierarchy for debugging. React DevTools for inspection.         |
| Execution First      | ✅ Strong | Optimistic UI updates for execution workflows.                                  |
| Event Driven         | ✅ Strong | Event-based component communication. WebSocket support via Next.js.             |
| Information First    | ✅ Strong | Data-flow patterns (Context, Server Components) respect information boundaries. |
| AI Native            | ✅ Strong | #1 AI-compatible frontend framework. Vast training corpus.                      |

### Pros & Cons

| Pros                                                      | Cons                                                              |
| --------------------------------------------------------- | ----------------------------------------------------------------- |
| Best AI tooling support (critical for Founder + AI model) | Bundle size can be larger than Svelte or Solid                    |
| Largest ecosystem and talent pool                         | Framework churn (React releases, Next.js updates)                 |
| TypeScript provides type safety across entire stack       | Server Components still maturing                                  |
| Next.js SSR provides excellent SEO and performance        | Full-stack nature of Next.js can blur frontend/backend boundaries |
| Standard web = easy hosting (Vercel, Netlify, any CDN)    | Requires discipline to separate concerns                          |
| Easy migration path — no lock-in                          |                                                                   |
| Most AI training data — best code generation quality      |                                                                   |
| Strong community support for every tool need              |                                                                   |

### Trade-offs Accepted

| Trade-off                         | Why Acceptable                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| Not Flutter's true cross-platform | Web-first MVP. Mobile native deferred to Phase 7. React Native available when needed. |
| Not Svelte's smaller bundles      | MVP bundle size is not a constraint. SSR mitigates perceived performance.             |
| Not Vue's simplicity              | TypeScript + strict mode provides safety that outweighs simplicity.                   |
| Framework churn                   | LTS strategy: pin major versions, upgrade annually.                                   |

### Future Migration Strategy

| Scenario                                | Migration Path                                                             | Cost                     |
| --------------------------------------- | -------------------------------------------------------------------------- | ------------------------ |
| React loses market dominance (unlikely) | Standard web technologies — incrementally replace components               | Medium — weeks to months |
| Need true cross-platform mobile         | Add React Native — shared TypeScript types and business logic              | Low — shared patterns    |
| Need desktop app                        | Add Electron or Tauri — reuse React components                             | Low-Medium               |
| Move away from Next.js to Vite/RR       | Next.js is mostly standard React — App Router migration is the tricky part | Medium                   |
| Migrate to a new framework entirely     | React's component model translates to any modern framework                 | High — major initiative  |

---

## Mobile Strategy

### MVP Phase (Web-First)

- Responsive web application via Next.js
- Mobile web (responsive design) for all features
- Progressive Web App (PWA) for offline-capable basic features
- Push notifications via Web Push API

### Phase 7+ (Mobile Native)

- **Recommended: React Native** — Leverage React knowledge, share types, share business logic
- Alternative: Native (Kotlin + Swift) — Only if platform-specific features become critical
- Not recommended: Flutter — Cross-platform migration from React/Next.js is a complete rewrite

---

## Desktop Strategy

### MVP Phase

- Not applicable — web application covers desktop use cases

### Phase 7+ (Desktop)

- **Recommended: Tauri** — Lightweight, Rust-based, smaller bundle than Electron
- Alternative: Electron — More mature, larger ecosystem, larger bundle
- Share existing React frontend code with minimal changes

---

## Cross-References

| Reference   | Relationship                                                                  |
| ----------- | ----------------------------------------------------------------------------- |
| CMP-001     | Web-first approach aligns with "Human-first" — accessible to all devices.     |
| ARC-001     | Principle #5 (Modular) — React component model supports composability.        |
| ENG-004/D08 | Deployment View confirms web-first approach with mobile/desktop deferred.     |
| IMP-001/D03 | MVP Definition confirms web-only for MVP. Native mobile Phase 7.              |
| IMP-001/D06 | Module Implementation Order confirms Frontend UI starts in Phase 3 (Week 21). |

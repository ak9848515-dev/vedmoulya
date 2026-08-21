# SPRINT-026 — UX Audit

> **Sprint:** SPRINT-026 — Voice Intelligence + Complete-System Architecture Audit
> **Scope:** Phase 7 (Complete UX Audit)
> **Date:** 2026-08-13
> **Verdict:** 🟡 **Coherent design language, several dead/misleading controls, and a nav surface approaching overload — no redesign needed, targeted fixes only.**

---

## 1. Screen Inventory (apps/web/src/app)

| Area         | Routes                                                                                                                             | Notes                                                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Life OS      | `/` (dashboard), `/portal`                                                                                                         | Dashboard composes 17 section components (hero, priorities, execution, decisions, memory, recommendations, notifications, module grid…) |
| Identity     | `/login`, `/oauth2redirect`, `/settings`                                                                                           | JWT via localStorage (web) / secure storage (native)                                                                                    |
| Goals        | `/goals` (+ problem panel, task-graph, lifecycle view)                                                                             | SPRINT-023/024 surfaces                                                                                                                 |
| Brain        | `/brain` (+ operating dashboard, learning feed, outcome verdict strip)                                                             | EPIC-016/020/025 surfaces                                                                                                               |
| Execution    | `/execution` (+ ExecutionRunner), `/execution-strategy`                                                                            | EPIC-014 runner                                                                                                                         |
| Intelligence | `/intelligence`, `/live-intelligence`, `/ecosystem-intelligence`                                                                   | EPIC-015/017                                                                                                                            |
| AI World     | `/ai-world` (+ bell drawer, discovery activity)                                                                                    | EPIC-012C/018/021                                                                                                                       |
| Capabilities | `/capabilities`, `/capability-marketplace`                                                                                         | EPIC-013                                                                                                                                |
| Providers    | `/providers` (+ model selector, configuration)                                                                                     | EPIC-012A/B                                                                                                                             |
| Applications | `/applications` (12-tab workspace)                                                                                                 | EPIC-007/008/009/010/011                                                                                                                |
| Modules      | `/career`, `/business`, `/learning`, `/knowledge`, `/memory`, `/marketplace`, `/content-agency` (+15 subroutes)                    | EPIC-002/003                                                                                                                            |
| Platform     | `/os`, `/context`, `/context-fabric`, `/loop`, `/ai-world`, `/providers`                                                           | EPIC-004/005/006, APP-001                                                                                                               |
| Shell        | AppShell (sidebar + topbar + AI panel), CommandPalette, NotificationsDrawer, AIWorldBell, MobileTabBar, OfflineBanner, PWAProvider | verified in `apps/web/src/components/`                                                                                                  |

### Shell + interaction inventory (verified)

| Component           | File                                       | State                                                                                                                             |
| ------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| AICompanion drawer  | `components/AICompanion.tsx`               | streams via `ai.stream`; stage labels; suggested questions; **dead Mic button** (UX-1); **"Powered by Phoenix AI" footer** (UX-2) |
| CommandPalette      | `components/CommandPalette.tsx`            | keyboard-first navigation                                                                                                         |
| NotificationsDrawer | `components/NotificationsDrawer.tsx`       | reads dashboard/ecosystem notifications; dismissible                                                                              |
| AIWorldBell         | `components/AIWorldBell.tsx`               | category chips (🔥/⭐/🧩/📰); relevance-gated                                                                                     |
| MobileTabBar        | `components/MobileTabBar.tsx`              | bottom navigation on native/mobile                                                                                                |
| ErrorBoundary       | `components/ErrorBoundary.tsx`             | isolates section failures                                                                                                         |
| ExecutionRunner     | `components/execution/ExecutionRunner.tsx` | step timeline + approval prompt + manual hand-off; progressive disclosure                                                         |

---

## 2. Findings

| ID   | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Evidence                                   |
| ---- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| UX-1 | P2       | **Dead control: Mic button** in AICompanion — `onClick={() => {}}` while advertising `aria-label="Voice input"`. Violates "no dead controls"; the primary assistant surface implies voice capability that does not exist.                                                                                                                                                                                                                                                                                                                           | `AICompanion.tsx:314-319`                  |
| UX-2 | P3       | **Misleading label:** "Powered by Phoenix AI" — actual runtime providers are openai/deepseek/mock. Honesty rule (provider truthfulness) violated at the UI level.                                                                                                                                                                                                                                                                                                                                                                                   | `AICompanion.tsx` footer                   |
| UX-3 | P2       | **Nav overload:** the sidebar groups + 24 top-level routes (dashboard, goals, brain, execution, execution-strategy, intelligence, live-intelligence, ecosystem-intelligence, ai-world, capabilities, capability-marketplace, providers, applications, career, business, learning, knowledge, memory, marketplace, content-agency, os, context, context-fabric, loop, settings…) — far beyond what a single personal OS user can parse; many are internal-engine surfaces. Progressive disclosure exists only partially (CommandPalette + sections). | `AppShell.tsx` nav groups; route inventory |
| UX-4 | P3       | **Surface naming inconsistency:** `/intelligence` vs `/live-intelligence` vs `/ecosystem-intelligence` vs `/learning-intelligence` vs `/knowledge-intelligence` vs `/memory-intelligence` — user-facing terminology collides with engine taxonomy.                                                                                                                                                                                                                                                                                                  | route inventory                            |
| UX-5 | P3       | **Duplicate feedback patterns:** verdicts use "Completed — verified" etc. (plain language, good) but the AICompanion has no verdict vocabulary at all (Q&A stream); the two AI surfaces speak different "languages". Unify once voice lands.                                                                                                                                                                                                                                                                                                        | `OUTCOME_VERDICT_LABELS` vs AICompanion    |
| UX-6 | P3       | **Loading/empty/error states** are well-covered on the dashboard (skeletons, pull-to-refresh, offline banner) — but deep engine pages (e.g. `/context-fabric`, `/os`) reuse generic loading; coverage is uneven. Not a regression, an inconsistency.                                                                                                                                                                                                                                                                                                | section components vs engine pages         |
| UX-7 | P3       | Accessibility: `a11y` CI gate exists (`npm run test:a11y`) and is **non-blocking** (`                                                                                                                                                                                                                                                                                                                                                                                                                                                               |                                            | true`); no axe violations surfaced in CI history. Keyboard nav exists (CommandPalette), ARIA labels present on the audited controls. Voice (when built) must not regress this. | `.github/workflows/ci.yml` a11y job |

---

## 3. UI Consistency Matrix

| Dimension                    | Canonical (verified tokens/components)                                                   | Consistency verdict                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Colors                       | `packages/ui/src/tokens/colors.ts` (slate/gray + brand blue `#2B5FD9`, purple `#7C3AED`) | 🟢 consistent — AICompanion hardcodes hex (`#2B5FD9`, `#94A3B8`…) matching tokens |
| Typography                   | `tokens/typography.ts`                                                                   | 🟢 system + tokenized                                                             |
| Spacing / elevation / motion | `tokens/spacing.ts`, `elevation.ts`, `motion.ts`, `breakpoints.ts`                       | 🟢 tokenized                                                                      |
| Cards / buttons / inputs     | `packages/ui/src/components/{button,card,input}`                                         | 🟢 shared library used broadly                                                    |
| Navigation                   | `Sidebar` + `NavBar` + `MobileTabBar` (shell)                                            | 🟡 one canonical shell; route count overload (UX-3)                               |
| Dialogs / drawers            | `overlay` (Drawer/Dialog) + AICompanion + bell + notifications drawers                   | 🟢 consistent overlay patterns                                                    |
| Notifications                | `NotificationsDrawer` + `AIWorldBell`                                                    | 🟡 two drawers, two stores (S-1)                                                  |
| Status indicators            | `OUTCOME_VERDICT_LABELS` (plain language) + stage chips                                  | 🟢 verdicts honest + consistent on `/brain`/`/goals`                              |
| AI interaction surface       | AICompanion (stream) + Brain task pipeline UI                                            | 🟡 two dialects (UX-5); **the voice assistant must unify them**                   |
| Voice interaction surface    | —                                                                                        | 🔴 none (dead Mic only) — the voice sprint's UI scope                             |

---

## 4. Canonical design system (stated, not redesigned)

The design language is already established and consistent:

- **Design system:** `@vedmoulya/ui` (Radix + Tailwind) with tokenized theme (`ThemeProvider`).
- **Colors/typography/spacing/elevation/motion/breakpoints:** `packages/ui/src/tokens/*`.
- **Cards, buttons, inputs, navigation, overlays:** shared component groups.

**Rules for the voice/proactive sprints:**

1. New voice surfaces MUST use `@vedmoulya/ui` components + tokens (no new ad-hoc hex styling).
2. The AICompanion becomes the **single conversation shell** (chat + voice + task hand-off); the Brain task pipeline is presented _inside_ it as an approval/verification stage, never as a parallel chat.
3. One vocabulary for outcomes (reuse `OUTCOME_VERDICT_LABELS`) everywhere AI output is shown.
4. No dead controls: any affordance without a backing runtime is hidden or disabled with a reason (fix UX-1 this way or by implementing voice).

---

## 5. Verdict

The UX is **coherent and honest** (verdict labels, error isolation, skeletons, offline
handling). The defects are targeted: one dead control, one misleading label, nav
overload, and two notification/AI surfaces that will be unified as part of voice +
proactive work. **No redesign.**

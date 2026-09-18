# VedMoulya — UX-AUDIT.md (UX-01)

**Scope of this run:** UX-01 (information architecture + route mapping) and UX-02 (navigation shell).
**Implementation rule respected:** no route was deleted, no backend/autonomy/provider/credential logic was touched.
**Evidence basis:** direct inspection of `apps/web/src/app`, `components/AppShell.tsx`, `components/MobileTabBar.tsx`,
`lib/mobile-nav.ts`, `stores/navigation-store.ts`, `packages/ui/src/components/navigation/Navigation.tsx`,
`stores/ui-store.ts`, `components/AICompanion.tsx`.

---

## 1. Current navigation map (before)

Three surfaces, three different models, no shared source of truth.

**Desktop sidebar** — one long scroll of 2 groups / **33 items**, driven by a hand-written
`buildSidebarGroups()` inside `navigation-store.ts`:

```
Overview: Dashboard · Autonomous Builder · Insights · Search · Settings
Modules:  Career · Learning · Business · Marketplace · Capability Registry ·
          AI Capability Marketplace · AI Ecosystem · Provider Registry ·
          Context Intelligence · Execution Strategy · Execution Orchestrator ·
          Goal & Task Intelligence · Enterprise Intelligence · Ecosystem
          Intelligence · Learning Intelligence · Enterprise Brain ·
          VedMoulya Brain · Live Intelligence Bridge · Knowledge Intelligence ·
          Memory Intelligence · Operating System · Context Fabric ·
          AI Loop Engine · Application Factory · Content Agency
```

**Mobile bottom bar** — 6 unrelated primary areas (a second, incompatible taxonomy):

```
Dashboard · Learning · Career · Marketplace · Agency · Settings
```

**Topbar** — Logo · collapse · Search · AI World bell · Notifications · theme ·
AI Companion · user chip + sign out. (Global search and Ask are buried here.)

**Active state** — `navigation-store.activeSection`, set by _clicking_. Deep-linking
to `/career` left "Dashboard" highlighted until the user clicked something; every
screen then re-asserted its own section in a `useEffect`. The icon map
(`moduleIcons`) and the id→route switch (`routeForSection`) were duplicated in
`AppShell.tsx`, and `mobile-nav.ts` had a _third_ path→tab mapping.

## 2. Current route inventory (all 56 real routes)

| Area                 | Routes                                                                                                                                                                                                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home                 | `/`                                                                                                                                                                                                                                                                                           |
| Missions / execution | `/autonomous-builder`, `/goals`, `/execution`, `/execution-strategy`, `/loop`                                                                                                                                                                                                                 |
| Life modules         | `/career`, `/learning`, `/business`, `/content-agency` (+15 sub-routes), `/applications`                                                                                                                                                                                                      |
| AI / intelligence    | `/ai-world`, `/brain`, `/enterprise-brain`, `/intelligence`, `/ecosystem-intelligence`, `/learning-intelligence`, `/live-intelligence`, `/knowledge`, `/memory`, `/context`, `/context-fabric`, `/providers`, `/capabilities`, `/capability-marketplace`, `/marketplace`, `/ecosystem`, `/os` |
| System               | `/settings`                                                                                                                                                                                                                                                                                   |
| Onboarding / auth    | `/onboarding/profile`, `/login`, `/signup`, `/verify-email`, `/oauth2redirect`                                                                                                                                                                                                                |
| Client portal        | `/portal`, `/portal/login`, `/portal/content`, `/portal/deliverables`, `/portal/invoices`                                                                                                                                                                                                     |
| **New in UX-02**     | `/progress`, `/life`, `/ai`                                                                                                                                                                                                                                                                   |

## 3. Duplicated concepts found

| Duplication                          | Where                                                                                                                                                                             | Judgement                                                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Three navigation taxonomies          | sidebar (33) / mobile (6) / topbar                                                                                                                                                | **Fixed** — one `navigation-model.ts`                                                                              |
| Provider configuration in two places | `/providers` and the Settings **AI** tab                                                                                                                                          | Settings AI tab is _preferences_ (cost policy, budgets) — kept, but it now **links** to the canonical `/providers` |
| Model management                     | `/providers` UI + `/capability-marketplace` + `/marketplace`                                                                                                                      | Marketplace kept as a _capability_ surface, model choice stays with providers                                      |
| Memory & Knowledge                   | `/memory`, `/knowledge`, `/context`, `/context-fabric`, `/brain`, `/enterprise-brain`, `/intelligence`, `/ecosystem-intelligence`, `/learning-intelligence`, `/live-intelligence` | Ten engineering surfaces for one idea ("what your AI knows"). Hidden behind **AI**; consolidation is UX-06         |
| Execution concepts                   | `/goals`, `/execution`, `/execution-strategy`, `/loop`, `/autonomous-builder`                                                                                                     | Five surfaces of one user journey. Grouped under **Missions**                                                      |
| Insights                             | sidebar "Insights" item (state-only, no route) + `/intelligence` + Progress sections                                                                                              | Resolved: Insights lives inside **Progress**                                                                       |
| Search                               | sidebar item (state-only) + topbar button + `CommandPalette`                                                                                                                      | Search is a _global action_, not a destination — removed from nav                                                  |

## 4. Proposed (and implemented) information architecture

```
VEDMOUYA
  Home            "What matters to me right now?"
  Missions        goal → mission → plan → execution → verification → result → learning
  Progress        "What is changing in my life?"
  Life            Career · Learning · Business
  AI              providers, models, intelligence, memory, knowledge, context, marketplace
  ────────────────────────────────
  ✨ Ask VedMoulya (opens the existing AI Companion — an action, not a page)
  ────────────────────────────────
  Settings · Profile
```

Mobile: `Home · Missions · Progress · AI · More`, where **More** is a bottom sheet
containing Life, Career, Learning, Business, Marketplace, Ask VedMoulya, Settings, Profile.
`Life` deliberately sits under More: it is a hub of three areas and the five bottom slots
are the scarcest real estate in the product.

Authority: `apps/web/src/lib/navigation-model.ts`. Every surface derives from it —
`stores/navigation-store.ts` (sidebar), `lib/mobile-nav.ts` (tabs, deep links, restore),
`components/MobileTabBar.tsx`, `components/AppShell.tsx` (active state).

## 5. Route mapping — CURRENT ROUTE → NEW USER-FACING LOCATION

| Current route                                                                              | New user-facing location                               | Treatment                                                      |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------- |
| `/`                                                                                        | **Home**                                               | Keep as primary (dashboard = Home)                             |
| `/autonomous-builder`                                                                      | **Missions** (canonical route)                         | Keep, becomes the Missions destination                         |
| `/goals`                                                                                   | Missions → child (Goals)                               | Keep route, drop from primary nav                              |
| `/execution`                                                                               | Missions → child (Execution) + Progress → History link | Keep route, drop from primary nav                              |
| `/execution-strategy`                                                                      | Missions → **Advanced**                                | Keep route, drop from primary nav                              |
| `/loop`                                                                                    | Missions → **Advanced**                                | Keep route, drop from primary nav                              |
| `/progress`                                                                                | **Progress**                                           | **New** (real Life OS snapshot data, existing sections reused) |
| `/life`                                                                                    | **Life**                                               | **New** hub                                                    |
| `/career`                                                                                  | Life → Career                                          | Keep route, drop from primary nav                              |
| `/learning`                                                                                | Life → Learning                                        | Keep route, drop from primary nav                              |
| `/business`                                                                                | Life → Business                                        | Keep route, drop from primary nav                              |
| `/content-agency` (+15 sub-routes)                                                         | Life → Business area (deep-link preserved)             | Keep routes, drop from primary nav                             |
| `/applications`                                                                            | Life (Application Factory)                             | Keep route, drop from primary nav                              |
| `/ai`                                                                                      | **AI**                                                 | **New** hub                                                    |
| `/providers`                                                                               | AI → Providers (**canonical**)                         | Keep — single provider destination                             |
| `/capability-marketplace`                                                                  | AI → Marketplace                                       | Keep route, drop from primary nav                              |
| `/marketplace`                                                                             | AI → Marketplace                                       | Keep route, drop from primary nav                              |
| `/brain`, `/enterprise-brain`                                                              | AI → Intelligence                                      | Keep routes, drop from primary nav                             |
| `/intelligence`, `/ecosystem-intelligence`, `/learning-intelligence`, `/live-intelligence` | AI → Intelligence                                      | Keep routes, drop from primary nav                             |
| `/memory`                                                                                  | AI → Memory                                            | Keep route, drop from primary nav                              |
| `/knowledge`                                                                               | AI → Knowledge                                         | Keep route, drop from primary nav                              |
| `/context`, `/context-fabric`                                                              | AI → Context                                           | Keep routes, drop from primary nav                             |
| `/capabilities`                                                                            | AI (capability registry)                               | Keep route, drop from primary nav                              |
| `/ecosystem`, `/os`, `/ai-world`                                                           | AI                                                     | Keep routes, drop from primary nav                             |
| `/settings`                                                                                | **Settings**                                           | Keep                                                           |
| `/settings?tab=profile`                                                                    | **Profile**                                            | **Deep link added** (`?tab=` support)                          |
| `/onboarding/profile`, `/login`, `/signup`, `/verify-email`, `/oauth2redirect`             | Full-screen (no shell)                                 | Unchanged                                                      |
| `/portal/*`                                                                                | Separate client portal shell                           | Unchanged, out of scope                                        |

**Nothing was deleted.** Every legacy route still resolves; it simply stops competing
for primary navigation space. Legacy screens that call `setActiveSection('<module>')`
are **mapped onto their new parent** by `destinationIdForSection()` — no screen had to
be rewritten, and the sidebar highlight is now truthful.

## 6. Routes to keep (primary) · hide · promote to child/detail

- **Primary today:** `/`, `/autonomous-builder`, `/progress`, `/life`, `/ai`, `/settings`, `/settings?tab=profile`.
- **Hidden from primary navigation (still live + deep-linkable):** the 26 legacy module routes in the table above.
- **Child / detail experiences (target end-state):** Missions → Overview/Plan/Activity/Result/**Advanced**
  (advanced = execution strategy, agent activity, tool calls, provider, context, recovery, checkpoints, execution memory);
  Progress → Overview/Journey/Insights/History; Life → Career/Learning/Business internal areas;
  AI → Overview/Intelligence/Memory/Knowledge/Context/Providers/Models/Marketplace.

## 7. Components that can be reused

| Component                                                           | Reused for                                                                               |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `@vedmoulya/ui` `Sidebar`, `SidebarGroup`, `SidebarItem`            | Desktop nav (extended with an optional divider)                                          |
| `@vedmoulya/ui` `NavBar`, `Breadcrumb`                              | Topbar / breadcrumb                                                                      |
| `@vedmoulya/ui` `BottomSheet`                                       | Mobile **More** sheet                                                                    |
| `components/AICompanion.tsx`                                        | ✨ Ask VedMoulya (already has suggested questions incl. "What should I focus on today?") |
| `components/CommandPalette.tsx`                                     | Global "Search VedMoulya"                                                                |
| `app/sections/*`                                                    | Progress (JourneyOverview, RecommendationsPanel), Life (status colours)                  |
| `lib/api-client.ts` `useLifeOSSnapshot`, `useProviderRuntimeStatus` | Progress / Life / AI real data                                                           |
| `lib/haptics.ts`, `lib/use-network-status.ts`                       | Preserved mobile behaviour                                                               |
| `components/ErrorBoundary`, `SignInRedirect`, `Loading`             | Every new page                                                                           |

## 8. Components that needed modification

| File                             | Change                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `packages/ui/.../Navigation.tsx` | `SidebarGroup.separatorBefore?: boolean`; empty label renders no heading (backwards compatible, 301 UI tests still pass)       |
| `stores/navigation-store.ts`     | Structure now derived from the nav model; `setActiveSection` accepts legacy module ids and maps them to the owning destination |
| `components/AppShell.tsx`        | Active destination **derived from the URL**; removed the duplicated icon map + id→route switch; ✨ Ask opens the AI Companion  |
| `components/MobileTabBar.tsx`    | 5 destinations + More sheet                                                                                                    |
| `lib/mobile-nav.ts`              | Re-based on the nav model; More is never restored as a launch tab                                                              |
| `app/settings/page.tsx`          | `?tab=` deep-link support; highlights Profile vs Settings honestly; links to canonical `/providers`                            |

## 9. Risks

| Risk                                                                | Mitigation                                                                         |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Legacy screens' `setActiveSection('x')` no longer typechecks        | Resolved by `destinationIdForSection()` mapping (verified by the production build) |
| Two destinations share `/settings`                                  | Query-based disambiguation pinned by tests (exactly one is ever active)            |
| `useSearchParams()` would force Suspense boundaries → build failure | Client-only `useClientSearch()` (no Suspense requirement)                          |
| Mobile "More" could become a dumping ground                         | It is a bounded, described list (5 areas + Ask + Settings + Profile)               |
| Progress/Life/AI hubs are thinner than their end state              | They render real data/routes only; consolidation is UX-03…UX-06                    |
| Deep links to legacy routes                                         | Preserved 1:1 — no redirects needed, no 404s introduced                            |
| Nav highlight before hydration                                      | Base destination shows first, corrects on the next tick                            |

## 10. Implementation order still to come

UX-03 Home · UX-04 Missions (internal tabs + Advanced disclosure) · UX-05 Life ·
UX-06 AI · UX-07 Settings · UX-08 Ask VedMoulya quick-action polish ·
UX-09 responsive/mobile polish · UX-10 UX certification.

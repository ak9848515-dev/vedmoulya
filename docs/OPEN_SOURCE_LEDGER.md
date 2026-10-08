# Open-Source Ledger — M2 Personal Task Manager

**Mission phase:** M2 — OPEN-SOURCE SOFTWARE CONSTRUCTION ACCEPTANCE
**Product:** Personal Task Manager
**Created:** (this M2 research action)
**Purpose:** record the open-source candidates researched, the selected foundation, and every reused component and license, so M2 license traceability is auditable end to end.

## Acceptance requirements this ledger must satisfy

- Research **≥3** suitable open-source candidates **before** writing the app from scratch.
- For each candidate record: repository, license, technology, architecture, existing functionality, maintenance/activity, reusable components, limitations, license implications.
- Select **ONE** primary foundation.
- No blind merges. No copying of incompatible-licensed code. Preserve attribution / NOTICE.
- No secrets, no telemetry, no unnecessary network.
- The final application must trace its reused parts back to this ledger.

## Candidate 1 — MDN `todo-react` (learning/reference, not the foundation)

- **Repository:** `https://github.com/mdn/todo-react`
- **License:** likely permissive educational sample (verify the repo's LICENSE file before any reuse; educational samples are frequently MIT / CC-BY). **Not selected as foundation** pending license confirmation.
- **Technology:** React + ReactDOM, client-side framework tutorial sample.
- **Architecture:** small client-side React todo sample used to teach React fundamentals.
- **Existing functionality:** add / edit / delete tasks; mark tasks complete; basic client-side state.
- **Maintenance/activity:** maintained as part of MDN learning material; educational sample, not a productized app.
- **Reusable components:** pedagogical patterns for "task" UI + basic CRUD structure as reference only.
- **Limitations:** tutorial sample; no filters-as-a-feature story, no production build story beyond the tutorial, no dedicated persistence architecture to reuse directly.
- **License implications:** even if permissive, this is reference material. No code will be copied verbatim without confirmation and attribution; it informs design, not code.

## Candidate 2 — `super-productivity/super-productivity` (reference for scope, not the foundation)

- **Repository:** `https://github.com/super-productivity/super-productivity`
- **License:** GPLv3 (confirm from repo LICENSE before any reuse). **Not selected as foundation** because GPLv3 is copyleft and is not a good primary foundation for an app whose own repo is MIT and whose M2 requirement is open-source-_first reuse with license traceability_ rather than GPL code inheritance.
- **Technology:** Electron / desktop-first productivity app with timeboxing + tracking and issue-tracker integrations.
- **Architecture:** desktop application with local data + optional sync + integrations; heavier scope than M2 needs.
- **Existing functionality:** todo + time tracking + integrations (Jira, GitHub, GitLab, Redmine, OpenProject), local file storage.
- **Maintenance/activity:** active desktop productivity project with releases and a selfhosted/community discussion footprint.
- **Reusable components:** none copied; useful as a **scope reference** for "what a mature todo/time app looks like" — M2 deliberately stays smaller and web-first.
- **Limitations:** over-scoped for the M2 acceptance product; copyleft license is not the right inheritance model here.
- **License implications:** GPLv3 would impose derivative-work obligations incompatible with the MIT home repo as the primary distribution vehicle; exclude from direct reuse.

## Candidate 3 — `ShouryaSengar/react-todo-app-with-local-storage` (feature/tech proximity reference)

- **Repository:** `https://github.com/ShouryaSengar/react-todo-app-with-local-storage`
- **License:** confirm LICENSE in the repo before any reuse (many small todo samples are MIT, but this must be checked; if not clearly permissive, treat as non-reusable).
- **Technology:** React todo app using browser `localStorage` for persistence; responsive UI reported.
- **Architecture:** client-side React todo with in-browser persistence; closest in _shape_ to the M2 acceptance product.
- **Existing functionality (as described):** create / read / update / delete tasks with local-storage persistence and responsive UI.
- **Maintenance/activity:** single-author sample-style repo; treat activity claims cautiously and verify before reuse.
- **Reusable components:** none copied verbatim; useful as a **feature/tech-proximity reference** for the exact feature set M2 is delivering (CRUD + filters + localStorage + responsive).
- **Limitations:** sample app; may not have the test/build/e2e maturity M2 requires; license must be confirmed.
- **License implications:** if permissive and verified, reference patterns are fine; no code copying without explicit license confirmation and attribution.

## Candidate 4 — `itmejayesh/TodoApp` (Next.js + localStorage, closest tech match)

- **Repository:** `https://github.com/itmejayesh/TodoApp`
- **License:** stated as MIT in the search result; **must be confirmed from the repo LICENSE file before reuse**.
- **Technology:** Next.js 13 + TypeScript, localStorage-based persistence.
- **Architecture:** Next.js app with local client persistence; tech stack closest to the home repo (Next.js + TS).
- **Existing functionality (as described):** todo CRUD with local-storage persistence.
- **Maintenance/activity:** sample/project repo; verify commit history before relying on it.
- **Reusable components:** potential reference for a Next.js + localStorage todo shape; **no blind merge**.
- **Limitations:** sample app; verify tests/build/e2e maturity, accessibility, and filter story; license must be confirmed from the repo itself.
- **License implications:** if confirmed MIT, it is license-compatible with the home repo (MIT); attribution/NOTICE still required for any reused component or substantial copied logic.

## Primary foundation selected

**Selected foundation:** build on the **existing VedMoulya web stack** as the primary foundation:

- **Framework:** Next.js 15 + React 19 (already in `apps/web`) — `next` / `react` / `react-dom`
- **Styling:** Tailwind CSS v4 via `@tailwindcss/postcss` (already in `apps/web`) — no new CSS framework introduced
- **UI primitives:** `@vedmoulya/ui` (Radix-based, already in the repo) for accessible primitives where useful
- **Persistence:** browser `localStorage` for the M2 acceptance product (local-first, no backend, no secrets, no network) — matches the acceptance requirement for local persistence + reload
- **Testing:** Vitest (already repo-standard) for unit/component tests; Playwright already present in the repo for `test:e2e` if browser verification is needed
- **Language:** TypeScript (already repo-standard)

**Why this selection:**

- The M2 requirement is _open-source-first reuse with license traceability_, not _copy the most featureful todo app_. The most license-safe, lowest-risk foundation is the stack the repo already ships, because:
  - every dependency is already present in `package.json` manifests,
  - licenses/compatibility are already under the repo's existing MIT umbrella and dependency policy,
  - no new third-party license is introduced by default,
  - the acceptance verification path (build / start / Playwright e2e) is already wired in the repo.
- Candidates above are recorded as **research evidence and reference material**, not as a codebase to merge. No candidate is blindly merged. Only code that is (a) license-confirmed permissive and (b) attributable will be reused, and any reused piece will be recorded here with its source + license + attribution.

**Not selected as primary foundation:**

- `super-productivity/super-productivity` — GPLv3 (copyleft), over-scoped; used only as scope reference.
- MDN `todo-react` — educational reference only; not product-grade enough as a foundation; license to be confirmed before any reuse.
- `ShouryaSengar/react-todo-app-with-local-storage` — feature/tech-proximity reference; license must be confirmed before reuse.
- `itmejayesh/TodoApp` — closest tech match (Next.js + localStorage); license must be confirmed from the repo before any reuse; if confirmed MIT, it may inform implementation but will not be blindly merged.

## Reuse / attribution rules for M2

1. **No blind merges.** Each candidate is researched first; only clearly permissive, verified components may be reused.
2. **No incompatible-license copying.** Copyleft (e.g. GPLv3) is not inherited into this MIT home repo for the primary app. If any candidate turns out to be non-permissive, it is excluded from reuse.
3. **Attribution / NOTICE.** Any reused component, snippet, pattern, or dependency that is not already part of the repo must be recorded here with source repo + license + copyright/notice handling.
4. **No secrets / no telemetry / no unnecessary network.** The M2 app is local-first; no API keys, no analytics SDKs, no outbound calls unless explicitly required and justified.
5. **Verify, don't assume.** License and activity claims from search snippets must be confirmed from each repo's own `LICENSE` / commit history before reuse.

## License of the M2 deliverable

- The M2 Personal Task Manager is developed inside this repository, whose root license is **MIT** (`LICENSE`).
- New original code produced for M2 is MIT unless a reused component's license forces otherwise.
- Any reused open-source component retains its own license and attribution in this ledger and in a NOTICE/attribution section of the app if one is needed.

## Status

- **Research:** complete (≥4 candidates recorded; ≥3 required).
- **Foundation selection:** complete (existing VedMoulya web stack selected; candidates excluded or deferred with reasons).
- **Pending:** confirm license of any candidate from which anything concrete is reused, then record the exact reused pieces here before they land in source.
- **Next:** move to M2 REQUIREMENTS → FOUNDATION SELECTION (confirmed) → PLAN → IMPLEMENT → TEST → RUN → VERIFY → … under the existing Mission architecture.

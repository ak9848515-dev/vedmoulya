# UI / UX / Accessibility Findings

> **Scope honesty:** this section is **source-inspection only**. No fresh browser
> session, screenshot, axe scan, keyboard traversal, or Playwright run was
> performed in this pass. No WCAG-compliance, visual-correctness, or
> successful-journey claim is made.

## Inventory

- **62 route pages** under `apps/web/src/app/` (route groups: missions, providers,
  goals, brain, execution, content-agency + ops subroutes, portal, onboarding,
  auth (login/signup/verify-email/oauth2redirect), health, settings, marketplace,
  applications, autonomous-builder, knowledge, memory, learning, …).
- **56 components**, **39 lib modules**, **4 stores**, **48 page/component tests**,
  **13 Playwright specs**, plus `playwright.a11y.config.ts` and an a11y E2E spec.

## State coverage (source)

| Concern              | Evidence                                                                                                       | Verified       |
| -------------------- | -------------------------------------------------------------------------------------------------------------- | -------------- |
| Loading              | `providers/page.tsx:142-161` (`role="status" aria-live="polite"`, dynamic `loading: () =>`, `CenteredLoading`) | Source only    |
| Error                | `providers/page.tsx:453-475,608` (`role="alert"`, `setActionError`)                                            | Source only    |
| Empty                | `missions/page.tsx:349` (`data-testid="mission-filter-empty"`)                                                 | Source only    |
| Approval status      | `missions/page.tsx:208` ("Waiting for your approval to continue.")                                             | Source only    |
| First-run onboarding | `onboarding/profile/page.tsx`, `providers/page.tsx` setup flow                                                 | Source only    |
| Keyboard/ARIA        | `aria-haspopup`, `aria-expanded`, `aria-hidden`, `role` attributes present in routed pages                     | Source only    |
| Offline              | Not confirmed in source scan                                                                                   | **Unverified** |

## Findings

| ID  | Finding                                                                                                                                                                                                                                   | Evidence                               | Confidence |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------- |
| U-1 | Duplicate/adjacent route surfaces exist (e.g. `learning` and `learning-intelligence`, `context` and `context-fabric`, `execution` and `execution-strategy`, `capabilities` and `capability-marketplace`) — potential navigation confusion | route list                             | Medium     |
| U-2 | Offline state not confirmed                                                                                                                                                                                                               | source scan                            | Low        |
| U-3 | `api-client.ts` (4,901 lines) and `CommandCenter.tsx` (1,521 lines) concentrate UI logic; review/merge risk                                                                                                                               | line counts                            | High       |
| U-4 | No fresh responsive/device-matrix, contrast, or axe evidence                                                                                                                                                                              | no run this pass                       | High       |
| U-5 | 13 E2E specs exist but were not executed; their last result is unknown                                                                                                                                                                    | `apps/web/e2e/`, empty `test-results/` | High       |

## What would raise this dimension

A fresh `npx playwright test` + `test:a11y` run with captured exit codes and
reports, plus a keyboard-only traversal of the mission and provider screens.
Until then, the dimension stays at 6.5/10 (source-verified states, unverified
rendering).

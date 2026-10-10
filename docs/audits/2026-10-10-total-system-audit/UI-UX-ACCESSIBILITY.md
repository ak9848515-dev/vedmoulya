# UI/UX and Accessibility

## Scope and evidence

The app has 63 App Router page files across first-run/settings, mission/execution, opportunity/delivery, and intelligence/catalog surfaces (`apps/web/src/app/**/page.tsx`). This breadth is inventory, not evidence of usability. Component tests and established UI primitives exist. No fresh browser, responsive, keyboard, screen-reader, or accessibility-suite run was completed for this baseline.

## Confirmed baseline issue

Full `npm test` fails in `apps/web/src/components/__tests__/CommandCenter.test.tsx`, case “expands an opportunity card with category/evidence/next-action (SPRINT-035 drill-down).” Stack: `OpportunityValueIntelligencePanel.tsx:129` → `useMissionStatus` → `api-client.ts:4384`, where the CommandCenter test’s `vi.mock('../../lib/trpc.js')` lacks the `mission.status` namespace. The focused 302-test execution/mission/provider run does not include this UI test. This is a test-fixture integration gap and must be reproduced/fixed, then the UI suite rerun.

## Source-derived UX risks (not visually verified)

- 63 destinations can obscure a clear first-success path; validate actual navigation in browser before redesigning.
- Mission progress is trust-critical: planned/running/verified/failed and draft/submitted/paid must remain separate states.
- Provider configuration, credentials, health, and successful generation are distinct; surface actionable errors and avoid status conflation.
- Historical local model report runs take minutes; long operations need visible step progress, heartbeat, and retry state.
- Loading, empty, offline, error, and responsive states vary by route; no current cross-route browser evidence supports a blanket quality claim.

## Acceptance work

After fixing the test fixture, run the app’s available Playwright/core journeys and `npm run test:a11y` if the local environment supports them. Record screenshots and exact result. Do not report accessibility or production responsiveness as verified from source inspection.

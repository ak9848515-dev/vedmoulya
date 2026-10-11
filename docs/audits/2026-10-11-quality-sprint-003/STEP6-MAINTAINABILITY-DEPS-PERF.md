# Step 6 — Maintainability, Dependencies, Performance

## 1. Development dependency advisories (D-07)

`npm audit --audit-level=high` → **17 vulnerabilities (5 low, 12 high)**; exit 1.
`npm audit --production` → **0 vulnerabilities**; exit 0.

All high findings trace to the **Storybook webpack toolchain** (dev-only):

- `webpack-dev-middleware < 7.4.5` — path traversal via non-slash-terminated
  `publicPath` (GHSA-g84c-rxfj-3j2c), pulled by `@storybook/builder-webpack5`.
- `@storybook/react-docgen-typescript-plugin`, pulled by
  `@storybook/preset-react-webpack` via `@storybook/nextjs`.

Storybook is `^10.6.0` (`apps/web`). Upstream advisory says **No fix available**
for the webpack5 builder chain.

**Disposition:** documented, **not release-blocking** (production dependency
surface is clean). **Recommended mitigation** (not applied — would require
Storybook builder migration and story re-validation): move from the webpack5
builder to a Vite-based Storybook builder (`@storybook/nextjs-vite`) to drop the
`webpack-dev-middleware` transitive dependency. Owner: web.

## 2. Documentation alignment (D-06 / G-02) — DONE

`05_Docs/CURRENT_ARCHITECTURE_STATE.md` and `05_Docs/PROJECT_STATUS.md` were
stale (claimed Google/OpenRouter/Ollama catalog-only). Corrected to match
`packages/core/src/startup/provider-runtime.ts` and
`services/orchestrator/src/index.ts` (`registerPlatformProviders`). Committed
`2356fa90`. The canonical `EPIC_019_PROVIDER_RUNTIME_MATRIX.md` and README were
already correct. Historical EPIC-019 completion report left as the dated record.

## 3. Oversized composition files (D-02) — deferred with rationale

`RouterRegistry.ts` 7,003 · `api-client.ts` 4,901 · `ApiApplicationService.ts`
3,150 · `MissionControllerService.ts` 1,838 · `WorldModelService.ts` 2,052.
Splitting these is behavior-risky and needs a dedicated, individually-reviewed
change with full-suite coverage. Per the "bounded step / small behavior-preserving
change" rule, **not attempted this sprint**; recommended as its own item.

## 4. Performance — not measured

No fresh benchmark or bundle-size measurement was run this sprint (budget and
environment). The repo ships benchmark scripts (`npm run benchmarks`,
`check-bundle-size.sh`) — running them is the acceptance path. **Unverified.**

## 5. Repository hygiene (D-11)

- Temporary artifacts from this sprint live only as untracked local files:
  `.sprint3-provider-probe.ts`, `.sprint3-*.log`, `_sprint3-live/`. None are staged.
- Existing tracked `*.tsbuildinfo` and root `*.log` files are pre-existing and
  preserved (not deleted).
- The orphaned, untracked `packages/local-workspace/` dist-residue directory was
  **not** deleted (git-ignored; not a workspace; no tracked work).

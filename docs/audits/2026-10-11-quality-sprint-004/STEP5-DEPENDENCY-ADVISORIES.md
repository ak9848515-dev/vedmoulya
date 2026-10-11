# STEP 5 — D-07 Development Dependency Advisories

**Sprint:** VM-QUALITY-SPRINT-004
**Commands:** `npm audit --json`, `npm audit --omit=dev --json` (repo root)

## 1. Measured exposure

| Scope                              | Total | Critical |   High | Moderate |   Low |
| ---------------------------------- | ----: | -------: | -----: | -------: | ----: |
| All dependencies                   |    17 |        0 | **12** |        0 |     5 |
| **Production only (`--omit=dev`)** | **0** |    **0** |  **0** |    **0** | **0** |

**Verified:** none of the 17 advisories are reachable from production
dependencies. Every affected package sits in a `devDependencies` block (confirmed
by inspecting `apps/web/package.json` and by the `--omit=dev` result of 0 across
all severities). The production `next build` also completed successfully
(`BUILD_EXIT=0`) with these dev dependencies installed, i.e. they do not enter the
shipped bundle.

## 2. Advisory clusters and dispositions

### Cluster A — Storybook webpack build chain · **Unresolved, mitigated**

- `@storybook/nextjs` (direct, `apps/web` devDeps), `@storybook/builder-webpack5`,
  `@storybook/preset-react-webpack`,
  `@storybook/react-docgen-typescript-plugin`, `webpack-dev-middleware`
  (`GHSA-g84c-rxfj-3j2c`).
- `fixAvailable: false` for all five — **no upstream patch exists** in the current
  Storybook line.
- Compensating mitigation (evidence-based, not asserted):
  1. Dev-only — `npm audit --omit=dev` reports **0** advisories.
  2. Not referenced by any CI workflow (`grep storybook .github/workflows/*.yml`
     → no matches), so it is not on any release path.
  3. Absent from the production artifact (production build succeeds; Storybook is
     a devDependency of `apps/web`).

### Cluster B — commitizen / cz-conventional-changelog chain · **Unresolved, accepted**

- `commitizen` (direct root), `cz-conventional-changelog` (direct root) and
  transitive `braces`, `find-node-modules`, `findup-sync`, `micromatch`.
- `fixAvailable` requires a **semver-major** change (npm proposes
  `commitizen@2.8.2`). This is a forced major (downgrade) of local commit tooling,
  which the mission explicitly discourages.
- Disposition: dev-only local tooling, not shipped; accepted, no action.

### Cluster C — lint-staged · **Unresolved, accepted**

- `lint-staged` (direct root). Fix requires `lint-staged@17.6.0` — a **semver-major**
  upgrade.
- Disposition: dev-only pre-commit tooling; a major upgrade is not justified by a
  dev-tooling advisory. Accepted, no action.

## 3. Hygiene note (not an advisory)

Storybook version skew: `apps/web` pins `^10.6.0` while `packages/ui` pins
`^8.6.14`. Consolidating the Storybook major is a separate, optional cleanup — it
is **not** required to resolve any advisory and was not performed here.

## 4. What was NOT done (deliberately)

- No blanket `overrides`, no forced major upgrades, no lockfile churn — the mission
  forbids these without evidence, and here the fixes are either nonexistent or
  semver-major.
- No advisory was "closed" by suppression or by weakening an audit threshold.

## 5. Acceptance

Every high-severity advisory now has an explicit disposition: two evidence-based
mitigations (Cluster A) and two explicit unresolved/accepted dispositions
(Clusters B, C), each with the production-exposure measurement that justifies it.
D-07 moves from "12 high-severity advisories (unquantified exposure)" to
"**0 production advisories**, 12 dev-only advisories with recorded dispositions".

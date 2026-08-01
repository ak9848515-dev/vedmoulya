# VedMoulya — Dependency Policy

**Version:** 1.0.0 · **Owner:** Engineering Governance · **Status:** ACTIVE
**Applies to:** all `apps/*`, `packages/*`, `services/*` npm workspaces.

---

## 1. Purpose

Define how dependencies are added, upgraded, scanned, and removed so the
monorepo stays secure, maintainable, and reproducible.

## 2. Dependency Tiers

| Tier | Category       | Examples                                       | Change cadence           |
| ---- | -------------- | ---------------------------------------------- | ------------------------ |
| T1   | Runtime        | `@trpc/server`, `hono`, `drizzle-orm`, `react` | Weekly (Dependabot)      |
| T2   | Build/dev      | `typescript`, `vitest`, `eslint`               | Weekly (Dependabot)      |
| T3   | Infrastructure | `postgres:16-alpine`, `redis:7-alpine`         | Manual review, quarterly |
| T4   | Transitive     | anything in the npm tree                       | Automatic with parent    |

## 3. Adding a New Dependency

1. Prefer a workspace-local `devDependency` over a root dependency.
2. All new runtime dependencies MUST be reviewed for: maintenance status,
   license compatibility (MIT/Apache-2.0/BSD preferred), supply-chain
   reputation, and bundle impact.
3. Declare it in the owning workspace's `package.json` and run
   `npm install` so `package-lock.json` is updated atomically.
4. CI validates the change via the security gate (`npm audit`) and the
   build gate.

## 4. Upgrade Schedule

- **Dependabot** opens PRs weekly (Mondays 04:00 UTC) for `npm` and
  `github-actions` ecosystems — see `.github/dependabot.yml`.
- Grouped PRs (TypeScript, React, test tooling) reduce review noise.
- Major upgrades of `next`, `react`, `react-dom` are intentionally ignored
  by Dependabot and handled in dedicated migration sprints.

## 5. Security Update Process

| Severity | npm audit level | Response time  | Action                       |
| -------- | --------------- | -------------- | ---------------------------- |
| Critical | `critical`      | Within 24h     | Hotfix branch, patch release |
| High     | `high`          | Within 7 days  | Next patch release           |
| Moderate | `moderate`      | Within 30 days | Next minor release           |
| Low      | `low`           | Tracked        | Backlog                      |

1. Run `npm audit` locally or rely on the CI security gate.
2. If a fix exists (`npm audit fix`), apply it in a dedicated commit.
3. If no fix exists, open a CVE tracking entry in `CVE_TRACKING.md`.
4. Review impact in the risk register (`docs/RC-001_D16_Risk_Register.md`).

## 6. Release Dependency Checklist

Before every release, verify:

- [ ] `npm audit --audit-level=high` reports **0** high/critical issues
      (or each remaining issue is tracked in `CVE_TRACKING.md`).
- [ ] `package-lock.json` is committed and in sync with all workspaces.
- [ ] Dependabot PRs merged since the last release are listed in release notes.
- [ ] All workspaces build with the locked dependency set
      (`npm ci && npm run build`).
- [ ] No `file:`/local-path dependency leaked into a published artifact.
- [ ] Lockfile was generated with the pinned `engines` (Node >= 20, npm >= 10).

## 7. Enforcement

Enforcement is automated in CI: `npm audit` (security gate), `npm ci`
(reproducible installs), and the release workflow's validation job.

---

**Related:** [`CVE_TRACKING.md`](./CVE_TRACKING.md) · `.github/dependabot.yml`

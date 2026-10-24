# VedMoulya — CVE Tracking

**Version:** 1.0.0 · **Last audit:** 2026-10-24 (security hardening audit) · **Baseline:** `npm audit --omit=dev --audit-level=high` + full `npm audit`

---

## Status Summary

| Metric                             | Value                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| Last full audit                    | 2026-10-24 (security hardening audit)                                        |
| **Production deps (`--omit=dev`)** | **0 (high-blocking gate passes: 0 vulnerabilities)**                         |
| Critical vulnerabilities (full)    | 0                                                                            |
| High vulnerabilities (full)        | 4 (all dev-only, no runtime exposure — see table)                            |
| Moderate/low (transitive, no-fix)  | 5 tracked (see below)                                                        |
| Dependabot                         | ✅ Enabled (weekly)                                                          |
| CI gate                            | ✅ `npm audit --omit=dev --audit-level=high` + full `--audit-level=critical` |

## Resolved in the 2026-10-24 Security Audit

Applied via `packages/ui` dependency correction, `apps/web` version bumps, and `overrides` in root `package.json`:

| Package        | Fix Applied                        | Advisory / CVE                                                |
| -------------- | ---------------------------------- | ------------------------------------------------------------- |
| `@storybook/*` | Moved to `devDependencies` in `ui` | GHSA-f2ph-cmg5-wxc8, GHSA-px85-f4q5-jh77 (code injection)     |
| `storybook`    | Updated to `10.6.3` in `apps/web`  | GHSA-f2ph-cmg5-wxc8, GHSA-px85-f4q5-jh77 (critical preview)   |
| `next`         | `15.5.28` (backport patch)         | GHSA-2464-fhr4-w9xw (SVG RCE), GHSA-p3m5-59mp-jv5r (DoS)      |
| `undici`       | `7.30.1`                           | GHSA-4qv8-2p9j-2685, GHSA-f72v-6w45-q472, GHSA-xjj6-f33q-929c |
| `hono`         | `4.13.13`                          | GHSA-5r4p-p66f-jhc7 (`serveStatic` decode middleware bypass)  |
| `nodemailer`   | `10.2.1`                           | GHSA-8c8m-p3m8-cjg8, GHSA-m943-m63m-w62w, GHSA-85x2-q946-cp5h |
| `zod`          | `4.6.7`                            | GHSA-mrhx-c7xc-m3w5 (collection memory exhaustion)            |
| `fast-uri`     | `3.1.9`                            | GHSA-w74x-v6f9-j3xg, GHSA-xhq7-xmqj-769h                      |
| `vite`         | `6.4.5`                            | GHSA-698v-4r3x-3vcv, GHSA-r825-w8mm-5pxw                      |
| `vitest`       | `5.0.5`                            | GHSA-qxg6-89mg-rqv8, GHSA-xp26-3454-mjgp                      |

## Known Remaining Issues (dev-only, no safe fix)

These are all dev/build-toolchain only — never shipped to production bundles.
`npm audit --omit=dev` is clean (0 high/critical).

| #   | Package                                                       | Severity | Impact                               | Status / Plan                                                                                                                                              |
| --- | ------------------------------------------------------------- | -------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `js-yaml` 4.x (CVE-2026-59870)                                | High     | Quadratic CPU in `!!omap` resolution | Fix NOT backported to 3.x/4.x; 5.x (fixed) is incompatible with `cosmiconfig@^4.1.0` (commitlint/commitizen). Revisit when cosmiconfig moves to js-yaml 5. |
| 2   | `image-size` 1.2.1 (GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq) | High     | ICNS / JXL / HEIF infinite-loop DoS  | No patched release. Dev-only via `@storybook/nextjs`. Re-evaluate on the next Storybook upgrade.                                                           |
| 3   | `@storybook/nextjs`                                           | Low      | Unknown                              | Dev-only; re-evaluate on upgrade                                                                                                                           |
| 4   | `browserify-sign`                                             | Low      | Unknown                              | Dev-only; re-evaluate on upgrade                                                                                                                           |
| 5   | `create-ecdh`                                                 | Low      | Unknown                              | Dev-only; re-evaluate on upgrade                                                                                                                           |
| 6   | `crypto-browserify`                                           | Low      | Unknown                              | Dev-only; re-evaluate on upgrade                                                                                                                           |
| 7   | `elliptic` (GHSA-848j-6mx2-7j84)                              | Low      | Unknown                              | Dev-only; no patched release (`*` range)                                                                                                                   |
| 8   | `node-polyfill-webpack-plugin`                                | Low      | Unknown                              | Dev-only; re-evaluate on upgrade                                                                                                                           |

> Entries 3–8 are the `elliptic` crypto chain pulled in by Storybook's webpack
> polyfills. The list is regenerated on every audit — run `npm audit --json`
> before planning an upgrade sprint.

## Process

1. **Detect** — Dependabot PRs + CI `npm audit`.
2. **Triage** — classify per `DEPENDENCY_POLICY.md` §5.
3. **Track** — add a row below when a high/critical issue has no fix.
4. **Resolve** — fix release → verify with `npm audit` → remove the row.
5. **Review** — full sweep every release (release dependency checklist).

## Production Exposure

CI enforces TWO audit gates in the security / release jobs:

1. `npm audit --omit=dev --audit-level=high` — **blocks** on any high+ in
   shipped (production) dependencies. Currently clean.
2. `npm audit --audit-level=critical` — blocks on criticals across the full
   tree (including dev toolchain).

---

**Related:** [`DEPENDENCY_POLICY.md`](./DEPENDENCY_POLICY.md)

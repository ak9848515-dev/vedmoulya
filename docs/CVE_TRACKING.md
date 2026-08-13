# VedMoulya — CVE Tracking

**Version:** 1.0.0 · **Last audit:** 2026-08-09 (hardening audit) · **Baseline:** `npm audit --omit=dev --audit-level=high` + full `npm audit`

---

## Status Summary

| Metric                             | Value                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| Last full audit                    | 2026-08-09 (hardening audit)                                                 |
| **Production deps (`--omit=dev`)** | **0 (high-blocking gate now runs in CI)**                                    |
| Critical vulnerabilities (full)    | 0                                                                            |
| High vulnerabilities (full)        | 3 (all dev-only, no safe fix — see table)                                    |
| Moderate/low (transitive, no-fix)  | 5 tracked (see below)                                                        |
| Dependabot                         | ✅ Enabled (weekly)                                                          |
| CI gate                            | ✅ `npm audit --omit=dev --audit-level=high` + full `--audit-level=critical` |

## Resolved since the 2026-08-01 baseline

Applied via `overrides` in the root `package.json` (2026-08-09) — both were
dev-toolchain only, but the fixes were trivial and peer-safe:

| Package    | From → To      | Advisory                                                                                       |
| ---------- | -------------- | ---------------------------------------------------------------------------------------------- |
| `fast-uri` | 3.1.4 → 3.1.5  | host confusion via backslash authority introducer                                              |
| `vite`     | 5.4.21 → 6.4.3 | `server.fs.deny` bypass, optimized-deps `.map` traversal, launch-editor NTLMv2 hash disclosure |

> `vite@6.4.3` is accepted by BOTH `@storybook/*` 8.6 peers (`^4||^5||^6`)
> and `vitest@4` (`^6||^7||^8`), so the previous Storybook peer-cap note is
> obsolete — the safe 6.x line is installed and verified working.

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

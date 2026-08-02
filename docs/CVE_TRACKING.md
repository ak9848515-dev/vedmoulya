# VedMoulya — CVE Tracking

**Version:** 1.0.0 · **Last audit:** 2026-08-01 (SPRINT PR-001) · **Baseline:** `npm audit --audit-level=high`

---

## Status Summary

| Metric                            | Value                                             |
| --------------------------------- | ------------------------------------------------- |
| Last full audit                   | 2026-08-01 (SPRINT PR-001)                        |
| Critical vulnerabilities          | 0                                                 |
| High vulnerabilities              | 1 (dev-only, no safe fix — see table)             |
| Moderate/low (transitive, no-fix) | 6 tracked (see below)                             |
| Dependabot                        | ✅ Enabled (weekly)                               |
| CI gate                           | ✅ `npm audit --audit-level=high` in security job |

## Known Transitive Issues (no upstream fix yet)

These require breaking major upgrades of their parent packages and are
scheduled in the next upgrade sprint. They do NOT block releases while they
remain moderate/low.

| #   | Package                          | Severity | Impact  | Status / Plan                            |
| --- | -------------------------------- | -------- | ------- | ---------------------------------------- |
| 1   | `@storybook/nextjs`              | Low      | Unknown | Dev-only; re-evaluate on upgrade         |
| 2   | `browserify-sign`                | Low      | Unknown | Dev-only; re-evaluate on upgrade         |
| 3   | `create-ecdh`                    | Low      | Unknown | Dev-only; re-evaluate on upgrade         |
| 4   | `crypto-browserify`              | Low      | Unknown | Dev-only; re-evaluate on upgrade         |
| 5   | `elliptic` (GHSA-848j-6mx2-7j84) | Low      | Unknown | Dev-only; no patched release (`*` range) |
| 6   | `node-polyfill-webpack-plugin`   | Low      | Unknown | Dev-only; re-evaluate on upgrade         |

> PR-001 (2026-08-01): the 6 low findings above remain after the `sharp
^0.35.0` / `uuid ^11.1.1` override realignment (audit down from 12 to 7 =
> 6 low + 1 high dev-only). All lows are transitive dev-only packages in the
> elliptic crypto chain pulled in by Storybook's webpack polyfills. The list
> is regenerated on every audit — re-run `npm audit --json` to enumerate
> current entries before planning an upgrade sprint.

## Process

1. **Detect** — Dependabot PRs + CI `npm audit`.
2. **Triage** — classify per `DEPENDENCY_POLICY.md` §5.
3. **Track** — add a row below when a high/critical issue has no fix.
4. **Resolve** — fix release → verify with `npm audit` → remove the row.
5. **Review** — full sweep every release (release dependency checklist).

## Open High/Critical (no safe fix available)

| #   | Package                                              | Severity | Reason / Impact                                                                                                                                                                                                                                                                                                                                                                                      | Mitigation                                               | Recommended future action                                                                                     |
| --- | ---------------------------------------------------- | -------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | `vite@5.4.21` (dev, via `@storybook/*` builder-vite) |     High | GHSA-fx2h-pf6j-xcff (high) — `server.fs.deny` bypass on Windows alternate paths; chain also includes GHSA-4w7w-66w2-5vf9 (moderate, `.map` path traversal) and GHSA-v6wh-96g9-6wx3 (moderate, launch-editor). Affects the Storybook dev server only; never shipped to production bundles or runtime. `npm audit fix` fails (ERESOLVE): Storybook peers cap at vite 6 while vitest@4 requires vite 8. | Dev-only: affected code is never executed in production. | Upgrade `@storybook/*` to a version whose peer range admits a patched vite. Track in the next upgrade sprint. |

> PR-001 note (2026-08-01): dependency overrides for `sharp ^0.35.0` and
> `uuid ^11.1.1` were applied via the lockfile (resolved the previously
> reported transitive advisories), reducing the audit from 12 → 7 findings
> (6 low, 1 high dev-only).

---

**Related:** [`DEPENDENCY_POLICY.md`](./DEPENDENCY_POLICY.md)

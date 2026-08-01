# VedMoulya — CVE Tracking

**Version:** 1.0.0 · **Last audit:** 2026-07-31 · **Baseline:** `npm audit --audit-level=high`

---

## Status Summary

| Metric                            | Value                                             |
| --------------------------------- | ------------------------------------------------- |
| Last full audit                   | 2026-07-31 (RC-001 / PH-001)                      |
| Critical vulnerabilities          | 0                                                 |
| High vulnerabilities              | 0                                                 |
| Moderate/low (transitive, no-fix) | 14 tracked (see below)                            |
| Dependabot                        | ✅ Enabled (weekly)                               |
| CI gate                           | ✅ `npm audit --audit-level=high` in security job |

## Known Transitive Issues (no upstream fix yet)

Tracked from the RC-001 project report (§5). These require breaking major
upgrades of their parent packages and are scheduled in the next upgrade
sprint. They do NOT block releases while they remain moderate/low.

| #    | Package (parent)    | Severity     | Impact  | Status / Plan                 |
| ---- | ------------------- | ------------ | ------- | ----------------------------- |
| 1    | `next` (transitive) | Low          | Unknown | Re-evaluate on next major     |
| 2–14 | (grouped)           | Low/moderate | Unknown | Re-evaluate in upgrade sprint |

> Note: the full list is regenerated on every audit. Re-run
> `npm audit --json` to enumerate current entries before planning an
> upgrade sprint.

## Process

1. **Detect** — Dependabot PRs + CI `npm audit`.
2. **Triage** — classify per `DEPENDENCY_POLICY.md` §5.
3. **Track** — add a row below when a high/critical issue has no fix.
4. **Resolve** — fix release → verify with `npm audit` → remove the row.
5. **Review** — full sweep every release (release dependency checklist).

## Open High/Critical (no fix available)

_None currently. All high/critical issues found have an upstream fix._

---

**Related:** [`DEPENDENCY_POLICY.md`](./DEPENDENCY_POLICY.md)

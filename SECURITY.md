# Security Policy

VedMoulya takes the security of the platform and its users seriously. We
appreciate the community's help in disclosing vulnerabilities responsibly.

## Supported Versions

Security fixes are released for the latest published minor version of each
release line. When a vulnerability is disclosed, the current release receives
a patch release as soon as a fix is available.

| Version | Supported        |
| ------- | ---------------- |
| 1.x     | ✅ Supported     |
| < 1.0   | ❌ Not supported |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report vulnerabilities privately so they can be assessed and fixed
before public disclosure:

- **Preferred:** open a private advisory at
  <https://github.com/ak9848515-dev/vedmoulya/security/advisories/new>
- **Alternative:** contact the repository owner on GitHub at
  <https://github.com/ak9848515-dev> for coordination (sensitive details
  should still be submitted through the private advisory flow)

Include as much of the following as possible:

1. Affected component(s) and version(s)
2. Steps to reproduce (including any configuration or environment details)
3. Impact of the vulnerability (what an attacker could achieve)
4. Any suggested remediation, if known

## What to Expect

- **Acknowledgement** — the report is acknowledged within 3 business days.
- **Triage** — the vulnerability is assessed and assigned a severity using
  the CVSS framework.
- **Fix & release** — a fix is prepared, tested, and shipped in a patch
  release. Timeline depends on severity and complexity.
- **Disclosure** — details are published after a fix is available, giving
  users time to upgrade.

Vulnerabilities affecting the platform's runtime, authentication,
authorization, or data confidentiality are treated as highest priority.

## Security Audits

Dependency vulnerabilities are tracked continuously:

- **Dependabot** is enabled (weekly) and CI gates critical/high findings.
- The current audit baseline is maintained in
  [`docs/CVE_TRACKING.md`](docs/CVE_TRACKING.md), including known transitive
  issues with no upstream fix and their mitigation plans.

## Security controls

VedMoulya enforces the following gates on every commit to `main` via CI:

| Control                       | Tool                                      | Requirement                                  |
| :---------------------------- | :---------------------------------------- | :------------------------------------------- |
| SAST — static analysis        | GitHub CodeQL (JavaScript/TypeScript)     | 0 unresolved blocking alerts                 |
| Dependency audit (production) | `npm audit --omit=dev --audit-level=high` | Exit 0 (0 production vulnerabilities)        |
| Secret scanning               | `scripts/s56-secret-scan.ps1`             | 0 hits in shipped source                     |
| Type safety                   | TypeScript strict mode                    | 0 errors                                     |
| Code style                    | ESLint + Prettier                         | 0 failures across all workspaces             |
| Test coverage                 | Vitest                                    | ≥ 80% per workspace                          |
| Dependency graph              | Internal cycle checker                    | 0 cycles across all workspaces               |
| Accessibility                 | Playwright WCAG                           | All production routes pass structural checks |
| Bundle size                   | `scripts/check-bundle-size.sh`            | Shared JS < 150 kB                           |

## Scope

This policy covers the VedMoulya source code and its published artifacts
(Docker images, npm workspaces). It does not cover:

- Third-party services a deployment integrates with (databases, Redis, AI
  providers, hosting platforms)
- End-user environments or custom deployments outside official artifacts

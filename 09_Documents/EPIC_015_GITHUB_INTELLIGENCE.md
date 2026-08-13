# EPIC-015 — GitHub Intelligence

> **Status:** Implementation verified (2026-08-11). Live GitHub App exchange is
> an **operator step**; the deterministic adapter + narrow ports are the
> hermetic default.

---

## 1. Connection model (separate from Google auth)

```
VedMoulya Google Login → VedMoulya account → Connect GitHub →
GitHub authorization → User reviews requested permissions →
GitHub connected → VedMoulya receives only the permissions necessary →
GitHub Intelligence becomes available
```

- **Google auth is unchanged** and its identity token is **never reused** as a
  GitHub credential.
- A separate **Connect GitHub** authorization flow (GitHub App architecture:
  fine-grained permissions, short-lived tokens).
- Users can: connect, see the connected account, see granted permissions, see
  accessible repositories, verify, revoke, disconnect, and see the last
  verification time.

## 2. Permission model (least privilege)

| Scope                | Default      | Boundary                                     |
| -------------------- | ------------ | -------------------------------------------- |
| `public_metadata`    | always       | Public discovery needs NO repo access        |
| `public_repos_read`  | explicit     | read-only, explicit review                   |
| `private_repos_read` | explicit     | private repos require explicit authorization |
| `orgs_read`          | explicit     | organization metadata                        |
| `repos_write`        | NEVER silent | separate consent flag + separate approval    |

Granted scopes are the intersection of requested and provider-granted — never
broader than what the user reviewed. Future write operations require separate
permissions and separate approval.

## 3. Repository acquisition flow

```
DISCOVERED → SECURITY REVIEW → RELEVANCE → APPROVAL → ACQUIRE → SANDBOX →
ANALYZE → STORE INTELLIGENCE → OPTIONAL CONFIGURATION
```

- Public / authorized-private / GitHub-App-authenticated repositories.
- **READ ≠ CLONE ≠ EXECUTE ≠ INSTALL ≠ CONFIGURE ≠ USE** — distinct permissions.
- Reading never implies safe execution; no sandbox → `SECURITY_REVIEW_REQUIRED`.

## 4. Repository intelligence facts

Where evidence exists: owner/org, name, URL, visibility, description, stars,
forks, watchers, issues, releases, commit activity, last update, license,
language, dependencies, installation method, package manager, Docker/runtime
requirements, API availability, local-execution capability, model/GPU/network
requirements, environment variables, secrets, external services, permissions,
security advisories. **Popularity is never proof of quality or safety.**

## 5. Implementation

- **Package:** `GitHubConnectionManager` (least-privilege state machine +
  permission views) and `AcquisitionPlanner` in `@vedmoulya/ecosystem-intelligence`.
- **Gateway:** `github.*` tRPC namespace + deterministic `GitHubAuthPort` and
  `GitHubRepoSourcePort` (public repos from the AI World discovery store; private
  repos only under an explicit `private_repos_read` grant).
- **UI:** `/ecosystem-intelligence` → GitHub Connect tab: permission review with
  explicit consent toggles, authorization flow, verify/revoke/disconnect,
  accessible-repositories list. Tokens/codes never rendered.

## 6. Honest limitations

- Live GitHub App exchange, live repo scanning and real security advisories are
  **operator steps** (no credentials on this machine).
- Discovered repositories remain **untrusted input**; nothing is cloned,
  installed or executed by this phase.

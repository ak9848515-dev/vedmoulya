# EPIC-015 — VedMoulya Intelligence: Security Model

> **Status:** Implementation verified (2026-08-11).

---

## 1. Threat model

The Intelligence layer ingests **untrusted ecosystem content** (discovered
providers, models, GitHub repositories, external applications) and coordinates
**user decisions** about them. Threats:

| Threat                                      | Mitigation                                                                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Poisoned/steering discovery metadata        | Discovered content is **untrusted input**; evidence-first classification; never executed, never auto-installed, never auto-cloned |
| Repo with malicious install/execution paths | Security gate BEFORE acquisition; BLOCKED stops the pipeline; sandbox requirement enforced                                        |
| Secrets leaking to UI/logs/AI prompts       | Tokens/codes/keys never cross the gateway — only sanitized views; server-side credential store; redaction                         |
| Cross-user access (IDOR)                    | Every store keyed `(userId, id)`; auth middleware enforces `input.userId === session user`                                        |
| Abuse of discovery/GitHub operations        | Rate limits (standard/heavy tiers) on every procedure                                                                             |
| AI granting itself permissions              | AI may recommend; **policy engine decides; user approves** sensitive actions                                                      |
| Silent write access / silent installs       | Separate write consent flag; approval required before acquire/clone/execute/install/configure/use                                 |
| Fabricated evidence / popularity-as-proof   | Evidence attached to every classification; stars/social signals never establish truth alone                                       |

---

## 2. Secrets policy

- **Never exposed** in the browser UI, logs, analytics, error messages or AI
  prompts: GitHub access tokens, provider API keys, refresh tokens, raw
  authorization codes, secrets.
- GitHub tokens/codes live only in the **server-side auth adapter**; the domain
  stores an opaque `tokenRef` and the permission view carries **no** credentials.
- The gateway `github.completeAuth` performs the token exchange server-side and
  returns only metadata (`accountLogin`, granted scopes).

---

## 3. GitHub authorization model

- **Separate from Google auth** — the Google identity token is never reused as a
  GitHub credential. A separate "Connect GitHub" flow (GitHub App architecture:
  fine-grained permissions, short-lived tokens) is the target; a deterministic
  adapter ships for hermetic environments.
- **Least privilege**: `public_metadata` is the baseline (public discovery needs
  NO repo access). `public_repos_read` / `private_repos_read` / `orgs_read`
  require explicit review; `repos_write` requires a **separate write-consent
  flag** and is never obtained silently.
- Granted scopes are always the **intersection** of requested and provider-granted
  — never broader than what the user reviewed.
- Users can see connection state, granted scopes, permissions, accessible repos,
  last verification time; and can **verify / revoke / disconnect**.

---

## 4. Repository acquisition gate

```
DISCOVERED REPO → SECURITY REVIEW → USER/FACTORY RELEVANCE → APPROVAL →
ACQUIRE → SANDBOX → ANALYZE → STORE INTELLIGENCE → OPTIONAL CONFIGURATION
```

- **READ / CLONE / EXECUTE / INSTALL / CONFIGURE / USE are different actions.**
  Reading a repository NEVER implies it is safe to execute.
- Security checks cover install/preinstall/postinstall scripts, shell/subprocess
  usage, arbitrary command execution, credential collection, env/filesystem/SSH
  key/browser-credential access, network calls, unknown/obfuscated binaries,
  suspicious dependencies, typosquatting, abandoned deps, unsigned binaries,
  suspicious release artifacts, Docker privileges, host mounts, secret exposure,
  outbound transfer, dynamic downloads, RCE paths.
- **No sandbox available → `SECURITY_REVIEW_REQUIRED` and never auto-executed.**
- Classification is evidence-backed:
  `TRUSTED / TRUSTED_WITH_REVIEW / SECURITY_REVIEW_REQUIRED / SUSPICIOUS / BLOCKED / UNKNOWN`.
- Honest language: _"No blocking indicators found in the checks performed."_
  — never _"This repository is completely safe."_

---

## 5. License model

- Software license and **model license evaluated separately**.
- `PERMISSIVE / RESTRICTIVE / COMMERCIAL_RESTRICTED / LICENSE_UNKNOWN`.
- `LICENSE_UNKNOWN` is first-class — a resource with an unestablished license is
  **never auto-approved** for a commercial VedMoulya factory.

---

## 6. Free-resource honesty

- `FREE_API / FREE_WITH_QUOTA / FREE_TRIAL / OPEN_WEIGHTS / OPEN_SOURCE / LOCAL /
SELF_HOSTABLE / PAID / UNKNOWN`.
- "Free within quota" remains different from unlimited free (daily/monthly/token/
  request/context limits, expiration, regional restrictions, rate limits).
- Stale evidence → `STALE`, never assumed still free.

---

## 7. AuthN/AuthZ + rate limits

- All `github.*` and `ecosystemIntelligence.*` procedures are authenticated.
- IDOR refused at two layers: the auth middleware (`input.userId` must match the
  session user) and the owner-scoped service stores.
- Rate limits: heavy tier for `beginConnect/completeAuth/revoke/disconnect`,
  `findBetterOption`, `getAcquisitionPlan`, `approveAcquisition`,
  `rejectAcquisition`; standard tier for the rest.

---

## 8. What the Intelligence layer will NEVER do

- Purchase subscriptions, spend money, install software, clone repositories,
  connect external accounts, or publish externally — silently or otherwise.
- Bypass authentication/authorization/approval, exceed budgets, fabricate
  evidence, expose credentials, or delete user data without authorization.
- Treat popularity, social media, or third-party directories as proof.

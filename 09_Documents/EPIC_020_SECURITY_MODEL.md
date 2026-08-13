# EPIC-020 — Security Model

**Security-first discovery, GitHub classification, approval gates & IDOR · 2026-08-12**

## 1. Threat model (what this epic must never allow)

| Threat                           | Control                                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| Silent subscription/purchase     | `BrainPolicyEngine` sensitive actions + explicit approval; no auto-activation anywhere   |
| Silent GitHub/account connection | EPIC-015 least-privilege GitHub flow reused; Brain consumes only screened events         |
| Silent private-repo access       | EPIC-015 explicit grants only; never implied                                             |
| Untrusted repository execution   | Acquisition pipeline EPIC-015 (READ ≠ CLONE ≠ EXECUTE); Brain discovery is evaluate-only |
| Fabricated provider usage/cost   | KNOWN/UNKNOWN/ESTIMATED evidence model — nothing invented                                |
| IDOR on the new surface          | Every `brain.*` EPIC-020 procedure owner-scoped + `assertUserIdMatchesSession`           |
| Budget bypass                    | `BrainBudgetGuard` fail-closed; failover bounded; no infinite retries                    |
| Hidden chain-of-thought memory   | Memory stores decisions/provenance/reasons only                                          |

## 2. Security-first GitHub / AI World classification (mission §9)

Every intelligence event carries a `SecurityClassification` (reused vocabulary, never "safe" merely because nothing was found):

`TRUSTED` · `TRUSTED_WITH_REVIEW` · `SECURITY_REVIEW_REQUIRED` · `SUSPICIOUS` · `BLOCKED` · `UNKNOWN`

The gateway bridge (`createBrainDiscoveryBridgePort`) classifies from the frozen AI World item facts:

- security flags containing `block`/`critical` → `BLOCKED`
- `suspicious` → `SUSPICIOUS`
- any security flags → `SECURITY_REVIEW_REQUIRED`
- GitHub items: suspicious flags → `SUSPICIOUS`; missing/UNKNOWN license → `UNKNOWN`; `unclear_license`/`security_concerns` → `SECURITY_REVIEW_REQUIRED`; else `TRUSTED_WITH_REVIEW`
- scanned-with-no-blocking-indicators → `TRUSTED_WITH_REVIEW` (reviewed, never a blanket "safe")

## 3. Discovery ≠ adoption (mission §8)

```
DISCOVER → SECURITY SCREEN → EVIDENCE → RELEVANCE → COMPARE → RECOMMEND →
USER APPROVAL → CONFIGURE → VALIDATE → OPTIONAL ADOPTION
```

- No automatic installation, subscription, or unsafe repository execution.
- `OpportunityIntelligence.detectFromEvents` **never** turns `BLOCKED`/`SUSPICIOUS` items (nor `SECURITY_CONCERN`/`MODEL_DEPRECATION` events) into opportunities.
- Events are still surfaced to the user WITH their security classification (transparency, not censorship).
- `adoptionRequired` actions stay explicit; nothing is auto-configured.

Verified: benchmark scenario 8 (trusted GitHub discovery → opportunity with uncertainty) and scenario 9 (SUSPICIOUS repo → surfaced event, **zero** opportunities).

## 4. Approval gates (mission §7/§14)

- Sensitive actions pause at `AWAITING_APPROVAL`: subscription, purchase, GitHub authorization, private-repo access, installing software, cloning/acquiring repositories, connecting external accounts, sending messages, publishing, deploying, deleting, sharing, irreversible actions.
- Low-risk information retrieval does not interrupt the user.
- Policy: AI recommends → Policy decides → User approves → Execution performs bounded approved actions → Verification confirms → Memory records.

## 5. IDOR & authorization (verified in tests)

Every new procedure is exercised through the REAL tRPC pipeline with a foreign userId:

- `discoverIntelligence`, `listOpportunities`, `listIntelligenceEvents`, `providerScores`, `dashboard` → all `FORBIDDEN` for a foreign user (gateway test `IDOR: foreign userId is refused on every EPIC-020 procedure`).
- Unauthenticated calls → `UNAUTHORIZED`.

## 6. Secret handling

- Dashboard/UI never renders tokens, keys, or quota credentials.
- Memory content is structured decisions/reasons (no prompt dumps, no chain-of-thought).
- The usage port consumes only the frozen `ProviderExperienceService` view model — never credentials.

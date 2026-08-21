# SPRINT-038 — EVIDENCE MODEL

**Evidence / provenance over the existing evidence philosophy**

## The evidence record

```
ProblemEvidence {
  id          // stable, derived (owner+source+time+index)
  ownerId     // owner scope — never cross-owner
  source      // customer_interview | customer_provided_data | direct_observation |
              // public_company_info | public_reviews | job_posting | marketplace_demand |
              // public_pricing | industry_report | startup_database | government_data |
              // vedmoulya_observation | experiment_result | verified_payment | OTHER
  observedAt  // when the observation was made
  reference   // optional URL/record reference (bounded)
  text        // SANITIZED — markup/scripts/control chars stripped, ≤500 chars
  confidence  // VERIFIED | ESTIMATED | UNKNOWN — derived, never fabricated
  evidenceOnly: true  // structural: this record is EVIDENCE, never authority
}
```

## The evidence discipline

1. **Evidence is REQUIRED** — `registerProblem` refuses a problem with no
   evidence (`EVIDENCE_REQUIRED`). A factual claim without evidence is refused.
2. **Sanitization** — `sanitizeEvidenceText` strips `<...>` markup/scripts,
   control characters and collapses whitespace. Sanitization is NOT a security
   boundary by itself (the presentation layer escapes), but it removes the
   obvious injection vectors.
3. **External content is untrusted** — evidence may become EVIDENCE, never
   AUTHORIZATION. There is no approval surface on evidence or problems.
4. **Confidence is derived** — `deriveConfidence` looks at the evidence set:
   VERIFIED wins, then ESTIMATED, else UNKNOWN. Never fabricated.
5. **Bounded** — 20 evidence records per problem (FIFO); sanitized + length
   capped; owner-scoped.
6. **Verified payment** is a special evidence source (`verified_payment`,
   confidence VERIFIED) — the ONLY path that advances the revenue ladder.

## Security tests

- Malformed/malicious source data is sanitized or rejected (`OpportunityDiscoveryDomain.test.ts`
  exercises markup stripping, control-char stripping, empty-text refusal).
- Owner isolation: a foreign owner cannot read or append evidence (IDOR).
- Structural: external evidence can never grant authority (problems carry no
  approval/execute fields).

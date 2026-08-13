# Quality Engine

> The gatekeeper — scoring, validating, and approving every output before it ships.
> Owner: Chief Enterprise Intelligence Architect · Updated: 2026-08-03 (EI-000)

## Purpose

Define the Quality Engine: the component that scores outputs, validates facts and business fit, detects hallucinations, enforces brand/grammar/SEO standards, runs approval workflows, and triggers bounded automatic retries. No output reaches delivery without passing its quality gate.

## Responsibilities

- Score output quality (rubric-weighted Quality Score)
- Compute confidence (Confidence Score)
- Validate: brand, grammar, SEO, hallucination, factuality, business, output format
- Run approval workflows (human/client gates)
- Manage automatic retry/regeneration (bounded by execution budget)
- Emit the Quality Specification (verdict)

## Inputs

- Output artifact + task requirements (from Execution/Work Allocation)
- Brand guidelines, client profile, business rules
- Rubric weights + thresholds (registry, versioned)
- Facts/sources for verification (knowledge/document retrieval)
- Execution budget (remaining retries/regenerations)

## Outputs

- **Quality Specification / Verdict:** per-dimension scores, overall QualityScore, Confidence, decision (pass/flag/reject/regenerate — aligned with existing `ValidationResult.decision`), evidence, regeneration count
- Approval events (human/client approval required or granted)

## Algorithms

### Quality scoring

`QualityScore(o)` per Mathematics §6 — weighted rubric: brand, grammar, SEO (when applicable), factuality, business, format, requirements. Rubric weights by content type (article, proposal, code, contract) from registry.

### Confidence scoring

`Confidence(o)` per Mathematics §7 — quality, validation passes, provider history, context confidence, agreement (multi-sample/self-consistency).

### Brand validation

- Against client brand profile (voice, tone, terminology, do/don't lists)
- Brand deviation detection (classifier/embedding similarity to brand exemplars)
- Hard rules (product names, spelling) + soft rules (tone) — soft flags need human review

### Grammar

- Language correctness checks (rule-based + model-assisted)
- Threshold: grammar violations below floor → auto-fix pass (bounded) or regenerate

### SEO

- When applicable: keyword coverage, structure (headings), metadata (title/description), readability
- SEO rubric weights configured per content type; may be skipped (not applicable)

### Hallucination detection

- Claim extraction → fact verification against provided sources/knowledge
- Unsupported claims flagged with severity (aligned with existing `HallucinationCheckResult`: low/medium/high/certain)
- Certain/unsupported critical claims → reject or require human approval

### Fact verification

- Facts verified against knowledge graph/documents/client-provided data
- Unverifiable facts flagged; numeric/statistical claims require source citation
- Verification confidence per claim (attribution)

### Business validation

- Output matches business rules: client scope, pricing/contract consistency, brand deliverables
- Cross-checks: proposal numbers vs. quotations, invoice amounts vs. payments
- Violations block delivery

### Output validation

- Schema/format compliance (per capability output contract)
- Required sections present, length/limits respected, metadata complete
- Non-compliant → regenerate (bounded) or human fix

### Approval workflow

- **Auto-approve:** all dimensions pass, confidence high, no human-gate required
- **Human review:** soft flags, brand tone, first-of-kind, high business value
- **Client approval:** portal approval for client-facing deliverables (existing client portal flow)
- Approval recorded with actor, timestamp, decision (audit + learning)

### Automatic retry

- Decision `regenerate` → re-run within remaining execution budget (max regeneration passes)
- Regeneration may: switch provider (if quality below threshold tied to provider), adjust prompt (feedback from rubric failures), or prune context
- After budget exhausted → escalate to human/Brain; record learning signal

## Scoring

| Score                | Source         | Used for              |
| -------------------- | -------------- | --------------------- |
| QualityScore         | Mathematics §6 | Gate decision         |
| Confidence           | Mathematics §7 | Approval routing      |
| Per-dimension scores | this doc       | Targeted regeneration |

## Decision Flow

1. Receive output artifact → run dimension checks (parallelizable)
2. Compute QualityScore + Confidence → decision
3. pass → approval workflow → deliver
4. flag → human/client review
5. regenerate → bounded retry (provider/prompt/context adjustment) → re-score
6. reject → escalate; record learning

## Failure Handling

- **Validator failure** (scorer down): conservative pass-with-flag (never silently approve); alert
- **Regeneration budget exhausted:** escalate, mark task blocked
- **Brand guidelines missing:** degrade brand score to neutral, require human review
- **Verification sources unavailable:** flag claims unverifiable, require human sign-off

## Learning

- Rubric weight calibration (which dimensions predict client satisfaction/delivery success)
- Threshold calibration (accept/regenerate boundaries tuned from outcomes)
- Regeneration effectiveness (did the retry improve the score?)
- Provider-quality correlation (which provider passes gates most efficiently)

## Future Expansion

- Client-specific rubrics (brand weights per client)
- LLM-as-judge ensemble with agreement scoring
- Quality regression suites in CI (Promptfoo, Planned)

## References

- [EI000_ENTERPRISE_INTELLIGENCE_SPECIFICATION.md](./EI000_ENTERPRISE_INTELLIGENCE_SPECIFICATION.md)
- [INTELLIGENCE_MATHEMATICS.md](./INTELLIGENCE_MATHEMATICS.md)
- [WORK_ALLOCATION_ENGINE.md](./WORK_ALLOCATION_ENGINE.md)
- [LEARNING_ENGINE_SPEC.md](./LEARNING_ENGINE_SPEC.md)
- `packages/ai/src/types/index.ts` (ValidationResult, HallucinationCheckResult, SafetyCheckResult)

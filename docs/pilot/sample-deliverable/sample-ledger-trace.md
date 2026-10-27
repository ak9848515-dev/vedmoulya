<!--
  SAMPLE OUTPUT — NOT A CLIENT DELIVERABLE.
  Produced by scripts/pilot-sample-deliverable.ts through the VedMoulya
  application services. Fictional company. No client, payment or
  testimonial is implied.
-->

# SAMPLE — ledger trace produced by the application services

| Step             | Identifier                | Value                           |
| ---------------- | ------------------------- | ------------------------------- |
| Client           | `cli_980433fb-e4e`        | Fictional Co (sample)           |
| Brand            | `brd_230d7854-c78`        | Fictional Co                    |
| Project          | `prj_81c1494f-305`        | Sample pilot engagement         |
| Lead             | `lead_30f8c679-288`       | won → client `cli_3e2f641f-7e8` |
| Authored article | `ctn_9fe6aaa5-65c`        | approved                        |
| Invoice          | `inv_3e6ef676-c14`        | $500.00 (paid)                  |
| Payment          | `pay_5598a511-441`        | $500.00 — verified              |
| Idempotency key  | `SAMPLE-RUN-PAYMENT-0001` | replay returned the same row    |

## Revenue before vs after verification

- recorded: $500.00 → paid (verified): $0.00 → unverified: $500.00
- after review: paid (verified) $500.00 · unverified $0.00

**This payment is a synthetic sample.** The evidence reference begins with
`SAMPLE-RUN-` and proves nothing about money. It demonstrates the ledger and
the recorded→verified gate; it is not revenue.

## AI-drafted service summary

Status: SKIPPED

## Run log

```text
VEDMOULYA PILOT SAMPLE RUN
started      : 2026-10-26T13:43:08.463Z
owner        : pilot-sample-owner
persistence  : in-memory repositories (no database contacted)
ai mode      : SKIPPED (--no-ai)
createClient     → cli_980433fb-e4e (Fictional Co (sample))
upsertBrand      → brd_230d7854-c78 (2 do / 2 don't rules)
createProject    → prj_81c1494f-305 (Sample pilot engagement)
createDraft      → ctn_9fe6aaa5-65c (generatedBy: human, 1017 chars)
addReview        → status=approved, stage=approval
exportContent    → what-empty-miles-actually-cost-a-regional-fleet.md (markdown, supported=true), what-empty-miles-actually-cost-a-regional-fleet.html (html, supported=true)
exportContent    → pdf probed: filename=what-empty-miles-actually-cost-a-regional-fleet.pdf supported=false (Markdown bytes, NOT written)
generateContent  → skipped (--no-ai); NO model-generated sample in this run.
createLead       → lead_30f8c679-288 (status=qualified)
addInteraction   → logged · addTask → completed
moveLead(won)    → clientId=cli_3e2f641f-7e8 (auto-provisions the AC-001 client)
createInvoice    → inv_3e6ef676-c14 $500.00 status=sent
addPayment       → pay_5598a511-441 $500.00 status=recorded key=SAMPLE-RUN-PAYMENT-0001
addPayment again → same payment returned (duplicate=true), rows=1
revenue before   → paid=$0.00 recorded=$500.00 unverified=$500.00
reviewPayment    → status=verified verifiedAt=2026-10-26T13:43:08.517Z
revenue after    → paid=$500.00 recorded=$500.00 unverified=$0.00
invoice now      → paid (settles only when verified total covers the amount)
```

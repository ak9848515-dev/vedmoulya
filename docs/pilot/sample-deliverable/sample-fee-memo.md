<!--
  SAMPLE OUTPUT — NOT A CLIENT DELIVERABLE.
  Produced by scripts/pilot-sample-deliverable.ts through the VedMoulya
  application services. Fictional company. No client, payment or
  testimonial is implied.
-->

# SAMPLE — AI fee memo (model body unavailable in this run)

> Provider/model: unreachable in the run that wrote this file
> Run mode: `--no-ai` (no provider configured; no model was called)
> HUMAN REVIEW REQUIRED before this text is sent to anyone.

## Why this file is empty of model text

An earlier run of `scripts/pilot-sample-deliverable.ts --local` did call the
local Ollama model (`qwen2.5-coder:7b-instruct`, 1,210 tokens, 155 s) and wrote
its output here — but the script interpolated the export DTO instead of the
export payload, so the previous file contained the literal string
`[object Object]` and was **not** a usable sample. That bug is fixed
(`exported.data.data`), and an empty model body is now reported as
`FAILED (provider returned empty content)` rather than packaged as a memo.

This file was regenerated with `--no-ai`, which by design produces **no**
model-generated sample. It states that plainly instead of shipping a blank or
placeholder memo pretending to be model output.

## What is still true without a model call

- Fee memo drafting is a **real, wired capability** of
  `ContentAgencyApplicationService.generateContent` — it is exercised by the
  application test suite, not invented here.
- It is **not** demonstrated in this package, because a live provider was not
  available offline. Do not show a prospect "AI writes your memo" on the basis
  of this file.
- The pilot does not depend on AI output. The billable article in
  [`sample-authored-article.md`](./sample-authored-article.md) is
  human-authored and only captured/reviewed/exported by the application.

To regenerate a real memo later, run:

```powershell
npx tsx scripts/pilot-sample-deliverable.ts --local
```

and re-check that the body below the metadata is prose, not a single token.

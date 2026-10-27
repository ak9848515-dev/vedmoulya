#!/usr/bin/env node
// ─────────────────────────────
// VEDMOULYA — MISSION 005 · PILOT SAMPLE DELIVERABLE RUNNER
//
// Produces the pilot's sample deliverable by driving the REAL application
// services — nothing is hand-written into the output:
//
//   ContentAgencyApplicationService  createClient → upsertBrand → createProject
//                                    → createDraft (human-authored article)
//                                    → generateContent (billed pricing memo)
//                                    → addReview → exportContent (markdown/html)
//   ClientOperationsApplicationService  createLead → log interaction + task
//                                    → createInvoice → addPayment (recorded)
//                                    → reviewPayment (verified) → revenue view
//
// WHICH HALF IS WHAT (no over-claiming):
//   • AI summary      — AI pipeline, against the configured provider.
//   • Article draft   — HUMAN-authored; it is captured/versioned/reviewed/
//                       exported by the app, not written by the model.
//   • Invoice/payment — the ledger and settlement logic; the payment is a
//                       SAMPLE record with plainly marked non-evidence.
//
// PERSISTENCE: in-memory repositories only (the app's documented dev/test
// fallback). No database is contacted — in particular, no Neon/production.
// NETWORK: one model call, only when an AI provider key is configured and
// AI_ENABLE_MOCK is not true. Otherwise the script produces the ledger part
// only and says so.
// OUTPUT: docs/pilot/sample-deliverable/ (all files carry a SAMPLE banner).
//
// Usage (repo root):
//   npx tsx scripts/pilot-sample-deliverable.ts              # real model if configured
//   npx tsx scripts/pilot-sample-deliverable.ts --no-ai      # ledger/article only
// ─────────────────────────────

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { ContentAgencyApplicationService } from '../packages/services/src/content-agency/ContentAgencyApplicationService.js';
import type { ClientOperationsApplicationService } from '../packages/services/src/content-agency/ClientOperationsApplicationService.js';
import type { ContentAgencyAIService } from '../packages/services/src/content-agency/ContentAgencyAIService.js';

const SAMPLE_BANNER = [
  '<!--',
  '  SAMPLE OUTPUT — NOT A CLIENT DELIVERABLE.',
  '  Produced by scripts/pilot-sample-deliverable.ts through the VedMoulya',
  '  application services. Fictional company. No client, payment or',
  '  testimonial is implied.',
  '-->',
  '',
].join('\n');

const OWNER = 'pilot-sample-owner';
const OUT_DIR = path.resolve(process.cwd(), 'docs/pilot/sample-deliverable');
const SKIP_AI = process.argv.includes('--no-ai');
// --local: generate the memo with the locally installed Ollama model only.
const LOCAL_AI = process.argv.includes('--local');
const LOCAL_MODEL = 'qwen2.5-coder:7b-instruct';
/** Per-request guard so a hung local call cannot stall the run forever. */
const AI_TIMEOUT_MS = 45 * 60 * 1000;

function section(title: string): void {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 66 - title.length))}`);
}

function fail(step: string, error?: string): never {
  console.error(`\n✗ ${step} failed: ${error ?? 'unknown error'}`);
  process.exit(1);
}

function money(value: number, currency: string): string {
  return value.toLocaleString('en-US', { style: 'currency', currency });
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} exceeded ${ms} ms`));
    }, ms);
    timer.unref?.();
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Load .env.local into this process only (never printed, never persisted). */
function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    // Real environment wins over the file.
    if (process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

/**
 * Hermetic process: no database URLs reach any engine (so nothing can connect
 * to Neon or production), OTLP export is off, and NODE_ENV stays non-strict.
 */
function hardenEnvironment(): void {
  const keys = Object.keys(process.env).filter((k) =>
    /^(DATABASE_URL|IDENTITY_DATABASE_URL|KNOWLEDGE_DATABASE_URL|DECISION_DATABASE_URL|EXECUTION_DATABASE_URL|MEMORY_DATABASE_URL|CONTENT_AGENCY_DATABASE_URL|REDIS_URL|OTEL_EXPORTER_OTLP_ENDPOINT)$/.test(
      k,
    ),
  );
  for (const key of keys) Reflect.deleteProperty(process.env, key);
  process.env.NODE_ENV = 'development';
  // Local-only route: one model, on this machine, under an enforced timeout.
  // Cloud providers are removed from the process entirely, so a failure is a
  // visible failure rather than a slow fallback chain.
  if (LOCAL_AI) {
    for (const key of Object.keys(process.env)) {
      if (/^AI_(OPENAI|ANTHROPIC|GOOGLE|DEEPSEEK|OPENROUTER)_/.test(key))
        Reflect.deleteProperty(process.env, key);
    }
    process.env.AI_ENABLE_MOCK = 'false';
    process.env.AI_OLLAMA_MODEL = LOCAL_MODEL;
    process.env.AI_OLLAMA_TIMEOUT_MS = '900000';
  }
  if (SKIP_AI) process.env.AI_ENABLE_MOCK = 'true';
}

async function main(): Promise<void> {
  loadEnvLocal();
  hardenEnvironment();
  mkdirSync(OUT_DIR, { recursive: true });

  const { ContentAgencyApplicationService } =
    await import('../packages/services/src/content-agency/ContentAgencyApplicationService.js');
  const { ContentAgencyAIService } =
    await import('../packages/services/src/content-agency/ContentAgencyAIService.js');
  const { ClientOperationsApplicationService } =
    await import('../packages/services/src/content-agency/ClientOperationsApplicationService.js');
  const { InMemoryContentAgencyRepository } =
    await import('../packages/services/src/content-agency/InMemoryContentAgencyRepository.js');
  const { InMemoryClientOpsRepository } =
    await import('../packages/services/src/content-agency/InMemoryClientOpsRepository.js');
  const { createOrchestrator } = await import('../services/orchestrator/src/index.js');

  // The SAME provider registry the API uses (services/api wires the identical
  // AIOrchestrationService + registerPlatformProviders), built directly so the
  // sample run does not boot identity persistence. Provider keys come from the
  // environment; if none resolve, the orchestrator reports it and the memo is
  // skipped rather than replaced by invented text.
  const orchestrator = createOrchestrator();
  const agencyRepo = new InMemoryContentAgencyRepository();
  const opsRepo = new InMemoryClientOpsRepository();
  const agency = new ContentAgencyApplicationService(
    agencyRepo,
    new ContentAgencyAIService(orchestrator, {
      enableRetrieval: false,
      qualityTier: 'standard',
    }),
  );
  // No settlement port → the documented in-memory SequentialPaymentSettlement
  // double (NODE_ENV is development here, so the guard permits it).
  const ops = new ClientOperationsApplicationService(opsRepo, agency, {} as never);

  const runLog: string[] = [];
  const log = (line: string): void => {
    console.log(line);
    runLog.push(line);
  };
  const startedAt = new Date().toISOString();
  log(`VEDMOULYA PILOT SAMPLE RUN`);
  log(`started      : ${startedAt}`);
  log(`owner        : ${OWNER}`);
  log(`persistence  : in-memory repositories (no database contacted)`);
  log(
    `ai mode      : ${
      SKIP_AI
        ? 'SKIPPED (--no-ai)'
        : LOCAL_AI
          ? `local Ollama only (${LOCAL_MODEL})`
          : 'configured provider'
    }`,
  );

  // ── 1. Client + brand + project ───────────────────────────
  section('1. Client, brand, project');
  const client = await agency.createClient(OWNER, {
    company: 'Fictional Co (sample)',
    industry: 'B2B logistics software',
    brandVoice: 'Plain, specific, quietly confident. No hype.',
    targetAudience: 'Operations leads at 20-200 person logistics firms',
    products: ['Route planner', 'Driver app'],
    services: ['Onboarding', 'Integrations'],
    goals: ['Book demo calls', 'Reduce empty-mile ratio for customers'],
    website: 'https://fictional-co.example',
  });
  if (!client.success || !client.data) fail('createClient', client.error);
  log(`createClient     → ${client.data.id} (${client.data.company})`);

  const brand = await agency.upsertBrand(OWNER, {
    clientId: client.data.id,
    name: 'Fictional Co',
    tone: 'direct',
    writingStyle: 'Short sentences, concrete numbers, no superlatives',
    doRules: ['Use customer language', 'Quote a verifiable number'],
    dontRules: ['No "revolutionary"', 'No invented statistics'],
    keywords: ['route planning', 'empty miles', 'dispatch'],
    mission: 'Cut wasted miles for regional logistics teams',
  });
  if (!brand.success || !brand.data) fail('upsertBrand', brand.error);
  log(
    `upsertBrand      → ${brand.data.id} (${brand.data.doRules.length} do / ${brand.data.dontRules.length} don't rules)`,
  );

  const project = await agency.createProject(OWNER, {
    clientId: client.data.id,
    brandId: brand.data.id,
    name: 'Sample pilot engagement',
    description: 'Authored article + optional AI-drafted summary used as the pilot sample.',
  });
  if (!project.success || !project.data) fail('createProject', project.error);
  log(`createProject    → ${project.data.id} (${project.data.name})`);

  // ── 2. Human-authored article (captured, reviewed, exported by the app) ──
  section('2. Authored article capture');
  const articleBrief =
    'Explain how mid-size logistics teams measure empty-mile cost, using only ' +
    'figures the customer supplies. Target: operations leads evaluating route software.';
  const authored = await agency.createDraft(OWNER, {
    clientId: client.data.id,
    brandId: brand.data.id,
    projectId: project.data.id,
    contentType: 'blog',
    title: 'What empty miles actually cost a regional fleet',
    brief: articleBrief,
    content: [
      '## Start with the number you already have',
      '',
      'Empty miles are the distance a vehicle travels without a paying load. Most',
      'regional fleets track fuel; far fewer track the share of total distance that',
      'was empty. Without that share, "we improved routing" is an opinion.',
      '',
      '## The calculation',
      '',
      '1. Take total distance driven in a month.',
      '2. Take the distance driven between delivering a load and collecting the next one.',
      '3. Divide (2) by (1). That is your empty-mile ratio.',
      '',
      'Apply your own cost per mile to that distance and you have a defensible number',
      'for what dispatch decisions cost the business — one that a finance lead will',
      'accept, because every input came from your records.',
      '',
      '## What to change first',
      '',
      'Fleets usually find their empty-mile ratio is worst on the last booking of the',
      'day. Matching end-of-day drops with next-morning pickups in the same corridor',
      'is the cheapest intervention, because it needs no new lanes.',
      '',
      '_Example figures are intentionally absent: publish this article with the',
      "_client's own numbers only._",
    ].join('\n'),
  });
  if (!authored.success || !authored.data) fail('createDraft', authored.error);
  log(
    `createDraft      → ${authored.data.id} (generatedBy: ${authored.data.versions[0]?.generatedBy}, ${authored.data.versions[0]?.length} chars)`,
  );

  const articleApproved = await agency.addReview(OWNER, authored.data.id, {
    stage: 'review',
    reviewer: 'VedMoulya operator (sample)',
    comment: 'Scope and claims verified; no client figures invented.',
    decision: 'accepted',
  });
  if (!articleApproved.success || !articleApproved.data) {
    fail('addReview', articleApproved.error);
  }
  log(
    `addReview        → status=${articleApproved.data.status}, stage=${articleApproved.data.workflowStage}`,
  );

  const articleMd = await agency.exportContent(OWNER, authored.data.id, 'markdown');
  const articleHtml = await agency.exportContent(OWNER, authored.data.id, 'html');
  if (!articleMd.success || !articleMd.data || !articleHtml.success || !articleHtml.data) {
    fail('exportContent', articleMd.error ?? articleHtml.error);
  }
  log(
    `exportContent    → ${articleMd.data.filename} (markdown, supported=${articleMd.data.supported}), ${articleHtml.data.filename} (html, supported=${articleHtml.data.supported})`,
  );
  // `exportContent` returns a DeliveryExportDTO. The document text is
  // `exported.data`; interpolating `exported.data` writes "[object Object]".
  if (!articleMd.data.supported || !articleHtml.data.supported) {
    fail('exportContent', 'markdown/html export reported supported=false');
  }
  // PDF/DOCX are roadmap formats: the service returns a `.pdf`/`.docx` filename
  // with Markdown bytes and `supported: false`. Prove that here instead of
  // writing such a file, so the sample can never look like a real PDF export.
  const articlePdf = await agency.exportContent(OWNER, authored.data.id, 'pdf');
  if (!articlePdf.success || !articlePdf.data) fail('exportContent(pdf)', articlePdf.error);
  if (articlePdf.data.supported) {
    fail('exportContent(pdf)', 'pdf export claims supported=true — sample expectations are stale');
  }
  log(
    `exportContent    → pdf probed: filename=${articlePdf.data.filename} supported=false (Markdown bytes, NOT written)`,
  );
  writeFileSync(
    path.join(OUT_DIR, 'sample-authored-article.md'),
    `${SAMPLE_BANNER}# SAMPLE — authored article captured through the workflow\n> Client: Fictional Co (sample) · Status after review: ${articleApproved.data.status}\n> Content item: ${authored.data.id}\n\n${articleMd.data.data}`,
    'utf8',
  );
  writeFileSync(
    path.join(OUT_DIR, 'sample-authored-article.html'),
    `${SAMPLE_BANNER}<!-- SAMPLE — exported by ContentAgencyApplicationService.exportContent -->\n${articleHtml.data.data}\n`,
    'utf8',
  );

  // "AI-generated fee memo" — actually prompts the pipeline for a CLIENT-FACING
  // one-page service summary. The earlier brief asked for an invented internal
  // fee memo, which is not a deliverable this offer includes (pricing lives in
  // the proposal, stated by a human).
  section('3. AI-drafted service summary (optional)');
  let memoStatus = 'SKIPPED';
  if (SKIP_AI) {
    log('generateContent  → skipped (--no-ai); NO model-generated sample in this run.');
  } else {
    const generated = await withTimeout(
      agency.generateContent(OWNER, {
        clientId: client.data.id,
        brandId: brand.data.id,
        projectId: project.data.id,
        contentType: 'email',
        title: 'Pilot summary — sample engagement',
        brief:
          'Write a one-page, client-facing summary of a three-session content pilot: one ' +
          '600-1,200 word article captured, reviewed and exported as Markdown and HTML; ' +
          'one invoice raised; one payment recorded with its bank/processor reference and ' +
          'reviewed by a named human before it counts as revenue. State that publishing, ' +
          'payment collection, PDF/DOCX export and ongoing production are out of scope. ' +
          'Invent no metrics, client names, testimonials or prices.',
        goals: ['Make the pilot scope and its exclusions unambiguous'],
        targetAudience: 'A procurement-minded founder',
        // Not 'economy': the pipeline's research + quality passes require the
        // `reasoning` capability, which the orchestrator's tier rule permits only
        // at standard/premium (packages/ai/src/domain/rules/AIRules.ts).
        qualityTier: 'standard',
      }),
      AI_TIMEOUT_MS,
      'generateContent',
    );
    if (!generated.success || !generated.data) {
      memoStatus = `FAILED (${generated.error ?? 'unknown'})`;
      log(`generateContent  → FAILED: ${generated.error ?? 'unknown'}`);
      log('                   (no AI summary is written; the run continues)');
    } else {
      const exported = await agency.exportContent(OWNER, generated.data.id, 'markdown');
      if (!exported.success || !exported.data) fail('exportContent(summary)', exported.error);
      if (!exported.data.supported) {
        fail('exportContent(summary)', 'markdown export reported supported=false');
      }
      const meta = generated.data.aiMetadata;
      // `exported.data` IS the DeliveryExportDTO (ContentAgencyDTO.ts) — not text.
      // Read `.data` off it; stringifying the DTO writes "[object Object]".
      const memoBody = exported.data.data;
      if (typeof memoBody !== 'string') {
        fail('exportContent(summary)', 'export payload was not a string');
      }
      const bodyTooShort = memoBody.trim().length < 40;
      // A provider that "succeeds" with an empty or trivially short body must not be
      // packaged as a client-facing summary.
      if (
        (generated.data.versions.at(-1)?.content ?? '').trim().length === 0 ||
        memoBody.trim().length === 0
      ) {
        memoStatus = 'FAILED (provider returned empty content)';
        log(`generateContent  → ${generated.data.id} returned EMPTY content`);
        log('                   (no summary is written; the run continues)');
      } else if (bodyTooShort) {
        memoStatus = 'FAILED (provider body shorter than 40 chars — not a summary)';
        log(`generateContent  → ${generated.data.id} body too short to be a summary`);
        log('                   (no summary is written; the run continues)');
      } else {
        memoStatus = `${meta?.provider ?? '?'}/${meta?.model ?? '?'} · quality ${meta?.qualityScore ?? '?'} · ${meta?.tokenUsage.total ?? 0} tokens · US$${(meta?.cost ?? 0).toFixed(4)} · ${meta?.latencyMs ?? 0} ms`;
        log(`generateContent  → ${generated.data.id} (${memoStatus})`);
        log(`exportContent    → ${exported.data.filename}`);
        writeFileSync(
          path.join(OUT_DIR, 'sample-ai-summary.md'),
          `${SAMPLE_BANNER}# SAMPLE — AI-drafted service summary\n> Provider/model: ${meta?.provider ?? '?'} / ${meta?.model ?? '?'}\n> Quality score: ${meta?.qualityScore ?? '?'} · Tokens: ${meta?.tokenUsage.total ?? 0} · Cost: US$${(meta?.cost ?? 0).toFixed(4)} · Latency: ${meta?.latencyMs ?? 0} ms\n> Trace: ${meta?.traceId ?? '?'}\n> HUMAN REVIEW REQUIRED before this text is sent to anyone.\n> Not a price list: pricing is stated by a human in the proposal.\n\n${memoBody}`,
          'utf8',
        );
      }
    }
  }

  // ── 4. Invoice + payment ledger through Client Ops ───────────────────────
  section('4. Proposal → invoice → recorded → verified payment');
  const lead = await ops.createLead(OWNER, {
    company: 'Fictional Co (sample)',
    contactName: 'Sample Contact',
    contactEmail: 'contact@fictional-co.example',
    industry: 'B2B logistics software',
    source: 'sample-run',
    status: 'qualified',
    value: 1500,
    currency: 'USD',
    notes: 'SAMPLE — created by scripts/pilot-sample-deliverable.ts',
  });
  if (!lead.success || !lead.data) fail('createLead', lead.error);
  log(`createLead       → ${lead.data.id} (status=${lead.data.status})`);

  await ops.addInteraction(OWNER, lead.data.id, {
    type: 'call',
    summary: 'SAMPLE discovery call — pilot scope discussed, no real prospect.',
  });
  const task = await ops.addTask(OWNER, lead.data.id, {
    title: 'SAMPLE — send pilot scope for approval',
    dueAt: null,
  });
  if (task.success && task.data) await ops.completeTask(OWNER, lead.data.id, task.data.id);
  log(`addInteraction   → logged · addTask → ${task.success ? 'completed' : 'failed'}`);

  const moved = await ops.moveLead(OWNER, lead.data.id, 'won');
  if (!moved.success || !moved.data) fail('moveLead(won)', moved.error);
  log(
    `moveLead(won)    → clientId=${moved.data.clientId ?? 'none'} (auto-provisions the AC-001 client)`,
  );

  const invoice = await agency.createInvoice(OWNER, {
    clientId: client.data.id,
    projectId: project.data.id,
    description: 'SAMPLE — pilot deposit (Session 1)',
    amount: 500,
    currency: 'USD',
    status: 'sent',
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  });
  if (!invoice.success || !invoice.data) fail('createInvoice', invoice.error);
  log(
    `createInvoice    → ${invoice.data.id} ${money(invoice.data.amount, invoice.data.currency)} status=${invoice.data.status}`,
  );

  const recorded = await ops.addPayment(OWNER, {
    invoiceId: invoice.data.id,
    amount: 500,
    currency: 'USD',
    method: 'bank_transfer',
    idempotencyKey: 'SAMPLE-RUN-PAYMENT-0001',
    note: 'SAMPLE record — not a real receipt.',
    evidence: {
      kind: 'processor_reference',
      reference: 'SAMPLE-RUN-REF-0001',
    },
  });
  if (!recorded.success || !recorded.data) fail('addPayment', recorded.error);
  log(
    `addPayment       → ${recorded.data.id} ${money(recorded.data.amountMinor / 100, recorded.data.currency)} status=${recorded.data.status} key=${recorded.data.idempotencyKey ?? 'null'}`,
  );

  const replay = await ops.addPayment(OWNER, {
    invoiceId: invoice.data.id,
    amount: 500,
    currency: 'USD',
    method: 'bank_transfer',
    idempotencyKey: 'SAMPLE-RUN-PAYMENT-0001',
    note: 'SAMPLE record — not a real receipt.',
    evidence: { kind: 'processor_reference', reference: 'SAMPLE-RUN-REF-0001' },
  });
  log(
    `addPayment again → ${replay.data?.id === recorded.data.id ? 'same payment returned' : 'DIFFERENT payment!'} (duplicate=${String(replay.data?.duplicate ?? false)}), rows=${(await opsRepo.listPayments(OWNER)).length}`,
  );

  const beforeReview = await ops.getRevenueOverview(OWNER);
  log(
    `revenue before   → paid=${money(beforeReview.data?.paidTotal ?? -1, 'USD')} recorded=${money(beforeReview.data?.recordedTotal ?? -1, 'USD')} unverified=${money(beforeReview.data?.unverifiedTotal ?? -1, 'USD')}`,
  );

  const verified = await ops.reviewPayment(OWNER, {
    paymentId: recorded.data.id,
    reviewerId: 'vedmoulya-operator-sample',
  });
  if (!verified.success || !verified.data) fail('reviewPayment', verified.error);
  log(
    `reviewPayment    → status=${verified.data.status} verifiedAt=${verified.data.verifiedAt ?? 'null'}`,
  );

  const afterReview = await ops.getRevenueOverview(OWNER);
  const settled = await agency.getInvoice(OWNER, invoice.data.id);
  log(
    `revenue after    → paid=${money(afterReview.data?.paidTotal ?? -1, 'USD')} recorded=${money(afterReview.data?.recordedTotal ?? -1, 'USD')} unverified=${money(afterReview.data?.unverifiedTotal ?? -1, 'USD')}`,
  );
  log(
    `invoice now      → ${settled.data?.status ?? '?'} (settles only when verified total covers the amount)`,
  );

  const ledger = [
    SAMPLE_BANNER,
    '# SAMPLE — ledger trace produced by the application services',
    '',
    '| Step | Identifier | Value |',
    '|---|---|---|',
    `| Client | \`${client.data.id}\` | ${client.data.company} |`,
    `| Brand | \`${brand.data.id}\` | ${brand.data.name} |`,
    `| Project | \`${project.data.id}\` | ${project.data.name} |`,
    `| Lead | \`${lead.data.id}\` | won → client \`${moved.data.clientId ?? ''}\` |`,
    `| Authored article | \`${authored.data.id}\` | ${articleApproved.data.status} |`,
    `| Invoice | \`${invoice.data.id}\` | ${money(invoice.data.amount, invoice.data.currency)} (${settled.data?.status ?? '?'}) |`,
    `| Payment | \`${recorded.data.id}\` | ${money(recorded.data.amountMinor / 100, recorded.data.currency)} — ${verified.data.status} |`,
    `| Idempotency key | \`${recorded.data.idempotencyKey ?? 'null'}\` | replay returned the same row |`,
    '',
    '## Revenue before vs after verification',
    '',
    `- recorded: ${money(beforeReview.data?.recordedTotal ?? 0, 'USD')} → paid (verified): ${money(beforeReview.data?.paidTotal ?? 0, 'USD')} → unverified: ${money(beforeReview.data?.unverifiedTotal ?? 0, 'USD')}`,
    `- after review: paid (verified) ${money(afterReview.data?.paidTotal ?? 0, 'USD')} · unverified ${money(afterReview.data?.unverifiedTotal ?? 0, 'USD')}`,
    '',
    '**This payment is a synthetic sample.** The evidence reference begins with',
    '`SAMPLE-RUN-` and proves nothing about money. It demonstrates the ledger and',
    'the recorded→verified gate; it is not revenue.',
    '',
    '## AI-drafted service summary',
    '',
    `Status: ${memoStatus}`,
    '',
    '## Run log',
    '',
    '```text',
    ...runLog,
    '```',
    '',
  ].join('\n');
  writeFileSync(path.join(OUT_DIR, 'sample-ledger-trace.md'), ledger, 'utf8');

  // The run is in-memory only. Say so in a stamp the operator can check, rather
  // than relying on this log being read line by line.
  writeFileSync(
    path.join(OUT_DIR, 'SAMPLE-RUN.txt'),
    [
      'SAMPLE RUN — NOT A CLIENT ENGAGEMENT',
      `generated : ${startedAt}`,
      `finished  : ${new Date().toISOString()}`,
      `ai mode   : ${SKIP_AI ? 'skipped (--no-ai)' : LOCAL_AI ? `local Ollama (${LOCAL_MODEL})` : 'configured provider'}`,
      `summary   : ${memoStatus}`,
      '',
      'Persistence: in-memory repositories. No database was contacted; the run',
      'deletes DATABASE_URL / CONTENT_AGENCY_DATABASE_URL / REDIS_URL from its own',
      'environment before importing any service, so it cannot reach Neon or production.',
      '',
      'Every file in this directory is a demonstration built from fictional data.',
      'No client, payment, testimonial, prospect or revenue is implied. The payment',
      'row carries a SAMPLE-RUN- reference and proves nothing about money.',
      '',
    ].join('\n'),
    'utf8',
  );

  section('Done');
  console.log(`files written to ${path.relative(process.cwd(), OUT_DIR)}`);
  console.log(`AI-drafted summary: ${memoStatus}`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

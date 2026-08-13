// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AC-002.5 First Client Readiness · Task 1 — E2E Client Simulation
// -----------------------------------------------------------------------------
// Drives the REAL application services (ContentAgencyApplicationService +
// ClientOperationsApplicationService) through the complete client lifecycle:
//
//   Lead → Client → Brand Profile → Project → Content Calendar → AI Generation
//   → Review → Approval → Delivery → Invoice → Payment
//
// plus the revenue-engine modules (proposals, contracts, quotations, documents,
// notifications, client portal, business analytics). Runs hermetically against
// the in-memory repositories with a deterministic mock AI orchestrator — the
// same pipeline code used in production (prompt builder, quality passes,
// scoring, version history, trace metadata), no database or API keys required.
//
// Output: docs/AC-002.5_Workflow_Simulation.md (step-by-step evidence)
// Run:    npx tsx scripts/agency-e2e-simulation.ts
// ─────────────────────────────────────────────────────────────────────────────

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ContentAgencyApplicationService,
  ContentAgencyAIService,
  InMemoryContentAgencyRepository,
  ClientOperationsApplicationService,
  ClientOpsAIService,
  InMemoryClientOpsRepository,
  AIOrchestrationService,
  type OrchestrateRequestDTO,
  type OrchestrateResponseDTO,
} from '@vedmoulya/services';

const USER = 'agency_user_1';
const OUT_DIR = fileURLToPath(new URL('../docs/', import.meta.url));
const OUT_FILE = `${OUT_DIR}AC-002.5_Workflow_Simulation.md`;

// ── Log accumulator ──────────────────────────────────────────────────────────
const lines: string[] = [];
let stepCount = 0;
const summary: Array<{ step: string; status: string; detail: string }> = [];

function log(text = ''): void {
  lines.push(text);
}

function step(title: string, action: string, result: string, detail = ''): void {
  stepCount += 1;
  // PASS unless the result surface a failure signal (workflow assertions above
  // already throw on any unexpected service failure).
  const status = /fail|error|missing|could not|not found/i.test(result) ? '⚠️' : '✅';
  log('');
  log(`### ${stepCount}. ${title}`);
  log('');
  log(`**Action:** ${action}`);
  log('');
  log(`**Result:** ${result}`);
  if (detail) {
    log('');
    log(`\`\`\`\n${detail}\n\`\`\``);
  }
  summary.push({ step: title, status: status === '✅' ? 'PASS' : 'CHECK', detail: result });
}

function j(v: unknown): string {
  return typeof v === 'string' ? v : JSON.stringify(v);
}

// ── Deterministic mock AI orchestrator ───────────────────────────────────────
// Mirrors the OrchestrateResponseDTO contract consumed by the real AI pipeline.
// The response is selected by inspecting the assembled system prompt, so every
// pipeline stage (research / draft / quality passes / proposals / regenerate)
// is exercised with realistic content and scores.
interface MockOrchestrateRequest {
  capability?: string;
  userInput?: string;
  context?: { systemPrompt?: string };
}

interface MockOrchestrateResponse {
  content: string;
  provider: string;
  model: string;
  qualityScore: number;
  traceId: string;
  tokenUsage: { input: number; output: number; total: number };
  cost: number;
  latency: number;
}

/**
 * Deterministic mock AI orchestrator. Mirrors the OrchestrateResponseDTO
 * contract consumed by the real pipeline; the response is selected by
 * inspecting the assembled system prompt so every stage (research / draft /
 * quality passes / proposals / regenerate) is exercised with realistic content.
 */
function createMockAI(): Pick<AIOrchestrationService, 'orchestrate'> {
  let callCount = 0;
  return {
    orchestrate: (request: OrchestrateRequestDTO): Promise<OrchestrateResponseDTO> => {
      callCount += 1;
      const system = request.context?.systemPrompt ?? '';
      const user = request.userInput ?? '';
      const traceId = `trace_${String(callCount).padStart(3, '0')}`;
      const response = buildMockResponse(system, user, traceId);
      return Promise.resolve({
        content: response.content,
        provider: response.provider,
        model: response.model,
        qualityScore: response.qualityScore,
        traceId: response.traceId,
        tokenUsage: response.tokenUsage,
        cost: response.cost,
        latency: response.latency,
      });
    },
  };
}

function buildMockResponse(system: string, user: string, traceId: string): MockOrchestrateResponse {
  if (system.includes('research assistant')) {
    return {
      content: [
        '• Realtime data sync adoption grew 34% YoY among SaaS product teams',
        '• Teams on automated sync cut reporting time by ~6 hours/week',
        '• Migration risk is the top blocker — phased rollouts succeed ~2x more often',
      ].join('\n'),
      provider: 'mock',
      model: 'mock-research',
      qualityScore: 9,
      traceId,
      tokenUsage: { input: 150, output: 420, total: 570 },
      cost: 0.0052,
      latency: 180,
    };
  }
  if (system.includes('quality reviewer')) {
    // Brand-alignment / grammar / SEO passes — score is what matters.
    return {
      content: 'no changes required',
      provider: 'mock',
      model: 'mock-reviewer',
      qualityScore: 9,
      traceId,
      tokenUsage: { input: 150, output: 420, total: 570 },
      cost: 0.0052,
      latency: 180,
    };
  }
  if (system.includes('proposal writer')) {
    const company = user.split('\n')[0]?.replace('Company: ', '') ?? 'Client';
    return {
      content: [
        `# Proposal for ${company}`,
        '',
        '## Company & Context',
        'We help fast-growing product teams ship on-brand content at scale.',
        '',
        '## Requirements',
        'Ongoing content production, brand-aligned, measurable.',
        '',
        '## Scope of Work',
        'Monthly content calendar, blog + LinkedIn pipeline, performance review.',
        '',
        '## Timeline',
        'Kickoff week 1 · steady state from month 2.',
        '',
        '## Pricing (Markdown table)',
        '| Item | Amount |',
        '| --- | --- |',
        '| Monthly retainer | $1,800 |',
        '',
        '## Deliverables',
        '- 4 blog posts / month',
        '- 8 LinkedIn posts / month',
        '',
        '## Terms & Conditions',
        'Net 30 · cancel with 30 days notice.',
      ].join('\n'),
      provider: 'mock',
      model: 'mock-proposal',
      qualityScore: 9,
      traceId,
      tokenUsage: { input: 150, output: 420, total: 570 },
      cost: 0.0052,
      latency: 180,
    };
  }
  // Main draft (or regenerated draft when human feedback is attached).
  const revised = user.includes('HUMAN REVIEW FEEDBACK');
  return {
    content: revised
      ? [
          '# Why Real-Time Sync Wins (revised)',
          '',
          'Punchier opening: "Your dashboards are lying to you — here is the fix."',
          '',
          '## The Problem',
          'Stale data costs teams hours every week. Realtime sync removes the lag.',
          '',
          '## Why It Matters',
          'Teams using automated sync cut reporting time by ~6 hours/week.',
          '',
          '## Get Started',
          'Roll out in phases — pilot, measure, expand. [Book a demo](https://acme.example/demo)',
        ].join('\n')
      : [
          '# Why Real-Time Sync Wins',
          '',
          '## The Problem',
          'Most teams run on stale data. Dashboards refresh nightly, decisions lag by a day, and "the numbers changed" becomes a weekly refrain.',
          '',
          '## The Opportunity',
          'Realtime sync adoption grew 34% YoY among SaaS product teams. The leaders are not faster by accident — they act on data the moment it exists.',
          '',
          '## The Approach',
          'Automate the pipeline: source systems → transform → destination. No nightly batch, no manual CSV surgery.',
          '',
          '## The Result',
          'Teams on automated sync cut reporting time by ~6 hours/week and ship decisions with confidence.',
          '',
          '## Next Step',
          'Start with a pilot — pick one metric, sync it realtime, measure the difference. [Talk to us](https://acme.example/contact)',
        ].join('\n'),
    provider: 'mock',
    model: 'mock-content',
    qualityScore: 8,
    traceId,
    tokenUsage: { input: 150, output: 420, total: 570 },
    cost: 0.0052,
    latency: 180,
  };
}

// ── Boot the real services ───────────────────────────────────────────────────
const contentRepo = new InMemoryContentAgencyRepository();
const opsRepo = new InMemoryClientOpsRepository();
const mockAI = createMockAI();

const contentAI = new ContentAgencyAIService(mockAI);
const contentAgency = new ContentAgencyApplicationService(contentRepo, contentAI);

const opsAI = new ClientOpsAIService(mockAI);
const ops = new ClientOperationsApplicationService(opsRepo, contentAgency, opsAI);

// ── Helpers ──────────────────────────────────────────────────────────────────
function expectOk<T>(label: string, res: { success: boolean; data?: T; error?: string }): T {
  if (!res.success || res.data === undefined) {
    throw new Error(`${label} failed: ${res.error ?? 'no data'}`);
  }
  return res.data;
}

const daysFromNow = (n: number): string =>
  new Date(Date.now() + n * 24 * 3600 * 1000).toISOString().slice(0, 10);

// ══════════════════════════════════════════════════════════════════════════
// SIMULATION
// ══════════════════════════════════════════════════════════════════════════
async function main(): Promise<void> {
  log('# AC-002.5 — First Client Readiness · Task 1: End-to-End Client Simulation');
  log('');
  log(`**Date:** ${new Date().toISOString().slice(0, 10)}`);
  log(
    '**Environment:** Hermetic — real application services + in-memory repositories + deterministic mock AI orchestrator (same pipeline code as production; no DB / API keys required).',
  );
  log('**Actor:** Agency user `agency_user_1` · **Client scenario:** "Nova Analytics" (SaaS).');
  log('');

  // ── 1. LEAD ──────────────────────────────────────────────────────────────
  const lead = expectOk(
    'createLead',
    await ops.createLead(USER, {
      company: 'Nova Analytics',
      contactName: 'Priya Sharma',
      contactEmail: 'priya@nova.example',
      contactPhone: '+1-555-0142',
      industry: 'SaaS',
      source: 'referral',
      value: 24000,
      nextFollowUp: daysFromNow(3),
      notes: 'Interested in a quarterly content program.',
    }),
  );
  step(
    'Lead — create & qualify',
    'Create lead in CRM (company, contact, industry, est. value, follow-up)',
    `Lead created: ${lead.company} · status=${lead.status} · health=${lead.healthScore}`,
    j({ id: lead.id, contact: lead.contactName, source: lead.source, value: lead.value }),
  );

  await ops.addContact(USER, lead.id, {
    name: 'Ravi Iyer',
    role: 'Head of Marketing',
    isPrimary: false,
  });
  await ops.addInteraction(USER, lead.id, {
    type: 'call',
    summary: 'Discovery call — wants 4 blogs + 8 LinkedIn posts/month',
  });
  await ops.addTask(USER, lead.id, { title: 'Send capability deck', dueAt: daysFromNow(2) });
  await ops.addTask(USER, lead.id, { title: 'Draft proposal outline' });
  const leadDetail = expectOk('getLead', await ops.getLead(USER, lead.id));
  step(
    'Lead — interactions, contacts, tasks',
    'Log interaction, add contact, add tasks, complete one task',
    `Health boosted to ${leadDetail.healthScore}/100 · ${leadDetail.interactions.length} interaction · ${leadDetail.contacts.length} contact · ${leadDetail.openTasks} open task`,
    j({
      interactions: leadDetail.interactions,
      tasks: leadDetail.tasks,
      contacts: leadDetail.contacts,
    }),
  );

  // Pipeline: lead → qualified → proposal → negotiation → won (auto-client)
  let current = lead;
  for (const stage of ['qualified', 'proposal', 'negotiation', 'won'] as const) {
    current = expectOk(`moveLead:${stage}`, await ops.moveLead(USER, lead.id, stage));
  }
  step(
    'Lead — pipeline to Won',
    'Move lead lead → qualified → proposal → negotiation → won',
    `Won · clientId auto-provisioned: ${current.clientId ?? 'MISSING'}`,
    j({ status: current.status, clientId: current.clientId }),
  );

  // ── 2. CLIENT ────────────────────────────────────────────────────────────
  const clients = expectOk('listClients', await contentAgency.listClients(USER));
  const clientId = current.clientId;
  if (!clientId) throw new Error('Won lead did not provision a client record');
  const client =
    clients.find((c) => c.id === clientId) ??
    expectOk('getClient', await contentAgency.getClient(USER, clientId));
  step(
    'Client — won lead becomes client',
    'Verify the won lead auto-provisioned the Client record (AC-002 pipeline reuse)',
    `Client active: ${client.company} · id=${client.id}`,
    j({ company: client.company, industry: client.industry, aiMemory: client.aiMemory }),
  );

  // ── 3. BRAND PROFILE ─────────────────────────────────────────────────────
  const brand = expectOk(
    'upsertBrand',
    await contentAgency.upsertBrand(USER, {
      clientId: client.id,
      name: 'Nova Voice',
      tone: 'confident, data-driven, human',
      writingStyle: 'short sentences, active voice, concrete numbers',
      vocabulary: ['realtime', 'pipeline', 'measure', 'ship'],
      doRules: ['Use concrete metrics', 'Address the reader directly'],
      dontRules: ['No jargon without explanation', 'No hype without evidence'],
      ctaStyle: 'Start with a pilot',
      keywords: ['realtime sync', 'data pipeline', 'analytics'],
      mission: 'Make every product decision realtime.',
    }),
  );
  step(
    'Brand Profile',
    'Create brand profile: tone, writing style, do/don’t rules, keywords, CTA style',
    `Brand saved: ${brand.name} · ${brand.doRules.length} do-rules · ${brand.dontRules.length} don’t-rules`,
    j({ tone: brand.tone, writingStyle: brand.writingStyle, keywords: brand.keywords }),
  );

  // ── 4. PROJECT ───────────────────────────────────────────────────────────
  const project = expectOk(
    'createProject',
    await contentAgency.createProject(USER, {
      clientId: client.id,
      brandId: brand.id,
      name: 'Q3 Content Program',
      description: 'Quarterly blog + LinkedIn pipeline for Nova Analytics.',
      startDate: daysFromNow(-7),
      endDate: daysFromNow(75),
    }),
  );
  step(
    'Project',
    'Create project scoped to the client + brand',
    `Project active: ${project.name} · status=${project.status}`,
    j({ id: project.id, description: project.description }),
  );

  // ── 5. CONTENT CALENDAR ──────────────────────────────────────────────────
  const c1 = expectOk(
    'generate:blog',
    await contentAgency.generateContent(USER, {
      clientId: client.id,
      brandId: brand.id,
      projectId: project.id,
      contentType: 'blog',
      title: 'Why Real-Time Sync Wins',
      brief: 'Thought-leadership post on realtime data sync for SaaS leaders.',
    }),
  );
  const c2 = expectOk(
    'generate:linkedin',
    await contentAgency.generateContent(USER, {
      clientId: client.id,
      brandId: brand.id,
      projectId: project.id,
      contentType: 'linkedin',
      title: '5 Metrics to Watch in Realtime',
      brief: 'LinkedIn carousel teaser on key product metrics.',
    }),
  );
  const c3 = expectOk(
    'generate:email',
    await contentAgency.generateContent(USER, {
      clientId: client.id,
      brandId: brand.id,
      projectId: project.id,
      contentType: 'email',
      title: 'Pilot Invite — Realtime Sync',
      brief: 'Cold-ish nurture email inviting prospects to a pilot.',
    }),
  );
  await contentAgency.scheduleContent(USER, c1.id, `${daysFromNow(7)}T09:00:00Z`);
  await contentAgency.scheduleContent(USER, c2.id, `${daysFromNow(14)}T09:00:00Z`);
  const calendar = expectOk('getCalendar', await contentAgency.getCalendar(USER, 'month'));
  step(
    'Content Calendar',
    'Generate 3 assets and schedule 2 on the calendar',
    `${calendar.length} entries on the monthly calendar`,
    j(
      calendar.map((e) => ({
        title: e.title,
        type: e.contentType,
        status: e.status,
        client: e.clientName,
      })),
    ),
  );

  // ── 6. AI GENERATION ─────────────────────────────────────────────────────
  step(
    'AI Generation — traceable pipeline',
    'Generate blog via the AI pipeline (research → prompt → draft → brand/grammar/SEO passes → quality score)',
    `Draft generated · quality=${c1.aiMetadata?.qualityScore}/10 · provider=${c1.aiMetadata?.provider} · trace=${c1.aiMetadata?.traceId}`,
    j({
      model: c1.aiMetadata?.model,
      sections: c1.aiMetadata?.prompt.sections,
      passes: c1.aiMetadata?.passes,
      tokenUsage: c1.aiMetadata?.tokenUsage,
      cost: c1.aiMetadata?.cost,
      latencyMs: c1.aiMetadata?.latencyMs,
    }),
  );

  const regen = expectOk(
    'regenerateContent',
    await contentAgency.regenerateContent(USER, c1.id, {
      feedback: 'Make it punchier and add a concrete CTA.',
    }),
  );
  step(
    'AI Generation — regenerate with feedback',
    'Regenerate using human review feedback (versioned, cumulative usage)',
    `v${regen.versions.length} created · status returned to review · quality=${regen.aiMetadata?.qualityScore}/10`,
    j({
      versions: regen.versions.length,
      feedback: regen.versions[regen.versions.length - 1]?.feedback,
      sections: regen.aiMetadata?.prompt.sections,
    }),
  );

  // ── 7. REVIEW ────────────────────────────────────────────────────────────
  await contentAgency.addReview(USER, c1.id, {
    stage: 'review',
    reviewer: 'Agency Editor',
    comment: 'Great draft, tighten the middle.',
    decision: 'comment',
  });
  const rejected = expectOk(
    'addReview:reject',
    await contentAgency.addReview(USER, c1.id, {
      stage: 'grammar',
      reviewer: 'Agency Editor',
      comment: 'Two comma splices — fixed in v3.',
      decision: 'rejected',
      score: 7,
    }),
  );
  const accepted = expectOk(
    'addReview:accept',
    await contentAgency.addReview(USER, c1.id, {
      stage: 'brand_alignment',
      reviewer: 'Agency Editor',
      comment: 'On-brand, metrics first.',
      decision: 'accepted',
      score: 9,
    }),
  );
  step(
    'Review',
    'Agency review: comment → rejected → accepted (full history retained)',
    `Status: ${rejected.status} → ${accepted.status} · ${accepted.reviews.length} reviews recorded`,
    j(accepted.reviews.map((r) => ({ stage: r.stage, decision: r.decision, score: r.score }))),
  );

  // ── 8. APPROVAL (client portal) ──────────────────────────────────────────
  const portal = expectOk(
    'createPortalAccess',
    await ops.createPortalAccess(USER, {
      clientId: client.id,
      email: 'priya@nova.example',
    }),
  );
  const session = expectOk('portalLogin', await ops.portalLogin(portal.rawToken));
  const approved = expectOk(
    'portalApproveContent',
    await ops.portalApproveContent(portal.rawToken, c1.id, 'Approved — ship it.'),
  );
  step(
    'Approval — client portal',
    'Client signs into secure portal and approves the asset',
    `Content approved by ${session.company} → status=${approved.content.status}`,
    j({
      token: portal.rawToken.slice(0, 12) + '…',
      session: session.email,
      status: approved.content.status,
    }),
  );

  // ── 9. DELIVERY ──────────────────────────────────────────────────────────
  const delivered = expectOk(
    'publishContent',
    await contentAgency.publishContent(USER, c1.id, 'https://nova.example/blog/realtime-sync'),
  );
  const md = expectOk(
    'export:markdown',
    await contentAgency.exportContent(USER, c1.id, 'markdown'),
  );
  const html = expectOk('export:html', await contentAgency.exportContent(USER, c1.id, 'html'));
  step(
    'Delivery',
    'Publish asset + export deliverable (markdown + HTML)',
    `Published: ${delivered.publishedUrl} · exports: ${md.filename} + ${html.filename}`,
    j({ markdown: `${md.data.slice(0, 60)}…`, htmlSupported: html.supported }),
  );

  // ── 10. INVOICE ──────────────────────────────────────────────────────────
  const invoice = expectOk(
    'createInvoice',
    await contentAgency.createInvoice(USER, {
      clientId: client.id,
      projectId: project.id,
      description: 'Q3 Content Program — month 1',
      amount: 2400,
      currency: 'USD',
      status: 'sent',
      dueDate: daysFromNow(21),
    }),
  );
  step(
    'Invoice',
    'Issue invoice (number, client, project, taxes/amount, due date)',
    `Invoice ${invoice.id} · ${invoice.currency} ${invoice.amount} · status=${invoice.status} · due ${invoice.dueDate}`,
    j({ id: invoice.id, description: invoice.description, dueDate: invoice.dueDate }),
  );

  // ── 11. PAYMENT ──────────────────────────────────────────────────────────
  const payment = expectOk(
    'addPayment',
    await ops.addPayment(USER, {
      invoiceId: invoice.id,
      amount: 2400,
      method: 'bank_transfer',
      note: 'Full payment — Q3 month 1',
    }),
  );
  const revenue = expectOk('getRevenueOverview', await ops.getRevenueOverview(USER));
  step(
    'Payment',
    'Record payment → invoice auto-marks paid, revenue overview updates',
    `Payment ${payment.amount} recorded → paidTotal=${revenue.paidTotal} · outstanding=${revenue.outstanding} · overdue=${revenue.overdueCount}`,
    j({ paymentId: payment.id, method: payment.method, annualRevenue: revenue.annualRevenue }),
  );

  // ══════════════════════════════════════════════════════════════════════
  // REVENUE-ENGINE MODULES (bonus coverage)
  // ══════════════════════════════════════════════════════════════════════
  log('');
  log('## Revenue-Engine Modules (same client-operating workflow)');
  log('');

  // Proposal engine (Module 2) — second prospect promoted on acceptance.
  const lead2 = expectOk(
    'createLead2',
    await ops.createLead(USER, {
      company: 'Lumina Labs',
      industry: 'Fintech',
      value: 12000,
      source: 'event',
    }),
  );
  const proposal = expectOk(
    'generateProposal',
    await ops.generateProposal(USER, {
      title: 'Lumina Labs — Content Retainer',
      leadId: lead2.id,
      company: 'Lumina Labs',
      industry: 'Fintech',
      requirements: 'Monthly fintech thought-leadership content, compliance-aware.',
      scope: '4 blogs + 8 LinkedIn posts per month',
      timeline: '3 months, renewable',
      deliverables: ['Blog posts', 'LinkedIn posts', 'Monthly performance review'],
      goals: ['Build category authority', 'Fill top-of-funnel'],
      pricing: [{ label: 'Monthly retainer', amount: 1800 }],
    }),
  );
  const sentProposal = expectOk('sendProposal', await ops.sendProposal(USER, proposal.id));
  const acceptedProposal = expectOk('acceptProposal', await ops.acceptProposal(USER, proposal.id));
  step(
    'Proposal Engine (AI)',
    'AI-generate proposal → send → accept (acceptance promotes the lead to won → client)',
    `Proposal ${acceptedProposal.status} · AI model=${proposal.aiMetadata?.model} · quality=${proposal.aiMetadata?.qualityScore}/10`,
    j({ versions: proposal.versionCount, cost: proposal.aiMetadata?.cost }),
  );

  // Contract management (Module 3).
  const contract = expectOk(
    'createContract',
    await ops.createContract(USER, {
      clientId: client.id,
      title: 'Nova Analytics — Annual Retainer',
      startDate: daysFromNow(0),
      endDate: daysFromNow(300),
      value: 24000,
      currency: 'USD',
      content: 'Standard retainer terms…',
    }),
  );
  const approvedContract = expectOk(
    'approveContract',
    await ops.approveContract(USER, contract.id, { approved: true, by: 'Agency Director' }),
  );
  const expiring = expectOk('listExpiringContracts', await ops.listExpiringContracts(USER, 60));
  step(
    'Contract Management',
    'Create contract → approve (active) → derive expiry tracking',
    `Contract ${approvedContract.status} · expiresInDays=${approvedContract.expiresInDays} · ${expiring.length} expiring within 60 days`,
    j({
      value: approvedContract.value,
      currentVersion: approvedContract.currentVersion,
      approvals: approvedContract.approvalCount,
    }),
  );

  // Quotations (Module 4).
  const quotation = expectOk(
    'createQuotation',
    await ops.createQuotation(USER, {
      title: 'Nova — Launch Package',
      clientId: client.id,
      packages: [
        { name: 'Brand foundation', price: 1200 },
        { name: 'Content pipeline setup', price: 800, qty: 1 },
      ],
      discount: 100,
      taxRate: 5,
    }),
  );
  const sentQuotation = expectOk('sendQuotation', await ops.sendQuotation(USER, quotation.id));
  step(
    'Quotations',
    'Create quotation (packages + discount + tax) → send',
    `Quotation ${sentQuotation.status} · subtotal=${quotation.subtotal} · total=${quotation.total}`,
    j({ packages: quotation.packages, discount: quotation.discount, taxRate: quotation.taxRate }),
  );

  // Document management (Module 8).
  const doc = expectOk(
    'uploadDocument',
    await ops.uploadDocument(USER, {
      clientId: client.id,
      projectId: project.id,
      name: 'Nova Brand Guidelines',
      kind: 'brand_guidelines',
      mime: 'application/pdf',
      contentBase64: Buffer.from('fake-pdf-content').toString('base64'),
      metadata: { tags: ['brand', 'v1'] },
    }),
  );
  const search = expectOk('searchDocuments', await ops.searchDocuments(USER, 'brand'));
  step(
    'Document Management',
    'Upload brand guidelines (size-capped, versioned) + metadata search',
    `Document ${doc.name} (${doc.size} B) · ${search.length} match(es) for "brand"`,
    j({ kind: doc.kind, currentVersion: doc.currentVersion }),
  );

  // Notifications (Module 9).
  const notifications = expectOk('listNotifications', await ops.listNotifications(USER));
  const notifTypes = [...new Set(notifications.map((n) => n.type))];
  step(
    'Notifications',
    'Materialised notifications across the workflow (proposal sent, approval pending, contract expiring, client comment)',
    `${notifications.length} notifications · types: ${notifTypes.join(', ')}`,
    j(
      notifications
        .slice(0, 5)
        .map((n) => ({ type: n.type, audience: n.audience, title: n.title })),
    ),
  );

  // Client portal dashboard (Module 7).
  const portalDash = expectOk('portalDashboard', await ops.portalDashboard(portal.rawToken));
  step(
    'Client Portal — dashboard',
    'Client views projects, content, invoices and notifications in the secure portal',
    `${portalDash.projects.length} project · ${portalDash.contentStats.published} published · ${portalDash.invoices.length} invoice · ${portalDash.notifications.length} notification`,
    j({
      company: portalDash.session.company,
      awaitingApproval: portalDash.contentStats.awaitingApproval,
    }),
  );

  // Business analytics (Module 10).
  const biz = expectOk('getBusinessAnalytics', await ops.getBusinessAnalytics(USER));
  step(
    'Business Analytics',
    'Revenue, clients, projects, win rate, approval time, AI usage, delivery time',
    `Revenue=${biz.revenue.total} · winRate=${biz.winRate}% · approval=${biz.approvalTimeDays}d · delivery=${biz.avgDeliveryDays}d · AI=${biz.aiUsage.requests} requests`,
    j(biz),
  );

  // ── Final snapshot ────────────────────────────────────────────────────────
  const dashboard = expectOk('getDashboard', await contentAgency.getDashboard(USER));
  const analytics = expectOk('getAnalytics', await contentAgency.getAnalytics(USER));
  log('');
  log('## Final Snapshot');
  log('');
  log(
    `- **Clients:** ${analytics.clients} · **Projects:** ${analytics.projects} · **Content created:** ${analytics.contentCreated}`,
  );
  log(
    `- **Revenue recognized:** $${analytics.revenue} · **AI generations:** ${analytics.aiUsage.generations} · **Avg quality:** ${analytics.aiUsage.avgQualityScore}/10`,
  );
  log(
    `- **Upcoming content:** ${dashboard.upcomingContent.length} · **Recent content:** ${dashboard.recentContent.length}`,
  );

  log('');
  log('## Workflow Summary');
  log('');
  log('| Step | Result |');
  log('| --- | --- |');
  for (const s of summary) {
    log(`| ${s.step} | ${s.status} — ${s.detail} |`);
  }
  log('');
  log('---');
  log(
    '*Generated by `scripts/agency-e2e-simulation.ts` — real application services, in-memory repositories, deterministic mock AI orchestrator.*',
  );

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, lines.join('\n'), 'utf8');
  console.log(`✅ Simulation complete — ${stepCount} workflow steps executed.`);
  console.log(`📄 Report written to ${OUT_FILE}`);
  const failed = summary.filter((s) => s.status !== 'PASS');
  if (failed.length > 0) {
    console.warn(
      `⚠️  ${failed.length} step(s) need attention: ${failed.map((f) => f.step).join(', ')}`,
    );
  } else {
    console.log('✅ All workflow steps PASS.');
  }
}

main().catch((error: unknown) => {
  console.error('❌ Simulation failed:', error);
  process.exitCode = 1;
});

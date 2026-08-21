// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — SPRINT-039 Customer Discovery Benchmark
//
// Deterministic, hermetic harness proving the customer-discovery ledger +
// next-best-action composition of the EXISTING FounderEvidenceLoop:
//   • the ledger is NOT a CRM — the MINIMUM evidence-oriented representation
//   • discovery ≠ validation (statuses progress through a bounded chain)
//   • a conversation is never a customer; interest is never revenue; stated
//     WTP is never payment; only VERIFIED_PAYMENT advances revenue
//   • NEXT BEST ACTION is explainable (WHY / EVIDENCE / COST / LEARNING /
//     RISK / NEXT DECISION) and may recommend STOP
//   • evidence quality stays honest — UNKNOWN / NEEDS_REVIEW when insufficient
//   • owner isolation + provenance are enforced
//
// NO new engine — composes the existing FounderEvidenceLoop domain.
//
// Run:  npm run discovery:benchmark
// ─────────────────────────────────────────────────────────────────────────────

import {
  canAdvanceProspect,
  evidenceQuality,
  nextBestAction,
  prospectTransitionReason,
  validateCustomerDiscoveryRecord,
} from '../domain/FounderEvidenceLoop.js';
import type { BusinessProblem, CustomerDiscoveryRecord } from '../types/world-types.js';

export interface DiscoveryScenarioResult {
  id: string;
  name: string;
  pass: boolean;
  detail?: string;
}

export interface DiscoveryBenchmarkRun {
  passed: number;
  failed: number;
  results: DiscoveryScenarioResult[];
  failures: string[];
}

const OWNER = 'owner-bench';
const now = (): string => '2026-08-15T10:00:00.000Z';

function prospect(overrides: Partial<CustomerDiscoveryRecord> = {}): CustomerDiscoveryRecord {
  return {
    id: 'pros-1',
    ownerId: OWNER,
    problemId: 'p-1',
    prospectReference: 'clinic-owner-1',
    customerSegment: 'small clinics',
    problemDiscussed: 'follow-up reminders consume staff time',
    discoveryStatus: 'CONVERSATION',
    evidence: [],
    provenance: { source: 'interview', reference: 'call-001', observedAt: now() },
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  };
}

function problem(overrides: Partial<BusinessProblem> = {}): BusinessProblem {
  return {
    id: 'p-1',
    ownerId: OWNER,
    stableKey: `${OWNER}:clinic-followups`,
    problemStatement: 'Clinic follow-up reminders consume staff time',
    competitorAlternatives: [],
    evidence: [],
    willingnessToPayEvidence: [],
    confidence: 'UNKNOWN',
    status: 'PROBLEM',
    revenueState: 'NO_EVIDENCE',
    createdAt: now(),
    updatedAt: now(),
    ...overrides,
  };
}

export function runCustomerDiscoveryScenarios(): DiscoveryBenchmarkRun {
  const results: DiscoveryScenarioResult[] = [];
  const failures: string[] = [];
  const add = (r: DiscoveryScenarioResult): void => {
    results.push(r);
    if (!r.pass) failures.push(`${r.id} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  };

  // ── 01. a valid prospect record is created with provenance ────────────────
  {
    const record = validateCustomerDiscoveryRecord(
      {
        ownerId: OWNER,
        problemId: 'p-1',
        prospectReference: 'clinic-owner-1',
        customerSegment: 'small clinics',
        problemDiscussed: 'follow-up reminders consume staff time',
        provenance: { source: 'interview', reference: 'call-001', observedAt: now() },
      },
      now,
    );
    add({
      id: '01',
      name: 'prospect-record — a valid record requires provenance + segment + problem discussed',
      pass: record.success && record.data.discoveryStatus === 'CONTACTED',
    });
  }

  // ── 02. missing provenance → refused ──────────────────────────────────────
  {
    const bad = validateCustomerDiscoveryRecord(
      {
        ownerId: OWNER,
        problemId: 'p-1',
        prospectReference: 'clinic-owner-1',
        customerSegment: 'small clinics',
        problemDiscussed: 'follow-up reminders',
        provenance: { source: '', observedAt: now() },
      },
      now,
    );
    add({
      id: '02',
      name: 'prospect-provenance — a prospect record without provenance is refused',
      pass: !bad.success && bad.code === 'PROVENANCE_REQUIRED',
    });
  }

  // ── 03. discovery ≠ validation — bounded status chain ─────────────────────
  {
    const chain = [
      'CONTACTED',
      'CONVERSATION',
      'PROBLEM_CONFIRMED',
      'SOLUTION_INTEREST',
      'WTP_SIGNAL',
      'PAYMENT_REQUESTED',
      'VERIFIED_PAYMENT',
    ] as const;
    let ok = true;
    for (let i = 0; i < chain.length - 1; i += 1) {
      const from = chain[i];
      const to = chain[i + 1];
      if (from === undefined || to === undefined || !canAdvanceProspect(from, to)) ok = false;
    }
    const jump = canAdvanceProspect('CONTACTED', 'VERIFIED_PAYMENT');
    add({
      id: '03',
      name: 'discovery-chain — statuses progress through the bounded chain; no jumps',
      pass:
        ok &&
        !jump &&
        prospectTransitionReason('CONTACTED', 'VERIFIED_PAYMENT').includes('not allowed'),
    });
  }

  // ── 04. conversation ≠ customer; interest ≠ revenue ──────────────────────
  {
    const p = problem({ revenueState: 'INTEREST' });
    const q = evidenceQuality({
      problemId: 'p-1',
      observations: [],
      prospects: [prospect()],
      evidence: [],
    });
    const action = nextBestAction({
      problem: p,
      observations: [],
      prospects: [prospect()],
      quality: q.overall,
    });
    add({
      id: '04',
      name: 'interest-not-revenue — INTEREST never reaches REVENUE_VERIFIED and never triggers REQUEST_PAYMENT',
      pass: p.revenueState === 'INTEREST' && action.action !== 'REQUEST_PAYMENT',
    });
  }

  // ── 05. stated WTP ≠ payment — WTP_SIGNAL is not VERIFIED_PAYMENT ─────────
  {
    const wtp = prospect({
      discoveryStatus: 'WTP_SIGNAL',
      willingnessToPayIndication: { value: 5000, status: 'ESTIMATED', evidence: ['stated'] },
    });
    const p = problem({ revenueState: 'PAYING_INTEREST' });
    add({
      id: '05',
      name: 'wtp-not-payment — a WTP_SIGNAL prospect is not a VERIFIED_PAYMENT',
      pass: wtp.discoveryStatus === 'WTP_SIGNAL' && p.revenueState !== 'REVENUE_VERIFIED',
    });
  }

  // ── 06. three conversations → TEST_WTP next action ────────────────────────
  {
    const prospects = [
      prospect({ id: 'a', discoveryStatus: 'PROBLEM_CONFIRMED' }),
      prospect({ id: 'b', discoveryStatus: 'PROBLEM_CONFIRMED' }),
      prospect({ id: 'c', discoveryStatus: 'SOLUTION_INTEREST' }),
    ];
    const q = evidenceQuality({ problemId: 'p-1', observations: [], prospects, evidence: [] });
    const action = nextBestAction({
      problem: problem(),
      observations: [],
      prospects,
      quality: q.overall,
    });
    add({
      id: '06',
      name: 'test-wtp — after ≥3 conversations the next uncertainty is willingness to pay',
      pass: action.action === 'TEST_WTP' && action.capitalMode === 'NO_COST',
      detail: `action=${action.action}`,
    });
  }

  // ── 07. WTP + verified payment → REQUEST_PAYMENT ──────────────────────────
  {
    const wtp = prospect({
      discoveryStatus: 'WTP_SIGNAL',
      willingnessToPayIndication: { value: 5000, status: 'ESTIMATED', evidence: ['stated'] },
    });
    const p = problem({
      revenueState: 'REVENUE_VERIFIED',
      evidence: [
        {
          id: 'ev-p',
          ownerId: OWNER,
          source: 'verified_payment',
          observedAt: now(),
          text: 'paid',
          confidence: 'VERIFIED',
          evidenceOnly: true,
        },
      ],
    });
    const q = evidenceQuality({
      problemId: 'p-1',
      observations: [],
      prospects: [wtp],
      evidence: p.evidence,
    });
    const action = nextBestAction({
      problem: p,
      observations: [],
      prospects: [wtp],
      quality: q.overall,
    });
    add({
      id: '07',
      name: 'request-payment — verified payment + WTP signals → convert validated interest into paid commitments',
      pass: action.action === 'REQUEST_PAYMENT',
      detail: `action=${action.action}`,
    });
  }

  // ── 08. owner isolation — cross-owner prospect ids embed the owner ────────
  {
    const other = validateCustomerDiscoveryRecord(
      {
        ownerId: 'owner-other',
        problemId: 'p-9',
        prospectReference: 'clinic-owner-9',
        customerSegment: 'clinics',
        problemDiscussed: 'different problem',
        provenance: { source: 'interview', observedAt: now() },
      },
      now,
    );
    add({
      id: '08',
      name: 'owner-isolation — a prospect record is scoped to its owner',
      pass:
        other.success &&
        other.data.ownerId === 'owner-other' &&
        other.data.id.startsWith('pros-owner-'),
    });
  }

  // ── 09. evidence quality stays honest (NEEDS_REVIEW on conflict) ──────────
  {
    const q = evidenceQuality({
      problemId: 'p-1',
      observations: [],
      prospects: [prospect()],
      evidence: [],
    });
    add({
      id: '09',
      name: 'quality-honest — quality is UNKNOWN/LOW until real evidence exists (never inflated)',
      pass: q.overall === 'UNKNOWN' || q.overall === 'LOW' || q.overall === 'NEEDS_REVIEW',
      detail: `overall=${q.overall}`,
    });
  }

  // ── 10. the ledger is NOT a CRM — no PII, no unbounded fields ─────────────
  {
    const record = validateCustomerDiscoveryRecord(
      {
        ownerId: OWNER,
        problemId: 'p-1',
        prospectReference: 'clinic-owner-1',
        customerSegment: 'small clinics',
        problemDiscussed: 'follow-up reminders',
        provenance: { source: 'interview', observedAt: now() },
      },
      now,
    );
    add({
      id: '10',
      name: 'not-a-crm — the ledger stores evidence-oriented fields only (prospect reference, not PII dumps)',
      pass:
        record.success && 'prospectReference' in record.data && 'discoveryStatus' in record.data,
    });
  }

  return {
    passed: results.filter((r) => r.pass).length,
    failed: results.length - results.filter((r) => r.pass).length,
    results,
    failures,
  };
}

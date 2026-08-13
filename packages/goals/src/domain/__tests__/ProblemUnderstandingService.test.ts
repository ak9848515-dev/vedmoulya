// ──────────────────────────────────────────────────────────────────
// VedMoulya — ProblemUnderstandingService tests (SPRINT-023)
// Verifies the typed problem→outcome front door: intent detection
// (ANSWER / ACTION / OUTCOME / UNKNOWN), constraints, urgency,
// required capabilities, missing-information honesty, approval
// requirements, risk estimates and confidence — all deterministic
// and never fabricated.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { ProblemUnderstandingService } from '../services/ProblemUnderstandingService.js';

describe('ProblemUnderstandingService', () => {
  const service = new ProblemUnderstandingService();

  it('classifies a question as ANSWER', () => {
    const d = service.understand('What is RAG and how does retrieval work?');
    expect(d.intent).toBe('ANSWER');
    expect(d.desiredOutcome).toContain('Understand:');
    expect(d.domain).toBeTruthy();
    expect(d.originalRequest).toBe('What is RAG and how does retrieval work?');
  });

  it('classifies a build request as ACTION', () => {
    const d = service.understand('Build a script to rename files in a folder');
    expect(d.intent).toBe('ACTION');
    expect(d.requiredCapabilities).toContain('coding');
    expect(d.missingInformation.some((m) => m.includes('Access'))).toBe(true);
  });

  it('classifies an earning goal as OUTCOME with the revenue domain', () => {
    const d = service.understand('I want to earn money from my Excel skills');
    expect(d.intent).toBe('OUTCOME');
    // SPRINT-023 §11 — earning is a first-class outcome category.
    expect(d.domain).toBe('revenue');
    expect(d.provenance.some((p) => p.includes('Earning-domain override'))).toBe(true);
    expect(d.missingInformation.some((m) => m.includes('Market/budget evidence'))).toBe(true);
  });

  it('leaves an ambiguous request UNKNOWN and says so honestly', () => {
    const d = service.understand('Things have been complicated lately');
    expect(d.intent).toBe('UNKNOWN');
    expect(d.missingInformation[0]).toContain('intent is ambiguous');
    expect(d.confidence).toBeLessThan(0.6);
  });

  it('detects deadline, budget, privacy and local constraints', () => {
    const d = service.understand(
      'Automate my daily Excel report before Friday, under $100, without sharing the data externally, running locally',
    );
    const kinds = d.constraints.map((c) => c.kind);
    expect(kinds).toContain('deadline');
    expect(kinds).toContain('budget');
    expect(kinds).toContain('privacy');
    expect(kinds).toContain('local');
  });

  it('derives urgency from explicit urgency signals', () => {
    const urgent = service.understand('Fix this ASAP — it is critical and due today');
    const calm = service.understand('Maybe look into this sometime next month');
    expect(urgent.urgency).toBeGreaterThan(calm.urgency);
    expect(urgent.urgency).toBeGreaterThan(0.8);
  });

  it('never fabricates success criteria', () => {
    const d = service.understand('Improve my resume');
    expect(d.successCriteria).toEqual([]);
    expect(d.missingInformation.some((m) => m.includes('measured'))).toBe(true);
  });

  it('extracts only explicitly stated success criteria', () => {
    const d = service.understand('Automate the report so it must run in under 5 minutes');
    expect(d.successCriteria.length).toBeGreaterThanOrEqual(1);
    expect(d.successCriteria[0]).toContain('must');
  });

  it('never mislabels non-measurable "must / at least" clauses as criteria', () => {
    const vague = service.understand('I must decide between two options');
    expect(vague.successCriteria).toEqual([]);
    const tryIt = service.understand('At least try it sometime');
    expect(tryIt.successCriteria).toEqual([]);
  });

  it('ignores deadline/budget false positives ("by the way", bare "budget")', () => {
    const byTheWay = service.understand('By the way, can you summarize this document?');
    expect(byTheWay.constraints.filter((c) => c.kind === 'deadline')).toEqual([]);
    const noBudget = service.understand('I have no budget concerns — just summarize it');
    expect(noBudget.constraints.filter((c) => c.kind === 'budget')).toEqual([]);
  });

  it('requires approval for send/publish/pay/delete actions', () => {
    const send = service.understand('Send an email to all clients about the new pricing');
    expect(send.approvalRequirements.map((a) => a.action)).toContain('send');

    const publish = service.understand('Publish the new article publicly on our blog');
    expect(publish.approvalRequirements.map((a) => a.action)).toContain('publish');

    const deleteReq = service.understand('Delete permanently the archived records from last year');
    expect(deleteReq.approvalRequirements.map((a) => a.action)).toContain('delete');

    const benign = service.understand('Summarize this document for me');
    expect(benign.approvalRequirements).toEqual([]);
  });

  it('estimates risk but labels it as an estimate', () => {
    const high = service.understand('Delete permanently the production database records');
    expect(high.riskLevel).toBe('high');
    expect(high.provenance.some((p) => p.includes('ESTIMATED'))).toBe(true);

    const low = service.understand('Explain how a hash table works');
    expect(low.riskLevel).toBe('low');
  });

  it('records provenance for every determination', () => {
    const d = service.understand('Create a weekly report generator with charts');
    expect(d.provenance.length).toBeGreaterThanOrEqual(5);
    expect(d.provenance.some((p) => p.includes('GoalUnderstandingService'))).toBe(true);
    expect(d.confidence).toBeGreaterThanOrEqual(0.3);
    expect(d.confidence).toBeLessThanOrEqual(0.95);
  });

  it('is deterministic — same input, same definition', () => {
    const a = service.understand('Automate my daily Excel report before Friday');
    const b = service.understand('Automate my daily Excel report before Friday');
    expect(a).toEqual(b);
  });
});

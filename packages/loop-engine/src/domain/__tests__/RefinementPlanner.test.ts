import { describe, expect, it } from 'vitest';
import { RefinementPlanner } from '../RefinementPlanner.js';
import type { CriticAssessment, LoopBudgetUsage } from '../../types/loop-types.js';

function critic(
  verdict: CriticAssessment['verdict'],
  failedChecks: Array<{ name: string; severity: 'critical' | 'minor' }> = [],
): CriticAssessment {
  return {
    verdict,
    score: failedChecks.length === 0 ? 1 : 0.5,
    checks: [
      { name: 'completion', passed: verdict !== 'ABSTAIN', detail: '', severity: 'minor' },
      ...failedChecks.map((c) => ({
        name: c.name,
        passed: false,
        detail: 'failed',
        severity: c.severity,
      })),
    ],
    reasons: failedChecks.map((c) => `${c.name}: failed`),
  };
}

const usage = (iterations: number): LoopBudgetUsage => ({
  tokensInput: 0,
  tokensOutput: 0,
  tokensTotal: 0,
  costUsd: 0,
  latencyMs: 0,
  providerCalls: 0,
  toolCalls: 0,
  iterations,
});

describe('RefinementPlanner', () => {
  const planner = new RefinementPlanner();

  it('finishes on PASS', () => {
    const decision = planner.decide({
      critic: critic('PASS'),
      evidenceStates: ['SUFFICIENT_EVIDENCE'],
      usage: usage(1),
      maxIterations: 8,
      groundingRequired: true,
    });
    expect(decision.action).toBe('finish');
  });

  it('stops with SECURITY_BLOCK when a tool was denied', () => {
    const decision = planner.decide({
      critic: critic('FAIL'),
      evidenceStates: ['SUFFICIENT_EVIDENCE'],
      usage: usage(1),
      maxIterations: 8,
      groundingRequired: true,
      toolDenied: true,
    });
    expect(decision.action).toBe('stop');
    expect(decision.terminationReason).toBe('SECURITY_BLOCK');
  });

  it('stops with TOOL_FAILURE when a tool failed', () => {
    const decision = planner.decide({
      critic: critic('FAIL'),
      evidenceStates: [],
      usage: usage(1),
      maxIterations: 8,
      groundingRequired: true,
      toolFailed: true,
    });
    expect(decision.terminationReason).toBe('TOOL_FAILURE');
  });

  it('stops with PROVIDER_FAILURE when the specialist failed', () => {
    const decision = planner.decide({
      critic: critic('FAIL'),
      evidenceStates: [],
      usage: usage(1),
      maxIterations: 8,
      groundingRequired: true,
      providerFailed: true,
    });
    expect(decision.terminationReason).toBe('PROVIDER_FAILURE');
  });

  it('retrieves more evidence on insufficient evidence while budget allows', () => {
    const decision = planner.decide({
      critic: critic('ABSTAIN'),
      evidenceStates: ['INSUFFICIENT_EVIDENCE'],
      usage: usage(1),
      maxIterations: 8,
      groundingRequired: true,
    });
    expect(decision.action).toBe('retrieve_more_evidence');
  });

  it('stops with EVIDENCE_INSUFFICIENT when no budget remains', () => {
    const decision = planner.decide({
      critic: critic('ABSTAIN'),
      evidenceStates: ['INSUFFICIENT_EVIDENCE'],
      usage: usage(8),
      maxIterations: 8,
      groundingRequired: true,
    });
    expect(decision.action).toBe('stop');
    expect(decision.terminationReason).toBe('EVIDENCE_INSUFFICIENT');
  });

  it('investigates conflicts while budget allows', () => {
    const decision = planner.decide({
      critic: critic('ABSTAIN'),
      evidenceStates: ['CONFLICTING_EVIDENCE'],
      usage: usage(1),
      maxIterations: 8,
      groundingRequired: true,
    });
    expect(decision.action).toBe('verify_conflict');
  });

  it('stops with EVIDENCE_CONFLICT when no budget remains', () => {
    const decision = planner.decide({
      critic: critic('ABSTAIN'),
      evidenceStates: ['CONFLICTING_EVIDENCE'],
      usage: usage(8),
      maxIterations: 8,
      groundingRequired: true,
    });
    expect(decision.action).toBe('stop');
    expect(decision.terminationReason).toBe('EVIDENCE_CONFLICT');
  });

  it('asks for clarification when a requirement is missing', () => {
    const decision = planner.decide({
      critic: critic('FAIL', [{ name: 'requirement', severity: 'critical' }]),
      evidenceStates: [],
      usage: usage(1),
      maxIterations: 8,
      groundingRequired: true,
    });
    expect(decision.action).toBe('clarification_required');
    expect(decision.terminationReason).toBe('USER_CLARIFICATION_REQUIRED');
  });

  it('regenerates the output on FAIL while budget allows', () => {
    const decision = planner.decide({
      critic: critic('FAIL', [{ name: 'constraint', severity: 'critical' }]),
      evidenceStates: ['SUFFICIENT_EVIDENCE'],
      usage: usage(1),
      maxIterations: 8,
      groundingRequired: true,
    });
    expect(decision.action).toBe('fix_output');
  });

  it('stops with ITERATION_LIMIT on FAIL when the iteration budget is exhausted', () => {
    const decision = planner.decide({
      critic: critic('FAIL', [{ name: 'constraint', severity: 'critical' }]),
      evidenceStates: [],
      usage: usage(8),
      maxIterations: 8,
      groundingRequired: true,
    });
    expect(decision.action).toBe('stop');
    expect(decision.terminationReason).toBe('ITERATION_LIMIT');
  });

  it('adapts PARTIAL verdicts to the weakest failed check', () => {
    const reasoning = planner.decide({
      critic: critic('PARTIAL', [{ name: 'reasoning', severity: 'minor' }]),
      evidenceStates: ['SUFFICIENT_EVIDENCE'],
      usage: usage(1),
      maxIterations: 8,
      groundingRequired: true,
    });
    expect(reasoning.action).toBe('reason_deeper');

    const evidence = planner.decide({
      critic: critic('PARTIAL', [{ name: 'evidence', severity: 'minor' }]),
      evidenceStates: ['PARTIAL_EVIDENCE'],
      usage: usage(1),
      maxIterations: 8,
      groundingRequired: true,
    });
    expect(evidence.action).toBe('retrieve_more_evidence');

    const completion = planner.decide({
      critic: critic('PARTIAL', [{ name: 'completion', severity: 'minor' }]),
      evidenceStates: ['SUFFICIENT_EVIDENCE'],
      usage: usage(1),
      maxIterations: 8,
      groundingRequired: true,
    });
    expect(completion.action).toBe('fix_output');
  });
});

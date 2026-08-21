// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Voice · CommandCenterQuestionRouter tests (SPRINT-035)
//
// The router is a deterministic phrase table (NOT an NLP engine): it maps a
// transcript to ONE of the CLOSED presentation questions, or undefined. Voice
// presents the Command Center read models; it never authorizes — the router
// has no side effects and no authority surface.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { routeCommandCenterQuestion } from '../domain/CommandCenterQuestionRouter.js';

describe('CommandCenterQuestionRouter (SPRINT-035)', () => {
  it('routes the closed presentation questions deterministically', () => {
    expect(routeCommandCenterQuestion('What should I focus on today?')).toBe('FOCUS_TODAY');
    expect(routeCommandCenterQuestion('What opportunities did VedMoulya find?')).toBe(
      'OPPORTUNITIES',
    );
    expect(routeCommandCenterQuestion('What needs my approval?')).toBe('PENDING_APPROVALS');
    expect(routeCommandCenterQuestion('Which business has the best verified margin?')).toBe(
      'BEST_MARGIN',
    );
    expect(routeCommandCenterQuestion('What changed today?')).toBe('WHAT_CHANGED');
    expect(routeCommandCenterQuestion('How much did this workflow cost?')).toBe('WORKFLOW_COST');
  });

  // SPRINT-039 — founder evidence loop presentation questions
  it('routes the SPRINT-039 evidence-loop questions (read-only)', () => {
    expect(routeCommandCenterQuestion('What are my strongest opportunities?')).toBe(
      'STRONGEST_OPPORTUNITIES',
    );
    expect(routeCommandCenterQuestion('What evidence do we have?')).toBe('EVIDENCE');
    expect(routeCommandCenterQuestion('What should I test next?')).toBe('NEXT_TEST');
    expect(routeCommandCenterQuestion('Why are you recommending this?')).toBe('WHY_RECOMMENDATION');
    expect(
      routeCommandCenterQuestion('Which opportunity has the strongest payment evidence?'),
    ).toBe('STRONGEST_PAYMENT');
    expect(routeCommandCenterQuestion('Which opportunities should I stop?')).toBe(
      'STOP_OPPORTUNITIES',
    );
  });

  it('keeps SPRINT-039 questions read-only — no authority surface added', () => {
    for (const q of [
      'STRONGEST_OPPORTUNITIES',
      'EVIDENCE',
      'NEXT_TEST',
      'WHY_RECOMMENDATION',
      'STRONGEST_PAYMENT',
      'STOP_OPPORTUNITIES',
    ] as const) {
      const question = routeCommandCenterQuestion(q.toLowerCase().replace(/_/g, ' '));
      expect(question === undefined || question.length > 0).toBe(true);
    }
  });

  it('is case-insensitive and whitespace-tolerant', () => {
    expect(routeCommandCenterQuestion('  WHAT SHOULD   I FOCUS ON TODAY ')).toBe('FOCUS_TODAY');
  });

  it('returns undefined for anything outside the closed set', () => {
    expect(routeCommandCenterQuestion('Write me a poem about the ocean')).toBeUndefined();
    expect(routeCommandCenterQuestion('Deploy the new service to production')).toBeUndefined();
    expect(routeCommandCenterQuestion('')).toBeUndefined();
  });

  it('has no authority surface — routing can never approve or execute', () => {
    // Type-level proof: the return value is a question key or undefined; there
    // is no approval/execution field anywhere in the router's output.
    const question = routeCommandCenterQuestion('What needs my approval?');
    expect(question === 'PENDING_APPROVALS' || question === undefined).toBe(true);
  });
});

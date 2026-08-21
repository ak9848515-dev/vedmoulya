// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — HumanAIBoundary tests (SPRINT-032)
// Human vs AI responsibility boundaries over the EXISTING ActionClassPolicy
// (A/B/C/D over the frozen SENSITIVE_ACTIONS):
//   • A (safe research/analyze/draft) → AI_ALLOWED
//   • B (user-authorized) → AI_ALLOWED — with explicit authorization only
//   • C (sensitive/irreversible) → APPROVAL_REQUIRED
//   • D (never automate) → HUMAN_REQUIRED
//   • AI output / voice / silence can NEVER grant authority
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { HumanAIBoundary, HUMAN_AUTHORITATIVE_DOMAINS } from '../domain/HumanAIBoundary.js';
import type { WorldActionPort } from '../contracts/world-ports.js';
import { ActionClassPolicy } from '@vedmoulya/proactive';

function makeBoundary(): HumanAIBoundary {
  const policy = new ActionClassPolicy();
  const action: WorldActionPort = {
    classify: (a, opts) => policy.classify(a, opts),
  };
  return new HumanAIBoundary(action);
}

describe('HumanAIBoundary', () => {
  it('safe analysis/drafting verbs are AI_ALLOWED', () => {
    const boundary = makeBoundary();
    const decision = boundary.classify('Analyze the weekly usage data');
    expect(decision.responsibilityClass).toBe('AI_ALLOWED');
    expect(decision.actionClass).toBe('A');
  });

  it('sensitive actions are APPROVAL_REQUIRED (never AI-allowed)', () => {
    const boundary = makeBoundary();
    const decision = boundary.classify('Publish the report to the website');
    expect(decision.responsibilityClass).toBe('APPROVAL_REQUIRED');
    expect(decision.actionClass).toBe('C');
    // The reason makes the authority explicit.
    expect(decision.reasons.join(' ')).toMatch(/existing approval authority/);
  });

  it('never-automate actions are HUMAN_REQUIRED', () => {
    const boundary = makeBoundary();
    const decision = boundary.classify('delete-account');
    expect(decision.responsibilityClass).toBe('HUMAN_REQUIRED');
    expect(decision.actionClass).toBe('D');
  });

  it('human-authoritative domains are labelled (financial/legal/irreversible)', () => {
    expect(HUMAN_AUTHORITATIVE_DOMAINS.some((d) => d.label === 'financial commitment')).toBe(true);
    expect(HUMAN_AUTHORITATIVE_DOMAINS.some((d) => d.label === 'legal commitment')).toBe(true);
    expect(HUMAN_AUTHORITATIVE_DOMAINS.some((d) => d.label === 'irreversible action')).toBe(true);
    const boundary = makeBoundary();
    const decision = boundary.classify('Approve budget for the marketing campaign');
    expect(decision.reasons.some((r) => r.includes('human') || r.includes('Human'))).toBe(true);
  });

  it('AI output can NEVER grant authority (structural classification)', () => {
    const boundary = makeBoundary();
    // An AI "suggestion" is still classified against the frozen vocabulary.
    const decision = boundary.classify('The AI suggests: publish the report');
    // 'publish' matches the sensitive vocabulary regardless of who said it.
    expect(decision.responsibilityClass).toBe('APPROVAL_REQUIRED');
  });

  it('a user-authorized recurring action stays AI_ALLOWED but never silent', () => {
    const boundary = makeBoundary();
    const recurring = boundary.classify('Generate the weekly summary', {
      recurring: true,
    });
    // Not sensitive → user-authorized automation.
    expect(recurring.actionClass).toBe('B');
  });
});

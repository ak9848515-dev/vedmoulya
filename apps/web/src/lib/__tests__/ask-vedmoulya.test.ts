// ─────────────────────────────
// VedMoulya — Ask VedMoulya pure-logic tests (UX-08)
//
// Covers the parts of the Ask layer that must be provably correct and live
// outside the component: intent classification (Answer vs Action), real-context
// assembly (no fabrication), conversation-history projection, and mission-draft
// derivation from the person's own words.
// ─────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  classifyAskIntent,
  buildAskContext,
  askContextIsEmpty,
  conversationHistoryFor,
  missionDraftFromRequest,
  ASK_GREETING,
} from '../ask-vedmoulya.js';

describe('UX-08 classifyAskIntent (answer vs action)', () => {
  it('treats an ordinary question as an ANSWER', () => {
    expect(classifyAskIntent('What is SAP?')).toBe('answer');
    expect(classifyAskIntent('How is my career progressing?')).toBe('answer');
    expect(classifyAskIntent('What should I focus on today?')).toBe('answer');
    expect(classifyAskIntent('Teach me the basics of ABAP.')).toBe('answer');
  });

  it('treats an explicit mission/start request as an ACTION', () => {
    expect(classifyAskIntent('Create a mission to revise ABAP.')).toBe('action');
    expect(classifyAskIntent('Start a mission to learn Spanish.')).toBe('action');
    expect(classifyAskIntent('Make a mission for my career change.')).toBe('action');
  });

  it('never turns an empty request into an action', () => {
    expect(classifyAskIntent('')).toBe('answer');
    expect(classifyAskIntent('   ')).toBe('answer');
  });
});

describe('UX-08 missionDraftFromRequest', () => {
  it('derives the objective from the person’s own words', () => {
    const draft = missionDraftFromRequest('Create a mission to revise ABAP.');
    expect(draft).not.toBeNull();
    expect(draft?.objective).toBe('Create a mission to revise ABAP.');
    // The leading instruction scaffold is stripped from the TITLE only.
    expect(draft?.title).toBe('revise ABAP.');
  });

  it('returns null when there is nothing real to create', () => {
    expect(missionDraftFromRequest('')).toBeNull();
    expect(missionDraftFromRequest('  ')).toBeNull();
    expect(missionDraftFromRequest('a')).toBeNull();
  });

  it('caps the title but keeps the full objective', () => {
    const long = `Create a mission to ${'x'.repeat(500)}`;
    const draft = missionDraftFromRequest(long);
    expect(draft).not.toBeNull();
    expect((draft?.title ?? '').length).toBeLessThanOrEqual(200);
    expect((draft?.objective ?? '').length).toBeLessThanOrEqual(2000);
  });
});

describe('UX-08 buildAskContext (no fabricated context)', () => {
  it('returns nothing when the snapshot carries nothing', () => {
    const context = buildAskContext({});
    expect(askContextIsEmpty(context)).toBe(true);
    expect(context.identityContext).toBeUndefined();
    expect(context.memoryContext).toBeUndefined();
    expect(context.knowledgeContext).toBeUndefined();
  });

  it('does not invent an identity for the default placeholder name', () => {
    const context = buildAskContext({
      identity: {
        displayName: 'User',
        email: '',
        role: '',
        purpose: '',
        primaryGoal: '',
        currentJourney: '',
        greeting: '',
      },
    });
    expect(context.identityContext).toBeUndefined();
  });

  it('includes only the context fields that genuinely exist', () => {
    const context = buildAskContext({
      identity: {
        displayName: 'Anya',
        email: 'anya@vedmoulya.com',
        role: '',
        purpose: 'Build a sustainable livelihood',
        primaryGoal: 'Launch MVP',
        currentJourney: '',
        greeting: '',
      },
      memory: {
        totalMemories: 42,
        recentCount: 5,
        importantEvents: 2,
        aiObservations: ['Strong week'],
        reflectionPrompts: [],
      },
      aiContext: {
        currentFocus: 'MVP launch',
        recentActivity: ['Completed goal'],
        suggestedQuestions: [],
        contextSummary: 'Making progress.',
        topPriorities: [],
        crossDomainInsights: [],
      },
    });
    expect(context.identityContext).toContain('Anya');
    expect(context.identityContext).toContain('Build a sustainable livelihood');
    expect(context.memoryContext).toContain('42');
    expect(context.memoryContext).toContain('Strong week');
    expect(context.knowledgeContext).toContain('MVP launch');
    expect(askContextIsEmpty(context)).toBe(false);
  });

  it('omits memory context when there are no real memories', () => {
    const context = buildAskContext({
      memory: {
        totalMemories: 0,
        recentCount: 0,
        importantEvents: 0,
        aiObservations: [],
        reflectionPrompts: [],
      },
    });
    expect(context.memoryContext).toBeUndefined();
  });
});

describe('UX-08 conversationHistoryFor', () => {
  it('projects the visible conversation into runtime history', () => {
    const history = conversationHistoryFor([
      { role: 'ai', content: ASK_GREETING },
      { role: 'user', content: 'What is SAP?' },
    ]);
    expect(history).toEqual([
      { role: 'assistant', content: ASK_GREETING },
      { role: 'user', content: 'What is SAP?' },
    ]);
  });

  it('drops empty messages and never fabricates turns', () => {
    expect(conversationHistoryFor([{ role: 'ai', content: '   ' }])).toEqual([]);
    expect(conversationHistoryFor([])).toEqual([]);
  });
});

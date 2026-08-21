import { describe, it, expect } from 'vitest';
import { DailyBriefingAssembler } from '../domain/DailyBriefingAssembler.js';

const assembler = new DailyBriefingAssembler();

const base = {
  ownerId: 'u1',
  now: () => '2026-08-13T09:00:00.000Z',
  priorities: [],
  opportunities: [],
  events: [],
  risks: [],
};

describe('DailyBriefingAssembler', () => {
  it('produces NO briefing when nothing meaningful exists (no-spam)', () => {
    const b = assembler.assemble(base);
    expect(b.hasContent).toBe(false);
    expect(b.priorities).toEqual([]);
  });

  it('headlines today priorities when they exist', () => {
    const b = assembler.assemble({
      ...base,
      priorities: [{ title: 'Ship the report', urgency: 'high' }],
    });
    expect(b.hasContent).toBe(true);
    expect(b.priorities).toEqual(['Ship the report']);
    expect(b.recommendedAction).toBe('Ship the report');
  });

  it('surfaces an automation opportunity as the headline when no priorities exist', () => {
    const b = assembler.assemble({
      ...base,
      opportunities: [
        { category: 'automation', title: 'Automate report prep', evidence: ['x'], status: 'NEW' },
      ],
    });
    expect(b.hasContent).toBe(true);
    expect(b.automationOpportunity).toBe('Automate report prep');
    expect(b.recommendedAction).toMatch(/Automation opportunity/);
  });

  it('surfaces a revenue opportunity when no priorities or automation exist', () => {
    const b = assembler.assemble({
      ...base,
      opportunities: [
        { category: 'earning', title: 'Freelance video editing', evidence: ['x'], status: 'NEW' },
      ],
    });
    expect(b.hasContent).toBe(true);
    expect(b.revenueOpportunity).toBe('Freelance video editing');
  });

  it('surfaces a relevant AI world update when nothing else exists', () => {
    const b = assembler.assemble({
      ...base,
      events: [
        { kind: 'NEW_MODEL', title: 'A new local model dropped', relevance: 0.9 },
        { kind: 'NEW_FREE_API', title: 'Noise', relevance: 0.1 },
      ],
    });
    expect(b.hasContent).toBe(true);
    expect(b.aiWorldUpdate).toBe('A new local model dropped');
  });

  it('ignores dismissed opportunities', () => {
    const b = assembler.assemble({
      ...base,
      opportunities: [
        {
          category: 'automation',
          title: 'Automate report prep',
          evidence: ['x'],
          status: 'DISMISSED',
        },
      ],
    });
    expect(b.hasContent).toBe(false);
  });

  it('never stacks every section — one clear message', () => {
    const b = assembler.assemble({
      ...base,
      opportunities: [{ category: 'automation', title: 'A', evidence: ['x'], status: 'NEW' }],
      events: [{ kind: 'NEW_MODEL', title: 'B', relevance: 0.9 }],
    });
    // With no priorities the headline is the automation opportunity; the
    // event is not also stacked (single clear message).
    expect(b.automationOpportunity).toBe('A');
    expect(b.aiWorldUpdate).toBeUndefined();
  });
});

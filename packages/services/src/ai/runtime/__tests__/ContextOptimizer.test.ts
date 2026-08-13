import { describe, it, expect } from 'vitest';
import { ContextOptimizer } from '../ContextOptimizer.js';

describe('ContextOptimizer', () => {
  it('measures every stage and produces a final token count', () => {
    const optimizer = new ContextOptimizer();
    const { result, optimizedSections } = optimizer.optimize({
      capability: 'reasoning',
      userInput: 'Summarize the onboarding workflow',
      systemPrompt: 'You are a helpful assistant.',
      sections: [
        {
          source: 'knowledge_base',
          category: 'knowledge',
          content: [
            'The content agency onboards clients through lead capture, brand definition, and project scoping.',
            'Brand guidelines are stable context reused across generation runs.',
            'AI content is reviewed by a human account manager before delivery.',
            'Invoices are raised automatically on delivery of approved content.',
          ].join('\n'),
        },
      ],
    });

    expect(result.originalTokens).toBeGreaterThan(0);
    expect(result.stages.map((s) => s.stage)).toEqual([
      'raw',
      'ranked',
      'filtered',
      'compressed',
      'final',
    ]);
    // Optimization never grows the context content
    expect(result.compressedTokens).toBeLessThanOrEqual(result.originalTokens);
    expect(result.filteredTokens).toBeLessThanOrEqual(result.rankedTokens);
    expect(optimizedSections.length).toBeGreaterThan(0);
    // The reassembled section keeps the surviving items
    expect(optimizedSections[0].content).toContain('onboards');
  });

  it('flags a budget breach when context cannot fit after compression', () => {
    const optimizer = new ContextOptimizer();
    const longContext = Array.from(
      { length: 24 },
      (_, i) =>
        `Workflow context item number ${i}: the enterprise onboarding pipeline requires human review of every generated draft before client delivery.`,
    ).join('\n');
    const { result } = optimizer.optimize({
      capability: 'reasoning',
      userInput: 'Analyze the workflow context',
      sections: [{ source: 'knowledge_base', category: 'knowledge', content: longContext }],
      maxInputTokens: 40,
    });
    // The content is large and relevant, so it survives filtering and cannot
    // fit within a 40-token budget even after compression.
    expect(result.originalTokens).toBeGreaterThan(400);
    expect(result.budgetBreached).toBe(true);
  });

  it('respects a generous budget without breaching', () => {
    const optimizer = new ContextOptimizer();
    const { result } = optimizer.optimize({
      capability: 'reasoning',
      userInput: 'Analyze this',
      sections: [
        {
          source: 'knowledge_base',
          category: 'knowledge',
          content: 'Short relevant context about onboarding workflows.',
        },
      ],
      maxInputTokens: 5000,
    });
    expect(result.budgetBreached).toBe(false);
  });

  it('returns no sections when the context is empty', () => {
    const optimizer = new ContextOptimizer();
    const { result, optimizedSections } = optimizer.optimize({
      capability: 'reasoning',
      userInput: 'hello',
      sections: [],
    });
    expect(optimizedSections).toEqual([]);
    expect(result.originalTokens).toBe(0);
    expect(result.finalTokens).toBeGreaterThan(0); // user input still counted
  });

  it('explains why each context item was selected or excluded (AI-SELECT)', () => {
    const optimizer = new ContextOptimizer();
    const { selection } = optimizer.optimize({
      capability: 'reasoning',
      userInput: 'Analyze the client onboarding workflow',
      systemPrompt: 'You are a helpful assistant.',
      // Duplicate lines trigger EI-003 deduplication, forcing an exclusion
      // that the selection explanation must record with a reason.
      sections: [
        {
          source: 'knowledge_base',
          category: 'knowledge',
          content: [
            'The content agency onboards clients through lead capture, brand definition, and project scoping.',
            'The content agency onboards clients through lead capture, brand definition, and project scoping.',
          ].join('\n'),
        },
      ],
    });

    expect(selection.length).toBe(2);
    const selected = selection.filter((s) => s.selected);
    const excluded = selection.filter((s) => !s.selected);
    expect(selected.length).toBeGreaterThan(0);
    expect(selected[0]?.reasons.length).toBeGreaterThan(0);
    expect(selected[0]?.tokens).toBeGreaterThan(0);
    // The deduplicated duplicate is excluded with an explainable reason.
    expect(excluded.length).toBeGreaterThan(0);
    for (const item of excluded) {
      expect(item.reasons[0]).toMatch(/excluded/);
    }
  });

  it('preserves section source/category labels in the optimized output', () => {
    const optimizer = new ContextOptimizer();
    const { optimizedSections } = optimizer.optimize({
      capability: 'content_generation',
      userInput: 'Write a newsletter',
      sections: [
        {
          source: 'business_rules',
          category: 'business',
          content: 'Newsletter brand voice is professional and friendly.',
        },
        {
          source: 'knowledge_base',
          category: 'knowledge',
          content: 'Newsletters are reviewed by the account manager before sending.',
        },
      ],
    });
    // Both sections are on-topic for the newsletter request, so both survive
    // with their source/category labels intact.
    expect(optimizedSections.map((s) => s.category)).toContain('knowledge');
    expect(optimizedSections.map((s) => s.category)).toContain('business');
  });
});

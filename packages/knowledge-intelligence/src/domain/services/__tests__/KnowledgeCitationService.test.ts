// ──────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Citation tests
// EI-009 — Enterprise Knowledge Intelligence Platform
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { KnowledgeCitationService } from '../KnowledgeCitationService.js';
import type { KnowledgeItem } from '../../../types/knowledge-types.js';
import { createCatalogKnowledgeItems } from '../../../catalog/knowledge-catalog.js';

function item(overrides: Partial<KnowledgeItem> = {}): KnowledgeItem {
  return { ...createCatalogKnowledgeItems()[0], ...overrides };
}

describe('KnowledgeCitationService', () => {
  const service = new KnowledgeCitationService();

  it('extracts URLs from the description', () => {
    const extracted = service.extractCitations(
      item({
        description:
          'See https://docs.example.com/providers/openai for details and https://docs.example.com/providers/anthropic for the alternative.',
      }),
    );
    const urls = extracted.filter((c) => c.sourceType === 'document');
    expect(urls.length).toBe(2);
    expect(urls[0]?.sourceId).toBe('https://docs.example.com/providers/openai');
  });

  it('extracts "source:" reference lines', () => {
    const extracted = service.extractCitations(
      item({
        description:
          'Facts about pricing.\nsource: provider-cost-2026-08.csv\nMore facts.\nref: internal-memo-3',
      }),
    );
    expect(extracted.length).toBeGreaterThanOrEqual(2);
    expect(extracted.some((c) => c.reference.includes('provider-cost-2026-08'))).toBe(true);
  });

  it('returns no citations when nothing is referenced', () => {
    expect(
      service.extractCitations(item({ description: 'Plain prose with no references or urls.' }))
        .length,
    ).toBe(0);
  });

  it('auto-verifies citations for intrinsically reliable source types', () => {
    const verified = service.verify(
      [
        {
          citationId: 'c1',
          sourceId: 's',
          sourceTitle: 'S',
          sourceType: 'document',
          reference: 'r',
          retrievedAt: new Date().toISOString(),
          verified: false,
        },
      ],
      'repository',
    );
    expect(verified[0]?.verified).toBe(true);
  });

  it('keeps manual/conversation citations unverified (human review required)', () => {
    const unverified = service.verify(
      [
        {
          citationId: 'c1',
          sourceId: 's',
          sourceTitle: 'S',
          sourceType: 'manual',
          reference: 'r',
          retrievedAt: new Date().toISOString(),
          verified: false,
        },
      ],
      'manual',
    );
    expect(unverified[0]?.verified).toBe(false);
  });

  it('preserves existing verified flags', () => {
    const result = service.verify(
      [
        {
          citationId: 'c1',
          sourceId: 's',
          sourceTitle: 'S',
          sourceType: 'conversation',
          reference: 'r',
          retrievedAt: new Date().toISOString(),
          verified: true,
        },
      ],
      'conversation',
    );
    expect(result[0]?.verified).toBe(true);
  });

  it('attaches a citation set to an item', () => {
    const citations = service.extractCitations(item({ description: 'source: brand-guide.pdf' }));
    const attached = service.attach(item(), citations);
    expect(attached.citations.length).toBe(citations.length);
  });
});

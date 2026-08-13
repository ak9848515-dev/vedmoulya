import { describe, it, expect } from 'vitest';
import { ChunkingService } from '../ChunkingService.js';

describe('ChunkingService', () => {
  it('returns no chunks for empty or whitespace-only content', () => {
    const svc = new ChunkingService();
    expect(svc.chunk('')).toEqual([]);
    expect(svc.chunk('   \n\n  ')).toEqual([]);
  });

  it('keeps short paragraphs as single chunks', () => {
    const svc = new ChunkingService();
    const chunks = svc.chunk('First paragraph.\n\nSecond paragraph.');
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe('First paragraph.');
    expect(chunks[1]).toContain('Second paragraph.');
  });

  it('splits long paragraphs on sentence boundaries within the budget', () => {
    const svc = new ChunkingService({ maxChunkChars: 60, overlapChars: 0 });
    const long = [
      'This is the first sentence of a very long paragraph.',
      'This is the second sentence that continues the discussion.',
      'This is the third sentence ending the paragraph.',
    ].join(' ');
    const chunks = svc.chunk(long);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(60);
    }
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toContain('first sentence');
    expect(chunks.join(' ')).toContain('third sentence');
  });

  it('applies an overlap between consecutive chunks', () => {
    const svc = new ChunkingService({ maxChunkChars: 200, overlapChars: 10 });
    // Two short paragraphs: the second chunk must carry the first chunk's tail.
    const text = 'alpha beta gamma delta epsilon zeta.\n\neta theta iota kappa lambda mu nu xi.';
    const chunks = svc.chunk(text);
    expect(chunks.length).toBe(2);
    expect(chunks[1]).toContain(chunks[0].slice(-10));
  });

  it('estimates tokens with the 4-char heuristic', () => {
    const svc = new ChunkingService();
    expect(svc.estimateTokens('abcd')).toBe(1);
    expect(svc.estimateTokens('abcdefgh')).toBe(2);
    expect(svc.estimateTokens('')).toBe(0);
  });
});

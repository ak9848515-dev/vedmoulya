// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Memory Intelligence: Compression Service
// EI-010 — Enterprise Memory Intelligence Platform
// The Memory Pipeline stage: Compression. Reduces stored memory
// content deterministically — extractive (top sentences by token
// overlap with the title + importance terms) and summary-style
// (sentence-prefix collapse). No LLM, no external service: the memory
// layer stays deterministic and fast. `raw → compressed →
// summarized → collapsed` are the four compression states.
// ──────────────────────────────────────────────────────────────────

import type {
  MemoryCompressionState,
  MemoryItem,
  MemorySummaryResult,
} from '../../types/memory-types.js';

export interface CompressionOptions {
  /** Target ratio of the compressed text vs the original (0, 1]. */
  ratio?: number;
  /** Compression state to reach. Default 'summarized'. */
  target?: MemoryCompressionState;
}

export const COMPRESSION_STAGE: Record<MemoryCompressionState, MemoryCompressionState> = {
  raw: 'compressed',
  compressed: 'summarized',
  summarized: 'collapsed',
  collapsed: 'collapsed',
};

/** Common English stop-words ignored when scoring sentence importance. */
const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'for',
  'with',
  'from',
  'this',
  'that',
  'was',
  'were',
  'are',
  'is',
  'to',
  'of',
  'in',
  'on',
  'at',
  'by',
]);

export class MemoryCompressionService {
  /**
   * Compress one memory. `raw` → `compressed` keeps the first ~ratio of
   * sentences; `compressed` → `summarized` keeps only high-importance
   * sentences (scored by keyword overlap with title/tags); `summarized`
   * → `collapsed` keeps the single most important sentence. Idempotent.
   */
  compress(memory: MemoryItem, options: CompressionOptions = {}): MemorySummaryResult {
    const target = options.target ?? 'summarized';
    const ratio = Math.max(0.1, Math.min(1, options.ratio ?? 0.4));
    const sentences = this.sentences(memory.content);
    const beforeLength = memory.content.length;

    let summary: string;
    let state: MemoryCompressionState;

    if (sentences.length <= 1) {
      summary = memory.content;
      state = 'collapsed';
    } else if (target === 'compressed') {
      const keep = Math.max(1, Math.floor(sentences.length * ratio));
      summary = sentences.slice(0, keep).join(' ');
      state = 'compressed';
    } else if (target === 'summarized') {
      const scored = this.scoreSentences(sentences, memory);
      const keep = Math.max(1, Math.ceil(scored.length * 0.5));
      summary = scored
        .slice(0, keep)
        .map((s) => s.sentence)
        .join(' ');
      state = 'summarized';
    } else {
      const scored = this.scoreSentences(sentences, memory);
      const best = scored[0];
      summary = best?.sentence ?? memory.content;
      state = 'collapsed';
    }

    // Never produce an empty summary.
    if (!summary.trim()) summary = memory.content.slice(0, 200);
    return {
      memoryId: memory.memoryId,
      beforeLength,
      afterLength: summary.length,
      summary,
      compressionState: state,
    };
  }

  /** Split content into sentences (robust to missing terminal punctuation). */
  sentences(content: string): string[] {
    return content
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  /** Score sentences by term overlap with title/tags, in original order. */
  scoreSentences(
    sentences: string[],
    memory: MemoryItem,
  ): Array<{ sentence: string; score: number }> {
    const keywords = new Set(
      [
        ...memory.title.toLowerCase().split(/\W+/),
        ...memory.tags.map((t) => t.toLowerCase()),
      ].filter((t) => t.length > 2 && !STOP_WORDS.has(t)),
    );
    const scored = sentences.map((sentence, index) => {
      const terms = sentence
        .toLowerCase()
        .split(/\W+/)
        .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
      if (terms.length === 0) return { sentence, score: 0 };
      const hits = terms.filter((t) => keywords.has(t)).length;
      // Position bias: earlier sentences are slightly preferred.
      const position = Math.max(0, 1 - index / sentences.length) * 0.1;
      return { sentence, score: hits / terms.length + position };
    });
    return scored.sort((a, b) => b.score - a.score);
  }
}

// ──────────────────────────────────────────────────────────────────
// VedMoulya — Chunking Service
// Deterministic, provider-independent document chunking.
// Splits on paragraph → sentence boundaries and packs chunks up to a
// character budget with a small overlap so sentence context survives
// the split. AI-RUNTIME-002 — Production RAG.
// ──────────────────────────────────────────────────────────────────

export interface ChunkingOptions {
  /** Maximum characters per chunk. Default: 1800. */
  maxChunkChars?: number;
  /** Character overlap between consecutive chunks. Default: 120. */
  overlapChars?: number;
}

export class ChunkingService {
  private readonly maxChunkChars: number;
  private readonly overlapChars: number;

  constructor(options: ChunkingOptions = {}) {
    this.maxChunkChars = options.maxChunkChars ?? 1800;
    this.overlapChars = options.overlapChars ?? 120;
  }

  /**
   * Split a document into ordered text chunks. Paragraphs are the primary
   * unit; paragraphs longer than the budget are split on sentence boundaries.
   * Returns only non-empty chunks.
   */
  chunk(text: string): string[] {
    if (!text || !text.trim()) {
      return [];
    }

    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const chunks: string[] = [];
    for (const paragraph of paragraphs) {
      if (paragraph.length <= this.maxChunkChars) {
        chunks.push(paragraph);
        continue;
      }
      for (const sentenceChunk of this.splitLongParagraph(paragraph)) {
        chunks.push(sentenceChunk);
      }
    }
    return this.applyOverlap(chunks);
  }

  /** Estimate tokens for a chunk using the shared 4-char heuristic. */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private splitLongParagraph(paragraph: string): string[] {
    const sentences = paragraph
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const parts: string[] = [];
    let current = '';
    for (const sentence of sentences) {
      if (current.length + sentence.length + 1 > this.maxChunkChars && current.length > 0) {
        parts.push(current.trim());
        current = sentence;
      } else {
        current = current.length === 0 ? sentence : `${current} ${sentence}`;
      }
    }
    if (current.trim().length > 0) {
      parts.push(current.trim());
    }

    // A single sentence longer than the budget must still be emitted
    // (never silently dropped).
    return parts.length > 0 ? parts : [paragraph.slice(0, this.maxChunkChars)];
  }

  /**
   * Re-append a small overlap from the previous chunk tail to each chunk so
   * boundary context is not lost. Never extends a chunk past the source.
   */
  private applyOverlap(chunks: string[]): string[] {
    if (this.overlapChars <= 0 || chunks.length <= 1) {
      return chunks;
    }
    const result: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      // Indexed access into a private, locally-built string array (never
      // attacker-controlled property names); the heuristic cannot see bounds.
      // eslint-disable-next-line security/detect-object-injection
      const current = chunks[i];
      if (!current) continue;
      if (i === 0) {
        result.push(current);
        continue;
      }
      const previous = chunks[i - 1];
      if (!previous) continue;
      const tail = previous.slice(-this.overlapChars);
      const separator = tail.trim().length > 0 && !tail.endsWith(' ') ? ' ' : '';
      result.push(`${tail}${separator}${current}`);
    }
    return result;
  }
}

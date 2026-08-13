// ──────────────────────────────────────────────────────────────────
// VedMoulya — OpenAI Embedding Provider (Vercel AI SDK)
// Production embedding implementation for the RAG pipeline
// (AI-RUNTIME-002): calls text-embedding-3-small through the Vercel
// AI SDK `embedMany`, guarded by a hard timeout. The RAG application
// service only depends on the EmbeddingProvider port, so this adapter
// can be swapped without touching domain/application contracts.
// ──────────────────────────────────────────────────────────────────

import { embedMany } from 'ai';
import { openai } from '@ai-sdk/openai';
import type { EmbeddingProvider } from '@vedmoulya/rag';

export interface OpenAIEmbeddingProviderOptions {
  /** Embedding model id. Default: text-embedding-3-small. */
  modelId?: string;
  /** Hard timeout for embedding calls. Default: 30s. */
  timeoutMs?: number;
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly dimension = 1536;
  readonly model: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(apiKey: string, options: OpenAIEmbeddingProviderOptions = {}) {
    this.apiKey = apiKey;
    this.model = options.modelId ?? 'text-embedding-3-small';
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async embed(texts: readonly string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const result = await embedMany({
        model: openai.embedding(this.model),
        values: [...texts],
        abortSignal: controller.signal,
      });
      return result.embeddings.map((embedding) => [...embedding]);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Embedding request timed out after ${this.timeoutMs}ms`);
      }
      const candidate = error as { statusCode?: number };
      if (typeof candidate.statusCode === 'number' && candidate.statusCode === 429) {
        throw new Error('Embedding API rate limited (429)');
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(String(error));
    } finally {
      clearTimeout(timer);
    }
  }
}

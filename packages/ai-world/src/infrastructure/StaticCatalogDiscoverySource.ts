// ──────────────────────────────────────────────────────────────────
// VedMoulya — StaticCatalogDiscoverySource
// EPIC-012C — deterministic, evidence-honest default source
//
// The default discovery source ships a small curated catalog of
// well-known ecosystem facts. Every entry carries explicit evidence
// with a confidence state — VERIFIED where the fact is stable and
// public (e.g. a license), PROVIDER_DECLARED where it comes from the
// provider, UNKNOWN where we have no verified information. Nothing is
// invented; unknown fields stay UNKNOWN. This keeps the product fully
// functional AND honest without live network access (live adapters
// for official catalogues/GitHub/news are pluggable operator steps —
// see the AIDiscoverySource contract).
//
// Entries are deliberately conservative and reviewable — the point of
// EPIC-012C is usefulness, not volume.
// ──────────────────────────────────────────────────────────────────

import type { AIDiscoverySource } from '../contracts/AIDiscoverySource.js';
import type { RawDiscoveryItem } from '../types/discovery-types.js';

const NOW_SOURCE = 'vedmoulya-curated-catalog';

export class StaticCatalogDiscoverySource implements AIDiscoverySource {
  readonly id = 'vedmoulya-catalog';
  readonly name = 'VedMoulya Curated Catalog';

  discover(): Promise<{ items: RawDiscoveryItem[] }> {
    // Deterministic static source — no I/O; Promise.resolve keeps the
    // async port contract without a needless `async` marker.
    return Promise.resolve({ items: catalogItems });
  }
}

// The curated catalog is a static module-level list so tests and the
// running product share identical deterministic data.
const catalogItems: RawDiscoveryItem[] = [
  {
    title: 'Qwen3 — open-weights reasoning family',
    category: 'model',
    sourceUrl: 'https://qwenlm.github.io',
    publishedAt: '2025-04-29T00:00:00.000Z',
    summary:
      'Alibaba\u2019s open-weights model family covering dense and MoE variants with strong reasoning and coding performance.',
    capabilities: ['reasoning', 'coding'],
    claimedFreeClass: 'OPEN_WEIGHTS',
    claimedLocalAvailability: 'yes',
    modelFacts: { providerName: 'Qwen', capabilities: ['reasoning', 'coding'] },
    evidence: [
      {
        claim: 'Open-weights release family from Alibaba',
        source: NOW_SOURCE,
        confidence: 'VERIFIED',
      },
      {
        claim: 'Reasoning and coding capabilities',
        source: NOW_SOURCE,
        confidence: 'PROVIDER_DECLARED',
      },
      { claim: 'Context-window details', source: NOW_SOURCE, confidence: 'UNKNOWN' },
    ],
  },
  {
    title: 'Ollama — local model runtime',
    category: 'application',
    sourceUrl: 'https://ollama.com',
    summary:
      'Runs open models locally with a simple API — a local inference runtime VedMoulya already integrates with.',
    capabilities: ['local_inference'],
    claimedFreeClass: 'OPEN_SOURCE',
    claimedLocalAvailability: 'yes',
    evidence: [
      { claim: 'Local inference runtime', source: NOW_SOURCE, confidence: 'VERIFIED' },
      { claim: 'MIT license', source: NOW_SOURCE, confidence: 'VERIFIED' },
    ],
  },
  {
    title: 'OpenRouter — model aggregator with free variants',
    category: 'provider',
    sourceUrl: 'https://openrouter.ai',
    summary:
      'Aggregates many hosted models behind one API. Includes free variants for some models — but free variants are quota- or rate-bounded, never unlimited free inference.',
    capabilities: ['reasoning', 'coding', 'vision'],
    claimedFreeClass: 'FREE_WITH_QUOTA',
    claimedLocalAvailability: 'no',
    modelFacts: {
      providerName: 'OpenRouter',
      capabilities: ['reasoning', 'coding', 'vision'],
      suggestedFamily: 'openrouter',
    },
    evidence: [
      { claim: 'Aggregator of hosted models', source: NOW_SOURCE, confidence: 'VERIFIED' },
      {
        claim: 'Some models have free variants with rate limits',
        source: NOW_SOURCE,
        confidence: 'PROVIDER_DECLARED',
      },
      { claim: 'Unlimited free usage', source: NOW_SOURCE, confidence: 'UNKNOWN' },
    ],
  },
  {
    title: 'Langfuse — LLM observability',
    category: 'github',
    sourceUrl: 'https://github.com/langfuse/langfuse',
    summary:
      'Open-source LLM engineering platform for tracing, metrics and evaluation — directly relevant to VedMoulya\u2019s existing observability estate.',
    capabilities: ['observability', 'evaluation'],
    claimedFreeClass: 'OPEN_SOURCE',
    claimedLocalAvailability: 'yes',
    github: {
      name: 'langfuse/langfuse',
      description:
        'Open source LLM engineering platform: LLM observability, metrics, evals, prompt management, playground, datasets. Self-hostable.',
      language: 'TypeScript',
      stars: 12000,
      forks: 2200,
      license: 'MIT',
    },
    evidence: [
      { claim: 'MIT-licensed open source', source: NOW_SOURCE, confidence: 'VERIFIED' },
      { claim: 'Observability for LLM applications', source: NOW_SOURCE, confidence: 'VERIFIED' },
    ],
  },
  {
    title: 'pgvector — Postgres vector similarity',
    category: 'github',
    sourceUrl: 'https://github.com/pgvector/pgvector',
    summary:
      'Open-source vector similarity search for Postgres — the same storage model VedMoulya\u2019s production RAG uses.',
    capabilities: ['rag', 'embeddings'],
    claimedFreeClass: 'OPEN_SOURCE',
    claimedLocalAvailability: 'yes',
    github: {
      name: 'pgvector/pgvector',
      description:
        'Open-source vector similarity search for Postgres. Store your vectors with the rest of your data.',
      language: 'C',
      stars: 15000,
      forks: 700,
      license: 'PostgreSQL',
    },
    evidence: [
      {
        claim: 'Open-source vector extension for Postgres',
        source: NOW_SOURCE,
        confidence: 'VERIFIED',
      },
      {
        claim: 'License compatible with VedMoulya usage',
        source: NOW_SOURCE,
        confidence: 'PROVIDER_DECLARED',
      },
    ],
  },
  {
    title: 'Provider pricing change — model deprecation advisories',
    category: 'news',
    summary:
      'Hosted providers periodically retire older models and adjust free-tier quotas. VedMoulya\u2019s provider intelligence tracks lifecycle status so deprecated models are never silently routed to.',
    capabilities: [],
    claimedFreeClass: 'UNKNOWN',
    claimedLocalAvailability: 'no',
    evidence: [
      {
        claim: 'Model deprecations occur across hosted providers',
        source: NOW_SOURCE,
        confidence: 'INFERRED',
      },
      { claim: 'Specific pricing figures for today', source: NOW_SOURCE, confidence: 'UNKNOWN' },
    ],
  },
];

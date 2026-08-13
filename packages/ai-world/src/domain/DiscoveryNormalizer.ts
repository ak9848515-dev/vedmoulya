// ──────────────────────────────────────────────────────────────────
// VedMoulya — DiscoveryNormalizer
// EPIC-012C — raw source → canonical DiscoveryItem
//
// Normalization pipeline per item:
//   SECURITY SCAN → FREE/LOCAL CLASSIFY → GITHUB INTELLIGENCE →
//   RELEVANCE SCORE → RECOMMENDATION → STABLE ID
// Every derived field is computed here with provenance — the source
// only supplies raw facts (see AIDiscoverySource contract).
// ──────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';
import type {
  DiscoveryEvidence,
  DiscoveryItem,
  RawDiscoveryItem,
} from '../types/discovery-types.js';
import { SecurityScanner } from './SecurityScanner.js';
import { FreeResourceClassifier } from './FreeResourceClassifier.js';
import { GitHubRepositoryIntelligenceEngine } from './GitHubRepositoryIntelligence.js';
import { RelevanceScorer } from './RelevanceScorer.js';
import { RecommendationEngine } from './RecommendationEngine.js';

export interface NormalizerContext {
  source: string;
  now: () => Date;
  vedMoulyaCapabilities?: string[];
}

export class DiscoveryNormalizer {
  private readonly security: SecurityScanner;
  private readonly freeClassifier: FreeResourceClassifier;
  private readonly githubEngine: GitHubRepositoryIntelligenceEngine;
  private readonly relevance: RelevanceScorer;
  private readonly recommendation: RecommendationEngine;

  constructor(vedMoulyaCapabilities?: string[]) {
    this.security = new SecurityScanner();
    this.freeClassifier = new FreeResourceClassifier();
    this.githubEngine = new GitHubRepositoryIntelligenceEngine();
    this.relevance = new RelevanceScorer(vedMoulyaCapabilities);
    this.recommendation = new RecommendationEngine();
  }

  normalize(raw: RawDiscoveryItem, context: NormalizerContext): DiscoveryItem {
    const now = context.now();

    // ── Security first (untrusted input) ───────────────────────────────
    const security = this.security.scan(raw);

    // ── Free / local classification (evidence-first) ───────────────────
    const resource = this.freeClassifier.classify(raw);

    // ── GitHub intelligence ────────────────────────────────────────────
    let github: DiscoveryItem['github'];
    if (raw.github) {
      github = this.githubEngine.analyze(
        {
          name: raw.github.name,
          description: raw.github.description,
          language: raw.github.language,
          stars: raw.github.stars,
          forks: raw.github.forks,
          lastCommitAt: raw.github.lastCommitAt,
          license: raw.github.license,
        },
        context.now,
      );
    }

    // ── Relevance (quality over volume) ────────────────────────────────
    const relevance = this.relevance.score(raw, { now: context.now });

    // ── Aggregate confidence from evidence ─────────────────────────────
    const confidence = this.aggregateConfidence(raw.evidence ?? []);

    // ── Assemble the item (recommendation computed from the item) ──────
    const partial: DiscoveryItem = {
      id: '', // set below
      title: raw.title,
      category: raw.category,
      source: context.source,
      sourceUrl: raw.sourceUrl,
      discoveredAt: now.toISOString(),
      publishedAt: raw.publishedAt,
      summary: raw.summary,
      capabilities: raw.capabilities ?? [],
      freeClass: resource.freeClass,
      localAvailability: resource.localAvailability,
      relevance: relevance.score,
      relevanceLabel: relevance.label,
      relevanceReasons: relevance.reasons,
      confidence,
      evidence: (raw.evidence ?? []).map((e) => ({
        claim: e.claim,
        source: e.source,
        sourceUrl: e.sourceUrl,
        confidence: e.confidence,
        retrievedAt: e.retrievedAt ?? now.toISOString(),
      })),
      recommendation: 'WATCH',
      recommendationReasons: [],
      modelFacts: raw.modelFacts
        ? {
            providerName: raw.modelFacts.providerName,
            modelId: raw.modelFacts.modelId,
            capabilities: raw.modelFacts.capabilities,
            contextWindow: raw.modelFacts.contextWindow,
            // Configurability is EVIDENCE-GATED: a source-declared family
            // without evidence is a poisoning vector (a malicious source could
            // claim a family to inflate the score and reach CONFIGURE). The
            // curated catalog entries that legitimately map to the registry
            // carry evidence, so this never weakens the real flow.
            configurable:
              Boolean(raw.modelFacts.suggestedFamily) && (raw.evidence?.length ?? 0) > 0,
            suggestedFamily: raw.modelFacts.suggestedFamily,
          }
        : undefined,
      github,
      securityFlags: security.flags,
      raw: true,
    };

    const recommendation = this.recommendation.recommend(partial);
    partial.recommendation = recommendation.state;
    partial.recommendationReasons = recommendation.reasons;

    // ── Stable id: source + url/title hash — survives re-runs ──────────
    partial.id = this.stableId(context.source, raw);

    return partial;
  }

  /** Stable id derived from source + canonical key (url else title). */
  stableId(source: string, raw: RawDiscoveryItem): string {
    const key = raw.sourceUrl ?? `${raw.category}:${raw.title}`;
    return createHash('sha256').update(`${source}|${key}`).digest('hex').slice(0, 24);
  }

  private aggregateConfidence(
    evidence: Array<Pick<DiscoveryEvidence, 'confidence'>>,
  ): DiscoveryItem['confidence'] {
    if (evidence.length === 0) return 'UNKNOWN';
    if (evidence.some((e) => e.confidence === 'VERIFIED')) return 'VERIFIED';
    if (evidence.some((e) => e.confidence === 'MEASURED' || e.confidence === 'PROVIDER_DECLARED')) {
      return 'PROVIDER_DECLARED';
    }
    if (evidence.every((e) => e.confidence === 'UNKNOWN')) return 'UNKNOWN';
    return 'INFERRED';
  }
}

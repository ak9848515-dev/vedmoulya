// ──────────────────────────────────────────────────────────────────
// VedMoulya — RecommendationEngine
// EPIC-012C — IGNORE / WATCH / REVIEW / TRY / CONFIGURE / INTEGRATE
//
// Recommendation order: QUALITY → CAPABILITY → EVIDENCE → USABILITY →
// FREE/LOCAL → COST. FREE is never the reason something is
// recommended — a free model that cannot satisfy the task is not
// eligible (same rule as the provider routing layer).
// ──────────────────────────────────────────────────────────────────

import type { DiscoveryItem, RecommendationState } from '../types/discovery-types.js';

export interface Recommendation {
  state: RecommendationState;
  reasons: string[];
}

export class RecommendationEngine {
  recommend(item: DiscoveryItem): Recommendation {
    const reasons: string[] = [];
    const state = this.decide(item, reasons);
    return { state, reasons };
  }

  private decide(item: DiscoveryItem, reasons: string[]): RecommendationState {
    // ── Security: flags hard-block auto-actionability ──────────────────
    if (
      item.securityFlags.includes('prompt_injection') ||
      item.securityFlags.includes('malicious_link')
    ) {
      reasons.push('Security scanner flagged untrusted content — never auto-configure or execute.');
      return 'IGNORE';
    }
    if (item.securityFlags.includes('unsafe_instructions')) {
      reasons.push('Unsafe-instruction patterns detected — watch only, never follow.');
      return 'WATCH';
    }

    // ── Quality first: low relevance is never rescued by free/local ────
    if (item.relevanceLabel === 'low') {
      reasons.push('Low VedMoulya relevance — not worth attention right now.');
      return 'IGNORE';
    }
    if (item.relevanceLabel === 'medium') {
      reasons.push('Moderate relevance — monitor for changes.');
      return 'WATCH';
    }

    // ── High relevance (the only remaining label): pick the strongest
    //    actionable state ────────────────────────────────────────────────
    // Model / provider that VedMoulya can configure today.
    if (
      (item.category === 'model' || item.category === 'provider') &&
      item.modelFacts?.configurable
    ) {
      reasons.push(
        `Configurable as a VedMoulya ${item.modelFacts.providerName ?? 'provider'} — links into the existing provider configuration.`,
      );
      return 'CONFIGURE';
    }
    // GitHub repo with good quality + permissive license.
    if (item.category === 'github' && item.github) {
      const gh = item.github;
      if (
        gh.flags.includes('unclear_license') ||
        gh.flags.includes('suspicious') ||
        gh.flags.includes('security_concerns')
      ) {
        reasons.push('Repository carries caution flags — evaluate before any adoption.');
        return 'REVIEW';
      }
      if (gh.flags.includes('abandoned') || gh.flags.includes('inactive_development')) {
        reasons.push('Repository shows inactive development — treat as experimental.');
        return 'REVIEW';
      }
      reasons.push(
        'High-quality, evidence-backed repository with a clear license — worth evaluating.',
      );
      return 'TRY';
    }
    // News with strategic impact.
    if (item.category === 'news') {
      reasons.push('Strategic ecosystem change — review the impact on provider economics.');
      return 'REVIEW';
    }
    // Application / model without config link.
    if (item.category === 'application') {
      reasons.push('Useful application — evaluate for integration potential.');
      return 'TRY';
    }
    reasons.push('High relevance — worth a hands-on evaluation.');
    return 'TRY';
  }
}

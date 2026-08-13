// ──────────────────────────────────────────────────────────────────
// VedMoulya — RecommendationEngine tests
// EPIC-012C — IGNORE / WATCH / REVIEW / TRY / CONFIGURE / INTEGRATE (§7)
//
// Recommendation order: QUALITY → CAPABILITY → EVIDENCE → USABILITY →
// FREE/LOCAL → COST. FREE never makes something recommended — a free
// model that cannot satisfy the task is not eligible.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { RecommendationEngine } from '../domain/RecommendationEngine.js';
import { item } from './fixtures.js';

const engine = new RecommendationEngine();

describe('RecommendationEngine — recommendation states', () => {
  it('hard-blocks auto-actionability on prompt injection (IGNORE)', () => {
    const result = engine.recommend(
      item({ securityFlags: ['prompt_injection'], relevanceLabel: 'high' }),
    );
    expect(result.state).toBe('IGNORE');
    expect(result.reasons[0]).toContain('Security scanner');
  });

  it('downgrades unsafe-instruction content to WATCH (never follow)', () => {
    const result = engine.recommend(
      item({ securityFlags: ['unsafe_instructions'], relevanceLabel: 'high' }),
    );
    expect(result.state).toBe('WATCH');
  });

  it('IGNOREs items with low VedMoulya relevance regardless of popularity', () => {
    const result = engine.recommend(item({ relevanceLabel: 'low', relevance: 20 }));
    expect(result.state).toBe('IGNORE');
  });

  it('WATCHes medium-relevance items', () => {
    const result = engine.recommend(item({ relevanceLabel: 'medium', relevance: 45 }));
    expect(result.state).toBe('WATCH');
  });

  it('CONFIGUREs a high-relevance model VedMoulya can configure today', () => {
    const result = engine.recommend(
      item({
        category: 'model',
        relevanceLabel: 'high',
        modelFacts: {
          capabilities: ['reasoning'],
          configurable: true,
          suggestedFamily: 'openrouter',
        },
      }),
    );
    expect(result.state).toBe('CONFIGURE');
    expect(result.reasons[0]).toContain('Configurable');
  });

  it('CONFIGUREs a high-relevance provider with a registry family', () => {
    const result = engine.recommend(
      item({
        category: 'provider',
        relevanceLabel: 'high',
        modelFacts: { capabilities: [], configurable: true, suggestedFamily: 'openai' },
      }),
    );
    expect(result.state).toBe('CONFIGURE');
  });

  it('does NOT CONFIGURE a model with no registry family (configurable=false)', () => {
    const result = engine.recommend(
      item({
        category: 'model',
        relevanceLabel: 'high',
        modelFacts: { capabilities: ['reasoning'], configurable: false },
      }),
    );
    expect(result.state).toBe('TRY');
  });

  it('TRYs a high-quality, evidence-backed GitHub repository with a clear license', () => {
    const result = engine.recommend(
      item({
        category: 'github',
        relevanceLabel: 'high',
        github: {
          name: 'a/b',
          license: 'MIT',
          licenseConfidence: 'PROVIDER_DECLARED',
          documentationQuality: 'good',
          deploymentComplexity: 'medium',
          selfHostable: 'yes',
          flags: [],
          flagEvidence: {},
          securityConsiderations: [],
        },
      }),
    );
    expect(result.state).toBe('TRY');
  });

  it('REVIEWs a GitHub repository carrying caution flags (unclear license)', () => {
    const result = engine.recommend(
      item({
        category: 'github',
        relevanceLabel: 'high',
        github: {
          name: 'a/b',
          licenseConfidence: 'UNKNOWN',
          documentationQuality: 'unknown',
          deploymentComplexity: 'UNKNOWN',
          selfHostable: 'UNKNOWN',
          flags: ['unclear_license'],
          flagEvidence: { unclear_license: 'No license field.' },
          securityConsiderations: ['License is unclear.'],
        },
      }),
    );
    expect(result.state).toBe('REVIEW');
  });

  it('REVIEWs an abandoned repository — stars never rescue inactivity', () => {
    const result = engine.recommend(
      item({
        category: 'github',
        relevanceLabel: 'high',
        github: {
          name: 'a/b',
          stars: 200000,
          licenseConfidence: 'PROVIDER_DECLARED',
          documentationQuality: 'good',
          deploymentComplexity: 'medium',
          selfHostable: 'yes',
          flags: ['abandoned', 'inactive_development'],
          flagEvidence: { abandoned: 'No commits in 20 months.' },
          securityConsiderations: [],
        },
      }),
    );
    expect(result.state).toBe('REVIEW');
  });

  it('REVIEWs strategic news (ecosystem change) rather than over-recommending', () => {
    const result = engine.recommend(
      item({ category: 'news', relevanceLabel: 'high', relevance: 90 }),
    );
    expect(result.state).toBe('REVIEW');
  });

  it('TRYs a useful application with integration potential', () => {
    const result = engine.recommend(item({ category: 'application', relevanceLabel: 'high' }));
    expect(result.state).toBe('TRY');
  });

  it('defaults to WATCH for anything unclassified', () => {
    const result = engine.recommend(item({ relevanceLabel: 'medium' }));
    expect(result.state).toBe('WATCH');
  });
});

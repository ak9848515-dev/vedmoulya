import { describe, it, expect } from 'vitest';
import { TaskIntelligenceEngine } from '../domain/TaskIntelligenceEngine.js';
import type { CandidateSet } from '../domain/TaskIntelligenceEngine.js';
import type { IntelligenceTaskContext } from '../types/intelligence-types.js';
import {
  provider,
  discovery,
  localModel,
  evidence,
  TEXT_GENERATION,
  VIDEO_GENERATION,
} from './fixtures.js';

const engine = new TaskIntelligenceEngine({ free: 60, configured: 70 });

const HIGH_QUALITY: IntelligenceTaskContext = {
  objective: 'Create a professional AI video.',
  domain: 'content',
  qualityTarget: 'HIGH',
  privacyRequirement: 'STANDARD',
  constraints: [],
  authorizedActions: [],
};

describe('TaskIntelligenceEngine — quality-first selection', () => {
  it('quality beats cost: the best-paid option wins over a cheaper lower-quality one', () => {
    const candidates: CandidateSet = {
      providers: [
        provider({
          providerId: 'free-provider',
          name: 'Free Provider',
          quality: 60,
          costTier: 'free',
          configured: true,
        }),
        provider({
          providerId: 'paid-provider',
          name: 'Paid Provider',
          quality: 92,
          costTier: 'high',
          estimatedCostUsd: 0.1,
        }),
      ],
      discoveries: [],
      localModels: [],
    };
    const result = engine.evaluate(VIDEO_GENERATION, HIGH_QUALITY, candidates);
    expect(result.betterOptionAvailable).toBe(true);
    const paid = result.options.find((o) => o.kind === 'BEST_PAID');
    expect(paid?.name).toBe('Paid Provider');
    expect(paid?.requires).toContain('api_key');
  });

  it('free wins when quality is sufficient — cost is a preference, not an absolute rule', () => {
    const candidates: CandidateSet = {
      providers: [
        provider({
          providerId: 'paid-a',
          name: 'Paid Slightly Better',
          quality: 82,
          costTier: 'medium',
          configured: true,
        }),
        provider({
          providerId: 'free-b',
          name: 'Free Excellent',
          quality: 80,
          costTier: 'free',
        }),
      ],
      discoveries: [],
      localModels: [],
    };
    const result = engine.evaluate(
      TEXT_GENERATION,
      { ...HIGH_QUALITY, qualityTarget: 'MEDIUM' },
      candidates,
    );
    // Margin 2 < 8 → no better-option recommendation; the free candidate is surfaced as BEST_FREE.
    expect(result.betterOptionAvailable).toBe(false);
    const bestFree = result.options.find((o) => o.kind === 'BEST_FREE');
    expect(bestFree?.providerId).toBe('free-b');
  });

  it('free does NOT win when quality is insufficient — never recommend a worse free option', () => {
    const candidates: CandidateSet = {
      providers: [
        provider({
          providerId: 'paid-quality',
          name: 'Quality Provider',
          quality: 90,
          costTier: 'high',
          configured: true,
        }),
        provider({
          providerId: 'free-weak',
          name: 'Weak Free',
          quality: 30,
          costTier: 'free',
        }),
      ],
      discoveries: [],
      localModels: [],
    };
    const result = engine.evaluate(TEXT_GENERATION, HIGH_QUALITY, candidates);
    expect(result.bestAvailableNow?.providerId).toBe('paid-quality');
    expect(result.betterOptionAvailable).toBe(false);
  });

  it('best available now = best configured option meeting the quality floor', () => {
    const candidates: CandidateSet = {
      providers: [
        provider({ providerId: 'cfg-a', name: 'Configured A', quality: 75, configured: true }),
        provider({ providerId: 'cfg-b', name: 'Configured B', quality: 88, configured: true }),
        provider({ providerId: 'unconfigured', name: 'Unconfigured Star', quality: 97 }),
      ],
      discoveries: [],
      localModels: [],
    };
    const result = engine.evaluate(TEXT_GENERATION, HIGH_QUALITY, candidates);
    expect(result.bestAvailableNow?.providerId).toBe('cfg-b');
    expect(result.betterOptionAvailable).toBe(true); // 95 vs 88 ≥ 8 → recommend
  });

  it('local model surfaces only when available; quality-first, hardware-honest', () => {
    const candidates: CandidateSet = {
      providers: [],
      discoveries: [],
      localModels: [
        localModel({
          id: 'llama',
          name: 'Llama Local',
          available: true,
          capabilitiesProvenance: 'INFERRED',
        }),
        localModel({
          id: 'too-big',
          name: 'Too Big For This Machine',
          available: false,
          sizeGb: 120,
        }),
      ],
    };
    const result = engine.evaluate(
      TEXT_GENERATION,
      { ...HIGH_QUALITY, privacyRequirement: 'PRIVATE' },
      candidates,
    );
    const bestLocal = result.options.find((o) => o.kind === 'BEST_LOCAL');
    expect(bestLocal?.name).toBe('Llama Local');
    expect(bestLocal?.localAvailability).toBe('yes');
    expect(bestLocal?.requires).toContain('download');
  });

  it('unknown provider / no candidates → honest empty result with a fallback plan', () => {
    const result = engine.evaluate(TEXT_GENERATION, HIGH_QUALITY, {
      providers: [],
      discoveries: [],
      localModels: [],
    });
    expect(result.options).toEqual([]);
    expect(result.betterOptionAvailable).toBe(false);
    expect(result.fallback?.bestAchievable).toContain('honestly as PARTIAL');
  });

  it('github discovery is never assumed API-executable — requires additional permission', () => {
    const candidates: CandidateSet = {
      providers: [],
      discoveries: [
        discovery({
          itemId: 'gh-1',
          category: 'github',
          title: 'opensource-video-tool',
          capabilities: [VIDEO_GENERATION],
          freeClass: 'OPEN_SOURCE',
          localAvailability: 'yes',
          configurable: false,
          github: { name: 'org/video-tool', license: 'MIT', flags: [] },
          evidence: [evidence('Provides local video assembly', 'repo README')],
        }),
      ],
      localModels: [],
    };
    const result = engine.evaluate(VIDEO_GENERATION, HIGH_QUALITY, candidates);
    const githubOption = result.options.find((o) => o.name === 'opensource-video-tool');
    expect(githubOption).toBeDefined();
    expect(githubOption?.requires).toContain('additional_permission');
  });

  it('declined paid option resolves to a free→local→github→current fallback, never failure', () => {
    const candidates: CandidateSet = {
      providers: [
        provider({ providerId: 'cfg', name: 'Configured', quality: 70, configured: true }),
        provider({ providerId: 'paid', name: 'Paid Better', quality: 92 }),
      ],
      discoveries: [discovery({ itemId: 'gh-2', category: 'github', title: 'oss-option' })],
      localModels: [localModel({ id: 'local-1', name: 'Local Option', available: true })],
    };
    const result = engine.evaluate(TEXT_GENERATION, HIGH_QUALITY, candidates);
    expect(result.betterOptionAvailable).toBe(true);
    expect(result.fallback?.order).toEqual([
      'FREE',
      'FREE_QUOTA',
      'LOCAL',
      'OPEN_SOURCE',
      'GITHUB',
      'CURRENT_CONFIGURED',
    ]);
    expect(result.fallback?.bestAchievable).toContain('cfg');
    expect(result.fallback?.bestAchievable).toContain('without new activation');
  });

  it('a distinct low-cost option is surfaced when it differs from the best free option', () => {
    const candidates: CandidateSet = {
      providers: [
        provider({ providerId: 'free', name: 'Free Tier', quality: 70, costTier: 'free' }),
        provider({ providerId: 'low', name: 'Low Cost', quality: 75, costTier: 'low' }),
        provider({ providerId: 'medium', name: 'Medium Cost', quality: 78, costTier: 'medium' }),
      ],
      discoveries: [],
      localModels: [],
    };
    const result = engine.evaluate(TEXT_GENERATION, HIGH_QUALITY, candidates);
    const lowCost = result.options.find((o) => o.kind === 'BEST_LOW_COST');
    expect(lowCost?.providerId).toBe('low');
    const bestPaid = result.options.find((o) => o.kind === 'BEST_PAID');
    expect(bestPaid?.providerId).toBe('medium');
  });

  it('LOW quality target lowers the floor accordingly', () => {
    const candidates: CandidateSet = {
      providers: [provider({ providerId: 'basic', name: 'Basic', quality: 45, configured: true })],
      discoveries: [],
      localModels: [],
    };
    const result = engine.evaluate(
      TEXT_GENERATION,
      { ...HIGH_QUALITY, qualityTarget: 'LOW' },
      candidates,
    );
    expect(result.bestAvailableNow?.providerId).toBe('basic');
  });

  it('evidence count breaks quality ties (evidence-first, popularity never)', () => {
    const candidates: CandidateSet = {
      providers: [
        provider({
          providerId: 'evidenced',
          name: 'Evidenced',
          quality: 80,
          configured: true,
          evidence: [
            evidence('a', 'official'),
            evidence('b', 'official'),
            evidence('c', 'official'),
          ],
        }),
        provider({ providerId: 'thin', name: 'Thin Evidence', quality: 80, evidence: [] }),
      ],
      discoveries: [],
      localModels: [],
    };
    const result = engine.evaluate(TEXT_GENERATION, HIGH_QUALITY, candidates);
    expect(result.bestAvailableNow?.providerId).toBe('evidenced');
  });
});

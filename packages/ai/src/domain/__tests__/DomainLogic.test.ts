// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — AI domain service + rules + factory + events unit tests
// ARC-005 — AI Orchestration
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { AIDomainService } from '../services/AIDomainService.js';
import {
  supportedCapabilityRule,
  qualityTierRule,
  retryLimitRule,
  fallbackRule,
  costRule,
  privacyRule,
} from '../rules/AIRules.js';
import { AIRequestFactory } from '../factory/AIRequestFactory.js';
import { AI_DOMAIN_EVENTS } from '../events/AIDomainEvents.js';

describe('AIDomainService', () => {
  const service = new AIDomainService();

  it('validates supported capabilities', () => {
    expect(service.validateCapability('reasoning')).toBe(true);
    expect(service.validateCapability('coding')).toBe(true);
    expect(service.validateCapability('general_conversation')).toBe(true);
    expect(service.validateCapability('unknown' as never)).toBe(false);
  });

  it('validates quality tiers', () => {
    expect(service.validateQualityTier('reasoning', 'premium')).toBe(true);
    expect(service.validateQualityTier('reasoning', 'standard')).toBe(true);
    expect(service.validateQualityTier('reasoning', 'economy')).toBe(false);
    expect(service.validateQualityTier('reasoning', 'free')).toBe(false);
    expect(service.validateQualityTier('vision', 'economy')).toBe(true);
  });

  it('classifies retryable failures', () => {
    expect(service.isRetryableFailure('timeout')).toBe(true);
    expect(service.isRetryableFailure('rate_limited')).toBe(true);
    expect(service.isRetryableFailure('provider_unavailable')).toBe(true);
    expect(service.isRetryableFailure('invalid_response')).toBe(false);
  });

  it('calculates exponential backoff with a cap', () => {
    expect(service.calculateBackoff(1)).toBe(1000);
    expect(service.calculateBackoff(2)).toBe(2000);
    expect(service.calculateBackoff(3, 5000)).toBe(20000);
    expect(service.calculateBackoff(10, 1000)).toBe(30000);
  });

  it('validates request constraints', () => {
    const freeReasoning = { qualityTier: 'free', capability: { type: 'reasoning' } } as never;
    expect(service.validateConstraints(freeReasoning)).toEqual([
      'Free tier does not support reasoning capability',
    ]);
    const standardReasoning = {
      qualityTier: 'standard',
      capability: { type: 'reasoning' },
    } as never;
    expect(service.validateConstraints(standardReasoning)).toEqual([]);
  });

  it('decides provider switching based on failure pattern', () => {
    const noFailure = { failureReason: null, attempts: 0 } as never;
    expect(service.shouldSwitchProvider(noFailure)).toBe(false);
    const nonRetryable = { failureReason: 'invalid_response', attempts: 1 } as never;
    expect(service.shouldSwitchProvider(nonRetryable)).toBe(true);
    const retryableUnder3 = { failureReason: 'timeout', attempts: 2 } as never;
    expect(service.shouldSwitchProvider(retryableUnder3)).toBe(false);
    const retryableAt3 = { failureReason: 'timeout', attempts: 3 } as never;
    expect(service.shouldSwitchProvider(retryableAt3)).toBe(true);
  });
});

describe('AIRules', () => {
  it('supportedCapabilityRule accepts known capabilities', () => {
    expect(supportedCapabilityRule('reasoning')).toEqual({ passed: true, message: undefined });
    expect(supportedCapabilityRule('unknown' as never).passed).toBe(false);
  });

  it('qualityTierRule accepts premium and standard', () => {
    expect(qualityTierRule('reasoning', 'premium')).toEqual({ passed: true });
    expect(qualityTierRule('reasoning', 'standard')).toEqual({ passed: true });
  });

  it('qualityTierRule rejects economy/free for critical capabilities', () => {
    expect(qualityTierRule('reasoning', 'economy').passed).toBe(false);
    expect(qualityTierRule('coding', 'free').passed).toBe(false);
    expect(qualityTierRule('vision', 'free').passed).toBe(true);
  });

  it('retryLimitRule handles non-retryable reasons', () => {
    expect(retryLimitRule('invalid_response', 0).passed).toBe(false);
  });

  it('retryLimitRule enforces the max retry count', () => {
    expect(retryLimitRule('timeout', 0).passed).toBe(true);
    expect(retryLimitRule('timeout', 2).passed).toBe(true);
    expect(retryLimitRule('timeout', 3).passed).toBe(false);
    expect(retryLimitRule('rate_limited', 5).passed).toBe(false);
  });

  it('fallbackRule only falls back when primary failed and alternative available', () => {
    expect(fallbackRule(false, false, 0)).toEqual({ passed: true });
    expect(fallbackRule(true, true, 1).passed).toBe(true);
    expect(fallbackRule(true, false, 1).passed).toBe(false);
    expect(fallbackRule(true, true, 5).passed).toBe(false);
    expect(fallbackRule(true, true, 9).passed).toBe(false);
  });

  it('costRule passes when no budget is set', () => {
    expect(costRule(100, undefined)).toEqual({ passed: true });
  });

  it('costRule enforces the budget', () => {
    expect(costRule(5, 10).passed).toBe(true);
    expect(costRule(15, 10).passed).toBe(false);
  });

  it('privacyRule detects sensitive patterns case-insensitively', () => {
    expect(privacyRule(['hello'], ['secret'])).toEqual({ passed: true });
    expect(privacyRule(['My SECRET password'], ['secret']).passed).toBe(false);
    expect(privacyRule(['a', 'b'], ['secret', 'token'])).toEqual({ passed: true });
    expect(privacyRule(['contains token here'], ['token']).passed).toBe(false);
  });
});

describe('AIRequestFactory', () => {
  const factory = new AIRequestFactory();

  it('creates a new request with all optional fields', () => {
    const request = factory.createNewRequest({
      id: 'req-1',
      capability: 'summarization',
      systemInstructions: 'Be concise',
      userInput: 'Summarize this',
      userContext: 'context',
      taskContext: 'task',
      constraints: ['no markdown'],
      safetyInstructions: ['no PII'],
      qualityTier: 'standard',
      userId: 'user-1',
      conversationId: 'conv-1',
      metadata: { source: 'test' },
    });
    expect(request.id?.value).toBe('req-1');
    expect(request.capability.type).toBe('summarization');
    expect(request.qualityTier).toBe('standard');
    expect(request.userId).toBe('user-1');
    expect(request.conversationId).toBe('conv-1');
    expect(request.metadata).toEqual({ source: 'test' });
  });

  it('creates a request without optional fields', () => {
    const request = factory.createNewRequest({
      capability: 'coding',
      systemInstructions: 's',
      userInput: 'write code',
      qualityTier: 'premium',
    });
    expect(request.id).toBeDefined();
    expect(request.prompt.userInput).toBe('write code');
    expect(request.metadata).toEqual({});
  });
});

describe('AI_DOMAIN_EVENTS', () => {
  it('exposes request lifecycle event names', () => {
    expect(AI_DOMAIN_EVENTS.REQUEST_CREATED).toBe('ai.request.created');
    expect(AI_DOMAIN_EVENTS.REQUEST_COMPLETED).toBe('ai.request.completed');
    expect(AI_DOMAIN_EVENTS.REQUEST_FAILED).toBe('ai.request.failed');
  });

  it('exposes provider and cost event names', () => {
    expect(AI_DOMAIN_EVENTS.PROVIDER_DOWN).toBe('ai.provider.down');
    expect(AI_DOMAIN_EVENTS.BUDGET_EXCEEDED).toBe('ai.cost.budget_exceeded');
  });
});

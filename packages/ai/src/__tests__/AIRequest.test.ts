// ──────────────────────────────────────────────────────────────────
// VedMoulya — AIRequest Entity Tests
// BLD-005 — AI Orchestrator
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { AIRequest } from '../domain/entities/AIRequest.js';
import { AIRequestId } from '../domain/value-objects/AIRequestId.js';
import { Capability } from '../domain/value-objects/Capability.js';
import { Prompt } from '../domain/value-objects/Prompt.js';
import { ProviderId } from '../domain/value-objects/ProviderId.js';

describe('AIRequest', () => {
  it('should create a new request with pending status', () => {
    const request = AIRequest.create({
      capability: Capability.create('reasoning'),
      prompt: Prompt.create({
        systemInstructions: 'You are a helpful assistant.',
        userInput: 'What is 2+2?',
      }),
      qualityTier: 'standard',
    });

    expect(request.status).toBe('pending');
    expect(request.id).toBeDefined();
    expect(request.capability.type).toBe('reasoning');
  });

  it('should transition through lifecycle correctly', () => {
    const request = AIRequest.create({
      capability: Capability.create('coding'),
      prompt: Prompt.create({
        systemInstructions: 'You are a coding assistant.',
        userInput: 'Write a function',
      }),
      qualityTier: 'premium',
    });

    expect(request.status).toBe('pending');

    request.assignProvider(ProviderId.create('mock'));
    expect(request.status).toBe('routing');

    request.startExecution();
    expect(request.status).toBe('executing');
    expect(request.attempts).toBe(1);
  });

  it('should complete with response data', () => {
    const request = AIRequest.create({
      capability: Capability.create('general_conversation'),
      prompt: Prompt.create({
        systemInstructions: 'You are a helpful assistant.',
        userInput: 'Hello!',
      }),
      qualityTier: 'standard',
    });

    request.assignProvider(ProviderId.create('mock'));
    request.startExecution();

    request.complete({
      content: 'Hello! How can I help?',
      provider: 'mock',
      model: 'mock-v1',
      confidence: 0.9,
      qualityScore: 8.5,
      latency: 50,
      cost: 0.001,
      tokenUsage: { input: 10, output: 5, total: 15 },
      validation: {
        passed: true,
        checks: [],
        overallScore: 9,
        decision: 'pass',
      },
      traceId: 'test-123',
    });

    expect(request.status).toBe('completed');
    expect(request.response).toBeDefined();
    expect(request.response?.content).toBe('Hello! How can I help?');
  });

  it('should fail with a reason', () => {
    const request = AIRequest.create({
      capability: Capability.create('reasoning'),
      prompt: Prompt.create({
        systemInstructions: 'Test.',
        userInput: 'Test',
      }),
      qualityTier: 'standard',
    });

    request.fail('provider_unavailable', 'Provider is down');
    expect(request.status).toBe('failed');
    expect(request.failureReason).toBe('provider_unavailable');
  });

  it('should fallback to another provider after failure', () => {
    const request = AIRequest.create({
      capability: Capability.create('reasoning'),
      prompt: Prompt.create({
        systemInstructions: 'Test.',
        userInput: 'Test',
      }),
      qualityTier: 'standard',
    });

    request.fail('timeout');
    expect(request.status).toBe('failed');

    request.fallback(ProviderId.create('backup-provider'));
    expect(request.status).toBe('routing');
    expect(request.selectedProvider?.toString()).toBe('backup-provider');
  });

  it('should identify retryable failures', () => {
    const request = AIRequest.create({
      capability: Capability.create('reasoning'),
      prompt: Prompt.create({
        systemInstructions: 'Test.',
        userInput: 'Test',
      }),
      qualityTier: 'standard',
    });

    request.fail('timeout');
    expect(request.isRetryable()).toBe(true);

    request.fail('invalid_response');
    expect(request.isRetryable()).toBe(false);
  });

  it('should generate domain events', () => {
    const request = AIRequest.create({
      capability: Capability.create('reasoning'),
      prompt: Prompt.create({
        systemInstructions: 'Test.',
        userInput: 'Test',
      }),
      qualityTier: 'standard',
    });

    expect(request.domainEvents.length).toBeGreaterThan(0);
    expect(request.domainEvents[0]!.eventType).toBe('ai.request.created');
  });
});

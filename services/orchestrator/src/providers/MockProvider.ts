// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mock AI Provider Adapter
// Mock provider for testing and development
// ARC-005 — AI Orchestration
// ──────────────────────────────────────────────────────────────────

import type { AIResponse, CapabilityType, ProviderHealth } from '@vedmoulya/ai';
import type { ProviderAdapter } from '@vedmoulya/services';

export class MockProvider implements ProviderAdapter {
  name = 'mock';
  family = 'mock';
  capabilities: CapabilityType[] = [
    'reasoning',
    'coding',
    'vision',
    'embeddings',
    'summarization',
    'classification',
    'translation',
    'speech',
    'image_understanding',
    'general_conversation',
    // EPIC-003/AC-001 — mock supports content generation so the full Content
    // Agency pipeline is exercisable in dev/test without API keys.
    'content_generation',
  ];

  isHealthy(): Promise<boolean> {
    return Promise.resolve(true);
  }

  getHealth(): Promise<ProviderHealth> {
    return Promise.resolve({
      providerId: 'mock',
      status: 'healthy',
      latency: 50,
      errorRate: 0,
      lastChecked: new Date(),
      isRateLimited: false,
      rateLimitRemaining: 1000,
      rateLimitReset: null,
    });
  }

  execute(request: {
    messages: Array<{ role: string; content: string }>;
    model: string;
    maxTokens?: number;
  }): Promise<AIResponse> {
    const lastMessage = request.messages[request.messages.length - 1];
    const input = lastMessage?.content ?? '';

    return Promise.resolve({
      content: `Mock response to: "${input.substring(0, 50)}..."`,
      provider: 'mock',
      model: 'mock-v1',
      confidence: 0.85,
      qualityScore: 7.5,
      latency: 50,
      cost: 0.0001,
      tokenUsage: {
        input: Math.ceil(input.length / 4),
        output: 50,
        total: Math.ceil(input.length / 4) + 50,
      },
      validation: {
        passed: true,
        checks: [
          { name: 'format', passed: true, score: 10 },
          { name: 'safety', passed: true, score: 10 },
          { name: 'quality', passed: true, score: 7.5 },
        ],
        overallScore: 8.5,
        decision: 'pass',
      },
      traceId: `mock-${String(Date.now())}`,
      metadata: {
        providerFamily: 'mock',
        modelVersion: 'mock-v1',
        processingTime: 50,
        contextUsed: ['system', 'user-input'],
        routingDecision: {
          selectedProvider: 'mock',
          reason: 'Mock provider for testing',
          alternativesConsidered: [],
          strategy: 'balanced',
        },
        validationDetails: [],
      },
    });
  }
}

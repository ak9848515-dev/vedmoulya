// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Orchestrator entry point tests
// Covers createOrchestrator bootstrap: service creation + mock provider
// registration (the only logic in src/index.ts).
// ARC-005 — AI Orchestration
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { createOrchestrator, MockProvider } from '../index.js';
import { AIOrchestrationService } from '@vedmoulya/services';

describe('createOrchestrator', () => {
  it('returns an AIOrchestrationService instance', () => {
    const orchestrator = createOrchestrator();

    expect(orchestrator).toBeInstanceOf(AIOrchestrationService);
  });

  it('registers the MockProvider for development/testing', () => {
    const orchestrator = createOrchestrator();

    const provider = orchestrator.getProvider('mock');

    expect(provider).toBeInstanceOf(MockProvider);
    expect(provider?.name).toBe('mock');
  });

  it('reports the mock provider as registered via listProviders', () => {
    const orchestrator = createOrchestrator();

    const providers = orchestrator.listProviders();

    expect(providers.providers.some((p) => p.id === 'mock')).toBe(true);
    expect(providers.total).toBe(1);
  });

  // Note: createOrchestrator(_config) currently accepts but intentionally
  // ignores its config parameter (no business-logic change in PR-001); these
  // tests pin the accepted-but-unused behavior for backward compatibility.
  it('accepts a partial config without throwing', () => {
    const orchestrator = createOrchestrator({
      providers: { enableMock: true },
    });

    expect(orchestrator).toBeInstanceOf(AIOrchestrationService);
    expect(orchestrator.getProvider('mock')).toBeDefined();
  });

  it('still registers mock when a real-provider config is supplied', () => {
    const orchestrator = createOrchestrator({
      providers: {
        openai: { apiKey: 'sk-test' },
        enableMock: true,
      },
    });

    expect(orchestrator.getProvider('mock')).toBeInstanceOf(MockProvider);
  });
});

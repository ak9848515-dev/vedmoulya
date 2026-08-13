// ──────────────────────────────────────────────────────────────────
// VedMoulya — IntegrationClassifier tests
// EPIC-013 §2/§10 — every provider declares its integration mode;
// external applications never pretend to have API automation.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { IntegrationClassifier } from '../domain/IntegrationClassifier.js';
import {
  configuredProvider,
  externalAppDiscovery,
  flaggedDiscovery,
  githubDiscovery,
  localModel,
  unconfiguredProvider,
} from './fixtures.js';

const classifier = new IntegrationClassifier();

describe('IntegrationClassifier — integration classification', () => {
  it('classifies a configured provider as NATIVE_API + READY', () => {
    const result = classifier.classifyProvider(configuredProvider());
    expect(result.integrationType).toBe('NATIVE_API');
    expect(result.classification).toBe('READY');
    expect(result.apiAvailable).toBe('yes');
  });

  it('classifies an unconfigured provider as DIRECT_PROVIDER + CONFIGURE', () => {
    const result = classifier.classifyProvider(unconfiguredProvider());
    expect(result.integrationType).toBe('DIRECT_PROVIDER');
    expect(result.classification).toBe('CONFIGURE');
    expect(result.apiAvailable).toBe('yes');
  });

  it('classifies a local runtime provider as LOCAL_MODEL', () => {
    const result = classifier.classifyProvider(
      configuredProvider({ providerId: 'prov-ollama', family: 'ollama', name: 'Ollama' }),
    );
    expect(result.integrationType).toBe('LOCAL_MODEL');
    expect(result.classification).toBe('READY');
  });

  it('classifies a GitHub discovery as GITHUB_PROJECT + EVALUATE (no API assumed)', () => {
    const result = classifier.classifyDiscovery(githubDiscovery());
    expect(result.integrationType).toBe('GITHUB_PROJECT');
    expect(result.classification).toBe('EVALUATE');
    expect(result.apiAvailable).toBe('no');
  });

  it('never assumes an API for an external application', () => {
    const result = classifier.classifyDiscovery(externalAppDiscovery());
    expect(result.integrationType).toBe('EXTERNAL_APPLICATION');
    expect(result.classification).toBe('EXTERNAL');
    expect(result.apiAvailable).toBe('UNKNOWN');
    expect(result.reasons.join(' ')).toMatch(/API is not assumed/i);
  });

  it('classifies a discovered configurable provider as CONFIGURE', () => {
    const result = classifier.classifyDiscovery({
      itemId: 'disc-prov-1',
      category: 'provider',
      title: 'OpenRouter',
      capabilities: ['TEXT_GENERATION'],
      freeClass: 'FREE_WITH_QUOTA',
      localAvailability: 'no',
      configurable: true,
      suggestedFamily: 'openrouter',
      evidence: [
        { claim: 'Aggregator of hosted models', source: 'ai-world', confidence: 'VERIFIED' },
      ],
      securityFlags: [],
    });
    expect(result.integrationType).toBe('DIRECT_PROVIDER');
    expect(result.classification).toBe('CONFIGURE');
    expect(result.apiAvailable).toBe('yes');
  });

  it('treats security-flagged discoveries as untrusted', () => {
    const result = classifier.classifyDiscovery(flaggedDiscovery());
    expect(result.classification).toBe('UNKNOWN');
    expect(result.reasons.join(' ')).toMatch(/untrusted/i);
  });

  it('classifies a local model with honest capability provenance', () => {
    const result = classifier.classifyLocalModel(localModel());
    expect(result.integrationType).toBe('LOCAL_MODEL');
    expect(result.classification).toBe('READY');
    expect(result.apiAvailable).toBe('yes');
    expect(result.reasons.join(' ')).toMatch(/never claimed as verified/i);
  });

  it('returns MANUAL_STEP for a manual fallback', () => {
    const result = classifier.manual();
    expect(result.integrationType).toBe('MANUAL_STEP');
    expect(result.classification).toBe('MANUAL');
    expect(result.apiAvailable).toBe('no');
  });
});

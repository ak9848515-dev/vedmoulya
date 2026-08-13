// ──────────────────────────────────────────────────────────────────
// VedMoulya — Capability Marketplace test fixtures
// EPIC-013 — deterministic fixtures, no live external services
// ──────────────────────────────────────────────────────────────────

import type {
  CapabilityCandidate,
  CapabilityPlanRequest,
  FactoryCapabilityPlan,
  PlanStep,
} from '../types/capability-types.js';
import type {
  CapabilitySourcePort,
  DiscoveryCandidateFact,
  LocalModelCandidateFact,
  ProviderCandidateFact,
} from '../contracts/CapabilitySourcePort.js';

export const NOW = new Date('2026-08-13T09:00:00Z');

export function configuredProvider(
  overrides: Partial<ProviderCandidateFact> = {},
): ProviderCandidateFact {
  return {
    providerId: 'prov-openai',
    family: 'openai',
    name: 'OpenAI',
    modelId: 'gpt-4o',
    modelName: 'GPT-4o',
    capabilities: ['TEXT_GENERATION', 'REASONING', 'CODING', 'VISION'],
    quality: 0.92,
    costTier: 'medium',
    availability: 0.99,
    configured: true,
    evidence: [
      {
        claim: 'Registered provider with capability matrix',
        source: 'provider-registry',
        confidence: 'VERIFIED',
      },
    ],
    ...overrides,
  };
}

export function unconfiguredProvider(
  overrides: Partial<ProviderCandidateFact> = {},
): ProviderCandidateFact {
  return configuredProvider({
    providerId: 'prov-anthropic',
    family: 'anthropic',
    name: 'Anthropic',
    modelId: 'claude-sonnet',
    modelName: 'Claude Sonnet',
    capabilities: ['TEXT_GENERATION', 'REASONING', 'CODING'],
    quality: 0.9,
    configured: false,
    ...overrides,
  });
}

export function githubDiscovery(
  overrides: Partial<DiscoveryCandidateFact> = {},
): DiscoveryCandidateFact {
  return {
    itemId: 'disc-gh-1',
    category: 'github',
    title: 'Some RAG framework',
    capabilities: ['RAG'],
    freeClass: 'OPEN_SOURCE',
    localAvailability: 'yes',
    configurable: false,
    github: { name: 'org/rag-framework', license: 'MIT', flags: [] },
    evidence: [
      { claim: 'MIT-licensed open-source project', source: 'ai-world', confidence: 'VERIFIED' },
    ],
    securityFlags: [],
    ...overrides,
  };
}

export function externalAppDiscovery(
  overrides: Partial<DiscoveryCandidateFact> = {},
): DiscoveryCandidateFact {
  return {
    itemId: 'disc-app-1',
    category: 'application',
    title: 'Some video editor',
    capabilities: ['VIDEO_EDITING'],
    freeClass: 'PAID',
    localAvailability: 'no',
    configurable: false,
    evidence: [
      {
        claim: 'Commercial video editing application',
        source: 'ai-world',
        confidence: 'PROVIDER_DECLARED',
      },
    ],
    securityFlags: [],
    ...overrides,
  };
}

export function flaggedDiscovery(
  overrides: Partial<DiscoveryCandidateFact> = {},
): DiscoveryCandidateFact {
  return githubDiscovery({
    itemId: 'disc-gh-bad',
    title: 'Malicious-looking repo',
    securityFlags: ['prompt_injection'],
    ...overrides,
  });
}

export function localModel(
  overrides: Partial<LocalModelCandidateFact> = {},
): LocalModelCandidateFact {
  return {
    id: 'llama3.2',
    name: 'llama3.2',
    sizeGb: 4.9,
    runtime: 'ollama',
    capabilities: ['TEXT_GENERATION', 'REASONING'],
    capabilitiesProvenance: 'INFERRED',
    available: true,
    evidence: [
      { claim: 'Discovered via Ollama runtime', source: 'local-discovery', confidence: 'MEASURED' },
    ],
    ...overrides,
  };
}

/** A deterministic source port the tests share. */
export function testSource(overrides: Partial<CapabilitySourcePort> = {}): CapabilitySourcePort {
  return {
    providerCandidates: async (): Promise<ProviderCandidateFact[]> => [configuredProvider()],
    discoveryCandidates: async (): Promise<DiscoveryCandidateFact[]> => [],
    localModelCandidates: async (): Promise<LocalModelCandidateFact[]> => [localModel()],
    ...overrides,
  };
}

export function videoRequest(): CapabilityPlanRequest {
  return {
    outcome: 'Create a 60-second educational video about the solar system',
    configuredFamilies: ['openai'],
  };
}

export function candidate(overrides: Partial<CapabilityCandidate> = {}): CapabilityCandidate {
  return {
    id: 'provider:prov-openai:gpt-4o',
    kind: 'model',
    name: 'OpenAI · GPT-4o',
    providerFamily: 'openai',
    modelId: 'gpt-4o',
    capability: 'TEXT_GENERATION',
    integrationType: 'NATIVE_API',
    classification: 'READY',
    freeAvailability: 'UNKNOWN',
    localAvailability: 'no',
    quality: 0.92,
    availability: 0.99,
    evidence: [
      {
        claim: 'Registered provider with capability matrix',
        source: 'provider-registry',
        confidence: 'VERIFIED',
      },
    ],
    reasons: ['Provider is configured and enabled — ready to use through the existing runtime.'],
    configurable: false,
    apiAvailable: 'yes',
    ...overrides,
  };
}

export function step(overrides: Partial<PlanStep> = {}): PlanStep {
  return {
    id: 'script',
    title: 'Script',
    capability: 'TEXT_GENERATION',
    purpose: 'Draft the narration and on-screen copy.',
    candidates: [candidate()],
    selectedCandidateId: 'provider:prov-openai:gpt-4o',
    automation: 'FULLY_AUTOMATED',
    irreversible: false,
    reasons: ['OpenAI · GPT-4o is API-automatable through VedMoulya.'],
    ...overrides,
  };
}

export function plan(overrides: Partial<FactoryCapabilityPlan> = {}): FactoryCapabilityPlan {
  return {
    id: 'plan-1',
    requestedOutcome: 'Create a 60-second educational video about the solar system',
    createdAt: NOW.toISOString(),
    requiredCapabilities: [
      'RESEARCH',
      'TEXT_GENERATION',
      'QUALITY_EVALUATION',
      'REASONING',
      'IMAGE_GENERATION',
      'TEXT_TO_SPEECH',
      'MUSIC',
      'ASSEMBLY',
      'DEPLOYMENT',
    ],
    candidates: [candidate()],
    steps: [
      step(),
      step({ id: 'quality', title: 'Quality Check', capability: 'QUALITY_EVALUATION' }),
    ],
    automationLevel: 'PARTIALLY_AUTOMATED',
    automationPercent: 60,
    estimatedCostUsd: 0.5,
    estimatedTimeMinutes: 30,
    evidence: [
      {
        claim: 'Registered provider with capability matrix',
        source: 'provider-registry',
        confidence: 'VERIFIED',
      },
    ],
    risks: [],
    humanApprovalPoints: [],
    unavailableCapabilities: ['MUSIC'],
    recommendations: [],
    ...overrides,
  };
}

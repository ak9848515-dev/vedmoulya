import type { CapabilityId } from '@vedmoulya/capability-marketplace';
import type {
  ProviderCandidateFact,
  DiscoveryCandidateFact,
  LocalModelCandidateFact,
  CapabilityEvidence,
} from '@vedmoulya/capability-marketplace';

export const TEXT_GENERATION: CapabilityId = 'TEXT_GENERATION';
export const VIDEO_GENERATION: CapabilityId = 'VIDEO_GENERATION';
export const CODING: CapabilityId = 'CODING';

export function evidence(claim: string, source: string): CapabilityEvidence {
  return { claim, source, confidence: 'VERIFIED' };
}

export function provider(overrides: Partial<ProviderCandidateFact>): ProviderCandidateFact {
  return {
    providerId: 'provider-default',
    family: 'generic',
    name: 'Default Provider',
    capabilities: [TEXT_GENERATION],
    quality: 70,
    costTier: 'medium',
    availability: 1,
    configured: false,
    evidence: [evidence('Baseline capability', 'registry')],
    ...overrides,
  };
}

export function discovery(overrides: Partial<DiscoveryCandidateFact>): DiscoveryCandidateFact {
  return {
    itemId: 'item-default',
    category: 'provider',
    title: 'Default Discovery',
    capabilities: [TEXT_GENERATION],
    freeClass: 'UNKNOWN',
    localAvailability: 'UNKNOWN',
    configurable: false,
    evidence: [],
    securityFlags: [],
    ...overrides,
  };
}

export function localModel(overrides: Partial<LocalModelCandidateFact>): LocalModelCandidateFact {
  return {
    id: 'local-default',
    name: 'Local Default',
    sizeGb: 4,
    runtime: 'ollama',
    capabilities: [TEXT_GENERATION],
    capabilitiesProvenance: 'INFERRED',
    available: true,
    evidence: [evidence('Runs on Ollama', 'runtime')],
    ...overrides,
  };
}

export const FIXED_NOW = '2026-08-11T00:00:00.000Z';
export const STALE_NOW = '2026-10-11T00:00:00.000Z';

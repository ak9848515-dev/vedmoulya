// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Capability Source Ports
// EPIC-013 — adapts the frozen provider registry (+ intelligence), AI World
// discovery and local-model discovery into the narrow CapabilitySourcePort
// the capability planner consumes. No duplicate intelligence: the planner
// only ever sees these normalized facts, and the existing registry/routing/
// discovery layers stay authoritative.
// ─────────────────────────────────────────────────────────────────────────────

import type { DiscoveryApplicationService } from '@vedmoulya/ai-world';
import type {
  CapabilityId,
  CapabilitySourcePort,
  DiscoveryCandidateFact,
  LocalModelCandidateFact,
  ProviderCandidateFact,
} from '@vedmoulya/capability-marketplace';
import type { ProviderApplicationService, LocalModelDiscoveryPort } from '@vedmoulya/providers';
import { currentProviderUser } from '@vedmoulya/providers';

/** Capability → provider AI-feature mapping (registry capabilities use the
 *  @vedmoulya/ai CapabilityType taxonomy; the marketplace graph is broader,
 *  so a capability may map to several AI features or none). */
const CAPABILITY_TO_AI_FEATURES: Record<CapabilityId, string[]> = {
  TEXT_GENERATION: ['content_generation', 'general_conversation'],
  REASONING: ['reasoning'],
  CODING: ['coding'],
  RESEARCH: ['reasoning', 'content_generation'],
  RAG: ['embeddings'],
  VISION: ['vision', 'image_understanding'],
  IMAGE_GENERATION: [],
  VIDEO_GENERATION: [],
  VIDEO_EDITING: [],
  AUDIO_GENERATION: ['speech'],
  TEXT_TO_SPEECH: ['speech'],
  SPEECH_TO_TEXT: ['speech'],
  MUSIC: [],
  AVATAR: [],
  TRANSLATION: ['translation'],
  DOCUMENT_PROCESSING: ['image_understanding'],
  EMBEDDINGS: ['embeddings'],
  WEB_RESEARCH: ['reasoning'],
  BROWSER_AUTOMATION: [],
  CODE_EXECUTION: [],
  DEPLOYMENT: [],
  QUALITY_EVALUATION: ['reasoning'],
  ASSEMBLY: [],
};

/** Capability → AI World keyword signals (discovery items declare free-text
 *  capability strings; the marketplace graph is normalized). */
const CAPABILITY_DISCOVERY_KEYWORDS: Record<CapabilityId, string[]> = {
  TEXT_GENERATION: ['text', 'writing', 'generation', 'content'],
  REASONING: ['reasoning', 'thinking', 'analysis'],
  CODING: ['coding', 'code', 'programming'],
  RESEARCH: ['research', 'search'],
  RAG: ['rag', 'retrieval', 'knowledge'],
  VISION: ['vision', 'image understanding'],
  IMAGE_GENERATION: ['image', 'generation'],
  VIDEO_GENERATION: ['video'],
  VIDEO_EDITING: ['video', 'editing'],
  AUDIO_GENERATION: ['audio'],
  TEXT_TO_SPEECH: ['speech', 'voice', 'tts'],
  SPEECH_TO_TEXT: ['transcription', 'speech'],
  MUSIC: ['music', 'audio'],
  AVATAR: ['avatar'],
  TRANSLATION: ['translation'],
  DOCUMENT_PROCESSING: ['document', 'pdf', 'ocr'],
  EMBEDDINGS: ['embedding', 'vector'],
  WEB_RESEARCH: ['web', 'browser', 'research'],
  BROWSER_AUTOMATION: ['browser', 'automation'],
  CODE_EXECUTION: ['execution', 'code'],
  DEPLOYMENT: ['deployment'],
  QUALITY_EVALUATION: ['evaluation', 'quality'],
  ASSEMBLY: ['assembly', 'workflow'],
};

export interface CapabilitySourcePortsOptions {
  providers: ProviderApplicationService;
  aiWorld: DiscoveryApplicationService;
  /** Local runtime discovery (declared/in-memory by default — fail-safe). */
  localModelDiscovery: LocalModelDiscoveryPort;
}

/**
 * Build the single CapabilitySourcePort from the frozen services. Every
 * candidate fact carries evidence from the authoritative source; nothing
 * is fabricated here.
 */
export function createCapabilitySourcePort(
  options: CapabilitySourcePortsOptions,
): CapabilitySourcePort {
  return {
    providerCandidates: async (capability): Promise<ProviderCandidateFact[]> => {
      const features = CAPABILITY_TO_AI_FEATURES[capability];
      const facts: ProviderCandidateFact[] = [];
      for (const feature of features) {
        const result = await options.providers.listByCapability(
          feature as Parameters<typeof options.providers.listByCapability>[0],
        );
        const providers = 'data' in result ? (result.data ?? []) : [];
        for (const provider of providers) {
          if (facts.some((f) => f.providerId === provider.id)) continue;
          facts.push({
            providerId: provider.id,
            family: provider.family,
            name: provider.name,
            modelId: provider.models[0]?.id,
            modelName: provider.models[0]?.name,
            capabilities: [capability],
            quality: provider.bestQuality > 0 ? provider.bestQuality : undefined,
            costTier: provider.costTier,
            availability: provider.availability,
            configured:
              provider.health.status === 'healthy' || provider.lifecycleStatus === 'active',
            evidence: [
              {
                claim: `Registry provider ${provider.name} supports the required AI features`,
                source: 'provider-registry',
                confidence: 'VERIFIED',
              },
            ],
          });
        }
      }
      return facts;
    },

    discoveryCandidates: async (capability): Promise<DiscoveryCandidateFact[]> => {
      // AI World items are platform-wide but attention state is owner-scoped.
      // The gateway auth middleware runs every request inside
      // runWithProviderUser(ctx.userId) — reuse that request context so the
      // discovery read is scoped to the caller (no cross-user surface).
      const userId = currentProviderUser();
      if (!userId) return [];
      const views = await options.aiWorld.listItems(userId);
      const keywords = CAPABILITY_DISCOVERY_KEYWORDS[capability];
      const items = views.map((v) => v.item);
      return items
        .filter((item) => {
          const text = `${item.title} ${item.capabilities.join(' ')}`.toLowerCase();
          return keywords.some((keyword) => text.includes(keyword));
        })
        .map((item) => ({
          itemId: item.id,
          category: item.category,
          title: item.title,
          capabilities: [capability],
          freeClass: item.freeClass,
          localAvailability: item.localAvailability,
          configurable: item.modelFacts?.configurable === true,
          suggestedFamily: item.modelFacts?.suggestedFamily,
          github: item.github
            ? {
                name: item.github.name,
                license: item.github.license,
                flags: item.github.flags,
              }
            : undefined,
          evidence: item.evidence.map((e) => ({
            claim: e.claim,
            source: e.source,
            sourceUrl: e.sourceUrl,
            confidence: e.confidence,
          })),
          securityFlags: item.securityFlags,
        }));
    },

    localModelCandidates: async (capability): Promise<LocalModelCandidateFact[]> => {
      const result = await options.localModelDiscovery.discover();
      if (!result.discovered) return [];
      const features = CAPABILITY_TO_AI_FEATURES[capability];
      return result.models
        .filter((model) => {
          if (model.capabilities.length === 0) return false;
          return model.capabilities.some((c) => features.includes(c));
        })
        .map((model) => ({
          id: model.id,
          name: model.name,
          sizeGb: model.sizeGb,
          runtime: model.runtime,
          capabilities: [capability],
          capabilitiesProvenance: model.capabilitiesProvenance,
          available: model.status === 'available',
          evidence: [
            {
              claim: `Local model ${model.name} discovered via ${model.runtime}`,
              source: 'local-model-discovery',
              confidence: model.capabilitiesProvenance === 'VERIFIED' ? 'MEASURED' : 'INFERRED',
            },
          ],
        }));
    },
  };
}

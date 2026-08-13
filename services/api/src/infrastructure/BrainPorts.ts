// ──────────────────────────────────────────────────────────────────
// VedMoulya — services/api · Brain gateway ports
// EPIC-016
//
// The ONLY seams the Brain uses to reach the frozen estate from the
// gateway: capability plan (EPIC-013), candidate sources (EPIC-012A/B +
// EPIC-012C), execution (frozen AI orchestration specialist port),
// minimal context, and the preference ledger (EPIC-014).
// No duplicate routing, no duplicate provider configuration.
// ──────────────────────────────────────────────────────────────────

import type {
  ProviderCandidateFact,
  DiscoveryCandidateFact,
  LocalModelCandidateFact,
} from '@vedmoulya/capability-marketplace';
import type {
  BrainPlanPort,
  BrainCandidatePort,
  BrainExecutionPort,
  BrainContextPort,
  BrainPreferencePort,
  BrainUsagePort,
  BrainDiscoveryBridgePort,
  BrainMemoryPort,
} from '@vedmoulya/brain';
import type {
  ProviderUsageFact,
  IntelligenceEvent,
  SecurityClassification,
  BrainOutcomeMemory,
} from '@vedmoulya/brain';
import type { CapabilityMarketplaceApplicationService } from '@vedmoulya/capability-marketplace';
import type { CapabilitySourcePort } from '@vedmoulya/capability-marketplace';
import type { AIOrchestrationService } from '@vedmoulya/services';
import type { InMemoryPreferenceLedger } from '@vedmoulya/execution-bridge';
import { AIOrchestratorSpecialistPort } from '@vedmoulya/loop-engine';
import type { DiscoveryApplicationService, DiscoveryItem } from '@vedmoulya/ai-world';
import type { MemoryApplicationService as MemoryIntelligenceApplicationService } from '@vedmoulya/memory-intelligence';
import type { ProviderExperienceService } from '../services/ProviderExperienceService.js';

export interface BrainPortsDeps {
  capability: CapabilityMarketplaceApplicationService;
  /** The SAME capability source port the planner/execution bridge consume. */
  capabilitySource: CapabilitySourcePort;
  ai: AIOrchestrationService;
  preferenceLedger: InMemoryPreferenceLedger;
  /** EPIC-020 — provider usage/limits evidence (mission §3). */
  providerExperience?: ProviderExperienceService;
  /** EPIC-020 — AI World discovery for the continuous bridge (mission §8). */
  aiWorld?: DiscoveryApplicationService;
  /** EPIC-020 — durable memory feedback (mission §10). */
  memoryIntelligence?: MemoryIntelligenceApplicationService;
}

/** EPIC-013 plan source — the Brain consumes the real capability plan. */
export function createBrainPlanPort(deps: BrainPortsDeps): BrainPlanPort {
  return {
    planFor: async (userId, outcome): Promise<Awaited<ReturnType<BrainPlanPort['planFor']>>> => {
      // The frozen capability service plan() returns the FactoryCapabilityPlan
      // directly (the deterministic planner + optional non-fatal enrichment).
      return deps.capability.plan(userId, { outcome });
    },
  };
}

/** Candidate sources — providers (EPIC-012A/B), AI World (EPIC-012C), local models. */
export function createBrainCandidatePort(deps: BrainPortsDeps): BrainCandidatePort {
  return {
    providerCandidates: async (capability): Promise<ProviderCandidateFact[]> => {
      // Reuse the frozen capability-marketplace source seam (the same one the
      // planner and execution bridge consume) — zero duplication.
      return deps.capabilitySource.providerCandidates(capability);
    },
    discoveryCandidates: async (capability): Promise<DiscoveryCandidateFact[]> => {
      return deps.capabilitySource.discoveryCandidates(capability);
    },
    localModelCandidates: async (capability): Promise<LocalModelCandidateFact[]> => {
      return deps.capabilitySource.localModelCandidates(capability);
    },
  };
}

/** Execution — the frozen AI orchestration specialist port (EPIC-006 reuse). */
export function createBrainExecutionPort(deps: BrainPortsDeps): BrainExecutionPort {
  return {
    execute: async (input): Promise<Awaited<ReturnType<BrainExecutionPort['execute']>>> => {
      // Mirror the frozen createStepExecutionPort adapter: the specialist port
      // wraps the frozen AI orchestration service with token-bounded execution.
      const specialist = new AIOrchestratorSpecialistPort(deps.ai);
      return specialist.execute(input);
    },
  };
}

/** Minimal, task-relevant context — never dumps the user profile. */
export function createBrainContextPort(): BrainContextPort {
  return {
    assemble: (_userId, capabilities): Promise<string> =>
      Promise.resolve(
        `Task-relevant capabilities: ${capabilities.join(', ')}. Minimal authorized context only.`,
      ),
  };
}

// ── EPIC-020 · Provider usage/limits evidence (mission §3) ─────────
// Real, honest facts from the provider experience view model: health
// availability + latency (KNOWN), free-tier status (KNOWN). Quota/
// rate-limit/context-window stay UNKNOWN (absent) unless a provider
// adapter supplies them — never fabricated.
export function createBrainUsagePort(deps: BrainPortsDeps): BrainUsagePort | undefined {
  const providerExperience = deps.providerExperience;
  if (!providerExperience) return undefined;
  return {
    usageFacts: async (userId, providerIds): Promise<ProviderUsageFact[]> => {
      const overview = await providerExperience.getOverview(userId);
      const rows = overview.success ? (overview.data?.providers ?? []) : [];
      const now = new Date().toISOString();
      const facts: ProviderUsageFact[] = [];
      for (const providerId of providerIds) {
        const row = rows.find((r) => r.providerId === providerId);
        if (!row) continue;
        const fact: ProviderUsageFact = { providerId, capturedAt: now };
        if (row.health.status && row.health.status !== 'unknown') {
          const availability =
            row.availability === 'AVAILABLE'
              ? 1
              : row.availability === 'LIMITED'
                ? 0.6
                : row.availability === 'UNAVAILABLE'
                  ? 0
                  : 0.5;
          fact.availability = { value: availability, status: 'KNOWN' };
          if (row.health.latencyMs > 0) {
            fact.latencyMs = { value: row.health.latencyMs, status: 'KNOWN' };
          }
        }
        if (row.freeToUse) {
          fact.freeTierStatus = { value: 'free', status: 'KNOWN' };
        }
        facts.push(fact);
      }
      return facts;
    },
  };
}

// ── EPIC-020 · Continuous AI World → Brain bridge (mission §8) ─────
// Screens the frozen AI World discovery surface (important / recommended /
// github / updates) into security-tagged intelligence events. Discovery
// stays in @vedmoulya/ai-world; the Brain only consumes the events.
export function createBrainDiscoveryBridgePort(
  deps: BrainPortsDeps,
): BrainDiscoveryBridgePort | undefined {
  const aiWorld = deps.aiWorld;
  if (!aiWorld) return undefined;
  return {
    fetchIntelligenceEvents: async (userId): Promise<IntelligenceEvent[]> => {
      const world = await aiWorld.getWorld(userId);
      const items = [
        ...world.world.important,
        ...world.world.recommended,
        ...world.world.github,
        ...world.world.updates,
      ];
      const seen = new Set<string>();
      const now = new Date().toISOString();
      const events: IntelligenceEvent[] = [];
      for (const item of items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        const kind = classifyEventKind(item);
        if (!kind) continue;
        const security = classifySecurity(item);
        events.push({
          id: `aiworld-${item.id}`,
          userId,
          kind,
          title: item.title,
          description: item.summary || item.title,
          relevance:
            item.relevanceLabel === 'high' ? 0.9 : item.relevanceLabel === 'medium' ? 0.6 : 0.35,
          security,
          evidence: item.evidence.map((e) => e.claim).slice(0, 4),
          adoptionRequired: [],
          source: 'ai-world',
          createdAt: now,
          status: 'NEW',
        });
      }
      return events;
    },
  };
}

/** AI World item category → Brain intelligence event kind (evidence-honest). */
function classifyEventKind(item: DiscoveryItem): IntelligenceEvent['kind'] | undefined {
  if (item.category === 'github') return 'NEW_GITHUB_REPOSITORY';
  if (item.category === 'model') return 'NEW_MODEL';
  if (item.category === 'provider') {
    const t = `${item.title} ${item.summary}`.toLowerCase();
    if (/price|pricing|cost/.test(t)) return 'PRICING_CHANGE';
    if (/deprecat|sunset|end\s*of\s*life/.test(t)) return 'MODEL_DEPRECATION';
    return 'PROVIDER_CHANGE';
  }
  if (item.category === 'application') {
    const t = `${item.title} ${item.summary}`.toLowerCase();
    if (/free\s*(api|tier|quota)/.test(t)) return 'NEW_FREE_API';
    return 'NEW_OPEN_SOURCE_TOOL';
  }
  // The remaining union member after github/model/provider/application is 'news'.
  const t = `${item.title} ${item.summary}`.toLowerCase();
  if (/free|quota|tier/.test(t)) return 'NEW_FREE_TIER';
  if (/security|vulnerab|breach|exploit/.test(t)) return 'SECURITY_CONCERN';
  return 'ECOSYSTEM_DEVELOPMENT';
}

/** Security-first classification (mission §9 — never "safe" because nothing was found). */
function classifySecurity(item: DiscoveryItem): SecurityClassification {
  const flags = item.securityFlags.map((f) => f.toLowerCase());
  if (flags.some((f) => f.includes('block') || f.includes('critical'))) return 'BLOCKED';
  if (flags.some((f) => f.includes('suspicious'))) return 'SUSPICIOUS';
  if (flags.length > 0) return 'SECURITY_REVIEW_REQUIRED';
  if (item.category === 'github') {
    if (item.github?.flags.includes('suspicious')) return 'SUSPICIOUS';
    if (item.github?.license === undefined || item.github.licenseConfidence === 'UNKNOWN')
      return 'UNKNOWN';
    if (
      item.github.flags.includes('unclear_license') ||
      item.github.flags.includes('security_concerns')
    ) {
      return 'SECURITY_REVIEW_REQUIRED';
    }
    return 'TRUSTED_WITH_REVIEW';
  }
  // Scanned with no blocking indicators — reviewed, never a blanket "safe".
  return 'TRUSTED_WITH_REVIEW';
}

// ── EPIC-020 · Durable memory feedback (mission §10) ───────────────
// Structured outcome evidence into the frozen Memory Intelligence
// capture pipeline (decisions + provenance + concise reasons only).
// Non-fatal: failures are tolerated — the in-memory outcome store
// remains the Brain's primary learning feed.
export function createBrainMemoryPort(deps: BrainPortsDeps): BrainMemoryPort | undefined {
  const memoryIntelligence = deps.memoryIntelligence;
  if (!memoryIntelligence) return undefined;
  return {
    recordOutcome: async (memory: BrainOutcomeMemory): Promise<void> => {
      try {
        await memoryIntelligence.capture({
          type: 'learning',
          title: `Brain outcome — ${memory.taskType}`,
          content:
            `${memory.outcome} — ` +
            `providers: ${memory.providers.map((p) => `${p.providerId}:${p.succeeded ? 'ok' : 'fail'}`).join(', ') || 'none'}. ` +
            memory.selectedReason.join(' '),
          source: 'brain',
          sourceType: 'decision',
          owner: memory.userId,
          relatedTask: memory.taskId,
          relatedCapability: memory.taskType,
          confidence: { score: memory.outcome === 'SUCCESS' ? 0.9 : 0.6 },
          tags: ['brain', 'outcome', memory.outcome.toLowerCase()],
          pipeline: false,
        });
      } catch {
        // Non-fatal — the Brain's in-memory outcome store still holds it.
      }
    },
  };
}

/** Preference ledger — EPIC-014 reuse (sync in-memory store). */
export function createBrainPreferencePort(ledger: InMemoryPreferenceLedger): BrainPreferencePort {
  return {
    record: (event): Promise<void> => {
      const full: Parameters<typeof ledger.record>[0] = {
        eventId: `brain-${Math.random().toString(36).slice(2, 10)}`,
        timestamp: new Date().toISOString(),
        ...event,
      };
      ledger.record(full);
      return Promise.resolve();
    },
  };
}

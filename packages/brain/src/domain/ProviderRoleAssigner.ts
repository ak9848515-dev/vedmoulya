// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · ProviderRoleAssigner
// EPIC-016 §7/§8 — N-provider orchestration + role assignment.
//
// Never choose N arbitrarily. N derives from: task complexity,
// capability requirements, quality target, evidence requirement,
// provider diversity, latency, budget, availability, user preferences.
// Each provider gets a ROLE — never "ask every provider the same
// question". Selection uses measured capability evidence only.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityId } from '@vedmoulya/capability-marketplace';
import type { ProviderCandidateFact } from '@vedmoulya/capability-marketplace';
import type { ProviderRole, ProviderRoleAssignment, BrainMode } from '../types/brain-types.js';
import type { ProviderPerformanceScore } from '../types/continuous-types.js';

/** Default role per capability (evidence-backed, capability-first). */
export const CAPABILITY_DEFAULT_ROLE: Record<string, ProviderRole> = {
  TEXT_GENERATION: 'WRITER',
  REASONING: 'PRIMARY_REASONER',
  CODING: 'CODER',
  RESEARCH: 'RESEARCHER',
  RAG: 'ANALYST',
  VISION: 'VISION_ANALYZER',
  IMAGE_GENERATION: 'SPECIALIST',
  VIDEO_GENERATION: 'SPECIALIST',
  AUDIO_GENERATION: 'SPECIALIST',
  TEXT_TO_SPEECH: 'SPECIALIST',
  SPEECH_TO_TEXT: 'SPECIALIST',
  MUSIC: 'SPECIALIST',
  TRANSLATION: 'SPECIALIST',
  DOCUMENT_PROCESSING: 'ANALYST',
  EMBEDDINGS: 'ANALYST',
  WEB_RESEARCH: 'RESEARCHER',
  BROWSER_AUTOMATION: 'SPECIALIST',
  CODE_EXECUTION: 'CODER',
  DEPLOYMENT: 'SPECIALIST',
};

/** Local-inference families (Ollama / LM Studio / OpenAI-compatible local). */
const LOCAL_FAMILIES = new Set(['ollama', 'lmstudio', 'lm-studio', 'local']);

export interface RoleAssignmentOptions {
  mode: BrainMode;
  qualityTarget: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  /** User-selected provider/model override (respected, never silently replaced). */
  userPreferredProviderId?: string;
  /**
   * SPRINT-025 — ADVISORY verified-experience signals (provider × capability
   * quality from the existing AdaptiveScoreLedger). These NEVER override
   * quality-first selection or user preference: they only break quality ties
   * and inform the reason string. Learning can never override security,
   * approval, budget, quality requirements or user constraints.
   */
  experienceScores?: ProviderPerformanceScore[];
}

export interface LocalModelFact {
  id: string;
  name: string;
  capabilities: CapabilityId[];
  available: boolean;
}

/** Verified-experience quality for a candidate (0 when none exists). */
function experienceQuality(
  candidate: ProviderCandidateFact,
  scores: ProviderPerformanceScore[] | undefined,
): number {
  if (!scores || scores.length === 0) return 0;
  const found = scores.find((s) => s.providerId === candidate.providerId);
  if (!found) return 0;
  return found.sampleCount > 0 ? found.qualityScore : 0;
}

/**
 * Determines N and assigns roles. Deterministic; quality-first.
 * A paid candidate never wins merely for being paid; a free candidate
 * never beats a materially superior one when quality is required.
 */
export class ProviderRoleAssigner {
  assign(
    capability: CapabilityId,
    candidates: ProviderCandidateFact[],
    opts: RoleAssignmentOptions,
  ): { assignment: ProviderRoleAssignment; considered: number } {
    // eslint-disable-next-line security/detect-object-injection -- Closed CAPABILITY_DEFAULT_ROLE record keyed by the capability union; never user-controlled.
    const defaultRole = CAPABILITY_DEFAULT_ROLE[capability] ?? 'SPECIALIST';

    if (candidates.length === 0) {
      throw new BrainNoCandidatesError(capability);
    }

    // Explicit user selection wins unless unavailable/unsafe.
    const userPick =
      opts.userPreferredProviderId !== undefined
        ? candidates.find((c) => c.providerId === opts.userPreferredProviderId)
        : undefined;
    const selected = userPick ?? this.selectBest(candidates, capability, opts);

    // N determination: DEEP_RESEARCH / QUALITY / complex tasks may use
    // multiple independent providers for the SAME capability; others use one.
    const n = this.determineN(capability, candidates, opts);

    const assignment: ProviderRoleAssignment = {
      capability,
      role: n > 1 ? 'RESEARCHER' : defaultRole,
      providerId: selected.providerId,
      providerName: selected.name,
      modelId: selected.modelId,
      quality: selected.quality,
      reason: userPick
        ? `User-selected provider respected (${selected.providerId}).`
        : this.reasonFor(selected, capability),
      evidence: selected.evidence.map((e) => e.claim),
    };

    return { assignment, considered: candidates.length };
  }

  /** Number of independent providers a task should consult (N). */
  determineN(
    capability: CapabilityId,
    candidates: ProviderCandidateFact[],
    opts: RoleAssignmentOptions,
  ): number {
    if (candidates.length <= 1) return 1;
    if (opts.mode === 'DEEP_RESEARCH' && capability === 'RESEARCH') {
      return Math.min(3, candidates.length); // independent research, bounded
    }
    if (opts.mode === 'QUALITY' && opts.qualityTarget === 'HIGH') {
      return Math.min(2, candidates.length); // independent verification pair
    }
    return 1;
  }

  /**
   * EPIC-020 — N-provider realization. Returns up to N independent
   * assignments for ONE capability (N from determineN: DEEP_RESEARCH →
   * up to 3 independent RESEARCHERs; QUALITY+HIGH → an independent
   * verification pair). The first pick is the quality-first best (or the
   * user pick); the rest are distinct next-best providers with reviewer
   * roles. This is what makes "N providers for ONE user task" real —
   * `assign` above remains the single-assignment view.
   */
  assignMany(
    capability: CapabilityId,
    candidates: ProviderCandidateFact[],
    opts: RoleAssignmentOptions,
  ): { assignments: ProviderRoleAssignment[]; considered: number } {
    if (candidates.length === 0) {
      throw new BrainNoCandidatesError(capability);
    }
    // eslint-disable-next-line security/detect-object-injection -- Closed CAPABILITY_DEFAULT_ROLE record keyed by the capability union.
    const defaultRole = CAPABILITY_DEFAULT_ROLE[capability] ?? 'SPECIALIST';

    // Ranked pool (quality-first; free/local preference applied per pick).
    const ranked = this.ranked(candidates);
    const userPick =
      opts.userPreferredProviderId !== undefined
        ? candidates.find((c) => c.providerId === opts.userPreferredProviderId)
        : undefined;
    const n = this.determineN(capability, candidates, opts);

    const picks: ProviderCandidateFact[] = [];
    const pickBest = (): ProviderCandidateFact | undefined => {
      const needsQuality = opts.qualityTarget === 'HIGH' && opts.mode !== 'COST_SENSITIVE';
      const pool = ranked.filter((c) => !picks.some((p) => p.providerId === c.providerId));
      if (pool.length === 0) return undefined;
      if (!needsQuality) {
        const freeLocal = pool.find(
          (c) => c.costTier === 'free' || LOCAL_FAMILIES.has(c.family.toLowerCase()),
        );
        if (freeLocal) return freeLocal;
      }
      return pool[0];
    };

    picks.push(userPick ?? (pickBest() as ProviderCandidateFact));
    for (let i = 1; i < n; i++) {
      const next = pickBest();
      if (!next) break;
      picks.push(next);
    }

    const deepResearch = opts.mode === 'DEEP_RESEARCH' && capability === 'RESEARCH';
    const qualityPair = opts.mode === 'QUALITY' && opts.qualityTarget === 'HIGH';
    const assignments: ProviderRoleAssignment[] = picks.map((candidate, i) => {
      const role: ProviderRole =
        picks.length === 1
          ? deepResearch
            ? 'RESEARCHER'
            : defaultRole
          : deepResearch
            ? 'RESEARCHER'
            : qualityPair && i > 0
              ? 'CRITIC'
              : 'RESEARCHER';
      const isPrimary = i === 0;
      return {
        capability,
        role,
        providerId: candidate.providerId,
        providerName: candidate.name,
        modelId: candidate.modelId,
        quality: candidate.quality,
        reason:
          userPick && isPrimary
            ? `User-selected provider respected (${candidate.providerId}).`
            : this.reasonFor(candidate, capability),
        evidence: candidate.evidence.map((e) => e.claim),
      };
    });

    return { assignments, considered: candidates.length };
  }

  /** Ranked pool (quality desc, availability tiebreak). */
  private ranked(candidates: ProviderCandidateFact[]): ProviderCandidateFact[] {
    return [...candidates].sort((a, b) => {
      const qa = a.quality ?? 0;
      const qb = b.quality ?? 0;
      if (qb !== qa) return qb - qa;
      return b.availability - a.availability;
    });
  }

  /** Local candidate → role assignment (used only when a local model is actually available). */
  assignLocal(
    capability: CapabilityId,
    local: LocalModelFact,
    mode: BrainMode,
  ): ProviderRoleAssignment {
    return {
      capability,
      // eslint-disable-next-line security/detect-object-injection -- Closed CAPABILITY_DEFAULT_ROLE record keyed by the capability union.
      role: CAPABILITY_DEFAULT_ROLE[capability] ?? 'SPECIALIST',
      providerId: `local-${local.id}`,
      providerName: local.name,
      quality: undefined,
      reason:
        mode === 'PRIVATE_LOCAL'
          ? 'PRIVATE_LOCAL mode — local model preferred for private work.'
          : 'Local model available and selected (never assumed for private data without mode).',
      evidence: [],
    };
  }

  private selectBest(
    candidates: ProviderCandidateFact[],
    capability: CapabilityId,
    opts: RoleAssignmentOptions,
  ): ProviderCandidateFact {
    // Quality-first: sort by measured quality (desc), evidence-backed.
    const ranked = [...candidates].sort((a, b) => {
      const qa = a.quality ?? 0;
      const qb = b.quality ?? 0;
      if (qb !== qa) return qb - qa;
      return b.availability - a.availability;
    });
    const best = ranked[0] as ProviderCandidateFact;

    // Free/local preference applies ONLY when quality is above the task
    // threshold — never when it would sacrifice required quality.
    const needsQuality = opts.qualityTarget === 'HIGH' && opts.mode !== 'COST_SENSITIVE';
    if (!needsQuality) {
      const freeLocal = ranked.find(
        (c) => c.costTier === 'free' || LOCAL_FAMILIES.has(c.family.toLowerCase()),
      );
      if (freeLocal) return freeLocal;
    }

    // SPRINT-025 — ADVISORY tie-break: when two candidates share the SAME
    // measured quality (within epsilon), prefer the one with the stronger
    // VERIFIED experience signal (provider × capability). This never
    // outranks quality-first — it only resolves ties. No evidence = no effect.
    const scores = opts.experienceScores;
    if (scores && scores.length > 0) {
      const top = ranked[0];
      if (top) {
        const topQuality = top.quality ?? 0;
        const tied = ranked.filter((c) => Math.abs((c.quality ?? 0) - topQuality) < 1e-9);
        if (tied.length > 1) {
          const bestTied = [...tied].sort(
            (a, b) =>
              experienceQuality(b, scores) - experienceQuality(a, scores) ||
              b.availability - a.availability,
          )[0];
          if (bestTied) return bestTied;
        }
      }
    }
    return best;
  }

  private reasonFor(candidate: ProviderCandidateFact, capability: CapabilityId): string {
    const parts: string[] = [];
    if (candidate.quality !== undefined)
      parts.push(`measured quality ${candidate.quality.toFixed(2)}`);
    parts.push(`${candidate.costTier} cost tier`);
    if (LOCAL_FAMILIES.has(candidate.family.toLowerCase())) parts.push('runs locally');
    if (candidate.costTier === 'free') parts.push('free');
    parts.push(`capability ${capability}`);
    return `Selected for ${capability} — ${parts.join(', ')}.`;
  }
}

export class BrainNoCandidatesError extends Error {
  constructor(capability: CapabilityId) {
    super(`No candidates available for capability ${capability}`);
    this.name = 'BrainNoCandidatesError';
  }
}

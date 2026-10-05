// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya · S5.1 — Opportunity qualification
//
// Answers exactly one question:
//
//     "Is this opportunity worth PRESENTING to the user?"
//
// It does NOT answer "should we accept this?" and it holds no commitment
// power. Qualification cannot approve, cannot create a Mission, cannot bid and
// cannot contact anyone. Its only structural effect is the legal lifecycle
// step DISCOVERED → ASSESSED, which is a state change and NOT an approval.
//
// There is no second scoring system here. The score comes from the EXISTING
// `BusinessOpportunityAssessor` (packages/proactive), already wired into the
// control plane and the world model, and market context comes from the
// EXISTING `RelevanceScorer` (packages/ai-world). We only supply evidence:
//   • required capabilities — stated by the source, stored on the record
//   • available capabilities + related work — the owner's real Brain tasks
//   • market signals — RelevanceScorer, only when raw discovery items exist
// Every input is evidence the system actually holds. Nothing is invented, and
// the assessor is explicitly designed to report no fit rather than fabricate
// when evidence is absent.
// ─────────────────────────────────────────────────────────────────────────────

import { BusinessOpportunityAssessor } from '@vedmoulya/proactive';
import type { BrainApplicationService } from '@vedmoulya/brain';
import { RelevanceScorer } from '@vedmoulya/ai-world';
import type { RawDiscoveryItem } from '@vedmoulya/ai-world';
import type { OpportunityLifecycleRecord } from '@vedmoulya/control-plane';

/** The canonical assessment type, taken from the existing assessor's own
 *  signature — no new result type, no OpportunityQualificationV2. */
export type BusinessAssessment = ReturnType<BusinessOpportunityAssessor['assess']>;

/** What qualification produced. */
export interface OpportunityQualification {
  assessment: BusinessAssessment;
  /** The evidence the assessor actually consumed, so the verdict is auditable. */
  inputsUsed: {
    requiredCapabilities: number;
    availableCapabilities: number;
    relatedWork: number;
    marketSignals: number;
  };
  /** Always true — restated so no caller can mistake this for an approval. */
  authorizationRequired: true;
  /** False by construction: qualification never approves. */
  approved: false;
}

export interface OpportunityQualificationDeps {
  brain: BrainApplicationService;
  /** Optional market evidence. Absent → no market signal, never a guess. */
  rawDiscoveryItems?: () => RawDiscoveryItem[];
  now: () => string;
}

/** Capability-ish tokens from a Brain task objective. Deliberately crude and
 *  bounded: a spurious token only lowers capabilityFit, and an empty set makes
 *  the assessor report no fit rather than invent some. */
function capabilitiesFromObjective(objective: string): string[] {
  return objective
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((t) => t.length >= 3 && t.length <= 24)
    .slice(0, 8);
}

export function createOpportunityQualifier(deps: OpportunityQualificationDeps): {
  qualify(record: OpportunityLifecycleRecord): OpportunityQualification;
} {
  const assessor = new BusinessOpportunityAssessor();
  const relevance = new RelevanceScorer();

  return {
    qualify(record: OpportunityLifecycleRecord): OpportunityQualification {
      const requiredCapabilities = record.requiredCapabilities ?? [];

      // Real owner evidence: what the owner has actually worked on.
      const tasks = deps.brain.listTasks(record.ownerId);
      const relatedWork = tasks.success
        ? (tasks.data ?? []).map((t) => ({
            objective: t.objective,
            status: t.status,
            createdAt: t.createdAt,
          }))
        : [];

      // Available capabilities are the vocabulary the owner has demonstrably
      // used — never a declared wish list.
      const availableCapabilities = Array.from(
        new Set(relatedWork.flatMap((w) => capabilitiesFromObjective(w.objective))),
      );

      // Market relevance uses the EXISTING scorer, and only when raw discovery
      // items exist. No items → no signal, not a zero dressed as a score.
      const marketSignals = (deps.rawDiscoveryItems?.() ?? []).slice(0, 10).map((item) => {
        const r = relevance.score(item, { now: () => new Date(deps.now()) });
        return {
          title: item.title,
          relevance: r.score,
          createdAt: item.publishedAt ?? deps.now(),
        };
      });

      const assessment = assessor.assess({
        ownerId: record.ownerId,
        title: record.title,
        description: record.description,
        availableCapabilities,
        requiredCapabilities,
        relatedWork,
        marketSignals,
        now: deps.now,
      });

      return {
        assessment,
        inputsUsed: {
          requiredCapabilities: requiredCapabilities.length,
          availableCapabilities: availableCapabilities.length,
          relatedWork: relatedWork.length,
          marketSignals: marketSignals.length,
        },
        // Structural, not advisory: this type cannot express approval.
        authorizationRequired: true,
        approved: false,
      };
    },
  };
}

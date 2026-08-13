// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · OpportunityIntelligence
// EPIC-020 §12 — Opportunity intelligence.
//
// A narrow, evidence-based detector that turns AI World discoveries
// and completed task outcomes into opportunities WITHOUT promising
// income: every opportunity carries evidence and an explicit
// uncertainty score. Categories: earning · freelance · automation ·
// career · business · productivity · cost_saving. No fabricated
// value — estimatedValue appears only when evidence exists.
// ──────────────────────────────────────────────────────────────────

import type {
  IntelligenceEvent,
  Opportunity,
  OpportunityCategory,
} from '../types/continuous-types.js';
import type { BrainTask } from '../types/brain-types.js';

export interface OutcomeOpportunityInput {
  task: BrainTask;
  outputAccepted: boolean;
  capturedAt: string;
}

const RECURRENCE_HINTS = /automate|automation|daily|weekly|monthly|recurring|every\s+\d+/i;

/** Category + title for each event kind (evidence-driven, conservative). */
const EVENT_MAP: Partial<
  Record<
    IntelligenceEvent['kind'],
    { category: OpportunityCategory; title: (event: IntelligenceEvent) => string }
  >
> = {
  NEW_FREE_API: {
    category: 'cost_saving',
    title: (e) => `New free API — ${e.title}`,
  },
  NEW_FREE_TIER: {
    category: 'cost_saving',
    title: (e) => `New free tier — ${e.title}`,
  },
  NEW_GITHUB_REPOSITORY: {
    category: 'automation',
    title: (e) => `Open-source option — ${e.title}`,
  },
  NEW_OPEN_SOURCE_TOOL: {
    category: 'productivity',
    title: (e) => `Open-source tool — ${e.title}`,
  },
  NEW_MODEL: {
    category: 'productivity',
    title: (e) => `New model — ${e.title}`,
  },
  PROVIDER_CHANGE: {
    category: 'business',
    title: (e) => `Provider change — ${e.title}`,
  },
  PRICING_CHANGE: {
    category: 'cost_saving',
    title: (e) => `Pricing change — ${e.title}`,
  },
};

export class OpportunityIntelligence {
  /** Opportunities from screened AI World / scheduler events. */
  detectFromEvents(userId: string, events: IntelligenceEvent[], capturedAt: string): Opportunity[] {
    const opportunities: Opportunity[] = [];
    for (const event of events) {
      if (event.status === 'DISMISSED') continue;
      if (event.security === 'BLOCKED' || event.security === 'SUSPICIOUS') continue;
      if (event.kind === 'SECURITY_CONCERN' || event.kind === 'MODEL_DEPRECATION') continue;

      const mapping = EVENT_MAP[event.kind];
      if (!mapping) continue;

      // Uncertainty: relevance evidence plus security posture. A resource
      // that still needs security review is never presented as a promise.
      let uncertainty = 0.45 + (1 - event.relevance) * 0.35;
      if (event.security === 'SECURITY_REVIEW_REQUIRED')
        uncertainty = Math.min(0.95, uncertainty + 0.2);
      if (event.security === 'UNKNOWN') uncertainty = Math.min(0.95, uncertainty + 0.15);
      uncertainty = Math.round(uncertainty * 100) / 100;

      opportunities.push({
        id: `opp-${event.id}`,
        userId,
        category: mapping.category,
        title: mapping.title(event),
        description: `${event.description} Evidence-backed discovery from ${event.source}.`,
        evidence:
          event.evidence.length > 0 ? event.evidence.slice(0, 4) : ['discovery evidence pending'],
        uncertainty,
        source: event.source === 'scheduler-run' ? 'scheduler-run' : 'ai-world-discovery',
        createdAt: capturedAt,
        status: 'NEW',
        // ── Money intelligence §3 — conservative, evidence-only ──
        // Capabilities are never invented: free APIs map to the AI
        // capability families they actually serve when the event carries
        // a capability tag; otherwise the field stays absent.
        ...(event.capabilities && event.capabilities.length > 0
          ? { requiredCapabilities: event.capabilities.slice(0, 4) }
          : {}),
        risk:
          event.security === 'SECURITY_REVIEW_REQUIRED' || event.security === 'TRUSTED_WITH_REVIEW'
            ? 'MEDIUM'
            : event.security === 'UNKNOWN'
              ? 'UNKNOWN'
              : 'LOW',
        approvalRequirement:
          event.security === 'SECURITY_REVIEW_REQUIRED' ||
          event.security === 'TRUSTED_WITH_REVIEW' ||
          event.security === 'UNKNOWN'
            ? 'security review before use'
            : undefined,
        recommendedNextAction: `Review "${event.title.slice(0, 60)}" — verify relevance and security before adopting.`,
      });
    }
    return opportunities;
  }

  /**
   * Opportunities from a completed task outcome. Deliberately conservative:
   * only a task whose objective expresses recurrence/automation intent AND
   * that completed with user acceptance becomes an automation opportunity —
   * a single anecdote is never presented as income.
   */
  detectFromOutcome(userId: string, input: OutcomeOpportunityInput): Opportunity[] {
    if (!input.outputAccepted) return [];
    if (input.task.status !== 'COMPLETED') return [];
    if (!RECURRENCE_HINTS.test(input.task.objective)) return [];

    const capabilities = input.task.requiredCapabilities.join('+');
    return [
      {
        id: `opp-${input.task.id}-automation`,
        userId,
        category: 'automation',
        title: `Automate recurring "${capabilities}" work`,
        description: `This task ("${input.task.objective.slice(0, 80)}") was completed and accepted; it looks repeatable.`,
        evidence: [
          `task ${input.task.id} completed`,
          `user accepted the output`,
          `objective expresses recurrence (${capabilities})`,
        ],
        uncertainty: 0.55,
        estimatedValue: { label: 'estimated time saved, unverified', status: 'UNKNOWN' },
        source: 'task-outcome',
        createdAt: input.capturedAt,
        status: 'NEW',
        // ── Money intelligence §3 — evidence-only ──
        requiredCapabilities: input.task.requiredCapabilities.slice(0, 4),
        risk: 'LOW',
        recommendedNextAction: 'Schedule this recurring task so VedMoulya can run it for you.',
      },
    ];
  }
}

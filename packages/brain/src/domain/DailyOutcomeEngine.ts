// ──────────────────────────────────────────────────────────────────
// VedMoulya — Brain · DailyOutcomeEngine
// EPIC-020 (Outcome & Revenue layer) — mission §8.
//
// Answers: "What are the most valuable things I should do today?"
//
// Composes ONLY existing owner-scoped data (tasks, opportunities,
// intelligence events) through a narrow read — no new engines, no
// duplicated stores. Ranking is delegated to the transparent
// OutcomePriorityEngine (quality > cost, evidence > invention).
//
// Output is short and actionable: TODAY'S TOP 5 — never a dashboard.
// ──────────────────────────────────────────────────────────────────

import {
  OutcomePriorityEngine,
  type RankableAction,
  type RankedAction,
} from './OutcomePriorityEngine.js';
import type { BrainTask } from '../types/brain-types.js';
import type { IntelligenceEvent, Opportunity } from '../types/continuous-types.js';

export interface DailyOutcomeInput {
  tasks: BrainTask[];
  opportunities: Opportunity[];
  events: IntelligenceEvent[];
}

const MONEY_CATEGORIES = new Set(['earning', 'freelance', 'business']);
const SAVE_CATEGORIES = new Set(['cost_saving']);

export class DailyOutcomeEngine {
  private readonly ranker = new OutcomePriorityEngine();

  /** Build today's ranked actions (default Top 5). */
  plan(input: DailyOutcomeInput, limit = 5): RankedAction[] {
    const candidates: RankableAction[] = [
      ...this.fromApprovals(input.tasks),
      ...this.fromTasks(input.tasks),
      ...this.fromOpportunities(input.opportunities),
      ...this.fromEvents(input.events),
    ];
    return this.ranker.rank(candidates, limit);
  }

  // ── Pending approvals — the most important surface ──────────────
  private fromApprovals(tasks: BrainTask[]): RankableAction[] {
    return tasks
      .filter((t) => t.approvalRequired.length > 0)
      .map((t) => ({
        id: `approval-${t.id}`,
        title: `Approve: ${t.objective.slice(0, 90)}`,
        category: 'APPROVAL' as const,
        whyItMatters: [
          `A sensitive action on "${t.objective.slice(0, 60)}" is waiting for your explicit approval.`,
        ],
        recommendedNextAction: `Review and approve/reject: ${t.approvalRequired.join(', ')}`,
        priority: 'HIGH' as const,
        requiresApproval: t.approvalRequired.join(', '),
        impact: 0.95,
        feasibility: 1,
        evidence: 0.9,
        quality: 0.8,
        userFit: 1,
        source: { kind: 'task' as const, id: t.id },
      }));
  }

  // ── Active / in-flight tasks — continue the work ────────────────
  private fromTasks(tasks: BrainTask[]): RankableAction[] {
    return tasks
      .filter(
        (t) =>
          t.status === 'RUNNING' ||
          t.status === 'VERIFYING' ||
          t.status === 'NEW' ||
          t.status === 'PLANNED',
      )
      .map((t) => ({
        id: `task-${t.id}`,
        title: `Continue: ${t.objective.slice(0, 90)}`,
        category: 'CONTINUE' as const,
        whyItMatters: [`In-flight Brain task at stage ${t.stage}.`],
        recommendedNextAction: `Resume the Brain pipeline for "${t.objective.slice(0, 60)}".`,
        priority: t.intent.urgency === 'HIGH' ? ('HIGH' as const) : ('MEDIUM' as const),
        impact: 0.6,
        feasibility: 0.9,
        evidence: 0.6,
        quality: 0.6,
        userFit: 0.9,
        source: { kind: 'task' as const, id: t.id },
      }));
  }

  // ── Opportunities — money / savings / automation / career ───────
  private fromOpportunities(opportunities: Opportunity[]): RankableAction[] {
    const active = opportunities.filter((o) => o.status === 'NEW' || o.status === 'RECOMMENDED');
    return active.map((o) => {
      const isMoney = MONEY_CATEGORIES.has(o.category);
      const isSaving = SAVE_CATEGORIES.has(o.category);
      return {
        id: `opp-${o.id}`,
        title: o.title,
        category: this.categoryFor(o.category),
        whyItMatters: [
          `${isMoney ? 'Potential earning/business opportunity' : isSaving ? 'Cost-saving opportunity' : 'Capability opportunity'} — ${o.description.slice(0, 90)}`,
        ],
        recommendedNextAction: `Review the opportunity "${o.title.slice(0, 60)}" and accept, plan or dismiss it.`,
        priority: isMoney ? ('HIGH' as const) : ('MEDIUM' as const),
        moneyValue: isMoney
          ? { category: 'MONEY', label: 'unquantified earning potential', status: 'UNKNOWN' }
          : undefined,
        timeValue:
          o.category === 'automation'
            ? { category: 'TIME', label: 'recurring work savings', status: 'UNKNOWN' }
            : undefined,
        impact: isMoney ? 0.9 : isSaving ? 0.7 : 0.55,
        feasibility: 0.6,
        evidence: Math.min(1, 0.5 + (1 - o.uncertainty)),
        quality: 0.6,
        userFit: 0.7,
        costClass: 'free',
        uncertainty: o.uncertainty,
        source: { kind: 'opportunity' as const, id: o.id },
      };
    });
  }

  // ── Screened AI World discoveries — new free/local capabilities ─
  private fromEvents(events: IntelligenceEvent[]): RankableAction[] {
    return events
      .filter((e) => e.status === 'NEW' || e.status === 'REVIEWED')
      .filter((e) => e.security !== 'BLOCKED' && e.security !== 'SUSPICIOUS')
      .slice(0, 10)
      .map((e) => ({
        id: `event-${e.id}`,
        title: e.title,
        category:
          e.kind === 'NEW_FREE_API' || e.kind === 'NEW_FREE_TIER' || e.kind === 'PRICING_CHANGE'
            ? ('COST_SAVING' as const)
            : ('PRODUCT' as const),
        whyItMatters: [`AI World discovery: ${e.description.slice(0, 90)}`],
        recommendedNextAction: `Review the discovery "${e.title.slice(0, 60)}" — adoption requires your approval.`,
        priority: 'LOW' as const,
        impact: 0.4,
        feasibility: 0.7,
        evidence: e.relevance,
        quality: 0.5,
        userFit: 0.5,
        costClass: 'free',
        uncertainty: 1 - e.relevance,
        source: { kind: 'event' as const, id: e.id },
      }));
  }

  private categoryFor(opportunityCategory: Opportunity['category']): RankableAction['category'] {
    switch (opportunityCategory) {
      case 'earning':
      case 'freelance':
      case 'business':
        return 'EARNING';
      case 'career':
        return 'CAREER';
      case 'automation':
        return 'AUTOMATION';
      case 'cost_saving':
        return 'COST_SAVING';
      case 'productivity':
        return 'PRODUCT';
      default:
        return 'UNKNOWN';
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Proactive Intelligence · ProactiveIntelligenceService
// SPRINT-029 — the ONLY composition seam. Turns existing intelligence (Brain
// opportunities, daily priorities, task history, outcome memory, AI-world
// events) into structured recommendations. Every recommendation is
// evidence-only, owner-scoped, deduplicated (stable-key) and authorization-
// aware (sensitive actions are class C — the existing approval authority
// decides; nothing runs on proposal alone).
//
// NO new engine: no discovery authority (rides brain.discoverIntelligence),
// no provider selection (composes the capability marketplace surface), no
// approval (the existing authority decides), no execution (the existing
// execution bridge), no memory/learning (interaction artifacts only).
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ProactiveBrainPort,
  ProactiveCapabilityPort,
  ProactiveRecommendationStore,
} from '../contracts/proactive-ports.js';
import type {
  ProactiveRecommendation,
  RecommendationCategory,
  AutomationWorkflow,
  BusinessOpportunityAssessment,
  DailyBriefing,
} from '../types/proactive-types.js';
import { AutomationDiscovery } from '../domain/AutomationDiscovery.js';
import { BusinessOpportunityAssessor } from '../domain/BusinessOpportunityAssessor.js';
import { DailyBriefingAssembler } from '../domain/DailyBriefingAssembler.js';
import { ActionClassPolicy } from '../domain/ActionClassPolicy.js';

export type ProactiveResult<T> =
  { success: true; data: T } | { success: false; error: string; code: string };

function ok<T>(data: T): ProactiveResult<T> {
  return { success: true, data };
}
function err<T>(error: string, code: string): ProactiveResult<T> {
  return { success: false, error, code };
}

export interface ProactiveServiceOptions {
  brain: ProactiveBrainPort;
  capability: ProactiveCapabilityPort;
  store: ProactiveRecommendationStore;
  now?: () => string;
}

const MAX_RECOMMENDATIONS_PER_OWNER = 100;

export class ProactiveIntelligenceService {
  private readonly brain: ProactiveBrainPort;
  private readonly capability: ProactiveCapabilityPort;
  private readonly store: ProactiveRecommendationStore;
  private readonly now: () => string;
  private readonly discovery: AutomationDiscovery;
  private readonly assessor: BusinessOpportunityAssessor;
  private readonly briefingAssembler: DailyBriefingAssembler;
  private readonly actionPolicy: ActionClassPolicy;

  constructor(opts: ProactiveServiceOptions) {
    this.brain = opts.brain;
    this.capability = opts.capability;
    this.store = opts.store;
    this.now = opts.now ?? ((): string => new Date().toISOString());
    this.discovery = new AutomationDiscovery();
    this.assessor = new BusinessOpportunityAssessor();
    this.briefingAssembler = new DailyBriefingAssembler();
    this.actionPolicy = new ActionClassPolicy();
  }

  /** Refresh recommendations from the EXISTING Brain pipeline. Idempotent:
   *  the same signal produces the same stable key → no duplicate proposals.
   *  SPRINT-030: `runDiscovery: false` skips the discovery ride when the
   *  caller (the scheduler cadence) already ran discoverIntelligence on the
   *  same heartbeat — the refresh then re-composes the existing signals
   *  without a second discovery pass (idempotent either way). */
  async refresh(
    userId: string,
    opts?: { runDiscovery?: boolean },
  ): Promise<ProactiveResult<ProactiveRecommendation[]>> {
    // Ride the existing discovery pipeline (AI World → Brain opportunities),
    // unless the caller already ran it on the same heartbeat (SPRINT-030
    // cadence wiring — never two discovery passes per user per tick).
    if (opts?.runDiscovery ?? true) {
      await this.brain.discoverIntelligence(userId);
    }

    const opportunities = this.brain.listOpportunities(userId);
    const tasks = this.brain.listTasks(userId);
    const priorities = this.brain.dailyPriorities(userId);
    const outcomes = this.brain.listOutcomeMemory(userId);
    if (!opportunities.success || !tasks.success || !priorities.success) {
      return err('The Brain surface is unavailable.', 'BRAIN_UNAVAILABLE');
    }

    const recommendations: ProactiveRecommendation[] = [];
    const seen = new Set<string>();
    const ts = this.now();

    // A DISMISSED recommendation stays dismissed across refreshes (the user's
    // explicit choice is never silently resurrected).
    const dismissedKeys = new Set(
      this.store
        .list(userId)
        .filter((r) => r.status === 'DISMISSED')
        .map((r) => `${userId}:${r.category}:${r.title}`),
    );

    // 1. Brain opportunities → OPPORTUNITY / REVENUE_OPPORTUNITY / AUTOMATION.
    for (const opp of opportunities.data ?? []) {
      if (opp.status === 'DISMISSED') continue;
      const category = this.mapOpportunityCategory(opp.category);
      const authorizationRequired =
        this.isSensitiveTitle(opp.title) ||
        (opp.requiredCapabilities?.some((c) => this.isSensitiveCapability(c)) ?? false);
      const rec = this.buildRecommendation({
        userId,
        category,
        title: opp.title,
        description: opp.description,
        evidence: opp.evidence,
        confidence: Math.max(0, Math.min(1, 1 - opp.uncertainty)),
        urgency: this.urgencyFromUncertainty(opp.uncertainty),
        expectedValue: opp.estimatedValue
          ? {
              label: opp.estimatedValue.label,
              status: this.evidenceStatus(opp.estimatedValue.status),
            }
          : undefined,
        requiredCapabilities: opp.requiredCapabilities,
        // A sensitive-action recommendation is HIGH risk unless evidence says
        // otherwise (fail-closed risk posture for anything that needs approval).
        riskLevel: authorizationRequired && opp.risk !== 'HIGH' ? 'HIGH' : this.riskLevel(opp.risk),
        source: 'brain-opportunity',
        ts,
        authorizationRequired,
      });
      if (this.dedup(seen, rec, userId, dismissedKeys)) recommendations.push(rec);
    }

    // 2. Daily priorities → TASK recommendations (only high-urgency, evidence
    //    = the priority ranking itself).
    for (const priority of (priorities.data ?? []).slice(0, 3)) {
      const rec = this.buildRecommendation({
        userId,
        category: 'TASK',
        title: priority.title,
        description: priority.reason ?? 'Top-ranked priority for today.',
        evidence: ['Ranked by the existing DailyOutcomeEngine priority hierarchy.'],
        confidence: 0.5,
        urgency: this.urgencyFromLabel(priority.urgency),
        source: 'brain-task',
        ts,
        authorizationRequired: false,
      });
      if (this.dedup(seen, rec, userId, dismissedKeys)) recommendations.push(rec);
    }

    // 3. Outcome memory → LEARNING_OPPORTUNITY (only when evidence exists).
    for (const outcome of outcomes.data ?? []) {
      if (outcome.verdict !== 'SUCCESS') continue;
      const rec = this.buildRecommendation({
        userId,
        category: 'LEARNING_OPPORTUNITY',
        title: `Reuse the working approach from "${outcome.objective ?? outcome.taskId ?? 'a past task'}"`,
        description: 'A previously verified success suggests a repeatable pattern.',
        evidence: [`Verified outcome ${outcome.id} (${outcome.verdict}).`],
        confidence: 0.6,
        urgency: 'LOW',
        source: 'outcome-memory',
        ts,
        authorizationRequired: false,
      });
      if (this.dedup(seen, rec, userId, dismissedKeys)) recommendations.push(rec);
    }

    // 4. Automation discovery — repetitive workflows from task history.
    const discoveryResult = this.discovery.discover({
      tasks: tasks.data ?? [],
      automationBoundary: {
        assess: (candidates, irreversible) =>
          this.capability.assessAutomation(candidates, irreversible),
      },
      actionClassPolicy: this.actionPolicy,
      now: this.now,
    });
    for (const workflow of discoveryResult.workflows) {
      const rec = this.buildRecommendation({
        userId,
        category: 'AUTOMATION',
        title: workflow.title,
        description: workflow.description,
        evidence: workflow.evidence,
        confidence: 0.7,
        urgency: 'MEDIUM',
        requiredCapabilities: workflow.capabilities.length > 0 ? workflow.capabilities : undefined,
        recommendedWorkflow: this.workflowSteps(workflow),
        riskLevel: workflow.actionClass === 'C' ? 'HIGH' : 'LOW',
        source: 'automation-discovery',
        ts,
        authorizationRequired: workflow.actionClass === 'C',
      });
      if (this.dedup(seen, rec, userId, dismissedKeys)) recommendations.push(rec);
    }

    // Persist with stable keys (idempotency), bounded.
    for (const rec of recommendations) {
      this.store.saveWithKey(`${rec.ownerId}:${rec.category}:${rec.title}`, rec);
    }
    this.boundStore(userId);

    return ok(this.store.list(userId));
  }

  list(userId: string): ProactiveResult<ProactiveRecommendation[]> {
    return ok(this.store.list(userId));
  }

  dismiss(userId: string, recommendationId: string): ProactiveResult<ProactiveRecommendation> {
    const rec = this.store.get(userId, recommendationId);
    if (!rec) return err('Recommendation not found.', 'NOT_FOUND');
    const updated = this.store.update(userId, recommendationId, { status: 'DISMISSED' });
    return updated ? ok(updated) : err('Recommendation not found.', 'NOT_FOUND');
  }

  accept(userId: string, recommendationId: string): ProactiveResult<ProactiveRecommendation> {
    const rec = this.store.get(userId, recommendationId);
    if (!rec) return err('Recommendation not found.', 'NOT_FOUND');
    if (rec.authorizationRequired) {
      // The recommendation itself cannot authorize anything. Acceptance means
      // "propose the action to the existing approval authority" — execution
      // still requires that authority's approval.
      return err(
        'This action requires approval through the existing approval mechanism — it cannot be authorized here.',
        'APPROVAL_REQUIRED',
      );
    }
    const updated = this.store.update(userId, recommendationId, { status: 'ACCEPTED' });
    return updated ? ok(updated) : err('Recommendation not found.', 'NOT_FOUND');
  }

  briefing(userId: string): ProactiveResult<DailyBriefing> {
    const priorities = this.brain.dailyPriorities(userId);
    const opportunities = this.brain.listOpportunities(userId);
    const events = this.brain.listIntelligenceEvents(userId);
    const risks: { title: string; risk: string }[] = [];

    const briefing = this.briefingAssembler.assemble({
      ownerId: userId,
      now: this.now,
      priorities: (priorities.data ?? []).map((p) => ({
        title: p.title,
        urgency: p.urgency,
        reason: p.reason,
      })),
      opportunities: (opportunities.data ?? [])
        .filter((o) => o.status !== 'DISMISSED')
        .map((o) => ({
          category: o.category,
          title: o.title,
          evidence: o.evidence,
          status: o.status,
        })),
      events: (events.data ?? []).map((e) => ({
        kind: e.kind,
        title: e.title,
        relevance: e.relevance,
      })),
      risks,
    });
    return ok(briefing);
  }

  assessBusiness(
    userId: string,
    input: {
      title: string;
      description: string;
      requiredCapabilities: string[];
    },
  ): ProactiveResult<BusinessOpportunityAssessment> {
    const caps = this.capability.availableCapabilities(userId);
    const tasks = this.brain.listTasks(userId);
    const assessment = this.assessor.assess({
      ownerId: userId,
      title: input.title,
      description: input.description,
      availableCapabilities: caps.data ?? [],
      requiredCapabilities: input.requiredCapabilities,
      relatedWork: (tasks.data ?? []).map((t) => ({
        objective: t.objective,
        status: t.status,
        createdAt: t.createdAt,
      })),
      marketSignals: [],
      now: this.now,
    });
    return ok(assessment);
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private isSensitiveCapability(capability: string): boolean {
    return /publish|deploy|send|purchase|external|payment/.test(capability.toLowerCase());
  }

  private isSensitiveTitle(title: string): boolean {
    return this.actionPolicy.classify(title).actionClass === 'C';
  }

  private mapOpportunityCategory(category: string): RecommendationCategory {
    switch (category) {
      case 'earning':
      case 'freelance':
        return 'REVENUE_OPPORTUNITY';
      case 'business':
        return 'BUSINESS_OPPORTUNITY';
      case 'automation':
        return 'AUTOMATION';
      case 'cost_saving':
        return 'COST_SAVING';
      case 'productivity':
        return 'TIME_SAVING';
      case 'career':
        return 'LEARNING_OPPORTUNITY';
      default:
        return 'OPPORTUNITY';
    }
  }

  private urgencyFromUncertainty(uncertainty: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN' {
    if (uncertainty < 0.33) return 'HIGH';
    if (uncertainty < 0.66) return 'MEDIUM';
    return 'LOW';
  }

  private urgencyFromLabel(label: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN' {
    const l = label.toLowerCase();
    if (l.includes('high') || l.includes('urgent') || l.includes('critical')) return 'HIGH';
    if (l.includes('medium')) return 'MEDIUM';
    if (l.includes('low')) return 'LOW';
    return 'UNKNOWN';
  }

  private riskLevel(risk: string | undefined): 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN' {
    if (risk === 'LOW' || risk === 'MEDIUM' || risk === 'HIGH') return risk;
    return 'UNKNOWN';
  }

  private evidenceStatus(status: string): 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN' {
    if (status === 'VERIFIED' || status === 'ESTIMATED') return status;
    return 'UNKNOWN';
  }

  private buildRecommendation(input: {
    userId: string;
    category: RecommendationCategory;
    title: string;
    description: string;
    evidence: string[];
    confidence: number;
    urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
    expectedValue?: { label: string; status: 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN' };
    requiredCapabilities?: string[];
    recommendedWorkflow?: string[];
    riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
    source: ProactiveRecommendation['source'];
    ts: string;
    authorizationRequired: boolean;
  }): ProactiveRecommendation {
    return {
      id: `pr-${Math.random().toString(36).slice(2, 10)}`,
      ownerId: input.userId,
      category: input.category,
      title: input.title.slice(0, 160),
      description: input.description.slice(0, 400),
      evidence: input.evidence.slice(0, 5),
      confidence: input.confidence,
      expectedValue: input.expectedValue,
      urgency: input.urgency,
      requiredCapabilities: input.requiredCapabilities,
      recommendedWorkflow: input.recommendedWorkflow,
      riskLevel: input.riskLevel ?? 'UNKNOWN',
      status: 'NEW',
      source: input.source,
      createdAt: input.ts,
      authorizationRequired: input.authorizationRequired,
    };
  }

  private workflowSteps(workflow: AutomationWorkflow): string[] {
    return [
      workflow.trigger,
      workflow.input,
      workflow.transformation,
      workflow.verification,
      workflow.output,
    ];
  }

  private dedup(
    seen: Set<string>,
    rec: ProactiveRecommendation,
    userId: string,
    dismissedKeys: Set<string>,
  ): boolean {
    const key = `${userId}:${rec.category}:${rec.title}`;
    if (dismissedKeys.has(key)) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }

  private boundStore(userId: string): void {
    const list = this.store.list(userId);
    if (list.length > MAX_RECOMMENDATIONS_PER_OWNER) {
      const excess = list.length - MAX_RECOMMENDATIONS_PER_OWNER;
      for (const rec of list.slice(0, excess)) {
        this.store.delete(userId, rec.id);
      }
    }
  }
}

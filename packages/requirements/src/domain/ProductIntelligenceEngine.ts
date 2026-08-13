// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: Product Intelligence Engine
// EPIC-009 — the orchestrating layer ABOVE the Application Factory.
//
//   USER IDEA → UNDERSTAND → ANALYZE → EXTRACT REQUIREMENTS →
//   DETECT AMBIGUITY → DETECT CONFLICTS → ASK HIGH-VALUE QUESTIONS →
//   SAFE DEFAULTS → COMPLETENESS → PRODUCT BRIEF → DESIGN →
//   ARCHITECTURE → AI/RAG/TOOL STRATEGY → SECURITY → COST → BUILD
//   PLAN → USER APPROVAL → (handoff goal for) APPLICATION FACTORY
//
// The engine executes NO AI directly. Optional enrichment flows through
// the frozen AI runtime via a narrow port; without it the pipeline is
// fully deterministic. Every mutation is persisted owner-scoped and
// requirement changes are versioned — never silently mutated.
// ──────────────────────────────────────────────────────────────────

import { generateId, NotFoundError, ConflictError } from '@vedmoulya/core';
import type {
  RequirementSessionStore,
  ClockPort,
  RequirementEnrichmentPort,
} from '../contracts/requirement-ports.js';
import { SYSTEM_CLOCK } from '../contracts/requirement-ports.js';
import type {
  ChangeImpact,
  HandoffGoal,
  ProductIntent,
  QuestionPlan,
  Requirement,
  RequirementCategory,
  RequirementConflict,
  RequirementSession,
  RequirementVersion,
  SafeDefault,
  SafeDefaultStatus,
} from '../types/requirement-types.js';
import { IntentUnderstandingEngine } from './IntentUnderstandingEngine.js';
import { RequirementExtractionEngine } from './RequirementExtractionEngine.js';
import { RequirementGraphBuilder } from './RequirementGraphBuilder.js';
import { AmbiguityEngine } from './AmbiguityEngine.js';
import { ConflictDetector } from './ConflictDetector.js';
import { RequirementQuestionEngine } from './RequirementQuestionEngine.js';
import { SafeDefaultEngine } from './SafeDefaultEngine.js';
import { CompletenessEngine } from './CompletenessEngine.js';
import { ProductBriefGenerator } from './ProductBriefGenerator.js';
import { UserJourneyEngine } from './UserJourneyEngine.js';
import { ExperienceStrategyEngine } from './ExperienceStrategyEngine.js';
import { DesignIntelligenceEngine } from './DesignIntelligenceEngine.js';
import { ArchitectureIntelligenceEngine } from './ArchitectureIntelligenceEngine.js';
import { AIStrategyEngine } from './AIStrategyEngine.js';
import { RAGStrategyEngine } from './RAGStrategyEngine.js';
import { ToolStrategyEngine } from './ToolStrategyEngine.js';
import { SecurityPlanner } from './SecurityPlanner.js';
import { CostPlanner } from './CostPlanner.js';
import { BuildPlanner } from './BuildPlanner.js';
import { PlanReviewBuilder } from './PlanReviewBuilder.js';
import { ChangeImpactAnalyzer } from './ChangeImpactAnalyzer.js';
import { TraceabilityIndexer } from './TraceabilityIndexer.js';
import { RequirementVersionControl } from './RequirementVersionControl.js';

export interface ProductIntelligenceOptions {
  store: RequirementSessionStore;
  /** Optional AI enrichment over the frozen runtime (deterministic otherwise). */
  enrichment?: RequirementEnrichmentPort;
  clock?: ClockPort;
}

export interface StartInput {
  idea: string;
  owner: string;
}

export interface AnswerInput {
  sessionId: string;
  owner: string;
  answers: Array<{ questionId: string; answer: string }>;
}

export class ProductIntelligenceEngine {
  private readonly store: RequirementSessionStore;
  private readonly enrichment?: RequirementEnrichmentPort;
  private readonly clock: ClockPort;

  private readonly intent = new IntentUnderstandingEngine();
  private readonly extraction = new RequirementExtractionEngine();
  private readonly graphBuilder = new RequirementGraphBuilder();
  private readonly ambiguity = new AmbiguityEngine();
  private readonly conflicts = new ConflictDetector();
  private readonly questions = new RequirementQuestionEngine();
  private readonly defaults = new SafeDefaultEngine();
  private readonly completeness = new CompletenessEngine();
  private readonly brief = new ProductBriefGenerator();
  private readonly journeys = new UserJourneyEngine();
  private readonly experience = new ExperienceStrategyEngine();
  private readonly design = new DesignIntelligenceEngine();
  private readonly architecture = new ArchitectureIntelligenceEngine();
  private readonly ai = new AIStrategyEngine();
  private readonly rag = new RAGStrategyEngine();
  private readonly tools = new ToolStrategyEngine();
  private readonly security = new SecurityPlanner();
  private readonly cost = new CostPlanner();
  private readonly build = new BuildPlanner();
  private readonly review = new PlanReviewBuilder();
  private readonly change = new ChangeImpactAnalyzer();
  private readonly trace = new TraceabilityIndexer();
  private readonly vc = new RequirementVersionControl({ now: (): string => this.clock.now() });

  constructor(options: ProductIntelligenceOptions) {
    this.store = options.store;
    this.enrichment = options.enrichment;
    this.clock = options.clock ?? SYSTEM_CLOCK;
  }

  // ── Phase 0/1–10: understand, extract, analyze ────────────────────────────

  async start(input: StartInput): Promise<RequirementSession> {
    if (!input.idea.trim()) throw new Error('idea is required');
    const sessionId = `req-${generateId()}`;
    let session: RequirementSession = {
      sessionId,
      owner: input.owner,
      idea: input.idea.trim(),
      phase: 'UNDERSTANDING',
      changeImpacts: [],
      versions: [],
      enrichment: { attempted: false, calls: 0, tokens: 0, costUsd: 0 },
      createdAt: this.clock.now(),
      updatedAt: this.clock.now(),
    };
    session = await this.understand(session);
    session = this.computeDerived(session, []);
    session = { ...session, phase: this.nextPhase(session), updatedAt: this.clock.now() };
    await this.store.save(session);
    return session;
  }

  async get(sessionId: string, owner: string): Promise<RequirementSession> {
    return this.getOwned(sessionId, owner);
  }

  async list(owner?: string): Promise<RequirementSession[]> {
    return this.store.list(owner);
  }

  async deleteSession(sessionId: string, owner: string): Promise<{ deleted: boolean }> {
    await this.getOwned(sessionId, owner);
    return { deleted: await this.store.delete(sessionId) };
  }

  // ── Phase 6–9: answers, defaults, completeness ────────────────────────────

  async answer(input: AnswerInput): Promise<RequirementSession> {
    const session = await this.getOwned(input.sessionId, input.owner);
    if (session.phase === 'APPROVED' || session.phase === 'HANDED_OFF') {
      throw new ConflictError(
        'an approved session cannot be changed — start a new session or use changeImpact',
      );
    }
    let next = this.applyAnswers(session, input.answers);
    next = this.computeDerived(next, input.answers);
    next = { ...next, phase: this.nextPhase(next), updatedAt: this.clock.now() };
    await this.store.save(next);
    return next;
  }

  async acceptAllDefaults(sessionId: string, owner: string): Promise<RequirementSession> {
    const session = await this.getOwned(sessionId, owner);
    const defaults = this.defaults.acceptAll(session.defaults ?? []);
    const next = this.computeDerived({ ...session, defaults }, []);
    next.phase = this.nextPhase(next);
    next.updatedAt = this.clock.now();
    await this.store.save(next);
    return next;
  }

  async decideDefault(
    sessionId: string,
    owner: string,
    defaultId: string,
    decision: SafeDefaultStatus,
    editedValue?: string,
  ): Promise<RequirementSession> {
    const session = await this.getOwned(sessionId, owner);
    if (decision === 'accepted' && this.defaults.counts(session.defaults ?? []).proposed === 0) {
      return session;
    }
    const defaults = this.defaults.decide(session.defaults ?? [], defaultId, decision, editedValue);
    const next = this.computeDerived({ ...session, defaults }, []);
    next.phase = this.nextPhase(next);
    next.updatedAt = this.clock.now();
    await this.store.save(next);
    return next;
  }

  // ── Phase 11: explicit conflict resolution ────────────────────────────────

  async resolveConflict(
    sessionId: string,
    owner: string,
    conflictId: string,
    choice: string,
  ): Promise<RequirementSession> {
    const session = await this.getOwned(sessionId, owner);
    const conflicts = (session.conflicts ?? []).map((c) =>
      c.id === conflictId ? { ...c, status: 'resolved' as const } : c,
    );
    const recorded: RequirementVersion = {
      version: session.versions.length + 1,
      requirementId: conflictId,
      description: `Conflict ${conflictId} resolved`,
      change: `Conflict resolved by choosing: ${choice}`,
      approvedBy: owner,
      approvedAt: this.clock.now(),
      timestamp: this.clock.now(),
    };
    const next = { ...session, conflicts, versions: [...session.versions, recorded] };
    const derived = this.computeDerived(next, []);
    derived.phase = this.nextPhase(derived);
    derived.updatedAt = this.clock.now();
    await this.store.save(derived);
    return derived;
  }

  // ── Phase 12–25: full product plan ────────────────────────────────────────

  async plan(sessionId: string, owner: string): Promise<RequirementSession> {
    const session = await this.getOwned(sessionId, owner);
    if (session.phase === 'APPROVED' || session.phase === 'HANDED_OFF') return session;
    if (session.intent === undefined || session.requirements === undefined) {
      throw new Error('session is not understood yet');
    }
    const blocked = this.blockingReasons(session);
    if (blocked.length > 0) {
      throw new Error(`The product plan is NOT READY yet: ${blocked.join('; ')}`);
    }
    const next = this.buildPlanDocuments(session);
    next.phase = 'REVIEW';
    next.updatedAt = this.clock.now();
    await this.store.save(next);
    return next;
  }

  // ── Phase 23: approval gate ───────────────────────────────────────────────

  async approve(sessionId: string, owner: string): Promise<RequirementSession> {
    const session = await this.getOwned(sessionId, owner);
    if (session.review === undefined) {
      throw new ConflictError('the plan must be generated before approval (Phase 23)');
    }
    const blocked = this.blockingReasons(session);
    if (blocked.length > 0) {
      throw new ConflictError(`Cannot approve: ${blocked.join('; ')}`);
    }
    const handoffGoal = this.synthesizeHandoffGoal(session);
    const approved: RequirementSession = {
      ...session,
      review: { ...session.review, approvedAt: this.clock.now() },
      handoffGoal: handoffGoal.goal,
      phase: 'APPROVED',
      versions: [
        ...session.versions,
        {
          version: session.versions.length + 1,
          requirementId: session.sessionId,
          description: 'Product plan approved',
          change: 'User approved the full product plan',
          approvedBy: owner,
          approvedAt: this.clock.now(),
          timestamp: this.clock.now(),
        },
      ],
      updatedAt: this.clock.now(),
    };
    await this.store.save(approved);
    return approved;
  }

  async reject(sessionId: string, owner: string, reason?: string): Promise<RequirementSession> {
    const session = await this.getOwned(sessionId, owner);
    const rejected: RequirementSession = {
      ...session,
      phase: 'REJECTED',
      versions: [
        ...session.versions,
        {
          version: session.versions.length + 1,
          requirementId: session.sessionId,
          description: 'Product plan rejected',
          change: reason ?? 'User rejected the product plan',
          approvedBy: owner,
          approvedAt: this.clock.now(),
          timestamp: this.clock.now(),
        },
      ],
      updatedAt: this.clock.now(),
    };
    await this.store.save(rejected);
    return rejected;
  }

  async handoffGoal(sessionId: string, owner: string): Promise<HandoffGoal> {
    const session = await this.getOwned(sessionId, owner);
    if (session.phase !== 'APPROVED' || session.handoffGoal === undefined) {
      throw new ConflictError('the session must be APPROVED before handoff');
    }
    return this.buildHandoffGoal(session);
  }

  // ── Phase 24: mandatory change impact ─────────────────────────────────────

  async changeImpact(sessionId: string, owner: string, request: string): Promise<ChangeImpact> {
    const session = await this.getOwned(sessionId, owner);
    if (session.requirements === undefined || session.architecture === undefined) {
      throw new Error(
        'the session needs confirmed requirements + architecture before change impact',
      );
    }
    const impact = this.change.analyze({
      sessionId,
      request,
      requirements: session.requirements,
      architecture: session.architecture,
    });
    const next: RequirementSession = {
      ...session,
      changeImpacts: [...session.changeImpacts, { request, impact, timestamp: this.clock.now() }],
      updatedAt: this.clock.now(),
    };
    await this.store.save(next);
    return impact;
  }

  // ── Internal pipeline ─────────────────────────────────────────────────────

  /** Phase 1 + optional AI enrichment: build the ProductIntent. */
  private async understand(session: RequirementSession): Promise<RequirementSession> {
    let intent = this.intent.derive({ sessionId: session.sessionId, idea: session.idea });
    if (this.enrichment) {
      session.enrichment.attempted = true;
      try {
        const result = await this.enrichment.enrich({
          idea: session.idea,
          archetype: intent.archetype,
          userId: session.owner,
        });
        session.enrichment = {
          attempted: true,
          calls: 1,
          tokens: result.tokens,
          costUsd: result.costUsd,
        };
        if (result.confident) {
          intent = this.mergeEnrichment(intent, result);
        }
      } catch (error) {
        session.enrichment.error = error instanceof Error ? error.message : String(error);
      }
    }
    return { ...session, intent };
  }

  private mergeEnrichment(
    intent: ProductIntent,
    result: Awaited<ReturnType<NonNullable<RequirementEnrichmentPort>['enrich']>>,
  ): ProductIntent {
    const features = new Set(intent.knownFeatures);
    const integrations = new Set(intent.integrations);
    const constraints = new Set(intent.knownConstraints);
    const extraInferred = [...intent.inferred];
    for (const f of result.additionalFeatures) {
      if (f.trim()) {
        features.add(f);
        extraInferred.push({
          key: 'knownFeatures',
          label: `enriched feature: ${f}`,
          value: f,
          provenance: {
            source: 'RAG',
            confidence: 0.6,
            detail: 'AI enrichment over the frozen runtime',
          },
          isUnknown: false,
        });
      }
    }
    for (const i of result.additionalIntegrations) {
      if (i.trim()) integrations.add(i);
    }
    for (const c of result.additionalConstraints) {
      if (c.trim()) constraints.add(c);
    }
    return {
      ...intent,
      knownFeatures: Array.from(features),
      integrations: Array.from(integrations),
      knownConstraints: Array.from(constraints),
      inferred: extraInferred,
    };
  }

  /** Recompute all derived artifacts from the current intent + answers. The
   *  requirement set is extracted once (stable ids) and then mutated by
   *  answers — recomputation never re-extracts from scratch. */
  private computeDerived(
    session: RequirementSession,
    _newAnswers: AnswerInput['answers'],
  ): RequirementSession {
    if (session.intent === undefined) {
      return session;
    }
    const intent = session.intent;
    const requirements =
      session.requirements ?? this.extraction.extract({ sessionId: session.sessionId, intent });

    const conflictList = this.mergeConflictStatuses(
      session.conflicts ?? [],
      this.conflicts.detect(requirements),
    );
    const graph = this.graphBuilder.build({
      sessionId: session.sessionId,
      requirements,
      conflicts: conflictList,
    });
    const ambiguityReport = this.ambiguity.analyze({
      sessionId: session.sessionId,
      idea: session.idea,
      archetype: intent.archetype,
      requirements,
    });
    const questionPlan = this.questions.plan({
      sessionId: session.sessionId,
      idea: session.idea,
      archetype: intent.archetype,
      requirements,
      ambiguity: ambiguityReport,
      answered: session.questionPlan?.answered ?? [],
    });
    const answeredTopics = (session.questionPlan?.answered ?? []).map((q) => q.topic);
    const proposedDefaults = this.defaults.propose({
      sessionId: session.sessionId,
      archetype: intent.archetype,
      requirements,
      answeredTopics,
    });
    const defaults = this.mergeDecisions(session.defaults ?? [], proposedDefaults);
    const blockingQuestionIds = questionPlan.blocking.map((q) => q.id);
    const completenessResult = this.completeness.evaluate({
      sessionId: session.sessionId,
      requirements,
      defaults,
      blockingQuestionIds,
    });

    return {
      ...session,
      intent,
      requirements,
      graph,
      ambiguity: ambiguityReport,
      questionPlan,
      conflicts: conflictList,
      defaults,
      completeness: completenessResult,
    };
  }

  /** Apply user answers to the requirement set (immutably, versioned). */
  private applyAnswers(
    session: RequirementSession,
    answers: AnswerInput['answers'],
  ): RequirementSession {
    if (session.requirements === undefined) return session;
    const requirements = session.requirements.requirements.map((r) => ({ ...r }));
    const questionPlan: QuestionPlan = {
      ...(session.questionPlan ?? {
        sessionId: session.sessionId,
        bundles: [],
        blocking: [],
        important: [],
        optional: [],
        all: [],
        answered: [],
      }),
    };
    const answeredQuestions = [...(session.questionPlan?.answered ?? [])];
    const versions = [...session.versions];

    for (const a of answers) {
      const question = (session.questionPlan?.all ?? []).find((q) => q.id === a.questionId);
      if (!question) throw new NotFoundError('RequirementQuestion', a.questionId);
      const trimmed = a.answer.trim();
      if (!trimmed) throw new Error(`question ${a.questionId} requires an answer`);

      // Confirm the matching UNKNOWN requirement.
      for (const r of requirements) {
        if (r.source === 'QUESTION' && r.description === question.text && r.status === 'UNKNOWN') {
          r.status = 'CONFIRMED';
          r.source = 'QUESTION';
          r.confidence = 0.9;
          r.priority =
            question.securitySensitive === true || question.class === 'BLOCKING'
              ? 'CRITICAL'
              : 'HIGH';
          r.reason = `answered by the user: "${trimmed}"`;
        }
      }
      // Version the answer (Phase 26 — the historical record is never mutated).
      versions.push({
        version: versions.length + 1,
        requirementId: question.id,
        description: question.text,
        change: `user answer: ${trimmed}`,
        approvedBy: session.owner,
        approvedAt: this.clock.now(),
        timestamp: this.clock.now(),
      });

      // Answer-derived requirements.
      this.applyAnswerDerivedRequirements(requirements, question.id, trimmed);

      answeredQuestions.push({ ...question, answer: trimmed, answerSource: 'QUESTION' });
    }

    return {
      ...session,
      requirements: { ...session.requirements, requirements },
      questionPlan: { ...questionPlan, answered: answeredQuestions },
      versions,
    };
  }

  private applyAnswerDerivedRequirements(
    requirements: Requirement[],
    questionId: string,
    answer: string,
  ): void {
    const has = (description: string): boolean =>
      requirements.some((r) => r.description === description);
    const add = (category: RequirementCategory, description: string): void => {
      if (has(description)) return;
      requirements.push({
        id: `REQ-${String(requirements.length + 1).padStart(3, '0')}`,
        description,
        category,
        priority: 'HIGH',
        confidence: 0.85,
        source: 'QUESTION',
        dependencies: [],
        risks: [],
        status: 'CONFIRMED',
        reason: `derived from the answer to ${questionId}`,
        version: 1,
      });
    };
    if (questionId === 'q-restaurant-payment' && (answer === 'online' || answer === 'both')) {
      add('integration', 'Process online payments securely (tokenized)');
      add('security', 'Payment tokens are provider-managed and never logged');
    }
    if (
      questionId === 'q-restaurant-service-modes' &&
      (answer.includes('delivery') || answer === 'all')
    ) {
      add('functional', 'Support delivery ordering with address capture');
    }
    if (questionId === 'q-restaurant-accounts' && answer === 'accounts_required') {
      add('security', 'Accounts are required for all customers');
    }
    if (questionId === 'q-restaurant-accounts' && answer === 'guest_optional') {
      add('functional', 'Guest checkout with optional account creation');
    }
    if (questionId === 'q-generic-data' && answer.length > 0) {
      add('functional', `Manage ${answer.toLowerCase()}`);
    }
    if (questionId === 'q-builder-output' && answer === 'code') {
      add('functional', 'Generate runnable project scaffolds');
    }
    if (questionId === 'q-abap-input' && answer.includes('upload')) {
      add('functional', 'Support uploading source files for diagnosis');
    }
  }

  /** Re-detect conflicts but keep previously-settled statuses (Phase 11 — a
   *  resolved conflict must never silently re-open on recomputation).
   *  Settled conflicts are keyed by their requirement pair so re-detection
   *  with the same stable requirement ids restores the user's decision. */
  private mergeConflictStatuses(
    previous: RequirementConflict[],
    fresh: RequirementConflict[],
  ): RequirementConflict[] {
    const settled = new Map<string, 'resolved' | 'rejected'>();
    for (const c of previous) {
      if (c.status !== 'open') settled.set(`${c.reqAId}|${c.reqBId}`, c.status);
    }
    if (settled.size === 0) return fresh;
    return fresh.map((c) => {
      const status = settled.get(`${c.reqAId}|${c.reqBId}`);
      return status === undefined ? c : { ...c, status };
    });
  }

  /** Merge previously-decided defaults with freshly proposed ones. */
  private mergeDecisions(previous: SafeDefault[], proposed: SafeDefault[]): SafeDefault[] {
    const decided = previous.filter((d) => d.status !== 'proposed');
    const decidedIds = new Set(decided.map((d) => d.id));
    const fresh = proposed.filter((d) => !decidedIds.has(d.id));
    return [...decided, ...fresh];
  }

  /** Phase 12–25: generate every plan document + the review. */
  private buildPlanDocuments(session: RequirementSession): RequirementSession {
    if (session.intent === undefined || session.requirements === undefined) {
      throw new Error('session is not understood yet');
    }
    const { intent, requirements } = session;
    const answers = (session.questionPlan?.answered ?? []).map((q) => ({
      questionId: q.id,
      answer: q.answer ?? '',
    }));
    const archetype = intent.archetype;

    const brief = this.brief.generate({
      sessionId: session.sessionId,
      intent,
      requirements,
      defaults: session.defaults ?? [],
    });
    const journeyList = this.journeys.generate({ sessionId: session.sessionId, archetype });
    const experience = this.experience.derive({ sessionId: session.sessionId, archetype });
    const design = this.design.derive({ sessionId: session.sessionId, archetype });
    const architecture = this.architecture.derive({
      sessionId: session.sessionId,
      archetype,
      answers,
    });
    const aiStrategy = this.ai.derive({
      sessionId: session.sessionId,
      archetype,
      requirements,
      answers,
    });
    const ragStrategy = this.rag.derive({
      sessionId: session.sessionId,
      archetype,
      aiRagRequired: aiStrategy.ragRequired,
      answers,
    });
    const toolStrategy = this.tools.derive({
      sessionId: session.sessionId,
      archetype,
      requestedIntegrations: intent.integrations,
    });
    const unansweredSecurity = (session.questionPlan?.blocking ?? [])
      .filter((q) => q.securitySensitive === true)
      .map((q) => q.text);
    const securityPlan = this.security.plan({
      sessionId: session.sessionId,
      archetype,
      unansweredSecurityQuestions: unansweredSecurity,
      handlesPayments: intent.integrations.some((i) => i.toLowerCase().includes('payment')),
    });
    const confirmedFeatures = requirements.requirements.filter(
      (r) => r.category === 'functional' && (r.status === 'CONFIRMED' || r.status === 'PROPOSED'),
    ).length;
    const costPlan = this.cost.plan({
      sessionId: session.sessionId,
      archetype,
      ai: aiStrategy,
      rag: ragStrategy,
      confirmedFeatures,
    });
    const buildPlan = this.build.plan({ sessionId: session.sessionId, archetype });
    const ready =
      (session.completeness?.ready ?? false) &&
      (session.conflicts ?? []).every((c) => c.status !== 'open');
    const review = this.review.build({
      sessionId: session.sessionId,
      intent,
      requirements,
      questions: (session.questionPlan?.all ?? []).filter((q) => q.answer === undefined),
      defaults: session.defaults ?? [],
      brief,
      journeys: journeyList,
      experience,
      design,
      architecture,
      aiStrategy,
      ragStrategy,
      tools: toolStrategy,
      security: securityPlan,
      cost: costPlan,
      buildPlan,
      ready,
    });
    const traceability = this.trace.index({
      sessionId: session.sessionId,
      requirements,
      architecture,
      design,
      buildPlan,
    });

    return {
      ...session,
      brief,
      journeys: journeyList,
      experience,
      design,
      architecture,
      aiStrategy,
      ragStrategy,
      toolStrategy,
      security: securityPlan,
      cost: costPlan,
      buildPlan,
      review,
      traceability,
    };
  }

  /** Reasons the session is not ready (critical unknowns / blocking questions / open conflicts). */
  private blockingReasons(session: RequirementSession): string[] {
    const reasons: string[] = [];
    for (const u of session.completeness?.criticalUnknowns ?? []) {
      reasons.push(`critical unknown: ${u}`);
    }
    for (const q of session.questionPlan?.blocking ?? []) {
      if (q.answer === undefined) reasons.push(`unanswered blocking question: ${q.text}`);
    }
    for (const c of session.conflicts ?? []) {
      if (c.status === 'open') reasons.push(`open conflict: ${c.description} ${c.explanation}`);
    }
    return reasons;
  }

  /** Decide the next phase from the current state. */
  private nextPhase(session: RequirementSession): RequirementSession['phase'] {
    if (
      session.phase === 'APPROVED' ||
      session.phase === 'REJECTED' ||
      session.phase === 'HANDED_OFF'
    ) {
      return session.phase;
    }
    const blockingUnanswered = (session.questionPlan?.blocking ?? []).some(
      (q) => q.answer === undefined,
    );
    if (blockingUnanswered) return 'QUESTIONS';
    const defaultsUnsettled = (session.defaults ?? []).some((d) => d.status === 'proposed');
    if (defaultsUnsettled) return 'DEFAULTS';
    return 'READY_FOR_PLAN';
  }

  // ── Handoff goal synthesis (Phase 23/28) ──────────────────────────────────

  private synthesizeHandoffGoal(session: RequirementSession): { goal: string } {
    return { goal: this.buildHandoffGoal(session).goal };
  }

  private buildHandoffGoal(session: RequirementSession): HandoffGoal {
    if (session.intent === undefined || session.requirements === undefined) {
      throw new Error('session is not understood yet');
    }
    const confirmed = session.requirements.requirements.filter((r) => r.status === 'CONFIRMED');
    const acceptedDefaults = (session.defaults ?? []).filter(
      (d) => d.status === 'accepted' || d.status === 'edited',
    );
    const kLabel = session.intent.archetype.replaceAll('-', ' ');
    const parts: string[] = [`Build a ${kLabel} application.`, `Core idea: ${session.idea}`];
    if (confirmed.length > 0) {
      parts.push(`Confirmed requirements: ${confirmed.map((r) => r.description).join('; ')}.`);
    }
    if (acceptedDefaults.length > 0) {
      parts.push(
        `Accepted decisions: ${acceptedDefaults.map((d) => `${d.unknown}: ${d.defaultValue}`).join('; ')}.`,
      );
    }
    if (session.security) {
      parts.push(`Security: ${session.security.authentication}. ${session.security.ownership}.`);
    }
    if (session.architecture) {
      parts.push(`Deployment: ${session.architecture.deployment.target}.`);
    }
    if (session.design) {
      parts.push(`Design direction: ${session.design.visualPersonality}.`);
    }
    if (session.aiStrategy) {
      parts.push(
        session.aiStrategy.required
          ? 'AI is required and flows through the AI runtime.'
          : 'No AI is required unless explicitly added later.',
      );
    }
    if (session.brief) {
      const nonGoals = session.brief.nonGoals.filter(
        (n) => n.toLowerCase() !== 'scope beyond the confirmed core workflow',
      );
      if (nonGoals.length > 0) {
        parts.push(`Out of scope: ${nonGoals.join('; ')}.`);
      }
    }
    return {
      goal: parts.join(' '),
      archetype: session.intent.archetype,
      confirmedRequirements: confirmed.length,
      acceptedDefaults: acceptedDefaults.length,
    };
  }

  private async getOwned(sessionId: string, owner: string): Promise<RequirementSession> {
    const session = await this.store.get(sessionId);
    if (!session) throw new NotFoundError('RequirementSession', sessionId);
    if (session.owner !== owner) throw new NotFoundError('RequirementSession', sessionId);
    return session;
  }
}

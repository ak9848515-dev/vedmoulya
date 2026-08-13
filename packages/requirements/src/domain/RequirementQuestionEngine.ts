// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: Requirement Question Engine
// EPIC-009 — Phase 6/7/8. Decides WHICH questions matter and asks them
// in logical bundles. Priority is driven by architecture impact,
// security impact, business impact, UX impact, implementation impact,
// cost impact and confidence. BLOCKING questions must be answered
// before architecture/build; IMPORTANT are asked when practical;
// OPTIONAL questions are NEVER asked — their safe default applies.
// ──────────────────────────────────────────────────────────────────

import type {
  AmbiguityReport,
  ProductIntent,
  QuestionBundle,
  QuestionClass,
  QuestionImpacts,
  QuestionPlan,
  QuestionOption,
  RequirementQuestion,
  RequirementSet,
} from '../types/requirement-types.js';
import { IMPACT_WEIGHTS, knowledgeFor, type QuestionTemplate } from '../catalog/knowledge.js';
import type { AppArchetype } from '@vedmoulya/app-factory';

export interface QuestionPlanInput {
  sessionId: string;
  idea: string;
  archetype: AppArchetype;
  requirements: RequirementSet;
  ambiguity?: AmbiguityReport;
  /** Questions already answered (persisted across calls). */
  answered?: RequirementQuestion[];
  intent?: ProductIntent;
}

/** Rank a question by weighted impact (higher = more important). */
export function rankScore(impacts: QuestionImpacts): number {
  let score = 0;
  for (const [key, weight] of Object.entries(IMPACT_WEIGHTS)) {
    const value = impacts[key as keyof QuestionImpacts];
    score += value * weight;
  }
  return score;
}

export class RequirementQuestionEngine {
  /** Build the question plan from the knowledge templates. OPTIONAL
   *  questions are excluded from the ask-list (they become defaults). */
  plan(input: QuestionPlanInput): QuestionPlan {
    const k = knowledgeFor(input.archetype);
    const alreadyAnswered = new Set(
      (input.answered ?? []).filter((q) => q.answer !== undefined).map((q) => q.id),
    );
    const templates = k.questionTemplates.filter((t) => !alreadyAnswered.has(t.id));
    const ambiguityByTopic = new Map<string, string>();
    for (const finding of input.ambiguity?.findings ?? []) {
      if (finding.relatedQuestionId) {
        ambiguityByTopic.set(finding.relatedQuestionId, finding.id);
      }
    }

    const asked: RequirementQuestion[] = templates
      .filter((t) => t.class !== 'OPTIONAL')
      .map((t) => this.toQuestion(t, input.sessionId, ambiguityByTopic.get(t.id)));

    // Classify + rank within class.
    const blocking = sortByScore(asked.filter((q) => q.class === 'BLOCKING'));
    const important = sortByScore(asked.filter((q) => q.class === 'IMPORTANT'));
    const optional = templates
      .filter((t) => t.class === 'OPTIONAL')
      .map((t) => this.toQuestion(t, input.sessionId, ambiguityByTopic.get(t.id)));

    const all = [...blocking, ...important, ...optional];
    return {
      sessionId: input.sessionId,
      bundles: this.bundle(all),
      blocking,
      important,
      optional,
      all,
      answered: input.answered ?? [],
    };
  }

  /** Rank a single template (used when a session is continued). */
  private toQuestion(
    t: QuestionTemplate,
    sessionId: string,
    resolvesAmbiguityId?: string,
  ): RequirementQuestion {
    return {
      id: t.id,
      class: classify(t.class, t),
      topic: t.topic,
      text: t.text,
      rationale: t.rationale,
      impacts: t.impacts,
      options: t.options,
      freeText: t.freeText,
      defaultAnswer: t.defaultAnswer,
      groupId: slug(t.topic),
      resolvesAmbiguityId,
      securitySensitive: t.securitySensitive === true,
    };
  }

  /** Group questions into logical bundles (Phase 8 — no one-question-per-
   *  message spam; related questions are grouped under one topic). */
  private bundle(questions: RequirementQuestion[]): QuestionBundle[] {
    const byGroup = new Map<string, RequirementQuestion[]>();
    for (const q of questions) {
      const list = byGroup.get(q.groupId) ?? [];
      list.push(q);
      byGroup.set(q.groupId, list);
    }
    return Array.from(byGroup.entries()).map(([groupId, groupQuestions]) => ({
      id: groupId,
      title: groupQuestions[0]?.topic ?? groupId,
      questions: groupQuestions,
    }));
  }
}

/** BLOCKING when the template or its impacts demand it; IMPORTANT for
 *  business/UX-level decisions; OPTIONAL is only ever a default. */
function classify(classHint: QuestionClass, t: QuestionTemplate): QuestionClass {
  if (t.securitySensitive === true) return 'BLOCKING';
  if (t.impacts.architecture >= 4 || t.impacts.security >= 4) return 'BLOCKING';
  if (classHint === 'BLOCKING') return 'BLOCKING';
  if (classHint === 'IMPORTANT' || t.impacts.business >= 3 || t.impacts.ux >= 3) return 'IMPORTANT';
  return 'OPTIONAL';
}

function sortByScore(questions: RequirementQuestion[]): RequirementQuestion[] {
  return [...questions].sort((a, b) => rankScore(b.impacts) - rankScore(a.impacts));
}

function slug(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export type { QuestionOption, QuestionImpacts, QuestionBundle };

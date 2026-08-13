// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: Safe Default Engine
// EPIC-009 — Phase 9. For non-critical unknowns, proposes a default
// with ASSUMPTION / DEFAULT / REASON / IMPACT. The user may ACCEPT
// ALL, EDIT or REJECT. Critical / security-sensitive assumptions can
// never silently become defaults.
// ──────────────────────────────────────────────────────────────────

import type { SafeDefault, SafeDefaultStatus, RequirementSet } from '../types/requirement-types.js';
import {
  knowledgeFor,
  type ArchetypeKnowledge,
  type QuestionTemplate,
} from '../catalog/knowledge.js';
import type { AppArchetype } from '@vedmoulya/app-factory';

export interface SafeDefaultInput {
  sessionId: string;
  archetype: AppArchetype;
  requirements: RequirementSet;
  /** Answers already given by the user (a question answer overrides a default). */
  answeredTopics: string[];
}

export class SafeDefaultEngine {
  propose(input: SafeDefaultInput): SafeDefault[] {
    const k = knowledgeFor(input.archetype);
    const defaults: SafeDefault[] = [];

    // Knowledge defaults (declarative, each with reason + impact).
    for (const d of k.defaultTemplates) {
      if (input.answeredTopics.some((t) => t.toLowerCase() === d.unknown.toLowerCase())) continue;
      const relatedRequirement = input.requirements.requirements.find(
        (r) => r.description.toLowerCase() === d.relatedRequirementDescription.toLowerCase(),
      );
      defaults.push({
        id: d.id,
        unknown: d.unknown,
        assumption: d.assumption,
        defaultValue: d.defaultValue,
        reason: d.reason,
        impact: d.impact,
        status: 'proposed',
        securitySensitive: d.securitySensitive,
        relatedRequirementId: relatedRequirement?.id,
      });
    }

    // OPTIONAL questions are never asked — their safe default applies here.
    for (const q of k.questionTemplates) {
      if (q.class !== 'OPTIONAL') continue;
      if (input.answeredTopics.some((t) => t.toLowerCase() === q.topic.toLowerCase())) continue;
      const relatedRequirement = input.requirements.requirements.find(
        (r) => r.description === q.text,
      );
      defaults.push({
        id: `d-opt-${q.id}`,
        unknown: q.topic,
        assumption: `We will assume: ${q.defaultAnswer ?? q.text}`,
        defaultValue: q.defaultAnswer ?? '',
        reason: `question ${q.id} is optional — a safe default avoids asking questions whose answers can be safely defaulted`,
        impact: q.rationale,
        status: 'proposed',
        securitySensitive: q.securitySensitive === true,
        relatedRequirementId: relatedRequirement?.id,
      });
    }

    return defaults;
  }

  /** Apply a user decision to one default (immutable). */
  decide(
    defaults: SafeDefault[],
    defaultId: string,
    decision: SafeDefaultStatus,
    editedValue?: string,
  ): SafeDefault[] {
    return defaults.map((d) => {
      if (d.id !== defaultId) return d;
      if (decision === 'edited' && editedValue !== undefined) {
        return { ...d, status: 'edited', defaultValue: editedValue };
      }
      return { ...d, status: decision };
    });
  }

  /** ACCEPT ALL — but security-sensitive defaults are never bulk-accepted. */
  acceptAll(defaults: SafeDefault[]): SafeDefault[] {
    return defaults.map((d) => {
      if (d.securitySensitive && d.status === 'proposed') return d; // must be individually decided
      if (d.status === 'proposed') return { ...d, status: 'accepted' };
      return d;
    });
  }

  /** Are all defaults settled (accepted/edited/rejected)? */
  allSettled(defaults: SafeDefault[]): boolean {
    return defaults.every((d) => d.status !== 'proposed');
  }

  /** Counts of each decision state. */
  counts(defaults: SafeDefault[]): {
    proposed: number;
    accepted: number;
    edited: number;
    rejected: number;
  } {
    const c = { proposed: 0, accepted: 0, edited: 0, rejected: 0 };
    for (const d of defaults) {
      c[d.status] += 1;
    }
    return c;
  }
}

export type { QuestionTemplate, ArchetypeKnowledge };

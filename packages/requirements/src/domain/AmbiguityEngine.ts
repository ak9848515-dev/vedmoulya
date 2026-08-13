// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: Ambiguity Engine
// EPIC-009 — Phase 5. Detects ambiguous language, missing requirements,
// unclear terminology, architecture-changing uncertainty,
// security-sensitive uncertainty and unrealistic expectations.
// It does NOT ask every possible question — it flags what actually
// matters and links findings to the questions that resolve them.
// ──────────────────────────────────────────────────────────────────

import type {
  AmbiguityFinding,
  AmbiguityKind,
  AmbiguityReport,
  RequirementSet,
} from '../types/requirement-types.js';
import { knowledgeFor, type ArchetypeKnowledge } from '../catalog/knowledge.js';
import type { AppArchetype } from '@vedmoulya/app-factory';

export interface AmbiguityInput {
  sessionId: string;
  idea: string;
  archetype: AppArchetype;
  requirements: RequirementSet;
}

/** Vague adjectives that make a requirement untestable. */
const VAGUE_WORDS = [
  'modern',
  'fast',
  'simple',
  'easy',
  'nice',
  'good',
  'powerful',
  'seamless',
  'awesome',
  'cool',
  'best',
];

/** Phrases that signal unrealistic expectations. */
const UNREALISTIC_PATTERNS: Array<{ pattern: RegExp; explanation: string }> = [
  {
    pattern: /one.?click\s+(full|complete|enterprise)/i,
    explanation: 'one-click full enterprise delivery is not realistic in a single step',
  },
  {
    pattern: /without (any )?(cost|budget)/i,
    explanation: 'no-cost full builds still consume AI and infrastructure budgets',
  },
  {
    pattern: /in (a |one )?day|overnight/i,
    explanation: 'complete production applications are not realistic overnight',
  },
  {
    pattern: /unlimited (everything|features|everything)/i,
    explanation: 'unlimited scope conflicts with bounded execution and cost budgets',
  },
];

/** Terms that are jargon-heavy without explanation. */
const JARGON_TERMS = [
  'tenant',
  'webhook',
  'idempotent',
  'oauth',
  'jwt',
  'microservice',
  'cdk',
  'terraform',
  'etl',
  'bff',
];

export class AmbiguityEngine {
  analyze(input: AmbiguityInput): AmbiguityReport {
    const k = knowledgeFor(input.archetype);
    const lower = input.idea.toLowerCase();
    const findings: AmbiguityFinding[] = [];
    let seq = 0;
    const add = (
      kind: AmbiguityKind,
      topic: string,
      explanation: string,
      impact: 'high' | 'medium' | 'low',
      excerpt?: string,
      relatedQuestionId?: string,
    ): void => {
      seq += 1;
      findings.push({
        id: `AMB-${String(seq).padStart(3, '0')}`,
        kind,
        topic,
        explanation,
        impact,
        excerpt,
        relatedQuestionId,
      });
    };

    // 1. Ambiguous language.
    // Word-boundary matching on the tokenized idea (no dynamic RegExp — the
    // word lists are static and tokenization is deterministic).
    const words = new Set(lower.split(/[^a-z0-9]+/).filter(Boolean));
    const vague = VAGUE_WORDS.filter((w) => words.has(w));
    if (vague.length > 0) {
      add(
        'ambiguous_language',
        'vague adjectives',
        `The idea uses vague adjectives (${vague.join(', ')}) that cannot be validated as-is — a concrete definition is needed.`,
        'medium',
        input.idea,
      );
    }

    // 2. Unclear terminology.
    const jargon = JARGON_TERMS.filter((t) => words.has(t));
    if (jargon.length > 0) {
      add(
        'unclear_terminology',
        'technical jargon',
        `The idea uses technical terms (${jargon.join(', ')}) without context — confirm what they mean for this product.`,
        'medium',
        input.idea,
      );
    }

    // 3. Unrealistic expectations.
    for (const u of UNREALISTIC_PATTERNS) {
      if (u.pattern.test(input.idea)) {
        add(
          'unrealistic_expectation',
          'unrealistic expectation',
          u.explanation,
          'high',
          input.idea,
        );
      }
    }

    // 4. Architecture-changing + security-sensitive uncertainty from open
    //    BLOCKING / security-sensitive questions.
    for (const q of k.questionTemplates) {
      const answered = input.requirements.requirements.some(
        (r) => r.source === 'QUESTION' && r.description === q.text && r.status !== 'UNKNOWN',
      );
      const stillUnknown = input.requirements.requirements.some(
        (r) => r.source === 'QUESTION' && r.description === q.text && r.status === 'UNKNOWN',
      );
      if (!answered && stillUnknown) {
        if (q.securitySensitive === true) {
          add('security_sensitive_uncertainty', q.topic, q.text, 'high', undefined, q.id);
        } else if (q.class === 'BLOCKING') {
          add('architecture_changing_uncertainty', q.topic, q.text, 'high', undefined, q.id);
        }
      }
    }

    // 5. Missing requirements (archetype core features absent from the idea).
    const missing = this.missingCore(input, k);
    for (const m of missing) {
      add('missing_requirement', m.topic, m.explanation, 'medium', undefined, m.questionId);
    }

    return { sessionId: input.sessionId, findings };
  }

  private missingCore(
    input: AmbiguityInput,
    k: ArchetypeKnowledge,
  ): Array<{ topic: string; explanation: string; questionId?: string }> {
    const idea = input.idea.toLowerCase();
    const missing: Array<{ topic: string; explanation: string; questionId?: string }> = [];
    for (const q of k.questionTemplates) {
      // A blocking question whose topic is not addressed anywhere in the idea.
      const topicWords = q.topic.toLowerCase().split(/\s+/);
      const addressed = topicWords.some((w) => w.length > 3 && idea.includes(w));
      if (q.class === 'BLOCKING' && !addressed) {
        missing.push({
          topic: q.topic,
          explanation: `The idea does not address ${q.topic} — this is core to the ${k.archetype} product.`,
          questionId: q.id,
        });
      }
    }
    return missing;
  }
}

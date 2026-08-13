// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: RAG Strategy Engine
// EPIC-009 — Phase 18. Determines whether the application needs
// external/domain knowledge. If yes: required sources, freshness,
// authority, retrieval strategy, grounding and evidence requirements
// (reusing the existing RAG + EvidenceEvaluator contracts). If no:
// no unnecessary RAG is added.
// ──────────────────────────────────────────────────────────────────

import type { AppArchetype } from '@vedmoulya/app-factory';
import type { RAGStrategy } from '../types/requirement-types.js';
import { knowledgeFor } from '../catalog/knowledge.js';

export interface RAGStrategyInput {
  sessionId: string;
  archetype: AppArchetype;
  /** Whether the AI strategy requires grounding. */
  aiRagRequired: boolean;
  /** User answers that enable/disable knowledge retrieval. */
  answers: Array<{ questionId: string; answer: string }>;
}

export class RAGStrategyEngine {
  derive(input: RAGStrategyInput): RAGStrategy {
    const k = knowledgeFor(input.archetype);
    const answers = new Map(input.answers.map((a) => [a.questionId, a.answer]));
    const codeOnly = answers.get('q-abap-knowledge') === 'code_only';
    const required = k.rag.required && !codeOnly && input.aiRagRequired;

    if (!required) {
      return {
        required: false,
        sources: [],
        retrievalStrategy: 'none',
        groundingRequired: false,
        evidenceRequired: false,
        reasons: [
          'No external/domain knowledge required for this application',
          'RAG adds cost and latency — never added unnecessarily',
        ],
      };
    }

    return {
      required: true,
      sources: k.rag.sources,
      retrievalStrategy: `${k.rag.retrievalStrategy} (top-k with min-score threshold)`,
      groundingRequired: true,
      evidenceRequired: true,
      reasons: [
        ...k.rag.reasons,
        'Grounding + evidence evaluation via the existing RAG and EvidenceEvaluator — no new retrieval engine',
      ],
    };
  }
}

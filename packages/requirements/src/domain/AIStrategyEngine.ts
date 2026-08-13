// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: AI Strategy Engine
// EPIC-009 — Phase 17. Determines whether AI is ACTUALLY required.
// When it is: capability, model class, provider strategy, context
// requirements, RAG requirement, structured output, tool calling,
// latency/quality requirements, token budget and fallback. All AI
// flows through the existing AI Runtime — no provider-specific logic.
// ──────────────────────────────────────────────────────────────────

import type { AppArchetype } from '@vedmoulya/app-factory';
import type { AIStrategy, RequirementSet } from '../types/requirement-types.js';
import { knowledgeFor } from '../catalog/knowledge.js';

export interface AIStrategyInput {
  sessionId: string;
  archetype: AppArchetype;
  requirements: RequirementSet;
  /** User answers that force AI usage (e.g. builder should use AI). */
  answers: Array<{ questionId: string; answer: string }>;
}

export class AIStrategyEngine {
  derive(input: AIStrategyInput): AIStrategy {
    const k = knowledgeFor(input.archetype);
    const answers = new Map(input.answers.map((a) => [a.questionId, a.answer]));
    // Only positive AI requirements count — the "No unnecessary AI" baseline
    // requirement must never force an AI strategy onto a non-AI product.
    const aiRequested = input.requirements.requirements.some(
      (r) =>
        r.category === 'ai' &&
        r.status !== 'REJECTED' &&
        !r.description.startsWith('No unnecessary'),
    );
    const builderUsesAi =
      (answers.get('q-builder-ai') ?? '') === 'both' ||
      (answers.get('q-builder-ai') ?? '') === 'builder_only';

    const required = k.ai.required || aiRequested || builderUsesAi;
    if (!required) {
      return {
        required: false,
        capabilities: [],
        modelClass: 'none — deterministic core',
        providerStrategy: 'n/a',
        contextRequirements: [],
        ragRequired: false,
        structuredOutput: false,
        toolCalling: false,
        latencyRequirement: 'Core flows never depend on AI latency',
        qualityRequirement: 'Deterministic correctness of core flows',
        tokenBudget: { maxInputTokens: 0, maxOutputTokens: 0 },
        fallback: 'n/a',
        reusesRuntime: true,
        reasons: [
          'AI is only introduced where it creates product value',
          'Avoiding unnecessary AI keeps cost and latency bounded',
        ],
      };
    }

    return {
      required: true,
      capabilities: k.ai.capabilities,
      modelClass: k.ai.modelClass,
      providerStrategy: `${k.ai.providerStrategy} via the frozen AI runtime (routing, budgets, evidence)`,
      contextRequirements: [
        ...k.ai.contextRequirements,
        'Only minimum necessary context (never the whole repository)',
      ],
      ragRequired: k.rag.required,
      structuredOutput: k.ai.structuredOutput,
      toolCalling: k.ai.toolCalling,
      latencyRequirement: k.ai.latencyRequirement,
      qualityRequirement: k.ai.qualityRequirement,
      tokenBudget: k.ai.tokenBudget,
      fallback: k.ai.fallback,
      reusesRuntime: true,
      reasons: [
        ...k.ai.reasons,
        'Every AI call flows through the frozen AI runtime — no provider SDKs in product engines',
      ],
    };
  }
}

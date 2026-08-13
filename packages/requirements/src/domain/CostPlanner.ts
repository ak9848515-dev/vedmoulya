// ──────────────────────────────────────────────────────────────────
// VedMoulya — Product Intelligence: Cost / Token Planner
// EPIC-009 — Phase 21. Before the build, estimates AI calls, input and
// output tokens, RAG calls, embedding calls, expected iterations,
// estimated cost and latency. Reuses the frozen token estimation and
// optimization concepts — never sends the entire repository context.
// ──────────────────────────────────────────────────────────────────

import type { AppArchetype } from '@vedmoulya/app-factory';
import type { AIStrategy, CostPlan, RAGStrategy } from '../types/requirement-types.js';
import { knowledgeFor } from '../catalog/knowledge.js';

export interface CostInput {
  sessionId: string;
  archetype: AppArchetype;
  ai: AIStrategy;
  rag: RAGStrategy;
  /** Confirmed functional requirements (scales the estimate). */
  confirmedFeatures: number;
}

export class CostPlanner {
  plan(input: CostInput): CostPlan {
    const k = knowledgeFor(input.archetype);
    const cost = k.cost;

    if (!input.ai.required) {
      return {
        aiCalls: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        ragCalls: 0,
        embeddingCalls: 0,
        expectedIterations: 0,
        estimatedCostUsd: 0,
        estimatedLatencyMs: 0,
        strategy: [
          'No AI calls — deterministic core keeps cost at zero',
          'AI is never added unnecessarily',
        ],
        assumptions: cost.assumptions,
      };
    }

    const featureFactor = Math.max(1, Math.ceil(input.confirmedFeatures / 4));
    const aiCalls = cost.baseAiCalls + featureFactor * 2;
    const ragCalls = input.rag.required ? cost.ragCalls + featureFactor : 0;
    const embeddingCalls = input.rag.required ? ragCalls : 0;
    const inputTokens = (cost.inputTokensPerCall + featureFactor * 150) * aiCalls;
    const outputTokens = cost.outputTokensPerCall * aiCalls;
    const totalTokens = inputTokens + outputTokens;
    const estimatedCostUsd = round3(aiCalls * cost.costPerCallUsd + ragCalls * 0.0004);
    const estimatedLatencyMs = aiCalls * cost.latencyPerCallMs;

    return {
      aiCalls,
      inputTokens,
      outputTokens,
      totalTokens,
      ragCalls,
      embeddingCalls,
      expectedIterations: cost.expectedIterations,
      estimatedCostUsd,
      estimatedLatencyMs,
      strategy: [
        'Stable-prefix prompt caching enabled (default)',
        'Provider routing via the AI runtime (capability-based, cheapest eligible)',
        'Context optimization: only minimum necessary context per call',
        'Budget bounds: maxInputTokens / maxOutputTokens enforced before every call',
      ],
      assumptions: cost.assumptions,
    };
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

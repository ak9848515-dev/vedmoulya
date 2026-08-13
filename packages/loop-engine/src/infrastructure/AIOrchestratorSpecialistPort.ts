// ──────────────────────────────────────────────────────────────────
// VedMoulya — Loop Engine: AI Runtime Specialist Adapter
// EPIC-006 — Phase 3. The SINGLE point where the loop engine talks to
// an AI provider. It wraps the frozen AIOrchestrationService, so every
// specialist call inherits: capability routing (AI-SELECT), EI-002
// provider intelligence, EI-004 execution strategy, EI-003 context
// optimization, Evidence-First grounding (RAG + abstention), retry +
// fallback, structured output validation, caching and metrics.
// The loop engine NEVER calls provider SDKs.
// ──────────────────────────────────────────────────────────────────

import type {
  AIOrchestrationService,
  OrchestrateResponseDTO,
  EvidenceState,
} from '@vedmoulya/services';
import type {
  SpecialistExecutionInput,
  SpecialistExecutionPort,
  SpecialistExecutionResult,
} from '../contracts/loop-ports.js';

export class AIOrchestratorSpecialistPort implements SpecialistExecutionPort {
  constructor(private readonly ai: AIOrchestrationService) {}

  async execute(input: SpecialistExecutionInput): Promise<SpecialistExecutionResult> {
    const response = await this.ai.orchestrate({
      capability: input.capability,
      qualityTier: input.qualityTier,
      userInput: input.userInput,
      userId: input.userId,
      context: {
        systemPrompt: input.systemPrompt,
        knowledgeContext: input.context?.knowledgeContext,
        executionContext: input.context?.executionContext,
      },
      constraints: {
        maxInputTokens: input.constraints?.maxInputTokens,
        maxOutputTokens: input.constraints?.maxOutputTokens,
        maxCost: input.constraints?.maxCost,
        maxLatencyMs: input.constraints?.maxLatencyMs,
      },
      ragQuery: input.ragQuery,
      groundingRequired: input.groundingRequired,
      enableOptimization: input.enableOptimization ?? true,
      structuredSchema: input.structuredSchema,
    });
    return this.toResult(response);
  }

  /** Phase 3 decision query: WHO should perform this task (no execution). */
  async explain(input: {
    capability: SpecialistExecutionInput['capability'];
    estimatedInputTokens?: number;
  }): Promise<{ providerId: string; modelId: string; reasons: string[]; strategy: string }> {
    const explanation = await this.ai.explainSelection({
      capability: input.capability,
      estimatedInputTokens: input.estimatedInputTokens ?? 1_000,
    });
    return {
      providerId: explanation.selected.providerId,
      modelId: explanation.selected.modelId,
      reasons: explanation.selected.reasons,
      strategy: explanation.strategy,
    };
  }

  private toResult(response: OrchestrateResponseDTO): SpecialistExecutionResult {
    const selection = response.providerSelection;
    return {
      content: response.content,
      provider: response.provider,
      model: response.model,
      tokens: {
        input: response.tokenUsage.input,
        output: response.tokenUsage.output,
        total: response.tokenUsage.total,
      },
      costUsd: response.cost,
      latencyMs: response.latency,
      abstained: response.abstained === true,
      evidenceState: (response.evidence?.state as EvidenceState | undefined) ?? undefined,
      // AI-SELECT explanation when the advisor is wired; otherwise fall back to
      // the runtime's routing decision so the trace is ALWAYS explainable.
      selectionExplanation: selection
        ? `Selected ${selection.selected.providerId}/${selection.selected.modelId} (${selection.strategy}) — ${selection.selected.reasons.join('; ')}`
        : `Selected ${response.routingDecision.selectedProvider} (${response.routingDecision.strategy}) — ${response.routingDecision.reason}`,
      validationDecision: response.validation.decision,
    };
  }
}

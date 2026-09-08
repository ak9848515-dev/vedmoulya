// ──────────────────────────────────────────────────────────────────
// VedMoulya — Agent Execution Intelligence: AI Runtime Port
//
// Adapts the frozen AIOrchestrationService into the AgentAiExecutionPort.
// EVERY AI action inside the controlled agent loop inherits routing
// intelligence (ProviderRoutingAdvisor → RoutingEvidenceService +
// ExecutionHealthService), provider/model capability gates,
// retry/fallback, CostLedger usage recording, Evidence-First abstention
// and the actual provider/model execution contract. The agent layer
// only asks "give me the best available model for this step"; the
// routing layer decides. The agent NEVER calls provider SDKs.
// ──────────────────────────────────────────────────────────────────

import type { AIOrchestrationService, OrchestrateResponseDTO } from '@vedmoulya/services';
import type {
  AgentAiActionInput,
  AgentAiActionResult,
  AgentAiExecutionPort,
} from '../contracts/agent-execution-ports.js';

/**
 * The single AI execution boundary for the controlled agent loop.
 * Wraps AIOrchestrationService.orchestrate — no routing, no registry,
 * no retry logic is re-implemented here.
 */
export class AIOrchestrationAgentPort implements AgentAiExecutionPort {
  constructor(private readonly ai: AIOrchestrationService) {}

  async execute(input: AgentAiActionInput): Promise<AgentAiActionResult> {
    const response = await this.ai.orchestrate({
      capability: input.capability,
      // The agent preserves requiredCapabilities in FULL — never collapsed
      // to [capability] — so the runtime hard-gates on every requirement.
      requiredCapabilities: input.requiredCapabilities,
      qualityTier: input.qualityTier,
      userInput: input.instruction,
      userId: input.userId,
      context: {
        // Previous observations of this step are appended as execution context
        // for revision/recovery attempts (already sanitized + sliced by the
        // engine). Raw prompts are never stored — only engine-composed text.
        executionContext:
          input.previousObservations !== undefined && input.previousObservations.length > 0
            ? `Previous observations for this step:\n${input.previousObservations.join('\n')}`
            : undefined,
      },
      constraints: {
        outputFormat: 'text',
      },
    });
    return this.toResult(response);
  }

  /**
   * Pure feasibility query for plan validation: can this step's capability
   * set be routed today? Delegates to the runtime's selection intelligence
   * (ProviderRoutingAdvisor + model capability gates + health/evidence) and
   * executes nothing.
   */
  async canRoute(input: {
    capability: AgentAiActionInput['capability'];
    requiredCapabilities?: AgentAiActionInput['requiredCapabilities'];
  }): Promise<{ ok: boolean; reason?: string }> {
    try {
      await this.ai.explainSelection({
        capability: input.capability,
        requiredCapabilities: input.requiredCapabilities,
        estimatedInputTokens: 1_000,
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : String(error) };
    }
  }

  private toResult(response: OrchestrateResponseDTO): AgentAiActionResult {
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
      // AI-SELECT explanation when the advisor is wired; otherwise fall back
      // to the runtime's routing decision so the trace is ALWAYS explainable.
      selectionExplanation: selection
        ? `Selected ${selection.selected.providerId}/${selection.selected.modelId} (${selection.strategy}) — ${selection.selected.reasons.join('; ')}`
        : `Selected ${response.routingDecision.selectedProvider} (${response.routingDecision.strategy}) — ${response.routingDecision.reason}`,
    };
  }
}

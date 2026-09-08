// ──────────────────────────────────────────────────────────────────
// VedMoulya — Autonomous Planning Intelligence: AI Runtime Port
//
// Adapts the frozen AIOrchestrationService into the PlannerAiPort.
// EVERY planner proposal inherits the full runtime intelligence:
// ProviderRoutingAdvisor → RoutingEvidenceService + ExecutionHealthService,
// provider/model capability gates, retry/fallback, CostLedger usage
// recording and Evidence-First abstention. The planner only asks "propose
// a plan for this goal"; the routing layer decides provider/model — no
// provider is hard-coded and no provider SDK is ever called here.
//
// The returned content is UNTRUSTED INPUT: the planner parses it
// defensively (see domain/plan-proposal.ts) before it can become a plan.
// ──────────────────────────────────────────────────────────────────

import type { AIOrchestrationService, OrchestrateResponseDTO } from '@vedmoulya/services';
import type { CapabilityType } from '@vedmoulya/ai';
import type {
  PlannerAiPort,
  PlannerAiProposalInput,
  PlannerAiProposalResult,
} from '../contracts/planning-ports.js';

const PLANNING_SYSTEM_PROMPT = `You are the plan PROPOSAL assistant inside VedMoulya's autonomous planning layer.

Your ONLY job is to propose a plan as a JSON object. You never execute anything, never
call tools, never choose providers/models, and never fabricate tools.

Rules:
- The plan must be the SMALLEST viable plan that accomplishes the goal.
- Every step must declare a capability from this frozen taxonomy only:
  reasoning, coding, vision, embeddings, summarization, classification, translation,
  speech, image_understanding, general_conversation, content_generation.
- Tools may be selected ONLY from the provided availableTools list — never invent a tool.
- Every meaningful step MUST declare a verification policy (kind: rule|schema|artifact|command|state|model).
- Recovery must be bounded (maxAttempts 1..3, maxRevisions 0..2).
- Do NOT include provider, model, or any routing fields — the runtime decides routing.
- Output ONLY the JSON object.`;

const PROPOSAL_SCHEMA_DESCRIPTION = `JSON plan proposal:
{
  "objective": string,
  "steps": [
    {
      "stepId": "step-N" (optional),
      "objective": string,
      "capability": CapabilityType (optional),
      "requiredCapabilities": CapabilityType[] (optional),
      "dependencies": string[] (stepIds),
      "allowedTools": string[] (from availableTools only),
      "actions": [
        { "kind": "ai", "capability": CapabilityType, "instruction": string, "requiredCapabilities"?: [] }
        | { "kind": "tool", "toolName": string, "arguments"?: object }
      ],
      "expectedOutcome": string (optional),
      "verification": { "kind": "rule", "description": string, "checks": [{ "name": string, "kind": "includes|notIncludes|minLength", "text"?: string, "length"?: number }] }
        | { "kind": "schema", "description": string, "requiredKeys": string[] }
        | { "kind": "artifact", "description": string, "artifact": { "name": string, "mustExist"?: boolean } }
        | { "kind": "command", "description": string, "command": { "toolName": string, "expect": "ok|fails" } }
        | { "kind": "state", "description": string, "state": { "artifactName": string, "change": "created|absent" } }
        | { "kind": "model", "description": string, "criteria": string[] },
      "recovery"?: { "maxAttempts"?: number, "maxRevisions"?: number, "alternateTools"?: string[] },
      "approvalRequired"?: boolean
    }
  ],
  "completionCriteria": string[] (optional),
  "finalVerification": { same shape as verification } (optional)
}`;

/**
 * The single AI boundary for planning. Wraps AIOrchestrationService —
 * no routing, no registry, no retry logic is re-implemented here.
 */
export class AIOrchestrationPlannerPort implements PlannerAiPort {
  constructor(private readonly ai: AIOrchestrationService) {}

  async propose(input: PlannerAiProposalInput): Promise<PlannerAiProposalResult> {
    const toolGuidance =
      input.constraints.allowToolUse && input.availableTools.length > 0
        ? `Available tools (select ONLY from this list): ${input.availableTools.join(', ')}`
        : 'No tools are available on this platform. Use AI actions only.';
    const capabilityGuidance =
      input.requiredCapabilities.length > 0
        ? `The goal already requires these capabilities (preserve them in FULL across the plan): ${input.requiredCapabilities.join(', ')}`
        : 'The goal capabilities are not yet inferred — propose them, but only from the frozen taxonomy.';

    const response: OrchestrateResponseDTO = await this.ai.orchestrate({
      capability: 'reasoning',
      requiredCapabilities: ['reasoning'],
      qualityTier: 'standard',
      userInput: [
        `Goal: ${input.goal}`,
        `Objective: ${input.objective}`,
        capabilityGuidance,
        toolGuidance,
        `Maximum steps: ${String(input.constraints.maxSteps)}`,
        `Autonomy level: ${input.constraints.autonomyLevel}`,
        '',
        PROPOSAL_SCHEMA_DESCRIPTION,
      ].join('\n'),
      userId: input.userId,
      context: {
        systemPrompt: PLANNING_SYSTEM_PROMPT,
      },
      constraints: {
        outputFormat: 'json',
        maxOutputTokens: 4_000,
      },
    });

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
    };
  }

  /**
   * Pure feasibility query for plan readiness: can this capability set be
   * routed today? Delegates to the runtime's selection intelligence
   * (ProviderRoutingAdvisor + capability gates + health/evidence) and
   * executes nothing.
   */
  async canRoute(input: {
    capability: CapabilityType;
    requiredCapabilities?: CapabilityType[];
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
}

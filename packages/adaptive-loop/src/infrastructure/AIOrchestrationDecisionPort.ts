// ──────────────────────────────────────────────────────────────────
// VedMoulya — Adaptive Agent Loop: AI Decision Model Port
//
// The ONLY way the adaptive loop consults a model. This adapter wraps the
// frozen AIOrchestrationService — so every decision consultation inherits
// ProviderRoutingAdvisor → RoutingEvidenceService → ExecutionHealthService
// → capability gates → retry/fallback → CostLedger. No provider SDK is
// ever called here and no provider/model is hard-coded.
//
// The returned content is UNTRUSTED INPUT: the engine parses it with the
// whitelist parser (domain/decision.ts) and validates it before any
// action proposal can exist.
// ──────────────────────────────────────────────────────────────────

import type { AIOrchestrationService } from '@vedmoulya/services';
import type {
  AgentDecisionModelPort,
  DecisionContext,
  DecisionProposalResult,
} from '../contracts/adaptive-loop-ports.js';

const DECISION_SYSTEM_PROMPT = `You are the adaptive decision assistant inside VedMoulya's autonomous loop.

You propose the NEXT ACTION only. You never execute anything, never call tools directly,
never choose providers/models, and never change permissions, budgets or autonomy.

Decide using ONLY this closed set of decision kinds:
CONTINUE, TOOL_CALL, AI_ACTION, VERIFY, REVISE_STEP, REPLAN, COMPLETE, FAIL, REQUEST_APPROVAL, ABSTAIN.

Rules:
- Only use tools listed in "availableTools". Never invent a tool.
- Only use capabilities already listed in "allowedCapabilities". Never escalate.
- A TOOL_CALL may include tool, arguments, and an optional capability from the allowed list.
- An AI_ACTION must include a capability from the allowed list and optional requiredCapabilities (subset of allowed).
- COMPLETE is only legitimate when the observations show the goal is achieved and verified — the
  engine will refuse completion without verification evidence.
- If you lack evidence to decide safely, use ABSTAIN with an abstainReason. Never fabricate.
- Never include provider, model, permission, budget, autonomy or execution-directive fields.

Output ONLY a JSON object:
{
  "kind": "CONTINUE|TOOL_CALL|AI_ACTION|VERIFY|REVISE_STEP|REPLAN|COMPLETE|FAIL|REQUEST_APPROVAL|ABSTAIN",
  "rationale": "short bounded reason",
  "targetStepId"?: string,
  "capability"?: CapabilityType,
  "requiredCapabilities"?: CapabilityType[],
  "tool"?: string,
  "arguments"?: object,
  "reviseInstruction"?: string,
  "replanReason"?: string,
  "failReason"?: string,
  "approvalReason"?: string,
  "abstainReason"?: string
}`;

const DECISION_PROMPT_SCHEMA = `Decision context (all sanitized):
- goal
- current step (stepId, objective, capability)
- recent observations (status + summary)
- availableTools (authorized)
- allowedCapabilities
- remainingBudget (actions, toolCalls, tokens, costUsd, decisionIterations)
- verificationState
- recoveryState (attempts, revisions, replans, abstains)`;

/**
 * The single AI consultation boundary for adaptive decisions. Wraps
 * AIOrchestrationService — no routing, no registry, no retry logic is
 * re-implemented here.
 */
export class AIOrchestrationDecisionPort implements AgentDecisionModelPort {
  constructor(private readonly ai: AIOrchestrationService) {}

  async decide(input: DecisionContext): Promise<DecisionProposalResult> {
    const sections = [
      `Goal: ${input.goal}`,
      input.currentStep
        ? `Current step: ${input.currentStep.stepId} — ${input.currentStep.objective}${input.currentStep.capability ? ` (capability: ${input.currentStep.capability})` : ''}`
        : 'Current step: none (goal-level decision)',
      `Recent observations (bounded): ${input.recentObservations.length === 0 ? 'none' : input.recentObservations.map((o) => `${o.observationId} ${o.stepId}:${o.status} ${o.resultSummary}`).join(' | ')}`,
      `Available tools (authorized): ${input.availableTools.length > 0 ? input.availableTools.join(', ') : 'none'}`,
      `Allowed capabilities: ${input.allowedCapabilities.join(', ')}`,
      `Remaining budget: ${JSON.stringify(input.remainingBudget)}`,
      `Verification state: ${input.verificationState}`,
      `Recovery state: ${JSON.stringify(input.recoveryState)}`,
      DECISION_PROMPT_SCHEMA,
    ].join('\n');

    try {
      const response = await this.ai.orchestrate({
        capability: 'reasoning',
        requiredCapabilities: ['reasoning'],
        qualityTier: 'standard',
        userInput: sections,
        userId: input.userId,
        context: {
          systemPrompt: DECISION_SYSTEM_PROMPT,
        },
        constraints: {
          outputFormat: 'json',
          maxOutputTokens: 700,
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
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        abstained: true,
      };
    }
  }
}

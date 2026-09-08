// ──────────────────────────────────────────────────────────────────
// VedMoulya — Autonomous Planning Intelligence: Planner Service
//
//   GOAL → UNDERSTANDING → GENERATION (deterministic template or
//   routing-backed AI proposal) → VALIDATION → READINESS
//
// The planner PROPOSES — it never executes. A generated plan is
// UNTRUSTED (especially AI output) until it passes the full validation
// pipeline and readiness; only a READY plan can be handed to the frozen
// AgentExecutionService.
//
// AI planning is OPT-IN (mode: 'ai') and goes through the PlannerAiPort
// (implemented over the frozen AIOrchestrationService — proposals
// inherit routing/health/evidence/cost intelligence; no provider is
// hard-coded). AI output is parsed defensively; a failure or malformed
// output is handled honestly (recorded + deterministic fallback), never
// silently discarded.
// ──────────────────────────────────────────────────────────────────

import { generateId } from '@vedmoulya/core';
import { sanitizeTraceText } from '@vedmoulya/agent-execution';
import type { AgentClockPort, AgentPlan, PlanValidationIssue } from '@vedmoulya/agent-execution';
import type { PlannerAiPort, AgentToolRegistryPort } from '../contracts/planning-ports.js';
import type {
  GoalUnderstanding,
  PlanGenerationResult,
  PlanGenerationSource,
  PlannerAiUsage,
} from '../types/planning-types.js';
import { GoalUnderstandingService } from './goal-understanding.js';
import { PLAN_TEMPLATES, selectTemplate, type PlanTemplate } from './planner-templates.js';
import { parsePlanProposal, planFromProposal } from './plan-proposal.js';
import { validateGeneratedPlan } from './plan-validation.js';
import { computePlanReadiness } from './plan-readiness.js';

export interface PlannerServiceOptions {
  /** Routing-backed planner AI port (optional; enables AI proposals). */
  ai?: PlannerAiPort;
  /** Authoritative tool registry (required when plans select tools). */
  toolRegistry?: AgentToolRegistryPort;
  /** Deterministic clock (tests). */
  clock?: AgentClockPort;
  /** Template catalog (defaults to the built-in deterministic templates). */
  templates?: readonly PlanTemplate[];
}

export interface GeneratePlanInput {
  userId?: string;
  goal: string;
  context?: string;
  constraints?: import('../types/planning-types.js').PlanConstraint;
  /** 'deterministic' (default) | 'ai' (routing-backed proposal). */
  mode?: 'deterministic' | 'ai';
}

export interface GeneratePlanOutput {
  understanding: GoalUnderstanding;
  result: PlanGenerationResult;
}

const PLAN_VERSION = '1';

export class PlannerService {
  private readonly understandingService = new GoalUnderstandingService();
  private readonly ai?: PlannerAiPort;
  private readonly toolRegistry?: AgentToolRegistryPort;
  private readonly clock: AgentClockPort;
  private readonly templates: readonly PlanTemplate[];

  constructor(options: PlannerServiceOptions = {}) {
    this.ai = options.ai;
    this.toolRegistry = options.toolRegistry;
    this.clock = options.clock ?? {
      now: (): string => new Date().toISOString(),
      timestampMs: (): number => Date.now(),
    };
    this.templates = options.templates ?? PLAN_TEMPLATES;
  }

  /** The full planning pass: understand → generate → validate → readiness. */
  async generatePlan(input: GeneratePlanInput): Promise<GeneratePlanOutput> {
    const startedAt = this.clock.timestampMs();
    const understanding = this.understandingService.derive({
      userId: input.userId,
      goal: input.goal,
      context: input.context,
      constraints: input.constraints,
    });

    // Too ambiguous to plan reliably — ask instead of guessing.
    if (understanding.clarificationNeeded) {
      const issue: PlanValidationIssue = {
        severity: 'error',
        code: 'CLARIFICATION_REQUIRED',
        message: understanding.clarificationNeeded.reason,
      };
      return {
        understanding,
        result: this.buildResult({
          understanding,
          source: 'deterministic',
          planId: `plan-${generateId()}`,
          plan: undefined,
          issues: [issue],
          plannerAi: undefined,
          readiness: {
            status: 'BLOCKED',
            issues: [{ code: 'CLARIFICATION_REQUIRED', reason: issue.message }],
            blockedReasons: [issue.message],
          },
          startedAt,
        }),
      };
    }

    // 1. Generate a candidate plan.
    const mode = input.mode ?? 'deterministic';
    let source: PlanGenerationSource = 'deterministic';
    let plan: AgentPlan;
    let plannerAi: PlannerAiUsage | undefined;
    let generationIssue: PlanValidationIssue | undefined;

    if (mode === 'ai' && this.ai) {
      const proposal = await this.proposeViaAi(understanding, input);
      plannerAi = proposal.usage;
      if (proposal.plan !== undefined) {
        plan = proposal.plan;
        source = 'ai';
      } else {
        // Honest AI failure: record it, fall back to the deterministic
        // template, and surface the failure in the result.
        source = 'ai-fallback';
        plan = this.buildDeterministicPlan(understanding);
        generationIssue = {
          severity: 'warning',
          code: 'AI_PROPOSAL_REJECTED',
          message:
            proposal.failureReason ?? 'AI proposal rejected — deterministic plan used instead',
        };
      }
    } else {
      if (mode === 'ai' && !this.ai) {
        generationIssue = {
          severity: 'warning',
          code: 'AI_PLANNER_UNAVAILABLE',
          message:
            'AI planning requested but no planner AI port is wired — deterministic plan used',
        };
      }
      plan = this.buildDeterministicPlan(understanding);
    }

    // 2. Validate (deterministic pipeline; reuses the frozen structural
    //    validator and the frozen readiness feasibility checks).
    const issues: PlanValidationIssue[] = validateGeneratedPlan(plan, {
      budget: understanding.budget,
      constraints: input.constraints ?? {},
      toolRegistry: this.toolRegistry,
    });
    if (generationIssue) issues.push(generationIssue);
    this.checkCapabilityCoverage(understanding.requiredCapabilities, plan, issues);

    // 3. Readiness — deterministic and explainable.
    const readiness = await computePlanReadiness(plan, issues, {
      ai: this.ai
        ? {
            canRoute: (routingInput: {
              capability: import('@vedmoulya/ai').CapabilityType;
              requiredCapabilities?: import('@vedmoulya/ai').CapabilityType[];
            }): Promise<{ ok: boolean; reason?: string }> => {
              const port = this.ai;
              if (port?.canRoute === undefined) {
                return Promise.resolve({ ok: true });
              }
              return port.canRoute(routingInput);
            },
          }
        : undefined,
      toolRegistry: this.toolRegistry,
    });

    return {
      understanding,
      result: this.buildResult({
        understanding,
        source,
        planId: plan.planId,
        plan,
        issues,
        plannerAi,
        readiness,
        startedAt,
      }),
    };
  }

  // ── Capability coverage (multi-capability honesty) ───────────────

  /**
   * PHASE 6 — multi-capability requirements stay multi-capability. When
   * the understanding established capabilities the generated plan does not
   * actually cover, that is recorded EXPLICITLY (warning) — the plan never
   * silently drops an inferred requirement, and step/action declarations
   * are never collapsed.
   */
  private checkCapabilityCoverage(
    requiredCapabilities: string[],
    plan: AgentPlan,
    issues: PlanValidationIssue[],
  ): void {
    if (requiredCapabilities.length === 0) return;
    const covered = new Set<string>();
    for (const step of plan.steps) {
      if (step.capability) covered.add(step.capability);
      for (const action of step.actions) {
        if (action.kind === 'ai') {
          covered.add(action.capability);
          for (const required of action.requiredCapabilities ?? []) covered.add(required);
        }
      }
    }
    const uncovered = requiredCapabilities.filter((capability) => !covered.has(capability));
    if (uncovered.length > 0) {
      issues.push({
        severity: 'warning',
        code: 'CAPABILITY_NOT_COVERED',
        message: `goal understanding requires ${uncovered.join(
          ', ',
        )} but the generated plan does not declare them — the plan remains valid, but the requirement set is not fully represented in the plan`,
      });
    }
  }

  // ── Generation strategies ───────────────────────────────────────

  private buildDeterministicPlan(understanding: GoalUnderstanding): AgentPlan {
    const planId = `plan-${generateId()}`;
    const template = selectTemplate(understanding, this.templates);
    return template.build(understanding, planId);
  }

  private async proposeViaAi(
    understanding: GoalUnderstanding,
    input: GeneratePlanInput,
  ): Promise<{ plan?: AgentPlan; usage?: PlannerAiUsage; failureReason?: string }> {
    const ai = this.ai;
    if (!ai) return { failureReason: 'no planner AI port wired' };

    const availableTools = this.toolRegistry ? this.toolRegistry.listAllowed() : [];
    try {
      const proposalResult = await ai.propose({
        userId: input.userId,
        goal: understanding.normalizedGoal,
        objective: understanding.normalizedGoal,
        requiredCapabilities: understanding.requiredCapabilities,
        availableTools,
        constraints: {
          maxSteps: input.constraints?.maxSteps ?? 12,
          autonomyLevel: understanding.autonomyLevel,
          allowToolUse: availableTools.length > 0,
        },
      });
      const usage: PlannerAiUsage = {
        provider: proposalResult.provider,
        model: proposalResult.model,
        tokens: proposalResult.tokens,
        costUsd: proposalResult.costUsd,
        latencyMs: proposalResult.latencyMs,
        failed: proposalResult.abstained === true || proposalResult.error !== undefined,
        failureReason:
          proposalResult.error !== undefined
            ? sanitizeTraceText(proposalResult.error, { maxLength: 300 })
            : proposalResult.abstained === true
              ? 'runtime abstained (evidence-first)'
              : undefined,
      };
      if (proposalResult.error !== undefined || proposalResult.abstained === true) {
        return { usage, failureReason: usage.failureReason };
      }
      if (proposalResult.content === undefined || proposalResult.content.length === 0) {
        return { usage, failureReason: 'AI proposal produced no content' };
      }

      // UNTRUSTED input: parse + validate before anything becomes a plan.
      const parsed = parsePlanProposal(proposalResult.content);
      if (!parsed.ok) {
        return {
          usage,
          failureReason: `malformed AI proposal rejected: ${parsed.errors.slice(0, 3).join('; ')}`,
        };
      }
      const plan = planFromProposal(parsed.plan, understanding.goalId, `plan-${generateId()}`);
      return { plan, usage };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        usage: {
          failed: true,
          failureReason: sanitizeTraceText(message, { maxLength: 300 }),
        },
        failureReason: sanitizeTraceText(message, { maxLength: 300 }),
      };
    }
  }

  // ── Result assembly (observability) ─────────────────────────────

  private buildResult(input: {
    understanding: GoalUnderstanding;
    source: PlanGenerationSource;
    planId: string;
    plan: AgentPlan | undefined;
    issues: PlanValidationIssue[];
    plannerAi: PlannerAiUsage | undefined;
    readiness: import('../types/planning-types.js').PlanReadiness;
    startedAt: number;
  }): PlanGenerationResult {
    const selectedCapabilities: string[] = [];
    const selectedTools: string[] = [];
    const verificationKinds: string[] = [];
    const recoveryDescriptions: string[] = [];
    const seenCapability = new Set<string>();
    const seenTool = new Set<string>();

    for (const step of input.plan?.steps ?? []) {
      if (step.capability && !seenCapability.has(step.capability)) {
        seenCapability.add(step.capability);
        selectedCapabilities.push(step.capability);
      }
      for (const action of step.actions) {
        if (action.kind === 'ai') {
          if (!seenCapability.has(action.capability)) {
            seenCapability.add(action.capability);
            selectedCapabilities.push(action.capability);
          }
          for (const required of action.requiredCapabilities ?? []) {
            if (!seenCapability.has(required)) {
              seenCapability.add(required);
              selectedCapabilities.push(required);
            }
          }
        } else if (!seenTool.has(action.toolName)) {
          seenTool.add(action.toolName);
          selectedTools.push(action.toolName);
        }
      }
      if (step.verificationPolicy) {
        if (!verificationKinds.includes(step.verificationPolicy.kind)) {
          verificationKinds.push(step.verificationPolicy.kind);
        }
      }
      if (step.recoveryPolicy) {
        recoveryDescriptions.push(
          `${step.stepId}:${String(step.recoveryPolicy.maxAttempts ?? 'default')}a/${String(step.recoveryPolicy.maxRevisions ?? 'default')}r`,
        );
      }
    }
    if (input.plan?.finalVerification) {
      if (!verificationKinds.includes(input.plan.finalVerification.kind)) {
        verificationKinds.push(input.plan.finalVerification.kind);
      }
    }

    return {
      goalId: input.understanding.goalId,
      planId: input.planId,
      originalGoal: input.understanding.rawGoal,
      normalizedGoal: input.understanding.normalizedGoal,
      source: input.source,
      planVersion: PLAN_VERSION,
      plan: input.plan,
      readiness: input.readiness,
      issues: input.issues,
      selectedCapabilities: selectedCapabilities as PlanGenerationResult['selectedCapabilities'],
      selectedTools,
      verificationPolicies: verificationKinds as PlanGenerationResult['verificationPolicies'],
      recoveryPolicySummary:
        recoveryDescriptions.length > 0 ? recoveryDescriptions.join(' ') : undefined,
      plannerAi: input.plannerAi,
      planningLatencyMs: Math.max(this.clock.timestampMs() - input.startedAt, 0),
      generatedAt: this.clock.now(),
    };
  }
}

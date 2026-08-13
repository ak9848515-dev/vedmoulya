// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Intelligence Pipeline: Builder Service
// EI-006 / INT-001
// Orchestrates the full INT-001 flow by COMPOSING the six existing
// engines (never re-implementing them):
//
//   Goal (goals engine)
//     → Capability Discovery (capabilities engine)
//     → Provider Discovery (providers engine)
//     → Context Assembly (context engine)
//     → Execution Strategy (execution-strategy engine)
//     → Execution Graph (orchestrator engine)
//     → Execution Session (orchestrator engine — created, never run)
//
// The builder is a pure composition layer: every artifact is produced
// and validated by the owning engine. No AI calls, no execution.
// ──────────────────────────────────────────────────────────────────

import type { CapabilityType } from '@vedmoulya/ai';
import type { ExecutionStrategyDTO } from '@vedmoulya/execution-strategy';
import type { BuildGraphInputDTO } from '@vedmoulya/execution-orchestrator';
import type {
  EnterprisePipeline,
  EnterprisePipelineStep,
  PipelineBuildInput,
  PipelineStage,
} from '../../types/pipeline-types.js';
import type { IntelligenceEngines } from '../../contracts/pipeline-engines.js';
import { generatePipelineId } from '../value-objects/PipelineId.js';

export class PipelineBuilderService {
  private readonly engines: IntelligenceEngines;

  constructor(engines: IntelligenceEngines) {
    this.engines = engines;
  }

  /**
   * Build a full Enterprise Intelligence Pipeline for a goal.
   * The pipeline records what every engine resolved — it never executes.
   */
  async build(input: PipelineBuildInput): Promise<EnterprisePipeline> {
    const now = new Date().toISOString();
    const pipelineId = generatePipelineId();
    const steps: EnterprisePipelineStep[] = [];
    const artifacts: EnterprisePipeline['artifacts'] = {
      capabilities: [],
      providers: [],
      contextItems: 0,
    };

    // ── Stage 1: Goal ────────────────────────────────────────────────────
    const goalResult = await this.engines.goals.getGoal(input.goalId);
    const goal = goalResult.success && goalResult.data ? goalResult.data : undefined;
    if (!goal) {
      steps.push(this.step('goal', 'failed', `Goal not found: ${input.goalId}`, {}, []));
      return this.finish(pipelineId, input.goalId, 'Unknown goal', steps, artifacts, now);
    }

    steps.push(
      this.step('goal', 'passed', `Goal resolved: "${goal.title}"`, { goal: 1 }, [goal.goalId]),
    );

    // Ensure classification exists so capability discovery is grounded.
    // analyzeGoal is the goals engine's own understanding+classification
    // pipeline (deterministic heuristics, no AI) — reused as-is.
    if (!goal.classification) {
      await this.engines.goals.analyzeGoal(goal.goalId);
      const refreshed = await this.engines.goals.getGoal(goal.goalId);
      if (refreshed.success && refreshed.data?.classification) {
        goal.classification = refreshed.data.classification;
        goal.analysis = refreshed.data.analysis;
      }
    }

    const requiredCapabilities = this.requiredCapabilities(goal);
    const requiredContext: string[] =
      goal.classification?.requiredContext ?? goal.analysis?.contextHints ?? [];

    // ── Stage 2: Capability Discovery ───────────────────────────────────
    // The goal's required capabilities are AI-feature names (CapabilityType,
    // e.g. 'reasoning'). The registry keys capabilities by business ids
    // (e.g. research/writing/review). Resolve each required feature to the
    // registry capabilities that declare it in requiredAIFeatures — first by
    // direct id lookup (feature name coinciding with a capability id, e.g.
    // content_generation), then by feature-based resolution. (B-01 fix.)
    const capabilityIds = new Set<string>();
    const missingCapabilities: string[] = [];
    for (const capability of requiredCapabilities) {
      const direct = await this.engines.capabilities.getCapability(capability);
      if (direct.success && direct.data) {
        capabilityIds.add(direct.data.id);
        continue;
      }
      const byFeature = await this.engines.capabilities.findByAIFeatures([capability]);
      if (byFeature.success && byFeature.data && byFeature.data.length > 0) {
        for (const cap of byFeature.data) {
          capabilityIds.add(cap.id);
        }
      } else {
        missingCapabilities.push(capability);
      }
    }
    const resolvedCapabilities = [...capabilityIds];
    // Fail loudly on partial coverage: every required feature must resolve,
    // otherwise the pipeline would silently execute with missing capability
    // coverage (B-01 hardening).
    const capabilitiesPassed = resolvedCapabilities.length > 0 && missingCapabilities.length === 0;
    steps.push(
      this.step(
        'capabilities',
        capabilitiesPassed ? 'passed' : 'failed',
        capabilitiesPassed
          ? `Resolved ${String(resolvedCapabilities.length)} capability/capabilities for ${String(requiredCapabilities.length)} required feature(s)`
          : `No required capabilities resolved (missing: ${missingCapabilities.join(', ') || 'none'})`,
        {
          required: requiredCapabilities.length,
          found: resolvedCapabilities.length,
          missing: missingCapabilities.length,
        },
        resolvedCapabilities,
      ),
    );
    artifacts.capabilities = resolvedCapabilities;

    // ── Stage 3: Provider Discovery ─────────────────────────────────────
    const providerIds = new Set<string>();
    for (const capability of requiredCapabilities) {
      const providerResult = await this.engines.providers.getProvidersForCapability(capability);
      if (providerResult.success && providerResult.data) {
        for (const candidate of providerResult.data) {
          providerIds.add(candidate.providerId);
        }
      }
    }
    const providersPassed = providerIds.size > 0;
    steps.push(
      this.step(
        'providers',
        providersPassed ? 'passed' : 'failed',
        providersPassed
          ? `Found ${String(providerIds.size)} provider candidate(s) across ${String(requiredCapabilities.length)} capability/capabilities`
          : 'No provider candidates found for the required capabilities',
        { capabilities: requiredCapabilities.length, providers: providerIds.size },
        [...providerIds],
      ),
    );
    artifacts.providers = [...providerIds];

    // ── Stage 4: Context Assembly ───────────────────────────────────────
    const contextResult = await this.engines.context.searchContext({
      capabilities: requiredCapabilities,
      sources: requiredContext.length > 0 ? (requiredContext as never) : undefined,
      limit: 50,
    });
    const contextItems = contextResult.success ? (contextResult.data?.total ?? 0) : 0;
    const contextPassed = contextItems > 0;
    steps.push(
      this.step(
        'context',
        contextPassed ? 'passed' : 'failed',
        contextPassed
          ? `Assembled ${String(contextItems)} context item(s) for the required capabilities`
          : 'No context items available for the required capabilities',
        { contextItems },
        [],
      ),
    );
    artifacts.contextItems = contextItems;

    // ── Stage 5: Execution Strategy ─────────────────────────────────────
    const strategyStage = await this.buildStrategyStage(
      goal.goalId,
      goal.title,
      goal.business,
      goal.priority,
    );
    steps.push(strategyStage.step);
    artifacts.strategyId = strategyStage.strategyId;

    // ── Stage 6: Execution Graph ────────────────────────────────────────
    const graphStage = strategyStage.graphInput
      ? await this.buildGraphStage(strategyStage.graphInput)
      : {
          step: this.step('execution-graph', 'skipped', 'Skipped — no valid strategy', {}, []),
          graphId: undefined,
        };
    steps.push(graphStage.step);
    artifacts.graphId = graphStage.graphId;

    // ── Stage 7: Execution Session ──────────────────────────────────────
    const sessionStage = strategyStage.graphInput
      ? await this.buildSessionStage(strategyStage.graphInput)
      : {
          step: this.step('execution-session', 'skipped', 'Skipped — no valid strategy', {}, []),
          sessionId: undefined,
        };
    steps.push(sessionStage.step);
    artifacts.sessionId = sessionStage.sessionId;

    return this.finish(pipelineId, goal.goalId, goal.title, steps, artifacts, now);
  }

  // ── Stage helpers ────────────────────────────────────────────────────────

  private async buildStrategyStage(
    goalId: string,
    goalTitle: string,
    business: string[],
    priority: string,
  ): Promise<{
    step: EnterprisePipelineStep;
    strategyId?: string;
    graphInput?: BuildGraphInputDTO;
  }> {
    // Reuse an existing strategy for the goal when one exists.
    const existing = await this.engines.strategies.listByGoal(goalId);
    const existingStrategy =
      existing.success && existing.data && existing.data.length > 0 ? existing.data[0] : undefined;
    if (existingStrategy) {
      return {
        step: this.step(
          'strategy',
          'passed',
          `Reused existing execution strategy ${existingStrategy.strategyId}`,
          { strategies: 1 },
          [existingStrategy.strategyId],
        ),
        strategyId: existingStrategy.strategyId,
        graphInput: this.graphInputFromStrategy(existingStrategy),
      };
    }

    const created = await this.engines.strategies.createStrategy({
      goalId,
      goal: goalTitle,
      business,
      priority: priority as BuildGraphInputDTO['priority'],
      qualityTier: 'standard',
    });
    if (!created.success || !created.data) {
      return {
        step: this.step('strategy', 'failed', created.error ?? 'Strategy creation failed', {}, []),
      };
    }
    const strategy = created.data;
    const valid = strategy.validation.passed;
    return {
      step: this.step(
        'strategy',
        valid ? 'passed' : 'failed',
        valid
          ? `Created execution strategy ${strategy.strategyId} (${String(strategy.capabilityPlan.steps.length)} plan step(s))`
          : `Strategy ${strategy.strategyId} failed validation: ${strategy.validation.summary}`,
        { strategies: 1, steps: strategy.capabilityPlan.steps.length },
        [strategy.strategyId],
      ),
      strategyId: strategy.strategyId,
      graphInput: this.graphInputFromStrategy(strategy),
    };
  }

  private async buildGraphStage(
    input: BuildGraphInputDTO,
  ): Promise<{ step: EnterprisePipelineStep; graphId?: string }> {
    const built = await this.engines.orchestrator.buildExecutionGraph(input);
    if (!built.success || !built.data) {
      return {
        step: this.step('execution-graph', 'failed', built.error ?? 'Graph build failed', {}, []),
      };
    }
    const graph = built.data;
    const valid = graph.validated;
    return {
      step: this.step(
        'execution-graph',
        valid ? 'passed' : 'failed',
        valid
          ? `Built execution graph ${graph.graphId} (${String(graph.nodes.length)} node(s), ${String(graph.edges.length)} edge(s))`
          : `Graph ${graph.graphId} failed validation: ${graph.validation.summary}`,
        { nodes: graph.nodes.length, edges: graph.edges.length },
        [graph.graphId],
      ),
      graphId: graph.graphId,
    };
  }

  private async buildSessionStage(
    input: BuildGraphInputDTO,
  ): Promise<{ step: EnterprisePipelineStep; sessionId?: string }> {
    const created = await this.engines.orchestrator.createExecutionSession({
      strategyId: input.strategyId,
      goalId: input.goalId,
      goal: input.goal,
      steps: input.steps,
      mode: input.mode,
      priority: input.priority,
    });
    if (!created.success || !created.data) {
      return {
        step: this.step(
          'execution-session',
          'failed',
          created.error ?? 'Session creation failed',
          {},
          [],
        ),
      };
    }
    const session = created.data;
    return {
      step: this.step(
        'execution-session',
        'passed',
        `Created execution session ${session.sessionId} (status: ${session.status}) — ready, not running`,
        { sessions: 1 },
        [session.sessionId],
      ),
      sessionId: session.sessionId,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private requiredCapabilities(goal: {
    classification?: { requiredCapabilities?: string[] };
    analysis?: { capabilityHints?: string[] };
  }): CapabilityType[] {
    const fromClassification = goal.classification?.requiredCapabilities ?? [];
    const fromAnalysis = goal.analysis?.capabilityHints ?? [];
    const merged = [...new Set([...fromClassification, ...fromAnalysis])] as CapabilityType[];
    return merged.length > 0 ? merged : (['reasoning'] as CapabilityType[]);
  }

  private graphInputFromStrategy(strategy: ExecutionStrategyDTO): BuildGraphInputDTO {
    return {
      strategyId: strategy.strategyId,
      goalId: strategy.goalId,
      goal: strategy.goal,
      steps: strategy.capabilityPlan.steps.map((s) => ({
        stepId: s.stepId,
        capability: s.capability,
        label: s.label,
        flowType: s.flowType,
        weight: s.weight,
        eligibleFamilies:
          s.eligibleFamilies as BuildGraphInputDTO['steps'][number]['eligibleFamilies'],
      })),
      mode: strategy.executionMode,
      priority: strategy.priority,
      maxRetries: strategy.retryPolicy.maximumRetries,
      retryDelayMs: strategy.retryPolicy.retryDelayMs,
      maxLatencyMs: strategy.latencyBudget.maximumTimeMs,
      expectedTokens: strategy.tokenBudget.expectedTokens,
      maxCostUsd: strategy.costBudget.maximumCostUsd,
    };
  }

  private step(
    stage: PipelineStage,
    status: EnterprisePipelineStep['status'],
    detail: string,
    counts: Record<string, number>,
    artifactIds: string[],
  ): EnterprisePipelineStep {
    return { stage, status, detail, counts, artifactIds };
  }

  private finish(
    pipelineId: string,
    goalId: string,
    goal: string,
    steps: EnterprisePipelineStep[],
    artifacts: EnterprisePipeline['artifacts'],
    now: string,
  ): EnterprisePipeline {
    const failed = steps.some((s) => s.status === 'failed');
    const skipped = steps.some((s) => s.status === 'skipped');
    const status: EnterprisePipeline['status'] = failed || skipped ? 'failed' : 'ready';
    return {
      pipelineId,
      goalId,
      goal,
      status,
      steps,
      artifacts,
      validation: { passed: !failed && !skipped, checks: [], summary: '' },
      createdAt: now,
      updatedAt: now,
    };
  }
}

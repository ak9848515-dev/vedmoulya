// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Brain Plan Service (the Decision Pipeline)
// EI-008 — Enterprise Brain (Central Decision Intelligence)
// The 11-step decision pipeline: Receive Goal → Analyze Goal →
// Consult Goal Engine → Consult Learning → Consult Capability
// Registry → Consult Provider Intelligence → Consult Context
// Intelligence → Consult Execution Strategy → Generate Decision Plan →
// Explain Decision → Pass to Execution Orchestrator.
//
// The pipeline CONSUMES every engine through narrow ports and OWNS
// none. Engine failures degrade gracefully (the Brain still decides,
// with lower confidence and explicit "unavailable" evidence). The
// Brain never executes anything — the plan is handed to the Execution
// Orchestrator only after human approval (see BrainApplicationService).
// ──────────────────────────────────────────────────────────────────

import type { GoalDTO, TaskDTO } from '@vedmoulya/goals';
import type {
  LearningDashboardDTO,
  LearningModelDTO,
  LearningRecommendationDTO,
} from '@vedmoulya/learning-intelligence';
import type { CapabilityMarketplaceDTO } from '@vedmoulya/capabilities';
import type { ProviderMarketplaceDTO } from '@vedmoulya/providers';
import type { ContextRegistrySummaryDTO } from '@vedmoulya/context';
import type { StrategySummaryDTO } from '@vedmoulya/execution-strategy';
import type { OrchestratorSummaryDTO } from '@vedmoulya/execution-orchestrator';
import type { BrainEngines } from '../../contracts/brain-engines.js';
import type { BrainDecisionPlan, BrainPipelineStep } from '../../types/brain-types.js';
import { generateBrainPlanId } from '../value-objects/BrainDecisionId.js';
import { BrainDecisionService, type BrainEngineSnapshot } from './BrainDecisionService.js';
import { BrainMetricsService } from './BrainMetricsService.js';

export interface BuildPlanOptions {
  /** Optional explicit budget envelope (USD) supplied by the operator. */
  budgetUsd?: number;
  /** Human-readable id of the caller (defaults to 'enterprise-brain'). */
  actor?: string;
}

export interface BrainPlanResult {
  plan: BrainDecisionPlan;
  /** Engine consultation errors — decisions degrade gracefully. */
  errors: string[];
}

export interface BrainPipelineStepResult {
  step: string;
  engine: string;
  consulted: boolean;
  note?: string;
}

/** Data gathered from the engines (before decision generation). */
interface EngineGather {
  goal?: GoalDTO;
  tasks: TaskDTO[];
  learning?: LearningDashboardDTO;
  learningRecommendations: LearningRecommendationDTO[];
  learningModels: LearningModelDTO[];
  capabilities?: CapabilityMarketplaceDTO;
  providers?: ProviderMarketplaceDTO;
  context?: ContextRegistrySummaryDTO;
  strategies?: StrategySummaryDTO;
  orchestrator?: OrchestratorSummaryDTO;
  errors: string[];
}

export class BrainPlanService {
  private readonly decisions: BrainDecisionService;
  private readonly metrics: BrainMetricsService;

  constructor(decisionService: BrainDecisionService = new BrainDecisionService()) {
    this.decisions = decisionService;
    this.metrics = new BrainMetricsService();
  }

  /**
   * Run the decision pipeline for one goal and assemble the explained plan.
   * Every engine is consulted through its port; failures are captured as
   * `errors` and the plan degrades gracefully (lower confidence, explicit
   * "unavailable" evidence in the explanations).
   */
  async buildPlan(
    goalId: string,
    engines: BrainEngines,
    options: BuildPlanOptions = {},
  ): Promise<BrainPlanResult> {
    const gathered = await this.consultEngines(goalId, engines);

    const snapshot: BrainEngineSnapshot = {
      goal: gathered.goal,
      tasks: gathered.tasks,
      learning: gathered.learning,
      learningRecommendations: gathered.learningRecommendations,
      learningModels: gathered.learningModels,
      capabilities: gathered.capabilities,
      providers: gathered.providers,
      context: gathered.context,
      strategies: gathered.strategies,
      orchestrator: gathered.orchestrator,
      budgetUsd: options.budgetUsd,
    };

    const planId = generateBrainPlanId(goalId);
    const now = new Date().toISOString();
    const decisions = this.decisions.generateDecisions(planId, gathered.goal, snapshot);

    const pipeline = this.buildPipeline(gathered, options);

    const plan: BrainDecisionPlan = {
      planId,
      goalId,
      goalTitle: gathered.goal?.title ?? 'Received goal',
      status: 'proposed',
      decisions,
      overallConfidence: this.metrics.planConfidence(decisions),
      pipeline,
      version: 1,
      actor: options.actor ?? 'enterprise-brain',
      createdAt: now,
      updatedAt: now,
    };

    return { plan, errors: gathered.errors };
  }

  // ── Pipeline steps ────────────────────────────────────────────────────────

  private buildPipeline(gathered: EngineGather, options: BuildPlanOptions): BrainPipelineStep[] {
    const consulted = (engine: string, data: unknown): BrainPipelineStepResult => ({
      step: engine === 'goals' ? 'Consult Goal Engine' : `Consult ${this.engineLabel(engine)}`,
      engine,
      consulted: data !== undefined,
      note: data === undefined ? 'Engine unavailable — degraded decision' : undefined,
    });

    const steps: BrainPipelineStep[] = [
      {
        step: 'Receive Goal',
        engine: 'gateway',
        consulted: true,
        note: `goalId ${gathered.goal?.goalId ?? ''}`,
      },
      {
        step: 'Analyze Goal',
        engine: 'goals',
        consulted: gathered.goal !== undefined,
        note: gathered.goal === undefined ? 'Goal not found in the Goal Engine' : undefined,
      },
      consulted('goals', gathered.goal ?? (gathered.tasks.length > 0 ? gathered.tasks : undefined)),
      consulted(
        'learning',
        gathered.learning ??
          (gathered.learningRecommendations.length > 0
            ? gathered.learningRecommendations
            : undefined),
      ),
      consulted('capabilities', gathered.capabilities),
      consulted('providers', gathered.providers),
      consulted('context', gathered.context),
      consulted('execution-strategy', gathered.strategies),
      {
        step: 'Generate Decision Plan',
        engine: 'enterprise-brain',
        consulted: true,
        note: `${gathered.errors.length} engine error(s) tolerated`,
      },
      {
        step: 'Explain Decision',
        engine: 'enterprise-brain',
        consulted: true,
        note: 'why + evidence + confidence + trade-offs + alternatives + risks',
      },
      {
        step: 'Pass to Execution Orchestrator',
        engine: 'execution-orchestrator',
        consulted: gathered.orchestrator !== undefined,
        note:
          gathered.orchestrator !== undefined
            ? 'Handoff gated on human approval'
            : 'Orchestrator unavailable — handoff still produced',
      },
    ];
    const receiveStep = steps[0];
    if (receiveStep && options.budgetUsd !== undefined) {
      receiveStep.note = `goalId ${gathered.goal?.goalId ?? ''} · operator budget $${options.budgetUsd}`;
    }
    return steps;
  }

  private engineLabel(engine: string): string {
    switch (engine) {
      case 'learning':
        return 'Learning';
      case 'capabilities':
        return 'Capability Registry';
      case 'providers':
        return 'Provider Intelligence';
      case 'context':
        return 'Context Intelligence';
      case 'execution-strategy':
        return 'Execution Strategy';
      case 'orchestrator':
        return 'Execution Orchestrator';
      default:
        return engine;
    }
  }

  // ── Engine consultation (graceful degradation) ────────────────────────────

  private async consultEngines(goalId: string, engines: BrainEngines): Promise<EngineGather> {
    const errors: string[] = [];
    const result: EngineGather = {
      tasks: [],
      learningRecommendations: [],
      learningModels: [],
      errors,
    };

    const record = (engine: string, error: unknown): void => {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${engine}: ${message}`);
    };

    // Goal Engine (goal + tasks + summary) — sequential dependency for goal.
    try {
      const goal = await engines.goals.getGoal(goalId);
      if (goal.success && goal.data) result.goal = goal.data;
      else errors.push(`goals.getGoal: ${goal.error ?? 'not found'}`);
    } catch (error) {
      record('goals.getGoal', error);
    }
    try {
      const tasks = await engines.goals.listTasks(goalId);
      if (tasks.success && tasks.data) result.tasks = tasks.data;
    } catch (error) {
      record('goals.listTasks', error);
    }

    // Learning Intelligence (dashboard + recommendations + models) in parallel.
    await Promise.all([
      this.safeGet(
        () => engines.learning.getDashboard(),
        (data) => {
          result.learning = data;
        },
        'learning.getDashboard',
        errors,
      ),
      this.safeGet(
        () => engines.learning.getRecommendations(),
        (data) => {
          result.learningRecommendations = data;
        },
        'learning.getRecommendations',
        errors,
      ),
      this.safeGet(
        () => engines.learning.getModels(),
        (data) => {
          result.learningModels = data;
        },
        'learning.getModels',
        errors,
      ),
    ]);

    // The remaining registries in parallel.
    await Promise.all([
      this.safeGet(
        () => engines.capabilities.getMarketplace(),
        (data) => {
          result.capabilities = data;
        },
        'capabilities.getMarketplace',
        errors,
      ),
      this.safeGet(
        () => engines.providers.getMarketplace(),
        (data) => {
          result.providers = data;
        },
        'providers.getMarketplace',
        errors,
      ),
      this.safeGet(
        () => engines.context.getContextSummary(),
        (data) => {
          result.context = data;
        },
        'context.getContextSummary',
        errors,
      ),
      this.safeGet(
        () => engines.strategies.getSummary(),
        (data) => {
          result.strategies = data;
        },
        'strategies.getSummary',
        errors,
      ),
      this.safeGet(
        () => engines.orchestrator.getSummary(),
        (data) => {
          result.orchestrator = data;
        },
        'orchestrator.getSummary',
        errors,
      ),
    ]);

    return result;
  }

  private async safeGet<T>(
    call: () => Promise<{ success: boolean; data?: T; error?: string }>,
    assign: (data: T) => void,
    engine: string,
    errors: string[],
  ): Promise<void> {
    try {
      const response = await call();
      if (response.success && response.data !== undefined) {
        assign(response.data);
      } else {
        errors.push(`${engine}: ${response.error ?? 'no data'}`);
      }
    } catch (error) {
      errors.push(`${engine}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

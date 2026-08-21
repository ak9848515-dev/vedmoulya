// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Persistence Bundle (SPRINT-022)
//
// ONE resolver for the Persistent Intelligence Foundation. The gateway
// constructs a single PersistenceBundle and injects it into every engine
// (AI World, Brain, Intelligence, Bridge, Scheduler) — the engines keep
// their frozen store ports and never know which backend backs them.
//
//   • development/test: the deterministic in-memory stores — the documented
//     hermetic convention, zero Postgres dependency;
//   • production/staging (NODE_ENV): Postgres write-through stores (same
//     synchronous ports; mirror + async idempotent upserts + boot hydration
//     + shutdown flush). CI e2e runs `next start` (NODE_ENV=production) and
//     therefore ALSO takes this path — with AI_ENABLE_MOCK=true the stores
//     degrade gracefully against an unreachable database (loud warnings,
//     mirror stays authoritative), exactly like every other EI engine
//     factory. Lazy pools — no network I/O until the first query; table
//     creation is idempotent + fire-and-forget. A database outage degrades
//     to in-memory-consistent operation WITH loud logging — state is never
//     silently lost while the process runs, and restart durability is
//     exactly what is at risk.
//
// Every store is owner-scoped by query construction; stored documents are
// decisions/evidence/outcomes/timestamps/provenance only — never secrets,
// tokens or chain-of-thought (SPRINT-022_PERSISTENCE_SECURITY.md).
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from '@vedmoulya/core';
import type {
  CooldownStore,
  JobStore,
  RunStore,
  ScheduleStore,
  SourcePolicyStore,
} from '@vedmoulya/ai-world-scheduler';
import {
  InMemoryCooldownStore,
  InMemoryJobStore,
  InMemoryRunStore,
  InMemoryScheduleStore,
  InMemorySourcePolicyStore,
  PostgresCooldownStore,
  PostgresJobStore,
  PostgresRunStore,
  PostgresScheduleStore,
  PostgresSourcePolicyStore,
} from '@vedmoulya/ai-world-scheduler';
import type {
  BrainDecisionStore,
  BrainExperiencePort,
  BrainTaskStore,
  IntelligenceEventStore,
  OpportunityStore,
} from '@vedmoulya/brain';
import {
  AdaptiveScoreLedger,
  InMemoryBrainDecisionStore,
  InMemoryBrainTaskStore,
  InMemoryIntelligenceEventStore,
  InMemoryOpportunityStore,
  InMemoryOutcomeMemory,
  PostgresAdaptiveScoreLedger,
  PostgresBrainDecisionStore,
  PostgresBrainTaskStore,
  PostgresIntelligenceEventStore,
  PostgresOpportunityStore,
  PostgresOutcomeMemory,
} from '@vedmoulya/brain';
import type { BrainOutcomeMemory } from '@vedmoulya/brain';
import type {
  AcquisitionStore,
  GitHubConnectionStore,
  LifecycleStore,
  NotificationStore,
  RecommendationStore,
} from '@vedmoulya/ecosystem-intelligence';
import {
  InMemoryAcquisitionStore,
  InMemoryGitHubConnectionStore,
  InMemoryLifecycleStore,
  InMemoryNotificationStore,
  InMemoryRecommendationStore,
  PostgresAcquisitionStore,
  PostgresGitHubConnectionStore,
  PostgresLifecycleStore,
  PostgresNotificationStore,
  PostgresRecommendationStore,
} from '@vedmoulya/ecosystem-intelligence';
import type { BridgeLoopStore } from '@vedmoulya/live-intelligence-bridge';
import {
  InMemoryBridgeLoopStore,
  PostgresBridgeLoopStore,
} from '@vedmoulya/live-intelligence-bridge';
import type { DiscoveryStore } from '@vedmoulya/ai-world';
import { InMemoryDiscoveryStore, PostgresDiscoveryStore } from '@vedmoulya/ai-world';
import type { ConversationStore } from '@vedmoulya/voice';
import type { ProactiveRecommendationStore } from '@vedmoulya/proactive';
import { InMemoryProactiveStore, PostgresProactiveStore } from '@vedmoulya/proactive';
import type { ControlStores } from '@vedmoulya/control-plane';
import {
  InMemoryControlStores,
  PostgresSettingsStore as PostgresControlSettingsStore,
  PostgresEmergencyStopStore as PostgresControlEmergencyStopStore,
  PostgresOpportunityStore as PostgresControlOpportunityStore,
} from '@vedmoulya/control-plane';
import type { WorldStores } from '@vedmoulya/world-model';
import {
  InMemoryWorldStores,
  PostgresBlueprintApprovalStore as PostgresWorldBlueprintApprovalStore,
  PostgresBusinessUnitStore as PostgresWorldBusinessUnitStore,
  PostgresObservationStore as PostgresWorldObservationStore,
  PostgresOrchestrationPlanStore as PostgresWorldOrchestrationPlanStore,
  PostgresOutcomeEvidenceStore as PostgresWorldOutcomeEvidenceStore,
  PostgresProblemStore as PostgresWorldProblemStore,
  PostgresProspectStore as PostgresWorldProspectStore,
  PostgresRevenueStreamStore as PostgresWorldRevenueStreamStore,
  PostgresRoleStore as PostgresWorldRoleStore,
  PostgresWorkflowStore as PostgresWorldWorkflowStore,
  PostgresWorldEntityStore,
  PostgresWorldRelationStore,
} from '@vedmoulya/world-model';
import { InMemoryConversationStore, PostgresConversationStore } from '@vedmoulya/voice';
import type { AuditLogStore } from './AuditLogStore.js';
import { InMemoryAuditLogStore, PostgresAuditLogStore } from './AuditLogStore.js';
import { createEISql } from './ProductionRepositories.js';

/** The outcome-memory shape both the Brain memory port and the dashboard
 *  learning feed consume (structural — satisfied by in-memory + Postgres). */
export interface OutcomeMemoryLike {
  recordOutcome(memory: BrainOutcomeMemory): Promise<void>;
  list(userId: string): BrainOutcomeMemory[];
}

/** Every store seam the gateway wires (SPRINT-022). */
export interface PersistenceStores {
  discoveryStore: DiscoveryStore;
  scheduler: {
    schedules: ScheduleStore;
    jobs: JobStore;
    runs: RunStore;
    sourcePolicies: SourcePolicyStore;
    cooldowns: CooldownStore;
  };
  brain: {
    tasks: BrainTaskStore;
    decisions: BrainDecisionStore;
    opportunities: OpportunityStore;
    events: IntelligenceEventStore;
    outcomeMemory: OutcomeMemoryLike;
    adaptiveScores: BrainExperiencePort;
  };
  ecosystem: {
    connectionStore: GitHubConnectionStore;
    lifecycleStore: LifecycleStore;
    recommendationStore: RecommendationStore;
    notificationStore: NotificationStore;
    acquisitionStore: AcquisitionStore;
  };
  bridge: {
    loops: BridgeLoopStore;
  };
  /** SPRINT-027 (R-2) — durable owner-scoped gateway audit log. */
  auditLogs: AuditLogStore;
  /** SPRINT-027 (Phase 5) — owner-scoped bounded conversation store. */
  voice: {
    conversations: ConversationStore;
  };
  /** SPRINT-029 — owner-scoped proactive recommendation store. */
  proactive: ProactiveRecommendationStore;
  /** SPRINT-031 — owner-scoped control-plane stores (autonomy settings,
   *  emergency stop, opportunity lifecycle). */
  control: ControlStores;
  /** SPRINT-032 — owner-scoped world-model stores (bounded typed graph,
   *  business units, AI workforce roles, business workflows).
   *  SPRINT-033 (Part F) — revenue streams (evidence-carrying).
   *  SPRINT-034 — verified outcome evidence + blueprint approval requests. */
  world: WorldStores;
}

/** The store bundle plus its lifecycle handles. */
export interface PersistenceBundle extends PersistenceStores {
  /** Load persisted state into the synchronous mirrors (boot). */
  hydrate(): Promise<void>;
  /** Drain every pending write to Postgres (shutdown). */
  flush(): Promise<void>;
}

/** Partial store overrides accepted by ApiApplicationService options. */
export type PersistenceStoreOverrides = Partial<PersistenceStores>;

/** Safe error text for logs — never document contents. */
function safeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface Hydratable {
  hydrate(): Promise<unknown>;
}

interface Flushable {
  flush(): Promise<void>;
}

// ── Development/test default: deterministic in-memory stores ─────────

function createInMemoryStores(): PersistenceStores {
  return {
    discoveryStore: new InMemoryDiscoveryStore(),
    scheduler: {
      schedules: new InMemoryScheduleStore(),
      jobs: new InMemoryJobStore(),
      runs: new InMemoryRunStore(),
      sourcePolicies: new InMemorySourcePolicyStore(),
      cooldowns: new InMemoryCooldownStore(),
    },
    brain: {
      tasks: new InMemoryBrainTaskStore(),
      decisions: new InMemoryBrainDecisionStore(),
      opportunities: new InMemoryOpportunityStore(),
      events: new InMemoryIntelligenceEventStore(),
      outcomeMemory: new InMemoryOutcomeMemory(),
      adaptiveScores: new AdaptiveScoreLedger(() => new Date().toISOString()),
    },
    ecosystem: {
      connectionStore: new InMemoryGitHubConnectionStore(),
      lifecycleStore: new InMemoryLifecycleStore(),
      recommendationStore: new InMemoryRecommendationStore(),
      notificationStore: new InMemoryNotificationStore(),
      acquisitionStore: new InMemoryAcquisitionStore(),
    },
    bridge: {
      loops: new InMemoryBridgeLoopStore(),
    },
    auditLogs: new InMemoryAuditLogStore(),
    voice: {
      conversations: new InMemoryConversationStore(),
    },
    proactive: new InMemoryProactiveStore(),
    control: new InMemoryControlStores(),
    world: new InMemoryWorldStores(),
  };
}

// ── Production/staging: Postgres write-through stores ──────────────

function createPostgresStores(): PersistenceBundle {
  // One lazy pool shared by every persistence store (same convention as
  // the other EI engine registries — no network I/O at construction).
  const sql = createEISql('vedmoulya-persistence');

  // Concrete Postgres stores are constructed first so the hydratable set is
  // built from the implementations (which implement hydrate/flush) rather than
  // the frozen domain ports — the ports stay lifecycle-free by design.
  const discoveryStore = new PostgresDiscoveryStore(sql);
  const schedules = new PostgresScheduleStore(sql);
  const jobs = new PostgresJobStore(sql);
  const runs = new PostgresRunStore(sql);
  const sourcePolicies = new PostgresSourcePolicyStore(sql);
  const cooldowns = new PostgresCooldownStore(sql);
  const tasks = new PostgresBrainTaskStore(sql);
  const decisions = new PostgresBrainDecisionStore(sql);
  const opportunities = new PostgresOpportunityStore(sql);
  const events = new PostgresIntelligenceEventStore(sql);
  const outcomeMemory = new PostgresOutcomeMemory(sql);
  const adaptiveScores = new PostgresAdaptiveScoreLedger(sql);
  const connectionStore = new PostgresGitHubConnectionStore(sql);
  const lifecycleStore = new PostgresLifecycleStore(sql);
  const recommendationStore = new PostgresRecommendationStore(sql);
  const notificationStore = new PostgresNotificationStore(sql);
  const acquisitionStore = new PostgresAcquisitionStore(sql);
  const loops = new PostgresBridgeLoopStore(sql);
  const auditLogs = new PostgresAuditLogStore(sql);
  const conversations = new PostgresConversationStore(sql);
  const proactive = new PostgresProactiveStore(sql);
  const controlSettings = new PostgresControlSettingsStore(sql);
  const controlStops = new PostgresControlEmergencyStopStore(sql);
  const controlOpportunities = new PostgresControlOpportunityStore(sql);
  const worldEntities = new PostgresWorldEntityStore(sql);
  const worldRelations = new PostgresWorldRelationStore(sql);
  const worldUnits = new PostgresWorldBusinessUnitStore(sql);
  const worldRoles = new PostgresWorldRoleStore(sql);
  const worldWorkflows = new PostgresWorldWorkflowStore(sql);
  const worldRevenueStreams = new PostgresWorldRevenueStreamStore(sql);
  const worldOutcomeEvidence = new PostgresWorldOutcomeEvidenceStore(sql);
  const worldBlueprintApprovals = new PostgresWorldBlueprintApprovalStore(sql);
  const worldOrchestrationPlans = new PostgresWorldOrchestrationPlanStore(sql);
  const worldProblems = new PostgresWorldProblemStore(sql);
  const worldObservations = new PostgresWorldObservationStore(sql);
  const worldProspects = new PostgresWorldProspectStore(sql);

  const stores: PersistenceStores = {
    discoveryStore,
    scheduler: { schedules, jobs, runs, sourcePolicies, cooldowns },
    brain: { tasks, decisions, opportunities, events, outcomeMemory, adaptiveScores },
    ecosystem: {
      connectionStore,
      lifecycleStore,
      recommendationStore,
      notificationStore,
      acquisitionStore,
    },
    bridge: { loops },
    auditLogs,
    voice: { conversations },
    proactive,
    control: {
      settings: controlSettings,
      emergencyStop: controlStops,
      opportunities: controlOpportunities,
    },
    world: {
      entities: worldEntities,
      relations: worldRelations,
      businessUnits: worldUnits,
      roles: worldRoles,
      workflows: worldWorkflows,
      revenueStreams: worldRevenueStreams,
      outcomeEvidence: worldOutcomeEvidence,
      blueprintApprovals: worldBlueprintApprovals,
      orchestrationPlans: worldOrchestrationPlans,
      problems: worldProblems,
      observations: worldObservations,
      prospects: worldProspects,
    },
  };

  const hydratable: Hydratable[] = [
    discoveryStore,
    schedules,
    jobs,
    runs,
    sourcePolicies,
    cooldowns,
    tasks,
    decisions,
    opportunities,
    events,
    outcomeMemory,
    adaptiveScores,
    connectionStore,
    lifecycleStore,
    recommendationStore,
    notificationStore,
    acquisitionStore,
    loops,
    auditLogs,
    conversations,
    proactive,
    controlSettings,
    controlStops,
    controlOpportunities,
    worldEntities,
    worldRelations,
    worldUnits,
    worldRoles,
    worldWorkflows,
    worldRevenueStreams,
    worldOutcomeEvidence,
    worldBlueprintApprovals,
    worldOrchestrationPlans,
    worldProblems,
    worldObservations,
    worldProspects,
  ];

  // Idempotent CREATE TABLE IF NOT EXISTS on every startup (fire-and-forget,
  // same convention as every EI engine factory — never blocks boot).
  // Skipped under NODE_ENV=test: the persistence tests construct the Postgres
  // stores on purpose but call ensureTable() themselves against their own
  // pool; the bundle's fire-and-forget attempt would only log connection
  // noise and race worker teardown.
  if (process.env.NODE_ENV !== 'test') {
    for (const store of hydratable) {
      const withEnsure = store as { ensureTable?(): Promise<void> };
      if (typeof withEnsure.ensureTable === 'function') {
        void withEnsure.ensureTable().catch((error: unknown) => {
          logger.warn('Persistence table creation deferred (database unreachable at startup)', {
            error: safeError(error),
          });
        });
      }
    }
  }

  return {
    ...stores,
    // Hydration is error-isolated per store: one store's failure never
    // blocks the rest (the mirror simply starts empty and catches up).
    hydrate: async (): Promise<void> => {
      await Promise.all(
        hydratable.map(async (store) => {
          try {
            await store.hydrate();
          } catch (error) {
            logger.warn(
              'Persistence hydration failed for one store (starts empty, writes continue)',
              {
                error: safeError(error),
              },
            );
          }
        }),
      );
    },
    // Shutdown flush: drains pending writes; a failure is logged loudly
    // (restart durability is exactly what is lost) — never throws into the
    // shutdown path.
    flush: async (): Promise<void> => {
      await Promise.all(
        hydratable.map(async (store) => {
          try {
            // Runtime duck-typing probe (same pattern as ensureTable above):
            // every write-through store implements flush(), but the lifecycle
            // is not part of any frozen port — cast through unknown.
            const flushable = store as unknown as Flushable;
            await flushable.flush();
          } catch (error) {
            logger.warn('Persistence flush failed for one store (state remains in the mirror)', {
              error: safeError(error),
            });
          }
        }),
      );
    },
  };
}

/**
 * Resolve the persistence bundle for the gateway.
 *
 *   • NODE_ENV production/staging → Postgres write-through stores;
 *   • otherwise (development/test/CI-with-mock) → deterministic in-memory.
 *
 * Partial overrides replace individual stores (tests inject the in-memory
 * stores explicitly; operators can opt particular seams out).
 */
export function resolvePersistenceBundle(
  overrides: PersistenceStoreOverrides = {},
  /** Test seam: force a branch without mutating process.env (never set in
   *  production code). When NODE_ENV is not production/staging the real
   *  config stays in development mode, so no production fail-fast applies. */
  forcedEnv?: string,
): PersistenceBundle {
  const env: string = forcedEnv ?? process.env.NODE_ENV ?? 'development';
  const isStrict = env === 'production' || env === 'staging';

  const base: PersistenceBundle = isStrict
    ? createPostgresStores()
    : {
        ...createInMemoryStores(),
        hydrate: async (): Promise<void> => {},
        flush: async (): Promise<void> => {},
      };

  return {
    ...base,
    discoveryStore: overrides.discoveryStore ?? base.discoveryStore,
    scheduler: {
      schedules: overrides.scheduler?.schedules ?? base.scheduler.schedules,
      jobs: overrides.scheduler?.jobs ?? base.scheduler.jobs,
      runs: overrides.scheduler?.runs ?? base.scheduler.runs,
      sourcePolicies: overrides.scheduler?.sourcePolicies ?? base.scheduler.sourcePolicies,
      cooldowns: overrides.scheduler?.cooldowns ?? base.scheduler.cooldowns,
    },
    brain: {
      tasks: overrides.brain?.tasks ?? base.brain.tasks,
      decisions: overrides.brain?.decisions ?? base.brain.decisions,
      opportunities: overrides.brain?.opportunities ?? base.brain.opportunities,
      events: overrides.brain?.events ?? base.brain.events,
      outcomeMemory: overrides.brain?.outcomeMemory ?? base.brain.outcomeMemory,
      adaptiveScores: overrides.brain?.adaptiveScores ?? base.brain.adaptiveScores,
    },
    ecosystem: {
      connectionStore: overrides.ecosystem?.connectionStore ?? base.ecosystem.connectionStore,
      lifecycleStore: overrides.ecosystem?.lifecycleStore ?? base.ecosystem.lifecycleStore,
      recommendationStore:
        overrides.ecosystem?.recommendationStore ?? base.ecosystem.recommendationStore,
      notificationStore: overrides.ecosystem?.notificationStore ?? base.ecosystem.notificationStore,
      acquisitionStore: overrides.ecosystem?.acquisitionStore ?? base.ecosystem.acquisitionStore,
    },
    bridge: {
      loops: overrides.bridge?.loops ?? base.bridge.loops,
    },
    auditLogs: overrides.auditLogs ?? base.auditLogs,
    voice: {
      conversations: overrides.voice?.conversations ?? base.voice.conversations,
    },
    proactive: overrides.proactive ?? base.proactive,
    control: {
      settings: overrides.control?.settings ?? base.control.settings,
      emergencyStop: overrides.control?.emergencyStop ?? base.control.emergencyStop,
      opportunities: overrides.control?.opportunities ?? base.control.opportunities,
    },
    world: overrides.world ?? base.world,
  };
}

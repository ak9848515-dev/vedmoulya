// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — API Gateway: Application Service
// Creates all certified backend services and wires them to the API gateway
// BLD-016A — API Gateway & Platform Services
// ─────────────────────────────────────────────────────────────────────────────

import {
  AIOrchestrationService,
  BusinessApplicationService,
  CareerApplicationService,
  DashboardApplicationService,
  DecisionApplicationService,
  ExecutionApplicationService,
  IdentityApplicationService,
  KnowledgeApplicationService,
  LearningApplicationService,
  LifeOSApplicationService,
  MarketplaceApplicationService,
  MemoryApplicationService,
} from '@vedmoulya/services';
import type {
  IdentityRepository,
  MemoryRepository,
  DecisionRepository,
  ExecutionRepository,
  KnowledgeRepository,
} from '@vedmoulya/domain';
import { InfrastructureHealthProbe } from './InfrastructureHealthProbe.js';
import {
  createProductionIdentityRepository,
  createProductionMemoryRepository,
  createProductionDecisionRepository,
  createProductionExecutionRepository,
  createProductionKnowledgeRepository,
} from '../infrastructure/ProductionRepositories.js';

// ── ApiApplicationService ───────────────────────────────────────────────────

/**
 * Options for constructing the API Gateway application service.
 */
export interface ApiApplicationServiceOptions {
  /**
   * Identity repository override. Defaults to the production
   * `PostgresIdentityRepository` resolved through the identity module's
   * existing DI registration (SPRINT PR-002A). Inject a custom repository
   * (e.g. an in-memory one) for tests or alternate persistence.
   */
  identityRepository?: IdentityRepository;
  /**
   * Memory repository override. Defaults to the production
   * `PostgresMemoryRepository` resolved through the memory module's existing
   * DI registration (SPRINT PR-002B).
   */
  memoryRepository?: MemoryRepository;
  /**
   * Decision repository override. Defaults to the production
   * `PostgresDecisionRepository` resolved through the decision module's
   * existing DI registration (SPRINT PR-002B).
   */
  decisionRepository?: DecisionRepository;
  /**
   * Execution repository override. Defaults to the production
   * `PostgresExecutionRepository` resolved through the execution module's
   * existing DI registration (SPRINT PR-002B).
   */
  executionRepository?: ExecutionRepository;
  /**
   * Knowledge repository override. Defaults to the production
   * `PostgresKnowledgeRepository` resolved through the knowledge module's
   * existing DI registration (SPRINT PR-002B).
   */
  knowledgeRepository?: KnowledgeRepository;
}

/**
 * Top-level application service that creates and manages all certified
 * backend services. This is the single entry point for the API Gateway.
 *
 * Follows the BLD-016A architecture:
 *   ApiApplicationService
 *   ├── Infrastructure Services (Identity, Memory, Decision, Execution, Knowledge, AI)
 *   ├── Domain Module Services (Dashboard, Career, Learning, Business, Marketplace)
 *   └── Integration Layer (LifeOS)
 *
 * SPRINT PR-002A: the Identity application service is now wired to the real
 * production `PostgresIdentityRepository` (reusing the identity module's DI
 * registration) instead of the in-memory development repository, so the
 * complete authenticated request path resolves against real persistence.
 */
export class ApiApplicationService {
  // ── Infrastructure Services ───────────────────────────────────────────────
  readonly identity: IdentityApplicationService;
  readonly memory: MemoryApplicationService;
  readonly decision: DecisionApplicationService;
  readonly execution: ExecutionApplicationService;
  readonly knowledge: KnowledgeApplicationService;
  readonly ai: AIOrchestrationService;

  // ── Domain Module Services ────────────────────────────────────────────────
  readonly dashboard: DashboardApplicationService;
  readonly career: CareerApplicationService;
  readonly learning: LearningApplicationService;
  readonly business: BusinessApplicationService;
  readonly marketplace: MarketplaceApplicationService;

  // ── Integration Layer ─────────────────────────────────────────────────────
  readonly lifeOS: LifeOSApplicationService;

  // ── Infrastructure Health (PH-002/T3 follow-up) ────────────────────────────
  readonly infrastructureHealth: InfrastructureHealthProbe;

  constructor(options: ApiApplicationServiceOptions = {}) {
    this.infrastructureHealth = new InfrastructureHealthProbe();
    // ── Create infrastructure services ────────────────────────────────
    //     All five engines use their production Postgres repositories,
    //     resolved through each service module's existing DI registration
    //     (SPRINT PR-002A identity + PR-002B memory/decision/execution/
    //     knowledge — no duplicate wiring, lazy-connect clients). Inject
    //     overrides (e.g. the Map-backed in-memory repositories from
    //     services/api/src/infrastructure/InMemoryRepositories.ts) for
    //     tests or alternate persistence.
    this.identity = new IdentityApplicationService(
      options.identityRepository ?? createProductionIdentityRepository(),
    );
    this.memory = new MemoryApplicationService(
      options.memoryRepository ?? createProductionMemoryRepository(),
    );
    this.decision = new DecisionApplicationService(
      options.decisionRepository ?? createProductionDecisionRepository(),
    );
    this.execution = new ExecutionApplicationService(
      options.executionRepository ?? createProductionExecutionRepository(),
    );
    this.knowledge = new KnowledgeApplicationService(
      options.knowledgeRepository ?? createProductionKnowledgeRepository(),
    );
    this.ai = new AIOrchestrationService();

    // ── Create domain module services ──────────────────────────────────
    this.dashboard = new DashboardApplicationService(
      this.identity,
      this.memory,
      this.decision,
      this.execution,
      this.knowledge,
      this.ai,
    );
    this.career = new CareerApplicationService(
      this.identity,
      this.memory,
      this.decision,
      this.execution,
      this.knowledge,
      this.ai,
    );
    this.learning = new LearningApplicationService(
      this.identity,
      this.memory,
      this.decision,
      this.execution,
      this.knowledge,
      this.ai,
    );
    this.business = new BusinessApplicationService(
      this.identity,
      this.memory,
      this.decision,
      this.execution,
      this.knowledge,
      this.ai,
    );
    this.marketplace = new MarketplaceApplicationService(
      this.identity,
      this.memory,
      this.decision,
      this.execution,
      this.knowledge,
      this.ai,
    );

    // ── Create the Life OS integration layer ────────────────────────────
    this.lifeOS = new LifeOSApplicationService(
      this.dashboard,
      this.career,
      this.learning,
      this.business,
      this.marketplace,
      this.identity,
      this.memory,
      this.decision,
      this.execution,
      this.knowledge,
      this.ai,
    );
  }

  /**
   * Check if all services are healthy.
   * Currently returns true for dev — no frozen service implements isHealthy().
   * Will be restored with real repository-backed service health checks.
   */
  isHealthy(): boolean {
    return true;
  }
}

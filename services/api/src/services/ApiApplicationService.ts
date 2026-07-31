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

// ── ApiApplicationService ───────────────────────────────────────────────────

/**
 * Top-level application service that creates and manages all certified
 * backend services. This is the single entry point for the API Gateway.
 *
 * Follows the BLD-016A architecture:
 *   ApiApplicationService
 *   ├── Infrastructure Services (Identity, Memory, Decision, Execution, Knowledge, AI)
 *   ├── Domain Module Services (Dashboard, Career, Learning, Business, Marketplace)
 *   └── Integration Layer (LifeOS)
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

  constructor() {
    // ── Create infrastructure services (dev stubs — repositories injected as any)
    //     Repository injection is needed because the frozen platform services
    //     require domain repositories. In dev, we pass empty stubs that return
    //     default/empty results. The production API Gateway will use real repos.
    const stubRepo = {} as never;
    this.identity = new IdentityApplicationService(stubRepo);
    this.memory = new MemoryApplicationService(stubRepo);
    this.decision = new DecisionApplicationService(stubRepo);
    this.execution = new ExecutionApplicationService(stubRepo);
    this.knowledge = new KnowledgeApplicationService(stubRepo);
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

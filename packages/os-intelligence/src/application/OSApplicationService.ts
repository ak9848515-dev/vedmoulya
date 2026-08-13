// ──────────────────────────────────────────────────────────────────
// VedMoulya — Enterprise Operating System: Application Service
// EPIC-005 / OS-001 — Enterprise Operating System Integration
// Facade over the OS domain services. Exposes the API surface:
// systemHealth (the full OS health pass + snapshot persistence),
// pipelineHealth (the 15-stage event-flow validation), runDiagnostics
// (the diagnostics battery), validatePlatform (the certification
// gate), engineStatus, dependencyGraph, performanceMetrics, the OS
// dashboard, and the snapshot history. Owns no engine — consumes all
// eleven through the narrow OSEngines port bundle.
// ──────────────────────────────────────────────────────────────────

import type { OSEngines } from '../contracts/os-engines.js';
import type {
  OSDashboardData,
  OSDependencyGraph,
  OSDiagnosticsReport,
  OSEngineStatus,
  OSHealthSnapshot,
  OSPerformanceMetrics,
  OSPipelineHealth,
  OSPlatformValidation,
  OSSystemHealth,
} from '../types/os-types.js';
import type { OSRepository } from '../domain/repository/OSRepository.js';
import { OSHealthService } from '../domain/services/OSHealthService.js';
import { OSValidationService } from '../domain/services/OSValidationService.js';
import { OSDashboardService } from '../domain/services/OSDashboardService.js';
import { OSDependencyGraphService } from '../domain/services/OSDependencyGraphService.js';
import { OSPerformanceService } from '../domain/services/OSPerformanceService.js';
import { OSDiagnosticsService } from '../domain/services/OSDiagnosticsService.js';
import { OSPipelineValidationService } from '../domain/services/OSPipelineValidationService.js';
import { OSEngineProbeService } from '../domain/services/OSEngineProbeService.js';

export interface OSResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  latency?: number;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class OSApplicationService {
  private readonly health: OSHealthService;
  private readonly validation: OSValidationService;
  private readonly dashboardService: OSDashboardService;
  private readonly graph: OSDependencyGraphService;
  private readonly performance: OSPerformanceService;
  private readonly diagnostics: OSDiagnosticsService;
  private readonly pipeline: OSPipelineValidationService;
  private readonly probe: OSEngineProbeService;

  constructor(
    private readonly repository: OSRepository,
    private readonly engines: OSEngines,
  ) {
    this.health = new OSHealthService();
    this.validation = new OSValidationService(this.health);
    this.dashboardService = new OSDashboardService();
    this.graph = new OSDependencyGraphService();
    this.performance = new OSPerformanceService();
    this.diagnostics = new OSDiagnosticsService();
    this.pipeline = new OSPipelineValidationService();
    this.probe = new OSEngineProbeService();
  }

  // ── System health (the full OS pass) ─────────────────────────────

  async systemHealth(): Promise<OSResult<OSSystemHealth>> {
    try {
      const startedAt = performance.now();
      const health = await this.health.systemHealth(this.engines);
      await this.persistSnapshot(health);
      return { success: true, data: health, latency: performance.now() - startedAt };
    } catch (error) {
      return { success: false, error: messageOf(error) };
    }
  }

  // ── Pipeline validation (event flow) ─────────────────────────────

  async pipelineHealth(): Promise<OSResult<OSPipelineHealth>> {
    try {
      const startedAt = performance.now();
      const probes = await this.probe.measure(this.engines);
      const health = this.pipeline.validate(probes);
      return { success: true, data: health, latency: performance.now() - startedAt };
    } catch (error) {
      return { success: false, error: messageOf(error) };
    }
  }

  // ── Diagnostics ──────────────────────────────────────────────────

  async runDiagnostics(): Promise<OSResult<OSDiagnosticsReport>> {
    try {
      const startedAt = performance.now();
      const health = await this.health.systemHealth(this.engines);
      return { success: true, data: health.diagnostics, latency: performance.now() - startedAt };
    } catch (error) {
      return { success: false, error: messageOf(error) };
    }
  }

  // ── Platform validation (certification gate) ─────────────────────

  async validatePlatform(): Promise<OSResult<OSPlatformValidation>> {
    try {
      const startedAt = performance.now();
      const validation = await this.validation.validatePlatform(this.engines);
      return { success: true, data: validation, latency: performance.now() - startedAt };
    } catch (error) {
      return { success: false, error: messageOf(error) };
    }
  }

  // ── Engine status (engines only) ─────────────────────────────────

  async engineStatus(): Promise<OSResult<OSEngineStatus[]>> {
    try {
      const startedAt = performance.now();
      const probes = await this.probe.measure(this.engines);
      const statuses = probes.map((probe) => this.health.statusFromProbe(probe));
      return { success: true, data: statuses, latency: performance.now() - startedAt };
    } catch (error) {
      return { success: false, error: messageOf(error) };
    }
  }

  // ── Dependency graph (pure) ──────────────────────────────────────

  dependencyGraph(): OSResult<OSDependencyGraph> {
    return { success: true, data: this.graph.buildGraph() };
  }

  // ── Performance ──────────────────────────────────────────────────

  async performanceMetrics(): Promise<OSResult<OSPerformanceMetrics>> {
    try {
      const startedAt = performance.now();
      const probes = await this.probe.measure(this.engines);
      const metrics = this.performance.metrics(probes);
      return { success: true, data: metrics, latency: performance.now() - startedAt };
    } catch (error) {
      return { success: false, error: messageOf(error) };
    }
  }

  // ── Dashboard + snapshot history ─────────────────────────────────

  async dashboard(): Promise<OSResult<OSDashboardData>> {
    try {
      const startedAt = performance.now();
      const health = await this.health.systemHealth(this.engines);
      await this.persistSnapshot(health);
      const snapshots = await this.repository.listSnapshots(30);
      const data = this.dashboardService.dashboard(health, snapshots);
      return { success: true, data, latency: performance.now() - startedAt };
    } catch (error) {
      return { success: false, error: messageOf(error) };
    }
  }

  async listSnapshots(limit?: number): Promise<OSResult<OSHealthSnapshot[]>> {
    try {
      const snapshots = await this.repository.listSnapshots(limit);
      return { success: true, data: snapshots };
    } catch (error) {
      return { success: false, error: messageOf(error) };
    }
  }

  // ── Internal ─────────────────────────────────────────────────────

  /** Persist the health pass as a snapshot (best effort — never fails the pass). */
  private async persistSnapshot(health: OSSystemHealth): Promise<void> {
    try {
      const snapshot: OSHealthSnapshot = {
        snapshotId: `snapshot_os_${Date.now()}`,
        checkedAt: health.checkedAt,
        overallScore: health.overallScore,
        status: health.status,
        engineCount: health.engines.length,
        healthyCount: health.engines.filter((e) => e.status === 'healthy').length,
        degradedCount: health.engines.filter((e) => e.status === 'degraded').length,
        unhealthyCount: health.engines.filter((e) => e.status === 'unhealthy').length,
        unknownCount: health.engines.filter((e) => e.status === 'unknown').length,
        pipelineStatus: health.pipeline.overallStatus,
        pipelineValid: health.pipeline.valid,
        dependencyAcyclic: health.dependencies.acyclic,
        criticalFindings: health.diagnostics.critical,
        warningFindings: health.diagnostics.warnings,
        passedChecks: health.diagnostics.passed,
      };
      await this.repository.saveSnapshot(snapshot);
    } catch {
      // Snapshot persistence is best-effort; a store outage must not fail
      // the health pass itself.
    }
  }
}

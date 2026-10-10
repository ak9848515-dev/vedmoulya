// ──────────────────────────────────────────────────────────────────
// VedMoulya — Orchestration Fabric: Provider Bridge
// SPRINT-094 — Connects the fabric's ProviderRouter to the
// existing VedMoulya provider ecosystem (@vedmoulya/providers,
// @vedmoulya/ai).
//
// The bridge:
//   1. Reads provider definitions from the existing registry
//   2. Maps them to fabric ProviderHealthStatus
//   3. Reports health observations from existing engines
//   4. Delegates actual AI calls to the existing AIOrchestrationService
//
// The bridge does NOT replace the existing provider system.
// It provides a read-only adapter so the fabric's ProviderRouter
// can make informed routing decisions.
// ──────────────────────────────────────────────────────────────────

import type { ProviderStatus } from '@vedmoulya/ai';
import type { ProviderHealthStatus } from '../types/provider-router.js';
import type { ProviderHealthBridge } from './index.js';

/**
 * Does a canonical provider health status (`@vedmoulya/ai` `ProviderStatus`)
 * represent a provider that can actually serve work?
 *
 * G-05A / F-R1 — the sync used to test `status !== 'unhealthy'`. The canonical
 * vocabulary is `'healthy' | 'degraded' | 'unstable' | 'down'`, which NEVER
 * contains `'unhealthy'`, so a provider the registry reported as `'down'` or
 * `'unstable'` was recorded as a SUCCESS. That synthetic success raised the
 * fabric ledger's success rate, so the router (`ProviderRouter.findCandidates`)
 * could treat a down provider as available and route work to it.
 *
 * HONESTY: only `'healthy'` and `'degraded'` count as successes — `'degraded'`
 * is still usable. `'unstable'` and `'down'` are failures. The switch is
 * exhaustive over `ProviderStatus`, so adding a vocabulary member is a compile
 * error here rather than a silent default.
 */
function isProviderHealthSuccess(status: ProviderStatus): boolean {
  switch (status) {
    case 'healthy':
    case 'degraded':
      return true;
    case 'unstable':
    case 'down':
      return false;
  }
}

/**
 * Interface for the existing provider system that the bridge wraps.
 * This is a narrow seam — the bridge only reads what it needs.
 */
export interface ExistingProviderPort {
  /** Get health status for all known providers. */
  listProviderHealth(): Promise<
    Array<{
      providerName: string;
      /**
       * Canonical provider health (`@vedmoulya/ai` `ProviderStatus`). Typed —
       * NOT a bare `string` — so a cross-vocabulary literal (e.g. `'unhealthy'`)
       * is a compile error at the port rather than being silently mis-mapped.
       */
      status: ProviderStatus;
      score: number;
      lastLatencyMs: number;
      errorRate: number;
      successRate: number;
      totalRequests: number;
      failedRequests: number;
    }>
  >;

  /** Get available provider capabilities. */
  getProviderCapabilities(): Promise<
    Array<{
      providerName: string;
      capabilities: string[];
      costPer1kTokens: number;
      averageLatencyMs: number;
    }>
  >;
}

/**
 * Interface for the existing AI execution service.
 * The fabric delegates actual AI calls through this port.
 */
export interface AIExecutionPort {
  /** Execute an AI request through the existing AI pipeline. */
  orchestrate(request: {
    prompt: string;
    capability: string;
    userId: string;
    qualityTier?: string;
    constraints?: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    content?: string;
    providerUsed?: string;
    modelUsed?: string;
    tokensUsed?: number;
    costUsd?: number;
    latencyMs?: number;
    error?: string;
  }>;
}

/**
 * Bridge between the orchestration fabric's ProviderRouter and
 * the existing VedMoulya provider ecosystem.
 */
export class ProviderBridge {
  private readonly healthBridge: ProviderHealthBridge;
  private readonly existingProviders: ExistingProviderPort;
  private readonly aiExecution: AIExecutionPort;

  constructor(opts: {
    healthBridge: ProviderHealthBridge;
    existingProviders: ExistingProviderPort;
    aiExecution: AIExecutionPort;
  }) {
    this.healthBridge = opts.healthBridge;
    this.existingProviders = opts.existingProviders;
    this.aiExecution = opts.aiExecution;
  }

  /**
   * Sync provider health from the existing system to the fabric's view.
   * Should be called periodically (e.g., every 30s) or on demand.
   */
  async syncProviderHealth(): Promise<void> {
    const healthData = await this.existingProviders.listProviderHealth();
    for (const provider of healthData) {
      this.healthBridge.recordObservation(provider.providerName, {
        latencyMs: provider.lastLatencyMs,
        // F-R1: 'down'/'unstable' must NOT be observed as successes.
        success: isProviderHealthSuccess(provider.status),
      });
    }
  }

  /**
   * Get provider candidates for the fabric's ProviderRouter.
   * Maps existing provider definitions to fabric-compatible format.
   */
  async getProviderCandidates(): Promise<
    Array<{
      providerName: string;
      capabilities: string[];
      costPer1kTokens: number;
      averageLatencyMs: number;
      health?: ProviderHealthStatus;
    }>
  > {
    const capabilities = await this.existingProviders.getProviderCapabilities();
    const candidates = [];
    for (const cap of capabilities) {
      candidates.push({
        providerName: cap.providerName,
        capabilities: cap.capabilities,
        costPer1kTokens: cap.costPer1kTokens,
        averageLatencyMs: cap.averageLatencyMs,
        health: this.healthBridge.getHealth(cap.providerName),
      });
    }
    return candidates;
  }

  /**
   * Execute an AI request through the existing AI pipeline.
   * This is the actual AI execution — the fabric routes to this
   * after selecting a provider.
   */
  async executeAI(request: {
    prompt: string;
    capability: string;
    userId: string;
    qualityTier?: string;
    providerPreference?: string;
    constraints?: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    content?: string;
    providerUsed?: string;
    modelUsed?: string;
    tokensUsed?: number;
    costUsd?: number;
    latencyMs?: number;
    error?: string;
  }> {
    return this.aiExecution.orchestrate(request);
  }
}

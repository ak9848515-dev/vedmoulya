import { describe, it, expect } from 'vitest';
import { OrchestratorService } from '@vedmoulya/orchestration-fabric';
import type { WorkItemHandler, ProviderSelection } from '@vedmoulya/orchestration-fabric';
import { ORCHESTRATION_FABRIC_PROVIDER_ROUTING } from '../services/ApiApplicationService.js';

// ─────────────────────────────────────────────────────────────────────────────
// G-17 — orchestration-fabric deferral guard
//
// The canonical provider-routing authority is AIOrchestrationService. The
// orchestration fabric must remain DORMANT: it may queue/observe work, but it
// must never silently become an alternate provider-routing or execution
// authority. These tests fail-closed if that contract is broken.
// ─────────────────────────────────────────────────────────────────────────────

describe('G-17 orchestration-fabric deferral', () => {
  it('production composition keeps provider routing disabled', () => {
    expect(ORCHESTRATION_FABRIC_PROVIDER_ROUTING).toBe(false);
  });

  it('with routing disabled, no provider selection reaches work handlers', async () => {
    const seen: Array<ProviderSelection | undefined> = [];
    const handler: WorkItemHandler = {
      supportedWorkTypes: ['ai_generation'],
      execute: async (_workItem, selection) => {
        seen.push(selection);
        return { success: true, summary: 'ok', costUsd: 0, tokensUsed: 0, latencyMs: 1 };
      },
    };

    const orchestrator = new OrchestratorService({
      tickIntervalMs: 5,
      enableProviderRouting: false,
    });
    orchestrator.registerHandler(handler);
    orchestrator.start();

    const submitted = orchestrator.submitWork({
      workType: 'ai_generation',
      priority: 'user_submitted',
      description: 'deferral guard',
      ownerUserId: 'user-1',
      resources: {
        requiresDatabase: false,
        resourceProfile: 'ai_bound',
        timeoutMs: 5000,
        aiCapability: 'text_generation',
      },
    });
    expect(submitted).not.toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 80));
    orchestrator.stop();

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((selection) => selection === undefined)).toBe(true);
  });
});

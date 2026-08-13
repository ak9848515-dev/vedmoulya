// ──────────────────────────────────────────────────────────────────
// VedMoulya — CapabilityPlanner tests
// EPIC-013 §1–14 — outcome → plan with candidates, automation,
// approvals, evidence, risks, recommendations.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { CapabilityPlanner } from '../domain/CapabilityPlanner.js';
import {
  candidate,
  configuredProvider,
  externalAppDiscovery,
  githubDiscovery,
  localModel,
  testSource,
  unconfiguredProvider,
  videoRequest,
} from './fixtures.js';

describe('CapabilityPlanner — factory capability plan', () => {
  it('builds a full plan for a video request with the video pipeline', async () => {
    const planner = new CapabilityPlanner({
      source: testSource(),
      now: () => new Date('2026-08-13T09:00:00Z'),
    });
    const plan = await planner.plan(videoRequest());

    expect(plan.requestedOutcome).toContain('educational video');
    expect(plan.steps.length).toBeGreaterThanOrEqual(8);
    // Steps have candidates and a selection.
    const scriptStep = plan.steps.find((s) => s.title === 'Script');
    expect(scriptStep?.selectedCandidateId).toBeDefined();
    expect(plan.candidates.length).toBeGreaterThan(0);
    // Evidence is present.
    expect(plan.evidence.length).toBeGreaterThan(0);
  });

  it('recommends CONFIGURE_PROVIDER when a discovered provider is configurable', async () => {
    const source = testSource({
      providerCandidates: async () => [],
      discoveryCandidates: async () => [
        {
          itemId: 'disc-prov-1',
          category: 'provider',
          title: 'OpenRouter',
          capabilities: ['TEXT_GENERATION', 'VIDEO_GENERATION'],
          freeClass: 'FREE_WITH_QUOTA',
          localAvailability: 'no',
          configurable: true,
          suggestedFamily: 'openrouter',
          evidence: [
            { claim: 'Aggregator of hosted models', source: 'ai-world', confidence: 'VERIFIED' },
          ],
          securityFlags: [],
        },
      ],
    });
    const planner = new CapabilityPlanner({ source });
    const plan = await planner.plan(videoRequest());

    const configureRecs = plan.recommendations.filter((r) => r.action === 'CONFIGURE_PROVIDER');
    expect(configureRecs.length).toBeGreaterThan(0);
  });

  it('keeps manual candidates for capabilities with no source', async () => {
    const source = testSource({
      providerCandidates: async () => [],
      discoveryCandidates: async () => [],
      localModelCandidates: async () => [],
    });
    const planner = new CapabilityPlanner({ source });
    const plan = await planner.plan({ outcome: 'Compose a symphony for a film' });
    // Every step falls back to a manual candidate — and every required
    // capability must be reported unavailable (never hidden by the fallback).
    expect(plan.automationPercent).toBe(0);
    expect(plan.steps.every((s) => s.automation === 'MANUAL')).toBe(true);
    expect(plan.unavailableCapabilities.sort()).toEqual([...plan.requiredCapabilities].sort());
  });

  it('estimates cost from the SELECTED candidate only, never the sum of options', async () => {
    const source = testSource({
      providerCandidates: async () => [
        // Higher quality wins the selection despite a higher cost.
        configuredProvider({
          providerId: 'prov-premium',
          family: 'premium',
          quality: 0.98,
          estimatedCostUsd: 0.2,
        }),
        // Cheaper runner-up must NOT inflate the plan estimate.
        configuredProvider({
          providerId: 'prov-budget',
          family: 'budget',
          quality: 0.5,
          estimatedCostUsd: 0.01,
        }),
      ],
      localModelCandidates: async () => [],
    });
    const planner = new CapabilityPlanner({ source });
    const plan = await planner.plan({ outcome: 'Write a detailed analysis report' });
    const step = plan.steps.find((s) => s.capability === 'TEXT_GENERATION');
    expect(step?.selectedCandidateId).toContain('prov-premium');
    // Only the SELECTED candidate per step is counted — never the runner-up
    // (0.01 budget) added to the total.
    const selectedSteps = plan.steps.filter((s) =>
      s.selectedCandidateId?.includes('prov-premium'),
    ).length;
    expect(plan.estimatedCostUsd).toBeCloseTo(selectedSteps * 0.2, 5);
    // Sanity: the runner-up's cost never enters the estimate.
    expect(plan.estimatedCostUsd).toBeGreaterThanOrEqual(0.2);
  });

  it('never claims automation for an external application step', async () => {
    const source = testSource({
      providerCandidates: async () => [],
      discoveryCandidates: async () => [externalAppDiscovery()],
      localModelCandidates: async () => [],
    });
    const planner = new CapabilityPlanner({ source });
    const plan = await planner.plan({ outcome: 'Edit a video using a professional editor' });
    const editing = plan.steps.find((s) => s.capability === 'VIDEO_EDITING');
    if (editing) {
      expect(editing.automation).not.toBe('FULLY_AUTOMATED');
      expect(editing.candidates[0]?.integrationType).toBe('EXTERNAL_APPLICATION');
    }
  });

  it('treats GitHub discoveries as EVALUATE candidates, never auto-integrated', async () => {
    const source = testSource({
      providerCandidates: async () => [],
      discoveryCandidates: async () => [githubDiscovery()],
      localModelCandidates: async () => [],
    });
    const planner = new CapabilityPlanner({ source });
    const plan = await planner.plan({ outcome: 'Build an app that answers from a knowledge base' });
    const ragStep = plan.steps.find((s) => s.capability === 'RAG');
    if (ragStep) {
      const gh = ragStep.candidates.find((c) => c.kind === 'github');
      expect(gh?.classification).toBe('EVALUATE');
      expect(gh?.integrationType).toBe('GITHUB_PROJECT');
    }
  });

  it('flags irreversible steps as human approval points', async () => {
    const planner = new CapabilityPlanner({
      source: testSource(),
      now: () => new Date('2026-08-13T09:00:00Z'),
    });
    const plan = await planner.plan({ outcome: 'Create a video and publish it on social media' });
    expect(plan.humanApprovalPoints.length).toBeGreaterThan(0);
    const publishStep = plan.humanApprovalPoints.find((s) => s.title === 'Final Export');
    expect(publishStep?.irreversible).toBe(true);
  });

  it('selects quality-first: the configured higher-quality provider wins', async () => {
    const source = testSource({
      providerCandidates: async () => [
        configuredProvider({ quality: 0.95 }),
        unconfiguredProvider({ quality: 0.6 }),
      ],
      localModelCandidates: async () => [
        localModel({ capabilities: ['TEXT_GENERATION'], available: false }),
      ],
    });
    const planner = new CapabilityPlanner({ source });
    const plan = await planner.plan({ outcome: 'Write a detailed analysis report' });
    const step = plan.steps.find((s) => s.capability === 'TEXT_GENERATION');
    expect(step?.selectedCandidateId).toContain('prov-openai');
    // The unconfigured lower-quality provider never wins on price/free.
    expect(step?.selectedCandidateId).not.toContain('prov-anthropic');
  });

  it('does not crash when enrichment seam is absent (deterministic core)', async () => {
    const planner = new CapabilityPlanner({ source: testSource() });
    const plan = await planner.plan({ outcome: 'Write a blog post' });
    expect(plan.steps.length).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// VedMoulya — EPIC-009: Review + Control Engines
// Deterministic tests (Phase 31): plan review assembly (Phase 23),
// mandatory change-impact analysis (Phase 24), requirement → code
// traceability (Phase 25) and requirement change control (Phase 26).
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { IntentUnderstandingEngine } from '../IntentUnderstandingEngine.js';
import { RequirementExtractionEngine } from '../RequirementExtractionEngine.js';
import { ArchitectureIntelligenceEngine } from '../ArchitectureIntelligenceEngine.js';
import { BuildPlanner } from '../BuildPlanner.js';
import { PlanReviewBuilder } from '../PlanReviewBuilder.js';
import { ChangeImpactAnalyzer } from '../ChangeImpactAnalyzer.js';
import { TraceabilityIndexer } from '../TraceabilityIndexer.js';
import { RequirementVersionControl } from '../RequirementVersionControl.js';
import type { Requirement } from '../../types/requirement-types.js';

const INTENT = new IntentUnderstandingEngine();
const EXTRACTION = new RequirementExtractionEngine();
const ARCH = new ArchitectureIntelligenceEngine();
const BUILD = new BuildPlanner();
const REVIEW = new PlanReviewBuilder();
const CHANGE = new ChangeImpactAnalyzer();
const TRACE = new TraceabilityIndexer();
const VC = new RequirementVersionControl({ now: (): string => '2026-08-09T00:00:00.000Z' });

describe('PlanReviewBuilder (Phase 23)', () => {
  it('assembles what-understood / requested / inferred / dont-know', () => {
    const sessionId = 'v1';
    const intent = INTENT.derive({
      sessionId,
      idea: 'Build a restaurant app with online payment.',
    });
    const requirements = EXTRACTION.extract({ sessionId, intent });
    const review = REVIEW.build({
      sessionId,
      intent,
      requirements,
      questions: [],
      defaults: [],
      brief: {
        sessionId,
        problem: 'p',
        targetUsers: ['u'],
        goals: ['g'],
        nonGoals: [],
        features: [],
        userJourneys: [],
        businessRules: [],
        data: [],
        integrations: [],
        aiCapabilities: [],
        uxStrategy: 'u',
        security: [],
        performance: [],
        scalability: [],
        deployment: [],
        assumptions: [],
        openQuestions: [],
        successCriteria: [],
      },
      journeys: [],
      experience: {
        sessionId,
        primaryModel: 'dashboard',
        secondaryModels: [],
        reasons: [],
        alternatives: [],
        screens: [],
        navigation: 'n',
      },
      design: {
        sessionId,
        visualPersonality: 'x',
        targetAudience: 'a',
        brandDirection: 'b',
        colorSystem: [],
        typography: 't',
        spacing: 's',
        components: [],
        iconography: 'i',
        motion: 'm',
        responsiveStrategy: 'r',
        accessibility: 'a',
        interactionStates: [],
        emptyStates: [],
        loadingStates: [],
        errorStates: [],
        rationale: [],
      },
      architecture: ARCH.derive({ sessionId, archetype: 'restaurant-app', answers: [] }),
      aiStrategy: {
        required: false,
        capabilities: [],
        modelClass: 'm',
        providerStrategy: 'p',
        contextRequirements: [],
        ragRequired: false,
        structuredOutput: false,
        toolCalling: false,
        latencyRequirement: 'l',
        qualityRequirement: 'q',
        tokenBudget: { maxInputTokens: 0, maxOutputTokens: 0 },
        fallback: 'f',
        reusesRuntime: true,
        reasons: [],
      },
      ragStrategy: {
        required: false,
        sources: [],
        retrievalStrategy: 'r',
        groundingRequired: false,
        evidenceRequired: false,
        reasons: [],
      },
      tools: { tools: [], deniedTools: [] },
      security: {
        authentication: 'a',
        authorization: 'z',
        roles: [],
        ownership: 'o',
        tenancy: 't',
        secrets: [],
        pii: [],
        apiSecurity: [],
        fileAccess: [],
        toolPermissions: [],
        audit: [],
        logging: [],
        securityCriticalUnknowns: [],
        blockingQuestions: [],
      },
      cost: {
        aiCalls: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        ragCalls: 0,
        embeddingCalls: 0,
        expectedIterations: 0,
        estimatedCostUsd: 0,
        estimatedLatencyMs: 0,
        strategy: [],
        assumptions: [],
      },
      buildPlan: BUILD.plan({ sessionId, archetype: 'restaurant-app' }),
      ready: true,
    });
    expect(review.whatIUnderstood.length).toBeGreaterThan(0);
    expect(review.explicitlyRequested.some((r) => r.includes('payment'))).toBe(true);
    expect(review.dontKnow.length).toBeGreaterThan(0);
    expect(review.ready).toBe(true);
  });

  it('filters empty what-I-understood entries when the problem is not yet known', () => {
    const sessionId = 'v3';
    const derived = INTENT.derive({
      sessionId,
      idea: 'Build a restaurant app with online payment.',
    });
    const intent = { ...derived, problem: undefined };
    const requirements = EXTRACTION.extract({ sessionId, intent });
    const review = REVIEW.build({
      sessionId,
      intent,
      requirements,
      questions: [],
      defaults: [],
      brief: {
        sessionId,
        problem: 'p',
        targetUsers: ['u'],
        goals: ['g'],
        nonGoals: [],
        features: [],
        userJourneys: [],
        businessRules: [],
        data: [],
        integrations: [],
        aiCapabilities: [],
        uxStrategy: 'u',
        security: [],
        performance: [],
        scalability: [],
        deployment: [],
        assumptions: [],
        openQuestions: [],
        successCriteria: [],
      },
      journeys: [],
      experience: {
        sessionId,
        primaryModel: 'dashboard',
        secondaryModels: [],
        reasons: [],
        alternatives: [],
        screens: [],
        navigation: 'n',
      },
      design: {
        sessionId,
        visualPersonality: 'x',
        targetAudience: 'a',
        brandDirection: 'b',
        colorSystem: [],
        typography: 't',
        spacing: 's',
        components: [],
        iconography: 'i',
        motion: 'm',
        responsiveStrategy: 'r',
        accessibility: 'a',
        interactionStates: [],
        emptyStates: [],
        loadingStates: [],
        errorStates: [],
        rationale: [],
      },
      architecture: ARCH.derive({ sessionId, archetype: 'restaurant-app', answers: [] }),
      aiStrategy: {
        required: false,
        capabilities: [],
        modelClass: 'm',
        providerStrategy: 'p',
        contextRequirements: [],
        ragRequired: false,
        structuredOutput: false,
        toolCalling: false,
        latencyRequirement: 'l',
        qualityRequirement: 'q',
        tokenBudget: { maxInputTokens: 0, maxOutputTokens: 0 },
        fallback: 'f',
        reusesRuntime: true,
        reasons: [],
      },
      ragStrategy: {
        required: false,
        sources: [],
        retrievalStrategy: 'r',
        groundingRequired: false,
        evidenceRequired: false,
        reasons: [],
      },
      tools: { tools: [], deniedTools: [] },
      security: {
        authentication: 'a',
        authorization: 'z',
        roles: [],
        ownership: 'o',
        tenancy: 't',
        secrets: [],
        pii: [],
        apiSecurity: [],
        fileAccess: [],
        toolPermissions: [],
        audit: [],
        logging: [],
        securityCriticalUnknowns: [],
        blockingQuestions: [],
      },
      cost: {
        aiCalls: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        ragCalls: 0,
        embeddingCalls: 0,
        expectedIterations: 0,
        estimatedCostUsd: 0,
        estimatedLatencyMs: 0,
        strategy: [],
        assumptions: [],
      },
      buildPlan: BUILD.plan({ sessionId, archetype: 'restaurant-app' }),
      ready: false,
    });
    // The empty problem string is dropped, the rest remain.
    expect(review.whatIUnderstood.length).toBeGreaterThan(0);
    expect(review.whatIUnderstood.every((s) => s.length > 0)).toBe(true);
  });
});

describe('ChangeImpactAnalyzer (Phase 24)', () => {
  const sessionId = 'ci1';
  const intent = INTENT.derive({ sessionId, idea: 'Build a restaurant app.' });
  const requirements = EXTRACTION.extract({ sessionId, intent });
  const architecture = ARCH.derive({ sessionId, archetype: 'restaurant-app', answers: [] });

  it('calculates payment impact across all dimensions', () => {
    const impact = CHANGE.analyze({
      sessionId,
      request: 'Add online payments',
      requirements,
      architecture,
    });
    expect(impact.requirementImpact.length).toBeGreaterThan(0);
    expect(impact.architectureImpact.some((a) => a.includes('payment'))).toBe(true);
    expect(impact.databaseImpact.some((d) => d.includes('paymentStatus'))).toBe(true);
    expect(impact.apiImpact.some((a) => a.includes('/payments'))).toBe(true);
    expect(impact.securityImpact.length).toBeGreaterThan(0);
    expect(impact.newRequirements.length).toBeGreaterThan(0);
    expect(impact.newSecurityRequirements.length).toBeGreaterThan(0);
    expect(impact.requiresApproval).toBe(true);
  });

  it('displays what will change and what will not', () => {
    const impact = CHANGE.analyze({
      sessionId,
      request: 'Add delivery',
      requirements,
      architecture,
    });
    expect(impact.whatWillChange.length).toBeGreaterThan(0);
    expect(impact.whatWillNotChange.some((w) => w.includes('core workflows'))).toBe(true);
    expect(impact.risks.length).toBeGreaterThan(0);
  });

  it('handles unknown requests generically (still requires approval)', () => {
    const impact = CHANGE.analyze({
      sessionId,
      request: 'Add a time-travel simulator',
      requirements,
      architecture,
    });
    expect(impact.requiresApproval).toBe(true);
    expect(impact.newRequirements[0]?.description).toContain('time-travel simulator');
  });
});

describe('TraceabilityIndexer (Phase 25)', () => {
  it('answers why-a-file-exists for every requirement', () => {
    const sessionId = 'tr1';
    const intent = INTENT.derive({ sessionId, idea: 'Build a restaurant app.' });
    const requirements = EXTRACTION.extract({ sessionId, intent });
    const architecture = ARCH.derive({ sessionId, archetype: 'restaurant-app', answers: [] });
    const design = {
      sessionId,
      visualPersonality: 'v',
      targetAudience: 'a',
      brandDirection: 'b',
      colorSystem: [],
      typography: 't',
      spacing: 's',
      components: ['c'],
      iconography: 'i',
      motion: 'm',
      responsiveStrategy: 'r',
      accessibility: 'a',
      interactionStates: [],
      emptyStates: [],
      loadingStates: [],
      errorStates: [],
      rationale: [],
    };
    const index = TRACE.index({
      sessionId,
      requirements,
      architecture,
      design,
      buildPlan: BUILD.plan({ sessionId, archetype: 'restaurant-app' }),
    });
    expect(index.links.length).toBe(requirements.requirements.length);
    for (const link of index.links) {
      expect(link.requirementId).toMatch(/^REQ-/);
      expect(link.files.length).toBeGreaterThan(0);
      expect(link.tests.length).toBeGreaterThan(0);
      expect(link.validation.length).toBeGreaterThan(0);
    }
  });
});

describe('RequirementVersionControl (Phase 26)', () => {
  it('marks the previous version and creates a new one on change', () => {
    const current: Requirement = {
      id: 'REQ-001',
      description: 'old text',
      category: 'functional',
      priority: 'HIGH',
      confidence: 0.9,
      source: 'USER',
      dependencies: [],
      risks: [],
      status: 'CONFIRMED',
      version: 1,
    };
    const { version, updated } = VC.newVersion(current, 'requirement changed', {
      approvedBy: 'user-1',
      approvedAt: '2026-08-09T00:00:00.000Z',
    });
    expect(version.version).toBe(1);
    expect(version.description).toBe('old text');
    expect(updated.version).toBe(2);
    expect(current.version).toBe(1); // the historical record is never mutated
  });

  it('tracks the latest version per requirement id', () => {
    const current: Requirement = {
      id: 'REQ-001',
      description: 'x',
      category: 'functional',
      priority: 'HIGH',
      confidence: 0.9,
      source: 'USER',
      dependencies: [],
      risks: [],
      status: 'CONFIRMED',
      version: 3,
    };
    const { version } = VC.newVersion(current, 'change');
    const versions = [version];
    expect(VC.latestVersion(versions, 'REQ-001')).toBe(3);
    expect(VC.latestVersion(versions, 'REQ-999')).toBe(0);
  });

  it('records a user answer as a versioned requirement change', () => {
    const { recorded, requirement } = VC.recordAnswer(
      undefined,
      'Customers can order as guests',
      'QUESTION',
      'user-1',
    );
    expect(requirement.status).toBe('CONFIRMED');
    expect(requirement.source).toBe('QUESTION');
    expect(recorded.change).toContain('created from a user answer');
    expect(recorded.approvedBy).toBe('user-1');
  });

  it('versions an updated requirement when the answer changes an existing one', () => {
    const current: Requirement = {
      id: 'REQ-001',
      description: 'old wording',
      category: 'functional',
      priority: 'HIGH',
      confidence: 0.9,
      source: 'USER',
      dependencies: [],
      risks: [],
      status: 'CONFIRMED',
      version: 2,
    };
    const { recorded, requirement } = VC.recordAnswer(current, 'new wording', 'QUESTION', 'user-1');
    expect(recorded.version).toBe(2);
    expect(recorded.change).toContain('updated to: new wording');
    expect(requirement.version).toBe(3);
    expect(requirement.description).toBe('new wording');
    expect(current.description).toBe('old wording'); // the historical record is never mutated
  });
});

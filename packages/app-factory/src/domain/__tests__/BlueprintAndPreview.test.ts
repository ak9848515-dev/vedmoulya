import { describe, expect, it } from 'vitest';
import { SpecificationEngine } from '../SpecificationEngine.js';
import { ArchitectureEngine } from '../ArchitectureEngine.js';
import { TaskGraphBuilder } from '../TaskGraphBuilder.js';
import { BlueprintService } from '../BlueprintService.js';
import { PlanPreviewService } from '../PlanPreviewService.js';
import { EconomicsTracker } from '../EconomicsTracker.js';
import { DeploymentAbstraction, SUPPORTED_DEPLOYMENT_TARGETS } from '../DeploymentAbstraction.js';
import { VersionControlService } from '../VersionControlService.js';
import { ApplicationRegistry, InMemoryApplicationRegistry } from '../ApplicationRegistry.js';
import {
  detectArchetype,
  archetypeLabel,
  roleById,
  rolesForPhase,
  specialistRoleLabel,
  ARCHETYPES,
} from '../../catalog/archetypes.js';
import { FakeVersionControl, FakeDeploymentAdapter } from './fixtures.js';
import type { AppProject } from '../../types/app-types.js';

function makeFixture() {
  const specEngine = new SpecificationEngine();
  const archEngine = new ArchitectureEngine();
  const graphBuilder = new TaskGraphBuilder();
  const spec = specEngine.derive({
    applicationId: 'app-1',
    owner: 'u1',
    goal: 'Build a modern restaurant ordering application.',
  });
  const arch = archEngine.derive({ specification: spec });
  const graph = graphBuilder.build(arch);
  return { spec, arch, graph };
}

describe('BlueprintService — Phase 7', () => {
  it('assembles the full blueprint (source of truth)', () => {
    const { spec, arch, graph } = makeFixture();
    const service = new BlueprintService();
    const blueprint = service.build({
      specification: spec,
      architecture: arch,
      taskGraph: graph,
      plannedFiles: [
        { path: 'src/index.ts', kind: 'source', purpose: 'entry', producedBy: 'implementation' },
        { path: 'db/schema.sql', kind: 'schema', purpose: 'schema', producedBy: 'data_model' },
      ],
      deploymentTarget: 'local',
    });
    expect(blueprint.specification.applicationId).toBe('app-1');
    expect(blueprint.database).toContainEqual(expect.objectContaining({ table: 'menu_items' }));
    expect(blueprint.technologies.some((t) => t.name.includes('Next.js'))).toBe(true);
    expect(blueprint.environment.APP_ID).toBe('app-1');
    expect(blueprint.tests.length).toBe(3);
    expect(blueprint.version).toBe('1.0.0');
  });
});

describe('PlanPreviewService — Phase 8', () => {
  it('builds the plan preview with estimated AI usage + requires approval', () => {
    const { spec, arch, graph } = makeFixture();
    const blueprintService = new BlueprintService();
    const blueprint = blueprintService.build({
      specification: spec,
      architecture: arch,
      taskGraph: graph,
      plannedFiles: [
        { path: 'src/index.ts', kind: 'source', purpose: 'entry', producedBy: 'implementation' },
      ],
      deploymentTarget: 'local',
    });
    const preview = new PlanPreviewService().build({
      specification: spec,
      architecture: arch,
      blueprint,
    });
    expect(preview.approvalRequired).toBe(true);
    expect(preview.estimatedAiUsage.estimatedTokens).toBeGreaterThan(0);
    expect(preview.databaseChanges.some((d) => d.includes('menu_items'))).toBe(true);
    // unresolved requirements are surfaced for confirmation
    expect(preview.approvalChanges).toContain('Unresolved');
  });

  it('approve clears the approval gate with a timestamp', () => {
    const { spec, arch, graph } = makeFixture();
    const blueprintService = new BlueprintService();
    const blueprint = blueprintService.build({
      specification: spec,
      architecture: arch,
      taskGraph: graph,
      plannedFiles: [],
      deploymentTarget: 'local',
    });
    const service = new PlanPreviewService();
    const preview = service.build({ specification: spec, architecture: arch, blueprint });
    const approved = service.approve(preview, 'use Postgres for persistence');
    expect(approved.approvalRequired).toBe(false);
    expect(approved.approvedAt).toBeDefined();
    expect(approved.approvalChanges).toContain('Postgres');
  });
});

describe('EconomicsTracker — Phase 17', () => {
  it('tracks calls, tokens, retries, cache hits and provider usage', () => {
    const tracker = new EconomicsTracker('app-1', { estimatedTokens: 8000, estimatedCostUsd: 0.5 });
    tracker.start();
    tracker.recordCall({
      tokens: { input: 100, output: 50, total: 150 },
      costUsd: 0.001,
      provider: 'openai',
      cacheHit: true,
    });
    tracker.recordCall({
      tokens: { input: 200, output: 100, total: 300 },
      costUsd: 0.002,
      provider: 'anthropic',
      retried: true,
    });
    tracker.recordIteration();
    const snap = tracker.snapshot();
    expect(snap.aiCalls).toBe(2);
    expect(snap.totalTokens).toBe(450);
    expect(snap.cacheHits).toBe(1);
    expect(snap.retries).toBe(1);
    expect(snap.providerUsage.openai).toBe(1);
    expect(snap.estimatedBefore.estimatedTokens).toBe(8000);
    expect(snap.generationTimeMs).toBeGreaterThanOrEqual(0);
  });
});

describe('DeploymentAbstraction — Phase 16', () => {
  it('exposes only registered adapters and blocks without authorization', async () => {
    const adapter = new FakeDeploymentAdapter();
    const abstraction = new DeploymentAbstraction({ local: adapter });
    expect(abstraction.availableTargets()).toEqual(['local']);
    expect(SUPPORTED_DEPLOYMENT_TARGETS).toContain('vercel');
    const blocked = await abstraction.deploy(
      { target: 'local', authorized: false },
      'Applications/app-1',
    );
    expect(blocked.status).toBe('blocked');
    const unknown = await abstraction.deploy(
      { target: 'vercel', authorized: true },
      'Applications/app-1',
    );
    expect(unknown.status).toBe('blocked');
    const deployed = await abstraction.deploy(
      { target: 'local', authorized: true },
      'Applications/app-1',
    );
    expect(deployed.status).toBe('deployed');
  });
});

describe('VersionControlService — Phase 15', () => {
  it('journals every operation and never pushes', () => {
    const service = new VersionControlService(new FakeVersionControl());
    service.init('Applications/app-1');
    service.branch('Applications/app-1', 'feature/menu');
    service.commit('Applications/app-1', 'add menu', ['src/api/menu.ts']);
    service.diff('Applications/app-1');
    const pr = service.preparePullRequest('Applications/app-1', 'feat: menu');
    expect(pr.pullRequestDraft?.title).toBe('feat: menu');
    const history = service.history();
    expect(history.map((h) => h.type)).toEqual(['init', 'branch', 'commit', 'diff', 'prepare_pr']);
    expect(history.every((h) => h.pushed === false)).toBe(true);
  });
});

describe('ApplicationRegistry — Phase 13', () => {
  it('registers, lists (owner-scoped), updates status and enforces IDOR', () => {
    const registry = new ApplicationRegistry(new InMemoryApplicationRegistry());
    const project: AppProject = {
      applicationId: 'app-1',
      owner: 'u1',
      name: 'x',
      archetype: 'restaurant-app',
      specification: {
        applicationId: 'app-1',
        name: 'x',
        purpose: 'p',
        targetUsers: [],
        userJourneys: [],
        features: [],
        requirements: [],
        acceptanceCriteria: [],
        budget: {
          maxIterations: 8,
          maxTokens: 8000,
          maxCostUsd: 1,
          maxLatencyMs: 1,
          maxProviderCalls: 1,
          maxToolCalls: 1,
        },
        constraints: [],
        archetype: 'restaurant-app',
        derivationReasons: [],
        unresolved: [],
      },
      architecture: {
        applicationId: 'app-1',
        layers: [],
        dataModel: [],
        apiContract: [],
        aiCapabilities: [],
        integrations: [],
        securityControls: [],
        performanceTargets: [],
        deploymentTarget: 'local',
        validationReasons: [],
      },
      taskGraph: {
        applicationId: 'app-1',
        tasks: [],
        entryTaskIds: [],
        terminalTaskIds: [],
        validated: true,
        validationReasons: [],
      },
      version: '1.0.0',
      status: 'DRAFT',
      technologies: [],
      aiCapabilities: [],
      repositoryPath: 'Applications/app-1',
      deploymentStatus: 'not_deployed',
      health: 'unknown',
      fileOperations: [],
      files: [],
      vcOperations: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    registry.register(project);
    expect(registry.getOwned('app-1', 'u1').status).toBe('DRAFT');
    expect(() => registry.getOwned('app-1', 'u2')).toThrow();
    registry.setStatus('app-1', 'BUILDING');
    expect(registry.list('u1')[0].status).toBe('BUILDING');
    registry.update('app-1', (p) => ({ ...p, name: 'renamed' }));
    expect(registry.get('app-1').name).toBe('renamed');
  });
});

describe('Archetype catalog — Phase 2/4', () => {
  it('detects archetypes deterministically', () => {
    expect(detectArchetype('Build an ABAP debugger for short dumps.')).toBe('abap-debugger');
    expect(detectArchetype('Build a restaurant menu ordering app.')).toBe('restaurant-app');
    expect(detectArchetype('Build an AI app for customer support.')).toBe('ai-app-builder');
    expect(detectArchetype('Something totally unrelated.')).toBe('generic-web');
    expect(archetypeLabel('restaurant-app')).toContain('Restaurant');
    expect(ARCHETYPES.length).toBe(4);
  });

  it('maps specialist roles to capabilities and phases', () => {
    expect(roleById('security-engineer').capabilities).toContain('classification');
    expect(rolesForPhase('implementation').map((r) => r.id)).toContain('frontend-engineer');
    expect(specialistRoleLabel('deployment-engineer')).toContain('Deployment');
  });
});

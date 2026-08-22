import { describe, it, expect } from 'vitest';
import { WorkflowRegistry } from '../domain/registries/WorkflowRegistry.js';
import { Workflow } from '../domain/entities/Workflow.js';

function createWorkflow(overrides: Record<string, unknown> = {}) {
  return Workflow.create({
    id: overrides.id ?? 'wf-1',
    name: overrides.name ?? 'Test Workflow',
    outcome: overrides.outcome ?? 'Test outcome',
    owner: overrides.owner ?? 'owner-1',
    steps: overrides.steps ?? [
      {
        id: 'step-1',
        title: 'Step 1',
        purpose: 'Do something',
        requiredCapabilities: ['reasoning'],
        riskLevel: 'LOW' as const,
        approvalPolicy: 'AUTO' as const,
      },
    ],
    tags: overrides.tags ?? ['test'],
    status: overrides.status ?? ('DRAFT' as const),
  });
}

describe('WorkflowRegistry', () => {
  it('registers and finds workflows', () => {
    const registry = new WorkflowRegistry();
    const wf = createWorkflow();
    registry.register(wf);
    expect(registry.findById('wf-1')).toBeDefined();
    expect(registry.size).toBe(1);
  });

  it('throws when registering a duplicate workflow', () => {
    const registry = new WorkflowRegistry();
    registry.register(createWorkflow({ id: 'wf-1' }));
    expect(() => registry.register(createWorkflow({ id: 'wf-1' }))).toThrow('already registered');
  });

  it('unregisters workflows', () => {
    const registry = new WorkflowRegistry();
    registry.register(createWorkflow({ id: 'wf-1' }));
    registry.unregister('wf-1');
    expect(registry.findById('wf-1')).toBeUndefined();
    expect(registry.size).toBe(0);
  });

  it('lists all workflows as definitions', () => {
    const registry = new WorkflowRegistry();
    registry.register(createWorkflow({ id: 'wf-1', name: 'First' }));
    registry.register(createWorkflow({ id: 'wf-2', name: 'Second' }));
    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list.map((w) => w.name)).toContain('First');
    expect(list.map((w) => w.name)).toContain('Second');
  });

  it('filters by status', () => {
    const registry = new WorkflowRegistry();
    registry.register(createWorkflow({ id: 'wf-1', status: 'ACTIVE' as const }));
    registry.register(createWorkflow({ id: 'wf-2', status: 'DRAFT' as const }));
    const active = registry.listByStatus('ACTIVE');
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('wf-1');
  });

  it('filters by owner', () => {
    const registry = new WorkflowRegistry();
    registry.register(createWorkflow({ id: 'wf-1', owner: 'owner-1' }));
    registry.register(createWorkflow({ id: 'wf-2', owner: 'owner-2' }));
    const owner1 = registry.listByOwner('owner-1');
    expect(owner1).toHaveLength(1);
    expect(owner1[0].id).toBe('wf-1');
  });

  it('filters by capability', () => {
    const registry = new WorkflowRegistry();
    registry.register(
      createWorkflow({
        id: 'wf-1',
        steps: [
          {
            id: 's1',
            title: 'S',
            purpose: 'P',
            requiredCapabilities: ['reasoning', 'coding'],
            riskLevel: 'LOW',
            approvalPolicy: 'AUTO',
          },
        ],
      }),
    );
    registry.register(
      createWorkflow({
        id: 'wf-2',
        steps: [
          {
            id: 's2',
            title: 'S',
            purpose: 'P',
            requiredCapabilities: ['vision'],
            riskLevel: 'LOW',
            approvalPolicy: 'AUTO',
          },
        ],
      }),
    );
    const reasoning = registry.listByCapability('reasoning');
    expect(reasoning).toHaveLength(1);
    expect(reasoning[0].id).toBe('wf-1');
  });

  it('search with no criteria returns all', () => {
    const registry = new WorkflowRegistry();
    registry.register(createWorkflow({ id: 'wf-1' }));
    expect(registry.search({})).toHaveLength(1);
  });

  it('search filters by status', () => {
    const registry = new WorkflowRegistry();
    registry.register(createWorkflow({ id: 'wf-1', status: 'ACTIVE' as const }));
    registry.register(createWorkflow({ id: 'wf-2', status: 'DRAFT' as const }));
    expect(registry.search({ status: 'ACTIVE' })).toHaveLength(1);
  });

  it('search filters by owner', () => {
    const registry = new WorkflowRegistry();
    registry.register(createWorkflow({ id: 'wf-1', owner: 'o1' }));
    registry.register(createWorkflow({ id: 'wf-2', owner: 'o2' }));
    expect(registry.search({ owner: 'o1' })).toHaveLength(1);
  });

  it('search filters by required capabilities', () => {
    const registry = new WorkflowRegistry();
    registry.register(
      createWorkflow({
        id: 'wf-1',
        steps: [
          {
            id: 's1',
            title: 'S',
            purpose: 'P',
            requiredCapabilities: ['coding'],
            riskLevel: 'LOW',
            approvalPolicy: 'AUTO',
          },
        ],
      }),
    );
    registry.register(
      createWorkflow({
        id: 'wf-2',
        steps: [
          {
            id: 's2',
            title: 'S',
            purpose: 'P',
            requiredCapabilities: ['vision'],
            riskLevel: 'LOW',
            approvalPolicy: 'AUTO',
          },
        ],
      }),
    );
    expect(registry.search({ requiredCapabilities: ['coding'] })).toHaveLength(1);
  });

  it('search filters by tags', () => {
    const registry = new WorkflowRegistry();
    registry.register(createWorkflow({ id: 'wf-1', tags: ['important'] }));
    registry.register(createWorkflow({ id: 'wf-2', tags: ['archive'] }));
    expect(registry.search({ tags: ['important'] })).toHaveLength(1);
  });

  it('search filters by query (name match)', () => {
    const registry = new WorkflowRegistry();
    registry.register(createWorkflow({ id: 'wf-1', name: 'Deploy App' }));
    registry.register(createWorkflow({ id: 'wf-2', name: 'Write Blog' }));
    expect(registry.search({ query: 'deploy' })).toHaveLength(1);
  });

  it('search filters by query (outcome match)', () => {
    const registry = new WorkflowRegistry();
    registry.register(createWorkflow({ id: 'wf-1', outcome: 'Deploy the application' }));
    registry.register(createWorkflow({ id: 'wf-2', outcome: 'Write a blog post' }));
    expect(registry.search({ query: 'application' })).toHaveLength(1);
  });

  it('search with multiple criteria', () => {
    const registry = new WorkflowRegistry();
    registry.register(
      createWorkflow({ id: 'wf-1', name: 'Deploy', status: 'ACTIVE' as const, tags: ['prod'] }),
    );
    registry.register(
      createWorkflow({ id: 'wf-2', name: 'Deploy', status: 'DRAFT' as const, tags: ['dev'] }),
    );
    registry.register(
      createWorkflow({ id: 'wf-3', name: 'Write', status: 'ACTIVE' as const, tags: ['prod'] }),
    );
    const results = registry.search({ query: 'deploy', status: 'ACTIVE', tags: ['prod'] });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('wf-1');
  });
});

import { describe, expect, it } from 'vitest';
import { DEFAULT_EXECUTION_POLICY, ExecutionPolicyService } from '../ExecutionPolicy.js';
import { InMemoryWorkspace } from '../../infrastructure/InMemoryWorkspace.js';
import { FileOperationLayer } from '../FileOperationLayer.js';

describe('ExecutionPolicy — Phase 9', () => {
  const service = new ExecutionPolicyService();

  it('defaults: READ_ONLY allowed, SAFE_WRITE allowed, DESTRUCTIVE blocked', () => {
    expect(service.isAllowed(DEFAULT_EXECUTION_POLICY, 'READ_ONLY')).toBe(true);
    expect(service.isAllowed(DEFAULT_EXECUTION_POLICY, 'SAFE_WRITE')).toBe(true);
    expect(service.isAllowed(DEFAULT_EXECUTION_POLICY, 'DESTRUCTIVE_WRITE')).toBe(false);
    expect(service.isAllowed(DEFAULT_EXECUTION_POLICY, 'DEPLOYMENT')).toBe(false);
    expect(service.isAllowed(DEFAULT_EXECUTION_POLICY, 'SECRET_ACCESS')).toBe(false);
    expect(service.isAllowed(DEFAULT_EXECUTION_POLICY, 'CODE_EXECUTION')).toBe(false);
  });

  it('explicit grant unlocks a blocked class (never silently)', () => {
    const granted = service.grant(DEFAULT_EXECUTION_POLICY, 'DESTRUCTIVE_WRITE', true);
    expect(service.isAllowed(granted, 'DESTRUCTIVE_WRITE')).toBe(true);
  });
});

describe('InMemoryWorkspace — Phase 14 (isolation + containment)', () => {
  // Grants DESTRUCTIVE_WRITE so delete/rename behavior can be tested
  // directly (the default-block posture is asserted in the policy tests).
  const policy: typeof DEFAULT_EXECUTION_POLICY = {
    ...DEFAULT_EXECUTION_POLICY,
    grants: { DESTRUCTIVE_WRITE: true },
  };

  it('creates and reads files inside the workspace root', () => {
    const ws = new InMemoryWorkspace('app-1', policy);
    const result = ws.apply({
      kind: 'create',
      path: 'src/index.ts',
      content: 'export const x = 1;',
      reason: 'test',
      originatingTask: 'task-1',
    });
    expect(result.ok).toBe(true);
    expect(ws.readFile('src/index.ts')).toBe('export const x = 1;');
  });

  it('rejects absolute paths and path traversal (security boundary)', () => {
    const ws = new InMemoryWorkspace('app-1', policy);
    const absolute = ws.apply({
      kind: 'create',
      path: '/etc/passwd',
      content: 'x',
      reason: 'test',
      originatingTask: 't',
    });
    expect(absolute.ok).toBe(false);
    const traversal = ws.apply({
      kind: 'create',
      path: 'src/../../outside.ts',
      content: 'x',
      reason: 'test',
      originatingTask: 't',
    });
    expect(traversal.ok).toBe(false);
  });

  it('captures rollback content before delete (Phase 6)', () => {
    const ws = new InMemoryWorkspace('app-1', policy, [{ path: 'src/a.ts', content: 'ORIGINAL' }]);
    const del = ws.apply({
      kind: 'delete',
      path: 'src/a.ts',
      reason: 'remove',
      originatingTask: 't',
    });
    expect(del.ok).toBe(true);
    expect(del.op.rollbackContent).toBe('ORIGINAL');
    expect(ws.readFile('src/a.ts')).toBeUndefined();
    const rolled = ws.rollbackLast();
    expect(rolled?.ok).toBe(true);
    expect(ws.readFile('src/a.ts')).toBe('ORIGINAL');
  });

  it('renames with a destination and prevents collisions', () => {
    const ws = new InMemoryWorkspace('app-1', policy, [
      { path: 'src/a.ts', content: 'A' },
      { path: 'src/b.ts', content: 'B' },
    ]);
    const rename = ws.apply({
      kind: 'rename',
      path: 'src/a.ts',
      toPath: 'src/c.ts',
      reason: 'move',
      originatingTask: 't',
    });
    expect(rename.ok).toBe(true);
    expect(ws.readFile('src/c.ts')).toBe('A');
    const collision = ws.apply({
      kind: 'rename',
      path: 'src/c.ts',
      toPath: 'src/b.ts',
      reason: 'move',
      originatingTask: 't',
    });
    expect(collision.ok).toBe(false);
  });

  it('workspaces are isolated from each other (no cross-app contamination)', () => {
    const wsA = new InMemoryWorkspace('app-a', policy);
    const wsB = new InMemoryWorkspace('app-b', policy);
    wsA.apply({
      kind: 'create',
      path: 'secret.ts',
      content: 'A-DATA',
      reason: 't',
      originatingTask: 't',
    });
    expect(wsB.readFile('secret.ts')).toBeUndefined();
    expect(wsA.workspacePath()).toBe('Applications/app-a');
    expect(wsB.workspacePath()).toBe('Applications/app-b');
  });
});

describe('FileOperationLayer — Phases 5/6', () => {
  const policy = DEFAULT_EXECUTION_POLICY;

  it('plans and applies a create with full explainability', () => {
    const ws = new InMemoryWorkspace('app-1', policy);
    const layer = new FileOperationLayer(ws, policy);
    const planned = layer.plan({
      kind: 'create',
      path: 'src/index.ts',
      content: 'export {};',
      reason: 'generated entry point',
      originatingTask: 'task-5',
    });
    expect(planned.actionClass).toBe('SAFE_WRITE');
    expect(planned.allowed).toBe(true);
    const applied = layer.apply(planned);
    expect(applied.status).toBe('applied');
    expect(applied.reason).toBe('generated entry point');
    expect(applied.originatingTask).toBe('task-5');
    expect(layer.history()).toHaveLength(1);
  });

  it('blocks destructive ops without authorization', () => {
    const ws = new InMemoryWorkspace('app-1', policy, [{ path: 'src/a.ts', content: 'x' }]);
    const layer = new FileOperationLayer(ws, policy);
    const planned = layer.plan({
      kind: 'delete',
      path: 'src/a.ts',
      reason: 'cleanup',
      originatingTask: 't',
    });
    expect(planned.requiresApproval).toBe(true);
    expect(layer.canApply(planned)).toBe(false);
  });

  it('applies authorized destructive ops with rollback', () => {
    const ws = new InMemoryWorkspace('app-1', policy, [{ path: 'src/a.ts', content: 'x' }]);
    const layer = new FileOperationLayer(ws, policy);
    const planned = layer.plan({
      kind: 'delete',
      path: 'src/a.ts',
      reason: 'cleanup',
      originatingTask: 't',
    });
    const applied = layer.applyAuthorized(planned);
    expect(applied.status).toBe('applied');
    const rolled = layer.rollback();
    expect(rolled?.status).toBe('rolled_back');
    expect(ws.readFile('src/a.ts')).toBe('x');
  });

  it('classifies env/secret files as SECRET_ACCESS', () => {
    const ws = new InMemoryWorkspace('app-1', policy);
    const layer = new FileOperationLayer(ws, policy);
    const planned = layer.plan({
      kind: 'create',
      path: '.env.production',
      content: 'KEY=value',
      reason: 'env',
      originatingTask: 't',
    });
    expect(planned.actionClass).toBe('SECRET_ACCESS');
  });
});

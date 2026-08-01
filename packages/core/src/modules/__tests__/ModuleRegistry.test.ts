// ──────────────────────────────────────────────────────────────────
// VedMoulya — Module Registry Tests
// Module registration + lifecycle (BLP-001/D03)
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { moduleRegistry, type ModuleDefinition } from '../index.js';
import { container } from '../../di/index.js';
import { appLifecycle } from '../../lifecycle/index.js';

function makeModule(name: string, overrides: Partial<ModuleDefinition> = {}): ModuleDefinition {
  return {
    name,
    description: `${name} module`,
    version: '1.0.0',
    dependencies: [],
    register: () => {},
    ...overrides,
  };
}

describe('ModuleRegistry', () => {
  beforeEach(() => {
    moduleRegistry.reset();
    container.clear();
    appLifecycle.reset();
  });

  it('registers and lists modules', () => {
    moduleRegistry.register(makeModule('alpha'));
    moduleRegistry.register(makeModule('beta'));
    expect(moduleRegistry.list().map((m) => m.name)).toEqual(['alpha', 'beta']);
    expect(moduleRegistry.get('alpha')?.name).toBe('alpha');
    expect(moduleRegistry.get('missing')).toBeUndefined();
  });

  it('throws when a module is registered twice', () => {
    moduleRegistry.register(makeModule('dup'));
    expect(() => moduleRegistry.register(makeModule('dup'))).toThrow(/already registered: dup/);
  });

  it('initializeAll registers with DI and initializes modules with hooks', async () => {
    const registerSpy = vi.fn();
    const initializeSpy = vi.fn().mockResolvedValue(undefined);
    moduleRegistry.register(
      makeModule('svc', {
        register: registerSpy,
        initialize: initializeSpy,
      }),
    );

    await moduleRegistry.initializeAll();

    expect(registerSpy).toHaveBeenCalledWith(container);
    expect(initializeSpy).toHaveBeenCalled();
    expect(moduleRegistry.isInitialized()).toBe(true);
    expect(moduleRegistry.getInitializedModules()).toContain('svc');
  });

  it('registers shutdown hooks for modules that provide one', async () => {
    const shutdownSpy = vi.fn().mockResolvedValue(undefined);
    moduleRegistry.register(
      makeModule('worker', {
        register: () => {},
        shutdown: shutdownSpy,
      }),
    );

    await moduleRegistry.initializeAll();
    await appLifecycle.stop();

    expect(shutdownSpy).toHaveBeenCalled();
  });

  it('initializeAll is idempotent', async () => {
    const initializeSpy = vi.fn().mockResolvedValue(undefined);
    moduleRegistry.register(
      makeModule('once', {
        register: () => {},
        initialize: initializeSpy,
      }),
    );

    await moduleRegistry.initializeAll();
    await moduleRegistry.initializeAll();

    expect(initializeSpy).toHaveBeenCalledTimes(1);
    expect(moduleRegistry.getInitializedModules().filter((m) => m === 'once')).toHaveLength(1);
  });

  it('reset clears modules and initialization state', async () => {
    moduleRegistry.register(makeModule('tmp'));
    await moduleRegistry.initializeAll();
    moduleRegistry.reset();
    expect(moduleRegistry.isInitialized()).toBe(false);
    expect(moduleRegistry.list()).toEqual([]);
  });
});

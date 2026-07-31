// ──────────────────────────────────────────────────────────────────
// VedMoulya — Module Registration
// Module registry with lifecycle hooks for initialize and shutdown
// Implements BLP-001/D03 — Development Phases — module lifecycle
// ──────────────────────────────────────────────────────────────────

import { container, type Container } from '../di/index.js';
import { appLifecycle } from '../lifecycle/index.js';

export interface ModuleDefinition {
  name: string;
  description: string;
  version: string;
  dependencies: string[];
  register(container: Container): void;
  initialize?(): Promise<void>;
  shutdown?(): Promise<void>;
}

class ModuleRegistry {
  private readonly modules = new Map<string, ModuleDefinition>();
  private initialized = false;
  private initializedModules: string[] = [];

  register(module: ModuleDefinition): void {
    if (this.modules.has(module.name)) {
      throw new Error(`Module already registered: ${module.name}`);
    }
    this.modules.set(module.name, module);
  }

  async initializeAll(): Promise<void> {
    if (this.initialized) return;

    // Step 1: Register all module services with DI
    for (const [, module] of this.modules) {
      module.register(container);
    }

    // Step 2: Call async initialize on modules that support it
    for (const [name, module] of this.modules) {
      if (module.initialize) {
        await module.initialize();
        this.initializedModules.push(name);
      }
    }

    // Step 3: Register shutdown hooks for cleanup
    for (const [, module] of this.modules) {
      if (module.shutdown) {
        appLifecycle.onStop(async () => {
          await (module.shutdown as () => Promise<void>)();
        });
      }
    }

    this.initialized = true;
  }

  get(name: string): ModuleDefinition | undefined {
    return this.modules.get(name);
  }

  list(): ModuleDefinition[] {
    return Array.from(this.modules.values());
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getInitializedModules(): string[] {
    return [...this.initializedModules];
  }

  reset(): void {
    this.modules.clear();
    this.initialized = false;
    this.initializedModules = [];
  }
}

export const moduleRegistry = new ModuleRegistry();

// ──────────────────────────────────────────────────────────────────
// VedMoulya — Dependency Injection Container
// with lifecycle hooks for initialization and disposal
// Implements BLP-001/D02 — Engineering Principle #5 (Explicit Dependencies)
// ──────────────────────────────────────────────────────────────────

export type ServiceFactory<T> = (container: Container) => T;
export interface ServiceDefinitionMeta<T> {
  factory: ServiceFactory<T>;
  singleton: boolean;
}
export type ServiceLifecycleHook = () => Promise<void> | void;

interface ServiceInstance<T> {
  instance: T;
}

export class Container {
  private readonly factories = new Map<string, ServiceDefinitionMeta<unknown>>();
  private readonly singletons = new Map<string, ServiceInstance<unknown>>();
  private readonly tags = new Map<string, Set<string>>();
  private readonly initHooks: ServiceLifecycleHook[] = [];
  private readonly disposeHooks: ServiceLifecycleHook[] = [];
  private initialized = false;

  /**
   * Register a service with optional singleton flag (default: true)
   */
  register<T>(name: string, factory: ServiceFactory<T>, singleton: boolean = true): void {
    this.factories.set(name, { factory: factory, singleton });
  }

  /**
   * Register a service with a tag for grouped resolution
   */
  registerWithTag<T>(
    name: string,
    tag: string,
    factory: ServiceFactory<T>,
    singleton: boolean = true,
  ): void {
    this.register(name, factory, singleton);
    const tagged = this.tags.get(tag) ?? new Set();
    tagged.add(name);
    this.tags.set(tag, tagged);
  }

  /**
   * Register an initialization hook (called during container.init)
   */
  onInit(hook: ServiceLifecycleHook): void {
    this.initHooks.push(hook);
  }

  /**
   * Register a disposal hook (called during container.dispose)
   */
  onDispose(hook: ServiceLifecycleHook): void {
    this.disposeHooks.push(hook);
  }

  /**
   * Initialize all registered services
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    for (const hook of this.initHooks) {
      await hook();
    }
    this.initialized = true;
  }

  /**
   * Dispose all registered services (cleanup)
   */
  async dispose(): Promise<void> {
    for (const hook of this.disposeHooks.reverse()) {
      await hook();
    }
    this.clear();
  }

  /**
   * Resolve a service by name
   */
  resolve(name: string): unknown {
    const definition = this.factories.get(name);
    if (!definition) {
      throw new Error(`Service not registered: ${name}`);
    }

    if (definition.singleton) {
      const existing = this.singletons.get(name);
      if (existing) {
        return existing.instance;
      }
      const instance = definition.factory(this);
      this.singletons.set(name, { instance });
      return instance;
    }

    return definition.factory(this);
  }

  /**
   * Resolve all services registered with a specific tag
   */
  resolveTagged(tag: string): Map<string, unknown> {
    const serviceNames = this.tags.get(tag);
    if (!serviceNames) return new Map();

    const result = new Map<string, unknown>();
    for (const name of serviceNames) {
      result.set(name, this.resolve(name));
    }
    return result;
  }

  /**
   * Check if a service is registered
   */
  has(name: string): boolean {
    return this.factories.has(name);
  }

  /**
   * Clear all registrations and singletons (for testing)
   */
  clear(): void {
    this.factories.clear();
    this.singletons.clear();
    this.tags.clear();
    this.initHooks.length = 0;
    this.disposeHooks.length = 0;
    this.initialized = false;
  }

  /**
   * Check if container has been initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

export const container = new Container();

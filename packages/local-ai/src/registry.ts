// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya Local AI — Local Runtime registry
//
// Adapters are REGISTERED, not hard-wired. The Local Agent and the HTTP layer
// resolve a runtime by id from this registry, so adding LM Studio / llama.cpp /
// vLLM / Jan later is a `register(...)` call plus its adapter — the agent, the
// server and the web contract are unchanged.
// ─────────────────────────────────────────────────────────────────────────────

import type { LocalRuntime, LocalRuntimeId } from './types.js';

export class LocalRuntimeRegistry {
  private readonly runtimes = new Map<LocalRuntimeId, LocalRuntime>();

  /**
   * Register an adapter. Re-registering the SAME id replaces the previous
   * adapter (last registration wins) so a process can override a default
   * without maintaining a second registry.
   */
  register(runtime: LocalRuntime): this {
    this.runtimes.set(runtime.id, runtime);
    return this;
  }

  has(id: LocalRuntimeId): boolean {
    return this.runtimes.has(id);
  }

  /** Resolve an adapter. Returns undefined for an unknown id — callers decide. */
  get(id: LocalRuntimeId): LocalRuntime | undefined {
    return this.runtimes.get(id);
  }

  /** Every registered adapter, in registration order. */
  list(): LocalRuntime[] {
    return [...this.runtimes.values()];
  }

  ids(): LocalRuntimeId[] {
    return [...this.runtimes.keys()];
  }

  get size(): number {
    return this.runtimes.size;
  }
}

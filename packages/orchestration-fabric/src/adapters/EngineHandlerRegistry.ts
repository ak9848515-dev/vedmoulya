// ──────────────────────────────────────────────────────────────────
// VedMoulya — Orchestration Fabric: Engine Handler Registry
// SPRINT-094 — Maps WorkTypes to existing engine implementations.
//
// The registry is the single seam between the orchestration fabric
// and the existing VedMoulya engine ecosystem. Engines register
// themselves as WorkItemHandlers; the OrchestratorService dispatches
// work through this registry.
//
// Each handler declares:
//   - supported WorkTypes
//   - execute() method
//   - resource profile (AI, IO, CPU bound)
//
// The OrchestratorService does NOT know which concrete engine handles
// a work type — it only knows the handler contract.
// ──────────────────────────────────────────────────────────────────

import type { WorkItemHandler, WorkItemResult } from '../domain/OrchestratorService.js';

/**
 * Registry of engine handlers keyed by work type.
 *
 * Usage:
 *   const registry = new EngineHandlerRegistry();
 *   registry.register('ai_inference', aiHandler);
 *   registry.register('knowledge_retrieval', ragHandler);
 *
 *   const handler = registry.get('ai_inference');
 *   await handler.execute(workItem);
 */
export class EngineHandlerRegistry {
  private readonly handlers = new Map<string, WorkItemHandler>();

  /**
   * Register a handler for a specific work type.
   * If a handler already exists for this type, it is replaced.
   */
  register(workType: string, handler: WorkItemHandler): void {
    this.handlers.set(workType, handler);
  }

  /**
   * Get the handler for a specific work type.
   * Returns undefined if no handler is registered for this type.
   */
  get(workType: string): WorkItemHandler | undefined {
    return this.handlers.get(workType);
  }

  /**
   * Check if a handler is registered for a specific work type.
   */
  has(workType: string): boolean {
    return this.handlers.has(workType);
  }

  /**
   * Get all registered work types.
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get the count of registered handlers.
   */
  get size(): number {
    return this.handlers.size;
  }

  /**
   * Create a WorkItemHandler that delegates to the registry.
   * The delegate handler tries each registered handler's supportedWorkTypes
   * to find the right one for a given work item.
   */
  createDelegateHandler(): WorkItemHandler {
    return {
      supportedWorkTypes: this.getRegisteredTypes() as WorkItemHandler['supportedWorkTypes'],
      execute: async (workItem): Promise<WorkItemResult> => {
        const handler = this.get(workItem.workType);
        if (!handler) {
          throw new Error(
            `No handler registered for work type '${workItem.workType}'. ` +
              `Registered types: ${this.getRegisteredTypes().join(', ')}`,
          );
        }
        return handler.execute(workItem);
      },
    };
  }
}

/**
 * Default singleton registry.
 * Engines register themselves at startup.
 */
export const defaultEngineHandlerRegistry = new EngineHandlerRegistry();

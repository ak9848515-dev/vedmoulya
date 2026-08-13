// ──────────────────────────────────────────────────────────────────
// VedMoulya — Loop Engine: Tool Registry Port
// EPIC-006 — Phase 10. Adapts the frozen ToolRuntime's ToolRegistry
// into the loop's ToolExecutionPort. Every tool call inherits the
// security chain: registry resolution → capability → authorization →
// allowlist/denylist → schema validation → timeout → rate limit →
// audit. No shell/fs/network/db tool surface exists.
// ──────────────────────────────────────────────────────────────────

// Deep-import path: the runtime module exports the tool boundary; the
// top-level services barrel re-exports only a subset of the runtime. This
// avoids modifying frozen package barrels.
import type { ToolRegistry } from '@vedmoulya/services/ai/runtime/ToolRuntime';
import type { ToolExecutionPort } from '../contracts/loop-ports.js';

export class ToolRegistryToolPort implements ToolExecutionPort {
  constructor(private readonly registry: ToolRegistry) {}

  async execute(input: {
    toolName: string;
    arguments: Record<string, unknown>;
    userId: string;
  }): Promise<{
    ok: boolean;
    denied: boolean;
    outcome: string;
    error?: string;
    latencyMs: number;
  }> {
    const result = await this.registry.execute({
      toolName: input.toolName,
      arguments: input.arguments,
      userId: input.userId,
    });
    return {
      ok: result.ok,
      denied: result.denied,
      outcome: result.outcome,
      error: result.error,
      latencyMs: result.latencyMs,
    };
  }

  listAllowed(): string[] {
    return this.registry.list().map((tool) => tool.name);
  }
}

// ──────────────────────────────────────────────────────────────────
// VedMoulya — Agent Execution Intelligence: Tool Runtime Port
//
// Adapts the frozen ToolRuntime's ToolRegistry into both agent tool
// ports. Every tool call inherits the FULL security chain: registry
// resolution → capability → authorization → allowlist/denylist →
// schema validation → timeout → rate limit → audit. The agent layer
// NEVER bypasses a denial, and it re-implements no tool registry.
//
// The frozen runtime ships only SAFE deterministic tools
// (echo / current_time / calculator — pure in-memory, no I/O), so the
// honest permission classification for this platform surface is READ.
// Any future higher-risk tool must be classified at the source.
// ──────────────────────────────────────────────────────────────────

// Deep-import path: the runtime module exports the tool boundary; the
// top-level services barrel re-exports only a subset of the runtime.
import type { ToolRegistry } from '@vedmoulya/services/ai/runtime/ToolRuntime';
import type {
  AgentToolActionResult,
  AgentToolExecutionPort,
  AgentToolInfo,
  AgentToolRegistryPort,
} from '../contracts/agent-execution-ports.js';
import type { ToolPermissionClass } from '../types/agent-execution-types.js';

/** The frozen runtime ships only safe, deterministic, in-memory tools. */
const SAFE_PERMISSION_CLASS: ToolPermissionClass = 'READ';

export class ToolRegistryAgentPort implements AgentToolExecutionPort, AgentToolRegistryPort {
  constructor(private readonly registry: ToolRegistry) {}

  async execute(input: {
    toolName: string;
    arguments: Record<string, unknown>;
    userId?: string;
  }): Promise<AgentToolActionResult> {
    const result = await this.registry.execute({
      toolName: input.toolName,
      arguments: input.arguments,
      userId: input.userId ?? 'agent',
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

  describe(toolName: string): AgentToolInfo | undefined {
    const tool = this.registry.list().find((t) => t.name === toolName);
    if (!tool) return undefined;
    return {
      toolName: tool.name,
      permissionClass: SAFE_PERMISSION_CLASS,
      description: tool.description,
      requiresApproval: false,
    };
  }
}

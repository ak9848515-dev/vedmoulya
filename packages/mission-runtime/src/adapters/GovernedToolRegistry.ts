// ──────────────────────────────────────────────────────────────────
// VedMoulya — Mission Runtime: Governed Tool Registry + Port (BLD-022)
//
// Registry factory (safe built-ins + optional bounded workspace tools)
// and the agent-side tool port with HONEST permission classification at
// the source. The frozen ToolRegistryAgentPort classifies every shipped
// in-memory tool as READ — correct for those tools. A workspace-WRITE
// tool must be classified truthfully so the planning validation, engine
// approval gates and permission checks see the real risk class. This is
// an adapter over the SAME registry — never a second registry.
// ──────────────────────────────────────────────────────────────────

import { ToolRegistry, registerSafeTools } from '@vedmoulya/services/ai/runtime/ToolRuntime';
import type { ToolRegistryOptions } from '@vedmoulya/services/ai/runtime/ToolRuntime';
import { HIGH_RISK_PERMISSION_CLASSES } from '@vedmoulya/agent-execution';
import type {
  AgentToolActionResult,
  AgentToolExecutionPort,
  AgentToolInfo,
  AgentToolRegistryPort,
} from '@vedmoulya/agent-execution';
import type { ToolPermissionClass } from '@vedmoulya/agent-execution';
import {
  WORKSPACE_READ_TOOL,
  WORKSPACE_WRITE_TOOL,
  WorkspaceRootBinding,
  createWorkspaceTools,
  type WorkspaceToolOptions,
} from './WorkspaceTools.js';

const TOOL_PERMISSION_CLASSES_BY_TOOL: Record<string, ToolPermissionClass> = {
  [WORKSPACE_WRITE_TOOL]: 'WRITE',
  [WORKSPACE_READ_TOOL]: 'READ',
};

export function permissionClassForTool(
  toolName: string,
  overrides: Record<string, ToolPermissionClass> = {},
): ToolPermissionClass {
  const override = overrides[toolName];
  if (override !== undefined) return override;
  const mapped = TOOL_PERMISSION_CLASSES_BY_TOOL[toolName];
  return mapped ?? 'READ';
}

/**
 * Registers the safe built-in tools plus (optionally) the bounded workspace
 * tools on a governed ToolRegistry. The registry applies the FULL security
 * chain to every call — nothing here bypasses ToolRuntime.
 */
export function createGovernedToolRegistry(options: {
  registryOptions?: ToolRegistryOptions;
  workspace?: { binding: WorkspaceRootBinding; toolOptions?: WorkspaceToolOptions };
}): ToolRegistry {
  const registry = new ToolRegistry({
    grantedCapabilities: ['reasoning', 'calculation', 'knowledge', 'productivity'],
    ...options.registryOptions,
  });
  registerSafeTools(registry);
  const workspace = options.workspace;
  if (workspace) {
    const tools = createWorkspaceTools(workspace.binding, workspace.toolOptions);
    registry.register(tools.read);
    registry.register(tools.write);
  }
  return registry;
}

/**
 * Agent tool port over the governed registry with honest classification.
 * Implements BOTH AgentToolExecutionPort and AgentToolRegistryPort — the
 * same dual port the frozen ToolRegistryAgentPort implements.
 */
export class ClassifyingToolRegistryPort implements AgentToolExecutionPort, AgentToolRegistryPort {
  private readonly overrides: Record<string, ToolPermissionClass>;

  constructor(
    private readonly registry: ToolRegistry,
    overrides: Record<string, ToolPermissionClass> = {},
  ) {
    this.overrides = overrides;
  }

  async execute(input: {
    toolName: string;
    arguments: Record<string, unknown>;
    userId?: string;
  }): Promise<AgentToolActionResult> {
    const result = await this.registry.execute({
      toolName: input.toolName,
      arguments: input.arguments,
      userId: input.userId ?? 'mission-runtime',
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
    const entry = this.registry.list().find((tool) => tool.name === toolName);
    if (!entry) return undefined;
    const permissionClass = permissionClassForTool(toolName, this.overrides);
    return {
      toolName: entry.name,
      permissionClass,
      description: entry.description,
      // Only genuinely high-risk classes are approval-gated at describe time;
      // the engine's approval policy remains authoritative.
      requiresApproval: (HIGH_RISK_PERMISSION_CLASSES as readonly string[]).includes(
        permissionClass,
      ),
    };
  }
}

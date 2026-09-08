// ──────────────────────────────────────────────────────────────────
// VedMoulya — Agent Execution Intelligence: Tool Runtime Port Tests
// The agent tool boundary delegates to the frozen ToolRuntime security
// chain: registry resolution → capability → authorization →
// allowlist/denylist → schema validation → timeout → rate limit →
// audit. A denial is never bypassed by the agent layer.
// ──────────────────────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import {
  ToolRegistry,
  registerSafeTools,
  ECHO_TOOL,
} from '@vedmoulya/services/ai/runtime/ToolRuntime';
import { ToolRegistryAgentPort } from '../ToolRegistryAgentPort.js';

describe('ToolRegistryAgentPort — execution boundary', () => {
  it('executes allowlisted tools through the full security chain', async () => {
    const registry = new ToolRegistry({
      grantedCapabilities: ['reasoning', 'calculation', 'productivity'],
      allowlist: ['echo', 'calculator'],
    });
    registerSafeTools(registry);
    const port = new ToolRegistryAgentPort(registry);
    const result = await port.execute({
      toolName: 'echo',
      arguments: { text: 'hello' },
      userId: 'u',
    });
    expect(result.ok).toBe(true);
    expect(result.denied).toBe(false);
    expect(result.outcome).toBe('success');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('denies tools missing the granted capability (no silent execution)', async () => {
    const registry = new ToolRegistry({ grantedCapabilities: [] });
    registerSafeTools(registry);
    const port = new ToolRegistryAgentPort(registry);
    const result = await port.execute({
      toolName: 'calculator',
      arguments: { expression: '1+1' },
      userId: 'u',
    });
    expect(result.ok).toBe(false);
    expect(result.denied).toBe(true);
    expect(result.outcome).toBe('authorization_error');
  });

  it('denies tools not on the platform allowlist', async () => {
    const registry = new ToolRegistry({
      grantedCapabilities: ['calculation'],
      allowlist: ['echo'],
    });
    registerSafeTools(registry);
    const port = new ToolRegistryAgentPort(registry);
    const result = await port.execute({
      toolName: 'calculator',
      arguments: { expression: '1+1' },
      userId: 'u',
    });
    expect(result.denied).toBe(true);
  });

  it('rejects schema-invalid tool arguments before the handler runs', async () => {
    const registry = new ToolRegistry({ grantedCapabilities: ['reasoning'], allowlist: ['echo'] });
    registerSafeTools(registry);
    const port = new ToolRegistryAgentPort(registry);
    const result = await port.execute({ toolName: 'echo', arguments: {}, userId: 'u' });
    expect(result.ok).toBe(false);
    expect(result.denied).toBe(true);
    expect(result.outcome).toBe('validation_error');
  });
});

describe('ToolRegistryAgentPort — registry view (authoritative metadata only)', () => {
  it('lists the registered tools', async () => {
    const registry = new ToolRegistry({ grantedCapabilities: ['reasoning'] });
    registry.register(ECHO_TOOL);
    const port = new ToolRegistryAgentPort(registry);
    expect(port.listAllowed()).toContain('echo');
  });

  it('describes a registered tool with its honest permission class', async () => {
    const registry = new ToolRegistry({ grantedCapabilities: ['reasoning'] });
    registry.register(ECHO_TOOL);
    const port = new ToolRegistryAgentPort(registry);
    const info = port.describe('echo');
    expect(info?.toolName).toBe('echo');
    // The frozen runtime ships only SAFE deterministic tools → READ class.
    expect(info?.permissionClass).toBe('READ');
    expect(info?.requiresApproval).toBe(false);
  });

  it('returns undefined for an unknown tool (plan validation blocks it)', async () => {
    const registry = new ToolRegistry({ grantedCapabilities: ['reasoning'] });
    const port = new ToolRegistryAgentPort(registry);
    expect(port.describe('fs.rm')).toBeUndefined();
    expect(port.listAllowed()).not.toContain('fs.rm');
  });
});

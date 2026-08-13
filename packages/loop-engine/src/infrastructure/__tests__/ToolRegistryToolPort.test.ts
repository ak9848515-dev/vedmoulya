import { describe, expect, it } from 'vitest';
import {
  ToolRegistry,
  registerSafeTools,
  ECHO_TOOL,
} from '@vedmoulya/services/ai/runtime/ToolRuntime';
import { ToolRegistryToolPort } from '../ToolRegistryToolPort.js';

describe('ToolRegistryToolPort', () => {
  it('executes allowlisted tools through the security chain', async () => {
    const registry = new ToolRegistry({
      grantedCapabilities: ['reasoning', 'calculation', 'productivity'],
      allowlist: ['echo', 'calculator'],
    });
    registerSafeTools(registry);
    const port = new ToolRegistryToolPort(registry);
    const result = await port.execute({
      toolName: 'echo',
      arguments: { text: 'hello' },
      userId: 'u',
    });
    expect(result.ok).toBe(true);
    expect(result.denied).toBe(false);
    expect(result.outcome).toBe('success');
  });

  it('denies tools missing the granted capability (no silent execution)', async () => {
    const registry = new ToolRegistry({ grantedCapabilities: [] });
    registerSafeTools(registry);
    const port = new ToolRegistryToolPort(registry);
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
    const port = new ToolRegistryToolPort(registry);
    const result = await port.execute({
      toolName: 'calculator',
      arguments: { expression: '1+1' },
      userId: 'u',
    });
    expect(result.denied).toBe(true);
  });

  it('rejects schema-invalid tool arguments', async () => {
    const registry = new ToolRegistry({ grantedCapabilities: ['reasoning'], allowlist: ['echo'] });
    registerSafeTools(registry);
    const port = new ToolRegistryToolPort(registry);
    const result = await port.execute({ toolName: 'echo', arguments: {}, userId: 'u' });
    expect(result.ok).toBe(false);
    expect(result.denied).toBe(true);
    expect(result.outcome).toBe('validation_error');
  });

  it('lists the registered tools', async () => {
    const registry = new ToolRegistry({ grantedCapabilities: ['reasoning'] });
    registry.register(ECHO_TOOL);
    const port = new ToolRegistryToolPort(registry);
    expect(port.listAllowed()).toContain('echo');
  });
});

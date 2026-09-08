import { describe, expect, it, vi } from 'vitest';
import { createVoiceAnswerPort, createVoiceBrainPort } from '../infrastructure/VoiceBridgePorts.js';

const task = { id: 'task-1', objective: 'do it', status: 'PLANNED', stage: 'PLAN' };

describe('VoiceBridgePorts', () => {
  it('maps successful Brain task operations', async () => {
    const brain = {
      createTask: vi.fn().mockReturnValue({ success: true, data: task }),
      plan: vi.fn().mockResolvedValue({
        success: true,
        data: { ...task, approvalRequired: true },
      }),
      approve: vi.fn().mockReturnValue({ success: true, data: task }),
      reject: vi.fn().mockReturnValue({ success: true, data: task }),
    };
    const port = createVoiceBrainPort(brain as never);

    expect(port.createTask('u', 'input')).toEqual({ success: true, data: task });
    await expect(port.plan?.('u', 't')).resolves.toEqual({
      success: true,
      data: { id: task.id, status: task.status, stage: task.stage, approvalRequired: true },
    });
    expect(port.approve?.('u', 't', 'a')).toEqual({ success: true, data: task });
    expect(port.reject?.('u', 't', 'a')).toEqual({ success: true, data: task });
  });

  it('preserves Brain failures and missing data', async () => {
    const failure = { success: false, error: 'denied', code: 'DENIED' };
    const brain = {
      createTask: vi.fn().mockReturnValue(failure),
      plan: vi.fn().mockResolvedValue(failure),
      approve: vi.fn().mockReturnValue({ success: true, data: null, error: 'empty' }),
      reject: vi.fn().mockReturnValue({ success: true, data: null }),
    };
    const port = createVoiceBrainPort(brain as never);

    expect(port.createTask('u', 'input')).toEqual(failure);
    await expect(port.plan?.('u', 't')).resolves.toEqual(failure);
    expect(port.approve?.('u', 't', 'a')).toEqual({
      success: false,
      error: 'empty',
      code: undefined,
    });
    expect(port.reject?.('u', 't', 'a')).toEqual({
      success: false,
      error: undefined,
      code: undefined,
    });
  });

  it('maps answer success, abstention, Error, and unknown failures', async () => {
    const ai = { orchestrate: vi.fn() };
    const port = createVoiceAnswerPort(ai as never);
    ai.orchestrate.mockResolvedValue({ abstained: false, content: 'answer' });
    await expect(port.ask({ userId: 'u', prompt: 'hello' })).resolves.toEqual({
      ok: true,
      content: 'answer',
    });
    ai.orchestrate.mockResolvedValue({ abstained: true, content: '' });
    await expect(port.ask({ userId: 'u', prompt: 'hello' })).resolves.toEqual({
      ok: false,
      error: 'The assistant abstained rather than answer without evidence.',
    });
    ai.orchestrate.mockRejectedValue(new Error('offline'));
    await expect(port.ask({ userId: 'u', prompt: 'hello' })).resolves.toEqual({
      ok: false,
      error: 'offline',
    });
    ai.orchestrate.mockRejectedValue('offline');
    await expect(port.ask({ userId: 'u', prompt: 'hello' })).resolves.toEqual({
      ok: false,
      error: 'AI answer failed.',
    });
  });
});

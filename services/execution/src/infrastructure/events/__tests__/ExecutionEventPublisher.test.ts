// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Execution Event Publisher unit tests
// BLD-009 — Execution Intelligence Engine
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi } from 'vitest';
import { ExecutionEventPublisher } from '../ExecutionEventPublisher.js';
import { logger } from '@vedmoulya/core';

function makeEventBus() {
  return { publish: vi.fn().mockResolvedValue(undefined) };
}

describe('ExecutionEventPublisher', () => {
  it('publishes a plan event with the created envelope', async () => {
    const bus = makeEventBus();
    const publisher = new ExecutionEventPublisher(bus as never);
    await publisher.publish('execution.plan.created', { planId: 'plan_1', title: 'T' });
    expect(bus.publish).toHaveBeenCalledTimes(1);
    const [envelope] = bus.publish.mock.calls[0] as [Record<string, unknown>];
    expect(envelope.type).toBe('execution.plan.created');
    expect(envelope.source).toBe('execution');
    expect((envelope.data as Record<string, unknown>).planId).toBe('plan_1');
    expect((envelope.data as Record<string, unknown>).title).toBe('T');
  });

  it('creates its own InMemoryEventBus when none is provided', async () => {
    const publisher = new ExecutionEventPublisher();
    await expect(
      publisher.publish('execution.plan.started', { planId: 'plan_1' }),
    ).resolves.toBeUndefined();
  });

  it('logs and swallows synchronous publish failures', async () => {
    const bus = {
      publish: vi.fn().mockImplementation(() => {
        throw new Error('bus down');
      }),
    };
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const publisher = new ExecutionEventPublisher(bus as never);
    await expect(publisher.publish('x', {})).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('publishPlanCreated forwards planId and title', async () => {
    const bus = makeEventBus();
    const publisher = new ExecutionEventPublisher(bus as never);
    publisher.publishPlanCreated('plan_1', 'My Plan');
    await vi.waitFor(() => expect(bus.publish).toHaveBeenCalled());
    const [envelope] = bus.publish.mock.calls[0] as [Record<string, unknown>];
    expect(envelope.type).toBe('execution.plan.created');
    expect(envelope.data).toMatchObject({ planId: 'plan_1', title: 'My Plan' });
  });

  it('publishPlanStarted forwards planId', async () => {
    const bus = makeEventBus();
    const publisher = new ExecutionEventPublisher(bus as never);
    publisher.publishPlanStarted('plan_1');
    await vi.waitFor(() => expect(bus.publish).toHaveBeenCalled());
    const [envelope] = bus.publish.mock.calls[0] as [Record<string, unknown>];
    expect(envelope.type).toBe('execution.plan.started');
    expect(envelope.data).toMatchObject({ planId: 'plan_1' });
  });

  it('publishPlanCompleted forwards result', async () => {
    const bus = makeEventBus();
    const publisher = new ExecutionEventPublisher(bus as never);
    publisher.publishPlanCompleted('plan_1', 'success');
    await vi.waitFor(() => expect(bus.publish).toHaveBeenCalled());
    const [envelope] = bus.publish.mock.calls[0] as [Record<string, unknown>];
    expect(envelope.type).toBe('execution.plan.completed');
    expect(envelope.data).toMatchObject({ planId: 'plan_1', result: 'success' });
  });

  it('publishPlanFailed forwards reason', async () => {
    const bus = makeEventBus();
    const publisher = new ExecutionEventPublisher(bus as never);
    publisher.publishPlanFailed('plan_1', 'timeout');
    await vi.waitFor(() => expect(bus.publish).toHaveBeenCalled());
    const [envelope] = bus.publish.mock.calls[0] as [Record<string, unknown>];
    expect(envelope.type).toBe('execution.plan.failed');
    expect(envelope.data).toMatchObject({ planId: 'plan_1', reason: 'timeout' });
  });

  it('publishTaskCompleted forwards taskId and result', async () => {
    const bus = makeEventBus();
    const publisher = new ExecutionEventPublisher(bus as never);
    publisher.publishTaskCompleted('plan_1', 'task_1', 'success');
    await vi.waitFor(() => expect(bus.publish).toHaveBeenCalled());
    const [envelope] = bus.publish.mock.calls[0] as [Record<string, unknown>];
    expect(envelope.type).toBe('execution.task.completed');
    expect(envelope.data).toMatchObject({ planId: 'plan_1', taskId: 'task_1', result: 'success' });
  });

  it('publishRecoveryInitiated forwards planId', async () => {
    const bus = makeEventBus();
    const publisher = new ExecutionEventPublisher(bus as never);
    publisher.publishRecoveryInitiated('plan_1');
    await vi.waitFor(() => expect(bus.publish).toHaveBeenCalled());
    const [envelope] = bus.publish.mock.calls[0] as [Record<string, unknown>];
    expect(envelope.type).toBe('execution.recovery.initiated');
    expect(envelope.data).toMatchObject({ planId: 'plan_1' });
  });

  it('publishProgressTracked forwards completed and total', async () => {
    const bus = makeEventBus();
    const publisher = new ExecutionEventPublisher(bus as never);
    publisher.publishProgressTracked('plan_1', 3, 10);
    await vi.waitFor(() => expect(bus.publish).toHaveBeenCalled());
    const [envelope] = bus.publish.mock.calls[0] as [Record<string, unknown>];
    expect(envelope.type).toBe('execution.progress.tracked');
    expect(envelope.data).toMatchObject({ planId: 'plan_1', completed: 3, total: 10 });
  });
});

import { logger, createEvent } from '@vedmoulya/core';
import type { InMemoryEventBus } from '@vedmoulya/core';
import { InMemoryEventBus as InternalEventBus } from '@vedmoulya/core';

export class ExecutionEventPublisher {
  private readonly eventBus: InMemoryEventBus;

  constructor(eventBus?: InMemoryEventBus) {
    this.eventBus = eventBus ?? new InternalEventBus();
  }

  /** Publish a plan event to the in-memory event bus */
  async publish(eventType: string, payload: Record<string, unknown>): Promise<void> {
    try {
      const event = createEvent(eventType, 'execution', payload, crypto.randomUUID());
      await this.eventBus.publish(event);
      logger.debug('Execution event published', { eventType, payload });
    } catch (error) {
      logger.error('Failed to publish execution event', {
        eventType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Publish a plan created event */
  publishPlanCreated(planId: string, title: string): void {
    void this.publish('execution.plan.created', { planId, title });
  }

  /** Publish a plan started event */
  publishPlanStarted(planId: string): void {
    void this.publish('execution.plan.started', { planId });
  }

  /** Publish a plan completed event */
  publishPlanCompleted(planId: string, result: string): void {
    void this.publish('execution.plan.completed', { planId, result });
  }

  /** Publish a plan failed event */
  publishPlanFailed(planId: string, reason: string): void {
    void this.publish('execution.plan.failed', { planId, reason });
  }

  /** Publish a task completed event */
  publishTaskCompleted(planId: string, taskId: string, result: string): void {
    void this.publish('execution.task.completed', { planId, taskId, result });
  }

  /** Publish a recovery event */
  publishRecoveryInitiated(planId: string): void {
    void this.publish('execution.recovery.initiated', { planId });
  }

  /** Publish a progress tracking event */
  publishProgressTracked(planId: string, completed: number, total: number): void {
    void this.publish('execution.progress.tracked', { planId, completed, total });
  }
}

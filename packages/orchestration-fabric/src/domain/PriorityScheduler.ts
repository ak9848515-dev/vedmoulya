// ──────────────────────────────────────────────────────────────────
// VedMoulya — Orchestration Fabric: Priority Scheduler
// SPRINT-093 — Intelligent Request Queuing + Concurrency Control
//
// Bounded priority queue with fair scheduling:
// - Higher priority runs first
// - Lower priority work is NOT permanently starved (fairness promotion)
// - Capacity limits provide backpressure
// - Delayed/scheduled work is held until eligible
// - Expired work is auto-cancelled
// ──────────────────────────────────────────────────────────────────

import type { WorkItem } from '../types/work-item.js';
import { WORK_PRIORITIES } from '../types/work-item.js';
import type {
  QueueEntry,
  PriorityQueueConfig,
  QueueState,
  DequeueResult,
} from '../types/priority-queue.js';
import { DEFAULT_PRIORITY_QUEUE_CONFIG } from '../types/priority-queue.js';

export class PriorityScheduler {
  private readonly entries: QueueEntry[] = [];
  private readonly workItemIndex = new Map<string, WorkItem>();
  private totalEnqueued = 0;
  private totalDequeued = 0;
  private totalDropped = 0;
  private totalExpired = 0;
  private totalPromoted = 0;
  private positionCounter = 0;
  private readonly config: PriorityQueueConfig;

  constructor(config?: Partial<PriorityQueueConfig>) {
    this.config = { ...DEFAULT_PRIORITY_QUEUE_CONFIG, ...config };
  }

  /**
   * Enqueue a work item into the priority queue.
   * Returns false if the queue is at capacity (backpressure).
   */
  enqueue(workItem: WorkItem): boolean {
    // Check capacity
    if (this.config.maxCapacity > 0 && this.entries.length >= this.config.maxCapacity) {
      // Check if we can drop a lower-priority item
      const lowestPriority = this.findLowestPriorityEntry();
      if (lowestPriority && WORK_PRIORITIES[workItem.priority] > lowestPriority.priorityValue) {
        this.removeEntry(lowestPriority.workItemId);
        this.totalDropped++;
      } else {
        this.totalDropped++;
        return false;
      }
    }

    const now = new Date().toISOString();
    const entry: QueueEntry = {
      workItemId: workItem.id,
      priority: workItem.priority,
      priorityValue: WORK_PRIORITIES[workItem.priority],
      enqueuedAt: now,
      eligibleAt: workItem.eligibleAt ?? now,
      position: ++this.positionCounter,
      waitCount: 0,
    };

    this.entries.push(entry);
    this.workItemIndex.set(workItem.id, workItem);
    this.totalEnqueued++;

    // Sort entries by priority (descending), then by position (ascending for FIFO within same priority)
    this.sortEntries();

    return true;
  }

  /**
   * Dequeue work items that are eligible for execution.
   * Respects batch size, capacity, and eligibility.
   */
  dequeue(batchSize?: number): DequeueResult {
    const batch = batchSize ?? this.config.batchSize;
    const now = new Date();
    const dequeued: WorkItem[] = [];
    const expired: string[] = [];
    const promoted: string[] = [];

    // First, handle expired items
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i];
      const workItem = this.workItemIndex.get(entry.workItemId);
      if (workItem?.expiresAt && new Date(workItem.expiresAt) < now) {
        expired.push(entry.workItemId);
        this.entries.splice(i, 1);
        this.workItemIndex.delete(entry.workItemId);
        this.totalExpired++;
      }
    }

    // Handle fairness promotion
    if (this.config.enableFairness) {
      for (const entry of this.entries) {
        entry.waitCount++;
        if (entry.waitCount >= this.config.fairnessPromotionThreshold) {
          // Promote by increasing priority value
          const oldPriority = entry.priorityValue;
          entry.priorityValue = Math.min(entry.priorityValue + 10, 100);
          if (entry.priorityValue !== oldPriority) {
            promoted.push(entry.workItemId);
            this.totalPromoted++;
          }
        }
      }
      // Re-sort after promotions
      this.sortEntries();
    }

    // Dequeue eligible items
    const toRemove: string[] = [];
    for (const entry of this.entries) {
      if (dequeued.length >= batch) break;

      const eligibleAt = new Date(entry.eligibleAt);
      if (eligibleAt > now) continue; // Not yet eligible (scheduled/delayed)

      const workItem = this.workItemIndex.get(entry.workItemId);
      if (!workItem) continue;

      // Skip if already running/completed/failed/cancelled
      if (['running', 'completed', 'failed', 'cancelled', 'expired'].includes(workItem.status)) {
        continue;
      }

      dequeued.push(workItem);
      toRemove.push(entry.workItemId);
      this.totalDequeued++;
    }

    // Remove dequeued entries
    for (const id of toRemove) {
      this.removeEntry(id);
      this.workItemIndex.delete(id);
    }

    return {
      dequeued,
      expired,
      promoted,
      remainingDepth: this.entries.length,
    };
  }

  /**
   * Peek at the top items without dequeuing.
   */
  peek(count: number = 10): WorkItem[] {
    const result: WorkItem[] = [];
    const now = new Date();
    for (const entry of this.entries) {
      if (result.length >= count) break;
      if (new Date(entry.eligibleAt) > now) continue;
      const workItem = this.workItemIndex.get(entry.workItemId);
      if (workItem && !['running', 'completed', 'failed', 'cancelled'].includes(workItem.status)) {
        result.push(workItem);
      }
    }
    return result;
  }

  /**
   * Remove a specific work item from the queue (for cancellation).
   */
  remove(workItemId: string): boolean {
    const found = this.removeEntry(workItemId);
    if (found) this.workItemIndex.delete(workItemId);
    return found;
  }

  /**
   * Get the current queue state.
   */
  getState(): QueueState {
    return {
      entries: [...this.entries],
      totalEnqueued: this.totalEnqueued,
      totalDequeued: this.totalDequeued,
      totalDropped: this.totalDropped,
      totalExpired: this.totalExpired,
      totalPromoted: this.totalPromoted,
      depth: this.entries.length,
      isAtCapacity: this.config.maxCapacity > 0 && this.entries.length >= this.config.maxCapacity,
      snapshotAt: new Date().toISOString(),
    };
  }

  /**
   * Get the number of items in the queue.
   */
  get depth(): number {
    return this.entries.length;
  }

  /**
   * Check if the queue is empty.
   */
  get isEmpty(): boolean {
    return this.entries.length === 0;
  }

  /**
   * Clear all entries (for testing).
   */
  clear(): void {
    this.entries.length = 0;
    this.workItemIndex.clear();
    this.totalEnqueued = 0;
    this.totalDequeued = 0;
    this.totalDropped = 0;
    this.totalExpired = 0;
    this.totalPromoted = 0;
  }

  // ── Private Methods ─────────────────────────────────────────────────────

  private sortEntries(): void {
    this.entries.sort((a, b) => {
      // Higher priority first
      if (b.priorityValue !== a.priorityValue) {
        return b.priorityValue - a.priorityValue;
      }
      // Same priority: FIFO by position
      return a.position - b.position;
    });
  }

  private findLowestPriorityEntry(): QueueEntry | undefined {
    if (this.entries.length === 0) return undefined;
    return this.entries[this.entries.length - 1];
  }

  private removeEntry(workItemId: string): boolean {
    const index = this.entries.findIndex((e) => e.workItemId === workItemId);
    if (index >= 0) {
      this.entries.splice(index, 1);
      return true;
    }
    return false;
  }
}

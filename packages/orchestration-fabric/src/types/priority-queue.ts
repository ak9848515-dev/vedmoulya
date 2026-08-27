// ──────────────────────────────────────────────────────────────────
// VedMoulya — Orchestration Fabric: Priority Queue
// SPRINT-093 — Intelligent Request Queuing + Concurrency Control
//
// The PriorityQueue is a bounded scheduling mechanism that supports:
// - Priority-based ordering (higher priority runs first)
// - Fair scheduling (lower priority work is not permanently starved)
// - Capacity limits (backpressure when queue is full)
// - Delayed/scheduled work (eligibleAt timestamps)
// - Work expiration (items that exceed their deadline are auto-cancelled)
// ──────────────────────────────────────────────────────────────────

import type { WorkItem, WorkPriority } from './work-item.js';

// ── Queue Entry ───────────────────────────────────────────────────────────

export interface QueueEntry {
  /** Reference to the work item. */
  workItemId: string;

  /** Priority at time of enqueue (snapshot for ordering). */
  priority: WorkPriority;

  /** Numeric priority value. */
  priorityValue: number;

  /** ISO timestamp when the entry was enqueued. */
  enqueuedAt: string;

  /** ISO timestamp when the entry is eligible to be dequeued. */
  eligibleAt: string;

  /** Position in the queue (for ordering). */
  position: number;

  /** Fairness counter — incremented when higher-priority work preempts this entry. */
  waitCount: number;
}

// ── Queue Configuration ───────────────────────────────────────────────────

export interface PriorityQueueConfig {
  /** Maximum number of entries in the queue. 0 = unlimited. */
  maxCapacity: number;

  /** Maximum wait time in ms before a low-priority item gets promoted. */
  maxWaitTimeMs: number;

  /** Whether to enable fairness promotion. */
  enableFairness: boolean;

  /** Fairness promotion threshold — items waiting this many cycles get promoted. */
  fairnessPromotionThreshold: number;

  /** Maximum items to dequeue per tick. */
  batchSize: number;
}

export const DEFAULT_PRIORITY_QUEUE_CONFIG: PriorityQueueConfig = {
  maxCapacity: 1000,
  maxWaitTimeMs: 300000, // 5 minutes
  enableFairness: true,
  fairnessPromotionThreshold: 3,
  batchSize: 10,
};

// ── Queue State ───────────────────────────────────────────────────────────

export interface QueueState {
  /** Current queue entries (sorted by priority). */
  entries: QueueEntry[];

  /** Total items enqueued since creation. */
  totalEnqueued: number;

  /** Total items dequeued since creation. */
  totalDequeued: number;

  /** Total items dropped due to capacity. */
  totalDropped: number;

  /** Total items expired. */
  totalExpired: number;

  /** Total items promoted by fairness. */
  totalPromoted: number;

  /** Current queue depth. */
  depth: number;

  /** Whether the queue is at capacity. */
  isAtCapacity: boolean;

  /** Timestamp of this snapshot. */
  snapshotAt: string;
}

// ── Dequeue Result ────────────────────────────────────────────────────────

export interface DequeueResult {
  /** Work items that were dequeued (ready for execution). */
  dequeued: WorkItem[];

  /** Items that were expired and cancelled. */
  expired: string[];

  /** Items that were promoted by fairness. */
  promoted: string[];

  /** Current queue depth after dequeue. */
  remainingDepth: number;
}

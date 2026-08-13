// ──────────────────────────────────────────────────────────────────
// VedMoulya — InMemoryDiscoveryStore
// EPIC-012C — bounded, owner-scoped discovery store
// Retains at most maxStoredItems (FIFO eviction — discovery can never
// become an unbounded sink). User attention state is keyed by owner —
// items are platform-wide, per-user state is isolated (IDOR-safe by
// construction: state reads only ever key on the caller's own id).
// ──────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/require-await -- In-memory store implements
   the Promise-returning DiscoveryStore port with synchronous Map bodies; the
   `async` markers are required for interface conformance. */

import type {
  DiscoveryItem,
  DiscoveryItemAction,
  DiscoveryUserState,
} from '../types/discovery-types.js';
import type { DiscoveryStore } from '../domain/DiscoveryStore.js';

export interface InMemoryDiscoveryStoreOptions {
  maxStoredItems?: number;
}

const DEFAULT_MAX_STORED_ITEMS = 300;

export class InMemoryDiscoveryStore implements DiscoveryStore {
  private readonly maxStoredItems: number;
  private items: DiscoveryItem[] = [];
  /** ownerId → itemId → user state */
  private readonly userState = new Map<string, Map<string, DiscoveryUserState>>();

  constructor(options: InMemoryDiscoveryStoreOptions = {}) {
    this.maxStoredItems = options.maxStoredItems ?? DEFAULT_MAX_STORED_ITEMS;
  }

  async listItems(): Promise<DiscoveryItem[]> {
    return [...this.items];
  }

  async getItem(itemId: string): Promise<DiscoveryItem | undefined> {
    return this.items.find((item) => item.id === itemId);
  }

  async addItems(newItems: DiscoveryItem[]): Promise<number> {
    const existing = new Set(this.items.map((item) => item.id));
    const added = newItems.filter((item) => !existing.has(item.id));
    this.items = [...this.items, ...added];
    // Bounded retention: FIFO eviction of the oldest items.
    if (this.items.length > this.maxStoredItems) {
      this.items = this.items.slice(-this.maxStoredItems);
    }
    return added.length;
  }

  async getUserState(userId: string, itemId: string): Promise<DiscoveryUserState> {
    const ownerState = this.userState.get(userId) ?? new Map<string, DiscoveryUserState>();
    return ownerState.get(itemId) ?? { read: false, action: 'none' };
  }

  async markRead(userId: string, itemId: string): Promise<void> {
    const ownerState = this.userState.get(userId) ?? new Map<string, DiscoveryUserState>();
    const current = ownerState.get(itemId) ?? { read: false, action: 'none' as const };
    ownerState.set(itemId, { ...current, read: true });
    this.userState.set(userId, ownerState);
  }

  async setAction(userId: string, itemId: string, action: DiscoveryItemAction): Promise<void> {
    const ownerState = this.userState.get(userId) ?? new Map<string, DiscoveryUserState>();
    const current = ownerState.get(itemId) ?? { read: false, action: 'none' as const };
    ownerState.set(itemId, { ...current, action });
    this.userState.set(userId, ownerState);
  }
}

// ──────────────────────────────────────────────────────────────────
// VedMoulya — DiscoveryStore port
// EPIC-012C — bounded, owner-scoped discovery persistence
// ──────────────────────────────────────────────────────────────────

import type {
  DiscoveryItem,
  DiscoveryItemAction,
  DiscoveryUserState,
} from '../types/discovery-types.js';

export interface DiscoveryStore {
  /** All retained items (bounded by budget.maxStoredItems). */
  listItems(): Promise<DiscoveryItem[]>;
  /** Item by stable id (undefined when not retained). */
  getItem(itemId: string): Promise<DiscoveryItem | undefined>;
  /** Add newly discovered items (dedup already applied by caller). */
  addItems(items: DiscoveryItem[]): Promise<number>;
  /** Owner-scoped read state. */
  getUserState(userId: string, itemId: string): Promise<DiscoveryUserState>;
  /** Mark an item read for a user. */
  markRead(userId: string, itemId: string): Promise<void>;
  /** Owner-scoped action (watch / dismiss / none). */
  setAction(userId: string, itemId: string, action: DiscoveryItemAction): Promise<void>;
}

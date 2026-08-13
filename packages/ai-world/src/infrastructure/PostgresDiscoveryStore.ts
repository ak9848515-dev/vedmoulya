// ──────────────────────────────────────────────────────────────────
// VedMoulya — PostgresDiscoveryStore
// SPRINT-022 — Persistent Intelligence Foundation
//
// Production persistence for the EPIC-012C DiscoveryStore (the AI World
// store). Unlike the sync EPIC-016/017/018/020 store ports, this port is
// ALREADY asynchronous, so it maps 1:1 onto Postgres — no mirror needed.
//
// Schema (two owner-isolated tables):
//   • ai_world_discovery_items      — platform-wide catalog, keyed by
//     stable item id, bounded retention (300, FIFO by discovery order);
//   • ai_world_discovery_user_state — per-user attention state, keyed
//     (user_id, item_id) — IDOR-safe by construction: reads/writes only
//     ever key on the caller's own user id.
// Every write is parameterized; addItems is an idempotent upsert
// (ON CONFLICT DO NOTHING) — restart NEVER duplicates discovery items.
// ──────────────────────────────────────────────────────────────────

import type postgres from 'postgres';
import type {
  DiscoveryItem,
  DiscoveryItemAction,
  DiscoveryUserState,
} from '../types/discovery-types.js';
import type { DiscoveryStore } from '../domain/DiscoveryStore.js';

/** postgres.js's json() parameter type (not exported by the driver). */
type JsonParam = Parameters<postgres.Sql['json']>[0];

interface ItemRow {
  item_id: string;
  item: string;
}

interface UserStateRow {
  user_id: string;
  item_id: string;
  state: string;
}

export interface PostgresDiscoveryStoreOptions {
  maxStoredItems?: number;
}

const DEFAULT_MAX_STORED_ITEMS = 300;

export class PostgresDiscoveryStore implements DiscoveryStore {
  private readonly sql: postgres.Sql;
  private readonly itemsTable: string;
  private readonly userStateTable: string;
  private readonly maxStoredItems: number;

  constructor(
    sql: postgres.Sql,
    options: PostgresDiscoveryStoreOptions = {},
    itemsTable = 'ai_world_discovery_items',
    userStateTable = 'ai_world_discovery_user_state',
  ) {
    this.sql = sql;
    this.itemsTable = itemsTable;
    this.userStateTable = userStateTable;
    this.maxStoredItems = options.maxStoredItems ?? DEFAULT_MAX_STORED_ITEMS;
  }

  /**
   * No-op hydration: this store reads straight from Postgres (it has no
   * synchronous mirror, unlike the write-through stores). Present so the
   * gateway persistence bundle can treat every store uniformly at boot.
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- no-op by design (fully async store)
  async hydrate(): Promise<number> {
    return 0;
  }

  /**
   * No-op flush: every write is already awaited at the port boundary
   * (this port is fully async). Present for uniform bundle shutdown.
   */
  async flush(): Promise<void> {
    // No pending writes exist by construction.
  }

  /** Ensure both tables exist (idempotent — safe every startup). */
  async ensureTable(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS ${this.sql(this.itemsTable)} (
        item_id TEXT PRIMARY KEY,
        item JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await this.sql`
      CREATE INDEX IF NOT EXISTS ${this.sql(`${this.itemsTable}_created_idx`)}
      ON ${this.sql(this.itemsTable)} (created_at)
    `;
    await this.sql`
      CREATE TABLE IF NOT EXISTS ${this.sql(this.userStateTable)} (
        user_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        state JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, item_id)
      )
    `;
  }

  async listItems(): Promise<DiscoveryItem[]> {
    const rows = await this.sql<ItemRow[]>`
      SELECT item_id, item::text AS item
      FROM ${this.sql(this.itemsTable)}
      ORDER BY created_at ASC
    `;
    return rows.map((row) => JSON.parse(row.item) as DiscoveryItem);
  }

  async getItem(itemId: string): Promise<DiscoveryItem | undefined> {
    const rows = await this.sql<ItemRow[]>`
      SELECT item_id, item::text AS item
      FROM ${this.sql(this.itemsTable)}
      WHERE item_id = ${itemId}
    `;
    const row = rows[0];
    return row ? (JSON.parse(row.item) as DiscoveryItem) : undefined;
  }

  async addItems(newItems: DiscoveryItem[]): Promise<number> {
    if (newItems.length === 0) return 0;
    // Count only NEW items (parity with InMemoryDiscoveryStore.addItems):
    // the per-insert result count is EXACTLY the rows actually added
    // (ON CONFLICT DO NOTHING reports 0 for skipped ids), so the sum is
    // correct even under concurrent addItems calls. Inserts stay
    // idempotent — restart never duplicates.
    let inserted = 0;
    for (const item of newItems) {
      // postgres.js exposes the affected-row count on the RESULT (not as a
      // row generic) — 0 for conflict-skipped ids, exactly what we count.
      // The doc binds via sql.json(item): serializes once (jsonb OID 3802) —
      // JSON.stringify+::jsonb would DOUBLE-encode (real-DB regression).
      const result = await this.sql`
        INSERT INTO ${this.sql(this.itemsTable)} (item_id, item)
        VALUES (${item.id}, ${this.sql.json(item as unknown as JsonParam)})
        ON CONFLICT (item_id) DO NOTHING
      `;
      inserted += result.count;
    }
    // Bounded retention: FIFO eviction of the oldest items beyond the cap.
    await this.sql`
      DELETE FROM ${this.sql(this.itemsTable)}
      WHERE item_id IN (
        SELECT item_id FROM ${this.sql(this.itemsTable)}
        ORDER BY created_at DESC
        OFFSET ${this.maxStoredItems}
      )
    `;
    return inserted;
  }

  async getUserState(userId: string, itemId: string): Promise<DiscoveryUserState> {
    const rows = await this.sql<UserStateRow[]>`
      SELECT user_id, item_id, state::text AS state
      FROM ${this.sql(this.userStateTable)}
      WHERE user_id = ${userId} AND item_id = ${itemId}
    `;
    const row = rows[0];
    return row
      ? (JSON.parse(row.state) as DiscoveryUserState)
      : { read: false, action: 'none' as const };
  }

  async markRead(userId: string, itemId: string): Promise<void> {
    const current = await this.getUserState(userId, itemId);
    await this.upsertUserState(userId, itemId, { ...current, read: true });
  }

  async setAction(userId: string, itemId: string, action: DiscoveryItemAction): Promise<void> {
    const current = await this.getUserState(userId, itemId);
    await this.upsertUserState(userId, itemId, { ...current, action });
  }

  private async upsertUserState(
    userId: string,
    itemId: string,
    state: DiscoveryUserState,
  ): Promise<void> {
    await this.sql`
      INSERT INTO ${this.sql(this.userStateTable)} (user_id, item_id, state)
      VALUES (${userId}, ${itemId}, ${this.sql.json(state as unknown as JsonParam)})
      ON CONFLICT (user_id, item_id) DO UPDATE SET
        state = EXCLUDED.state,
        updated_at = now()
    `;
  }
}

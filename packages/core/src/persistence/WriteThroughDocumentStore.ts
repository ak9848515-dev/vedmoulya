// ──────────────────────────────────────────────────────────────────
// VedMoulya — @vedmoulya/core — WriteThroughDocumentStore
// SPRINT-022 — Persistent Intelligence Foundation
//
// Base class for the owner-scoped intelligence stores whose ports are
// SYNCHRONOUS (save(): void — the frozen EPIC-016/017/018/020 store
// contracts). Persisting them must NOT change the domain contract, so
// this base:
//   1. keeps the authoritative in-memory mirror the sync port reads and
//      writes (reads never touch the database — zero latency regression);
//   2. writes EVERY change through to Postgres asynchronously — one
//      idempotent parameterized upsert (or delete), error-isolated so a
//      single failed write never throws into a caller or crashes a pass;
//   3. hydrates the mirror from Postgres at boot (hydrate());
//   4. drains any pending writes at shutdown (flush()).
//
// Storage is one generic JSONB table per store:
//     (owner TEXT, key TEXT, doc JSONB, created_at, updated_at)
// with PRIMARY KEY (owner, key). Owner isolation is enforced BY THE
// QUERY — a foreign owner can never address another user's rows. Every
// write is parameterized (no string interpolation of values) — SQL
// injection is impossible by construction. Documents are plain
// structured data only: decisions, evidence references, outcomes,
// timestamps, provenance. NEVER secrets, API keys, OAuth tokens or
// chain-of-thought (enforced by the store contracts, documented in
// SPRINT_022_PERSISTENCE_SECURITY.md).
// ──────────────────────────────────────────────────────────────────

import type postgres from 'postgres';
import { logger } from '../logger/index.js';

/** postgres.js's json() parameter type (not exported by the driver). */
type JsonParam = Parameters<postgres.Sql['json']>[0];

/** Bounded write queue: beyond this, the oldest pending write is dropped
 *  (logged once) so a long database outage can never grow memory without
 *  bound. The authoritative mirror still serves every read — this only
 *  affects restart durability, which is exactly what the log warns about. */
const MAX_PENDING_WRITES = 5_000;

interface PendingWrite {
  owner: string;
  key: string;
  doc: unknown;
}

interface PendingDelete {
  owner: string;
  key: string;
}

/** Safe error text for logs — never the document contents. */
function safeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Write-through Postgres store base for sync owner-scoped store ports.
 * Subclasses define the port's key mapping (how (owner, key) is derived
 * from the domain record) and optional bounded-retention pruning.
 */
export abstract class WriteThroughDocumentStore<TDoc extends object> {
  /** Authoritative synchronous mirror (owner\u0000key → latest document). */
  protected readonly mirror = new Map<string, TDoc>();
  private readonly pendingWrites = new Map<string, PendingWrite>();
  private readonly pendingDeletes = new Map<string, PendingDelete>();
  private draining = false;
  private drainPromise: Promise<void> | undefined;
  private evictionWarned = false;
  private readonly sql: postgres.Sql;
  private readonly table: string;

  protected constructor(sql: postgres.Sql, table: string) {
    this.sql = sql;
    this.table = table;
  }

  /** Owner+key separator inside the mirror map (never appears in data). */
  protected keyOf(owner: string, key: string): string {
    return `${owner}\u0000${key}`;
  }

  /** The store's table name (for diagnostics). */
  protected get tableName(): string {
    return this.table;
  }

  /**
   * Ensure the backing table exists (idempotent — safe on every startup,
   * same convention as every EI engine repository). The table name is a
   * compile-time constant per store; values are always parameterized.
   */
  async ensureTable(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS ${this.sql(this.table)} (
        owner TEXT NOT NULL,
        key TEXT NOT NULL,
        doc JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (owner, key)
      )
    `;
    await this.sql`
      CREATE INDEX IF NOT EXISTS ${this.sql(`${this.table}_owner_updated_idx`)}
      ON ${this.sql(this.table)} (owner, updated_at DESC)
    `;
  }

  /**
   * Load every persisted document into the mirror (called once at boot,
   * before background work starts). Returns the number of rows loaded.
   * After hydration the mirror is authoritative for the synchronous
   * contract and all further writes flow through to Postgres.
   */
  async hydrate(): Promise<number> {
    const rows = await this.sql<Array<{ owner: string; key: string; doc: string }>>`
      SELECT owner, key, doc::text AS doc
      FROM ${this.sql(this.table)}
    `;
    for (const row of rows) {
      try {
        const doc = JSON.parse(row.doc) as TDoc;
        this.mirror.set(this.keyOf(row.owner, row.key), doc);
      } catch (error) {
        // A corrupt row must never prevent the rest from loading.
        logger.warn(`Persistence hydrate: skipped corrupt document in ${this.table}`, {
          error: safeError(error),
        });
      }
    }
    return rows.length;
  }

  /**
   * Drain every pending write/delete to Postgres (called at shutdown).
   * Never throws into the caller: a failure is logged loudly (restart
   * durability is exactly what is lost), and the mirror keeps serving.
   * A persistent outage stops the loop (no-progress break) instead of
   * spinning to the guard — the queue keeps the LATEST state for the next
   * flush (bounded by MAX_PENDING_WRITES).
   */
  async flush(): Promise<void> {
    // Wait for any drain already in flight FIRST — otherwise flush() would
    // see an empty pending queue (drain captured it) and return while the
    // network write is still committing, letting a subsequent hydrate read
    // stale state (real-DB restart-recovery regression). Then drain whatever
    // remains, stopping on a zero-progress pass (persistent outage — the
    // queue keeps the LATEST state for the next flush, bounded by
    // MAX_PENDING_WRITES).
    if (this.drainPromise) await this.drainPromise;
    let guard = 0;
    while ((this.pendingWrites.size > 0 || this.pendingDeletes.size > 0) && guard < 100) {
      guard += 1;
      if (!(await this.drainOnce())) break;
    }
  }

  // ── Mirror accessors (subclass-facing) ─────────────────────────────
  // Named read/write/remove/all — deliberately distinct from the store
  // port method names (get/save/list/…) so subclasses never accidentally
  // override a base accessor and never need the `override` modifier.

  /** Write-through write: mirror + async upsert (returns the stored doc). */
  protected write(owner: string, key: string, doc: TDoc): TDoc {
    this.mirror.set(this.keyOf(owner, key), structuredClone(doc));
    const pendingKey = this.keyOf(owner, key);
    this.pendingWrites.set(pendingKey, { owner, key, doc: structuredClone(doc) });
    this.pendingDeletes.delete(pendingKey); // a write supersedes a pending delete
    if (this.pendingWrites.size > MAX_PENDING_WRITES) {
      const oldest = this.pendingWrites.keys().next().value;
      if (oldest !== undefined) this.pendingWrites.delete(oldest);
      if (!this.evictionWarned) {
        this.evictionWarned = true;
        logger.error(
          `Persistence write queue overflow in ${this.table} — oldest pending write dropped`,
          {},
        );
      }
    }
    void this.drain();
    return doc;
  }

  /** Mirror read (clone — callers can never mutate stored state). */
  protected read(owner: string, key: string): TDoc | undefined {
    const found = this.mirror.get(this.keyOf(owner, key));
    return found ? structuredClone(found) : undefined;
  }

  /** All documents for one owner (unsorted mirror snapshot, cloned). */
  protected all(owner: string): TDoc[] {
    const prefix = `${owner}\u0000`;
    const result: TDoc[] = [];
    for (const [key, doc] of this.mirror) {
      if (key.startsWith(prefix)) result.push(structuredClone(doc));
    }
    return result;
  }

  /** Remove from the mirror + schedule the database delete. */
  protected remove(owner: string, key: string): void {
    const pendingKey = this.keyOf(owner, key);
    this.mirror.delete(pendingKey);
    this.pendingWrites.delete(pendingKey); // a delete supersedes a pending write
    this.pendingDeletes.set(pendingKey, { owner, key });
    void this.drain();
  }

  /**
   * Bounded FIFO retention (mirror + database): keep at most `limit`
   * documents per owner, evicting the oldest by `timestampOf`. Matches
   * the in-memory stores' documented retention (never an unbounded sink).
   */
  protected prune(
    owner: string,
    limit: number,
    timestampOf: (doc: TDoc) => string,
    keyOfDoc: (doc: TDoc) => string,
  ): void {
    const owned = this.all(owner);
    if (owned.length <= limit) return;
    const sorted = [...owned].sort(
      (a, b) => Date.parse(timestampOf(a)) - Date.parse(timestampOf(b)),
    );
    const excess = sorted.length - limit;
    for (const evicted of sorted.slice(0, excess)) {
      this.remove(owner, keyOfDoc(evicted));
    }
  }

  /**
   * Grouped FIFO retention for stores whose per-owner state is keyed by a
   * secondary group (e.g. Brain decisions keyed by task within a user):
   * keep at most `limit` documents per group.
   */
  protected pruneGrouped(
    owner: string,
    groupOf: (doc: TDoc) => string,
    limit: number,
    timestampOf: (doc: TDoc) => string,
    keyOfDoc: (doc: TDoc) => string,
  ): void {
    const groups = new Map<string, TDoc[]>();
    for (const doc of this.all(owner)) {
      const group = groupOf(doc);
      const list = groups.get(group) ?? [];
      list.push(doc);
      groups.set(group, list);
    }
    for (const list of groups.values()) {
      if (list.length <= limit) continue;
      const sorted = [...list].sort(
        (a, b) => Date.parse(timestampOf(a)) - Date.parse(timestampOf(b)),
      );
      for (const evicted of sorted.slice(0, list.length - limit)) {
        this.remove(owner, keyOfDoc(evicted));
      }
    }
  }

  // ── Async drain machinery ──────────────────────────────────────────

  private drain(): Promise<void> {
    // ONE shared drain at a time: concurrent write()/remove() calls join the
    // in-flight drain (the promise is returned) instead of starting a second
    // one. flush() awaits this promise so a shutdown flush never races a
    // drain that already captured the batch.
    if (this.drainPromise) return this.drainPromise;
    this.draining = true;
    const promise = (async (): Promise<void> => {
      try {
        // Yield to the microtask queue first so every synchronous mutation in
        // the current tick coalesces into ONE batch before the capture — the
        // (owner, key) dedup then works as documented (latest version wins).
        await Promise.resolve();
        // Loop until quiescent so writes that land WHILE a drain is awaiting
        // SQL are picked up too (a single shot would leave them pending until
        // the next mutation or the shutdown flush — a durability gap in normal
        // operation). A zero-progress pass means a persistent outage: fail
        // loudly once and stop (the mirror keeps serving; the next write or
        // shutdown flush retries — bounded by MAX_PENDING_WRITES).
        while (this.pendingWrites.size > 0 || this.pendingDeletes.size > 0) {
          if (!(await this.drainOnce())) break;
        }
      } finally {
        this.draining = false;
        this.drainPromise = undefined;
      }
    })();
    this.drainPromise = promise;
    return promise;
  }

  /**
   * Persist every queued item captured at the START of the pass, re-queuing
   * anything the database rejected. Returns whether ANY item completed — the
   * drain/flush loops continue while there is progress and stop on a
   * zero-progress pass (persistent outage). Writes run before deletes (a
   * write never races a pending delete of the same key because set()/remove()
   * supersede each other).
   */
  private async drainOnce(): Promise<boolean> {
    let completed = 0;
    if (this.pendingWrites.size > 0) {
      const batch = [...this.pendingWrites.values()];
      this.pendingWrites.clear();
      for (const item of batch) {
        try {
          await this.writeThroughUpsert(item.owner, item.key, item.doc as TDoc);
          completed += 1;
        } catch (error) {
          // Database unavailable — keep the LATEST version queued (bounded)
          // and log loudly. Never throw into the caller; the mirror already
          // served the write, so the process keeps working.
          this.pendingWrites.set(this.keyOf(item.owner, item.key), item);
          logger.warn(`Persistence write-through failed for ${this.table} (queued for retry)`, {
            error: safeError(error),
          });
        }
      }
    }
    if (this.pendingDeletes.size > 0) {
      const batch = [...this.pendingDeletes.values()];
      this.pendingDeletes.clear();
      for (const item of batch) {
        try {
          await this.writeThroughDelete(item.owner, item.key);
          completed += 1;
        } catch (error) {
          // Re-queue the delete so a later flush retries it.
          this.pendingDeletes.set(this.keyOf(item.owner, item.key), item);
          logger.warn(`Persistence delete failed for ${this.table} (queued for retry)`, {
            error: safeError(error),
          });
        }
      }
    }
    return completed > 0;
  }

  /** Standard idempotent upsert (all values parameterized).
   *  NOTE: these two SQL helpers are deliberately named writeThrough* — a
   *  subclass port method (save/get/list/…) could otherwise shadow the
   *  base implementation (polymorphic dispatch), silently breaking
   *  persistence (regression: Sprint-022 TestStore.deleteDoc). */
  protected async writeThroughUpsert(owner: string, key: string, doc: TDoc): Promise<void> {
    // NOTE: bind via sql.json(doc) — NEVER JSON.stringify(doc) with a `::jsonb`
    // cast. sql.json() serializes the object exactly once (jsonb OID 3802);
    // stringify+cast DOUBLE-encodes it (a real-Postgres restart-recovery
    // regression the hermetic fakes never caught), and the interpolated-object
    // form fails the postgres.js template typing for generic TDoc.
    await this.sql`
      INSERT INTO ${this.sql(this.table)} (owner, key, doc)
      VALUES (${owner}, ${key}, ${this.sql.json(doc as unknown as JsonParam)})
      ON CONFLICT (owner, key) DO UPDATE SET
        doc = EXCLUDED.doc,
        updated_at = now()
    `;
  }

  /** Standard parameterized delete. */
  protected async writeThroughDelete(owner: string, key: string): Promise<void> {
    await this.sql`
      DELETE FROM ${this.sql(this.table)}
      WHERE owner = ${owner} AND key = ${key}
    `;
  }
}

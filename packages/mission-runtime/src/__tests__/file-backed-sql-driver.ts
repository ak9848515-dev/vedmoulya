// ──────────────────────────────────────────────────────────────────
// VedMoulya — FINAL-04 test support: FILE-BACKED SQL DRIVER
//
// WHY THIS EXISTS
// ---------------
// FINAL-04 §11 asks for evidence that a mission really survives a PROCESS
// restart. The strongest form of that evidence is two REAL OS processes
// sharing one DURABLE store — but the production durable store is Postgres,
// which a deterministic test cannot assume. This driver supplies exactly the
// one thing Postgres supplies for these two queries (insert/update/delete +
// "read every row"), on the filesystem, with the SAME call shape postgres.js
// exposes (tagged template + `sql('table')` identifier fragments + sql.json +
// begin()).
//
// WHAT IT IS NOT
// --------------
//   • NOT a production persistence path and NOT an alternative implementation
//     of the mission stores: `PostgresMissionStore` / `PostgresCheckpointStore`
//     / `WriteThroughDocumentStore` are exercised UNCHANGED — only the driver
//     underneath them is replaced, exactly like the hermetic fakes the
//     existing store tests already use.
//   • NOT a second database: it implements ONLY the four statement shapes
//     those classes issue (the same "recorded statement" surface
//     postgres-mission-stores.test.ts asserts against).
//
// DURABILITY CONTRACT
// -------------------
// Every committed statement is written to disk SYNCHRONOUSLY and fsynced
// before the statement promise resolves. A process that is SIGKILLed after a
// commit therefore cannot lose it — which is precisely the property the
// restart test needs to be meaningful.
// ──────────────────────────────────────────────────────────────────

import * as fs from 'node:fs';
import * as path from 'node:path';
import type postgres from 'postgres';

type Sql = postgres.Sql;

/** owner \u0000 key → document (the real table's PRIMARY KEY (owner, key)). */
interface TableRows {
  [ownerKey: string]: unknown;
}
interface StoredDb {
  [table: string]: TableRows;
}

const KEY_SEPARATOR = '\u0000';

/** The call surface the production stores actually use (postgres.js subset). */
type FileBackedDriver = {
  (...args: unknown[]): unknown;
  /** sql.json(value) — a JSON parameter marker (the file stores the value). */
  json: (value: unknown) => unknown;
  /** sql.begin(cb) — the driver offers no isolation; cb gets this connection. */
  begin: (callback: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
  end: () => Promise<void>;
};

export interface FileBackedSql {
  /** The postgres.js-compatible driver the stores are constructed with. */
  sql: Sql;
  /** Every row currently committed to the file (durability evidence). */
  committed(table: string): Array<{ owner: string; key: string; doc: unknown }>;
  /** Raw durable file contents (evidence; never a mutation). */
  raw(): string;
}

function fragmentName(arg: unknown): string | undefined {
  if (typeof arg === 'object' && arg !== null && '__fragment' in arg) {
    return String((arg as { __fragment: unknown }).__fragment);
  }
  return undefined;
}

function jsonPayload(arg: unknown): { value: unknown } | undefined {
  if (typeof arg === 'object' && arg !== null && '__json' in arg) {
    return { value: (arg as { __json: unknown }).__json };
  }
  return undefined;
}

/** The scalar bind parameters of a statement (never fragments/json params). */
function scalars(args: unknown[]): string[] {
  return args.filter((arg): arg is string => typeof arg === 'string');
}

/**
 * Create a driver whose "database" is one JSON file. Statements are
 * interpreted from the query text the production stores really emit.
 */
export function createFileBackedSql(filePath: string): FileBackedSql {
  const read = (): StoredDb => {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
      return typeof parsed === 'object' && parsed !== null ? (parsed as StoredDb) : {};
    } catch {
      return {};
    }
  };

  /** Commit synchronously + fsync so a later SIGKILL can never lose it. */
  const commit = (db: StoredDb): void => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const handle = fs.openSync(filePath, 'w');
    try {
      fs.writeFileSync(handle, JSON.stringify(db), 'utf8');
      fs.fsyncSync(handle);
    } finally {
      fs.closeSync(handle);
    }
  };

  const tableOf = (args: unknown[]): string | undefined =>
    args.map(fragmentName).find((name) => name !== undefined);

  const upsert = (table: string, owner: string, key: string, doc: unknown): void => {
    const db = read();
    const rows = db[table] ?? {};
    rows[`${owner}${KEY_SEPARATOR}${key}`] = doc;
    commit({ ...db, [table]: rows });
  };

  const handler = ((...args: unknown[]) => {
    const [first, ...rest] = args;
    // Plain-call form: sql('table_name') — an identifier fragment the
    // surrounding tagged template merely interpolates.
    if (typeof first === 'string') return { __fragment: first };
    const strings = first as readonly string[];
    const text = strings.join(' ').replace(/\s+/g, ' ').trim().toUpperCase();
    const table = tableOf(rest);
    if (table === undefined) return Promise.resolve([]);

    if (text.startsWith('CREATE TABLE') || text.startsWith('CREATE INDEX')) {
      return Promise.resolve([]); // DDL is a no-op for a schemaless file
    }

    if (text.startsWith('SELECT')) {
      const values = scalars(rest);
      const [owner, key] = values;
      const rows = read()[table] ?? {};
      const selected = Object.entries(rows)
        .filter(([ownerKey]) =>
          owner === undefined || key === undefined
            ? true
            : ownerKey === `${owner}${KEY_SEPARATOR}${key}`,
        )
        .map(([ownerKey, doc]) => {
          const [rowOwner = '', rowKey = ''] = ownerKey.split(KEY_SEPARATOR);
          return { owner: rowOwner, key: rowKey, doc: JSON.stringify(doc) };
        });
      return Promise.resolve(selected);
    }

    if (text.startsWith('INSERT INTO') || text.startsWith('UPDATE')) {
      const [owner, key] = scalars(rest);
      const payload = rest.map(jsonPayload).find((candidate) => candidate !== undefined);
      if (owner !== undefined && key !== undefined && payload !== undefined) {
        upsert(table, owner, key, payload.value);
      }
      return Promise.resolve([]);
    }

    if (text.startsWith('DELETE')) {
      const [owner, key] = scalars(rest);
      if (owner !== undefined && key !== undefined) {
        const db = read();
        const rows = db[table] ?? {};
        delete rows[`${owner}${KEY_SEPARATOR}${key}`];
        commit({ ...db, [table]: rows });
      }
      return Promise.resolve([]);
    }

    return Promise.resolve([]);
  }) as FileBackedDriver;

  handler.json = (value: unknown) => ({ __json: value });
  // Sequential single-process driver: the callback receives the same
  // connection (no real isolation is claimed — cross-process lease races are
  // covered by the operator acceptance run against real Postgres).
  handler.begin = (callback) => Promise.resolve(callback(handler));
  handler.end = () => Promise.resolve();

  return {
    sql: handler as unknown as Sql,
    committed: (table: string) =>
      Object.entries(read()[table] ?? {}).map(([ownerKey, doc]) => {
        const [owner = '', key = ''] = ownerKey.split(KEY_SEPARATOR);
        return { owner, key, doc };
      }),
    raw: () => {
      try {
        return fs.readFileSync(filePath, 'utf8');
      } catch {
        return '';
      }
    },
  };
}

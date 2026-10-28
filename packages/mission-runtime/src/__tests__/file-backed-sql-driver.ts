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

  const rowEntries = (table: string): Array<[string, unknown]> =>
    Object.entries(read()[table] ?? {});

  /**
   * The document a statement with a JSON parameter is about to write (an
   * INSERT/UPDATE carrying `sql.json(...)`) — the only write shape whose
   * content is recoverable from the bind values.
   */
  const payloadDoc = (args: unknown[]): unknown =>
    args.map(jsonPayload).find((candidate) => candidate !== undefined)?.value;

  /**
   * `INSERT … ON CONFLICT … DO UPDATE … WHERE <token matches> OR <expired>` is
   * the workspace lease's atomic acquisition. It is the only conditional upsert
   * the mission runtime issues, and it succeeds only when the existing row is
   * this token's OR already expired.
   */
  const isGuardedUpsert = (sql: string): boolean =>
    /ON CONFLICT/i.test(sql) && /DO UPDATE/i.test(sql) && /WHERE/i.test(sql);

  /** Apply the guarded upsert; returns the committed row, or nothing if refused. */
  const guardedUpsert = (
    table: string,
    owner: string,
    key: string,
    doc: unknown,
    args: unknown[],
  ): unknown[] => {
    const db = read();
    const rows = db[table] ?? {};
    const id = `${owner}${KEY_SEPARATOR}${key}`;
    const existing = rows[id] as { token?: unknown; expiresAt?: unknown } | undefined;
    // `… WHERE token = $` is the first scalar bound after the VALUES document.
    const scalarsAfterDoc = args
      .slice(args.findIndex((arg) => jsonPayload(arg) !== undefined) + 1)
      .filter((arg): arg is string => typeof arg === 'string');
    const token = scalarsAfterDoc[0];
    // `… to_timestamp($nowMs / 1000.0)` binds the acquisition instant.
    const nowMs = args.filter((arg): arg is number => typeof arg === 'number').at(-1);
    const expiresAt = existing?.expiresAt === undefined ? undefined : String(existing.expiresAt);
    const expired = expiresAt === undefined || Date.parse(expiresAt) <= (nowMs ?? Number.NaN);
    const admitted =
      existing === undefined || (token !== undefined && existing.token === token) || expired;
    if (!admitted) return [];
    rows[id] = doc;
    commit({ ...db, [table]: rows });
    return [doc];
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
      const rows = rowEntries(table);
      const doc = payloadDoc(rest);
      // SELECT <json-param> … WHERE owner = $ — resolve the DOCUMENT itself
      // (a guard read on a document field, not a row projection).
      if (doc !== undefined) {
        // Only a `key = $` filter scopes this read to one row; the `token = $`
        // guard does NOT (SQL returns the row with a null projection, above).
        const owner = scalars(rest)[0];
        const stored = rows.find(
          ([id]) => owner !== undefined && id.startsWith(`${owner}${KEY_SEPARATOR}`),
        );
        return Promise.resolve(stored ? [{ doc: JSON.stringify(stored[1]) }] : []);
      }
      const values = scalars(rest);
      // The workspace lease reads only `doc->>'token'`, so a token value is a
      // projected field: `<scalar> AS token`, scoped by the tenant when given.
      // Matched on the fields ONLY: the joined text also contains the
      // `doc::text AS doc` alias the ownership read uses.
      const isTokenProjection = strings.some((part) => /AS TOKEN/i.test(part));

      if (isTokenProjection) {
        const fields = strings.map((part) => part.trim().toUpperCase());
        const tokenAt = fields.findIndex((part) => part.includes('AS TOKEN'));
        // Bindings pair positionally with the filters AFTER the projection, so
        // `owner = $` and `key = $` are the real row identity — never a tenant.
        const filters = fields.slice(tokenAt + 1);
        const boundTo = (column: string): string | undefined => {
          const index = filters.findIndex((part) => new RegExp(`\\b${column}\\s*=`).test(part));
          return index === -1 ? undefined : values[index];
        };
        const owner = boundTo('OWNER');
        const key = boundTo('KEY');
        const tokenOf = (stored: unknown): string | null => {
          const record = stored as { token?: unknown } | null;
          return typeof record?.token === 'string' ? record.token : null;
        };
        const selected = rows
          .filter(([id]) => owner === undefined || id.startsWith(`${owner}${KEY_SEPARATOR}`))
          .map(([id, stored]) => ({ id, token: tokenOf(stored) }))
          .filter((row) => key === undefined || row.id === `${owner}${KEY_SEPARATOR}${key}`);
        // `AND doc->>'token' = $` filters on the PROJECTION, so a non-matching
        // claim still yields a row whose projection is NULL (`{ token: null }`)
        // — distinct from no row at all.
        const tokenFiltered = filters.some((part) => /\.DOC->>'TOKEN'\s*=/.test(part));
        const token = boundTo("TOKEN'");
        const matching = tokenFiltered ? selected.filter((row) => row.token === token) : selected;
        return Promise.resolve(matching.map(({ token: value }) => ({ token: value })));
      }
      const [owner, key] = values;
      const selected = rows
        .filter(([ownerKey]) =>
          owner === undefined || key === undefined
            ? true
            : ownerKey === `${owner}${KEY_SEPARATOR}${key}`,
        )
        .map(([ownerKey, stored]) => {
          const [rowOwner = '', rowKey = ''] = ownerKey.split(KEY_SEPARATOR);
          return { owner: rowOwner, key: rowKey, doc: JSON.stringify(stored) };
        });
      return Promise.resolve(selected);
    }

    // The workspace lease renews with `jsonb_set(doc, '{expiresAt}', …)`, which
    // is the only UPDATE whose target field is named by a SQL literal. It is
    // matched on the RAW text: the filter compares against the field name, so
    // the upper-cased copy above can never see it.
    const rawText = strings.join(' ').replace(/\s+/g, ' ').trim();
    const expiresAtField = /jsonb_set\s*\(\s*doc\s*,\s*'\{expiresAt\}'/i.test(rawText);

    if (/^UPDATE/i.test(rawText) && expiresAtField) {
      // Bind order: the value filling `jsonb_set` first, then the WHERE
      // filters in textual order — owner, key, and finally `doc->>'token' = $`.
      const values = scalars(rest);
      const expiresAt = values[0] as string;
      const token = values.at(-1);
      const [owner, key] = values.slice(1, -1);
      const id = `${owner}${KEY_SEPARATOR}${key}`;
      const db = read();
      const rows = db[table] ?? {};
      const stored = rows[id] as { token?: unknown; expiresAt?: unknown } | undefined;
      const liveUntil =
        stored?.expiresAt === undefined ? Number.NaN : Date.parse(String(stored.expiresAt));
      // `AND (doc->>'expiresAt')::timestamptz > to_timestamp(${nowMs} / 1000.0)`
      // binds the renewal instant as a NUMBER of milliseconds.
      const nowMs = typeof rest.at(-1) === 'number' ? (rest.at(-1) as number) : Number.NaN;

      if (stored !== undefined && stored.token === token && liveUntil > nowMs) {
        rows[id] = { ...stored, expiresAt };
        commit({ ...db, [table]: rows });
        return Promise.resolve([{ doc: JSON.stringify(rows[id]) }]);
      }
      return Promise.resolve([]);
    }

    // An UPDATE whose payload is a whole document is the same write as an
    // INSERT for a schemaless row — but only when the statement really carries
    // a JSON parameter. `INSERT … ON CONFLICT … SET doc = EXCLUDED.doc` carries
    // none (its document arrives as the VALUES bind), so it must fall through
    // to the guarded-upsert branch instead of silently overwriting the row.
    const payload = payloadDoc(rest);
    if (payload !== undefined && (text.startsWith('INSERT INTO') || text.startsWith('UPDATE'))) {
      const [owner, key] = scalars(rest);
      if (owner !== undefined && key !== undefined) {
        if (isGuardedUpsert(text)) {
          // A CONDITIONAL upsert is not a write until its guard admits it — the
          // row lock that makes concurrent acquisition safe in PostgreSQL is
          // emulated by evaluating the documented WHERE here and returning the
          // affected row, exactly as `RETURNING doc` would.
          const applied = guardedUpsert(table, owner, key, payload, rest);
          return Promise.resolve(applied.map((row) => ({ doc: JSON.stringify(row) })));
        }
        upsert(table, owner, key, payload);
      }
      return Promise.resolve([]);
    }

    if (text.startsWith('DELETE')) {
      const values = scalars(rest);
      // Token-checked release: DELETE … WHERE owner = $ AND key = $ AND
      // doc->>'token' = $ — a stale token must never free a replacement.
      const [owner, key, token] = values;
      if (owner !== undefined && key !== undefined) {
        const db = read();
        const rows = db[table] ?? {};
        const id = `${owner}${KEY_SEPARATOR}${key}`;
        const stored = rows[id] as { token?: unknown } | undefined;
        const tokenMatches = token === undefined || stored?.token === token;
        if (tokenMatches) delete rows[id];
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

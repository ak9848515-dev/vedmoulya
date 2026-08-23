// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Postgres Identity Repository
// Verifies query builders, mapping helpers, and pagination
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserFactory } from '@vedmoulya/domain';

// Mock getDatabase so no real pool is created; tests drive a fake query builder.
const mockGetDatabase = vi.fn();
vi.mock('../src/infrastructure/persistence/DatabaseConnection.js', () => ({
  getDatabase: () => mockGetDatabase(),
  initializeDatabase: vi.fn(),
  closeDatabase: vi.fn(),
}));

import { PostgresIdentityRepository } from '../src/infrastructure/persistence/PostgresIdentityRepository.js';
import type { UserRow } from '../src/schema/users.js';

/** A chainable fake query builder that resolves to a configurable value. */
function makeQuery(value: unknown) {
  const chain: {
    where: () => typeof chain;
    limit: () => typeof chain;
    offset: () => typeof chain;
    orderBy: () => typeof chain;
    from: () => typeof chain;
    values: () => typeof chain;
    set: () => typeof chain;
    then: (onFulfilled: (v: unknown) => unknown) => Promise<unknown>;
  } = {} as never;
  chain.where = () => chain;
  chain.limit = () => chain;
  chain.offset = () => chain;
  chain.orderBy = () => chain;
  chain.from = () => chain;
  chain.values = () => chain;
  chain.set = () => chain;
  chain.then = (onFulfilled) => Promise.resolve(value).then(onFulfilled);
  return chain;
}

function makeRow(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 'usr_123',
    email: 'user@example.com',
    emailVerified: true,
    displayName: 'Jane Doe',
    givenName: 'Jane',
    familyName: 'Doe',
    avatarUrl: null,
    bio: null,
    timezone: null,
    locale: null,
    theme: 'system',
    language: 'en',
    notificationsEnabled: true,
    emailNotifications: true,
    pushNotifications: true,
    weeklyDigest: false,
    reducedMotion: false,
    reducedTransparency: false,
    twoFactorEnabled: false,
    sessionTimeoutMinutes: 60,
    loginNotifications: true,
    profileVisibility: 'private',
    showOnlineStatus: true,
    allowDataSharing: false,
    preferredAuthMethod: 'any',
    statusState: 'active',
    statusReason: null,
    statusChangedAt: null,
    entityStatus: 'active',
    passwordHash: 'hashed',
    passwordUpdatedAt: new Date('2024-06-01T00:00:00Z'),
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-06-01T00:00:00Z'),
    googleId: null,
    authProvider: 'email',
    ...overrides,
  };
}

describe('PostgresIdentityRepository', () => {
  let repo: PostgresIdentityRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    // SPRINT-077 — reset the static ddlPromise between tests so each test
    // starts with a clean concurrency guard.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (PostgresIdentityRepository as any).ddlPromise = null;
    repo = new PostgresIdentityRepository();
  });

  describe('findById', () => {
    it('returns a reconstructed user when found', async () => {
      const row = makeRow();
      const select = vi.fn(() => makeQuery([row]));
      mockGetDatabase.mockReturnValue({
        select,
        insert: vi.fn(() => makeQuery(undefined)),
        update: vi.fn(() => makeQuery(undefined)),
        delete: vi.fn(() => makeQuery(undefined)),
      });

      const user = await repo.findById('usr_123' as never);
      expect(user).not.toBeNull();
      expect(user?.id).toBe('usr_123');
      expect(user?.email.toString()).toBe('user@example.com');
      expect(select).toHaveBeenCalled();
    });

    it('returns null when no user matches', async () => {
      mockGetDatabase.mockReturnValue({
        select: vi.fn(() => makeQuery([])),
        insert: vi.fn(() => makeQuery(undefined)),
        update: vi.fn(() => makeQuery(undefined)),
        delete: vi.fn(() => makeQuery(undefined)),
      });
      const user = await repo.findById('missing' as never);
      expect(user).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('queries by the normalized email', async () => {
      const row = makeRow();
      mockGetDatabase.mockReturnValue({
        select: vi.fn(() => makeQuery([row])),
        insert: vi.fn(() => makeQuery(undefined)),
        update: vi.fn(() => makeQuery(undefined)),
        delete: vi.fn(() => makeQuery(undefined)),
      });
      const user = await repo.findByEmail('User@Example.COM' as never);
      expect(user?.email.toString()).toBe('user@example.com');
    });
  });

  describe('save / update / delete', () => {
    function makeUser() {
      return UserFactory.reconstructUser({
        id: 'usr_123',
        email: 'user@example.com',
        displayName: 'Jane Doe',
        statusState: 'active',
        emailVerified: true,
        entityStatus: 'active',
        passwordHash: 'hashed',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-06-01T00:00:00Z'),
      });
    }

    it('inserts the user on save', async () => {
      const insert = vi.fn(() => makeQuery(undefined));
      mockGetDatabase.mockReturnValue({
        select: vi.fn(() => makeQuery([])),
        insert,
        update: vi.fn(() => makeQuery(undefined)),
        delete: vi.fn(() => makeQuery(undefined)),
      });
      await repo.save(makeUser());
      expect(insert).toHaveBeenCalled();
    });

    it('updates the user', async () => {
      const update = vi.fn(() => makeQuery(undefined));
      mockGetDatabase.mockReturnValue({
        select: vi.fn(() => makeQuery([])),
        insert: vi.fn(() => makeQuery(undefined)),
        update,
        delete: vi.fn(() => makeQuery(undefined)),
      });
      await repo.update(makeUser());
      expect(update).toHaveBeenCalled();
    });

    it('deletes the user', async () => {
      const del = vi.fn(() => makeQuery(undefined));
      mockGetDatabase.mockReturnValue({
        select: vi.fn(() => makeQuery([])),
        insert: vi.fn(() => makeQuery(undefined)),
        update: vi.fn(() => makeQuery(undefined)),
        delete: del,
      });
      await repo.delete('usr_123' as never);
      expect(del).toHaveBeenCalled();
    });
  });

  describe('exists / count / countActive', () => {
    it('reports true when a matching email exists', async () => {
      mockGetDatabase.mockReturnValue({
        select: vi.fn(() => makeQuery([{ count: 1 }])),
        insert: vi.fn(() => makeQuery(undefined)),
        update: vi.fn(() => makeQuery(undefined)),
        delete: vi.fn(() => makeQuery(undefined)),
      });
      expect(await repo.exists('user@example.com' as never)).toBe(true);
    });

    it('reports false when no matching email exists', async () => {
      mockGetDatabase.mockReturnValue({
        select: vi.fn(() => makeQuery([{ count: 0 }])),
        insert: vi.fn(() => makeQuery(undefined)),
        update: vi.fn(() => makeQuery(undefined)),
        delete: vi.fn(() => makeQuery(undefined)),
      });
      expect(await repo.exists('nobody@example.com' as never)).toBe(false);
    });

    it('counts total users', async () => {
      mockGetDatabase.mockReturnValue({
        select: vi.fn(() => makeQuery([{ count: 5 }])),
        insert: vi.fn(() => makeQuery(undefined)),
        update: vi.fn(() => makeQuery(undefined)),
        delete: vi.fn(() => makeQuery(undefined)),
      });
      expect(await repo.count()).toBe(5);
    });

    it('counts active users', async () => {
      mockGetDatabase.mockReturnValue({
        select: vi.fn(() => makeQuery([{ count: 3 }])),
        insert: vi.fn(() => makeQuery(undefined)),
        update: vi.fn(() => makeQuery(undefined)),
        delete: vi.fn(() => makeQuery(undefined)),
      });
      expect(await repo.countActive()).toBe(3);
    });
  });

  describe('ensureTable (SPRINT-040 first-run bootstrap)', () => {
    it('issues idempotent DDL creating the users table + unique indexes', async () => {
      const executed: string[] = [];
      const execute = vi.fn((q: unknown) => {
        // drizzle passes its SQL object; stringify it so the DDL text is
        // assertable regardless of the internal shape.
        executed.push(typeof q === 'string' ? q : JSON.stringify(q));
        return Promise.resolve(undefined);
      });
      mockGetDatabase.mockReturnValue({
        select: vi.fn(() => makeQuery([])),
        insert: vi.fn(() => makeQuery(undefined)),
        update: vi.fn(() => makeQuery(undefined)),
        delete: vi.fn(() => makeQuery(undefined)),
        execute,
      });

      await repo.ensureTable();

      // CREATE TABLE + 2 unique indexes + 4 idempotent ALTER ADD COLUMN
      // (SPRINT-041B first-login profile columns — ALTER IF NOT EXISTS keeps
      // existing databases migrated without touching stored values).
      expect(execute).toHaveBeenCalledTimes(7);
      expect(executed[0]).toContain('CREATE TABLE IF NOT EXISTS users');
      expect(executed[0]).toContain('email varchar(255) NOT NULL');
      expect(executed[0]).toContain('password_hash text NOT NULL');
      expect(executed[0]).toContain('google_id varchar(128)');
      expect(executed[1]).toContain('CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx');
      expect(executed[2]).toContain('CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_idx');
      expect(executed[3]).toContain('ALTER TABLE users ADD COLUMN IF NOT EXISTS age integer');
      expect(executed[4]).toContain(
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS gender varchar(32)',
      );
      expect(executed[5]).toContain(
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS purpose varchar(64)',
      );
      expect(executed[6]).toContain(
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS primary_goal varchar(200)',
      );
    });
  });

  // ── SPRINT-077 — ddlPromise concurrency guard & rejection semantics ──────

  describe('ensureTable — ddlPromise concurrency guard (SPRINT-077)', () => {
    it('concurrent callers share exactly one DDL execution', async () => {
      let executeCount = 0;
      const execute = vi.fn(() => {
        executeCount += 1;
        return Promise.resolve();
      });
      mockGetDatabase.mockReturnValue({
        select: vi.fn(() => makeQuery([])),
        insert: vi.fn(() => makeQuery(undefined)),
        update: vi.fn(() => makeQuery(undefined)),
        delete: vi.fn(() => makeQuery(undefined)),
        execute,
      });

      // Fire two ensureTable() calls concurrently — the second call hits the
      // static ddlPromise guard and returns the same in-flight promise.
      const [p1, p2] = await Promise.all([repo.ensureTable(), repo.ensureTable()]);

      expect(p1).toBeUndefined();
      expect(p2).toBeUndefined();
      // 7 DDL statements (CREATE TABLE + 2 indexes + 4 ALTER COLUMN), NOT 14.
      expect(execute).toHaveBeenCalledTimes(7);
    });

    it('second caller receives the same promise while DDL is in-flight', async () => {
      let resolveDdl: () => void;
      const ddlReady = new Promise<void>((resolve) => {
        resolveDdl = resolve;
      });

      const execute = vi.fn(() => ddlReady);
      mockGetDatabase.mockReturnValue({
        select: vi.fn(() => makeQuery([])),
        insert: vi.fn(() => makeQuery(undefined)),
        update: vi.fn(() => makeQuery(undefined)),
        delete: vi.fn(() => makeQuery(undefined)),
        execute,
      });

      // Start first call — it hits the first execute and suspends.
      const p1 = repo.ensureTable();
      // Start second call — ddlPromise is set, so it awaits the same promise.
      const p2 = repo.ensureTable();

      // Let DDL complete.
      resolveDdl!();
      await Promise.all([p1, p2]);

      // The async function wraps each call in a new promise, so p1 !== p2.
      // Shared execution is proven by: execute was called 7 times (not 14),
      // and the second caller did not trigger a second DDL suite.
      expect(execute).toHaveBeenCalledTimes(7);
    });
  });

  describe('ensureTable — ddlPromise rejection clears cache (SPRINT-077)', () => {
    it('rejection clears ddlPromise so a subsequent call retries DDL', async () => {
      const dbError = new Error('connection refused');

      // First attempt: execute rejects on the first DDL statement.
      mockGetDatabase.mockReturnValue({
        select: vi.fn(() => makeQuery([])),
        insert: vi.fn(() => makeQuery(undefined)),
        update: vi.fn(() => makeQuery(undefined)),
        delete: vi.fn(() => makeQuery(undefined)),
        execute: vi.fn(() => Promise.reject(dbError)),
      });

      await expect(repo.ensureTable()).rejects.toThrow('connection refused');

      // ddlPromise should have been cleared by the catch block.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((PostgresIdentityRepository as any).ddlPromise).toBeNull();

      // Second attempt: execute succeeds — a new DDL attempt starts.
      const execute = vi.fn(() => Promise.resolve());
      mockGetDatabase.mockReturnValue({
        select: vi.fn(() => makeQuery([])),
        insert: vi.fn(() => makeQuery(undefined)),
        update: vi.fn(() => makeQuery(undefined)),
        delete: vi.fn(() => makeQuery(undefined)),
        execute,
      });

      await repo.ensureTable();

      // The retry executed the full DDL suite (7 statements).
      expect(execute).toHaveBeenCalledTimes(7);
      // ddlPromise is now a resolved promise (not null — guard is set again).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((PostgresIdentityRepository as any).ddlPromise).not.toBeNull();
    });

    it('original error is rethrown to the caller', async () => {
      const dbError = new Error('ECONNREFUSED');
      mockGetDatabase.mockReturnValue({
        select: vi.fn(() => makeQuery([])),
        insert: vi.fn(() => makeQuery(undefined)),
        update: vi.fn(() => makeQuery(undefined)),
        delete: vi.fn(() => makeQuery(undefined)),
        execute: vi.fn(() => Promise.reject(dbError)),
      });

      try {
        await repo.ensureTable();
        expect.fail('should have thrown');
      } catch (error) {
        expect(error).toBe(dbError);
      }
    });

    it('subsequent caller after rejection shares the new DDL promise', async () => {
      const dbError = new Error('timeout');
      mockGetDatabase.mockReturnValue({
        select: vi.fn(() => makeQuery([])),
        insert: vi.fn(() => makeQuery(undefined)),
        update: vi.fn(() => makeQuery(undefined)),
        delete: vi.fn(() => makeQuery(undefined)),
        execute: vi.fn(() => Promise.reject(dbError)),
      });

      // Both concurrent callers get the same rejection.
      const [err1, err2] = await Promise.allSettled([repo.ensureTable(), repo.ensureTable()]);

      expect(err1.status).toBe('rejected');
      expect(err2.status).toBe('rejected');
      if (err1.status === 'rejected') expect(err1.reason).toBe(dbError);
      if (err2.status === 'rejected') expect(err2.reason).toBe(dbError);

      // ddlPromise is cleared.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((PostgresIdentityRepository as any).ddlPromise).toBeNull();
    });
  });

  describe('list / findByCreatedAtRange', () => {
    function makeDbForList() {
      const rows = [makeRow({ id: 'usr_1' }), makeRow({ id: 'usr_2' })];
      // Two select calls: rows, then total count.
      let calls = 0;
      const select = vi.fn(() => {
        calls += 1;
        return makeQuery(calls === 1 ? rows : [{ count: 2 }]);
      });
      return {
        select,
        insert: vi.fn(() => makeQuery(undefined)),
        update: vi.fn(() => makeQuery(undefined)),
        delete: vi.fn(() => makeQuery(undefined)),
      };
    }

    it('returns a paginated result', async () => {
      mockGetDatabase.mockReturnValue(makeDbForList());
      const result = await repo.list({ page: 1, limit: 20 });
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('computes totalPages with ceil rounding', async () => {
      // list() issues two select calls (rows, then total count); the first must
      // return valid rows and only the second returns the count.
      let calls = 0;
      const db = {
        select: vi.fn(() => {
          calls += 1;
          return makeQuery(calls === 1 ? [makeRow({ id: 'usr_2' })] : [{ count: 41 }]);
        }),
        insert: vi.fn(() => makeQuery(undefined)),
        update: vi.fn(() => makeQuery(undefined)),
        delete: vi.fn(() => makeQuery(undefined)),
      };
      mockGetDatabase.mockReturnValue(db);
      const result = await repo.list({ page: 2, limit: 20 });
      expect(result.totalPages).toBe(3);
    });

    it('filters by createdAt range with pagination', async () => {
      mockGetDatabase.mockReturnValue(makeDbForList());
      const result = await repo.findByCreatedAtRange(
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-12-31T00:00:00Z'),
        { page: 1, limit: 10 },
      );
      expect(result.data).toHaveLength(2);
      expect(result.totalPages).toBe(1);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Decision Database Connection Tests
// Covers initializeDatabase (success/idempotent/error), closeDatabase
// (success/warn/no-op), and getDatabase (throws before init).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the lazy postgres client + drizzle wrapper so no real connection is made.
// Also mock the core logger: DatabaseConnection is re-imported fresh via
// vi.resetModules() in each test (module-level db/client state), which would
// otherwise create a fresh @vedmoulya/core instance that a static spy on the
// original logger cannot observe.
const { postgresMock, drizzleMock, mockLogger } = vi.hoisted(() => ({
  postgresMock: vi.fn(),
  drizzleMock: vi.fn(),
  mockLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  },
}));

vi.mock('postgres', () => ({ default: postgresMock }));
vi.mock('drizzle-orm/postgres-js', () => ({ drizzle: drizzleMock }));
vi.mock('@vedmoulya/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vedmoulya/core')>();
  return { ...actual, logger: mockLogger };
});

import { databaseManager } from '@vedmoulya/core';

type DbModule = typeof import('../DatabaseConnection.js');

/** Load a fresh module instance so the module-level db/client state resets. */
async function loadFresh(): Promise<DbModule> {
  vi.resetModules();
  return import('../DatabaseConnection.js');
}

describe('Decision DatabaseConnection', () => {
  beforeEach(() => {
    // Reset the shared-pool cache so each test starts from a fresh pool.
    databaseManager.resetForTests();
    // Plain vi.fn() mocks are NOT restored by vi.restoreAllMocks() — reset them
    // so call counts don't leak across tests. Pin NODE_ENV so the ssl option
    // (ssl: undefined unless production) is deterministic regardless of the
    // developer's shell environment.
    process.env.NODE_ENV = 'test';
    postgresMock.mockReset();
    drizzleMock.mockReset();
    mockLogger.info.mockClear();
    mockLogger.error.mockClear();
    mockLogger.warn.mockClear();
    delete process.env.DECISION_DATABASE_URL;
    delete process.env.DATABASE_URL;
    delete process.env.DECISION_DB_POOL_MAX;
    delete process.env.DB_POOL_MAX;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getDatabase throws before initialization', async () => {
    const mod = await loadFresh();
    expect(() => mod.getDatabase()).toThrow(
      'Decision database not initialized. Call initializeDatabase() first.',
    );
  });

  it('initializeDatabase creates the pool and database', async () => {
    const endMock = vi.fn().mockResolvedValue(undefined);
    const client = { end: endMock };
    const drizzleDb = { _drizzle: true };
    postgresMock.mockReturnValue(client);
    drizzleMock.mockReturnValue(drizzleDb);

    const mod = await loadFresh();
    mod.initializeDatabase();

    // SPRINT-088 — the dev/test fallback inherits config.database.url (the
    // credential-bearing platform URL); assert scheme + shape, not a specific
    // host, so the test stays valid across environment setups.
    // SPRINT-090 — the pool is owned by the shared DatabaseManager.
    expect(postgresMock).toHaveBeenCalledWith(
      expect.stringMatching(/^postgres(ql)?:\/\//),
      expect.objectContaining({ max: 10 }),
    );
    expect(drizzleMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ schema: expect.anything() }),
    );
    expect(mockLogger.info).toHaveBeenCalledWith('Decision database connection established');
    expect(mod.getDatabase()).toBe(drizzleDb);
  });

  it('initializeDatabase is idempotent', async () => {
    postgresMock.mockReturnValue({ end: vi.fn().mockResolvedValue(undefined) });
    drizzleMock.mockReturnValue({});

    const mod = await loadFresh();
    mod.initializeDatabase();
    mod.initializeDatabase();

    expect(postgresMock).toHaveBeenCalledTimes(1);
  });

  it('initializeDatabase rethrows and logs when the pool fails', async () => {
    postgresMock.mockImplementation(() => {
      throw new Error('connection refused');
    });

    const mod = await loadFresh();
    expect(() => mod.initializeDatabase()).toThrow('connection refused');
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize decision database', {
      error: 'connection refused',
    });
  });

  it('closeDatabase releases the handle without ending the shared pool', async () => {
    const endMock = vi.fn().mockResolvedValue(undefined);
    postgresMock.mockReturnValue({ end: endMock });
    drizzleMock.mockReturnValue({});

    const mod = await loadFresh();
    mod.initializeDatabase();
    await mod.closeDatabase();

    // SPRINT-090 — a single engine must never tear down the shared pool.
    expect(endMock).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Decision database connection released (shared pool stays open)',
    );
    expect(() => mod.getDatabase()).toThrow('Decision database not initialized');
  });

  it('closeDatabase is a no-op when never initialized', async () => {
    const mod = await loadFresh();
    await expect(mod.closeDatabase()).resolves.toBeUndefined();
  });
});

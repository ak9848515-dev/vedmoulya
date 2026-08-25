// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Execution Database Connection unit tests
// BLD-009 — Execution Intelligence Engine
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock postgres + drizzle before importing the module under test
const postgresMock = vi.hoisted(() => vi.fn());
const drizzleMock = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));
const requireProdExternalUrlMock = vi.hoisted(() =>
  vi.fn((_name: string, fallback: string) => fallback),
);

vi.mock('postgres', () => ({ default: postgresMock }));
vi.mock('drizzle-orm/postgres-js', () => ({ drizzle: drizzleMock }));
// SPRINT-088 — the dev/test fallback chain now ends at config.database.url
// (the credential-bearing platform URL) instead of a credential-less
// per-service localhost default that could never authenticate.
const TEST_PLATFORM_DB_URL = 'postgres://platform-db.test:5432/vedmoulya_test';
vi.mock('@vedmoulya/core', () => ({
  logger: mockLogger,
  requireProdExternalUrl: requireProdExternalUrlMock,
  config: { database: { url: TEST_PLATFORM_DB_URL } },
}));

const { initializeDatabase, closeDatabase, getDatabase } = await import('../DatabaseConnection.js');

describe('Execution DatabaseConnection', () => {
  beforeEach(() => {
    postgresMock.mockReset();
    drizzleMock.mockReset();
    mockLogger.info.mockClear();
    mockLogger.error.mockClear();
    mockLogger.warn.mockClear();
    requireProdExternalUrlMock.mockClear();
    requireProdExternalUrlMock.mockImplementation((_name: string, fallback: string) => fallback);
    vi.stubEnv('NODE_ENV', 'test');
  });

  it('initializeDatabase creates the postgres client and drizzle instance', async () => {
    const client = { end: vi.fn().mockResolvedValue(undefined) };
    postgresMock.mockReturnValue(client);
    drizzleMock.mockReturnValue({ __drizzle: true });

    await initializeDatabase();
    expect(postgresMock).toHaveBeenCalledWith(TEST_PLATFORM_DB_URL, {
      max: 10,
      ssl: undefined,
    });
    expect(drizzleMock).toHaveBeenCalled();
    expect(getDatabase()).toEqual({ __drizzle: true });
    await closeDatabase();
  });

  it('is idempotent when already initialized', async () => {
    const client = { end: vi.fn().mockResolvedValue(undefined) };
    postgresMock.mockReturnValue(client);
    drizzleMock.mockReturnValue({ __drizzle: true });

    await initializeDatabase();
    const first = getDatabase();
    await initializeDatabase();
    expect(getDatabase()).toBe(first);
    expect(postgresMock).toHaveBeenCalledTimes(1);
    await closeDatabase();
  });

  it('closeDatabase resets the singleton', async () => {
    const client = { end: vi.fn().mockResolvedValue(undefined) };
    postgresMock.mockReturnValue(client);
    drizzleMock.mockReturnValue({ __drizzle: true });

    await initializeDatabase();
    await closeDatabase();
    expect(client.end).toHaveBeenCalledTimes(1);
    expect(() => getDatabase()).toThrow(/not initialized/i);
  });

  it('closeDatabase is a no-op when never initialized', async () => {
    await expect(closeDatabase()).resolves.toBeUndefined();
    expect(postgresMock).not.toHaveBeenCalled();
  });

  it('logs and rethrows initialization failures', () => {
    postgresMock.mockImplementation(() => {
      throw new Error('connection refused');
    });
    // initializeDatabase() is synchronous: it throws directly rather than rejecting.
    expect(() => initializeDatabase()).toThrow('connection refused');
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize execution database', {
      error: 'connection refused',
    });
  });
});

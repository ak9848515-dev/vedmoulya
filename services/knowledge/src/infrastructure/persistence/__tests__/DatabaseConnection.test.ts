// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Knowledge Database Connection unit tests
// ARC-003 — Knowledge Graph Bounded Context
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

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
vi.mock('@vedmoulya/core', () => ({
  logger: mockLogger,
  requireProdExternalUrl: requireProdExternalUrlMock,
}));

const { getDatabaseConfig, initializeDatabase, closeDatabase, getDatabase } =
  await import('../DatabaseConnection.js');

describe('Knowledge DatabaseConnection', () => {
  beforeEach(() => {
    postgresMock.mockReset();
    drizzleMock.mockReset();
    mockLogger.info.mockClear();
    mockLogger.error.mockClear();
    requireProdExternalUrlMock.mockClear();
    requireProdExternalUrlMock.mockImplementation((_name: string, fallback: string) => fallback);
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('getDatabaseConfig reads env values with defaults', () => {
    const cfg = getDatabaseConfig();
    expect(cfg.url).toContain('vedmoulya_knowledge');
    expect(cfg.poolMin).toBe(2);
    expect(cfg.poolMax).toBe(20);
    expect(cfg.timeout).toBe(30000);
  });

  it('getDatabaseConfig honors custom env values', () => {
    vi.stubEnv('DB_POOL_MIN', '5');
    vi.stubEnv('DB_POOL_MAX', '50');
    vi.stubEnv('DB_TIMEOUT', '60000');
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@db:5432/knowledge');

    const cfg = getDatabaseConfig();

    expect(cfg.poolMin).toBe(5);
    expect(cfg.poolMax).toBe(50);
    expect(cfg.timeout).toBe(60000);
    expect(cfg.url).toBe('postgres://u:p@db:5432/knowledge');
  });

  it('initializeDatabase creates the client and drizzle instance', async () => {
    const client = { end: vi.fn().mockResolvedValue(undefined) };
    postgresMock.mockReturnValue(client);
    drizzleMock.mockReturnValue({ __drizzle: true });

    const db = await initializeDatabase();

    expect(postgresMock).toHaveBeenCalledWith(
      expect.stringContaining('vedmoulya_knowledge'),
      expect.objectContaining({ max: 20 }),
    );
    expect(drizzleMock).toHaveBeenCalled();
    expect(db).toEqual({ __drizzle: true });
    expect(getDatabase()).toEqual({ __drizzle: true });
    await closeDatabase();
  });

  it('initializeDatabase accepts an explicit config and is idempotent', async () => {
    const client = { end: vi.fn().mockResolvedValue(undefined) };
    postgresMock.mockReturnValue(client);
    drizzleMock.mockReturnValue({ __drizzle: true });

    await initializeDatabase({
      url: 'postgres://db:5432/k',
      poolMin: 1,
      poolMax: 5,
      timeout: 1000,
    });
    const first = getDatabase();
    const second = await initializeDatabase({
      url: 'postgres://db:5432/k',
      poolMin: 1,
      poolMax: 5,
      timeout: 1000,
    });

    expect(second).toBe(first);
    expect(postgresMock).toHaveBeenCalledTimes(1);
    await closeDatabase();
  });

  it('getDatabase throws before initialization', () => {
    expect(() => getDatabase()).toThrow(/not initialized/i);
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
});

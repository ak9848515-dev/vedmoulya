import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockEnd = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockSql = vi.hoisted(() => ({ end: mockEnd }));
const mockPostgres = vi.hoisted(() => vi.fn().mockReturnValue(mockSql));
const mockDrizzle = vi.hoisted(() => vi.fn().mockReturnValue({ fakeDb: true }));

vi.mock('postgres', () => ({ default: mockPostgres }));
vi.mock('drizzle-orm/postgres-js', () => ({ drizzle: mockDrizzle }));

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@vedmoulya/core', async () => {
  const actual = await vi.importActual('@vedmoulya/core');
  return {
    ...(actual as Record<string, unknown>),
    logger: mockLogger,
  };
});

interface DatabaseConnectionModule {
  initializeDatabase: () => void;
  closeDatabase: () => Promise<void>;
  getDatabase: () => unknown;
}

async function loadModule(): Promise<DatabaseConnectionModule> {
  return import('../persistence/DatabaseConnection.js') as Promise<DatabaseConnectionModule>;
}

describe('DatabaseConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPostgres.mockReturnValue(mockSql);
    mockDrizzle.mockReturnValue({ fakeDb: true });
  });

  afterEach(async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('throws when getDatabase is called before initialize', async () => {
    const mod = await loadModule();
    expect(() => mod.getDatabase()).toThrow(/not initialized/);
  });

  it('initializes the pool once and exposes the database', async () => {
    const mod = await loadModule();
    mod.initializeDatabase();
    // Accept both the `postgres://` and `postgresql://` schemes (the latter
    // is the standard libpq form — the previous `stringContaining('postgres://')`
    // assertion was brittle and failed on a valid `postgresql://` URL).
    expect(mockPostgres).toHaveBeenCalledWith(
      expect.stringMatching(/^postgres(ql)?:\/\//),
      expect.objectContaining({ max: 10 }),
    );
    expect(mockDrizzle).toHaveBeenCalledWith(mockSql, expect.anything());
    expect(mod.getDatabase()).toEqual({ fakeDb: true });
    expect(mockLogger.info).toHaveBeenCalledWith('Memory database connection established');
  });

  it('is idempotent — a second initialize is a no-op', async () => {
    const mod = await loadModule();
    mod.initializeDatabase();
    mod.initializeDatabase();
    expect(mockPostgres).toHaveBeenCalledTimes(1);
  });

  it('closes the pool and resets the database reference', async () => {
    const mod = await loadModule();
    mod.initializeDatabase();
    await mod.closeDatabase();
    expect(mockEnd).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith('Memory database connection closed');
    expect(() => mod.getDatabase()).toThrow(/not initialized/);
  });

  it('closeDatabase is a no-op when never initialized', async () => {
    const mod = await loadModule();
    await expect(mod.closeDatabase()).resolves.toBeUndefined();
    expect(mockEnd).not.toHaveBeenCalled();
  });

  it('warns when closing fails but still resets', async () => {
    mockEnd.mockRejectedValueOnce(new Error('end failed'));
    const mod = await loadModule();
    mod.initializeDatabase();
    await mod.closeDatabase();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Error closing memory database connection',
      expect.objectContaining({ error: 'end failed' }),
    );
    expect(() => mod.getDatabase()).toThrow(/not initialized/);
  });

  it('reads pool size from MEMORY_DB_POOL_MAX', async () => {
    const saved = process.env.MEMORY_DB_POOL_MAX;
    try {
      process.env.MEMORY_DB_POOL_MAX = '25';
      const mod = await loadModule();
      mod.initializeDatabase();
      expect(mockPostgres).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ max: 25 }),
      );
    } finally {
      if (saved === undefined) delete process.env.MEMORY_DB_POOL_MAX;
      else process.env.MEMORY_DB_POOL_MAX = saved;
    }
  });

  it('propagates errors when the connection fails', async () => {
    mockPostgres.mockImplementationOnce(() => {
      throw new Error('connection refused');
    });
    const mod = await loadModule();
    expect(() => mod.initializeDatabase()).toThrow(/connection refused/);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to initialize memory database',
      expect.objectContaining({ error: 'connection refused' }),
    );
  });
});

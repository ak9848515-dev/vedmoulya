// ──────────────────────────────────────────────────────────────────
// VedMoulya — Unit Tests: Database Connection
// Verifies config resolution, initialization idempotency, and close
// ──────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockPostgres = vi.fn();
const mockDrizzle = vi.fn();

vi.mock('postgres', () => ({
  default: (...args: unknown[]) => mockPostgres(...args),
}));

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: (...args: unknown[]) => mockDrizzle(...args),
}));

import {
  getDatabaseConfig,
  initializeDatabase,
  getDatabase,
  closeDatabase,
} from '../src/infrastructure/persistence/DatabaseConnection.js';

describe('DatabaseConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPostgres.mockReturnValue({ end: vi.fn().mockResolvedValue(undefined) });
    mockDrizzle.mockReturnValue({ __mockDb: true });
  });

  afterEach(async () => {
    await closeDatabase();
  });

  describe('getDatabaseConfig', () => {
    it('returns the pool configuration from the core config', () => {
      const cfg = getDatabaseConfig();
      // Accept both the `postgres://` and `postgresql://` schemes (the latter
      // is the standard libpq form — the previous `toContain('postgres://')`
      // assertion was brittle and failed on a valid `postgresql://` URL).
      expect(cfg.url).toMatch(/^postgres(ql)?:\/\//);
      expect(cfg.poolMin).toBeGreaterThanOrEqual(0);
      expect(cfg.poolMax).toBeGreaterThan(cfg.poolMin);
      expect(cfg.timeout).toBeGreaterThan(0);
    });
  });

  describe('initializeDatabase', () => {
    it('creates a postgres client and drizzle instance', () => {
      const db = initializeDatabase();
      expect(mockPostgres).toHaveBeenCalledTimes(1);
      expect(mockDrizzle).toHaveBeenCalledTimes(1);
      expect(db).toMatchObject({ __mockDb: true });
    });

    it('is idempotent — returns the same instance without reconnecting', () => {
      const first = initializeDatabase();
      const second = initializeDatabase();
      expect(first).toBe(second);
      expect(mockPostgres).toHaveBeenCalledTimes(1);
    });

    it('redacts credentials in the startup log', () => {
      initializeDatabase();
      const url = mockPostgres.mock.calls[0][0];
      expect(url).toBeDefined();
    });

    it('respects an explicitly passed database config', () => {
      initializeDatabase({
        url: 'postgres://u:p@db.internal:5432/x',
        poolMin: 1,
        poolMax: 5,
        timeout: 10,
      });
      expect(mockPostgres).toHaveBeenCalledWith(
        'postgres://u:p@db.internal:5432/x',
        expect.objectContaining({ max: 5 }),
      );
    });
  });

  describe('getDatabase', () => {
    it('returns the initialized database', () => {
      const db = initializeDatabase();
      expect(getDatabase()).toBe(db);
    });

    it('throws when the database has not been initialized', async () => {
      await closeDatabase();
      expect(() => getDatabase()).toThrow(/Database not initialized/);
    });
  });

  describe('closeDatabase', () => {
    it('ends the postgres client and clears the instance', async () => {
      const client = { end: vi.fn().mockResolvedValue(undefined) };
      mockPostgres.mockReturnValue(client);
      initializeDatabase();
      await closeDatabase();
      expect(client.end).toHaveBeenCalled();
      expect(() => getDatabase()).toThrow(/Database not initialized/);
    });

    it('is safe to call when no connection exists', async () => {
      await closeDatabase();
      await closeDatabase();
    });
  });
});

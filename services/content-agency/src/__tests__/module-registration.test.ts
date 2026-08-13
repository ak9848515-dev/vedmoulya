// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Content Agency Module Registration Tests
// EPIC-003 / SPRINT AC-001
// DB-free verification: the module self-registers with the module registry and
// the DI container exposes the repository slot. No Postgres I/O is performed
// (the client is lazy) — persistence integration is covered by the application
// layer's in-memory tests in packages/services.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { container, moduleRegistry } from '@vedmoulya/core';

// The lifecycle hooks touch a real Postgres pool — mock the connection so the
// module-level hooks are testable without I/O.
vi.mock('../infrastructure/persistence/DatabaseConnection.js', () => ({
  initializeDatabase: vi.fn().mockResolvedValue({}),
  closeDatabase: vi.fn().mockResolvedValue(undefined),
}));

describe('content-agency module registration', () => {
  let registerContentAgencyServices: () => void;

  beforeEach(async () => {
    // Idempotent re-registration (container.register is a Map.set).
    ({ registerContentAgencyServices } =
      await import('../infrastructure/di/ContentAgencyModule.js'));
    registerContentAgencyServices();
  });

  it('registers the content-agency module with the registry', () => {
    expect(moduleRegistry.get('content-agency')).toBeDefined();
    expect(moduleRegistry.get('content-agency')?.name).toBe('content-agency');
    expect(moduleRegistry.get('content-agency')?.dependencies).toContain('core');
  });

  it('exposes the content-agency repository in the DI container', () => {
    expect(container.has('content-agency.repository')).toBe(true);
    const repo = container.resolve('content-agency.repository');
    expect(repo).toBeDefined();
    // The Postgres repo is lazy — construction must not open a connection.
    expect(typeof repo.listClients).toBe('function');
  });

  it('exposes the database and client-ops repository slots', async () => {
    expect(container.has('content-agency.db')).toBe(true);
    const db = await container.resolve('content-agency.db');
    expect(db).toBeDefined();
    expect(container.has('content-agency.client-ops.repository')).toBe(true);
    const clientOps = container.resolve('content-agency.client-ops.repository');
    expect(clientOps).toBeDefined();
    expect(typeof clientOps.listLeads).toBe('function');
  });

  it('module register/initialize/shutdown hooks run without error', async () => {
    const mod = moduleRegistry.get('content-agency');
    expect(mod).toBeDefined();
    await mod?.register?.();
    await mod?.initialize?.();
    await mod?.shutdown?.();
  });
});

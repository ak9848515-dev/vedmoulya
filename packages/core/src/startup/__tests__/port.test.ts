// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Deterministic Port Probe Tests (EPIC-019/8)
// Port conflicts must never be silent: a started web server must never quietly
// shift to another port. These tests lock in the probe behaviour.
// ─────────────────────────────────────────────────────────────────────────────

import { afterAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:net';
import { formatPortConflict, isPortAvailable, probePort } from '../port.js';

function findFreePort(): Promise<{ port: number; server: Server; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close();
        reject(new Error('no tcp port'));
        return;
      }
      resolve({
        port: address.port,
        server,
        close: () =>
          new Promise<void>((res) => {
            server.close(() => res());
          }),
      });
    });
  });
}

describe('port probe — availability', () => {
  it('reports an unbound port as available', async () => {
    const free = await findFreePort();
    try {
      await free.close();
      const available = await isPortAvailable(free.port, '127.0.0.1', 1500);
      expect(available).toBe(true);
    } finally {
      await free.close();
    }
  });

  it('reports a bound port as occupied (no silent port juggling)', async () => {
    const free = await findFreePort();
    try {
      const available = await isPortAvailable(free.port, '127.0.0.1', 1500);
      expect(available).toBe(false);
    } finally {
      await free.close();
    }
  });

  it('probePort resolves available=false with the port number for a conflict', async () => {
    const free = await findFreePort();
    try {
      const result = await probePort(free.port, '127.0.0.1', 1500);
      expect(result.available).toBe(false);
      expect(result.port).toBe(free.port);
      expect(formatPortConflict(result)).toContain(`Port ${free.port} is occupied`);
    } finally {
      await free.close();
    }
  });

  it('probePort reports available=true for a free port', async () => {
    const free = await findFreePort();
    try {
      await free.close();
      const result = await probePort(free.port, '127.0.0.1', 1500);
      expect(result.available).toBe(true);
    } finally {
      await free.close();
    }
  });

  it('probePort reports a 0.0.0.0-bound server as OCCUPIED (never silently starts on a taken port)', async () => {
    const bound = await new Promise<{ port: number; server: Server; close: () => Promise<void> }>(
      (resolve, reject) => {
        const server = createServer();
        server.once('error', reject);
        server.listen(0, '0.0.0.0', () => {
          const address = server.address();
          if (address === null || typeof address === 'string') {
            server.close();
            reject(new Error('no tcp port'));
            return;
          }
          resolve({
            port: address.port,
            server,
            close: () =>
              new Promise<void>((res) => {
                server.close(() => res());
              }),
          });
        });
      },
    );
    try {
      const result = await probePort(bound.port, '127.0.0.1', 1500);
      expect(result.available).toBe(false);
      expect(formatPortConflict(result)).toContain(`Port ${bound.port} is occupied`);
    } finally {
      await bound.close();
    }
  });
});

afterAll(async () => {
  // No leaked listeners from findFreePort helpers.
});

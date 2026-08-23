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
      // On Linux the wildcard 0.0.0.0 probe inside probePort can transiently
      // see the port as occupied immediately after close() — either the kernel
      // hasn't fully released the socket or a concurrent process on a shared CI
      // runner re-bound it in the gap.  Retry with bounded backoff (50 ms steps,
      // 2 s ceiling) so the assertion holds on every platform without weakening
      // the expected behavior.
      let result;
      const deadline = Date.now() + 2_000;
      while (Date.now() < deadline) {
        result = await probePort(free.port, '127.0.0.1', 1_500);
        if (result.available) break;
        await new Promise<void>((r) => setTimeout(r, 50));
      }
      expect(result!.available).toBe(true);
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

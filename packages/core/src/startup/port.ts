// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Deterministic Port Diagnostics (EPIC-019)
//
// EPIC-019/8 — port conflicts must never be silent: if :3000 is occupied the
// startup commands DETECT it, name the owner when possible, and either prompt
// (interactive) or fail deterministically (CI). This module owns that probe.
// ─────────────────────────────────────────────────────────────────────────────

import { createServer, type Server } from 'node:net';

export interface PortProbeResult {
  port: number;
  host: string;
  available: boolean;
  /** Best-effort owning PID (Windows netstat / POSIX lsof). */
  ownerPid?: number;
  /** Best-effort owning process name/command line. */
  ownerCommand?: string;
}

function listenAvailable(port: number, host: string, timeoutMs: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const server: Server = createServer();
    const timer = setTimeout(() => {
      server.close();
      resolve(true); // Hung listen: treat as indeterminate -> probe failed, not occupied.
    }, timeoutMs);
    server.once('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
    server.once('listening', () => {
      clearTimeout(timer);
      server.close(() => {
        resolve(true);
      });
    });
    server.listen(port, host);
  });
}

/**
 * Deterministic availability probe: try to bind the port on loopback.
 * Returns `available: false` when the bind fails (port already bound).
 * Never throws for an occupied port (errors resolve to `available: false`).
 */
export async function isPortAvailable(
  port: number,
  host = '127.0.0.1',
  timeoutMs = 1500,
): Promise<boolean> {
  try {
    return await listenAvailable(port, host, timeoutMs);
  } catch {
    return false;
  }
}

/**
 * Full probe: availability + best-effort owner detection. Owner discovery is
 * best-effort (netstat on win32, lsof elsewhere) and bounded.
 *
 * Windows quirk (EPIC-019): bind-based probing is UNRELIABLE on win32 — Node
 * (and others) can hold a LISTENING socket on 0.0.0.0:PORT while a fresh
 * bind on 127.0.0.1:PORT — or even 0.0.0.0:PORT — succeeds, so `next dev`
 * then dies with EADDRINUSE. The authoritative check on Windows is therefore
 * the OS socket table itself (`netstat -ano`: any LISTENING entry for the
 * port across 0.0.0.0 / [::] / 127.0.0.1 / [::1] means OCCUPIED, with PID).
 * POSIX honors EADDRINUSE properly, so there we probe BOTH the requested
 * host and the wildcard address (a web server binds all interfaces).
 */
export async function probePort(
  port: number,
  host = '127.0.0.1',
  timeoutMs = 1500,
): Promise<PortProbeResult> {
  if (process.platform === 'win32') {
    const listener = await findPortListener(port);
    if (listener) {
      return {
        port,
        host,
        available: false,
        ownerPid: listener.ownerPid,
        ownerCommand: listener.ownerCommand,
      };
    }
    return { port, host, available: true };
  }
  const [requestedAvailable, wildcardAvailable] = await Promise.all([
    isPortAvailable(port, host, timeoutMs),
    isPortAvailable(port, '0.0.0.0', timeoutMs),
  ]);
  const available = requestedAvailable && wildcardAvailable;
  const base: PortProbeResult = { port, host, available };
  if (available) return base;
  const owner = await findPortOwner(port);
  return { ...base, ...owner };
}

/**
 * Windows ground truth: query netstat for a LISTENING socket on the port
 * (any address — 0.0.0.0, [::], 127.0.0.1, [::1]). Returns the owning PID
 * when found. Bounded (2s child timeout); never throws.
 */
async function findPortListener(
  port: number,
): Promise<{ ownerPid?: number; ownerCommand?: string } | null> {
  try {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const run = promisify(execFile);
    const { stdout } = await run('netstat', ['-ano'], {
      timeout: 2000,
      maxBuffer: 4 * 1024 * 1024,
    });
    // Matches 0.0.0.0:PORT, [::]:PORT, 127.0.0.1:PORT, [::1]:PORT on any
    // LISTENING line (port is a validated integer, never attacker input).
    // eslint-disable-next-line security/detect-non-literal-regexp
    const listenerPattern = new RegExp(`[.:]${port}\\s`, 'i');
    const line = stdout.split(/\r?\n/).find((l) => /LISTENING/i.test(l) && listenerPattern.test(l));
    if (!line) return null;
    const pid = parseInt(line.trim().split(/\s+/).pop() ?? '', 10);
    return Number.isFinite(pid) ? { ownerPid: pid } : {};
  } catch {
    return null;
  }
}

export async function findPortOwner(
  port: number,
): Promise<{ ownerPid?: number; ownerCommand?: string }> {
  try {
    if (process.platform === 'win32') {
      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const run = promisify(execFile);
      const { stdout } = await run('netstat', ['-ano'], { timeout: 2000 });
      const line = stdout
        .split(/\r?\n/)
        // port is a validated integer (not attacker-controlled) — the RegExp
        // here is intentionally built from it; disabling the heuristic rule.
        // eslint-disable-next-line security/detect-non-literal-regexp
        .find((l) => /LISTENING/i.test(l) && new RegExp(`[:.]${port}\\s`, 'i').test(l));
      if (!line) return {};
      const pid = parseInt(line.trim().split(/\s+/).pop() ?? '', 10);
      return Number.isFinite(pid) ? { ownerPid: pid } : {};
    }
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const run = promisify(execFile);
    const { stdout } = await run('lsof', ['-nP', '-i', `:${port}`, '-sTCP:LISTEN'], {
      timeout: 2000,
      maxBuffer: 1024 * 1024,
    });
    const line = stdout.split(/\r?\n/)[1];
    if (!line) return {};
    const parts = line.trim().split(/\s+/);
    const pid = parseInt(parts[1] ?? '', 10);
    return { ownerPid: Number.isFinite(pid) ? pid : undefined, ownerCommand: parts[0] };
  } catch {
    return {};
  }
}

export function formatPortConflict(result: PortProbeResult): string {
  const who =
    result.ownerPid !== undefined
      ? ` (PID ${result.ownerPid}${result.ownerCommand ? `, ${result.ownerCommand}` : ''})`
      : '';
  return `Port ${result.port} is occupied${who}.`;
}

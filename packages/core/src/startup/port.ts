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
    // Windows: the socket table is authoritative WHEN readable, but netstat may
    // be unavailable (not on PATH, or blocked). Never treat "could not read the
    // socket table" as "the port is free" — that is exactly the silent
    // port-conflict this module exists to prevent. Fall back to the bind probe
    // (best-effort on Windows) so an occupied port is still reported occupied.
    const { readable } = await netstatReadable();
    if (!readable) {
      const requestedAvailable = await isPortAvailable(port, host, timeoutMs);
      if (!requestedAvailable) {
        const owner = await findPortOwner(port);
        return { port, host, available: false, ...owner };
      }
    }
    return { port, host, available: true };
  }
  // SPRINT-073: run the two availability binds SEQUENTIALLY.  A concurrent
  // bind to both 127.0.0.1 and the wildcard 0.0.0.0 can self-collide at the
  // kernel level on Linux (both listeners are on the same port, and their
  // address sets overlap) — producing an EADDRINUSE that wrongly reports a
  // genuinely free port as occupied.  Serializing (each probe's socket closes
  // before the next binds) removes the race while preserving the identical
  // availability semantics: both the requested host and the wildcard address
  // must be bindable.
  const requestedAvailable = await isPortAvailable(port, host, timeoutMs);
  const wildcardAvailable = await isPortAvailable(port, '0.0.0.0', timeoutMs);
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
  const stdout = await readNetstat();
  if (stdout === null) return null;
  // Matches 0.0.0.0:PORT, [::]:PORT, 127.0.0.1:PORT, [::1]:PORT on any
  // LISTENING line (port is a validated integer, never attacker input).
  // eslint-disable-next-line security/detect-non-literal-regexp
  const listenerPattern = new RegExp(`[.:]${port}\\s`, 'i');
  const line = stdout.split(/\r?\n/).find((l) => /LISTENING/i.test(l) && listenerPattern.test(l));
  if (!line) return null;
  const pid = parseInt(line.trim().split(/\s+/).pop() ?? '', 10);
  return Number.isFinite(pid) ? { ownerPid: pid } : {};
}

/**
 * Resolve the netstat executable. On Windows `netstat` lives in System32 but is
 * not always on the process PATH (minimal shells, restricted environments), so
 * resolve the absolute path explicitly before falling back to the bare name.
 */
function netstatCommand(): string {
  if (process.platform === 'win32' && process.env.SystemRoot) {
    return `${process.env.SystemRoot}\\System32\\netstat.exe`;
  }
  return 'netstat';
}

/** Read the OS socket table; null when it cannot be read (never throws). */
async function readNetstat(): Promise<string | null> {
  try {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const run = promisify(execFile);
    const { stdout } = await run(netstatCommand(), ['-ano'], {
      timeout: 2000,
      maxBuffer: 4 * 1024 * 1024,
    });
    return stdout;
  } catch {
    return null;
  }
}

/**
 * Can the OS socket table be read at all? When it cannot, availability must fall
 * back to a bind probe — "cannot inspect" is NOT the same as "available".
 */
async function netstatReadable(): Promise<{ readable: boolean }> {
  const stdout = await readNetstat();
  return { readable: stdout !== null };
}

export async function findPortOwner(
  port: number,
): Promise<{ ownerPid?: number; ownerCommand?: string }> {
  try {
    if (process.platform === 'win32') {
      const stdout = await readNetstat();
      if (stdout === null) return {};
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

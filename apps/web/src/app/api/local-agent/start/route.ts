// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Local Agent Background Lifecycle Route Handler
//
// Allows the web application to check and start the Local Agent on the host
// machine on-demand without requiring the user to run manual terminal commands.
// ─────────────────────────────────────────────────────────────────────────────
/* eslint-disable security/detect-non-literal-fs-filename -- repo root search uses internal paths */

import { NextResponse } from 'next/server.js';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const LOCAL_AGENT_HEALTH_URL = 'http://127.0.0.1:43117/health';

function findRepoRoot(): string {
  let curr = process.cwd();
  for (let i = 0; i < 5; i += 1) {
    if (fs.existsSync(path.join(curr, 'packages', 'local-ai'))) {
      return curr;
    }
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return process.cwd();
}

async function isAgentHealthy(): Promise<boolean> {
  try {
    const res = await fetch(LOCAL_AGENT_HEALTH_URL, {
      method: 'GET',
      signal: AbortSignal.timeout(1000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function GET(): Promise<NextResponse> {
  const running = await isAgentHealthy();
  return NextResponse.json({ running });
}

export async function POST(): Promise<NextResponse> {
  // 1. If already answering, return success immediately
  if (await isAgentHealthy()) {
    return NextResponse.json({
      ok: true,
      alreadyRunning: true,
      message: 'Local Agent is already running and reachable.',
      url: 'http://127.0.0.1:43117',
    });
  }

  // 2. Locate root and spawn detached background agent
  const repoRoot = findRepoRoot();
  const isWindows = process.platform === 'win32';
  const npmCommand = isWindows ? 'npm.cmd' : 'npm';

  try {
    const child = spawn(npmCommand, ['run', 'local-agent'], {
      cwd: repoRoot,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      shell: isWindows,
      env: { ...process.env },
    });
    child.unref();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        ok: false,
        error: 'SPAWN_FAILED',
        message: `Failed to spawn Local Agent process: ${msg}`,
      },
      { status: 500 },
    );
  }

  // 3. Poll for health response (up to 12 seconds)
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(300);
    if (await isAgentHealthy()) {
      return NextResponse.json({
        ok: true,
        alreadyRunning: false,
        message: 'Local Agent started successfully.',
        url: 'http://127.0.0.1:43117',
      });
    }
  }

  return NextResponse.json(
    {
      ok: false,
      error: 'TIMEOUT',
      message:
        'Local Agent was launched, but did not respond on http://127.0.0.1:43117 within 12s.',
    },
    { status: 504 },
  );
}

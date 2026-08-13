#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────────────
// VedMoulya — Port Probe CLI (EPIC-019/8)
//
//   npx tsx scripts/check-port.ts [--port 3000]
//
// Prints ONE machine-readable line for scripts/startup.sh to act on:
//   AVAILABLE
//   OCCUPIED <pid> [<command>]
//   ERROR <message>
//
// Port conflicts are NEVER silent: startup detects them, names the owner
// when possible, and either prompts (interactive) or fails deterministically
// (CI). The probe itself is `probePort` from @vedmoulya/core — the same one
// `npm run doctor` uses, so both surfaces always agree.
// ─────────────────────────────────────────────────────────────────────────────

import { probePort } from '@vedmoulya/core';

function parsePort(argv: readonly string[]): number {
  const index = argv.indexOf('--port');
  if (index >= 0 && argv[index + 1]) {
    const parsed = Number.parseInt(argv[index + 1] as string, 10);
    if (Number.isInteger(parsed) && parsed > 0 && parsed < 65536) return parsed;
  }
  return 3000;
}

async function main(): Promise<void> {
  const port = parsePort(process.argv.slice(2));
  try {
    const result = await probePort(port, '127.0.0.1', 2000);
    if (result.available) {
      console.log('AVAILABLE');
      return;
    }
    const who = [result.ownerPid, result.ownerCommand].filter(Boolean).join(' ');
    console.log(`OCCUPIED ${who}`.trimEnd());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`ERROR ${message}`);
    process.exitCode = 1;
  }
}

void main();
